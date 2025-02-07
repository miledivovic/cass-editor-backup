/*
 Copyright 2017 Credential Engine and other contributing parties.

 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

if (queryParams.select != null) {
	$("#selectButton").show().text(queryParams.select);
	$("#selectAllButton").show();
	if (queryParams.select == "" || queryParams.select == "select")
		$('#selectButton').hide();
}

if (queryParams.singleSelect != null) {
	$("#selectButton").show().text(queryParams.singleSelect);
	if (queryParams.select == "" || queryParams.select == "select")
		$('#selectButton').hide();
}

var framework = null;
var selectedCompetency = null;
var selectedRelation = null;
//For keyboard controls
var frameworkSelectionIndex = null;
var competencySelectionIndex = null;
//For detecting changes during editing
var changedFields = {};
var ulLengths = {};
//For touch drag
var globalTouchDragDestination = null;
var globalTouchDragData = null;
//Async tracker
var runningAsyncFunctions = {};
//Alignment cache
var alignmentCache = {};
//Sidebar Input autocomplete cache
var sidebarAutocompleteCache = {};

function select() {
	var ary = [];
	if ($("input:checkbox").length == 0)
		if (selectedCompetency != null)
			ary.push(selectedCompetency.shortId());


	$("input:checked").parent().each(function (f) {
		if (queryParams.selectVerbose == "true") {
			ary.push(JSON.parse(EcCompetency.getBlocking($(this).attr("id")).toJson()));
		} else {
			ary.push($(this).attr("id"));
		}
		var rId = $(this).attr("relationId");
		if (rId != null && rId !== undefined && rId != "")
			if (queryParams.selectRelations == "true") {
				if (queryParams.selectVerbose == "true") {
					ary.push(JSON.parse(EcAlignment.getBlocking(rId).toJson()));
				} else {
					ary.push(rId);
				}
			}
	});

	var message = {
		message: "selected",
		selected: ary,
		type: conceptMode ? 'Concept' : 'Competency',
		selectedFramework: framework
	};
	console.log(message);
	parent.postMessage(message, queryParams.origin);
}

function handleSelectAll(status) {
	if (status === 'select') {
		selectAll();
		$('#selectAllButton').attr('status', 'deselect');
	} else {
		deselectAll();
		$('#selectAllButton').attr('status', 'select');
	}
}

function deselectAll() {
	$('#tree').find('input').each(function () {
		$(this).prop('checked', false);
	});
}

function selectAll() {
	$('#tree').find('input').each(function () {
		$(this).prop('checked', true);
	});
}

var treeTop = 0;
populateFramework = function (subsearch) {
	if (conceptMode)
		return populateConceptScheme(subsearch);
	var me = this;
	treeTop = $("#tree").scrollTop();
	$("#tree").hide().html("");
	me.fetches = 0;
	var frameworkName = framework.getName();
	frameworkName = EcArray.isArray(frameworkName) ? frameworkName : [frameworkName];
	$("#editFrameworkSection #frameworkAKA").children().remove();
	$("#editFrameworkSection #frameworkName").text(frameworkName[0]);
	for (var i = 1; i < frameworkName.length; i++) {
		$("#editFrameworkSection #frameworkAKA").append($('<span>AKA: ' + frameworkName[i] + '</span>'));
	}
	if (framework.competency != null)
		$("#editFrameworkSection #frameworkCount").text(framework.competency.length + " items");

	var frameworkDescription = framework.getDescription();
	frameworkDescription = EcArray.isArray(frameworkDescription) ? frameworkDescription : [frameworkDescription];
	$("#editFrameworkSection #frameworkDescription").children().remove();
	for (var i in frameworkDescription) {
		if (frameworkDescription[i] != null && frameworkDescription[i] != 'NULL' && frameworkDescription[i] != '')
			$("#editFrameworkSection #frameworkDescription").append($('<span>' + frameworkDescription[i] + '</span>'));
	}
	try {
		if (framework.getTimestamp() == null || isNaN(framework.getTimestamp()))
			if (framework["schema:dateModified"] != null && framework["schema:dateModified"] !== undefined)
				$("#editFrameworkSection #frameworkLastModified").text("Last modified " + moment(new Date(framework["schema:dateModified"])).fromNow() + ".").show();
			else
				$("#editFrameworkSection #frameworkLastModified").hide();
		else
			$("#editFrameworkSection #frameworkLastModified").text("Last modified " + moment(new Date(framework.getTimestamp())).fromNow() + ".").show();
	} catch (e) {}
	try {
		if (framework["schema:dateCreated"] != null && framework["schema:dateCreated"] !== undefined)
			$("#editFrameworkSection #frameworkCreated").text("Created " + moment(new Date(framework["schema:dateCreated"])).fromNow() + ".").show();
		else
			$("#editFrameworkSection #frameworkCreated").hide();
	} catch (e) {}
	if (framework["ceasn:publisherName"] != null && framework["ceasn:publisherName"] !== undefined)
		if (queryParams.link == "true")
			$("#editFrameworkSection #frameworkLink").attr("href", framework.shortId()).show();

	if ($("#collapseAllCompetencies").css("display") != 'none') {
		$("#collapseAllCompetencies").css("display", "none");
		$("#expandAllCompetencies").css("display", "none");
	}

	if (framework.competency == null)
		framework.competency = [];
	if (framework.relation == null)
		framework.relation = [];
	if (framework.level == null)
		framework.level = [];
	var fun = function (success) {
		if (framework.competency.length == 0) {
			if ($("#tree").html() == "")
				$("#tree").html("<br><br><center><h3>This framework is empty.</h3></center>");
			showPage("#editFrameworkSection", framework);
		} else {
			new EcAsyncHelper().each(framework.competency, function (competencyId, done) {
				EcCompetency.get(competencyId, function (c) {
					refreshCompetency(c, null, subsearch, done);
				}, done);
			}, function (competencyIds) {
				new EcAsyncHelper().each(framework.level, function (levelId, done) {
					EcLevel.get(levelId, function (c) {
						refreshCompetency(c, null, subsearch, done);
					}, done);
				}, function (levelIds) {
					refreshRelations(subsearch);
				});
			});
		}
	};
	repo.precache(framework.competency.concat(framework.relation), fun, fun);
}

function afterRefresh(level, subsearch) {
	if (conceptMode)
		return afterConceptRefresh(level, subsearch);
	showPage("#editFrameworkSection", framework);
	$("#tree").show().scrollTop(treeTop);
	if (selectedCompetency != null && selectedCompetency !== undefined) {
		highlightSelected($("[id=\"" + selectedCompetency.shortId() + "\"]"));
		if ($(".selected").length > 0)
			$(".selected").parent().scrollTop($(".selected").parent().scrollTop() + $(".selected").position().top - 100);
	}
	var sort = function () {
		$(this).children().sort(function (a, b) {
			var ax = framework.competency.indexOf(a.getAttribute('id'));
			var bx = framework.competency.indexOf(b.getAttribute('id'));
			return ax - bx;
		}).detach().appendTo($(this));
	};
	$("#tree").each(sort).find("ul").each(sort);
	highlightCompetencies();
	collapseCompetencies();
	resizeEditFrameworkSection();
}

function refreshCompetency(col, level, subsearch, done) {
	if (conceptMode) {
		var ret = refreshConcept(col, level, subsearch);
		done();
		return ret;
	}
	var treeNode = null;
	if ($("#tree [id='" + col.shortId() + "']").length > 0) {
		//console.log("refreshCompetency - remove existing in tree "+col.shortId());
		treeNode = $("[id='" + col.shortId() + "']");
		treeNode.remove();
	}
	if (col.shortId() == queryParams.competencyId) {
		selectedCompetency = col;
		queryParams.competencyId = null;
		renderSidebar();
	}
	var draggable;
	if (!viewMode && framework.canEditAny(EcIdentityManager.getMyPks()))
		draggable = 'true';
	else
		draggable = 'false';

	if ($("#tree>.competency[id=\"" + col.shortId() + "\"]").length > 0) {
		console.log("WARNING: within tree hierarchy already exists " + col.shortId());
	}
	treeNode = $("#tree").append("<li class = 'competency' draggable='" + draggable + "' ondragstart='dragCompetency(event);' ontouchstart='handleTouchStart(event)' ontouchmove='handleTouchMove(event);' ontouchend='handleTouchEnd(event);' ondrop='dropCompetency(event);' ondragover='allowCompetencyDrop(event);'><span></span><ul></ul></li>").children().last();
	treeNode.attr("id", col.shortId());
	var competencyDescription = col.description;
	competencyDescription = EcArray.isArray(competencyDescription) ? competencyDescription : [competencyDescription];
	for (var i = competencyDescription.length - 1; i >= 0; i--) {
		if (competencyDescription[i] != null && competencyDescription[i] != "NULL" && competencyDescription[i] != col.name)
			treeNode.children().first().prepend("<small/>").children().first().addClass("competencyDescription").css('display', 'block').text(competencyDescription[i]);
	}
	var competencyName = col.getName();
	competencyName = EcArray.isArray(competencyName) ? competencyName : [competencyName];
	treeNode.children().first().prepend("<span/>").children().first().addClass("competencyName").text(competencyName[0]);
	for (var i = competencyName.length - 1; i > 0; i--) {
		treeNode.children().first().find('.competencyName').after($('<span class="competencyAKA">AKA: ' + competencyName[i] + '</span>'));
	}
	if (queryParams.ceasnDataFields == 'true' || queryParams.tlaProfile == 'true') {
		if (col["ceasn:codedNotation"] != null)
			treeNode.children().first().prepend("<span/>").children().first().addClass("competencyCodedNotation").text(col["ceasn:codedNotation"]);
		if (col["ceasn:listID"] != null)
			treeNode.children().first().prepend("<span/>").children().first().addClass("competencyListID").text(col["ceasn:listID"]);
		if (col["dcterms:type"] != null)
			treeNode.children().first().prepend("<span/>").children().first().addClass("competencyType").text(col["dcterms:type"]);
	}
	treeNode.prepend("<span/>").children().first().addClass("collapse").css("visibility", "hidden").html('<i class="fa fa-minus-square" aria-hidden="true"></i> ');
	if (col.competency != null) {
		level = true;
		$(".competency[id=\"" + col.competency + "\"]").children().last().append($(".competency[id=\"" + col.shortId() + "\"]"));
		treeNode.children().first().append(" <small>(Performance Level)</small>");
		if (!$(".competency[id=\"" + col.competency + "\"]").hasClass("expandable")) {
			$(".competency[id=\"" + col.competency + "\"]").addClass("expandable").children(".collapse").css("visibility", "visible");
			if ($("#collapseAllCompetencies").css("display") === 'none') {
				$("#collapseAllCompetencies").css("display", "");
				$("#expandAllCompetencies").css("display", "");
			}
		}
	}
	if (queryParams.link == "true")
		treeNode.prepend(" <a class='link' title='Click to navigate to link address. Right click to copy link address.' style='float:right;' target='_blank'><i class='fa fa-link' aria-hidden='true'></a>").children().first().attr("href", col.shortId());
	if (queryParams.select != null)
		treeNode.prepend("<input type='checkbox' tabIndex='-1'>");
	if (subsearch != null)
		treeNode.mark(subsearch);
	if (done != null && done !== undefined)
		done();
}
refreshRelations = function (subsearch) {
	if (framework.relation != undefined && framework.relation.length > 0) {
		var targetSourceArray = {};
		new EcAsyncHelper().each(framework.relation, function (relationId, done) {
			EcAlignment.get(relationId, function (relation) {
				if (relation.source !== undefined && relation.target !== undefined && relation.source != null && relation.target != null && relation.source != relation.target) {
					if (relation.relationType == "narrows") {
						var source = EcCompetency.getBlocking(relation.source);
						var target = EcCompetency.getBlocking(relation.target);
						if (source != null && target != null)
							if ($(".competency[relationid=\"" + relation.shortId() + "\"]").length == 0) {
								$(".competency[id=\"" + target.shortId() + "\"]").children().last().append($(".competency[id=\"" + source.shortId() + "\"]").outerHTML()).children().last().attr("relationid", relation.shortId());
								if ($(".competency[id=\"" + target.shortId() + "\"]").length > 0 &&
									$("#tree>.competency[id=\"" + source.shortId() + "\"]").length > 0) {
									let isRemoveSource = true;
									if (targetSourceArray[source.shortId()] && target.shortId() === targetSourceArray[source.shortId()]) {
										console.log("Removing " + source.name + " will be reverse of previous removal.");
										isRemoveSource = false;
									}
									if (isRemoveSource) {
										targetSourceArray[target.shortId()] = source.shortId();
										//console.log("Target '" + target.name + "' exists, remove source '" + source.name + "'");
										$("#tree>.competency[id=\"" + source.shortId() + "\"]").remove();
									}
								}
								if ($(".competency[id=\"" + source.shortId() + "\"]").length &&
									!$(".competency[id=\"" + target.shortId() + "\"]").hasClass("expandable")) {
									$(".competency[id=\"" + target.shortId() + "\"]").addClass("expandable").children(".collapse").css("visibility", "visible");
									if ($("#collapseAllCompetencies").css("display") === 'none') {
										$("#collapseAllCompetencies").css("display", "");
										$("#expandAllCompetencies").css("display", "");
									}
								}
							}
					}
				}
				done();
			}, done);
		}, function (relations) {
			if ($("#tree").html() == "" && framework.competency.length == 0)
				$("#tree").html("<br><br><center><h3>This framework is empty.</h3></center>");
			afterRefresh(false, subsearch);
		});
	} else {
		if ($("#tree").html() == "")
			$("#tree").html("<br><br><center><h3>This framework is empty.</h3></center>");
		afterRefresh(false, subsearch);
	}
}

renderSidebar = function (justLists) {
	if ($(".changedField:visible").length > 0) {
		if (!confirm("Some data has changed during edit. Do you want to discard changes?"))
			return;
	}

	var thing = framework;
	if (selectedCompetency != null) {
		thing = selectedCompetency;
	}

	var labelChoice = null;
	var fieldChoice = null;
	var inputChoice = null;
	var safeChoice = null;

	if (thing == selectedCompetency) {
		labelChoice = "cassCompetency";
		fieldChoice = "cassCompetency";
		inputChoice = "cassCompetency";
		safeChoice = "cassCompetency";
		initTooltips('cassCompetency');
	} else {
		labelChoice = "cassFramework";
		fieldChoice = "cassFramework";
		inputChoice = "cassFramework";
		safeChoice = "cassFramework";
		initTooltips('cassFramework');
	}
	if (queryParams.ceasnDataFields == 'true') {
		if (thing == selectedCompetency) {
			labelChoice = "ceasnCompetency";
			initTooltips('ceasnCompetency');
		} else {
			labelChoice = "ceasnFramework";
			initTooltips('ceasnFramework');
		}
	}
	if (conceptMode) {
		if (thing == selectedCompetency) {
			labelChoice = "skosCompetency";
			fieldChoice = "skosCompetency";
			inputChoice = "skosCompetency";
			initTooltips('skosCompetency');
		} else {
			labelChoice = "skosFramework";
			fieldChoice = "skosFramework";
			inputChoice = "skosFramework";
			initTooltips('skosFramework');
		}
	}

	//Display cassCompetency only fields
	if (!conceptMode && thing == selectedCompetency && queryParams.ceasnDataFields !== 'true') {
		$('.cassCompetency').show();
	} else {
		$('.cassCompetency').hide();
	}

	//Set the URL field
	$('#sidebarURL').text(thing.shortId());
	$('#sidebarURL').attr('href', thing.shortId());
	//Set the CTID field
	$('#sidebarCTID').text(thing.getGuid());
	$('#sidebarCTID').attr('href', thing.getGuid());

	if (justLists != true)
		$("#detailSlider label").each(function () {
			var label = $(this).attr(labelChoice);
			if (label != null)
				$(this).html("<i class='fa fa-info-circle'></i>" + ' ' + label);
			else
				$(this).html("<i class='fa fa-info-circle'></i>" + ' ' + $(this).text());
		});
	if (justLists != true)
		$("#detailSlider p,h3").each(function () {
			if (!$(this).next().is("input,textarea"))
				return;
			$(this).html("");
			$(this).prev("label").addClass("viewMode");
			var val = thing[$(this).next().attr(fieldChoice)];
			if (val === undefined || val == null || val == "") {
				$(this).prev("label").removeClass("viewMode");
				return;
			}
			if (EcArray.isArray(val))
				val = JSON.parse(JSON.stringify(val));
			if (!EcArray.isArray(val))
				val = [val];
			for (var i = 0; i < val.length; i++) {
				if (val[i].toLowerCase().indexOf("http") != -1) {
					var linkText = val[i];
					var elem = $(this);
					elem.append("<div class='sidebarPropertyLink'><a target='_blank'/></div>").children().last().children().last().attr("href", val[i]).text(linkText);
					var anchor = elem.children().last().children().last();
					elem.children().last().prepend("<div><button title='Copy URL to the clipboard.' onclick='copyToClipboard(event);'><i class='fa fa-clipboard'></i></button></div>");
					resolveNameFromUrlWithElem(val[i], anchor, function (result, elem) {
						if (result != null) {
							elem.text(result);
						}
					});
				} else {
					$(this).append("<span/>").children().last().text(val[i]);
				}
			}
		});
	$("#detailSlider ul").each(function () {
		var u = $(this).prev().attr(fieldChoice);
		var val = thing[u];
		if ($(this).attr(safeChoice) != null && ($(this).attr(labelChoice) == null || $(this).attr(labelChoice) === undefined)) {
			$(this).prev().prev("label").hide();
			$(this).prev().hide();
			$(this).hide();
			return;
		} else {
			$(this).prev().prev("label").css("display", "");
			$(this).prev().css("display", "");
			$(this).css("display", "");
		}
		$(this).html("");
		$(this).prev("label").addClass("viewMode");
		$(this).prev().prev("label").addClass("viewMode");
		if (val === undefined || val == null || val == "") {
			if ($(this).parents("#alignmentPanel").length == 0 && $('#detailSlider').hasClass('detailSliderView')) {
				$(this).prev("label").removeClass("viewMode");
				$(this).prev().prev("label").removeClass("viewMode");
				$(this).hide();
			}
		} else {
			if (!EcArray.isArray(val)) val = [val];
			for (var i = 0; i < val.length; i++) {
				var li = $(this).append("<li/>").children().last();
				var it = EcRepository.getBlocking(val[i]);
				var name;
				if (it == null)
					name = val[i];
				else if (it.name != null)
					name = it.name;
				else if (it["ceasn:competencyText"] != null)
					name = it["ceasn:competencyText"];
				else if (it["skos:prefLabel"] != null)
					name = it["skos:prefLabel"];
				li.attr("id", val[i]).attr("title", val[i]).text(name);
				if (!viewMode) {
					var x = li.prepend("<a class='editMode' tabindex='0' style='float:right; cursor:pointer;'><i class='fa fa-times'></i></a>").children().first();
					(function (thing, u, id, li) {
						x.click(function () {
							EcArray.setRemove(thing[u], id);
							if (thing[u].length == 0)
								delete thing[u];
							li.remove();
						})
					})(thing, u, val[i], li);
				}
			}
		}
	});
	// Display Concept's broader or narrower connections
	if (conceptMode && selectedCompetency != null) {
		var renderConceptConnection = function (cId, displayConcept, relationType) {
			var connectionsList = $(".relationList[" + labelChoice + "=" + relationType + "]").append("<li/>").children().last();
			if (displayConcept == null) {
				connectionsList.text(cId);
			} else {
				if (displayConcept["skos:prefLabel"] != null)
					connectionsList.text(displayConcept["skos:prefLabel"]);
				else
					connectionsList.text(displayConcept);
			}
			connectionsList.attr("id", cId);
			$(".relationList[" + labelChoice + "=" + relationType + "]").show().prev().show();
		} //function renderConceptConnection
		if (selectedCompetency["skos:broader"] != null) {
			for (var bc = 0; bc < selectedCompetency["skos:broader"].length; bc++) {
				(function (conceptId, renderConceptConnection) {
					if (alignmentCache[framework.shortId()] != null && alignmentCache[framework.shortId()][conceptId] != null && alignmentCache[framework.shortId()][conceptId].target != null && alignmentCache[framework.shortId()][conceptId].target.shortId() > -1) {
						renderConceptConnection(conceptId, alignmentCache[framework.shortId()][conceptId].target, "hasChild");
					} else {
						if (runningAsyncFunctions[conceptId] == null) {
							runningAsyncFunctions[conceptId] = 1;
							EcConcept.get(conceptId, function (broaderConcept) {
								if (broaderConcept != null)
									renderConceptConnection(conceptId, broaderConcept, "hasChild");
								delete runningAsyncFunctions[conceptId];
								if (alignmentCache[framework.shortId()] == null)
									alignmentCache[framework.shortId()] = {};
								if (alignmentCache[framework.shortId()][conceptId] == null)
									alignmentCache[framework.shortId()][conceptId] = {};
								alignmentCache[framework.shortId()][conceptId].target = broaderConcept;
							}, function () {
								renderConceptConnection(conceptId, conceptId, "hasChild");
								delete runningAsyncFunctions[conceptId];
								if (alignmentCache[framework.shortId()] == null)
									alignmentCache[framework.shortId()] = {};
								if (alignmentCache[framework.shortId()][conceptId] == null)
									alignmentCache[framework.shortId()][conceptId] = {};
								alignmentCache[framework.shortId()][conceptId].target = conceptId;
							});
						}
					} //end if cached exists
				})(selectedCompetency["skos:broader"][bc], renderConceptConnection);
			} //end for each narrower
		} //end if broader
		if (selectedCompetency["skos:narrower"] != null) {
			for (var nc = 0; nc < selectedCompetency["skos:narrower"].length; nc++) {
				(function (conceptId, renderConceptConnection) {
					if (alignmentCache[framework.shortId()] != null && alignmentCache[framework.shortId()][conceptId] != null && alignmentCache[framework.shortId()][conceptId].source != null && alignmentCache[framework.shortId()][conceptId].source.shortId() > -1) {
						renderConceptConnection(conceptId, alignmentCache[framework.shortId()][conceptId].source, "isChildOf");
					} else {
						if (runningAsyncFunctions[conceptId] == null) {
							runningAsyncFunctions[conceptId] = 1;
							EcConcept.get(conceptId, function (narrowerConcept) {
								if (narrowerConcept != null)
									renderConceptConnection(conceptId, narrowerConcept, "isChildOf");
								delete runningAsyncFunctions[conceptId];
								if (alignmentCache[framework.shortId()] == null)
									alignmentCache[framework.shortId()] = {};
								if (alignmentCache[framework.shortId()][conceptId] == null)
									alignmentCache[framework.shortId()][conceptId] = {};
								alignmentCache[framework.shortId()][conceptId].source = narrowerConcept;
							}, function () {
								renderConceptConnection(conceptId, conceptId, "isChildOf");
								delete runningAsyncFunctions[conceptId];
								if (alignmentCache[framework.shortId()] == null)
									alignmentCache[framework.shortId()] = {};
								if (alignmentCache[framework.shortId()][conceptId] == null)
									alignmentCache[framework.shortId()][conceptId] = {};
								alignmentCache[framework.shortId()][conceptId].source = conceptId;
							});
						}
					} //end if cached exists
				})(selectedCompetency["skos:narrower"][nc], renderConceptConnection);
			} //end for each narrower
		} //end if narrower
	} //end if conceptMode & concept selected
	// Note: ConceptScheme, if framework, may or may not have relations.
	if (framework.relation != null && selectedCompetency != null) {
		$("#detailSlider .relationList").html("");
		if (viewMode) {
			$("#detailSlider .relationList:not(.exempt)").hide().prev().hide();
		}
		for (var i = 0; i < framework.relation.length; i++) {
			var a = EcAlignment.getBlocking(framework.relation[i]);
			if (a == null)
				continue;
			var renderAlignment = function (a, displayCompetency, relationType) {
				var li = $(".relationList[" + labelChoice + "=" + relationType + "]").append("<li/>").children().last();
				if (displayCompetency == null)
					li.text(a.target);
				else if (conceptMode) {
					if (displayCompetency["skos:prefLabel"] != null)
						li.text(displayCompetency["skos:prefLabel"]);
					else
						li.text(displayCompetency);
				} else {
					if (displayCompetency.getName)
						li.text(displayCompetency.getName());
					else
						li.text(displayCompetency);
				}
				li.attr("id", a.shortId());
				if (viewMode)
					$(".relationList[" + labelChoice + "=" + relationType + "]").show().prev().show();
				else {
					var x = li.prepend("<button class='viewMode frameworkEditControl' tabindex='0' style='float:right; cursor:pointer;'><i class='fa fa-times'></i></button>").children().first();
					x.click(function () {
						if (conceptMode) {
							let trimId = EcRemoteLinkedData.trimVersionFromUrl($(this).parent().attr("id"));
							for (let i = 0; i < framework.relation.length; i++)
								if (EcRemoteLinkedData.trimVersionFromUrl(framework.relation[i]).equals(trimId))
									framework.relation.splice(i, 1);
						} else {
							framework.removeRelation($(this).parent().attr("id"));
						}
						conditionalDelete($(this).parent().attr("id"));
						repo.saveTo(framework, afterSaveRender, error);
					});
				}
			};
			if (a.source == selectedCompetency.shortId()) {
				//Passing vars in closure so they are correct when the async function executes.
				(function (a, renderAlignment) {
					//Use the cached version if we already have it to be faster.
					if (alignmentCache[framework.shortId()] != null && alignmentCache[framework.shortId()][a.shortId()] != null && alignmentCache[framework.shortId()][a.shortId()].target != null) {
						if (a.relationType == Relation.NARROWS && alignmentCache[framework.shortId()][a.shortId()].target.shortId && framework.competency.indexOf(alignmentCache[framework.shortId()][a.shortId()].target.shortId()) > -1 && queryParams.ceasnDataFields == 'true')
							renderAlignment(a, alignmentCache[framework.shortId()][a.shortId()].target, "isChildOf");
						else
							renderAlignment(a, alignmentCache[framework.shortId()][a.shortId()].target, a.relationType);
					} else {
						if (runningAsyncFunctions[a.shortId()] == null) {
							runningAsyncFunctions[a.shortId()] = 1;
							if (conceptMode) {
								EcConcept.get(a.target, function (target) {
									if (target != null) {
										if (a.relationType == Relation.NARROWS && framework.competency.indexOf(target.shortId()) > -1 && queryParams.ceasnDataFields == 'true')
											renderAlignment(a, target, "isChildOf");
										else
											renderAlignment(a, target, a.relationType);
									}
									delete runningAsyncFunctions[a.shortId()];
									if (alignmentCache[framework.shortId()] == null)
										alignmentCache[framework.shortId()] = {};
									if (alignmentCache[framework.shortId()][a.shortId()] == null)
										alignmentCache[framework.shortId()][a.shortId()] = {};
									alignmentCache[framework.shortId()][a.shortId()].target = target;
								}, function () {
									renderAlignment(a, a.target, a.relationType);
									delete runningAsyncFunctions[a.shortId()];
									if (alignmentCache[framework.shortId()] == null)
										alignmentCache[framework.shortId()] = {};
									if (alignmentCache[framework.shortId()][a.shortId()] == null)
										alignmentCache[framework.shortId()][a.shortId()] = {};
									alignmentCache[framework.shortId()][a.shortId()].target = a.target;
								}); //EcConcept.get
							} else {
								EcCompetency.get(a.target, function (target) {
									if (target != null) {
										if (a.relationType == Relation.NARROWS && framework.competency.indexOf(target.shortId()) > -1 && queryParams.ceasnDataFields == 'true')
											renderAlignment(a, target, "isChildOf");
										else
											renderAlignment(a, target, a.relationType);
									}
									delete runningAsyncFunctions[a.shortId()];
									if (alignmentCache[framework.shortId()] == null)
										alignmentCache[framework.shortId()] = {};
									if (alignmentCache[framework.shortId()][a.shortId()] == null)
										alignmentCache[framework.shortId()][a.shortId()] = {};
									alignmentCache[framework.shortId()][a.shortId()].target = target;
								}, function () {
									renderAlignment(a, a.target, a.relationType);
									delete runningAsyncFunctions[a.shortId()];
									if (alignmentCache[framework.shortId()] == null)
										alignmentCache[framework.shortId()] = {};
									if (alignmentCache[framework.shortId()][a.shortId()] == null)
										alignmentCache[framework.shortId()][a.shortId()] = {};
									alignmentCache[framework.shortId()][a.shortId()].target = a.target;
								}); //EcCompetency.get
							}
						}
					}
				})(a, renderAlignment);
			}
			if (a.relationType == Relation.IS_EQUIVALENT_TO || a.relationType == Relation.IS_RELATED_TO || a.relationType == "majorRelated" || a.relationType == "minorRelated") {
				if (a.target == selectedCompetency.shortId()) {
					//Passing vars in closure so they are correct when the async function executes.
					(function (a, renderAlignment) {
						//Use the cached version if we already have it to be faster.
						if (alignmentCache[framework.shortId()] != null && alignmentCache[framework.shortId()][a.shortId()] != null && alignmentCache[framework.shortId()][a.shortId()].source != null) {
							renderAlignment(a, alignmentCache[framework.shortId()][a.shortId()].source, a.relationType);
						} else {
							if (runningAsyncFunctions[a.shortId()] == null) {
								runningAsyncFunctions[a.shortId()] = 1;
								if (conceptMode) {
									EcConcept.get(a.source, function (source) {
										if (source != null)
											renderAlignment(a, source, a.relationType);
										delete runningAsyncFunctions[a.shortId()];
										if (alignmentCache[framework.shortId()] == null)
											alignmentCache[framework.shortId()] = {};
										if (alignmentCache[framework.shortId()][a.shortId()] == null)
											alignmentCache[framework.shortId()][a.shortId()] = {};
										alignmentCache[framework.shortId()][a.shortId()].source = source;
									}, function () {
										renderAlignment(a, a.source, a.relationType);
										delete runningAsyncFunctions[a.shortId()];
										if (alignmentCache[framework.shortId()] == null)
											alignmentCache[framework.shortId()] = {};
										if (alignmentCache[framework.shortId()][a.shortId()] == null)
											alignmentCache[framework.shortId()][a.shortId()] = {};
										alignmentCache[framework.shortId()][a.shortId()].source = a.source;
									});
								} else {
									EcCompetency.get(a.source, function (source) {
										if (source != null)
											renderAlignment(a, source, a.relationType);
										delete runningAsyncFunctions[a.shortId()];
										if (alignmentCache[framework.shortId()] == null)
											alignmentCache[framework.shortId()] = {};
										if (alignmentCache[framework.shortId()][a.shortId()] == null)
											alignmentCache[framework.shortId()][a.shortId()] = {};
										alignmentCache[framework.shortId()][a.shortId()].source = source;
									}, function () {
										renderAlignment(a, a.source, a.relationType);
										delete runningAsyncFunctions[a.shortId()];
										if (alignmentCache[framework.shortId()] == null)
											alignmentCache[framework.shortId()] = {};
										if (alignmentCache[framework.shortId()][a.shortId()] == null)
											alignmentCache[framework.shortId()][a.shortId()] = {};
										alignmentCache[framework.shortId()][a.shortId()].source = a.source;
									});
								} //end if conceptMode
							}
						}
					})(a, renderAlignment);
				}
			} //end if EQUIVALENT or RELATED TO
			if (a.relationType == Relation.NARROWS) {
				if (a.target == selectedCompetency.shortId()) {
					//Passing vars in closure so they are correct when the async function executes.
					(function (a, renderAlignment) {
						//Use the cached version if we already have it to be faster.
						if (alignmentCache[framework.shortId()] != null && alignmentCache[framework.shortId()][a.shortId()] != null && alignmentCache[framework.shortId()][a.shortId()].source != null) {
							if (alignmentCache[framework.shortId()][a.shortId()].source.shortId && framework.competency.indexOf(alignmentCache[framework.shortId()][a.shortId()].source.shortId()) > -1 && queryParams.ceasnDataFields == 'true' && !conceptMode)
								renderAlignment(a, alignmentCache[framework.shortId()][a.shortId()].source, "hasChild");
							else
								renderAlignment(a, alignmentCache[framework.shortId()][a.shortId()].source, "broadens");
						} else {
							if (runningAsyncFunctions[a.shortId()] == null) {
								runningAsyncFunctions[a.shortId()] = 1;
								if (conceptMode) {
									EcConcept.get(a.source, function (source) {
										if (source != null)
											if (framework.competency.indexOf(source.shortId()) > -1)
												renderAlignment(a, source, "hasChild");
											else
												renderAlignment(a, source, "broadens");
										delete runningAsyncFunctions[a.shortId()];
										if (alignmentCache[framework.shortId()] == null)
											alignmentCache[framework.shortId()] = {};
										if (alignmentCache[framework.shortId()][a.shortId()] == null)
											alignmentCache[framework.shortId()][a.shortId()] = {};
										alignmentCache[framework.shortId()][a.shortId()].source = source;
									}, function () {
										renderAlignment(a, a.source, "broadens");
										delete runningAsyncFunctions[a.shortId()];
										if (alignmentCache[framework.shortId()] == null)
											alignmentCache[framework.shortId()] = {};
										if (alignmentCache[framework.shortId()][a.shortId()] == null)
											alignmentCache[framework.shortId()][a.shortId()] = {};
										alignmentCache[framework.shortId()][a.shortId()].source = a.source;
									});
								} else {
									EcCompetency.get(a.source, function (source) {
										if (source != null)
											if (framework.competency.indexOf(source.shortId()) > -1 && queryParams.ceasnDataFields == 'true')
												renderAlignment(a, source, "hasChild");
											else
												renderAlignment(a, source, "broadens");
										delete runningAsyncFunctions[a.shortId()];
										if (alignmentCache[framework.shortId()] == null)
											alignmentCache[framework.shortId()] = {};
										if (alignmentCache[framework.shortId()][a.shortId()] == null)
											alignmentCache[framework.shortId()][a.shortId()] = {};
										alignmentCache[framework.shortId()][a.shortId()].source = source;
									}, function () {
										renderAlignment(a, a.source, "broadens");
										delete runningAsyncFunctions[a.shortId()];
										if (alignmentCache[framework.shortId()] == null)
											alignmentCache[framework.shortId()] = {};
										if (alignmentCache[framework.shortId()][a.shortId()] == null)
											alignmentCache[framework.shortId()][a.shortId()] = {};
										alignmentCache[framework.shortId()][a.shortId()].source = a.source;
									});
								} //end if conceptMode
							}
						}
					})(a, renderAlignment);
				}
			}
		}
	}
	if (justLists != true)
		$("#detailSlider input:not([plural]),textarea:not([plural])").each(function () {
			if ($(this).attr(safeChoice) != null && ($(this).attr(labelChoice) == null || $(this).attr(labelChoice) === undefined)) {
				$(this).prev().prev().hide();
				$(this).prev().hide();
				$(this).hide();
				return;
			} else {
				$(this).prev().prev().css("display", "");
				$(this).prev().css("display", "");
				$(this).css("display", "");
			}
			$(this).prev("label").addClass("viewMode");
			var val = thing[$(this).attr(inputChoice)];
			if (val === undefined || val == null || val == "") {
				$(this).prev("label").removeClass("viewMode");
				if ($(this).attr("defaultToFramework") != null)
					val = framework[$(this).attr(inputChoice)];
			}
			if (EcArray.isArray(val))
				val = val.join(", ");
			if (val === undefined || val == null || val == "") {
				$(this).val(null);
			} else if ($(this).attr("type") == "datetime-local")
				$(this).val(new Date(val).toDatetimeLocal().substring(0, new Date(val).toDatetimeLocal().length - 3));
			else
				$(this).val(val);
		});

	if (justLists != true)
		$("#detailSlider").find('.sidebarInputGroup').each(function () {
			//Get the base input field first
			var baseField = $(this).prev();
			baseField.prev().prev().css("display", "");
			baseField.prev().css("display", "");
			baseField.css("display", "");
			baseField.prev("label").addClass("viewMode");

			//Clear additional input fields if the property isn't present
			if (thing[baseField.attr(inputChoice)] == null) {
				baseField.next().find('input,textarea').remove();
			}

			var val = EcArray.isArray(thing[baseField.attr(inputChoice)]) ? thing[baseField.attr(inputChoice)][0] : thing[baseField.attr(inputChoice)];
			if (val == null)
				baseField.val('');
			else
				baseField.val(val);

			if (EcArray.isArray(thing[baseField.attr(inputChoice)])) {
				//Create the input fields if needed and they aren't there yet
				if (thing[baseField.attr(inputChoice)].length > 1 && ($(this).find('input,textarea').length < thing[baseField.attr(inputChoice)].length - 1)) {
					for (var i = 1; i < thing[baseField.attr(inputChoice)].length; i++) {
						var newInput = $(baseField[0].cloneNode(false));
						var uuid = new UUID(4);
						newInput.attr('id', uuid.format());
						newInput.addClass('inputCopy');
						newInput.val('');
						newInput.insertBefore($(this).find('.addInputContainer'));
					}
				}

				$(this).find('input,textarea').each(function (i) {

					var val = thing[$(this).attr(inputChoice)][i + 1];
					if (val == null) {
						$(this).remove();
					} else {
						$(this).val(val);
					}
				});
			} else {
				//There is only one value, remove all additional input fields.
				$(this).find('input,textarea').each(function (i) {
					$(this).remove();
				});
			}
		});

	if (justLists != true)
		$("#detailSlider button").each(function () {
			$(this).prev("label").addClass("viewMode");
			if ($(this).attr(safeChoice) != null && ($(this).attr(labelChoice) == null || $(this).attr(labelChoice) === undefined)) {
				$(this).prev().hide();
				$(this).next().hide();
				$(this).hide();
				return;
			} else {
				$(this).prev().css("display", "");
				$(this).next().css("display", "");
				$(this).css("display", "");
			}
			var val = thing[$(this).attr(inputChoice)];
			$(this).attr('data-choice', inputChoice);
			if (val === undefined || val == null || val == "") {
				if ($(this).parents("#alignmentPanel").length == 0) // Not a button to add an item to a list
					$(this).prev("label").removeClass("viewMode");
				$(this).val(null);
			} else {
				$(this).val(val);
			}
		});
	if (justLists != true)
		$("#detailSlider select").each(function () {
			$(this).prev().prev("label").addClass("viewMode");
			if ($(this).attr(safeChoice) != null && ($(this).attr(labelChoice) == null || $(this).attr(labelChoice) === undefined)) {
				$(this).prev().prev().hide();
				$(this).prev().hide();
				$(this).hide();
				return;
			}
			var val = thing[$(this).attr(inputChoice)];
			if (val === undefined || val == null || val == "") {
				$(this).prev().prev("label").removeClass("viewMode");
				$(this).find("option").prop('selected', false).first().prop('selected', true);
			} else {
				$(this).find("option").prop('selected', false);
				$(this).find("option[value=\"" + val + "\"]").prop('selected', true);
				$(this).prev('p').text($(this).find('option[value]:selected').text());
			}
		});

	//Hide or show section headers in viewmode based on if they have any populated fields
	if ($('#detailSlider').hasClass('detailSliderView'))
		$('.sidebarAccordion:not(.exempt)').each(function () {
			var counter = 0;
			$(this).children('p').each(function () {
				if (!$(this).is(':empty')) {
					counter++;
				}
			});
			$(this).children('ul').each(function () {
				if ($(this).children('li').length > 0) {
					counter++;
				}
			});
			if (counter > 0) {
				$(this).prev().addClass('viewMode');
				$(this).prev().prev().addClass('viewMode');
			} else {
				$(this).prev().removeClass('viewMode');
				$(this).prev().prev().removeClass('viewMode');
			}
		});
}

refreshSidebar = function () {
	if ($("#detailSlider").length == 0) return;
	$("#detailSlider").addClass("detailSliderView").removeClass("detailSliderEdit");

	removeChangedFieldHighlight();

	$('#detailSlider').show();

	var thing = framework;
	if (selectedCompetency != null) {
		$("#detailSlider").addClass("detailSliderCompetency").removeClass("detailSliderFramework");
		thing = selectedCompetency;
		$("#alignmentPanel").show();
	} else {
		$("#detailSlider").addClass("detailSliderFramework").removeClass("detailSliderCompetency");
		$("#alignmentPanel").hide();
	}

	if (queryParams.export === 'true') {
		$('.export').show();
	}

	if (queryParams.ceasnDataFields == 'true' || queryParams.tlaProfile == 'true') {
		$("#detailSlider").addClass("detailSliderCeasn");
		$('.ceasnDataFields').show();
	} else {
		$("#detailSlider").addClass("detailSliderCass");
	}

	$('.ceasnDataFields').find('p').text(null);
	$('.ceasnDataFields').find('input').val(null);

	renderSidebar();

	$("sidebarFeedback").text("");
	$("#editFrameworkSection").find("button,input,textarea,select").prop('disabled', false);
	$(".ceasnDataFields:not(.exempt) ul:empty").hide();

	if (framework == thing) {
		$("#sidebarVersion").hide();
		$("#sidebarAddLevels").hide();
		$("#sidebarMoveUp").hide();
		$("#sidebarMoveDown").hide();
		$("#sidebarRemove").hide();
		if (queryParams.ceasnDataFields === 'true' || queryParams.tlaProfile == 'true') {
			$(".absentForCeasn").hide();
			$(".ceasnDataFields").show();
		}
	}

	if (thing == selectedCompetency) {
		if (framework.competency != null)
			if (EcArray.has(framework.competency.concat(framework.level), thing.shortId()))
				$("#sidebarVersion option").prop('selected', false).first().prop('selected', true);
			else {
				if (EcArray.has(framework.competency.concat(framework.level), thing.id))
					$("#sidebarVersion option").prop('selected', false).last().prop('selected', true);
				else
					console.log("Error. Version not certain.");
			}
		if (queryParams.ceasnDataFields === 'true' || queryParams.tlaProfile == 'true') {
			$(".absentForCeasn").hide();
			$(".ceasnDataFields").show();
		}
	}

	if (new EcLevel().isA(thing.getFullType())) {
		$("#sidebarAddCompetencies").hide();
		$("#sidebarAddLevels").hide();
	}

	if (thing.id == thing.shortId()) {
		$("#sidebarVersion").hide();
	}

	$("#sidebarFeedback").html("");
	if (!framework.canEditAny(EcIdentityManager.getMyPks())) {
		$(".frameworkEditControl").hide();
		if ($("#sidebarFeedback").html() == "")
			$("#sidebarFeedback").append("Edit options are limited:");
		$("#sidebarFeedback").append("<li>You do not own this framework.</li> ");
		$("#tree .competency").removeClass("grabbable");
		$(".ownerRequired").hide();
	} else {
		$("#tree .competency").addClass("grabbable");
		$(".ownerRequired").show();
	}

	if (!thing.canEditAny(EcIdentityManager.getMyPks())) {
		$(".competencyEditControl").hide();
		if ($("#sidebarFeedback").html() == "")
			$("#sidebarFeedback").append("Edit options are limited:");
		if (thing == framework) {
			//$("#sidebarEdit").hide();
		} else {
			$("#sidebarFeedback").append("<li>You do not own this competency.</li> ");
			//$("#sidebarEdit").hide();
		}
	}
	//Make sure the selected item actually has the selected class.
	if (selectedCompetency != null) {
		$("[id='" + selectedCompetency.shortId() + "']").addClass('selected');
	} else if (framework != null) {
		$('#frameworkNameContainer').addClass('selected');
	}
	//Hide URI error messages
	$('.orangeUri').removeClass('active');
	//Resize the sidebar
	$(".sidebar table").css("margin-top", "calc(" + $(".sidebarToolbar").height() + "px)");

}
isFirstEdit = false;
editSidebar = function () {
	if (viewMode)
		return;
	if (conceptMode)
		return editConceptSidebar();
	$("#detailSlider").addClass("detailSliderEdit").removeClass("detailSliderView");
	$("#editFrameworkSection label").css("display", "");
	$('.orangeUri').removeClass('active');

	changedFields = {};
	ulLengths = {};

	//Don't persist the invalidInput class between edits
	$('.invalidInput').each(function () {
		$(this).removeClass('invalidInput');
	});

	initULLengths();
	renderSidebar();

	$('.sidebarAccordion').removeClass('forceShow');

	var thing = framework;
	if (selectedCompetency != null)
		thing = selectedCompetency;

	$("sidebarFeedback").text("");
	if (!framework.canEditAny(EcIdentityManager.getMyPks()))
		if (selectedCompetency != null && framework.competency != null)
			if (EcArray.has(framework.competency.concat(framework.level), selectedCompetency.shortId())) {
				$("#sidebarSave").prop('disabled', true);
				$("#sidebarRemove").prop('disabled', true);
				$("#sidebarDelete").prop('disabled', true);
				$("#sidebarFeedback").html("Some edit options are limited: <li>You do not own this framework.</li> ");
			}

	if (!thing.canEditAny(EcIdentityManager.getMyPks())) {
		$("#sidebarNameInput").prop('disabled', true);
		$("#sidebarDescriptionInput").prop('disabled', true);
		$("#sidebarSave").prop('disabled', true);
		$("#sidebarDelete").prop('disabled', true);
		if (thing == framework) {
			$("#sidebarFeedback").html("Some edit options are limited: <li>You do not own this framework.</li> ");
		} else {
			$("#sidebarFeedback").append("<li>You do not own this competency.</li> ");
			$(".ceasnDataFields button,input,textarea,select").prop('disabled', true);
		}
	}

	if (thing == framework) {
		$("#sidebarUnlink").hide();
		$("#sidebarRemove").hide();
	}

	if (selectedRelation == null) {
		$("#sidebarUnlink").prop('disabled', true);
	}

	try {
		$('#sidebarNameInput').autocomplete("destroy");
		$('#sidebarNameInput').removeData('autocomplete');
	} catch (e) {}
	if (selectedCompetency != null && isFirstEdit === true) {
		EcCompetency.search(repo, $('#sidebarNameInput').val(), function (results) {
			var competencies = [];
			for (var i = 0; i < results.length; i++) {
				comp = EcRepository.getBlocking(results[i].shortId());
				if (comp.isId(results[i].shortId()) && results[i].shortId().indexOf("http") != -1) {
					competencies.push({label: results[i].getName(), id: results[i].shortId()});
				}
			}
			$('#sidebarNameInput').autocomplete({
				source: competencies,
				appendTo: '.sidebarEditSection',
				select: function (event, ui) {
					if (confirm("Selecting this competency will delete the one you are currently creating and reuse an existing competency. You may not have permissions to edit this competency further. Would you like to continue?")) {
						var competency = EcRepository.getBlocking(ui.item.id);
						var results = [];
						$(".changedField").removeClass("changedField");
						results.push(competency.shortId());

						//Delete the default created competency if selecting an existing one from dropdown
						framework.removeCompetency(selectedCompetency.shortId());
						framework.removeLevel(selectedCompetency.shortId());
						conditionalDelete(selectedCompetency.shortId());
						repo.saveTo(framework, function () {
							appendCompetencies(results, true);
						}, error);
						selectedCompetency = competency;
					}
				}
			});
		}, error, {});
	} else {
		$('#sidebarNameInput').autocomplete = null;
	}
	$('input[data-autocompleteCache="true"]').each(function () {
		attachCustomAutocomplete(this);
	});
	$(".sidebar table").css("margin-top", "calc(" + $(".sidebarToolbar").height() + "px)");
	if (queryParams.ceasnDataFields === 'true' || queryParams.tlaProfile == 'true') {
		$(".ceasnDataFields").show();
	}
}

$('#sidebarNameInput').on('keyup', function (evt) {
	if (selectedCompetency != null && isFirstEdit === true) {
		EcCompetency.search(repo, $(this).val(), function (results) {
			var competencies = [];
			for (var i = 0; i < results.length; i++) {
				comp = EcRepository.getBlocking(results[i].shortId());
				if (comp.isId(results[i].shortId()) && results[i].shortId().indexOf("http") != -1) {
					competencies.push({label: results[i].getName(), id: results[i].shortId()});
				}
			}
			$('#sidebarNameInput').autocomplete("option", "source", competencies);
		}, error, {});
	}
});

$("body").on("click", ".collapse", null, function (evt) {
	$(this).parent().children("ul").slideToggle();
	let state;
	if ($(this).hasClass('collapsed')) {
		$(this).removeClass('collapsed');
		$(this).html('<i class="fa fa-minus-square" aria-hidden="true"></i> ');
		state = 'expanded';
	} else {
		$(this).addClass('collapsed');
		$(this).html('<i class="fa fa-plus-square" aria-hidden="true"></i> ');
		state = 'collapsed';
	}
	// update localstorage collapseDict(ionary) which competency is collapsed (or expanded)
	collapseCompetencyTracking(framework.shortId(), $(this).parent().attr('id'), state);
});


$("body").on("click", ".competency input", null, function (evt) {
	evt.stopPropagation();
	$(evt.target).parent().find("input").prop("checked", evt.target.checked);
}).on("click", ".competency", null, function (evt) {
	if ($(".changedField:visible").length > 0) {
		if (!confirm("Some data has changed during edit. Do you want to discard changes?")) {
			evt.stopPropagation();
			return;
		}
	}
	isFirstEdit = false;
	var me = $(this);
	if (!$(this).hasClass("competency"))
		me = $(this).parents("competency");

	highlightSelected(me);

	if (conceptMode) {
		selectedCompetency = EcConcept.getBlocking(me.attr("id"));
	} else {
		selectedCompetency = EcCompetency.getBlocking(me.attr("id"));
		if (selectedCompetency == null)
			selectedCompetency = EcLevel.getBlocking(me.attr("id"));
		var relationId = me.attr("relationid");
		if (relationId != null && relationId != "")
			selectedRelation = EcAlignment.getBlocking(me.attr("relationid"));
		else
			selectedRelation = null;
	}
	refreshSidebar();
	spitEvent("competencyClicked", selectedCompetency.shortId());
	evt.stopPropagation();
});

//Detect input field changes
$('.sidebarEditSection').on('input', function (evt) {
	//Show or hide the error message when an input is invalid
	if ($('.' + evt.target.getAttribute('data-group')).is(':invalid'))
		$('#' + evt.target.getAttribute('data-group') + 'Span').addClass('active');
	else
		$('#' + evt.target.getAttribute('data-group') + 'Span').removeClass('active');
	changedFields[evt.target.id] = 'input';
	addChangedFieldHighlight();
	//Detect bad characters
	if (!validateString($('#' + evt.target.id).val()))
		setInvalidInput(evt.target.id);
	else
		setValidInput(evt.target.id);
});

//Detect alignment input field changes
$('#alignmentPanel').on('input', function (evt) {
	var inputField = $(evt.target);
	if (inputField.is(':invalid'))
		inputField.next('span').addClass('active');
	else
		inputField.next('span').removeClass('active');
	if (!validateString(inputField.val()))
		setInvalidInput(evt.target.id);
	else
		setValidInput(evt.target.id);
});

// Trim input field changes when input field lose focus
$('.sidebarEditSection').on("focusout", function (evt) {
	if (changedFields[evt.target.id] == 'input') {
		if (validateString($('#' + evt.target.id).val())) {
			// trim input
			var inputVal = $('#' + evt.target.id).val();
			$('#' + evt.target.id).val(inputVal.trim());
		}
	}
});

//Click handler for addInput buttons
$('body').on('click', '.addInputButton', function (evt) {
	var originalElem = $('#' + $(this).attr('data-target')).first();
	var newElem = $(originalElem[0].cloneNode(false));
	var uuid = new UUID(4);
	newElem.attr('id', uuid.format());
	newElem.addClass('inputCopy');
	newElem.val('');
	newElem.insertBefore($(this).parent());
	if ($(this).attr('data-autocomplete-field') === 'true')
		setLanguageTagAutocomplete();
});

//Detect UL length changes (For edit panel fields that don't use input fields)
// $('#detailSlider').on('DOMSubtreeModified', 'ul', function(evt) {
//     if (ulLengths[$(this).attr('id')] != undefined && $('#' + $(this).attr('id') + ' li').length != ulLengths[$(this).attr('id')]) {
//         changedFields[$(this).attr('id')] = 'label';
//     } else if (ulLengths[$(this).attr('id')] != undefined) {
//         delete changedFields[$(this).attr('id')];
//     }
//     addChangedFieldHighlight();
// });

$('body').on('click', '#frameworkName', function (evt) {
	if ($(".changedField:visible").length > 0) {
		if (!confirm("Some data has changed during edit. Do you want to discard changes?")) {
			evt.stopPropagation();
			return;
		}
	}
	selectedCompetency = null;
	refreshSidebar();
	highlightSelected($('#frameworkNameContainer'));
});

$('body').on('dragover', '.competency', function (evt) {
	if (viewMode)
		return;
	$(this).addClass('selected');
});

$('body').on('dragleave', '.competency', function (evt) {
	if (viewMode)
		return;
	$(this).removeClass('selected');
});

$('body').on('dragstart', '.competency', function (evt) {
	if (viewMode)
		return;
	$(evt.target).click();
	$('.competency').addClass('dashBorder');
});

$('body').on('dragenter', '.competency', function (evt) {
	if (viewMode)
		return;
	evt.preventDefault();
});

$('body').on('dragend', '.competency', function (evt) {
	if (viewMode)
		return;
	$('.competency').removeClass('dashBorder');
})

$('body').on('dragenter', '#frameworkNameContainer', function (evt) {
	if (viewMode)
		return;
	evt.preventDefault();
});

$('body').on('dragover', '#frameworkNameContainer', function (evt) {
	if (viewMode)
		return;
	evt.preventDefault();
	$(this).addClass('selected');
});

$('body').on('dragleave', '#frameworkNameContainer', function (evt) {
	if (viewMode)
		return;
	$(this).removeClass('selected');
});

$('body').on('dblclick', '.competency', function (evt) {
	editSidebar();
});

$('body').on('dblclick', '#frameworkNameContainer', function (evt) {
	editSidebar();
});

$('#sidebarDateCopyrightedInput').on('input', function () {
	validateYearOnly(this);
});

$('html').keydown(function (evt) {
	//Focus the correct frame to capture keydown events
	if ($(window.parent.document.getElementById('selectConceptSection')).css('display') === 'none' && $(window.parent.document.getElementById('selectCompetencySection')).css('display') === 'none' && $(window.parent.document.getElementById('findCompetencySection')).css('display') === 'none') {
		setTimeout(function () {
			parent.focus();
		});
	} else if ($('#selectConceptSection').length > 0 && $('#selectConceptSection').css('display') !== 'none') {
		setTimeout(function () {
			$('#selectConceptIframe')[0].contentWindow.focus();
		});
	} else if ($('#selectCompetencySection').length > 0 && $('#selectCompetencySection').css('display') !== 'none') {
		setTimeout(function () {
			$('#selectCompetencyIframe')[0].contentWindow.focus();
		});
	} else if ($('#findCompetencySection').length > 0 && $('#findCompetencySection').css('display') !== 'none') {
		setTimeout(function () {
			$('#findCompetencyIframe')[0].contentWindow.focus();
		});
	} else {
		setTimeout(function () {
			$('#cassControl').focus();
		});
	}
	//Only tab between the tour dialog buttons when they are visible
	if ($('#tourDialog').is(':visible')) {
		if (evt.which === 9) {
			evt.preventDefault();
			if ($('#acceptTourButton').is(':focus')) {
				$('#declineTourButton').focus();
			} else {
				$('#acceptTourButton').focus();
			}
		}
		return;
	}
	if ($('.hopscotch-bubble').is(':visible')) {
		//Custom tabbing for tour buttons
		if (evt.which === 9) {
			evt.preventDefault();
			if ($('.hopscotch-nav-button.next').is(':focus')) {
				$('.hopscotch-bubble-close').focus();
			} else {
				$('.hopscotch-nav-button.next').focus();
			}
		}
		if (evt.which === 13) {
			if ($('.hopscotch-bubble-close').is(':focus')) {
				$('.hopscotch-bubble-close').click();
			} else if ($('.hopscotch-nav-button.next').is(':focus')) {
				$('.hopscotch-nav-button.next').click();
			}
		}
		return;
	}

	if ($('button').is(':focus')) {
		if (evt.which === 27)
			$(':focus').blur();
		return;
	}

	//On escape
	if (evt.which === 27) {
		$(':focus').blur();
	} else if (!$('input').is(':focus') && !$('select').is(':focus') && !$('textarea').is(':focus')) {
		//If we're on the framework selection screen
		if ($('#frameworksSection').css('display') === 'block') {
			var frameworkElementArray = document.getElementById('frameworks').querySelectorAll('p');
			if (frameworkSelectionIndex === null) {
				frameworkSelectionIndex = 0;
				$('#frameworks').find('.selected').each(function () {
					$(this).removeClass('selected');
				});
				frameworkElementArray[frameworkSelectionIndex].classList.add('selected');
				return;
			}
			//On Down arrow
			if (evt.which === 40) {
				$(':focus').blur();
				if (frameworkSelectionIndex < frameworkElementArray.length - 1)
					frameworkSelectionIndex++;
				//clear any existing selected
				$('#frameworks').find('.selected').each(function () {
					$(this).removeClass('selected');
				});
				frameworkElementArray[frameworkSelectionIndex].classList.add('selected');
				$(".selected").parent().scrollTop($(".selected").parent().scrollTop() + $(".selected").position().top - 100);
				evt.preventDefault();
			}
			//On Up arrow
			else if (evt.which === 38) {
				$(':focus').blur();
				if (frameworkSelectionIndex > 0)
					frameworkSelectionIndex--;
				$('#frameworks').find('.selected').each(function () {
					$(this).removeClass('selected');
				});
				frameworkElementArray[frameworkSelectionIndex].classList.add('selected');
				$(".selected").parent().scrollTop($(".selected").parent().scrollTop() + $(".selected").position().top - 100);
				evt.preventDefault();
			}
			//On enter
			else if (evt.which === 13) {
				$(frameworkElementArray[frameworkSelectionIndex]).click();
				frameworkSelectionIndex = null;
			}
		}
		//If we're on the editFrameworks section
		else if ($('#editFrameworkSection').css('display') === 'block') {
			// asterisk key or Shift+8 = asterisk(*)
			if (evt.which === 170 || (evt.shiftKey && evt.which === 56)) {
				expandAllCompetencies();
			}
			// slash (forward)
			else if (evt.which === 191) {
				collapseAllCompetencies();
			}
			let competencyElementArray = $('#tree').find('.competency:visible');
			if (competencySelectionIndex == null ||
				competencySelectionIndex >= competencyElementArray.length)
				competencySelectionIndex = -1;
			// set selection index to selected competency if previous selection no longer selected competency
			if (selectedCompetency != null) {
				if (competencySelectionIndex < 0 ||
					competencyElementArray[competencySelectionIndex].id != selectedCompetency.shortId()) {
					for (var i = 0; i < competencyElementArray.length; i++) {
						if (competencyElementArray[i].id == selectedCompetency.shortId()) {
							competencySelectionIndex = i;
							break;
						}
					}
				}
			}
			//On shift+down arrow to move down hierarchy
			if (evt.shiftKey && evt.which === 40) {
				competencySelectionIndex++;
				moveDown();
				evt.preventDefault();
			}
			//On shift+up arrow to move up hierarchy
			else if (evt.shiftKey && evt.which === 38) {
				competencySelectionIndex--;
				moveUp();
				evt.preventDefault();
			}
			//On down arrow
			else if (evt.which === 40) {
				$(':focus').blur();
				if (competencySelectionIndex < competencyElementArray.length)
					competencySelectionIndex++;
				$(competencyElementArray[competencySelectionIndex]).click();
				$('#tree').scrollTop($('#tree').scrollTop() + $('.selected').position().top - 100);
				evt.preventDefault();
			}
			//On up arrow
			else if (evt.which === 38) {
				$(':focus').blur();
				if (competencySelectionIndex >= 0)
					competencySelectionIndex--;
				if (competencySelectionIndex >= 0)
					$(competencyElementArray[competencySelectionIndex]).click();
				else
					$('#frameworkName').click();
				$('#tree').scrollTop($('#tree').scrollTop() + $('.selected').position().top - 100);
				evt.preventDefault();
			}
			//On right or left arrow to collapse or expand
			else if (evt.which === 39 || evt.which === 37) {
				if ($(competencyElementArray[competencySelectionIndex]).hasClass("expandable")) {
					$(':focus').blur();
					$(competencyElementArray[competencySelectionIndex]).children(".collapse").click();
					$(".selected").parent().scrollTop($(".selected").parent().scrollTop() + $(".selected").position().top - 50);
				}
			}
			//On Backspace
			else if (evt.which === 8) {
				$('#editFrameworkBack').click();
			}
			//On Enter
			else if (evt.which === 13) {
				if ($('a').is(':focus')) {
					$('a:focus').click();
					return;
				}
				if (queryParams.select != null) {
					if (evt.shiftKey)
						$('#selectAllButton').click();
					else
						$(competencyElementArray[competencySelectionIndex]).children("input").click();
				}
			}
			//Shift+C
			else if (evt.which === 67) {
				if (evt.shiftKey) {
					dragShortcut($('.selected'), true);
				}
			}
			//Shift+X
			else if (evt.which === 88) {
				if (evt.shiftKey) {
					dragShortcut($('.selected'), false);
				}
			}
			//Shift+V
			else if (evt.which === 86) {
				if (evt.shiftKey) {
					dropShortcut($('.selected'));
				}
			}
			//Shift+U
			else if (evt.which === 85) {
				if (evt.shiftKey) {
					unlinkCompetency();
				}
			}

		}
	} else {
		//Enable scrolling while in text field
		//On up arrow
		if (evt.which === 38) {
			var scroll = $('#detailSlider').scrollTop();

			$('#detailSlider').scrollTop(scroll - 10);
			return false;
		}
		//On down arrow
		else if (evt.which === 40) {
			var scroll = $('#detailSlider').scrollTop();

			$('#detailSlider').scrollTop(scroll + 10);
			return false;
		}
		//On enter
		else if (evt.which === 13) {
			evt.preventDefault();
			return false;
		}
	}
});

$("body").on("webkitAnimationEnd oanimationend msAnimationEnd animationend", ".savedCompetency", function () {
	$(".savedCompetency").removeClass('savedCompetency');
});

//Store which competency user has collapsed in localstorage so it persists
collapseCompetencyTracking = function (fId, cId, toggleState) {
	var collapseDict = JSON.parse(localStorage.getItem('collapseDict'));
	if (collapseDict == null)
		collapseDict = {};

	if (fId == null) {
		console.log("collapseCompetencyTracking failed! Given undefined framework Id.");
		return false;
	}
	if (cId == null) {
		console.log("collapseCompetencyTracking failed! Given undefined competency Id.");
		return false;
	}
	if (collapseDict[fId] == null)
		collapseDict[fId] = {};

	if (toggleState == null) {
		console.log("collapseCompetencyTracking failed! Given undefined toggle state.");
		return false;
	} else {
		if (toggleState === 'expanded' && collapseDict[fId][cId] != null)
			delete collapseDict[fId][cId];
		else
			collapseDict[fId][cId] = toggleState;

		localStorage.setItem('collapseDict', JSON.stringify(collapseDict));
	}
}

collapseAllCompetencies = function () {
	if (conceptMode)
		return;
	if (framework.competency == null || framework.competency.length == 0)
		return;
	for (var i = 0; i < framework.competency.length; i++) {
		var competencyId = framework.competency[i];
		var competency = $("#tree [id='" + competencyId + "']");
		if (competency.length > 0) {
			if (competency.hasClass('expandable')) {
				collapseCompetencyTracking(framework.shortId(), competencyId, 'collapsed');
			} //end if competency expandable
		} //end if
	} //end for each competency
	selectedCompetency = null; // so sidebar display of competency is cleared
	refreshSidebar();
	collapseCompetencies();
}

collapseCompetencies = function () {
	var collapseDict = JSON.parse(localStorage.getItem('collapseDict'));
	var fId = framework.shortId();
	if (collapseDict != null && collapseDict[fId] != null)
		Object.keys(collapseDict[fId]).forEach(function (key) {
			if (collapseDict[fId][key] === 'collapsed') {
				var elem = $('[id="' + key + '"]');
				elem.children('.collapse').addClass('collapsed');
				elem.children('.collapse').children('i').removeClass('fa-minus-square').addClass('fa-plus-square');
				elem.children('ul').slideToggle();
				elem.children('ul').hide();
			}
		});
}

expandAllCompetencies = function () {
	if (conceptMode)
		return;
	if (framework.competency == null || framework.competency.length == 0)
		return;
	for (var i = 0; i < framework.competency.length; i++) {
		var competencyId = framework.competency[i];
		var competency = $("#tree [id='" + competencyId + "']");
		if (competency.length > 0) {
			if (competency.hasClass('expandable')) {
				if (competency.children('.collapse').hasClass('collapsed')) {
					competency.children('ul').slideToggle();
					competency.children('.collapse').removeClass('collapsed');
					competency.children('.collapse').children('i').removeClass('fa-plus-square').addClass('fa-minus-square');
					collapseCompetencyTracking(framework.shortId(), competencyId, 'expanded');
				} //end if competency collapsed
			} //end if competency expandable
		} //end if competency
	} //end for each competencies
}

validateString = function (str) {
	for (var i = 0; i < str.length; i++) {
		var charCode = str.charCodeAt(i);
		if (charCode > 65529 && charCode < 65535 || charCode === 160)
			return false;
	}
	return true;
}

validateYearOnly = function (elem) {
	if ($(elem).val().length === 0 || ($(elem).val().length === 4 && $(elem).val().match(/^[0-9]+$/) != null))
		elem.setCustomValidity("");
	else
		elem.setCustomValidity("Year only YYYY");
}

setInvalidInput = function (id) {
	$('#' + id).addClass('invalidInput');
}

setValidInput = function (id) {
	$('#' + id).removeClass('invalidInput');
}

addChangedFieldHighlight = function () {
	Object.keys(changedFields).forEach(function (key) {
		if (changedFields[key] == 'label') {
			$('label[for="' + key + '"]').addClass('changedField');
		} else {
			$('[id=' + key + ']').addClass('changedField');
		}
	});
}

removeChangedFieldHighlight = function () {
	changedFields = {};
	ulLengths = {};
	$('#detailSlider .changedField').removeClass('changedField');
}

playSavedAnimation = function (id) {
	setTimeout(function () {
		var elem = document.getElementById(id);
		if (elem) {
			elem.classList.remove('savedCompetency');
			void elem.offsetWidth;
			elem.classList.add('savedCompetency');
		}
	}, 1000);
}

toggleDiv = function (chevronId, id) {
	$('#' + chevronId).toggleClass('fa-chevron-up fa-chevron-down');
	$('#' + id).slideToggle(400);
}

initULLengths = function () {
	$('#detailSlider ul').each(function (index) {
		ulLengths[$(this).attr('id')] = 0;
	});

	Object.keys(ulLengths).forEach(function (key) {
		ulLengths[key] = $('#' + key + ' li').length;
	});
}

exportSelected = function () {
	var v = $("#sidebarExport").val();
	var link;
	var guid;
	if (selectedCompetency != null) {
		if (EcRepository.shouldTryUrl(selectedCompetency.id) == false) {
			link = repo.selectedServer + "data/" + EcCrypto.md5(selectedCompetency.id);
			guid = EcCrypto.md5(selectedCompetency.id);
		} else {
			link = selectedCompetency.id;
			guid = selectedCompetency.getGuid();
		}
	} else {
		if (EcRepository.shouldTryUrl(framework.id) == false) {
			link = repo.selectedServer + "data/" + EcCrypto.md5(framework.id);
			guid = EcCrypto.md5(framework.id);
		} else {
			link = framework.id;
			guid = framework.getGuid();
		}
	}
	if (v == "asn")
		window.open(link.replace("/data/", "/asn/"), '_blank');
	else if (v == "cass")
		window.open(link, '_blank');
	else if (v == "cassn4") {
		$.ajax({
			url: link,
			headers: {
				"Accept": "text/n4"
			},
			success: function (data) {
				if (conceptMode)
					download(framework.title + ".n4", data);
				else
					download(framework.name + ".n4", data);
			}
		});
	} else if (v == "cassrdfjson") {
		$.ajax({
			url: link,
			headers: {
				"Accept": "application/rdf+json"
			},
			success: function (data) {
				if (conceptMode)
					download(framework.title + ".rdf.json", JSON.stringify(data, null, 2));
				else
					download(framework.name + ".rdf.json", JSON.stringify(data, null, 2));
			}
		});
	} else if (v == "cassrdfxml") {
		$.ajax({
			url: link,
			headers: {
				"Accept": "application/rdf+xml"
			},
			success: function (data) {
				if (conceptMode)
					download(framework.title + ".rdf.xml", data);
				else
					download(framework.name + ".rdf.xml", data);
			}
		});
	} else if (v == "cassturtle") {
		$.ajax({
			url: link,
			headers: {
				"Accept": "text/turtle"
			},
			success: function (data) {
				if (conceptMode)
					download(framework.title + ".turtle", data);
				else
					download(framework.name + ".turtle", data);
			}
		});
	} else if (v == "ceasn")
		window.open(link.replace("/data/", "/ceasn/"), '_blank');
	else if (v == "csv") {
		CSVExport.exportFramework(framework.id, console.log, console.log);
	} else if (v == "case")
		if (selectedCompetency == null)
			window.open(repo.selectedServer + "ims/case/v1p0/CFDocuments/" + guid, '_blank');
		else
			window.open(repo.selectedServer + "ims/case/v1p0/CFItems/" + guid, '_blank');

}

viewJSON = function () {
	var link;
	if (selectedCompetency !== null) {
		link = selectedCompetency.id;
	} else {
		link = framework.id;
	}
	var redirect = window.open(link, '_blank');
	redirect.location;
}

setLanguageTagAutocomplete = function () {
	$('.sidebarInLanguageInput:last').autocomplete({
		source: tags,
		appendTo: '.ceasnDataFields',
		minLength: 2
	});
	$('.sidebarFrameworkInLanguageInput:last').autocomplete({
		source: tags,
		appendTo: '.ceasnDataFields',
		minLength: 2
	});
	$('.sidebarConceptInLanguageInput:last').autocomplete({
		source: tags,
		appendTo: '.ceasnDataFields',
		minLength: 2
	});
}

highlightCompetencies = function (competencies) {
	var idArray;
	if (competencies)
		idArray = competencies
	else if (queryParams.highlightCompetency != null)
		idArray = queryParams.highlightCompetency
	if (idArray != null) {
		if (!EcArray.isArray(idArray))
			idArray = [idArray];
		$('.highlightedCompetency').removeClass('highlightedCompetency');
		for (id in idArray) {
			$('[id="' + idArray[id] + '"]').addClass('highlightedCompetency');
		}
	}
}

handleAlignmentInput = function (event) {
	var button = $(event.currentTarget);
	if (button.attr('data-mode') == 'Add') {
		button.next().next('input').val('');
		button.next().next('input').removeClass('hidden');
		button.attr('data-mode', 'Save');
		button.children().first().removeClass('fa-plus').addClass('fa-check');
		button.addClass('nudge');
		button.attr('title', 'Save this relation.');
		button.next().next('input').focus();
	} else if (button.attr('data-mode') == 'Save') {
		if (!isEmpty(button.next().next('input').val()) && !button.next().next('input').is(':invalid')) {
			addAlignments([button.next().next('input').val()], selectedCompetency, button.attr(button.attr('data-choice')));
		} else if (!isEmpty(button.next().next('input').val()))
			alert('Alignments must be a URI.');
		if (!button.next().next('input').is(':invalid')) {
			button.next().next('input').addClass('hidden');
			button.attr('data-mode', 'Add');
			button.children().first().removeClass('fa-check').addClass('fa-plus');
			button.attr('title', 'Add a relation with a URI.');
			button.removeClass('nudge');
		}
	}
}

var langTags = {};
var tags = [];
$.ajax({
	url: "js/ietf-language-tags_json.json",
	success: function (a) {
		if (typeof a === 'string') {
			a = JSON.parse(a);
		}
		var tagList = a;
		for (var i = 0; i < tagList.length; i++) {
			tags.push(tagList[i].description);
			langTags[tagList[i].description] = tagList[i].subtag;
		}
		$('#sidebarInLanguageInput').autocomplete({
			source: tags,
			appendTo: '.ceasnDataFields',
			minLength: 2,
		});
		$('#sidebarFrameworkInLanguageInput').autocomplete({
			source: tags,
			appendTo: '.ceasnDataFields',
			minLength: 2
		});
		$('#sidebarConceptInLanguageInput').autocomplete({
			source: tags,
			appendTo: '.ceasnDataFields',
			minLength: 2
		});
	}
});
