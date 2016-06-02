"use strict";

if (typeof HML == 'undefined') var HML = {};

document.addEventListener( "DOMContentLoaded", function() {

 HML.Interface = function() {

  var Interface = {};

  //Element bindings
  Interface.RawFilesInput = document.getElementById("input-raw-files");
  Interface.FileTabs = document.getElementById("file-tab-list");
  Interface.IdListInput = document.getElementById("input-identifications");
  Interface.ProteinTable = document.getElementById("results-table-container");
  Interface.Settings = document.getElementById("input-settings");
  Interface.SettingsDialog = document.getElementById("settings-pane-overlay");
  Interface.SettingsDialogContents = document.getElementById("settings-contents");
  Interface.SettingsDialogClose = document.getElementById("settings-close");
  Interface.ProcessAll = document.getElementById("process-all");
  Interface.ProcessSelected = document.getElementById("process-selected");
  Interface.DownloadProteins = document.getElementById("download-proteins");
  Interface.DownloadPeptides = document.getElementById("download-peptides");
  Interface.DownloadPeptides = document.getElementById("download-peptides");
  Interface.SaveAsPNG = document.getElementById("save-as-png");
  Interface.SaveAsSVG = document.getElementById("save-as-svg");
  Interface.ProgressOverlay = document.getElementById("progress-pane-overlay");
  Interface.ProgressOverlay.ProgressBar = document.getElementById("progress-bar");
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
  Interface.Processing = {};

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

  //Initial state
  enable(Interface.RawFilesInput);
  disable(Interface.IdListInput);
  disable(Interface.ProcessAll);
  disable(Interface.ProcessSelected);
  disable(Interface.DownloadProteins);
  disable(Interface.DownloadPeptides);

  Interface.RawFilesInput.Ready = true;
  Interface.IdListInput.Ready = true;
  Interface.Processing.Lock = 0;

  var resizeCanvas = function() {
   Interface.Canvas.setHeight(Interface.Canvas.wrapperEl.parentElement.offsetHeight);
   Interface.Canvas.setWidth(Interface.Canvas.wrapperEl.parentElement.offsetWidth);
   Interface.Canvas.renderAll();
   Interface.Canvas.calcOffset();
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, false);

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

  //Raw Files Input
  Interface.RawFilesInput.addEventListener('click', function() {
   if (!Interface.RawFilesInput.Ready) return;
   if (Interface.Processing.Lock) return;
   Interface.RawFilesInput.FileSelect = document.createElement('input');
   Interface.RawFilesInput.FileSelect.type = "file";
   Interface.RawFilesInput.FileSelect.accept = ".mzML,.mzXML,.raw";
   Interface.RawFilesInput.FileSelect.multiple = true;
   Interface.RawFilesInput.FileSelect.addEventListener('change', function(e) {
    Interface.RawFilesInput.Ready = 0;
    Interface.FileTabs.innerHTML = "";
    Interface.ProteinTable.innerHTML = "";
    Interface.SelectedFile = undefined;
    Interface.SelectedFeature = undefined;
    Interface.Files = {};
    Interface.AvailableFileNames = [];
    Interface.FeaturesObject = {};
    Interface.FeaturesArray = [];
    disable(Interface.IdListInput);
    disable(Interface.ProcessAll);
    disable(Interface.DownloadProteins);
    disable(Interface.DownloadPeptides);
    if (Interface.RawFilesInput.FileSelect.files.length) {
     for (var i = 0, f; f = Interface.RawFilesInput.FileSelect.files[i]; i++) {
      var tab = document.createElement('a');
      tab.appendChild(document.createTextNode(f.name));
      tab.fname = f.name.replace(/\.(?:raw|mzML|mzXML)$/,"");;
      if (f.name.match(/\.raw$/i)) {
       tab.file = new MSLIB.Format.ThermoRawFile(f);
      }
      else {
       tab.file = new MSLIB.Format.MzFile(f);
      }
      Interface.Files[tab.fname] = tab.file;
      tab.addEventListener('click', function(e) {
       var tab = e.target;
       if (tab.file.Ready) {
        Interface.SelectedFile = tab;
        setSelected(tab);
        checkSelected();
       }
       e.stopPropagation();
      });
      disable(tab);
      Interface.FileTabs.appendChild(tab);
      tab.file.fetchAllScanHeaders();
      monitorIndexing(tab);
     }
     Interface.AvailableFileNames = Object.keys(Interface.Files).sort();
     enable(Interface.IdListInput);
     waitForIndexingComplete();
    }
   });
   Interface.RawFilesInput.FileSelect.click();
  });

  //File processing progress
  var monitorIndexing = function(fileTab) {
   if (fileTab.file.Ready) {
    fileTab.removeAttribute("style");
    addClass(fileTab,"ready");
   }
   else {
    var p = Math.round(fileTab.file.Progress);
    fileTab.style.background = "linear-gradient(90deg, lightgreen "+p+"%, pink 1%, pink "+(100-p-1)+"%)";
    window.setTimeout(monitorIndexing, 4, fileTab);
   }
  };
  var waitForIndexingComplete = function() {
   if ((Interface.FileTabs.childNodes.length ==  Interface.RawFilesInput.FileSelect.files.length) && (Object.keys(Interface.Files).every(function(fname) { return Interface.Files[fname].Ready }))) {
    Interface.RawFilesInput.Ready = true;
    MSLIB.Common.WaitUntil(() => true,() => {
     if (Interface.FileTabs.childNodes.length == 1) Interface.FileTabs.childNodes[0].click();
    });
   }
   else window.setTimeout(waitForIndexingComplete, 4);
  };

  //ID List Input  
  Interface.IdListInput.addEventListener('click', function() {
   if (Interface.IdListInput.disabled) return;
   if (!Interface.IdListInput.Ready) return;
   if (Interface.Processing.Lock) return;
   Interface.IdListInput.FileSelect = document.createElement('input');
   Interface.IdListInput.FileSelect.type = "file";
   Interface.IdListInput.FileSelect.accept = ".csv,.tsv,.txt";
   Interface.IdListInput.FileSelect.addEventListener('change', function(e) {
    Interface.IdListInput.Ready = 0;
    Interface.ProteinTable.innerHTML = "";
    Interface.SelectedFeature = undefined;
    Interface.FeaturesObject = {};
    Interface.FeaturesArray = [];
    disable(Interface.ProcessAll);
    disable(Interface.DownloadProteins);
    disable(Interface.DownloadPeptides);
    if (Interface.IdListInput.FileSelect.files.length) {
     Interface.IdListInput.idFile = new MSLIB.Format.TextTableFile(e.target.files[0]);
     Interface.IdListInput.idFile.UseFirstLineAsHeaders = true;
     Interface.IdListInput.idFile.load();
     MSLIB.Common.WaitUntil(() => Interface.IdListInput.idFile.Ready,function(){
      var H = Interface.IdListInput.HeaderIndices = {      
       protein       : Interface.IdListInput.idFile.Headers.indexOf("PROTEIN"),
       description   : Interface.IdListInput.idFile.Headers.indexOf("PROTEIN_DESCRIPTION"),
       proteinscore  : Interface.IdListInput.idFile.Headers.indexOf("PROTEIN_SCORE"),
       peptide       : Interface.IdListInput.idFile.Headers.indexOf("PEPTIDE_SEQUENCE"),
       peptidescore  : Interface.IdListInput.idFile.Headers.indexOf("PEPTIDE_SCORE"),
       unique        : Interface.IdListInput.idFile.Headers.indexOf("IS_UNIQUE"),
       fname         : Interface.IdListInput.idFile.Headers.indexOf("FILE_NAME"),
       allfiles      : Interface.IdListInput.idFile.Headers.indexOf("QUANTIFY_ALL_RUNS"),
       scan          : Interface.IdListInput.idFile.Headers.indexOf("SCAN_NUMBER"),
       rt            : Interface.IdListInput.idFile.Headers.indexOf("RETENTION_TIME"),
       modifications : Interface.IdListInput.idFile.Headers.indexOf("MODIFICATIONS"),
       charge        : Interface.IdListInput.idFile.Headers.indexOf("CHARGE")
      }
      if ((H.protein < 0) || (H.peptide < 0) || (H.fname < 0) || ((H.scan < 0) && (H.rt < 0)) || (H.charge < 0)) {
       console.log("Failed to parse IDs");
      }
      else {
       Interface.IdListInput.FilesNotFound = {};
       Interface.IdListInput.CurrentLine = 0;
       if (!Interface.RawFilesInput.Ready) Interface.ProteinTable.innerHTML = "<p>Waiting for raw file indexing to finish</p>";
       MSLIB.Common.WaitUntil(() => Interface.RawFilesInput.Ready,() => {
        monitorIDLoading();
        processIdListLine();
       });
      }
     });
    }
   });
   Interface.IdListInput.FileSelect.click();
  });

  var processIdListLine = function() {
   var L = Interface.IdListInput.idFile.Lines[Interface.IdListInput.CurrentLine]
   var H = Interface.IdListInput.HeaderIndices
   var protein = L[H.protein];
   if (protein) {
    var peptide = L[H.peptide]; 
    if (peptide) {
     var fname = L[H.fname];
     fname = fname.replace(/\.(?:raw|mzML|mzXML)$/,"");
     if (fname) {
      if (fname && (Interface.AvailableFileNames.indexOf(fname) < 0)) {
       Interface.IdListInput.FilesNotFound[fname] = true;
      }
      else {
       var description = H.description >= 0 ? L[H.description] : "";
       var proteinscore = H.proteinscore >= 0 ? L[H.proteinscore] : "";
       var peptidescore = H.peptidescore >= 0 ? L[H.peptidescore] : "";
       var unique = L[H.unique].match(/t|true|y|yes|1|u|unique/i) ? true : null;
       var allfiles = L[H.allfiles].match(/t|true|y|yes|1|all/i) ? true : null;
       var scan = H.scan >= 0 ? L[H.scan] : null;
       var ms1rt,idrt;
       if (H.rt >= 0) {
        ms1rt = Interface.Files[fname].getNearestMSXRTfromRT(1,L[H.rt],true);
        idrt = Interface.Files[fname].getNearestMSXRTfromRT(2,L[H.rt],true);
       }
       else {
        ms1rt = Interface.Files[fname].getNearestMSXRTfromScanNumber(1,scan,true);
        idrt = Interface.Files[fname].getNearestMSXRTfromScanNumber(2,scan,true);
       }
       if (idrt == null) idrt = ms1rt;
       var modstring = H.modifications >= 0 ? L[H.modifications] : "";
       var modsplit = modstring.split(";");
       var modifications = [];
       modsplit.forEach(function(mod) {
        if (mod.length) {
         var regexmatch = /[A-Z]\d+: (\S+)/i.exec(mod);
         if (regexmatch) {
          if (HML.Modifications[regexmatch[1]]) {
           modifications.push(new MSLIB.IsoCalc.Modification({name: regexmatch[1], atoms: HML.Modifications[regexmatch[1]]}));
          }
          else console.log("Warning: unknown modification "+regexmatch[1]);
         }
         else console.log("Warning: cannot parse modification "+mod);
        }
       });
       var charge = L[H.charge];
       charge = parseInt(charge.toString().replace(/\+$/,"")); //remove trailing +
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
         modifications,//10
         charge,       //11
         allfiles,     //12
         {}            //13
        ]
        Interface.FeaturesObject[protein][peptide][charge][modstring] = featureData;
        Interface.FeaturesArray.push(featureData);
       }
       else {
        var feature = Interface.FeaturesObject[protein][peptide][charge][modstring];
        var fidx = feature[6].indexOf(fname);
        if (fidx < 0) {
         feature[6].push(fname);
         feature[7].push([ms1rt]);
         feature[8].push([idrt]);
        }
        else {
         feature[7][fidx].push(ms1rt);
         feature[7][fidx].push(idrt);
        }
       }
      }
     }
    }
   }
   if(++Interface.IdListInput.CurrentLine < Interface.IdListInput.idFile.Lines.length) {
    MSLIB.Common.WaitUntil(() => true,processIdListLine);
   }
   else {
    Interface.IdListInput.Ready = true;
    if (Object.keys(Interface.IdListInput.FilesNotFound).length) console.log("Warning: files not found - "+Object.keys(Interface.IdListInput.FilesNotFound).join(";"));
    updateProteinTable();
   }
  };

  var monitorIDLoading = function() {
   if (Interface.IdListInput.Ready) {
    hide(Interface.ProgressOverlay); 
   }
   else {
    setProgressBar((Interface.IdListInput.CurrentLine/Interface.IdListInput.idFile.Lines.length)*100);
    window.setTimeout(monitorIDLoading, 4);
   }
  };

  //Update Protein Table
  var updateProteinTable = function() {
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
   waitForFilesAndIDs();
  };

  var waitForFilesAndIDs = function() {
   if (Interface.RawFilesInput.Ready && Interface.IdListInput.Ready) {
    enable(Interface.ProcessAll);
   }
   else window.setTimeout(waitForFilesAndIDs, 4);
  };
  var checkAvailableFiles = function() {
   if (Interface.SelectedFeature) {
    Array.prototype.slice.call(Interface.FileTabs.childNodes).forEach(function(ele) {
     removeClass(ele,"has-rt");
     switch(true) {
      case (Interface.SelectedFeature[6].indexOf(ele.fname) >= 0): addClass(ele,"has-rt");
      case (Interface.SelectedFeature[12]): enable(ele); break;
      default: disable(ele);
     }
    });
   }
  };
  var checkSelected = function() {
   if (Interface.SelectedFeature && Interface.SelectedFile && !Interface.SelectedFile.disabled) enable(Interface.ProcessSelected);
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
   if (Interface.Processing.Lock) return;
   Interface.SettingsDialogContents.innerHTML = "";
   Object.keys(HML.Config).sort().forEach(function(key) {
    var label = document.createTextNode(key+": ");
    var field = document.createElement("input");
    field.type = "text";
    field.name = key;
    field.value = JSON.stringify(HML.Config[key]);
    Interface.SettingsDialogContents.appendChild(label);
    Interface.SettingsDialogContents.appendChild(field);
    Interface.SettingsDialogContents.appendChild(document.createElement("br"));
   });
   show(Interface.SettingsDialog);
  });
  
  Interface.SettingsDialogClose.addEventListener('click', function() {
   if (!Interface.Processing.Lock) {
    Array.prototype.slice.call(Interface.SettingsDialogContents.childNodes).forEach(function(node) {
     if (node.type == "text") {
      HML.Config[node.name] = JSON.parse(node.value);
     }
    });
    Interface.FeaturesArray.forEach(f => {f[13] = {}});
   }
   hide(Interface.SettingsDialog);
  });

  //Do Processing
  var handleProcessClick = function(e) {
   if (e.target.disabled) return;
   if (Interface.Processing.Lock) return;
   if (
       e.target.SelectedOnly && 
       Interface.SelectedFile && 
       Interface.SelectedFeature && 
       Interface.SelectedFeature[13][Interface.SelectedFile.fname] && 
       Interface.SelectedFeature[13][Interface.SelectedFile.fname].QuantExtended
      ) displayCanvas();
   else {
    show(Interface.ProgressOverlay);
    setProgressBar(0);
    Interface.Processing = {};
    Interface.Processing.Lock = true;
    Interface.Processing.SelectedOnly = e.target.SelectedOnly;
    //following is imperfect but helps ensure responsive drawing of overlay after click
    window.requestAnimationFrame(() => {MSLIB.Common.WaitUntil(() => true, startProcessing)}); 
   }
  }
  Interface.ProcessAll.addEventListener('click', handleProcessClick);
  Interface.ProcessSelected.addEventListener('click', handleProcessClick);
  Interface.ProcessSelected.SelectedOnly = true;

  var startProcessing = function() {
   Interface.Processing.Features = Interface.Processing.SelectedOnly ? [Interface.SelectedFeature] : Interface.FeaturesArray;
   Interface.Processing.FileIndex = 0;
   Interface.Processing.FeatureIndex = 0;
   Interface.Processing.Features.forEach(f => {f.Results={}});
   MSLIB.Common.WaitUntil(() => true, processTicker);
  };
 
  var processTicker = function() {
   var p = Interface.Processing;
   var feature = p.Features[p.FeatureIndex];
   var filelist = p.SelectedOnly ? [Interface.SelectedFile.fname]
                  : feature[12] ? Interface.AvailableFileNames
                    : feature[6];
   var filename = filelist[p.FileIndex];
   if (!feature[13][filename]) {
    var extractions = [];
    var sequence = feature[3];
    sequence = sequence.replace(/^[\w-]?\.|\.[\w-]$/g,"");
    var charge = feature[11];
    var mods = feature[10];
    extractions[0] = [new MSLIB.IsoCalc.Peptide({sequence:sequence,charge:charge,modifications:mods}).get_centroided_distribution(10).as_spectrum()];
    extractions[0][0].Incorporation = 0;
    extractions[1] = [];
    var altEleConst = {};
    altEleConst["Nitrogen"] = JSON.parse(JSON.stringify(MSLIB.IsoCalc.ElementalConstants["Nitrogen"])); //Ensure full copy
    for (var N_15 = +HML.Config.IncorporationWindowMin; N_15 <= +HML.Config.IncorporationWindowMax; N_15++) {
     altEleConst["Nitrogen"].isotopes[0][1] = 100 - N_15;
     altEleConst["Nitrogen"].isotopes[1][1] = N_15;
     var ex = new MSLIB.IsoCalc.Peptide({sequence:sequence,charge:charge,modifications:mods}).get_centroided_distribution(10,altEleConst).as_spectrum();
     ex.Incorporation = N_15;
     extractions[1].push(ex);
    }
    var MS1RTindex = feature[6].indexOf(filename);
    var MS1RT;
    if (MS1RTindex >= 0) {
     MS1RT = feature[7][MS1RTindex].reduce((a,b) => (a+b))/MS1RTarr.length;
    }
    else {
     MS1RT = feature[7].reduce((a,b) => (a+b.reduce((c,d) => (c+d))/b.length))/feature[7].length;
    }
    feature[13][filename] = new HML.Quantifier.MS1Feature(
                                             Interface.Files[filename],
                                             extractions,
                                             MS1RT-(+HML.Config.RTSearchWindow),
                                             MS1RT+(+HML.Config.RTSearchWindow),
                                             +HML.Config.PpmError,
                                             +HML.Config.RTMaxShift,
                                             +HML.Config.RTOrder,
                                             +HML.Config.FindMaxIntensityByLowestIsotopologue,
                                             +HML.Config.ConsiderIsotopologuesInTop,
                                             !p.SelectedOnly
                                            );
    MSLIB.Common.WaitUntil(() => true, processTicker); 
   }
   else {
    if (p.SelectedOnly) {
     if (!feature[13][filename].Ready || HML.Quantifier.getCurrentWorkers()) { //if worker threads active then update progress
      setProgressBar(feature[13][filename].Progress);
      window.setTimeout(processTicker,4);
     }
     else { //we are finished, display canvas
      p.Lock = 0;
      hide(Interface.ProgressOverlay);
      displayCanvas();
     }
    } 
    else if (!feature[13][filename].DataLoaded) { //wait for data load to complete
     setProgressBar(((p.FeatureIndex + (p.FileIndex + (feature[13][filename].Progress/100))/filelist.length )/p.Features.length) * 100);
     window.setTimeout(processTicker,4);
    }
    else {
     if (++p.FileIndex >= filelist.length) { //next feature
      p.FeatureIndex++;
      p.FileIndex = 0; //reset to start of files
     }
     if (p.FeatureIndex < p.Features.length) {
      MSLIB.Common.WaitUntil(() => true, processTicker);
     }
     else { //finished
      if (!feature[13][filename].Ready || HML.Quantifier.getCurrentWorkers()) { //if worker threads active then update progress
       setProgressBar("Waiting for remaining quantitation threads to complete");
       MSLIB.Common.WaitUntil(() => (feature[13][filename].Ready && !HML.Quantifier.getCurrentWorkers()), () => {
        p.Lock = 0;
        hide(Interface.ProgressOverlay);  
       });
      }
     }
    } 
   }
  };
 
  var displayCanvas = function() {
   Interface.Canvas.clear();
   var MS1Feature = Interface.SelectedFeature[13][Interface.SelectedFile.fname];
   var abuGraph = new HML.Plot.MS1FeatureRelAbundance(MS1Feature,["unlabelled","heavy"]);
   abuGraph.left += 40;
   Interface.Canvas.add(abuGraph);
   var idrts = (Interface.SelectedFeature[6].indexOf(Interface.SelectedFile.fname) >= 0 
               ? Interface.SelectedFeature[8][Interface.SelectedFeature[6].indexOf(Interface.SelectedFile.fname)] 
               : null);
   var chromGraph = new HML.Plot.MS1FeatureChromatogram(MS1Feature,["unlabelled","heavy"],idrts);
   chromGraph.left += 460;
   Interface.Canvas.add(chromGraph);
   var col = 0;
   ["unlabelled","heavy"].forEach(function(label,label_i) {
    if (MS1Feature.Quant[label_i].length) {
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

//  var downloadProteins = function(e) {
//   if (e.target.disabled) return;
//   var files = Object.keys(Interface.Files);
//   var labels = ["unlabelled","heavy"];
//   var stats = {};
//   var rows = [["PROTEIN"].concat(Array.concat.apply([],files.map((fname) => 
//               (labels.map((label) => 
//                (fname+"_TOTAL_INTENSITY_"+label)).concat(labels.map((label) => 
//                 (fname+"_RATIO_"+label+":"+labels[labels.length-1])).slice(0,-1)
//                )
//               )
//              ))).join("\t")];
//   show(Interface.ProgressOverlay);
//   setProgressBar(0);
//   var Proteins = Object.keys(Interface.FeaturesObject).sort();
//   rows = rows.concat(Proteins.map(function(protein,i) {
//    var quantbyfile = files.map(function(fname) {
//     stats[fname] = {};
//     var quantbylabel = labels.map(function(label) {
//      stats[fname][label] = {};
//      stats[fname][label].Incorp = [];
//      stats[fname][label].Distance = [];
//      return Object.keys(Interface.FeaturesObject[protein]).map(function(peptide) {
//       return Interface.FeaturesObject[protein][peptide].filter((F) => ((F.FileName == fname) && F.Unique)).map(function(F) {
//        stats[fname][label].Incorp.push((F.Results && !F.Results.Quant[label].Failed) ? F.Results.Quant[label].MatchedDistributionIncorporation : null)
//        if (F.OrigFileName == fname) stats[fname][label].Distance.push((F.Results && !F.Results.Quant[label].Failed) ? F.IDRT - F.Results.Quant[label].RT : null);
//        return ((F.Results && !F.Results.Quant[label].Failed) ? F.Results.Quant[label].PermutationNormalisedIntensity : 0);
//       }).reduce((a,b) => (a+b),0);       
//      }).reduce((a,b) => (a+b),0);
//     });
//     return quantbylabel.concat(quantbylabel.map(function(q) {
//      var denom = quantbylabel[quantbylabel.length-1];
//      console.log([q,denom]);
//      return (denom > 0 ? q/denom : "N/A");
//     }).slice(0,-1));
//    });
//    setProgressBar(i/(Proteins.length-1)*100);
//    return [protein].concat(Array.concat.apply([],quantbyfile)).join("\t");
//   }));
//   var metarows = [];
//   metarows.push("PARAMETERS");
//   Object.keys(HML.Config).sort().forEach(function(key) {
//    metarows.push([key,JSON.stringify(HML.Config[key])].join("\t"));
//   });
//   metarows.push("");
//   metarows.push("STATISTICS (Unique Peptides Only)");
//   metarows.push([""].concat(Array.concat.apply([],files.map((fname) => labels.map((label) => (fname+"_"+label))))).join("\t"));
//   metarows.push(["MEAN_INCORPORATION"].concat(Array.concat.apply([],files.map(function(fname) {
//    return labels.map(function(label) {
//     var incorp = MSLIB.Math.mean(stats[fname][label].Incorp);
//     return (incorp != null ? incorp : "N/A")
//    });
//   }))).join("\t"));
//   metarows.push(["MEAN_DISTANCE_TO_ID (from Peak Apex RT)"].concat(Array.concat.apply([],files.map(function(fname) {
//    return labels.map(function(label) {
//     var dist = MSLIB.Math.mean(stats[fname][label].Distance);
//     return (dist != null ? dist : "N/A")
//    });
//   }))).join("\t"));
//   metarows.push("");
//   rows = metarows.concat(rows);
//   hide(Interface.ProgressOverlay);
//   createDownload.call(e.target,"HML_proteins.tsv",URL.createObjectURL(new Blob([rows.join("\n")], {type: "text/tab-separated-values"})));
//  }
//  Interface.DownloadProteins.addEventListener('click', downloadProteins);
//
//  var downloadPeptides = function(e) {
//   if (e.target.disabled) return;
//   var labels = ["unlabelled","heavy"];
//   var rows = [["PROTEIN","PEPTIDE","IS_UNIQUE","CHARGE","MODIFICATIONS"].concat(Array.concat.apply([],Interface.AvailableFileNames.map(function(fname) {
//    return labels.map((label) =>(fname+"_INCORP_"+label))
//           .concat(labels.map((label) => (fname+"_TOTAL_PEAK_APEX_"+label)))
//           .concat(labels.map((label) => (fname+"_RATIO_"+label+":"+labels[labels.length-1])).slice(0,-1))
//           .concat(labels.map((label) => (fname+"_MEAN_APEX_DISTANCE_TO_ID_"+label)));
//   }))).join("\t")];
//   show(Interface.ProgressOverlay);
//   setProgressBar(0);
//   var Proteins = Object.keys(Interface.FeaturesObject).sort();
//   rows = rows.concat(Array.concat.apply([],Proteins.map(function(protein,i) {
//    return Array.concat.apply([],Object.keys(Interface.FeaturesObject[protein]).map(function(peptide) {
//     var charge_and_mods = {};
//     Interface.FeaturesObject[protein][peptide].forEach(function(feature) {
//      if (!charge_and_mods[feature.Charge]) {
//       charge_and_mods[feature.Charge] = {};
//       charge_and_mods[feature.Charge][feature.Modifications] = [];
//      }
//      else if (!charge_and_mods[feature.Charge][feature.Modifications]) {
//       charge_and_mods[feature.Charge][feature.Modifications] = [];
//      }
//      charge_and_mods[feature.Charge][feature.Modifications].push(feature);
//     });
//     return Array.concat.apply([],Object.keys(charge_and_mods).map(function(charge) {
//      return Object.keys(charge_and_mods[charge]).map(function(modifications) {
//       var quantbyfile = files.map(function(fname) {
//        var filefeatures = charge_and_mods[charge][modifications].filter((F) => (F.FileName == fname));
//        var incorpbylabel = labels.map(function(label) {
//         var incorp =  MSLIB.Math.mean(filefeatures.map(function(F) {
//          return ((F.Results && !F.Results.Quant[label].Failed) ? F.Results.Quant[label].MatchedDistributionIncorporation : null);
//         }));
//         return (incorp != null ? incorp : "N/A");
//        });
//        var quantbylabel = labels.map(function(label) {
//         return filefeatures.map(function(F) {
//          return ((F.Results && !F.Results.Quant[label].Failed) ? F.Results.Quant[label].PermutationNormalisedIntensity : 0);
//         }).reduce((a,b) => (a+b),0);
//        });
//        var ratiobylabel = quantbylabel.map(function(q) {
//         var denom = quantbylabel[quantbylabel.length-1];
//         return (denom > 0 ? q/denom : "N/A");
//        }).slice(0,-1);
//        var distancebylabel = labels.map(function(label) {
//         var rtdistance = MSLIB.Math.mean(filefeatures.map(function(F) {
//          if (F.OrigFileName == fname) return ((F.Results && !F.Results.Quant[label].Failed) ? F.IDRT - F.Results.Quant[label].RT : null);
//          else return null;
//         }));
//         return (rtdistance != null ? rtdistance : "N/A");
//        });
//        return incorpbylabel.concat(quantbylabel).concat(ratiobylabel).concat(distancebylabel);
//       });
//       var isunique = charge_and_mods[charge][modifications].every(function(F) {return F.Unique});
//       return [protein,peptide,isunique,charge,modifications].concat(Array.concat.apply([],quantbyfile)).join("\t");
//      });
//     }));
//    }));
//    setProgressBar(i/(Proteins.length-1)*100);
//   })));
//   hide(Interface.ProgressOverlay);
//   createDownload.call(e.target,"HML_peptides.tsv",URL.createObjectURL(new Blob([rows.join("\n")], {type: "text/tab-separated-values"})));
//  }
//  Interface.DownloadPeptides.addEventListener('click', downloadPeptides); 
 
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