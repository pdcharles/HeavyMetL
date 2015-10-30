document.addEventListener( "DOMContentLoaded", function() {
 
 if (typeof HML == 'undefined') {
  HML = {};
 }
 HML.Interface = function() {

  var IdList = document.getElementById("input-identifications");
  IdList.Ready = 1;
  var RawFiles = document.getElementById("input-raw-files");
  var Settings = document.getElementById("input-settings");
  var ProteinTable = document.getElementById("proteins-table");
  ProteinTable.Ready = 0;
  ProteinTable.selectedFeature = undefined;
  ProteinTable.allFeatures = [];
  var FileTabs = document.getElementById("file-tab-list");
  FileTabs.Ready = 0;
  FileTabs.selectedFile = undefined;
  FileTabs.allFiles = [];
  var ProcessAll = document.getElementById("process-all");
  ProcessAll.className = "disabled";
  var ProcessSelected = document.getElementById("process-selected");
  ProcessSelected.className = "disabled";
  var Processing = {};
  Processing.Lock = 0;
  var ProgressOverlay = document.getElementById("progress-overlay");
  var progressBar = document.getElementById("progress-bar");
  var Results = {};
 
  var Canvas = new fabric.Canvas('graphics-canvas',{hoverCursor: 'pointer',backgroundColor: 'rgb(255,255,255)'});
  function resizeCanvas() {
   Canvas.setHeight(Canvas.wrapperEl.parentElement.offsetHeight);
   Canvas.setWidth(Canvas.wrapperEl.parentElement.offsetWidth);
   Canvas.renderAll();
   Canvas.calcOffset();
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
  
  
  var waitForReady = function(obj,waitfunc,waitargs,endfunc,endargs) {
   window.setTimeout(waitForReadyTicker.bind(obj,waitfunc,waitargs,endfunc,endargs), 0);
  }
  
  var waitForReadyTicker = function(waitfunc,waitargs,endfunc,endargs) {
   if (waitfunc) {
    waitfunc.bind(this,waitargs)();
   }
   if (this.Ready && endfunc) {
    endfunc.bind(this,endargs)();
   }
   else {
    window.setTimeout(waitForReadyTicker.bind(this,waitfunc,waitargs,endfunc,endargs), 10);
   }
  }
 
  var monitorIndexing = function(fileTab) {
   if (fileTab.file.Ready) {
    fileTab.style.background = "lightgreen";
   }
   else {
    var p = Math.round(fileTab.file.Progress);
    fileTab.style.background = "linear-gradient(90deg, lightgreen "+p+"%, pink 1%, pink "+(100-p-1)+"%)";
    window.setTimeout(monitorIndexing, 1000, fileTab);
   }
  }
 
  var waitForIndexingComplete = function() {
   if (FileTabs.allFiles.every(function(file) { return file.Ready })) {
    FileTabs.Ready = 1;
    if (FileTabs.childNodes.length == 1) {
     FileTabs.childNodes[0].click();
    }
    checkProcessAll()
   }
   else {
    window.setTimeout(waitForIndexingComplete, 10);
   }
  }
 
  var checkProcessAll = function() {
   if (ProteinTable.Ready && FileTabs.Ready) {
    ProcessAll.className = ProcessAll.className.replace(/(?:^|\s)disabled(?!\S)/g,"");
   }
   else {
    ProcessAll.className = "disabled";
   }
  }
 
  var showAsSelected = function(el) {
   var scope;
   if (el.nodeName == "TD") {
    scope = ProteinTable;
   }
   else {
    scope = FileTabs;
   }
   Array.prototype.slice.call(scope.getElementsByClassName("selected")).forEach(function(node) {
    node.className = node.className.replace(/(?:^|\s)selected(?!\S)/g,"");
   });
   el.className = "selected";
  }
 
  var checkProcessSelected = function() {
   if (ProteinTable.selectedFeature && FileTabs.selectedFile) {
    ProcessSelected.className = ProcessSelected.className.replace(/(?:^|\s)disabled(?!\S)/g,"");
    if (ProteinTable.selectedFeature[5]) {
     updateCanvas()
    }
   }
   else {
    ProcessSelected.className = "disabled";
   }
  }
  
  IdList.addEventListener('click', function(e) {
   if (Processing.Lock) return;
   if (!IdList.Ready) return;
   e.target.fileSelect = document.createElement('input');
   e.target.fileSelect.type = "file";
   e.target.fileSelect.accept = ".tsv";
   e.target.fileSelect.addEventListener('change', function(e) {
    IdList.Ready = 0;
    ProteinTable.innerHTML = "";
    ProteinTable.selectedFeature = undefined;
    ProteinTable.allFeatures = [];
    ProteinTable.Ready = 0;
    results = {};
    checkProcessAll();
    checkProcessSelected();
    if (e.target.files.length) {
     IdList.idFile = new HML.Format.TextFile(e.target.files[0]);
     IdList.idFile.Delimiter = "\t";
     IdList.idFile.UseFirstLineAsHeaders = 1;
     IdList.idFile.load();
     waitForReady(IdList.idFile,function(){
      },undefined,function(){
       IdList.protein_header = IdList.idFile.Headers.indexOf("PROTEIN_LOCUS");
       IdList.peptide_header = IdList.idFile.Headers.indexOf("PEPTIDE_SEQUENCE");
       IdList.feature_header = IdList.idFile.Headers.indexOf("PEPTIDE_FILE_NAME");
       IdList.scan_header = IdList.idFile.Headers.indexOf("PEPTIDE_SCAN_NUMBER");
       IdList.charge_header = IdList.idFile.Headers.indexOf("PEPTIDE_CHARGE");
       for (var i = 0, l; l = IdList.idFile.Lines[i]; i++) {
        var protein = l[IdList.protein_header];
        var peptide = l[IdList.peptide_header]; 
        var feature = l[IdList.feature_header];
        var scan = l[IdList.scan_header];
        var charge = l[IdList.charge_header];
        if (Results[protein]) {
         if (!Results[protein][peptide]) {
          Results[protein][peptide] = {};
         }
        }
        else {
         Results[protein] = {};
         Results[protein][peptide] = {};     
        }
        var featureData = [protein,peptide,feature,scan,charge]; //Will eventually hold quant as well
        Results[protein][peptide][feature] = featureData;
        ProteinTable.allFeatures.push(featureData);
       }
       IdList.Ready = 1;
      }
     );
     waitForReady(IdList,undefined,undefined,function() {
      Object.keys(Results).forEach(function(protein) {
       var protrow = ProteinTable.insertRow(-1);
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
         Object.keys(Results[protcell.protein]).forEach(function(peptide) {
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
            Object.keys(Results[protcell.protein][pepcell.peptide]).forEach(function(feature) {
             var featurerow = featuretable.insertRow(-1);
             var featurecell = featurerow.insertCell(0);
             featurecell.featureData = Results[protcell.protein][pepcell.peptide][feature];
             featurecell.appendChild(document.createTextNode(feature));
             featurecell.addEventListener('click', function(e) {
              var featurecell = e.target;
              ProteinTable.selectedFeature = featurecell.featureData;
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
      ProteinTable.Ready = 1;
      checkProcessAll();
     });
    }
   });
   e.target.fileSelect.click();
  });
  
  RawFiles.addEventListener('click', function(e) {
   if (Processing.Lock) return;
   FileTabs.innerHTML = "";
   FileTabs.selectedFile = undefined;
   FileTabs.Ready = 0;
   checkProcessAll();
   checkProcessSelected();
   e.target.fileSelect = document.createElement('input');
   e.target.fileSelect.type = "file";
   e.target.fileSelect.accept = ".mzML,.mzXML";
   e.target.fileSelect.multiple = true;
   e.target.fileSelect.addEventListener('change', function(e) {
    if (e.target.files.length) {
     for (var i = 0, f; f = e.target.files[i]; i++) {
      var tab = document.createElement('a');
      tab.appendChild(document.createTextNode(f.name));
      tab.file = new HML.Quantifier.IndexedMzFile(f);
      FileTabs.allFiles.push(tab.file);
      monitorIndexing(tab);
      tab.addEventListener('click', function(e) {
       var tab = e.target;
       if (tab.file.Ready) {
        FileTabs.selectedFile = tab.file;
        showAsSelected(tab);
        checkProcessSelected();
       }
       e.stopPropagation();
      });
      FileTabs.appendChild(tab);
     }
     waitForIndexingComplete();
    }
   });
   e.target.fileSelect.click();
  });
  
  Settings.addEventListener('click', function() {
   document.getElementById("settings-pane-overlay").style.visibility="visible";
  });
  
  document.getElementById("settings-close").addEventListener('click', function() {
   ProteinTable.allFeatures.forEach(function(featureData) {delete featureData[5]});
   document.getElementById("settings-pane-overlay").style.visibility="hidden";
  });
 
  var start_processing = function(selectedOnly) {
   if (Processing.Lock) return;
   Processing = {};
   Processing.Lock = 1;
   Processing.selectedOnly = selectedOnly;
   Processing.features = selectedOnly ? [ProteinTable.selectedFeature] : ProteinTable.allFeatures;
   Processing.files = selectedOnly ? [FileTabs.selectedFile] : FileTabs.allFiles;
   Processing.features_n = 0;
   Processing.files_n = 0;
   Processing.ppmError = 10;
   Processing.RTError = 3;
   process_ticker(Processing);
  }
 
  ProcessSelected.addEventListener('click', start_processing.bind(null, 1));
  ProcessAll.addEventListener('click', start_processing.bind(null, 0));
 
  var process_ticker = function(Processing) {
   if (Processing.features_n >= Processing.features.length) {
    ProgressOverlay.style.visibility="hidden";
    if (Processing.selectedOnly) {
     updateCanvas();
    }
    console.log(Processing);
    Processing.Lock = 0;
   }
   else {
    if (Processing.files_n >= Processing.files.length) {
     Processing.files_n = 0;
     Processing.features_n++;
    }
    else if(Processing.features[Processing.features_n][5]) {
     if(Processing.features[Processing.features_n][5][Processing.files_n]) {
      if (Processing.features[Processing.features_n][5][Processing.files_n].Ready) {
       Processing.files_n++;
      }
      else {
       var quant_progress = Processing.features[Processing.features_n][5][Processing.files_n].Progress;
       Processing.progress = ((Processing.features_n * Processing.files.length) + Processing.files_n + (quant_progress/100))/(Processing.features.length * Processing.files.length) * 100;
       progressBar.style.background = "linear-gradient(90deg, lightblue "+Processing.progress+"%, lightgrey 1%, lightgrey "+(100-Processing.progress-1)+"%)";
       progressBar.innerHTML = Processing.progress.toFixed(2)+"%";
      }
     }
     else {
      Processing.RT = Processing.files[Processing.files_n].MS1Scans[Processing.files[Processing.files_n].getNearestMS1fromScan(Processing.features[Processing.features_n][3],true)].retentionTime;
      Processing.features[Processing.features_n][5][Processing.files_n] = new HML.Quantifier.Feature(Processing.files[Processing.files_n],Processing.extractions,Processing.ppmError,Processing.RT-Processing.RTError,Processing.RT+Processing.RTError);
     }
    }
    else {
     ProgressOverlay.style.visibility="visible";
     Processing.features[Processing.features_n][5] = []
     Processing.extractions = {};
     Processing.sequence = Processing.features[Processing.features_n][1];
     Processing.sequence = Processing.sequence.replace(/^[\w-]?\.|\.[\w-]$/g,"");
     Processing.charge = Processing.features[Processing.features_n][4];
 
     Processing.extractions.unlabelled = [new HML.IsoCalc.Peptide({sequence:Processing.sequence,charge:Processing.charge}).get_centroided_distribution(10).isotopes];
 
     Processing.extractions.heavy = [];
     var altEleConst = {};
     altEleConst["Nitrogen"] = JSON.parse(JSON.stringify(HML.IsoCalc.ElementalConstants["Nitrogen"]));
     for (var N_15 = 95; N_15 <= 100; N_15++) {
      altEleConst["Nitrogen"].isotopes[0][1] = 100 - N_15;
      altEleConst["Nitrogen"].isotopes[1][1] = N_15;
      Processing.extractions.heavy.push(new HML.IsoCalc.Peptide({sequence:Processing.sequence,charge:Processing.charge}).get_centroided_distribution(10,altEleConst).isotopes);
     }
 
    }
    window.setTimeout(process_ticker,5,Processing);
   }
  }
 
  var updateCanvas = function() {
   Canvas.clear();
   var results = ProteinTable.selectedFeature;
   var charge = results[4];
   var quant = results[5].slice(-1)[0].Quant;
   var l = 0;
   ["unlabelled","heavy"].forEach(function(label) {
    var specGraph = new HML.Plot.Spectrum(quant[label].IntegratedSpectrum);
    specGraph.left += l*420;
    Canvas.add(specGraph);
    var chromGraph = new HML.Plot.Chromatogram(quant[label].Chromatogram);
    chromGraph.left += l*420;
    chromGraph.top += 260;
    Canvas.add(chromGraph);
    l++;
   });
  }
 
  return {
   Canvas: Canvas,
   IdList: IdList,
   RawFiles: RawFiles,
   Settings: Settings,
   ProteinTable: ProteinTable,
   FileTabs: FileTabs,
   ProgressOverlay : ProgressOverlay,
   Processing: Processing,
   Results: Results
  }

 }();

});