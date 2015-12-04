"use strict";

if (typeof HML == 'undefined') var HML = {};

document.addEventListener( "DOMContentLoaded", function() {

 HML.Interface = function() {

  var Interface = {};
  Interface.IdList = document.getElementById("input-identifications");
  Interface.IdList.Ready = 1;
  Interface.RawFiles = document.getElementById("input-raw-files");
  Interface.Settings = document.getElementById("input-settings");
  Interface.ProteinTable = document.getElementById("proteins-table");
  Interface.ProteinTable.Ready = 0;
  Interface.SelectedFeature = undefined;
  Interface.AllFeatures = [];
  Interface.FileTabs = document.getElementById("file-tab-list");
  Interface.FileTabs.Ready = 0;
  Interface.SelectedFile = undefined;
  Interface.AllFiles = [];
  Interface.ProcessAll = document.getElementById("process-all");
  Interface.ProcessAll.className = "disabled";
  Interface.ProcessSelected = document.getElementById("process-selected");
  Interface.ProcessSelected.className = "disabled";
  Interface.Processing = {};
  Interface.Processing.Lock = 0;
  Interface.ProgressOverlay = document.getElementById("progress-overlay");
  Interface.ProgressOverlay.ProgressBar = document.getElementById("progress-bar");
  Interface.Results = {};
  Interface.Canvas = new fabric.Canvas('graphics-canvas',{hoverCursor: 'pointer',backgroundColor: 'rgb(255,255,255)'});
  
  var resizeCanvas = function() {
   Interface.Canvas.setHeight(Interface.Canvas.wrapperEl.parentElement.offsetHeight);
   Interface.Canvas.setWidth(Interface.Canvas.wrapperEl.parentElement.offsetWidth);
   Interface.Canvas.renderAll();
   Interface.Canvas.calcOffset();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, false);
  
  var createDownload = function(name, dURL) {
   var a = document.createElement("a");
   a.name = name;
   a.href = dURL;
   a.download = name;
   a.click();
  }
 
  //
  //var saveAsSVG = function() {
  // createDownload("figure.svg",URL.createObjectURL(new Blob([Canvas.toSVG()], {type: "image/svg+xml;charset=utf-8"})));
  //}
  //
  //var saveAsPNG = function() {
  // createDownload("figure.png",Canvas.toDataURL({format: 'png', multiplier: 2}));
  //}
 
  var monitorIndexing = function(fileTab) {
   if (fileTab.file.Ready) {
    fileTab.style.background = "lightgreen";
   }
   else {
    var p = Math.round(fileTab.file.Progress);
    fileTab.style.background = "linear-gradient(90deg, lightgreen "+p+"%, pink 1%, pink "+(100-p-1)+"%)";
    window.setTimeout(monitorIndexing, 4, fileTab);
   }
  }
 
  var waitForIndexingComplete = function() {
   if (Interface.AllFiles.every(function(file) { return file.Ready })) {
    Interface.FileTabs.Ready = 1;
    if (Interface.FileTabs.childNodes.length == 1) {
     Interface.FileTabs.childNodes[0].click();
    }
    checkProcessAll()
   }
   else {
    window.setTimeout(waitForIndexingComplete, 4);
   }
  }

  var showAsSelected = function(el) {
   var scope;
   if (el.nodeName == "TD") {
    scope = Interface.ProteinTable;
   }
   else {
    scope = Interface.FileTabs;
   }
   Array.prototype.slice.call(scope.getElementsByClassName("selected")).forEach(function(node) {
    node.className = node.className.replace(/(?:^|\s)selected(?!\S)/g,"");
   });
   el.className = "selected";
  }
 
  var checkProcessAll = function() {
   if (Interface.ProteinTable.Ready && Interface.FileTabs.Ready) {
    Interface.ProcessAll.className = Interface.ProcessAll.className.replace(/(?:^|\s)disabled(?!\S)/g,"");
   }
   else {
    Interface.ProcessAll.className = "disabled";
   }
  }
 
  var checkProcessSelected = function() {
   if (Interface.SelectedFeature && Interface.SelectedFile) {
    Interface.ProcessSelected.className = Interface.ProcessSelected.className.replace(/(?:^|\s)disabled(?!\S)/g,"");
    if (Interface.SelectedFeature[5]) {
     updateCanvas();
    }
   }
   else {
    Interface.ProcessSelected.className = "disabled";
   }
  }
  
  Interface.IdList.addEventListener('click', function() {
   if (Interface.Processing.Lock) return;
   if (!Interface.IdList.Ready) return;
   Interface.IdList.FileSelect = document.createElement('input');
   Interface.IdList.FileSelect.type = "file";
   Interface.IdList.FileSelect.accept = ".tsv";
   Interface.IdList.FileSelect.addEventListener('change', function(e) {
    Interface.IdList.Ready = 0;
    Interface.ProteinTable.innerHTML = "";
    Interface.SelectedFeature = undefined;
    Interface.AllFeatures = [];
    Interface.ProteinTable.Ready = 0;
    Interface.Results = {};
    checkProcessAll();
    checkProcessSelected();
    if (Interface.IdList.FileSelect.files.length) {
     Interface.IdList.idFile = new HML.Format.TextFile(e.target.files[0]);
     Interface.IdList.idFile.Delimiter = "\t";
     Interface.IdList.idFile.UseFirstLineAsHeaders = 1;
     Interface.IdList.idFile.load();
     HML.Common.waitUntil(function(){return Interface.IdList.idFile.Ready},function(){
      Interface.IdList.protein_header = Interface.IdList.idFile.Headers.indexOf("PROTEIN_LOCUS");
      Interface.IdList.peptide_header = Interface.IdList.idFile.Headers.indexOf("PEPTIDE_SEQUENCE");
      Interface.IdList.feature_header = Interface.IdList.idFile.Headers.indexOf("PEPTIDE_FILE_NAME");
      Interface.IdList.scan_header = Interface.IdList.idFile.Headers.indexOf("PEPTIDE_SCAN_NUMBER");
      Interface.IdList.charge_header = Interface.IdList.idFile.Headers.indexOf("PEPTIDE_CHARGE");
      for (var i = 0, l; l = Interface.IdList.idFile.Lines[i]; i++) {
       var protein = l[Interface.IdList.protein_header];
       var peptide = l[Interface.IdList.peptide_header]; 
       var feature = l[Interface.IdList.feature_header];
       var scan = l[Interface.IdList.scan_header];
       var charge = l[Interface.IdList.charge_header];
       if (Interface.Results[protein]) {
        if (!Interface.Results[protein][peptide]) {
         Interface.Results[protein][peptide] = {};
        }
       }
       else {
        Interface.Results[protein] = {};
        Interface.Results[protein][peptide] = {};     
       }
       var featureData = [protein,peptide,feature,scan,charge]; //Will eventually hold quant as well
       Interface.Results[protein][peptide][feature] = featureData;
       Interface.AllFeatures.push(featureData);
      }
      Interface.IdList.Ready = 1;
     });
     HML.Common.waitUntil(function(){return Interface.IdList.Ready},function() {
      Object.keys(Interface.Results).forEach(function(protein) {
       var protrow = Interface.ProteinTable.insertRow(-1);
       var protcell = protrow.insertCell(0);
       protcell.protein = protein;
       protcell.appendChild(document.createTextNode(protein));
       protcell.expanded = 0;
       protcell.addEventListener('click', function(e) {
        var protcell = e.target;
        protcell.innerHTML = "";
        protcell.appendChild(document.createTextNode(protcell.protein));
        if (protcell.expanded) {
         protcell.expanded = 0;
        }
        else {
         var peptable = document.createElement("table");
         Object.keys(Interface.Results[protcell.protein]).forEach(function(peptide) {
          var peprow = peptable.insertRow(-1);
          var pepcell = peprow.insertCell(0);
          pepcell.peptide = peptide;
          pepcell.appendChild(document.createTextNode(pepcell.peptide));
          pepcell.expanded = 0;
          pepcell.addEventListener('click', function(e) {
           var pepcell = e.target;
           pepcell.innerHTML = "";
           pepcell.appendChild(document.createTextNode(pepcell.peptide));
           if (pepcell.expanded) {
            pepcell.expanded = 0;
           }
           else {
            var featuretable = document.createElement("table");
            Object.keys(Interface.Results[protcell.protein][pepcell.peptide]).forEach(function(feature) {
             var featurerow = featuretable.insertRow(-1);
             var featurecell = featurerow.insertCell(0);
             featurecell.featureData = Interface.Results[protcell.protein][pepcell.peptide][feature];
             featurecell.appendChild(document.createTextNode(feature));
             featurecell.addEventListener('click', function(e) {
              var featurecell = e.target;
              Interface.SelectedFeature = featurecell.featureData;
              showAsSelected(featurecell);
              checkProcessSelected();
              e.stopPropagation();
             });
            });
            pepcell.appendChild(featuretable);
            pepcell.expanded = 1;
           }
           e.stopPropagation();
          });
         });
         protcell.appendChild(peptable);
         protcell.expanded = 1;
        }
        e.stopPropagation();
       });
      });
      Interface.ProteinTable.Ready = 1;
      checkProcessAll();
     });
    }
   });
   Interface.IdList.FileSelect.click();
  });
  
  Interface.RawFiles.addEventListener('click', function() {
   if (Interface.Processing.Lock) return;
   Interface.FileTabs.innerHTML = "";
   Interface.SelectedFile = undefined;
   Interface.AllFiles = []
   Interface.FileTabs.Ready = 0;
   checkProcessAll();
   checkProcessSelected();
   Interface.RawFiles.FileSelect = document.createElement('input');
   Interface.RawFiles.FileSelect.type = "file";
   Interface.RawFiles.FileSelect.accept = ".mzML,.mzXML,.raw";
   Interface.RawFiles.FileSelect.multiple = true;
   Interface.RawFiles.FileSelect.addEventListener('change', function(e) {
    if (Interface.RawFiles.FileSelect.files.length) {
     for (var i = 0, f; f = Interface.RawFiles.FileSelect.files[i]; i++) {
      var tab = document.createElement('a');
      tab.appendChild(document.createTextNode(f.name));
      if (f.name.match(/\.raw$/i)) {
       tab.file = new HML.Format.ThermoRawFile(f);
      }
      else {
       tab.file = new HML.Format.MzFile(f);
      }
      tab.file.fetchAllScanHeaders();
      Interface.AllFiles.push(tab.file);
      monitorIndexing(tab);
      tab.addEventListener('click', function(e) {
       var tab = e.target;
       if (tab.file.Ready) {
        Interface.SelectedFile = tab.file;
        showAsSelected(tab);
        checkProcessSelected();
       }
       e.stopPropagation();
      });
      Interface.FileTabs.appendChild(tab);
     }
     waitForIndexingComplete();
    }
   });
   Interface.RawFiles.FileSelect.click();
  });
  
  Interface.Settings.addEventListener('click', function() {
   document.getElementById("settings-pane-overlay").style.visibility="visible";
  });
  
  document.getElementById("settings-close").addEventListener('click', function() {
   Interface.ProteinTable.allFeatures.forEach(function(featureData) {delete featureData[5]});
   document.getElementById("settings-pane-overlay").style.visibility="hidden";
  });
 
  var start_processing = function(selectedOnly) {
   if (Interface.Processing.Lock) return;
   Interface.Processing = {};
   Interface.Processing.Lock = 1;
   Interface.Processing.selectedOnly = selectedOnly;
   Interface.Processing.features = selectedOnly ? [Interface.SelectedFeature] : Interface.AllFeatures;
   Interface.Processing.files = selectedOnly ? [Interface.SelectedFile] : Interface.AllFiles;
   Interface.Processing.features_n = 0;
   Interface.Processing.files_n = 0;
   Interface.Processing.ppmError = 20;
   Interface.Processing.RTError = 3;
   process_ticker(Interface.Processing);
  }
 
  Interface.ProcessSelected.addEventListener('click', start_processing.bind(null, 1));
  Interface.ProcessAll.addEventListener('click', start_processing.bind(null, 0));
 
  var process_ticker = function() {
   var p = Interface.Processing; 
   if (p.features_n >= p.features.length) {
    Interface.ProgressOverlay.style.visibility="hidden";
    if (p.selectedOnly) {
     updateCanvas();
    }
    p.Lock = 0;
   }
   else {
    if (p.files_n >= p.files.length) {
     p.files_n = 0;
     p.features_n++;
    }
    else if(p.features[p.features_n][5]) {
     if(p.features[p.features_n][5][p.files_n]) {
      if (p.features[p.features_n][5][p.files_n].Ready) {
//       if (!p.selectedOnly) { //stop memory ballooning, a full MS1Feature contains raw data and all tested spectra!
        delete p.features[p.features_n][5][p.files_n].CroppedRawSpectra;
        delete p.features[p.features_n][5][p.files_n].ExtractionMatches;       
//       }
       p.files_n++;
      }
      else {
       var quant_progress = p.features[p.features_n][5][p.files_n].Progress;
       p.Progress = ((p.features_n * p.files.length) + p.files_n + (quant_progress/100))/(p.features.length * p.files.length) * 100;
       Interface.ProgressOverlay.ProgressBar.style.background = "linear-gradient(90deg, lightblue "+p.Progress+"%, lightgrey 1%, lightgrey "+(100-p.Progress-1)+"%)";
       Interface.ProgressOverlay.ProgressBar.innerHTML = p.Progress.toFixed(2)+"%";
      }
     }
     else {
      p.RT = p.files[p.files_n].getNearestMSXRTfromScanNumber(1,p.features[p.features_n][3],true);
      p.features[p.features_n][5][p.files_n] = new HML.Quantifier.MS1Feature(p.files[p.files_n],p.extractions,p.ppmError,p.RT-p.RTError,p.RT+p.RTError,-1,0.1);
     }
    }
    else {
     Interface.ProgressOverlay.style.visibility="visible";
     p.features[p.features_n][5] = []
     p.extractions = {};
     p.sequence = p.features[p.features_n][1];
     p.sequence = p.sequence.replace(/^[\w-]?\.|\.[\w-]$/g,"");
     p.charge = p.features[p.features_n][4];
     p.extractions.unlabelled = [new HML.IsoCalc.Peptide({sequence:p.sequence,charge:p.charge}).get_centroided_distribution(10).as_spectrum()];
     p.extractions.unlabelled[0].Title = "Light";
     p.extractions.heavy = [];
     var altEleConst = {};
     altEleConst["Nitrogen"] = JSON.parse(JSON.stringify(HML.IsoCalc.ElementalConstants["Nitrogen"]));
     for (var N_15 = 95; N_15 < 100; N_15++) {
      altEleConst["Nitrogen"].isotopes[0][1] = 100 - N_15;
      altEleConst["Nitrogen"].isotopes[1][1] = N_15;
      p.extractions.heavy.push(new HML.IsoCalc.Peptide({sequence:p.sequence,charge:p.charge}).get_centroided_distribution(10,altEleConst).as_spectrum());
     }
     p.extractions.heavy.forEach(function(ex) {
      ex.Title = "15N ("+N_15+"%)";
     }); 
    }
    window.setTimeout(process_ticker,5);
   }
  }
 
  var updateCanvas = function() {
   Interface.Canvas.clear();
   var MS1Feature = Interface.SelectedFeature[5][0];
   var l = 0;
 
   var abuGraph = new HML.Plot.MS1FeatureRelAbundance(MS1Feature,["unlabelled","heavy"]);
   abuGraph.left += 40;
   Interface.Canvas.add(abuGraph);  

   var chromGraph = new HML.Plot.MS1FeatureChromatogram(MS1Feature,["unlabelled","heavy"]);
   chromGraph.left += 460;
   Interface.Canvas.add(chromGraph);

   ["unlabelled","heavy"].forEach(function(label) {
    if (!MS1Feature.Quant[label].QuantFailed) {
     var specGraph = new HML.Plot.MS1FeatureSpectrum(MS1Feature,label);
     specGraph.top  += 330;
     specGraph.left += 40+(l*420);
     Interface.Canvas.add(specGraph);
    }
    l++;
   });
  }
 
  return Interface;

 }();

});