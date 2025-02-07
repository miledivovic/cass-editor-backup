addConcept = function () {
    if (viewMode) return;
    var addOrSearch = $("#sidebarAddCompetencies").attr('value');
    if (addOrSearch == "search") {
        initIframe();
        showPage("#findCompetencySection", framework);
    } else if (addOrSearch == "new") {
        isFirstEdit = true;
        previousSelectedCompetency = selectedCompetency;
        var c = new EcConcept();
        if (newObjectEndpoint != null)
            c.generateShortId(newObjectEndpoint == null ? repo.selectedServer : newObjectEndpoint);
        else
            c.generateId(newObjectEndpoint == null ? repo.selectedServer : newObjectEndpoint);
        if (EcIdentityManager.ids.length > 0)
            c.addOwner(EcIdentityManager.ids[0].ppk.toPk());
        c["skos:prefLabel"] = "New Concept";
        c["skos:inScheme"] = framework.shortId();
        if (selectedCompetency != null) {
            collapseCompetencyTracking(framework.shortId(),selectedCompetency.shortId(),"expanded");
            if (selectedCompetency["skos:narrower"] == null)
                selectedCompetency["skos:narrower"] = [];
            EcArray.setAdd(selectedCompetency["skos:narrower"], c.shortId());
            if (c["skos:broader"] == null)
                c["skos:broader"] = [];
            EcArray.setAdd(c["skos:broader"], selectedCompetency.shortId());
            repo.saveTo(c, function () {
                repo.saveTo(selectedCompetency, function () {
                    selectedCompetency = c;
                    refreshSidebar();
                    editSidebar();
                    $("#sidebarNameInput").focus();
                    $("#sidebarNameInput").select();
                    afterSave();
                }, error);
            }, error);
        } else {
            if (framework["skos:hasTopConcept"] == null)
                framework["skos:hasTopConcept"] = [];
            EcArray.setAdd(framework["skos:hasTopConcept"], c.shortId());
            c["skos:topConceptOf"] = framework.shortId();
            repo.saveTo(c, function () {
                repo.saveTo(framework, function () {
                    selectedCompetency = c;
                    refreshSidebar();
                    editSidebar();
                    $("#sidebarNameInput").focus();
                    $("#sidebarNameInput").select();
                    afterSave();
                }, error);
            }, error);
        }
    }
}

createConceptScheme = function () {
    if (viewMode) return;
    var csTitle;
    if ($("#name").val() == null || $("#name").val().trim() == "")
        csTitle = "New Concept Scheme";
    else
        csTitle = $("#name").val().trim();
    framework = new EcConceptScheme();
    if (newObjectEndpoint != null)
        framework.generateShortId(newObjectEndpoint == null ? repo.selectedServer : newObjectEndpoint);
    else
        framework.generateId(newObjectEndpoint == null ? repo.selectedServer : newObjectEndpoint);
    if (EcIdentityManager.ids.length > 0)
        framework.addOwner(EcIdentityManager.ids[0].ppk.toPk());
    framework["dcterms:title"] = csTitle;
    if ($("#description").val() != null && $("#description").val() != "")
        framework["dcterms:description"] = $("#description").val();
    loading("Creating concept scheme...");
    repo.saveTo(framework, function () {
        refreshSidebar();
        editSidebar();
        populateFramework();
        highlightSelected($('#frameworkNameContainer'));
        createFrameworkDelay = setInterval(function() {
            if ($('#sidebarNameInput').is(':visible')) {
                $('#sidebarNameInput').focus();
                $('#sidebarNameInput').select();
                clearInterval(createFrameworkDelay);
            }
        }, 1000);
    }, error);
}

unlinkConcept = function (c) {
    if (viewMode) return;
    if (c == null)
        c = selectedCompetency;
    if (c["skos:broader"] != null)
        for (var i = 0; i < c["skos:broader"].length; i++)
            EcConcept.get(c["skos:broader"][i], function (concept) {
                EcArray.setRemove(concept["skos:narrower"], c.shortId());
                repo.saveTo(concept, afterSave, console.error);
            }, console.error);
    delete c["skos:broader"];
    if (framework["skos:hasTopConcept"] == null)
        framework["skos:hasTopConcept"] = [];
    EcArray.setAdd(framework["skos:hasTopConcept"], c.shortId());
    c["skos:topConceptOf"] = framework.shortId();
    repo.saveTo(c, function () {
        repo.saveTo(framework, afterSave, console.log);
    }, console.log);
    refreshSidebar();
}

deleteConcept = function (c) {
    if (viewMode) return;
    if (c == null) c = selectedCompetency;
    if (c == null) {
        showConfirmDialog(function (confirmed) {
            if (confirmed === true) {
                repo.deleteRegistered(framework, function (success) {
                    if (defaultPage == "#frameworksSection")
                        searchFrameworks(createParamObj(5000));
                    else
                        showPage(defaultPage);
                    EcConcept.search(repo, "skos%5C:inScheme:\"" + framework.shortId() + "\"", function (concepts) {
                        for (var i = 0; i < concepts.length; i++)
                            repo.deleteRegistered(concepts[i], console.log, console.error);
                    }, console.error);
                    framework = null;
                    selectedCompetency = null;
                }, console.log);
            }
            hideConfirmDialog();
        }, "Are you sure you want to delete this concept scheme? This will also delete all concepts referenced in this scheme.", "Cancel", "Confirm");
    } else {
        showConfirmDialog(function (confirmed) {
            if (confirmed === true) {
                deleteConceptInner(c);

                selectedRelation = null;
                selectedCompetency = null;
                refreshSidebar();
            }
            hideConfirmDialog();
        }, "Are you sure you want to delete this concept?", "Cancel", "Confirm", "delete", selectedCompetency.shortId());
    }
}

deleteConceptInner = function (c) {
    if (c["skos:broader"] != null)
        for (var i = 0; i < c["skos:broader"].length; i++)
            EcConcept.get(c["skos:broader"][i], function (concept) {
                EcArray.setRemove(concept["skos:narrower"], c.shortId());
                repo.saveTo(concept, afterSave, console.error);
            }, console.error);
    if (c["skos:narrower"] != null)
        for (var i = 0; i < c["skos:narrower"].length; i++)
            EcConcept.get(c["skos:narrower"][i], function (concept) {
                deleteConceptInner(concept);
            }, console.error);
    if (c["skos:topConceptOf"] != null) {
        EcArray.setRemove(framework["skos:hasTopConcept"], c.shortId());
        repo.saveTo(framework, afterSave, console.error);
    }
    repo.deleteRegistered(c, afterSave, console.error);
}

dragConceptShortcut = function (element, isCopy) {
    if (viewMode) return;
    dragShortcutData = {
        competencyId: $(element).attr('id'),
        isCopy: isCopy
    };
}

dropConceptShortcut = function (element) {
    var me = $(this);
    if (viewMode) return;
    if (dragShortcutData != null) {
        var targetData = {};
        var tgt = $(element);
        while (targetData.competencyId == null) {
            targetData.competencyId = tgt.attr('id');
            tgt = tgt.parent();
        }
        //Cut and paste
        if (dragShortcutData.competencyId == targetData.competencyId) return;
        EcConcept.get(dragShortcutData.competencyId, function (c) {
            if (!dragShortcutData.isCopy) {
                if (c["skos:broader"] != null) {
                    for (var i = 0; i < c["skos:broader"].length; i++)
                        EcConcept.get(c["skos:broader"][i], function (concept) {
                            EcArray.setRemove(concept["skos:narrower"], c.shortId());
                            repo.saveTo(concept, afterSave, console.error);
                        }, console.error);
                    delete c["skos:broader"];
                }
                delete c["skos:topConceptOf"];
                if (EcArray.has(framework["skos:hasTopConcept"], c.shortId())) {
                    EcArray.setRemove(framework["skos:hasTopConcept"], c.shortId());
                    repo.saveTo(framework, afterSave, console.error);
                }
            }
            dropAnyConcept(dragShortcutData, targetData);
            dragShortcutData = null;
        }, console.error);
    }
}

dragConcept = function (ev) {
    if (viewMode) return;
    ev.dataTransfer.setData("text", JSON.stringify({
        competencyId: $(ev.target).attr("id")
    }));
}

dropAnyConcept = function (data, targetData) {
    var thing;
    if (data.competency != null)
        thing = data.competency;
    else
        thing = EcRepository.getBlocking(data.competencyId);
    if (data.competencyId == targetData.competencyId)
        return;

    //If data is a parent of targetData, we need to unlink targetData.
    //This is better rewritten than understood, unless you're Fritz or Mile.
    var targetNodes = $("[id=\"" + targetData.competencyId + "\"]");
    if (targetNodes.parents("[id=\"" + data.competencyId + "\"]").length > 0) {
        //OK I found some possible loops. Go find me the actual loops and nuke some connections to make what I commanded possible.
        targetNodes.parents("[id=\"" + data.competencyId + "\"]").find("[id=\"" + targetData.competencyId + "\"]").each(function () {
            detangleConcepts($(this), data, targetData);
        });
        return;
    }

    var targetThing = EcRepository.getBlocking(targetData.competencyId);
    if (targetThing.isAny(new EcConceptScheme().getTypes())) {
        thing["skos:topConceptOf"] = targetThing.shortId();
        if (targetThing["skos:hasTopConcept"] == null)
            targetThing["skos:hasTopConcept"] = [];
        EcArray.setAdd(targetThing["skos:hasTopConcept"], thing.shortId());
    } else if (targetThing.isAny(new EcConcept().getTypes())) {
        if (targetThing["skos:narrower"] == null)
            targetThing["skos:narrower"] = [];
        EcArray.setAdd(targetThing["skos:narrower"], thing.shortId());
        if (thing["skos:broader"] == null)
            thing["skos:broader"] = [];
        EcArray.setAdd(thing["skos:broader"], targetThing.shortId());
        delete thing["skos:topConceptOf"];
        EcArray.setRemove(framework["skos:hasTopConcept"], thing.shortId());
    }
    // replaced selected concept with changed concept
    selectedCompetency = thing;
    refreshSidebar();
    repo.saveTo(thing, function () {
        repo.saveTo(targetThing, afterSave, console.error);
    }, console.error);

}

detangleConcepts = function (me, data, targetData) {

    var part3 = function () {
        repo.saveTo(c, function () {
            dropAnyConcept(data, targetData);
        }, console.error); //Saving main competency.
    }

    var part2 = function () {
        var foundAgain = false;
        EcArray.setRemove(c["skos:broader"], me.parent().parent().attr("id"));
        if (c["skos:broader"] == null || c["skos:broader"].length == 0) {
            EcArray.setAdd(framework["skos:hasTopConcept"], c.shortId());
            c["skos:topConceptOf"] = framework.shortId();
            repo.saveTo(c, function () {
                repo.saveTo(framework, part3, console.error); //Saving framework again.
            }, console.error);
            foundAgain = true;
        }
        if (!foundAgain)
            part3();
    }

    var found = false;
    var c = EcConcept.getBlocking(me.attr("id"));
    if (c["skos:broader"] != null) {
        for (var i = 0; i < c["skos:broader"].length; i++)
            if (c["skos:broader"][i] == me.parent().parent().attr("id")) {
                var concept = EcConcept.getBlocking(c["skos:broader"][i]);
                EcArray.setRemove(concept["skos:narrower"], c.shortId());
                repo.saveTo(concept, part2, console.error); //Saving parent concept again.
                found = true;
            }
    }
    if (!found)
        part2();

}

dropConcept = function (ev) {
    if (viewMode) return;
    ev.stopPropagation();
    var data = ev.dataTransfer.getData("text");
    if (data != null)
        data = JSON.parse(data);
    else
        return;
    ev.dataTransfer.clearData("text");

    var targetData = {};
    var tgt = $(ev.target);
    while (targetData.competencyId == null) {
        targetData.competencyId = tgt.attr("id");
        tgt = tgt.parent();
    }
    if (data.competencyId == targetData.competencyId) return;
    EcConcept.get(data.competencyId, function (c) {
        if (!ev.shiftKey) {
            var stage2 = function () {
                var found = false;
                delete c["skos:topConceptOf"];
                data.competency = c;
                if (EcArray.has(framework["skos:hasTopConcept"], c.shortId())) {
                    EcArray.setRemove(framework["skos:hasTopConcept"], c.shortId());
                    repo.saveTo(framework, function () {
                        dropAnyConcept(data, targetData);
                    }, console.error); //Saving framework.
                    found = true;
                }
                if (!found)
                    dropAnyConcept(data, targetData);
            }
            var found = false;
            if (c["skos:broader"] != null) {
                var narrows = c["skos:broader"];
                delete c["skos:broader"];
                for (var i = 0; i < narrows.length; i++)
                    EcConcept.get(narrows[i], function (concept) {
                        EcArray.setRemove(concept["skos:narrower"], c.shortId());
                        repo.saveTo(concept, stage2, console.error); //Saving previous parent.
                        found = true;
                    }, console.error);
            }
            if (!found)
                stage2();
        }
    });
}

allowConceptDrop = function (ev) {
    if (viewMode) return;
    ev.preventDefault();
}

//Touchscreen drag and drop
handleTouchStartConcept = function (event) {
    event.stopPropagation();
    $(event.srcElement).click();
    setGlobalTouchDragDataConcept(event.srcElement);
}

handleTouchMoveConcept = function (event) {
    event.stopPropagation();
    $('.competency').addClass('dashBorder');
    var x = event.touches[0].clientX;
    var y = event.touches[0].clientY;
    var hoverElem = document.elementFromPoint(x, y);
    if (hoverElem.classList.contains('competencyName') || hoverElem.classList.contains('competencyDescription') || hoverElem.classList.contains('competencyCodedNotation'))
        hoverElem = hoverElem.parentNode.parentNode;
    if (hoverElem.classList.contains('competency') || hoverElem.id == "frameworkNameContainer") {
        $('.selected').removeClass('selected');
        hoverElem.classList.add('selected');
        globalTouchDragDestinationConcept = hoverElem.id;
    }
}

handleTouchEndConcept = function (event) {
    event.stopPropagation();
    if (globalTouchDragDestinationConcept != null && globalTouchDragDataConcept != null) {
        //Unlink competency
        if (globalTouchDragDestinationConcept == "frameworkNameContainer") {
            unlinkCompetency();
        } else {
            var targetElem = $(document.getElementById(globalTouchDragDestinationConcept));
            var targetCompetencyId = targetElem.attr('id');
            var targetRelationId = targetElem.attr('relationId');
            var targetData = {
                competencyId: targetCompetencyId,
                relationId: targetRelationId
            };

            if (globalTouchDragDataConcept.competencyId != targetData.competencyId)  {
                EcConcept.get(globalTouchDragDataConcept.competencyId, function (c) {
                    if (!ev.shiftKey) {
                        var stage2 = function () {
                            var found = false;
                            delete c["skos:topConceptOf"];
                            globalTouchDragDataConcept.competency = c;
                            if (EcArray.has(framework["skos:hasTopConcept"], c.shortId())) {
                                EcArray.setRemove(framework["skos:hasTopConcept"], c.shortId());
                                repo.saveTo(framework, function () {
                                    dropAnyConcept(globalTouchDragDataConcept, targetData);
                                }, console.error); //Saving framework.
                                found = true;
                            }
                            if (!found)
                                dropAnyConcept(globalTouchDragDataConcept, targetData);
                        }
                        var found = false;
                        if (c["skos:broader"] != null) {
                            var narrows = c["skos:broader"];
                            delete c["skos:broader"];
                            for (var i = 0; i < narrows.length; i++)
                                EcConcept.get(narrows[i], function (concept) {
                                    EcArray.setRemove(concept["skos:narrower"], c.shortId());
                                    repo.saveTo(concept, stage2, console.error); //Saving previous parent.
                                    found = true;
                                }, console.error);
                        }
                        if (!found)
                            stage2();
                    }
                });
                dropAnyConcept(globalTouchDragDataConcept, targetData);
            }
        }
    }
    $('.competency').removeClass('dashBorder');
    globalTouchDragDataConcept = null;
    globalTouchDragDestinationConcept = null;
}

//Recursively get the li element we want for touchdrag
setGlobalTouchDragDataConcept = function (obj) {
    if (obj.localName === "li") {
        //Super hacky, needs a more robust solution (attribute length may change and this would break)
        var competencyId = obj.attributes[8].value;
        var relationId = Object.keys(obj.attributes).length > 9 ? obj.attributes[9].value : null;

        globalTouchDragDataConcept = {
            competencyId: competencyId,
            relationId: relationId
        };
    } else {
        setGlobalTouchDragDataConcept(obj.parentNode);
    }
}
