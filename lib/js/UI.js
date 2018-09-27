"use strict";

if (typeof HML == 'undefined') var HML = {};

document.addEventListener( "DOMContentLoaded", function() {

 HML.ui = function() {

  if (/Chrome/.test(navigator.userAgent)) {
   var ChromeTestFunction = function(e) {
    var r=new FileReader();
    r.onloadend=(event)=>self.postMessage(event.target.error!=null);
    r.readAsText(e.data);
   }
   var ChromeTest = new Worker(URL.createObjectURL( new Blob([
    "self.addEventListener(\"message\","+ChromeTestFunction.toString()+");"
   ]) ));
   ChromeTest.postMessage(new File([new Blob([])],"Test"))
   ChromeTest.addEventListener("message",function errorMsg(e) {
    e.stopImmediatePropagation();
    ChromeTest.removeEventListener("message",errorMsg);
    ChromeTest.terminate();
    ChromeTest = null;
    ChromeTestFunction = null;
    if (e.data) {
     document.body.innerHTML = "HeavyMetL requires that Chrome be run using the --allow-file-access-from-files flag to allow multithreaded raw file analysis";
    }
   });
  }

  var _ui = {};

  const UI_UPDATE_INTERVAL = 1000;

  _ui.fontFamily = window.getComputedStyle(document.getElementById("HeavyMetL")).fontFamily;

  //Element bindings
  _ui.rawFilesInput = document.getElementById("input-raw-files");
  _ui.fileTabs = document.getElementById("file-tab-list");
  _ui.idListInput = document.getElementById("input-identifications");
  _ui.proteinTable = document.getElementById("results-table-container");
  _ui.settings = document.getElementById("input-settings");
  _ui.settingsDialog = document.getElementById("settings-pane-overlay");
  _ui.settingsDialog.contents = document.getElementById("settings-contents");
  _ui.settingsDialog.help = document.getElementById("settings-help");
  _ui.settingsDialog.cancelButton = document.getElementById("settings-cancel");
  _ui.settingsDialog.updateButton = document.getElementById("settings-update");
  _ui.processAll = document.getElementById("process-all");
  _ui.processSelected = document.getElementById("process-selected");
  _ui.downloadProteins = document.getElementById("download-proteins");
  _ui.downloadPeptides = document.getElementById("download-peptides");
  _ui.downloadPeptides = document.getElementById("download-peptides");
  _ui.saveAsPNG = document.getElementById("save-as-png");
  _ui.saveAsSVG = document.getElementById("save-as-svg");
  _ui.progressOverlay = document.getElementById("progress-pane-overlay");
  _ui.progressOverlay.progressBar = document.getElementById("progress-bar");
  _ui.progressOverlay.progressInfo = document.getElementById("progress-info");
  _ui.graphicsOverlay = document.getElementById("graphics-pane-overlay");
  _ui.graphicsOverlay.closeButton = document.getElementById("graphics-close");
  _ui.canvas = new fabric.Canvas('graphics-canvas',{hoverCursor: 'pointer',backgroundColor: 'rgb(255,255,255)'});

  //Other variables
  _ui.files = {};
  _ui.availableFileNames = [];
  _ui.featuresObject = {};
  _ui.featuresArray = [];
  _ui.selectedFile = undefined;
  _ui.selectedFeature = undefined;
  _ui.selectedProtein = undefined;
  _ui.quantWorkers = [];
  for (var i = 0; i < HML.config._quantitationThreads; i++) {
   _ui.quantWorkers[i] = new HML.QuantitationWorker();
  }

  //Interface helper functions
  var removeClass = function(node,cN) {
   node.className = node.className.replace(new RegExp("(?:^|\\s)"+cN+"(?!\\S)","g"),"");
  }
  var addClass = function(node,cN) {
   removeClass(node,cN);
   if (node.className.length) node.className +=(" "+cN);
   else node.className = cN;
  }
  var disable = function(node) {
   node.disabled = true;
   addClass(node,"disabled");   
  }
  var enable = function(node) {
   node.disabled = false;
   removeClass(node,"disabled");   
  }
  var hide = function(node) {
   node.style.visibility="hidden";   
  }
  var show = function(node) {
   node.style.visibility="visible";
  }
  var setSelected = function(el) {
   var scope = (el.nodeName.toLowerCase() == "tr" ? _ui.proteinTable : _ui.fileTabs);
   Array.prototype.slice.call(scope.getElementsByClassName("selected")).forEach(function(node) {
    removeClass(node,"selected");
   });
   addClass(el,"selected");
  };

  _ui.shortFileName = function(fileName) {
   return fileName.replace(/\.(?:raw|mzML|mzXML)$/,"")
  }

  //Initial state
  enable(_ui.rawFilesInput);
  disable(_ui.idListInput);
  disable(_ui.settings);
  disable(_ui.processAll);
  disable(_ui.processSelected);
  disable(_ui.downloadProteins);
  disable(_ui.downloadPeptides);

  var resizeCanvas = function() {
   _ui.canvas.setHeight(_ui.canvas.wrapperEl.parentElement.offsetHeight);
   _ui.canvas.setWidth(_ui.canvas.wrapperEl.parentElement.offsetWidth);
   _ui.canvas.renderAll();
   _ui.canvas.calcOffset();
  };
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas, false);

  window.onbeforeunload = function() { return "Are you sure you wish to navigate away?  All progress will be lost." };

  var setProgressBar = function(p) {
   if (isNaN(p)) {
    _ui.progressOverlay.progressBar.style.background = "lightblue";
    _ui.progressOverlay.progressBar.innerHTML = p;
   }
   else {
    _ui.progressOverlay.progressBar.style.background = "linear-gradient(90deg, lightblue "+p+"%, lightgrey 1%, lightgrey "+(100-p-1)+"%)";
    _ui.progressOverlay.progressBar.innerHTML = p.toFixed(2)+"%";
   }
  };
 
  var setProgressInfo = function(i) {
   _ui.progressOverlay.progressInfo.innerHTML = i;
  }

  //Raw Files Input
  _ui.rawFilesInput.addEventListener('click', function() {
   if (_ui.rawFilesInput.disabled) return;
   _ui.rawFilesInput.fileSelect = document.createElement('input');
   _ui.rawFilesInput.fileSelect.type = "file";
   _ui.rawFilesInput.fileSelect.accept = ".mzML,.mzXML,.raw";
   _ui.rawFilesInput.fileSelect.multiple = true;
   _ui.rawFilesInput.fileSelect.addEventListener('change', function(e) { window.setTimeout(loadFiles, 4) });
   _ui.rawFilesInput.fileSelect.click();
  });

  var loadFiles = function() {
   disable(_ui.rawFilesInput);
   disable(_ui.idListInput);
   disable(_ui.settings);
   disable(_ui.processAll);
   disable(_ui.processSelected);
   disable(_ui.downloadProteins);
   disable(_ui.downloadPeptides);
   _ui.fileTabs.innerHTML = "";
   _ui.proteinTable.innerHTML = "";
   _ui.selectedFile = undefined;
   _ui.selectedFeature = undefined;
   _ui.selectedProtein = undefined;
   _ui.availableFileNames.forEach((fn) => {
    _ui.files[fn].worker.terminate();
    delete(_ui.files[fn].worker);
    delete(_ui.files[fn]);
   });
   _ui.files = {};
   _ui.availableFileNames = null;
   _ui.featuresObject = {};
   _ui.featuresArray = [];
   if (_ui.rawFilesInput.fileSelect.files.length) {
    _ui.availableFileNames = new Array(_ui.rawFilesInput.fileSelect.files.length);
    for (var i = 0, f; f = _ui.rawFilesInput.fileSelect.files[i]; i++) {
     var tab = document.createElement('a');
     tab.appendChild(document.createTextNode(f.name));
     tab.fName = _ui.shortFileName(f.name);
     _ui.files[tab.fName] = new HML.MsDataFileWorker(f);
     _ui.availableFileNames[i] = tab.fName;
     tab.addEventListener('click', function(e) {
      var tab = e.target;
      if (_ui.files[tab.fName].worker.ready) {
       _ui.selectedFile = tab;
       setSelected(tab);
       checkSelected();
      }
      e.stopPropagation();
     });
     _ui.fileTabs.appendChild(tab);
     monitorIndexing(tab);
    }
    enable(_ui.idListInput);
    waitForIndexingComplete();
   }
  };

  //File processing progress
  var monitorIndexing = function(tab) {
   var file = _ui.files[tab.fName];
   if (file.worker.ready) {
    tab.removeAttribute("style");
    addClass(tab,"ready");
   }
   else {
    var p = Math.round(file.worker.progress);
    tab.style.background = "linear-gradient(90deg, lightgreen "+p+"%, pink 1%, pink "+(100-p-1)+"%)";
    window.setTimeout(monitorIndexing, UI_UPDATE_INTERVAL, tab);
   }
  };
  var waitForIndexingComplete = function() {
   if (!_ui.idListInput.disabled) {
    if (_ui.availableFileNames.every(fn => _ui.files[fn].worker.ready)) {
     MSLIB.Common.callAsync(() => {
      enable(_ui.rawFilesInput);
      if (_ui.fileTabs.childNodes.length == 1) _ui.fileTabs.childNodes[0].click();
     });
    }
    else window.setTimeout(waitForIndexingComplete, UI_UPDATE_INTERVAL);
   }
  };

  //ID List Input  
  _ui.idListInput.addEventListener('click', function() {
   if (_ui.idListInput.disabled) return;
   _ui.idListInput.fileSelect = document.createElement('input');
   _ui.idListInput.fileSelect.type = "file";
   _ui.idListInput.fileSelect.accept = ".csv,.tsv,.txt";
   _ui.idListInput.fileSelect.addEventListener('change', function(e) { window.setTimeout(loadIds, 4) });
   _ui.idListInput.fileSelect.click();
  });

  var loadIds = function() {
   if (_ui.idListInput.fileSelect.files.length) {
    disable(_ui.rawFilesInput);
    disable(_ui.idListInput);
    disable(_ui.settings);
    disable(_ui.processAll);
    disable(_ui.processSelected);
    disable(_ui.downloadProteins);
    disable(_ui.downloadPeptides);
    _ui.idListInput.ready = false;
    _ui.proteinTable.innerHTML = "";
    _ui.selectedFeature = undefined;
    _ui.selectedProtein = undefined;
    _ui.featuresObject = {};
    _ui.featuresArray = [];
    _ui.idFile = new MSLIB.Format.TextTableFile(_ui.idListInput.fileSelect.files[0]);
    _ui.idFile.useFirstLineAsHeaders = true;
    _ui.idFile.load();
    window.setTimeout(function waitForIdFileReady() {
     if (_ui.idFile.ready) {
      var h = _ui.idFile.headerIndices = {      
       protein       : _ui.idFile.headers.indexOf("PROTEIN"),
       description   : _ui.idFile.headers.indexOf("PROTEIN_DESCRIPTION"),
       proteinScore  : _ui.idFile.headers.indexOf("PROTEIN_SCORE"),
       peptide       : _ui.idFile.headers.indexOf("PEPTIDE_SEQUENCE"),
       peptideScore  : _ui.idFile.headers.indexOf("PEPTIDE_SCORE"),
       contribute    : _ui.idFile.headers.indexOf("CONTRIBUTE_TO_PROTEIN"),
       fName         : _ui.idFile.headers.indexOf("FILE_NAME"),
       scan          : _ui.idFile.headers.indexOf("SCAN_NUMBER"),
       rt            : _ui.idFile.headers.indexOf("RETENTION_TIME"),
       modifications : _ui.idFile.headers.indexOf("MODIFICATIONS"),
       charge        : _ui.idFile.headers.indexOf("CHARGE")
      }
      if ((h.protein < 0) || (h.peptide < 0) || (h.fName < 0) || ((h.scan < 0) && (h.rt < 0)) || (h.charge < 0)) {
       throw new Error("UIFailedToParseIds");
      }
      else {
       _ui.idFile.rawFilesNotFound = {};
       _ui.idFile.currentLine = 0;
       _ui.proteinTable.innerHTML = "<p>Waiting for raw file indexing to finish...</p>";
       window.setTimeout(function waitForIndexingComplete() {
        if (_ui.availableFileNames.every(fn => _ui.files[fn].worker.ready)) {
         _ui.proteinTable.innerHTML = "<p>Loading identifications...</p>";
         show(_ui.progressOverlay);
         monitorIDLoading();
         processIdListLine();
        }
        else window.setTimeout(waitForIndexingComplete, UI_UPDATE_INTERVAL);
       }, 4);
      }
     }
     else window.setTimeout(waitForIdFileReady,4);
    },4);
   }
  };

  var processIdListLine = function() {
   var l = _ui.idFile.lines[_ui.idFile.currentLine];
   var h = _ui.idFile.headerIndices;
   var protein = l[h.protein];
   if (protein) {
    var peptide = l[h.peptide].replace(/^[\w-]?\.|\.[\w-]$/g,"");
    if (peptide) {
     var fName = l[h.fName].replace(/\.(?:raw|mzML|mzXML)$/,"");
     if (fName) {
      if (fName && (_ui.availableFileNames.indexOf(fName) < 0)) {
       _ui.idFile.rawFilesNotFound[fName] = true;
       nextLine();
      }
      else {
       var description = h.description >= 0 ? l[h.description] : "";
       var proteinScore = h.proteinScore >= 0 ? l[h.proteinScore] : "";
       var peptideScore = h.peptideScore >= 0 ? l[h.peptideScore] : "";
       var contribute = h.contribute >= 0 ? (l[h.contribute].match(/t|true|y|yes|1/i) ? true : false) : true;
       var scan = h.scan >= 0 ? l[h.scan] : null;
       var modString = h.modifications >= 0 ? l[h.modifications] : "";
       var charge = l[h.charge];
       charge = parseInt(charge.toString().replace(/\+$/,"")); //remove trailing +
       if (h.rt >= 0) _ui.files[fName].callFunc("getNearestMSXRTfromRT",[1,+l[h.rt],true]);
       else _ui.files[fName].callFunc("getNearestMSXRTfromScanNumber",[1,+scan,true]);
       MSLIB.Common.whenReady(_ui.files[fName].worker,() => {
        var ms1rt = _ui.files[fName].funcResponse;
        if (h.rt >= 0) _ui.files[fName].callFunc("getNearestMSXRTfromRT",[2,+l[h.rt]]);
        else _ui.files[fName].callFunc("getNearestMSXRTfromScanNumber",[2,+scan]);
        MSLIB.Common.whenReady(_ui.files[fName].worker,() => {
         var idrt = _ui.files[fName].funcResponse;
         if (idrt == null) idrt = ms1rt;
         if (!_ui.featuresObject[protein]) _ui.featuresObject[protein] = {}; 
         if (!_ui.featuresObject[protein][peptide]) _ui.featuresObject[protein][peptide] = {};
         if (!_ui.featuresObject[protein][peptide][charge]) _ui.featuresObject[protein][peptide][charge] = {};
         if (!_ui.featuresObject[protein][peptide][charge][modString]) {
          var featureData = [ //Will eventually hold quant as well
           protein,      //0
           description,  //1
           proteinScore, //2
           peptide,      //3
           peptideScore, //4
           contribute,   //5
           [fName],      //6
           [[ms1rt]],    //7
           [[idrt]],     //8
           modString,    //9
           charge,       //10
           {}            //11
          ]
          _ui.featuresObject[protein][peptide][charge][modString] = featureData;
          _ui.featuresArray.push(featureData);
         }
         else {
          var feature = _ui.featuresObject[protein][peptide][charge][modString];
          var fnidx = feature[6].indexOf(fName);
          if (fnidx < 0) {
           feature[6].push(fName);
           feature[7].push([ms1rt]);
           feature[8].push([idrt]);
          }
          else {
           feature[7][fnidx].push(ms1rt);
           feature[8][fnidx].push(idrt);
          }
         }
         nextLine();
        });
       });
      }
     }
     else nextLine();
    }
    else nextLine();
   }
   else nextLine();
  };

  var nextLine = function() {
   if(++_ui.idFile.currentLine < _ui.idFile.lines.length) {
    MSLIB.Common.callAsync(processIdListLine);
   }
   else {
    _ui.featuresArray.forEach(f => {
     f[7] = f[7].map(MS1RTarr => MS1RTarr.reduce((a,b) => (a+b))/MS1RTarr.length);
     f[7].push(f[7].reduce((a,b) => (a+b))/f[7].length);
    });
    if (Object.keys(_ui.idFile.rawFilesNotFound).length) console.log("Warning: files not found - "+Object.keys(_ui.idFile.rawFilesNotFound).join(";"));
    _ui.idFile = null;
    delete(_ui.idFile);
    generateProteinTable();
   }
  }

  var monitorIDLoading = function() {
   if (_ui.idFile) {
    setProgressBar((_ui.idFile.currentLine/_ui.idFile.lines.length)*99);
    window.setTimeout(monitorIDLoading, UI_UPDATE_INTERVAL);
   }
  };

  var getFeatureRT = function(f,fn) {
   var MS1RTindex = f[6].indexOf(fn);
   if (MS1RTindex >= 0) return f[7][MS1RTindex];
   else return f[7][f[7].length-1]; 
  }

  var getTableRow = function(ele) {
   while (ele.nodeName.toLowerCase() != "tr") {
    if (ele.parentNode.nodeName.toLowerCase() == "table") {
     throw new Error("UICannotGetTableRow");
     break;
    }
    else ele = ele.parentNode;
   }
   return(ele);
  }

  //Update Protein Table
  var generateProteinTable = function() {
   _ui.proteinTable.innerHTML = "<p>Rebuilding table...</p>";
   var t = document.createElement('table');
   var tHead = t.createTHead();
   var protHeaders = ["Protein","# Unique Sequences","# Contributing Sequences","Protein Score","Description"];
   var tHeadProtRow = tHead.insertRow(-1);
   protHeaders.forEach(function(h,i) {
    var tHeadCell = tHeadProtRow.insertCell(-1);
    tHeadCell.appendChild(document.createTextNode(h));
    if (i==4) tHeadCell.colSpan=2;
   });
   addClass(tHeadProtRow,"protein");
   var pepHeaders = ["Peptide Contributes?","Peptide Sequence","Peptide Score","Charge","Modifications"];
   var tHeadPepRow = tHead.insertRow(-1);
   pepHeaders.forEach(function(h,i) {
    var tHeadCell = tHeadPepRow.insertCell(-1);
    tHeadCell.appendChild(document.createTextNode(h));
    if (i==1) tHeadCell.colSpan=2;
   });
   var tBody = t.createTBody();
   Object.keys(_ui.featuresObject).sort().forEach(function(protein) {
    var peptides = Object.keys(_ui.featuresObject[protein]).sort();
    var tBodyProteinRow = tBody.insertRow(-1);
    addClass(tBodyProteinRow,"protein");
    var protCell = tBodyProteinRow.insertCell(-1);
    protCell.appendChild(document.createTextNode(protein));
    var nPepCell = tBodyProteinRow.insertCell(-1);
    nPepCell.appendChild(document.createTextNode(peptides.length));
    var nUsablePepCell = tBodyProteinRow.insertCell(-1);
    var protScoreCell = tBodyProteinRow.insertCell(-1);
    var descCell = tBodyProteinRow.insertCell(-1);
    descCell.colSpan=2;
    //(usable peps, prot score, description filled in after looping through peptides)
    tBodyProteinRow.protein = protein;
    tBodyProteinRow.addEventListener('click', handleRowClick);
    tBodyProteinRow.addEventListener('dblclick', handleRowClick);
    var usableSequences = 0;
    var protScore;
    var description;
    peptides.forEach(function(peptide) {
     var isUsable = false;
     Object.keys(_ui.featuresObject[protein][peptide]).sort().forEach(function(charge) {
      Object.keys(_ui.featuresObject[protein][peptide][charge]).sort().forEach(function(modString) {
       var feature = _ui.featuresObject[protein][peptide][charge][modString];
       protScore = protScore || feature[2];
       description = description || feature[1];
       var tBodyPeptideRow = tBody.insertRow(-1);
       if (feature[5]) isUsable = true;
       else addClass(tBodyPeptideRow,"nocontrib");
       var usableCell = tBodyPeptideRow.insertCell(-1);
       usableCell.appendChild(document.createTextNode(feature[5] ? "\u2713" : ""));
       var peptideCell = tBodyPeptideRow.insertCell(-1);
       peptideCell.appendChild(document.createTextNode(peptide));
       peptideCell.colSpan=2;
       var peptideScoreCell = tBodyPeptideRow.insertCell(-1);
       peptideScoreCell.appendChild(document.createTextNode(feature[4]));
       var chargeCell = tBodyPeptideRow.insertCell(-1);
       chargeCell.appendChild(document.createTextNode(charge));
       var modificationCell = tBodyPeptideRow.insertCell(-1);
       modificationCell.appendChild(document.createTextNode(modString));
       tBodyPeptideRow.feature = feature;
       tBodyPeptideRow.addEventListener('click', handleRowClick);
       tBodyPeptideRow.addEventListener('dblclick', handleRowClick);
      });
     });
     if (isUsable) usableSequences++;
    });
    nUsablePepCell.appendChild(document.createTextNode(usableSequences));
    protScoreCell.appendChild(document.createTextNode(protScore));
    descCell.appendChild(document.createTextNode(description));
   });
   _ui.proteinTable.innerHTML = "";
   _ui.proteinTable.appendChild(t);
   enable(_ui.rawFilesInput);
   enable(_ui.idListInput);
   enable(_ui.settings);
   enable(_ui.processAll);
   hide(_ui.progressOverlay); 
  };

  var handleRowClick = function(e) {
   e.stopPropagation();
   var row = getTableRow(e.target);
   if (row.protein) {
    _ui.selectedFeature = undefined;
    _ui.selectedProtein = row.protein;
   }
   else {
    _ui.selectedFeature = row.feature;
    _ui.selectedProtein = undefined;
   }
   setSelected(row);
   checkAvailableFiles();
   checkSelected();
   if (e.type == "dblclick") {
    handleProcessClick({target:_ui.processSelected});
   }
  }
  var checkAvailableFiles = function() {
   if (_ui.selectedFeature) {
    Array.prototype.slice.call(_ui.fileTabs.childNodes).forEach(function(ele) {
     removeClass(ele,"has-rt");
     if (_ui.selectedFeature[6].indexOf(ele.fName) >= 0) addClass(ele,"has-rt");
    });
   }
  };
  var checkSelected = function() {
   if ((_ui.selectedFeature && _ui.selectedFile ) || _ui.selectedProtein) enable(_ui.processSelected);
   else if (_ui.selectedFeature) {
    var allowed = [];
    Array.prototype.slice.call(_ui.fileTabs.childNodes).forEach(function(ele) {
     if (_ui.selectedFeature[6].indexOf(ele.fName) >= 0) allowed.push(ele);
    });
    if (allowed.length == 1) {
     _ui.selectedFile = allowed[0];
     setSelected(allowed[0]);
     enable(_ui.processSelected);
    }
    else {
     disable(_ui.processSelected);
    }
   }
   else {
    disable(_ui.processSelected);
   }
  };

  //Settings Input
  _ui.settings.addEventListener('click', function() {
   if (_ui.settings.disabled) return;
   _ui.settingsDialog.contents.innerHTML = "";
   HML.settings.forEach(ele => {
    var label = document.createElement("span");
    label.appendChild(document.createTextNode(ele[1]+": "));
    var field = document.createElement("input");
    var key = ele[0];
    field.dataType = typeof(HML.config[key]);
    switch (field.dataType) {
     case "boolean" : field.type = "checkbox"; field.checked = HML.config[key]; break;
     case "string" : field.type = "text"; field.value = JSON.stringify(HML.config[key]).replace(/^"|"$/g,""); break;
     case "number" : field.type = "text"; field.value = JSON.stringify(HML.config[key]); break;
     default : throw new Error("UIUnhandledConfigKeyType ("+typeof(HML.config[key])+")");
    }
    field.name = key;
    field.triggerReCalc = ele[3];
    label.help = field.help = ele[2];
    label.addEventListener("mouseover", e => _ui.settingsDialog.help.innerHTML = e.target.help);
    field.addEventListener("mouseover", e => _ui.settingsDialog.help.innerHTML = e.target.help);
    if (field.triggerReCalc) {
     addClass(label,"clearsResults");
     field.addEventListener("change", e => {
      var node = e.target;
      var nodeValue;
      switch(node.dataType) {
       case "boolean" : nodeValue = node.checked; break;
       case "string" : nodeValue != JSON.parse('"'+node.value+'"'); break;
       case "number" : nodeValue != JSON.parse(node.value); break;
       default : throw new Error("UIUnhandledSettingsNodeType ("+node.nodeName+":"+node.type+")");
      }
      if (HML.config[node.name] != nodeValue) {
       if (!_ui.settingsDialog.updateButton.clearResults) {
        var clearWarn = document.createElement("span");
        clearWarn.appendChild(document.createTextNode(" and Clear Results"));
        addClass(clearWarn,"clearsResults");
        _ui.settingsDialog.updateButton.appendChild(clearWarn);
       }
       _ui.settingsDialog.updateButton.clearResults = true;
      }
      else {
       _ui.settingsDialog.updateButton.clearResults = false;
       _ui.settingsDialog.updateButton.innerHTML = "Save"
      }
     });
    }
    _ui.settingsDialog.contents.appendChild(label);
    _ui.settingsDialog.contents.appendChild(field);
    _ui.settingsDialog.contents.appendChild(document.createElement("br"));
   });
   _ui.settingsDialog.updateButton.clearResults = false;
   _ui.settingsDialog.updateButton.innerHTML = "Save"
   show(_ui.settingsDialog);
  });

  _ui.settingsDialog.cancelButton.addEventListener('click', function() {
   hide(_ui.settingsDialog);
  });
  
  _ui.settingsDialog.updateButton.addEventListener('click', function() {
   if (!_ui.processing) {
    var reCalc = false;
    Array.prototype.slice.call(_ui.settingsDialog.contents.childNodes).forEach(node => {
     if (node.nodeName == "INPUT") {
      switch(node.dataType) {
       case "boolean" : HML.config[node.name] = node.checked; break;
       case "string" : HML.config[node.name] = JSON.parse('"'+node.value+'"'); break;
       case "number" : HML.config[node.name] = JSON.parse(node.value); break;
       default : throw new Error("UIUnhandledSettingsNodeType ("+node.nodeName+":"+node.type+")");
      }
     }
    });
    if (_ui.settingsDialog.updateButton.clearResults) {
     _ui.featuresArray.forEach(f => {f[11] = {}});
     disable(_ui.downloadProteins);
     disable(_ui.downloadPeptides);
    }
   }
   hide(_ui.settingsDialog);
  });


  //Do Processing
  var handleProcessClick = function(e) {
   if (e.target.disabled) return;
   if (!e.target.processAll && 
       (
        (_ui.selectedFile && 
        _ui.selectedFeature &&
        _ui.selectedFeature[11][_ui.selectedFile.fName] && 
        _ui.selectedFeature[11][_ui.selectedFile.fName][8]) ||
        (_ui.selectedProtein &&  
         Object.keys(_ui.featuresObject[_ui.selectedProtein]).every(peptide =>
          Object.keys(_ui.featuresObject[_ui.selectedProtein][peptide]).every(charge =>
           Object.keys(_ui.featuresObject[_ui.selectedProtein][peptide][charge]).every(modString =>
            _ui.availableFileNames.every(file => 
             _ui.featuresObject[_ui.selectedProtein][peptide][charge][modString][5] ? (
              _ui.featuresObject[_ui.selectedProtein][peptide][charge][modString][11][file]
             ) : true
            )
           )
          )
         )
        )
       )
      ) displayCanvas();
   else {
//    console.log(!e.target.processAll);
//    console.log(_ui.selectedProtein);
//    Object.keys(_ui.featuresObject[_ui.selectedProtein]).forEach(peptide => {
//     Object.keys(_ui.featuresObject[_ui.selectedProtein][peptide]).forEach(charge => {
//      Object.keys(_ui.featuresObject[_ui.selectedProtein][peptide][charge]).forEach(modString => {
//       _ui.availableFileNames.forEach(file => {
//        console.log(file);
//        console.log(_ui.featuresObject[_ui.selectedProtein][peptide][charge][modString][5]);
//        console.log(!!_ui.featuresObject[_ui.selectedProtein][peptide][charge][modString][11][file]);
//       })
//      })
//     })
//    })
        
    //following is imperfect but helps ensure responsive drawing of overlay after click
    window.requestAnimationFrame(() => {MSLIB.Common.callAsync(startProcessing.bind(null,e.target.processAll))}); 
   }
  }

  _ui.processAll.addEventListener('click', handleProcessClick);
  _ui.processAll.processAll = true;
  _ui.processSelected.addEventListener('click', handleProcessClick);
  _ui.processSelected.processAll = false;

  var startProcessing = function(processAll) {
   var p = _ui.processing = {
    processAll : processAll,
    extractionCalculator : null,
    toDo : 0,
    completed : {},
    taskQueue : new HML.TaskQueue(_ui.quantWorkers),
    startTime : window.performance.now()
   };
   disable(_ui.rawFilesInput);
   disable(_ui.idListInput);
   disable(_ui.settings);
   disable(_ui.processAll);
   disable(_ui.processSelected);
   disable(_ui.downloadProteins);
   disable(_ui.downloadPeptides);
   show(_ui.progressOverlay);
   setProgressBar("Initialising...");
   var features = (processAll ? 
                   _ui.featuresArray :
                   (_ui.selectedFeature ? 
                    [_ui.selectedFeature] :
                    (
                     Array.prototype.concat.apply([],
                      Object.keys(_ui.featuresObject[_ui.selectedProtein]).map(peptide =>
                       Array.prototype.concat.apply([],
                        Object.keys(_ui.featuresObject[_ui.selectedProtein][peptide]).map(charge =>
                         Object.keys(_ui.featuresObject[_ui.selectedProtein][peptide][charge]).map(modString =>
                          _ui.featuresObject[_ui.selectedProtein][peptide][charge][modString][5] ?
                          _ui.featuresObject[_ui.selectedProtein][peptide][charge][modString] :
                          null
                         )
                        )
                       )
                      )
                     ).filter(f => f !== null)
                    )
                   )
                  );
   var fileQRs = {};
   _ui.availableFileNames.forEach(fn => {fileQRs[fn] = []});
   var usesRemaining = Array(features.length);
   features.forEach((f,i) => {
    f[11]={};
    var Filelist = ((!p.processAll && _ui.selectedFeature) ?
                    [_ui.selectedFile.fName] : 
                    _ui.availableFileNames
                   );
    usesRemaining[i] = Filelist.length;
    Filelist.forEach(fn => {
     var quantRequest = new HML.QuantRequest();
     quantRequest.protein             = f[0]; 
     quantRequest.peptide             = f[3]; 
     quantRequest.charge              = f[10];
     quantRequest.modString           = f[9]; 
     quantRequest.fileName            = fn;   
     quantRequest.ms1RT               = getFeatureRT(f,fn);
     quantRequest.scanRange           = Array(2);
     quantRequest.extractionCalcIndex = i;
     fileQRs[fn].push(quantRequest.toArray());
    });
    p.toDo+=Filelist.length;
   });
   p.extractionCalculator = new HML.ExtractionCalculator(
    features.map((f) => [
     f[3], //peptide,      //0
     f[10],//charge,       //1
     f[9]  //modString,    //2
    ]),
    usesRemaining
   );
   _ui.availableFileNames.forEach(fn => {
    p.completed[fn] = 0;
    if (fileQRs[fn].length) _ui.files[fn].prepareQuantTasks(fileQRs[fn]);
   });
   console.log("Started processing features ("+ _ui.availableFileNames.map(fn => fn+":"+fileQRs[fn].length).join(", ")+")");
   fileQRs = null;
   monitorProcessing();
  };

  var monitorProcessing = function() {
   var p = _ui.processing;
   var done = _ui.availableFileNames.reduce((a,b) => (a+(p.completed[b] || 0)),0);
   if (done < p.toDo) {
    var proportionDone = done/p.toDo;
    setProgressBar(proportionDone*100);
    var timeElapsed = (((window.performance.now()-p.startTime))/60000);
    setProgressInfo([
     "Quant Threads In Use : "+_ui.quantWorkers.reduce((a,b) => a+!b.worker.ready,0)+"/"+_ui.quantWorkers.length,
     "Quant Tasks Queued : "+p.taskQueue.length,
     "File Threads Paused : "+p.taskQueue.limbo.length,
     "Time Elapsed (min) : "+ Math.floor(timeElapsed),
     "Estimated Time Remaining (min) : "+(done ? Math.ceil((timeElapsed/proportionDone)*(1-proportionDone)) : "Calculating...")
    ].join("<br>"));
    window.setTimeout(monitorProcessing, UI_UPDATE_INTERVAL);
   }
   else {
    hide(_ui.progressOverlay);
    setProgressInfo("");
    if (!p.processAll) displayCanvas();
    enable(_ui.rawFilesInput);
    enable(_ui.idListInput);
    enable(_ui.settings);
    enable(_ui.processAll);
    enable(_ui.processSelected);
    enable(_ui.downloadPeptides);
    enable(_ui.downloadProteins);
    console.log("Processing completed in "+Math.ceil(window.performance.now()-p.startTime)+" ms");
    delete(_ui.processing);
   }
  };
 
  var displayCanvas = function() {
   _ui.canvas.clear();
   var labels = HML.config.labelledPeptidesOnly ? ["labelled"] : ["unlabelled","labelled"];
   if (_ui.selectedProtein) { //protein display
    var proteinQuant = new HML.QuantifiedProtein(_ui.featuresObject[_ui.selectedProtein],_ui.availableFileNames)
    var title = new HML.Plot.title(_ui.selectedProtein);
    title.left += 580;
    _ui.canvas.add(title)
    if (!HML.config.labelledPeptidesOnly) {
     var filesRatioGraph = new HML.Plot.ProteinRatio(proteinQuant,_ui.availableFileNames);
     _ui.canvas.add(filesRatioGraph);
    }
    var filesIncorpGraph = new HML.Plot.ProteinIncorp(proteinQuant,_ui.availableFileNames);
    if (!HML.config.labelledPeptidesOnly) filesIncorpGraph.left +=580;
    _ui.canvas.add(filesIncorpGraph);
   }
   else { //peptide display
    var ms1Feature = _ui.selectedFeature[11][_ui.selectedFile.fName];
    var title = new HML.Plot.title(_ui.selectedFeature[3]+" "+(_ui.selectedFeature[9].length > 0 ? _ui.selectedFeature[9] : "(unmodified)")+", "+_ui.selectedFeature[10]+"+");
    title.left += 480;
    _ui.canvas.add(title)
    if (!HML.config.labelledPeptidesOnly) {
     var abuGraph = new HML.Plot.MS1FeatureRelAbundance(ms1Feature,labels);
     abuGraph.top += 40;
     abuGraph.left += 40;
     _ui.canvas.add(abuGraph);
    }
    var idrts = (_ui.selectedFeature[6].indexOf(_ui.selectedFile.fName) >= 0 
                ? _ui.selectedFeature[8][_ui.selectedFeature[6].indexOf(_ui.selectedFile.fName)] 
                : null);
    var chromGraph = new HML.Plot.MS1FeatureChromatogram(ms1Feature,labels,idrts);
    chromGraph.top += 40;
    chromGraph.left += (HML.config.labelledPeptidesOnly ? 40 : 480);
    _ui.canvas.add(chromGraph);
    labels.forEach(function(label,label_i) {
     if (ms1Feature[label_i*4]) {
      var specGraph = new HML.Plot.MS1FeatureSpectrum(ms1Feature,label,label_i);
      specGraph.top  += 400;
      specGraph.left += 40+(label_i*440);
      _ui.canvas.add(specGraph);
     }
    });
   }
   show(_ui.graphicsOverlay);
  }

  _ui.graphicsOverlay.closeButton.addEventListener('click', function() {
   hide(_ui.graphicsOverlay);
  });

  var createDownload = function(name, dURL) {
   this.href = dURL;
   this.download = name;
  };

  var downloadPeptides = function(e) {
   if (e.target.disabled) return;
   show(_ui.progressOverlay);
   setProgressBar(0);
   var labels = HML.config.labelledPeptidesOnly ? ["labelled"] : ["unlabelled","labelled"];
   var stepSize = (ss => isNaN(ss) ? 1 : (ss <= 0 ? 1 : ss))(parseFloat(HML.config._incorpStepSize));
   var precision = [0,(a => (a[1] || []).length - parseInt(a[2] || 0))(stepSize.toString().split(/[.e]/)),2,6];
   if (!HML.config.labelledPeptidesOnly) precision = precision.concat(precision);
   var rows = [["PROTEIN","PEPTIDE","CONTRIBUTE_TO_PROTEIN","CHARGE","MODIFICATIONS"].concat(Array.prototype.concat.apply([],_ui.availableFileNames.map(fName => Array.prototype.concat.apply([],labels.map(label => ["_INTENSITY_","_INCORP_","_RT_","_SCORE_"].map(field => fName+field+label)))))).join("\t")];
   rows = Array.prototype.concat.apply(rows,Object.keys(_ui.featuresObject).sort().map((protein,i,prot_arr) => {
    setProgressBar(i/(prot_arr.length-1)*100);
    return Array.prototype.concat.apply([],Object.keys(_ui.featuresObject[protein]).sort().map(peptide =>
     Array.prototype.concat.apply([],Object.keys(_ui.featuresObject[protein][peptide]).sort().map(charge =>
      Array.prototype.concat.apply([],Object.keys(_ui.featuresObject[protein][peptide][charge]).sort().map(modString =>
       [protein,
        peptide,
        _ui.featuresObject[protein][peptide][charge][modString][5], //contrib to protein
        charge,
        modString
       ].concat(Array.prototype.concat.apply([],_ui.availableFileNames.map(fName => {
        if (_ui.featuresObject[protein][peptide][charge][modString][11] && _ui.featuresObject[protein][peptide][charge][modString][11][fName]) return _ui.featuresObject[protein][peptide][charge][modString][11][fName].slice(0,labels.length*4).map((n,i)=>isNaN(n) ? "NA" : (+n).toFixed(precision[i]));
        else return Array(precision.length).fill("");
       }))).join("\t")
      ))
     ))
    ))
   }));
   hide(_ui.progressOverlay);
//   console.log(rows);
   createDownload.call(e.target,"HML_peptides.tsv",URL.createObjectURL(new Blob([rows.join("\n")], {type: "text/tab-separated-values"})));
  }
  _ui.downloadPeptides.addEventListener('click', downloadPeptides);

  var downloadProteins = function(e) {
   if (e.target.disabled) return;
   show(_ui.progressOverlay);
   setProgressBar(0);
   var rows = [["PROTEIN","PROTEIN_DESCRIPTION"].concat(Array.prototype.concat.apply([],
    HML.config.labelledPeptidesOnly ?
    _ui.availableFileNames.map(fName => [fName+"_INCORP",fName+"_INCORP_MAD"]) :
    _ui.availableFileNames.map(fName => [fName+"_RATIO",fName+"_RATIO_MAD",fName+"_INCORP",fName+"_INCORP_MAD"])
   )).join("\t")];
   rows = Array.prototype.concat.apply(rows,Object.keys(_ui.featuresObject).sort().map((protein,i,prot_arr) => {
    setProgressBar(i/(prot_arr.length-1)*100);
    var description = "";
    Object.keys(_ui.featuresObject[protein]).some(peptide => 
     Object.keys(_ui.featuresObject[protein][peptide]).some(charge => 
      Object.keys(_ui.featuresObject[protein][peptide][charge]).some(modString => {
       description = _ui.featuresObject[protein][peptide][charge][modString][1]
       return true;
      })
     )
    );
    var proteinQuant = new HML.QuantifiedProtein(_ui.featuresObject[protein],_ui.availableFileNames);
    return Array.prototype.concat.apply([],[
     protein,
     description,
     (HML.config.labelledPeptidesOnly ?
      Array.prototype.concat.apply([],_ui.availableFileNames.map(fName => [
       proteinQuant[fName].incorpMedians[0],
       proteinQuant[fName].incorpMADs[0]
      ])) :
      Array.prototype.concat.apply([],_ui.availableFileNames.map(fName => [
       proteinQuant[fName].ratioMedian,
       proteinQuant[fName].ratioMAD,
       proteinQuant[fName].incorpMedians[1]
       ,proteinQuant[fName].incorpMADs[1]
      ]))
     ).map(ele => ele !== null ? ele : "NA") 
    ]).join("\t");
   }));
   hide(_ui.progressOverlay);
   createDownload.call(e.target,"HML_proteins.tsv",URL.createObjectURL(new Blob([rows.join("\n")], {type: "text/tab-separated-values"})));
  }
  _ui.downloadProteins.addEventListener('click', downloadProteins); 

  var saveAsPNG = function(e) {
   if (e.target.disabled) return;
   createDownload.call(e.target,"figure.png",_ui.canvas.toDataURL({format: 'png', multiplier: 2}));
  }
  _ui.saveAsPNG.addEventListener('click', saveAsPNG);

  var saveAsSVG = function(e) {
   if (e.target.disabled) return;
   createDownload.call(e.target,"figure.svg",URL.createObjectURL(new Blob([_ui.canvas.toSVG()], {type: "image/svg+xml;charset=utf-8"})));
  }
  _ui.saveAsSVG.addEventListener('click', saveAsSVG);
 
  return _ui;

 }();

});