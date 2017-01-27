"use strict";

if (typeof HML == 'undefined') var HML = {};

document.addEventListener( "DOMContentLoaded", function() {

 HML.Interface = function() {

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

  var Interface = {};

  const UI_UPDATE_INTERVAL = 1000;
  const PRECISION = [0,0,2,6,0,0,2,6];
  const LABELS = ["unlabelled","labelled"];

  //Element bindings
  Interface.RawFilesInput = document.getElementById("input-raw-files");
  Interface.FileTabs = document.getElementById("file-tab-list");
  Interface.IdListInput = document.getElementById("input-identifications");
  Interface.ProteinTable = document.getElementById("results-table-container");
  Interface.Settings = document.getElementById("input-settings");
  Interface.SettingsDialog = document.getElementById("settings-pane-overlay");
  Interface.SettingsDialogContents = document.getElementById("settings-contents");
  Interface.SettingsDialogCancel = document.getElementById("settings-cancel");
  Interface.SettingsDialogUpdate = document.getElementById("settings-update");
  Interface.ProcessAll = document.getElementById("process-all");
  Interface.ProcessSelected = document.getElementById("process-selected");
  Interface.DownloadProteins = document.getElementById("download-proteins");
  Interface.DownloadPeptides = document.getElementById("download-peptides");
  Interface.DownloadPeptides = document.getElementById("download-peptides");
  Interface.SaveAsPNG = document.getElementById("save-as-png");
  Interface.SaveAsSVG = document.getElementById("save-as-svg");
  Interface.ProgressOverlay = document.getElementById("progress-pane-overlay");
  Interface.ProgressOverlay.ProgressBar = document.getElementById("progress-bar");
  Interface.ProgressOverlay.ProgressInfo = document.getElementById("progress-info");
  Interface.GraphicsOverlay = document.getElementById("graphics-pane-overlay");
  Interface.GraphicsOverlayClose = document.getElementById("graphics-close");
  Interface.Canvas = new fabric.Canvas('graphics-canvas',{hoverCursor: 'pointer',backgroundColor: 'rgb(255,255,255)'});

  //Other variables
  Interface.Files = {};
  Interface.AvailableFileNames = [];
  Interface.FeaturesObject = {};
  Interface.FeaturesArray = [];
  Interface.SelectedFile = undefined;
  Interface.SelectedFeature = undefined;
  Interface.QuantWorkers = [];
  for (var i = 0; i < HML.Config._QuantitationThreads; i++) {
   Interface.QuantWorkers[i] = new HML.QuantitationWorker();
  }

  //Interface helper functions
  var removeClass = function(node,cN) {
   node.className = node.className.replace(new RegExp("(?:^|\\s)"+cN+"(?!\\S)","g"),"");
  }
  var addClass = function(node,cN) {
   removeClass(node,cN);
   node.className +=(" "+cN);
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
   var scope = (el.nodeName.toLowerCase() == "tr" ? Interface.ProteinTable : Interface.FileTabs);
   Array.prototype.slice.call(scope.getElementsByClassName("selected")).forEach(function(node) {
    removeClass(node,"selected");
   });
   addClass(el,"selected");
  };

  Interface.shortFileName = function(FileName) {
   return FileName.replace(/\.(?:raw|mzML|mzXML)$/,"")
  }

  //Initial state
  enable(Interface.RawFilesInput);
  disable(Interface.IdListInput);
  disable(Interface.Settings);
  disable(Interface.ProcessAll);
  disable(Interface.ProcessSelected);
  disable(Interface.DownloadProteins);
  disable(Interface.DownloadPeptides);

  var resizeCanvas = function() {
   Interface.Canvas.setHeight(Interface.Canvas.wrapperEl.parentElement.offsetHeight);
   Interface.Canvas.setWidth(Interface.Canvas.wrapperEl.parentElement.offsetWidth);
   Interface.Canvas.renderAll();
   Interface.Canvas.calcOffset();
  };
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas, false);

  window.onbeforeunload = function() { return "Are you sure you wish to navigate away?  All progress will be lost." };

  var setProgressBar = function(p) {
   if (isNaN(p)) {
    Interface.ProgressOverlay.ProgressBar.style.background = "lightblue";
    Interface.ProgressOverlay.ProgressBar.innerHTML = p;
   }
   else {
    Interface.ProgressOverlay.ProgressBar.style.background = "linear-gradient(90deg, lightblue "+p+"%, lightgrey 1%, lightgrey "+(100-p-1)+"%)";
    Interface.ProgressOverlay.ProgressBar.innerHTML = p.toFixed(2)+"%";
   }
  };
 
  var setProgressInfo = function(i) {
   Interface.ProgressOverlay.ProgressInfo.innerHTML = i;
  }

  //Raw Files Input
  Interface.RawFilesInput.addEventListener('click', function() {
   if (Interface.RawFilesInput.disabled) return;
   Interface.RawFilesInput.FileSelect = document.createElement('input');
   Interface.RawFilesInput.FileSelect.type = "file";
   Interface.RawFilesInput.FileSelect.accept = ".mzML,.mzXML,.raw";
   Interface.RawFilesInput.FileSelect.multiple = true;
   Interface.RawFilesInput.FileSelect.addEventListener('change', function(e) { window.setTimeout(loadFiles, 4) });
   Interface.RawFilesInput.FileSelect.click();
  });

  var loadFiles = function() {
   disable(Interface.RawFilesInput);
   disable(Interface.IdListInput);
   disable(Interface.Settings);
   disable(Interface.ProcessAll);
   disable(Interface.ProcessSelected);
   disable(Interface.DownloadProteins);
   disable(Interface.DownloadPeptides);
   Interface.FileTabs.innerHTML = "";
   Interface.ProteinTable.innerHTML = "";
   Interface.SelectedFile = undefined;
   Interface.SelectedFeature = undefined;
   Interface.AvailableFileNames.forEach((fn) => {
    Interface.Files[fn].Worker.terminate();
    delete(Interface.Files[fn].Worker);
    delete(Interface.Files[fn]);
   });
   Interface.Files = {};
   Interface.AvailableFileNames = [];
   Interface.FeaturesObject = {};
   Interface.FeaturesArray = [];
   if (Interface.RawFilesInput.FileSelect.files.length) {
    for (var i = 0, f; f = Interface.RawFilesInput.FileSelect.files[i]; i++) {
     var tab = document.createElement('a');
     tab.appendChild(document.createTextNode(f.name));
     tab.fname = Interface.shortFileName(f.name);
     Interface.Files[tab.fname] = new HML.MsDataFileWorker(f);
     tab.addEventListener('click', function(e) {
      var tab = e.target;
      if (Interface.Files[tab.fname].Worker.Ready) {
       Interface.SelectedFile = tab;
       setSelected(tab);
       checkSelected();
      }
      e.stopPropagation();
     });
     Interface.FileTabs.appendChild(tab);
     monitorIndexing(tab);
    }
    Interface.AvailableFileNames = Object.keys(Interface.Files).sort();
    enable(Interface.IdListInput);
    waitForIndexingComplete();
   }
  };

  //File processing progress
  var monitorIndexing = function(tab) {
   var file = Interface.Files[tab.fname];
   if (file.Worker.Ready) {
    tab.removeAttribute("style");
    addClass(tab,"ready");
   }
   else {
    var p = Math.round(file.Worker.Progress);
    tab.style.background = "linear-gradient(90deg, lightgreen "+p+"%, pink 1%, pink "+(100-p-1)+"%)";
    window.setTimeout(monitorIndexing, UI_UPDATE_INTERVAL, tab);
   }
  };
  var waitForIndexingComplete = function() {
   if (!Interface.IdListInput.disabled) {
    if (Interface.AvailableFileNames.every(fn => Interface.Files[fn].Worker.Ready)) {
     MSLIB.Common.callAsync(() => {
      enable(Interface.RawFilesInput);
      if (Interface.FileTabs.childNodes.length == 1) Interface.FileTabs.childNodes[0].click();
     });
    }
    else window.setTimeout(waitForIndexingComplete, UI_UPDATE_INTERVAL);
   }
  };

  //ID List Input  
  Interface.IdListInput.addEventListener('click', function() {
   if (Interface.IdListInput.disabled) return;
   Interface.IdListInput.FileSelect = document.createElement('input');
   Interface.IdListInput.FileSelect.type = "file";
   Interface.IdListInput.FileSelect.accept = ".csv,.tsv,.txt";
   Interface.IdListInput.FileSelect.addEventListener('change', function(e) { window.setTimeout(loadIds, 4) });
   Interface.IdListInput.FileSelect.click();
  });

  var loadIds = function() {
   if (Interface.IdListInput.FileSelect.files.length) {
    disable(Interface.RawFilesInput);
    disable(Interface.IdListInput);
    disable(Interface.Settings);
    disable(Interface.ProcessAll);
    disable(Interface.ProcessSelected);
    disable(Interface.DownloadProteins);
    disable(Interface.DownloadPeptides);
    Interface.IdListInput.Ready = false;
    Interface.ProteinTable.innerHTML = "";
    Interface.SelectedFeature = undefined;
    Interface.FeaturesObject = {};
    Interface.FeaturesArray = [];
    Interface.IdFile = new MSLIB.Format.TextTableFile(Interface.IdListInput.FileSelect.files[0]);
    Interface.IdFile.UseFirstLineAsHeaders = true;
    Interface.IdFile.load();
    window.setTimeout(function waitForIdFileReady() {
     if (Interface.IdFile.Ready) {
      var H = Interface.IdFile.HeaderIndices = {      
       protein       : Interface.IdFile.Headers.indexOf("PROTEIN"),
       description   : Interface.IdFile.Headers.indexOf("PROTEIN_DESCRIPTION"),
       proteinscore  : Interface.IdFile.Headers.indexOf("PROTEIN_SCORE"),
       peptide       : Interface.IdFile.Headers.indexOf("PEPTIDE_SEQUENCE"),
       peptidescore  : Interface.IdFile.Headers.indexOf("PEPTIDE_SCORE"),
       unique        : Interface.IdFile.Headers.indexOf("IS_UNIQUE"),
       fname         : Interface.IdFile.Headers.indexOf("FILE_NAME"),
       allfiles      : Interface.IdFile.Headers.indexOf("QUANTIFY_ALL_RUNS"),
       scan          : Interface.IdFile.Headers.indexOf("SCAN_NUMBER"),
       rt            : Interface.IdFile.Headers.indexOf("RETENTION_TIME"),
       modifications : Interface.IdFile.Headers.indexOf("MODIFICATIONS"),
       charge        : Interface.IdFile.Headers.indexOf("CHARGE")
      }
      if ((H.protein < 0) || (H.peptide < 0) || (H.fname < 0) || ((H.scan < 0) && (H.rt < 0)) || (H.charge < 0)) {
       throw new Error("InterfaceFailedToParseIds");
      }
      else {
       Interface.IdFile.RawFilesNotFound = {};
       Interface.IdFile.CurrentLine = 0;
       Interface.ProteinTable.innerHTML = "<p>Waiting for raw file indexing to finish...</p>";
       window.setTimeout(function waitForIndexingComplete() {
        if (Interface.AvailableFileNames.every(fn => Interface.Files[fn].Worker.Ready)) {
         Interface.ProteinTable.innerHTML = "<p>Loading identifications...</p>";
         show(Interface.ProgressOverlay);
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
   var L = Interface.IdFile.Lines[Interface.IdFile.CurrentLine];
   var H = Interface.IdFile.HeaderIndices;
   var protein = L[H.protein];
   if (protein) {
    var peptide = L[H.peptide].replace(/^[\w-]?\.|\.[\w-]$/g,"");
    if (peptide) {
     var fname = L[H.fname].replace(/\.(?:raw|mzML|mzXML)$/,"");
     if (fname) {
      if (fname && (Interface.AvailableFileNames.indexOf(fname) < 0)) {
       Interface.IdFile.RawFilesNotFound[fname] = true;
       nextLine();
      }
      else {
       var description = H.description >= 0 ? L[H.description] : "";
       var proteinscore = H.proteinscore >= 0 ? L[H.proteinscore] : "";
       var peptidescore = H.peptidescore >= 0 ? L[H.peptidescore] : "";
       var unique = L[H.unique].match(/t|true|y|yes|1|u|unique/i) ? true : false;
       var allfiles = L[H.allfiles].match(/t|true|y|yes|1|all/i) ? true : false;
       var scan = H.scan >= 0 ? L[H.scan] : null;
       var modstring = H.modifications >= 0 ? L[H.modifications] : "";
       var charge = L[H.charge];
       charge = parseInt(charge.toString().replace(/\+$/,"")); //remove trailing +
       if (H.rt >= 0) Interface.Files[fname].callFunc("getNearestMSXRTfromRT",[1,+L[H.rt],true]);
       else Interface.Files[fname].callFunc("getNearestMSXRTfromScanNumber",[1,+scan,true]);
       MSLIB.Common.whenReady(Interface.Files[fname].Worker,() => {
        var ms1rt = Interface.Files[fname].FuncResponse;
        if (H.rt >= 0) Interface.Files[fname].callFunc("getNearestMSXRTfromRT",[2,+L[H.rt]]);
        else Interface.Files[fname].callFunc("getNearestMSXRTfromScanNumber",[2,+scan]);
        MSLIB.Common.whenReady(Interface.Files[fname].Worker,() => {
         var idrt = Interface.Files[fname].FuncResponse;
         if (idrt == null) idrt = ms1rt;
         if (!Interface.FeaturesObject[protein]) Interface.FeaturesObject[protein] = {}; 
         if (!Interface.FeaturesObject[protein][peptide]) Interface.FeaturesObject[protein][peptide] = {};
         if (!Interface.FeaturesObject[protein][peptide][charge]) Interface.FeaturesObject[protein][peptide][charge] = {};
         if (!Interface.FeaturesObject[protein][peptide][charge][modstring]) {
          var featureData = [ //Will eventually hold quant as well
           protein,      //0
           description,  //1
           proteinscore, //2
           peptide,      //3
           peptidescore, //4
           unique,       //5
           [fname],      //6
           [[ms1rt]],    //7
           [[idrt]],     //8
           modstring,    //9
           charge,       //10
           allfiles,     //11
           {}            //12
          ]
          Interface.FeaturesObject[protein][peptide][charge][modstring] = featureData;
          Interface.FeaturesArray.push(featureData);
         }
         else {
          var feature = Interface.FeaturesObject[protein][peptide][charge][modstring];
          var fnidx = feature[6].indexOf(fname);
          if (fnidx < 0) {
           feature[6].push(fname);
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
   if(++Interface.IdFile.CurrentLine < Interface.IdFile.Lines.length) {
    MSLIB.Common.callAsync(processIdListLine);
   }
   else {
    Interface.FeaturesArray.forEach(F => {
     F[7] = F[7].map(MS1RTarr => MS1RTarr.reduce((a,b) => (a+b))/MS1RTarr.length);
     F[7].push(F[7].reduce((a,b) => (a+b))/F[7].length);
    });
    if (Object.keys(Interface.IdFile.RawFilesNotFound).length) console.log("Warning: files not found - "+Object.keys(Interface.IdFile.RawFilesNotFound).join(";"));
    Interface.IdFile = null;
    delete(Interface.IdFile);
    updateProteinTable();
   }
  }

  var monitorIDLoading = function() {
   if (Interface.IdFile) {
    setProgressBar((Interface.IdFile.CurrentLine/Interface.IdFile.Lines.length)*99);
    window.setTimeout(monitorIDLoading, UI_UPDATE_INTERVAL);
   }
  };

  var getFeatureRT = function(F,fn) {
   var MS1RTindex = F[6].indexOf(fn);
   if (MS1RTindex >= 0) return F[7][MS1RTindex];
   else return F[7][F[7].length-1]; 
  }

  //Update Protein Table
  var updateProteinTable = function() {
   Interface.ProteinTable.innerHTML = "<p>Rebuilding table...</p>";
   var t = document.createElement('table');
   var thead = t.createTHead();
   var theadrow = thead.insertRow(-1);
   ["Protein","Description","ProteinScore","Peptide","PeptideScore","Charge","Modifications"].forEach(function(h) {
    var theadcell = theadrow.insertCell(-1);
    theadcell.appendChild(document.createTextNode(h));
   });
   var tbody = t.createTBody();
   Object.keys(Interface.FeaturesObject).sort().forEach(function(protein) {
    Object.keys(Interface.FeaturesObject[protein]).sort().forEach(function(peptide) {
     Object.keys(Interface.FeaturesObject[protein][peptide]).sort().forEach(function(charge) {
      Object.keys(Interface.FeaturesObject[protein][peptide][charge]).sort().forEach(function(modstring) {
       var feature = Interface.FeaturesObject[protein][peptide][charge][modstring];
       var tbodyrow = tbody.insertRow(-1);
       var protcell = tbodyrow.insertCell(-1);
       protcell.appendChild(document.createTextNode(protein));
       var desccell = tbodyrow.insertCell(-1);
       desccell.appendChild(document.createTextNode(feature[1]));
       var protscorecell = tbodyrow.insertCell(-1);
       protscorecell.appendChild(document.createTextNode(feature[2]));
       var peptidecell = tbodyrow.insertCell(-1);
       peptidecell.appendChild(document.createTextNode(peptide));
       var peptidescorecell = tbodyrow.insertCell(-1);
       peptidescorecell.appendChild(document.createTextNode(feature[4]));
       var chargecell = tbodyrow.insertCell(-1);
       chargecell.appendChild(document.createTextNode(charge));
       var modificationcell = tbodyrow.insertCell(-1);
       modificationcell.appendChild(document.createTextNode(modstring));
       tbodyrow.feature = feature;
       tbodyrow.addEventListener('click', function(e) {
        e.stopPropagation();
        var tbodyrow = e.target;
        while (tbodyrow.nodeName.toLowerCase() != "tr") {
         if (tbodyrow.parentNode.nodeName.toLowerCase() == "table") break;
         tbodyrow = tbodyrow.parentNode;
        }
        Interface.SelectedFeature = tbodyrow.feature;
        setSelected(tbodyrow);
        checkAvailableFiles();
        checkSelected();
        e.stopPropagation();
       });
      });
     });
    });
   });
   Interface.ProteinTable.innerHTML = "";
   Interface.ProteinTable.appendChild(t);
   enable(Interface.RawFilesInput);
   enable(Interface.IdListInput);
   enable(Interface.Settings);
   enable(Interface.ProcessAll);
   hide(Interface.ProgressOverlay); 
  };

  var checkAvailableFiles = function() {
   if (Interface.SelectedFeature) {
    Array.prototype.slice.call(Interface.FileTabs.childNodes).forEach(function(ele) {
     removeClass(ele,"has-rt");
     if (Interface.SelectedFeature[6].indexOf(ele.fname) >= 0) addClass(ele,"has-rt");
    });
   }
  };
  var checkSelected = function() {
   if (Interface.SelectedFeature && Interface.SelectedFile) enable(Interface.ProcessSelected);
   else if (Interface.SelectedFeature) {
    var allowed = [];
    Array.prototype.slice.call(Interface.FileTabs.childNodes).forEach(function(ele) {
     if (Interface.SelectedFeature[6].indexOf(ele.fname) >= 0) allowed.push(ele);
    });
    if (allowed.length == 1) {
     Interface.SelectedFile = allowed[0];
     setSelected(allowed[0]);
     enable(Interface.ProcessSelected);
    }
    else {
     disable(Interface.ProcessSelected);
    }
   }
   else {
    disable(Interface.ProcessSelected);
   }
  };

  //Settings Input
  Interface.Settings.addEventListener('click', function() {
   if (Interface.Settings.disabled) return;
   Interface.SettingsDialogContents.innerHTML = "";
   Object.keys(HML.Config).sort().forEach(function(key) {
    if (!key.startsWith("_")) {
     var label = document.createTextNode(key+": ");
     var field = document.createElement("input");
     switch (typeof(HML.Config[key])) {
      case "boolean" : field.type = "checkbox"; field.checked = HML.Config[key]; break;
      case "text" : field.type = "text"; field.value = JSON.stringify(HML.Config[key]); break;
      default : throw new Error("InterfaceUnhandledConfigKeyType ("+typeof(HML.Config[key])+")");
     }
     field.name = key;
     Interface.SettingsDialogContents.appendChild(label);
     Interface.SettingsDialogContents.appendChild(field);
     Interface.SettingsDialogContents.appendChild(document.createElement("br"));
    }
   });
   show(Interface.SettingsDialog);
  });

  Interface.SettingsDialogCancel.addEventListener('click', function() {
   hide(Interface.SettingsDialog);
  });
  
  Interface.SettingsDialogUpdate.addEventListener('click', function() {
   if (!Interface.Processing) {
    Array.prototype.slice.call(Interface.SettingsDialogContents.childNodes).forEach(function(node) {
     switch(node.type) {
      case "checkbox" : HML.Config[node.name] = node.checked; break;
      case "text" : HML.Config[node.name] = JSON.parse(node.value); break;
      default : throw new Error("InterfaceUnhandledSettingsNodeType ("+node.type+")");
     }
    });
    Interface.FeaturesArray.forEach(f => {f[12] = {}});
    disable(Interface.DownloadProteins);
    disable(Interface.DownloadPeptides);
   }
   hide(Interface.SettingsDialog);
  });

  //Do Processing
  var handleProcessClick = function(e) {
   if (e.target.disabled) return;
   if (
       e.target.SelectedOnly && 
       Interface.SelectedFile && 
       Interface.SelectedFeature &&
       Interface.SelectedFeature[12][Interface.SelectedFile.fname] && 
       Interface.SelectedFeature[12][Interface.SelectedFile.fname][1]
      ) displayCanvas();
   else {
    //following is imperfect but helps ensure responsive drawing of overlay after click
    window.requestAnimationFrame(() => {MSLIB.Common.callAsync(startProcessing.bind(null,e.target.SelectedOnly))}); 
   }
  }
  Interface.ProcessAll.addEventListener('click', handleProcessClick);
  Interface.ProcessAll.SelectedOnly = false;
  Interface.ProcessSelected.addEventListener('click', handleProcessClick);
  Interface.ProcessSelected.SelectedOnly = true;

  var startProcessing = function(SelectedOnly) {
   var P = Interface.Processing = {
    SelectedOnly : SelectedOnly,
    ExtractionCalculator : null,
    ToDo : 0,
    Completed : {},
    TaskQueue : new HML.TaskQueue(),
    StartTime : window.performance.now()
   };
   disable(Interface.RawFilesInput);
   disable(Interface.IdListInput);
   disable(Interface.Settings);
   disable(Interface.ProcessAll);
   disable(Interface.ProcessSelected);
   disable(Interface.DownloadProteins);
   disable(Interface.DownloadPeptides);
   show(Interface.ProgressOverlay);
   if (P.SelectedOnly) setProgressBar("Generating Graphics...");
   else setProgressBar("Preparing...");
   var Features = (P.SelectedOnly ? [Interface.SelectedFeature] : Interface.FeaturesArray);
   var FileQRs = {};
   Interface.AvailableFileNames.forEach(fn => {FileQRs[fn] = []});
   var UsesRemaining = Array(Features.length);
   Features.forEach((F,i) => {
    F[12]={};
    var Filelist = P.SelectedOnly ?
                   [Interface.SelectedFile.fname] : 
                   F[12] ? 
                    Interface.AvailableFileNames : 
                    F[6];
    UsesRemaining[i] = Filelist.length;
    Filelist.forEach(fn => {
     var quantRequest = [ 
      F[0], //protein,           //0
      F[3], //peptide,           //1
      F[10],//charge,            //2
      F[9], //modstring,         //3
      fn,   //filename           //4
      getFeatureRT(F,fn),//MS1RT //5
      Array(2),//StartScan,EndScan //6
      i     //ExtractionCalculator index //7
     ] 
     FileQRs[fn].push(quantRequest);
    });
    P.ToDo+=Filelist.length;
   });
   P.ExtractionCalculator = new HML.ExtractionCalculator(
    Features.map((F) => [
     F[3], //peptide,      //0
     F[10],//charge,       //1
     F[9] //modstring,    //2
    ]),
    UsesRemaining
   );
   Interface.AvailableFileNames.forEach(fn => {
    P.Completed[fn] = 0;
    if (FileQRs[fn].length) Interface.Files[fn].quantify(FileQRs[fn]);
   });
   console.log("Started processing features ("+ Interface.AvailableFileNames.map(fn => fn+":"+FileQRs[fn].length).join(", ")+")");
   FileQRs = null;
   monitorProcessing();
  };

  var monitorProcessing = function() {
   var P = Interface.Processing;
   var Done = Interface.AvailableFileNames.reduce((a,b) => (a+(P.Completed[b] || 0)),0);
   if (Done < P.ToDo) {
    if (!P.SelectedOnly && Done) {
     var ProportionDone = Done/P.ToDo;
     setProgressBar(ProportionDone*100);
     var TimeElapsed = (((window.performance.now()-P.StartTime))/60000);
     setProgressInfo([
      "Quant Threads In Use : "+Interface.QuantWorkers.reduce((a,b) => a+!b.Worker.Ready,0)+"/"+HML.Interface.QuantWorkers.length,
      "Quant Tasks Queued : "+P.TaskQueue.length,
      "File Threads Paused : "+P.TaskQueue.Limbo.length,
      "Time Elapsed (min) : "+ Math.floor(TimeElapsed),
      "Estimated Time Remaining (min) : "+Math.ceil((TimeElapsed/ProportionDone)*(1-ProportionDone))
     ].join("<br>"));
    }
    window.setTimeout(monitorProcessing, UI_UPDATE_INTERVAL);
   }
   else {
    hide(Interface.ProgressOverlay);
    setProgressInfo("");
    if (P.SelectedOnly) displayCanvas();
//    enable(Interface.DownloadProteins);
    enable(Interface.RawFilesInput);
    enable(Interface.IdListInput);
    enable(Interface.Settings);
    enable(Interface.ProcessAll);
    enable(Interface.ProcessSelected);
    enable(Interface.DownloadProteins);
    enable(Interface.DownloadPeptides);
    console.log("Processing completed in "+Math.ceil(window.performance.now()-P.StartTime)+" ms");
    delete(Interface.Processing);
   }
  };

  Interface.addQuantResult = function(QuantRequest,Quant,QuantExtended) {
   var Protein = QuantRequest[0];
   var Peptide = QuantRequest[1];
   var Charge = QuantRequest[2];
   var Modstring = QuantRequest[3];
   var FileName = QuantRequest[4];
   HML.Interface.FeaturesObject[Protein][Peptide][Charge][Modstring][12][FileName] = Quant;
  }
 
  var displayCanvas = function() {
   Interface.Canvas.clear();
   var MS1Feature = Interface.SelectedFeature[12][Interface.SelectedFile.fname];
   var abuGraph = new HML.Plot.MS1FeatureRelAbundance(MS1Feature,LABELS);
   abuGraph.left += 40;
   Interface.Canvas.add(abuGraph);
   var idrts = (Interface.SelectedFeature[6].indexOf(Interface.SelectedFile.fname) >= 0 
               ? Interface.SelectedFeature[8][Interface.SelectedFeature[6].indexOf(Interface.SelectedFile.fname)] 
               : null);
   var chromGraph = new HML.Plot.MS1FeatureChromatogram(MS1Feature,LABELS,idrts);
   chromGraph.left += 460;
   Interface.Canvas.add(chromGraph);
   var col = 0;
   LABELS.forEach(function(label,label_i) {
    if (MS1Feature[label_i*4]) {
     var specGraph = new HML.Plot.MS1FeatureSpectrum(MS1Feature,label,label_i);
     specGraph.top  += 360;
     specGraph.left += 40+(col*420);
     Interface.Canvas.add(specGraph);
    }
    col++;
   });
   show(Interface.GraphicsOverlay);
  }

  Interface.GraphicsOverlayClose.addEventListener('click', function() {
   hide(Interface.GraphicsOverlay);
  });

  var createDownload = function(name, dURL) {
   this.href = dURL;
   this.download = name;
  };

  var downloadPeptides = function(e) {
   if (e.target.disabled) return;
   show(Interface.ProgressOverlay);
   setProgressBar(0);
   var rows = [["PROTEIN","PEPTIDE","IS_UNIQUE","CHARGE","MODIFICATIONS"].concat(Array.prototype.concat.apply([],Interface.AvailableFileNames.map(fname => Array.prototype.concat.apply([],LABELS.map(label => ["_INTENSITY_","_INCORP_","_RT_","_SCORE_"].map(field => fname+field+label)))))).join("\t")]
   rows = Array.prototype.concat.apply(rows,Object.keys(Interface.FeaturesObject).sort().map((protein,i,prot_arr) => {
    setProgressBar(i/(prot_arr.length-1)*100);
    return Array.prototype.concat.apply([],Object.keys(Interface.FeaturesObject[protein]).sort().map(peptide =>
     Array.prototype.concat.apply([],Object.keys(Interface.FeaturesObject[protein][peptide]).sort().map(charge =>
      Array.prototype.concat.apply([],Object.keys(Interface.FeaturesObject[protein][peptide][charge]).sort().map(modstring =>
       [protein,
        peptide,
        Interface.FeaturesObject[protein][peptide][charge][modstring][5], //isunique
        charge,
        modstring
       ].concat(Array.prototype.concat.apply([],Interface.AvailableFileNames.map(fname => {
        if (Interface.FeaturesObject[protein][peptide][charge][modstring][12] && Interface.FeaturesObject[protein][peptide][charge][modstring][12][fname]) return Interface.FeaturesObject[protein][peptide][charge][modstring][12][fname].slice(0,8).map((n,i)=>n.toFixed(PRECISION[i]));
        else return Array(PRECISION.length).fill("");
       }))).join("\t")
      ))
     ))
    ))
   }));
   hide(Interface.ProgressOverlay);
//   console.log(rows);
   createDownload.call(e.target,"HML_peptides.tsv",URL.createObjectURL(new Blob([rows.join("\n")], {type: "text/tab-separated-values"})));
  }
  Interface.DownloadPeptides.addEventListener('click', downloadPeptides); 
 
  var saveAsPNG = function(e) {
   if (e.target.disabled) return;
   createDownload.call(e.target,"figure.png",Interface.Canvas.toDataURL({format: 'png', multiplier: 2}));
  }
  Interface.SaveAsPNG.addEventListener('click', saveAsPNG);

  var saveAsSVG = function(e) {
   if (e.target.disabled) return;
   createDownload.call(e.target,"figure.svg",URL.createObjectURL(new Blob([Interface.Canvas.toSVG()], {type: "image/svg+xml;charset=utf-8"})));
  }
  Interface.SaveAsSVG.addEventListener('click', saveAsSVG);
 
  return Interface;

 }();

});