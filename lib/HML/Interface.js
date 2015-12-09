"use strict";

if (typeof HML == 'undefined') var HML = {};

document.addEventListener( "DOMContentLoaded", function() {

 HML.Interface = function() {

  var Interface = {};

  //Element bindings
  Interface.RawFiles = document.getElementById("input-raw-files");
  Interface.FileTabs = document.getElementById("file-tab-list");
  Interface.IdList = document.getElementById("input-identifications");
  Interface.ProteinTableContainer = document.getElementById("protein-table-container");
  Interface.ProteinTable = document.getElementById("protein-table");
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
  Interface.ProgressOverlay = document.getElementById("progress-overlay");
  Interface.ProgressOverlay.ProgressBar = document.getElementById("progress-bar");
  Interface.Canvas = new fabric.Canvas('graphics-canvas',{hoverCursor: 'pointer',backgroundColor: 'rgb(255,255,255)'});

  //Other variables
  Interface.SelectedTab = undefined;
  Interface.AllFiles = {};
  Interface.SelectedFeature = undefined;
  Interface.AllFeatures = [];
  Interface.Processing = {};
  Interface.Results = {};

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

  //Initial state
  enable(Interface.RawFiles);
  disable(Interface.IdList);
  disable(Interface.ProcessAll);
  disable(Interface.ProcessSelected);
  disable(Interface.DownloadProteins);
  disable(Interface.DownloadPeptides);
  disable(Interface.SaveAsPNG);
  disable(Interface.SaveAsSVG);

  Interface.RawFiles.Ready = 1;
  Interface.IdList.Ready = 1;
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
   Interface.ProgressOverlay.ProgressBar.style.background = "linear-gradient(90deg, lightblue "+p+"%, lightgrey 1%, lightgrey "+(100-p-1)+"%)";
   Interface.ProgressOverlay.ProgressBar.innerHTML = p.toFixed(2)+"%";
  };
 
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
   if ((Interface.FileTabs.childNodes.length ==  Interface.RawFiles.FileSelect.files.length) && (Object.keys(Interface.AllFiles).every(function(fname) { return Interface.AllFiles[fname].Ready }))) {
    Interface.RawFiles.Ready = 1;
    if (Interface.FileTabs.childNodes.length == 1) HML.Common.waitUntil(function() {return true},function() {Interface.FileTabs.childNodes[0].click();enable(Interface.IdList)});
    else enable(Interface.IdList);
   }
   else window.setTimeout(waitForIndexingComplete, 4);
  };

  //Status tests
  var checkAvailableFiles = function(files) {
   Array.prototype.slice.call(Interface.FileTabs.childNodes).forEach(function(ele) {
    if (files.indexOf(ele.fname) >= 0) enable(ele);
    else disable(ele);
   });
  };
  var checkSelected = function() {
   Interface.Canvas.clear();
   if (Interface.SelectedFeature && Interface.SelectedTab && Interface.SelectedFeature[Interface.SelectedTab.fname] && Interface.SelectedFeature[Interface.SelectedTab.fname].Result) {
    drawCanvas();
    enable(Interface.SaveAsPNG);
    enable(Interface.SaveAsSVG);
   }
   else {
    disable(Interface.SaveAsPNG);
    disable(Interface.SaveAsSVG);
    if (Interface.SelectedFeature && Interface.SelectedTab && Interface.SelectedFeature[Interface.SelectedTab.fname]) enable(Interface.ProcessSelected);
    else disable(Interface.ProcessSelected);
   }
  };
  var setSelected = function(el) {
   var scope = (el.nodeName == "TD" ? Interface.ProteinTable : Interface.FileTabs);
   Array.prototype.slice.call(scope.getElementsByClassName("selected")).forEach(function(node) {
    removeClass(node,"selected");
   });
   addClass(el,"selected");
  };

  Interface.RawFiles.addEventListener('click', function() {
   if (!Interface.RawFiles.Ready) return;
   if (Interface.Processing.Lock) return;
   Interface.RawFiles.FileSelect = document.createElement('input');
   Interface.RawFiles.FileSelect.type = "file";
   Interface.RawFiles.FileSelect.accept = ".mzML,.mzXML,.raw";
   Interface.RawFiles.FileSelect.multiple = true;
   Interface.RawFiles.FileSelect.addEventListener('change', function(e) {
    Interface.RawFiles.Ready = 0;
    Interface.FileTabs.innerHTML = "";
    Interface.SelectedFile = undefined;
    Interface.AllFiles = {};
    disable(Interface.IdList);
    Interface.ProteinTable.innerHTML = "";
    Interface.SelectedFeature = undefined;
    Interface.AllFeatures = [];
    disable(Interface.ProcessAll);
    Interface.Results = {};
    disable(Interface.DownloadProteins);
    disable(Interface.DownloadPeptides);
    if (Interface.RawFiles.FileSelect.files.length) {
     for (var i = 0, f; f = Interface.RawFiles.FileSelect.files[i]; i++) {
      var tab = document.createElement('a');
      tab.appendChild(document.createTextNode(f.name));
      tab.fname = f.name.replace(/\.(?:raw|mzML|mzXML)$/,"");;
      if (f.name.match(/\.raw$/i)) {
       tab.file = new HML.Format.ThermoRawFile(f);
      }
      else {
       tab.file = new HML.Format.MzFile(f);
      }
      Interface.AllFiles[tab.fname] = tab.file;
      tab.addEventListener('click', function(e) {
       var tab = e.target;
       if (tab.file.Ready) {
        Interface.SelectedTab = tab;
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
     waitForIndexingComplete();
    }
   });
   Interface.RawFiles.FileSelect.click();
  });
  
  Interface.IdList.addEventListener('click', function() {
   if (Interface.IdList.disabled) return;
   if (!Interface.IdList.Ready) return;
   if (Interface.Processing.Lock) return;
   Interface.IdList.FileSelect = document.createElement('input');
   Interface.IdList.FileSelect.type = "file";
   Interface.IdList.FileSelect.accept = ".tsv";
   Interface.IdList.FileSelect.addEventListener('change', function(e) {
    Interface.IdList.Ready = 0;
    Interface.ProteinTable.innerHTML = "";
    Interface.SelectedFeature = undefined;
    Interface.AllFeatures = [];
    disable(Interface.ProcessAll);
    Interface.Results = {};
    disable(Interface.DownloadProteins);
    disable(Interface.DownloadPeptides);
    if (Interface.IdList.FileSelect.files.length) {
     Interface.IdList.idFile = new HML.Format.TextFile(e.target.files[0]);
     Interface.IdList.idFile.Delimiter = "\t";
     Interface.IdList.idFile.UseFirstLineAsHeaders = 1;
     Interface.IdList.idFile.load();
     HML.Common.waitUntil(function(){return Interface.IdList.idFile.Ready},function(){
      var H = Interface.IdList.HeaderIndices = {      
       protein       : Interface.IdList.idFile.Headers.indexOf("PROTEIN"),
       peptide       : Interface.IdList.idFile.Headers.indexOf("PEPTIDE_SEQUENCE"),
       unique        : Interface.IdList.idFile.Headers.indexOf("IS_UNIQUE"),
       fname         : Interface.IdList.idFile.Headers.indexOf("FILE_NAME"),
       allruns       : Interface.IdList.idFile.Headers.indexOf("QUANTIFY_ALL_RUNS"),
       scan          : Interface.IdList.idFile.Headers.indexOf("SCAN_NUMBER"),
       rt            : Interface.IdList.idFile.Headers.indexOf("RETENTION_TIME"),
       modifications : Interface.IdList.idFile.Headers.indexOf("MODIFICATIONS"),
       charge        : Interface.IdList.idFile.Headers.indexOf("CHARGE")
      }
      if ((H.protein < 0) || (H.peptide < 0) || (H.fname < 0) || ((H.scan < 0) && (H.rt < 0)) || (H.charge < 0)) {
       console.log("Failed to parse IDs");
       return;
      }  
      for (var i = 0, L; L = Interface.IdList.idFile.Lines[i]; i++) {
       var protein = L[H.protein];
       if (!protein) continue;
       var peptide = L[H.peptide]; 
       if (!peptide) continue;
       var unique = H.unique >= 0 ? L[H.unique] : true;
       var fname = L[H.fname];
       fname = fname.replace(/\.(?:raw|mzML|mzXML)$/,"");
       if (!fname) continue;
       if (fname && (Object.keys(Interface.AllFiles).indexOf(fname) < 0)) {
        console.log("Warning: file "+fname+" not found, skipping line "+(i+1));
        continue;
       }
       var allruns = H.allruns >= 0 ? L[H.allruns] : null;
       var scan = H.scan >= 0 ? L[H.scan] : null;
       var ms1rt,idrt;
       if (H.rt >= 0) {
        ms1rt = Interface.AllFiles[fname].getNearestMSXRTfromRT(1,L[H.rt],true);
        idrt = Interface.AllFiles[fname].getNearestMSXRTfromRT(2,L[H.rt],true);
       }
       else {
        ms1rt = Interface.AllFiles[fname].getNearestMSXRTfromScanNumber(1,scan,true);
        idrt = Interface.AllFiles[fname].getNearestMSXRTfromScanNumber(2,scan,true);
       }
       if (idrt == null) idrt = ms1rt;
       var modifications = H.modifications >= 0 ? L[H.modifications] : "";
       var charge = L[H.charge];
       charge = parseInt(charge.toString().replace(/\+$/,"")); //remove trailing +
       if (!Interface.Results[protein]) {
        Interface.Results[protein] = {};
        Interface.Results[protein][peptide] = [];  
       }
       else if (!Interface.Results[protein][peptide]) {
        Interface.Results[protein][peptide] = [];
       }
       (allruns ? Object.keys(Interface.AllFiles) : [fname]).forEach(function(fn) { //create duplicate features for every file if allruns flag set
        var featureData = { //Will eventually hold quant as well
         Protein       : protein,
         Peptide       : peptide,
         Unique        : unique,
         FileName      : fn,
         OrigFileName  : fname,
         ScanNumber    : scan,
         MS1RT         : ms1rt,
         IDRT          : idrt,
         Modifications : modifications,
         Charge        : charge
        };
        Interface.Results[protein][peptide].push(featureData);
        Interface.AllFeatures.push(featureData);
       });
      }
      Interface.IdList.Ready = 1;
     });
     HML.Common.waitUntil(function(){return Interface.IdList.Ready},function() {
      Object.keys(Interface.Results).sort().forEach(function(protein) {
       var protrow = Interface.ProteinTable.insertRow(-1);
       var protcell = protrow.insertCell(0);
       protcell.appendChild(document.createTextNode(protein));
       protcell.expanded = 0;
       protcell.addEventListener('click', function(e) {
        e.stopPropagation();
        var protcell = e.target;
        protcell.innerHTML = "";
        protcell.appendChild(document.createTextNode(protein));
        if (protcell.expanded) {
         protcell.expanded = 0;
        }
        else {
         var peptable = document.createElement("table");
         var scrollToView = function() {
          Interface.ProteinTableContainer.scrollTop = peptable.parentNode.offsetTop ;// + peptable.parentNode.offsetHeight - Interface.ProteinTableContainer.offsetHeight;
         }
         Object.keys(Interface.Results[protein]).sort().forEach(function(peptide) {
          var peprow = peptable.insertRow(-1);
          var pepcell = peprow.insertCell(0);
          pepcell.appendChild(document.createTextNode(peptide));
          pepcell.expanded = 0;
          pepcell.addEventListener('click', function(e) {
           e.stopPropagation();
           var pepcell = e.target;
           pepcell.innerHTML = "";
           pepcell.appendChild(document.createTextNode(peptide));
           if (pepcell.expanded) {
            pepcell.expanded = 0;
           }
           else {
            var featuretable = document.createElement("table");
            var charge_and_mods = {};
            Interface.Results[protein][peptide].forEach(function(feature) {
             if (!charge_and_mods[feature.Charge]) {
              charge_and_mods[feature.Charge] = {};
              charge_and_mods[feature.Charge][feature.Modifications] = [];
             }
             else if (!charge_and_mods[feature.Charge][feature.Modifications]) {
              charge_and_mods[feature.Charge][feature.Modifications] = [];
             }
             charge_and_mods[feature.Charge][feature.Modifications].push(feature);
            });
            Object.keys(charge_and_mods).forEach(function(charge) {
             Object.keys(charge_and_mods[charge]).forEach(function(modifications) {
              var featurerow = featuretable.insertRow(-1);
              var featurecell = featurerow.insertCell(0);
              featurecell.appendChild(document.createTextNode("["+charge+"+] "+(modifications ? modifications : "No mods")));
              featurecell.featureData = {};
              charge_and_mods[charge][modifications].forEach(function(feature) {
               featurecell.featureData[feature.FileName] = feature;
              });
              featurecell.addEventListener('click', function(e) {
               e.stopPropagation();
               var featurecell = e.target;
               Interface.SelectedFeature = featurecell.featureData;
               setSelected(featurecell);
               checkAvailableFiles(Object.keys(Interface.SelectedFeature));
               checkSelected();
               e.stopPropagation();
              });
             });
            });
            pepcell.appendChild(featuretable);
            if ((Interface.ProteinTableContainer.scrollTop + Interface.ProteinTableContainer.offsetHeight) > (peptable.offsetTop + featuretable.offsetTop + featuretable.offsetHeight)) {
             scrollToView();
            }
            pepcell.expanded = 1;
           }
          });
         });
         protcell.appendChild(peptable);
         if ((Interface.ProteinTableContainer.scrollTop + Interface.ProteinTableContainer.offsetHeight) > (peptable.offsetTop + peptable.offsetHeight)) {
          scrollToView();
         }
         protcell.expanded = 1;
        }
       });
      });
      enable(Interface.ProcessAll);
     });
    }
   });
   Interface.IdList.FileSelect.click();
  });
  
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
   }
   hide(Interface.SettingsDialog);
  });
 
  var startProcessing = function(e) {
   if (e.target.disabled) return;
   if (Interface.Processing.Lock) return;
   Interface.Processing = {};
   Interface.Processing.Lock = 1;
   Interface.Processing.SelectedOnly = e.target.SelectedOnly;
   Interface.Processing.Features = e.target.SelectedOnly ? [Interface.SelectedFeature[Interface.SelectedTab.fname]] : Interface.AllFeatures;
   if (e.target.SelectedOnly) {
    Interface.Processing.Files = {};
    Interface.Processing.Files[Interface.SelectedTab.fname] = Interface.SelectedTab.file;
   }
   else Interface.Processing.Files = Interface.AllFiles;
   Interface.Processing.FeatureIndex = 0;
   show(Interface.ProgressOverlay);
   setProgressBar(0);
   processTicker(Interface.Processing);
  }
  Interface.ProcessAll.addEventListener('click', startProcessing);
  Interface.ProcessSelected.SelectedOnly = true;
  Interface.ProcessSelected.addEventListener('click', startProcessing);
 
  var processTicker = function() {
   var p = Interface.Processing; 
   if (p.FeatureIndex >= p.Features.length) {
    hide(Interface.ProgressOverlay);
    if (p.SelectedOnly) checkSelected();
    else {
     enable(Interface.DownloadProteins);
     enable(Interface.DownloadPeptides);
    }
    p.Lock = 0;
   }
   else if (!p.Features[p.FeatureIndex].Result) {
    var extractions = {};
    var sequence = p.Features[p.FeatureIndex].Peptide;
    sequence = sequence.replace(/^[\w-]?\.|\.[\w-]$/g,"");
    var charge = p.Features[p.FeatureIndex].Charge;
    extractions.unlabelled = [new HML.IsoCalc.Peptide({sequence:sequence,charge:charge}).get_centroided_distribution(10).as_spectrum()];
    extractions.unlabelled[0].Incorporation = 0;
    extractions.heavy = [];
    var altEleConst = {};
    altEleConst["Nitrogen"] = JSON.parse(JSON.stringify(HML.IsoCalc.ElementalConstants["Nitrogen"])); //Ensure full copy
    for (var N_15 = 95; N_15 < 100; N_15++) {
     altEleConst["Nitrogen"].isotopes[0][1] = 100 - N_15;
     altEleConst["Nitrogen"].isotopes[1][1] = N_15;
     extractions.heavy.push(new HML.IsoCalc.Peptide({sequence:sequence,charge:charge}).get_centroided_distribution(10,altEleConst).as_spectrum());
    }
    extractions.heavy.forEach(function(ex) {
     ex.Incorporation = N_15;
    });
    p.Features[p.FeatureIndex].Result = new HML.Quantifier.MS1Feature(
                                             p.Files[p.Features[p.FeatureIndex].FileName],
                                             extractions,
                                             +HML.Config.PpmError,
                                             p.Features[p.FeatureIndex].MS1RT-(+HML.Config.RTSearchWindow),
                                             p.Features[p.FeatureIndex].MS1RT+(+HML.Config.RTSearchWindow),
                                             +HML.Config.RTMaxShift,
                                             +HML.Config.RTOrder
                                            );
    window.setTimeout(processTicker,4);    
   }
   else if (!p.Features[p.FeatureIndex].Result.Ready) {
    setProgressBar(((p.FeatureIndex + (p.Features[p.FeatureIndex].Result.Progress/100))/p.Features.length) * 100);
    window.setTimeout(processTicker,4);
   }
   else {
    delete p.Features[p.FeatureIndex].Result.CroppedRawSpectra;
    delete p.Features[p.FeatureIndex].Result.ExtractionMatches; 
    p.FeatureIndex++;
    HML.Common.waitUntil(function() {return true}, processTicker);  
   }
  };
 
  var drawCanvas = function() {
   var MS1Feature = Interface.SelectedFeature[Interface.SelectedTab.fname].Result;
   var abuGraph = new HML.Plot.MS1FeatureRelAbundance(MS1Feature,["unlabelled","heavy"]);
   abuGraph.left += 40;
   Interface.Canvas.add(abuGraph);
   var idrt = (Interface.SelectedFeature[Interface.SelectedTab.fname].OrigFileName == Interface.SelectedTab.fname ? Interface.SelectedFeature[Interface.SelectedTab.fname].IDRT : null);
   var chromGraph = new HML.Plot.MS1FeatureChromatogram(MS1Feature,["unlabelled","heavy"],idrt);
   chromGraph.left += 460;
   Interface.Canvas.add(chromGraph);
   var col = 0;
   ["unlabelled","heavy"].forEach(function(label) {
    if (!MS1Feature.Quant[label].Failed) {
     var specGraph = new HML.Plot.MS1FeatureSpectrum(MS1Feature,label);
     specGraph.top  += 340;
     specGraph.left += 40+(col*420);
     Interface.Canvas.add(specGraph);
    }
    col++;
   });
  }

  var createDownload = function(name, dURL) {
   this.href = dURL;
   this.download = name;
  }

  var downloadProteins = function(e) {
   if (e.target.disabled) return;
   var files = Object.keys(Interface.AllFiles);
   var labels = ["unlabelled","heavy"];
   var stats = {};
   var rows = [["PROTEIN"].concat(Array.concat.apply([],files.map(function(fname) {
    return labels.map(function(label) {
     return (fname+"_TOTAL_INTENSITY_"+label);
    }).concat(labels.map(function(label) {
     return (fname+"_RATIO_"+label+":"+labels[labels.length-1]);
    }).slice(0,-1));
   }))).join("\t")];
   show(Interface.ProgressOverlay);
   setProgressBar(0);
   var Proteins = Object.keys(Interface.Results).sort();
   rows = rows.concat(Proteins.map(function(protein,i) {
    var quantbyfile = files.map(function(fname) {
     stats[fname] = {};
     var quantbylabel = labels.map(function(label) {
      stats[fname][label] = {};
      stats[fname][label].Incorp = [];
      stats[fname][label].Distance = [];
      return Object.keys(Interface.Results[protein]).map(function(peptide) {
       return Interface.Results[protein][peptide].filter(function(F) {
        return ((F.FileName == fname) && F.Unique);
       }).map(function(F) {
        stats[fname][label].Incorp.push((F.Result && !F.Result.Quant[label].Failed) ? F.Result.Quant[label].MatchedDistributionIncorporation : null)
        if (F.OrigFileName == fname) stats[fname][label].Distance.push((F.Result && !F.Result.Quant[label].Failed) ? F.IDRT - F.Result.Quant[label].RT : null);
        return ((F.Result && !F.Result.Quant[label].Failed) ? F.Result.Quant[label].PermutationNormalisedIntensity : 0);
       }).reduce(function(a,b) {
        return a+b;
       },0);       
      }).reduce(function(a,b) {
       return a+b;
      },0);
     });
     return quantbylabel.concat(quantbylabel.map(function(q) {
      var denom = quantbylabel[quantbylabel.length-1];
      console.log([q,denom]);
      return (denom > 0 ? q/denom : "N/A");
     }).slice(0,-1));
    });
    setProgressBar(i/(Proteins.length-1)*100);
    return [protein].concat(Array.concat.apply([],quantbyfile)).join("\t");
   }));
   var metarows = [];
   metarows.push("PARAMETERS");
   Object.keys(HML.Config).sort().forEach(function(key) {
    metarows.push([key,JSON.stringify(HML.Config[key])].join("\t"));
   });
   metarows.push("");
   metarows.push("STATISTICS (Unique Peptides Only)");
   metarows.push([""].concat(Array.concat.apply([],files.map(function(fname) {
    return labels.map(function(label) {
     return fname+"_"+label;
    });
   }))).join("\t"));
   metarows.push(["MEAN_INCORPORATION"].concat(Array.concat.apply([],files.map(function(fname) {
    return labels.map(function(label) {
     var incorp = HML.Math.mean(stats[fname][label].Incorp);
     return (incorp != null ? incorp : "N/A")
    });
   }))).join("\t"));
   metarows.push(["MEAN_DISTANCE_TO_ID (from Peak Apex RT)"].concat(Array.concat.apply([],files.map(function(fname) {
    return labels.map(function(label) {
     var dist = HML.Math.mean(stats[fname][label].Distance);
     return (dist != null ? dist : "N/A")
    });
   }))).join("\t"));
   metarows.push("");
   rows = metarows.concat(rows);
   hide(Interface.ProgressOverlay);
   createDownload.call(e.target,"HML_proteins.tsv",URL.createObjectURL(new Blob([rows.join("\n")], {type: "text/tab-separated-values"})));
  }
  Interface.DownloadProteins.addEventListener('click', downloadProteins);

  var downloadPeptides = function(e) {
   if (e.target.disabled) return;
   var files = Object.keys(Interface.AllFiles);
   var labels = ["unlabelled","heavy"];
   var rows = [["PROTEIN","PEPTIDE","IS_UNIQUE","CHARGE","MODIFICATIONS"].concat(Array.concat.apply([],files.map(function(fname) {
    return labels.map(function(label) {
     return (fname+"_MEAN_INCORPORATION_"+label);
    }).concat(labels.map(function(label) {
     return (fname+"_TOTAL_PEAK_APEX_"+label);
    })).concat(labels.map(function(label) {
     return (fname+"_RATIO_"+label+":"+labels[labels.length-1]);
    }).slice(0,-1)).concat(labels.map(function(label) {
     return (fname+"_MEAN_APEX_DISTANCE_TO_ID_"+label);
    }));
   }))).join("\t")];
   show(Interface.ProgressOverlay);
   setProgressBar(0);
   var Proteins = Object.keys(Interface.Results).sort();
   rows = rows.concat(Array.concat.apply([],Proteins.map(function(protein,i) {
    return Array.concat.apply([],Object.keys(Interface.Results[protein]).map(function(peptide) {
     var charge_and_mods = {};
     Interface.Results[protein][peptide].forEach(function(feature) {
      if (!charge_and_mods[feature.Charge]) {
       charge_and_mods[feature.Charge] = {};
       charge_and_mods[feature.Charge][feature.Modifications] = [];
      }
      else if (!charge_and_mods[feature.Charge][feature.Modifications]) {
       charge_and_mods[feature.Charge][feature.Modifications] = [];
      }
      charge_and_mods[feature.Charge][feature.Modifications].push(feature);
     });
     return Array.concat.apply([],Object.keys(charge_and_mods).map(function(charge) {
      return Object.keys(charge_and_mods[charge]).map(function(modifications) {
       var quantbyfile = files.map(function(fname) {
        var filefeatures = charge_and_mods[charge][modifications].filter(function(F) {
         return (F.FileName == fname);
        });
        var incorpbylabel = labels.map(function(label) {
         var incorp =  HML.Math.mean(filefeatures.map(function(F) {
          return ((F.Result && !F.Result.Quant[label].Failed) ? F.Result.Quant[label].MatchedDistributionIncorporation : null);
         }));
         return (incorp != null ? incorp : "N/A");
        });
        var quantbylabel = labels.map(function(label) {
         return filefeatures.map(function(F) {
          return ((F.Result && !F.Result.Quant[label].Failed) ? F.Result.Quant[label].PermutationNormalisedIntensity : 0);
         }).reduce(function(a,b) {
          return a+b;
         },0);
        });
        var ratiobylabel = quantbylabel.map(function(q) {
         var denom = quantbylabel[quantbylabel.length-1];
         return (denom > 0 ? q/denom : "N/A");
        }).slice(0,-1);
        var distancebylabel = labels.map(function(label) {
         var rtdistance = HML.Math.mean(filefeatures.map(function(F) {
          if (F.OrigFileName == fname) return ((F.Result && !F.Result.Quant[label].Failed) ? F.IDRT - F.Result.Quant[label].RT : null);
          else return null;
         }));
         return (rtdistance != null ? rtdistance : "N/A");
        });
        return incorpbylabel.concat(quantbylabel).concat(ratiobylabel).concat(distancebylabel);
       });
       var isunique = charge_and_mods[charge][modifications].every(function(F) {return F.Unique});
       return [protein,peptide,isunique,charge,modifications].concat(Array.concat.apply([],quantbyfile)).join("\t");
      });
     }));
    }));
    setProgressBar(i/(Proteins.length-1)*100);
   })));
   hide(Interface.ProgressOverlay);
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