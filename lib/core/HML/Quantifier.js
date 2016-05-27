"use strict";

if (typeof HML == 'undefined') var HML = {};
HML.Quantifier = function(){

 var MinimalKeys = ["Ready","DataLoaded","Quant"];

 var CurrentWorkers = 0;

 var MS1Feature = function(
                           MsDataFile,
                           Extractions,
                           RTStart,
                           RTEnd,
                           PpmError,
                           MaxShift,
                           Order,
                           FindMaxIntensityByLowestIsotopologue,
                           ConsiderIsotopologuesInTop,
                           MinimalMemory //if being run as batch, delete most parameters at the end to save memory
                          ) {
  this.Ready = false;
  this.Progress = 0;
  this.DataLoaded = 0;

  var Params = {  //Params for FeatureWorker
   PpmError : PpmError,
   MaxShift : MaxShift,
   Order : Order,
   FindMaxIntensityByLowestIsotopologue : FindMaxIntensityByLowestIsotopologue,
   ConsiderIsotopologuesInTop : ConsiderIsotopologuesInTop,
   MinimalMemory : MinimalMemory
  };


  if (!MinimalMemory) {
   this.MsDataFile = MsDataFile; //todo: need to check fetchAllScanHeaders has run
   this.Extractions = Extractions;
   this.RTStart = RTStart;
   this.RTEnd = RTEnd;
   this.Params = Params;
  }

  var FirstMS1ScanNumber = MsDataFile.getNearestMSXScanNumberfromRT(1,RTStart);
  var LastMS1ScanNumber = MsDataFile.getNearestMSXScanNumberfromRT(1,RTEnd,true);
  var MS1ScanNumbers = MsDataFile.Scans.slice(FirstMS1ScanNumber,LastMS1ScanNumber+1).filter((ele) => (ele.Scan.MsLevel == 1)).map((ele) => ele.Scan.ScanNumber);

  var all_min_mzs = [];
  var all_max_mzs = []
  Extractions.forEach(function(E) {
   E.forEach(function(TS) {
    if (TS.mzs.length) {
     all_min_mzs.push(TS.getMinMz());
     all_max_mzs.push(TS.getMaxMz());
    }
   });
  });
  
  var ExtractionMinMz = Math.min.apply(null,all_min_mzs);
  ExtractionMinMz -= MSLIB.Math.ppmError(ExtractionMinMz,PpmError)*2;
  var ExtractionMaxMz = Math.max.apply(null,all_max_mzs);
  ExtractionMaxMz += MSLIB.Math.ppmError(ExtractionMaxMz,PpmError)*2;

  var MS1SNi = 0;
  var RawSpectrumIndex = 0;
  var PreloadLength = 0;
 
  var RawSpectra = Array(LastMS1ScanNumber-FirstMS1ScanNumber);

  var MsReady = (() => MsDataFile.Ready).bind(this);

  //get all scans in this.MS1ScanNumbers
  var preloadData = (function() {
   if (MsDataFile.FileType== "mzML" || MsDataFile.FileType == "mzXML") {
    var ByteStart = MsDataFile.Scans[FirstMS1ScanNumber].Offset;
    var ByteEnd = MsDataFile.Scans[LastMS1ScanNumber].Offset + MsDataFile.Scans[LastMS1ScanNumber].Length;
    PreloadLength = ByteEnd - ByteStart;
    if (PreloadLength < 1e8) {
     MsDataFile.Reader.addEventListener("progress", preloadProgress);
     MsDataFile.Reader.readText(
      preloadingComplete,
      ByteStart,
      PreloadLength,
      true //prebuffer
     );
    }
   }
   else getFirstScan;
  }).bind(this);

  var preloadProgress = (function(e) {
   this.Progress = (e.loaded/PreloadLength)*25;
  }).bind(this)

  var preloadingComplete = (function() {
   MsDataFile.Reader.removeEventListener("progress", preloadProgress);
   getFirstScan();
  }).bind(this);

  var getFirstScan = (function() {
   MsDataFile.fetchScanHeader(MS1ScanNumbers[MS1SNi],true);
   MSLIB.Common.WaitUntil(MsReady,getNextScan);
  }).bind(this);

  var getNextScan = (function() {
   var cs = MsDataFile.CurrentScan;
   //Save processing time by only grabbing the relevant bit of the spectra.
   RawSpectra[RawSpectrumIndex] = cs.Spectrum.getCroppedSpectrum(ExtractionMinMz,ExtractionMaxMz);
   RawSpectra[RawSpectrumIndex].RT = cs.RetentionTime;
   RawSpectrumIndex++;   
   if (cs.ScanNumber < LastMS1ScanNumber) {
    if (PreloadLength) {  // extraction is about half of the work
     this.Progress = 25 + ((cs.ScanNumber-FirstMS1ScanNumber)/(LastMS1ScanNumber-FirstMS1ScanNumber))*25;
    }
    else {
     this.Progress = ((cs.ScanNumber-FirstMS1ScanNumber)/(LastMS1ScanNumber-FirstMS1ScanNumber))*50;
    }
    MsDataFile.fetchScanHeader(MS1ScanNumbers[++MS1SNi],true);
    MSLIB.Common.WaitUntil(MsReady,getNextScan);
   }
   else {
    MSLIB.Common.WaitUntil(() => (HML.Quantifier.getCurrentWorkers() < +HML.Config.MaxThreads),beginQuantification);
    this.DataLoaded = true;
   }
  }).bind(this);

  var beginQuantification = (function() {
   CurrentWorkers++;
   var worker = new Worker(MS1FeatureWorkerURI);
   worker.onmessage = handleWorkerMessage;
   worker.postMessage([Params,Extractions,RawSpectra]);
  }).bind(this);

  var handleWorkerMessage = (function(e) {
   if (e.data.length) {
    if (e.data[0]) {
     finaliseQuantification(e.data)
    }
    else {
     this.Progress = e.data[1];
    }
   }
  }).bind(this); 

  var finaliseQuantification = (function(data) {
   CurrentWorkers--;
   this.Quant = data[1];
   if (!MinimalMemory ) {
    this.QuantExtended = data[2];
   }
   this.Progress = 100;
   this.Ready = true;
  }).bind(this);
 
  MSLIB.Common.WaitUntil(MsReady,preloadData);
 }

 var MS1FeatureWorker = function(e) {
  var Params = e.data[0];
  var Extractions = e.data[1];
  var RawSpectra = e.data[2];
  var ExtractedSpectra = [Array(Extractions[0].length),Array(Extractions[1].length)];
  var ExtractedSpectraScaled = [Array(Extractions[0].length),Array(Extractions[1].length)];
  var ApexSpectrumIndices = [Array(Extractions[0].length),Array(Extractions[1].length)];
  var ApexSpectrumMatchScores = [Array(Extractions[0].length),Array(Extractions[1].length)];
  var Quant = [[],[]];
  if (!Params.MinimalMemory) var QuantExtended = [{},{}];
  var LastQuantRT = undefined;
  Extractions.forEach(function(E,Ei) {
   Extractions[Ei].forEach(function (TS,TSi) {
    postMessage([false,50+((Ei + TSi/E.length)/Extractions.length)*50]);
    ExtractedSpectra[Ei][TSi] = Array(RawSpectra.length);
    ExtractedSpectraScaled[Ei][TSi] = Array(RawSpectra.length);
    var TSTot = 0;
    var TSProplimit = 0;
    var TSInts = TS.ints.slice(0).sort((a,b) => (b-a));
    for (var i=0; i<=TSInts.length-1; i++) {
     TSTot += TSInts[i];
     if (TSTot > Params.ConsiderIsotopologuesInTop) { TSProplimit = TSInts[i]; break; }
    }
    for (var RSi = 0; RSi < RawSpectra.length; RSi++) {
     var RS = RawSpectra[RSi];
     var ExInts = [];
     TS.mzs.forEach(function(mz) {
      var mzPpmErr = MSLIB.Math.ppmError(mz,Params.PpmError);
      ExInts.push(MSLIB.Data.Spectrum.prototype.getCroppedSpectrum.call(RS,mz-mzPpmErr,mz+mzPpmErr).getTotalIntensity())
     });
     var croppedSpectrum = new MSLIB.Data.Spectrum(TS.mzs,ExInts);
     croppedSpectrum.RT = RS.RT
     croppedSpectrum.TSi = TSi;
     ExtractedSpectra[Ei][TSi][RSi] = croppedSpectrum;
     var ScaledInts = [];
     var obs_expected_arr = ExInts.map((inten,i) => [inten,TS.ints[i]]);
     var oe_filter_sort = obs_expected_arr.filter((oe) => (oe[0] && (oe[1] >= TSProplimit))).map((oe) => [oe[0]/oe[1],oe[1]]).sort((a,b) => (a[0] - b[0]));
     if (oe_filter_sort.length) {
      var smallest_ratio = oe_filter_sort[0][0];
      ScaledInts = ExInts.map((inten,i) => TS.ints[i] * smallest_ratio);
     }
     else {
      ScaledInts = ExInts.map(() => 0)
     }
     ExtractedSpectraScaled[Ei][TSi][RSi] = new MSLIB.Data.Spectrum(TS.mzs,ScaledInts);
    }
    var xic = (Params.FindMaxIntensityByLowestIsotopologue 
               ? ExtractedSpectraScaled[Ei][TSi].map((sp) => sp.getTotalIntensity())
               : ExtractedSpectra[Ei][TSi].map((sp) => sp.getTotalIntensity()));

    var IsMax = MSLIB.Math.maxima(xic);
    var BestMaximum = ExtractedSpectra[Ei][TSi].reduce(function(RunningBest,S,Si) {
     if (!IsMax[Si]) return(RunningBest);
     else {
      if (Params.Order && LastQuantRT) {
       if (Params.Order == 1 && (S.RT < LastQuantRT)) return(RunningBest);
       if (Params.Order == -1 && (S.RT > LastQuantRT)) return(RunningBest);
      }
      if ((Params.MaxShift && LastQuantRT) && (Math.abs(S.RT - LastQuantRT) > Params.MaxShift )) return(RunningBest);
      var score = S.getNormalisedSpectralContrastAngleTo(TS,0);
      if (score > RunningBest[1]) return([Si,score]);
      else return(RunningBest);
     }
    },[0,0]);
    if (BestMaximum[1]) {
     ApexSpectrumIndices[Ei][TSi] = BestMaximum[0];
     ApexSpectrumMatchScores[Ei][TSi] = BestMaximum[1];
    }
    else {
     ApexSpectrumMatchScores[Ei][TSi] = 0;
    }
   });
   var BestMatchedDist = ApexSpectrumMatchScores[Ei].reduce(function(RunningBest,ApexScore,ApexTSi) {
    if ((ApexScore > RunningBest[1])) {
     return([ApexTSi,ApexScore]);
    }
    else {
     return(RunningBest);
    }
   },[0,0]);
   if (BestMatchedDist[1]) {
    var BestTSi = BestMatchedDist[0];
    var ApexSi = ApexSpectrumIndices[Ei][BestTSi];
    var spectrum = ExtractedSpectra[Ei][BestTSi][ApexSi];
    var scaled_spectrum = ExtractedSpectraScaled[Ei][BestTSi][ApexSi];
    var rt = LastQuantRT = spectrum.RT;
    var scaled_total_int = scaled_spectrum.getTotalIntensity();
    var incorp = Extractions[Ei][BestTSi].Incorporation;
    var score = BestMatchedDist[1];
    Quant[Ei] = [rt,scaled_total_int,incorp,score];
    if (!Params.MinimalMemory) {
     QuantExtended[Ei].RT = rt;
     QuantExtended[Ei].Intensity = scaled_total_int;
     QuantExtended[Ei].Incorporation = incorp;    
     QuantExtended[Ei].Score = score;
     QuantExtended[Ei].Spectrum_mzs = spectrum.mzs;
     QuantExtended[Ei].Spectrum_ints = spectrum.ints;
     QuantExtended[Ei].ScaledSpectrum_mzs = scaled_spectrum.mzs;
     QuantExtended[Ei].ScaledSpectrum_ints = scaled_spectrum.ints;
     QuantExtended[Ei].Chromatogram_rts = ExtractedSpectra[Ei][BestTSi].map((S) => S.RT);
     QuantExtended[Ei].Chromatogram_ints = (Params.FindMaxIntensityByLowestIsotopologue 
                                            ? ExtractedSpectraScaled[Ei][BestTSi]
                                            : ExtractedSpectra[Ei][BestTSi]).map((S) => S.getTotalIntensity());
    }
   }
   else {
    console.log(BestMatchedDist);
   }
  });
  if (Params.MinimalMemory) {
   postMessage([true,Quant]);
  }
  else {
   postMessage([true,Quant,QuantExtended]);
  }
  close();
 };
 
 var MS1FeatureWorkerURI = URL.createObjectURL(new Blob([[
  "\"use strict\"",
  "var MSLIB={}",
  "MSLIB.Math=function(){"+Object.keys(MSLIB.Math).map((f) => "var "+f+"="+MSLIB.Math[f].toString()).join(";"),
  "return {"+Object.keys(MSLIB.Math).map((f) => f+":"+f).join(",")+"} }()",
  "MSLIB.Data={}",
  "MSLIB.Data.Spectrum=function(){ var Spectrum="+MSLIB.Data.Spectrum.toString(),
  Object.keys(MSLIB.Data.Spectrum.prototype).map((f) => "Spectrum.prototype."+f+"="+MSLIB.Data.Spectrum.prototype[f].toString()).join(";"),
  "return Spectrum }()",
  "onmessage="+MS1FeatureWorker.toString()
 ].join(";")]));

 var getCurrentWorkers = function() {
  return CurrentWorkers;
 }

 return {
  MS1Feature : MS1Feature,
  getCurrentWorkers : getCurrentWorkers
 }

}();