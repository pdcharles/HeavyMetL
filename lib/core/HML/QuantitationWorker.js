"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.QuantitationWorker = function() {

 var QuantitationWorker = function() {
  this.Worker = new MSLIB.Common.MSLIBWorker(WorkerURI);
  this.Worker.Ready = true;
  this.Worker.addEventListener("message", handleMessage);
 };
 QuantitationWorker.prototype.process = function(QuantTask) {
  if (this.Worker.Ready) {
   this.Worker.Ready = false;
   this.Worker.postMessage(["Process",QuantTask,HML.Config,HML.Interface.Processing.SelectedOnly]);
  }
 }
 
 var handleMessage = function(e) {
  if (e.data[0] == "TaskComplete") {
   e.stopImmediatePropagation();
   HML.Interface.addQuantResult(e.data[1],e.data[2],e.data[3])
   HML.Interface.Processing.TaskQueue.update();
   HML.Interface.Processing.Completed[e.data[1][4]]++;
  }
 }

 var WorkerInternal = function _SOURCE() {

  var onProcess = function(QuantTask,CurrentConfig,FullData) {

   var HML = {Config : CurrentConfig};

   var QuantRequest = QuantTask[0];
   var Protein = QuantRequest[0];
   var Peptide = QuantRequest[1];
   var Charge = QuantRequest[2];
   var ModString = QuantRequest[3];
   var FileName = QuantRequest[4];

   var Extractions = QuantTask[1];
   var SpectraData = QuantTask[2];

   var ExtractedSpectra = [Array(Extractions[0].length),Array(Extractions[1].length)];
   var ExtractedSpectraScaled = [Array(Extractions[0].length),Array(Extractions[1].length)];
   var ApexSpectrumIndices = [Array(Extractions[0].length),Array(Extractions[1].length)];
   var ApexSpectrumMatchScores = [Array(Extractions[0].length),Array(Extractions[1].length)];
   var Quant = [[],[]];
   if (FullData) var QuantExtended = [{},{}];
   var LastQuantRT = undefined;
   Extractions.forEach(function(E,Ei) {
    Extractions[Ei].forEach(function (TS,TSi) {
     ExtractedSpectra[Ei][TSi] = Array(SpectraData.length-2);
     ExtractedSpectraScaled[Ei][TSi] = Array(SpectraData.length-2);
     var TSTot = 0;
     var TSProplimit = 0;
     var TSInts = TS.ints.slice(0).sort((a,b) => (b-a));
     for (var i=0; i<=TSInts.length-1; i++) {
      TSTot += TSInts[i];
      if (TSTot > HML.Config._ConsiderIsotopologuesInTop) { TSProplimit = TSInts[i]; break; }
     }
     for (var Si = 1; Si < SpectraData.length-1; Si++) {
      var SummedInts = [];
      TS.mzs.forEach(function(mz) {
       var mzPpmErr = MSLIB.Math.ppmError(mz,HML.Config.PpmError);
       SummedInts.push(MSLIB.Data.Spectrum.prototype.getCroppedSpectrum.call({mzs:SpectraData[Si][0],ints:SpectraData[Si][1]},mz-mzPpmErr,mz+mzPpmErr).getTotalIntensity());
      });
      var SummedSpectrum = new MSLIB.Data.Spectrum(TS.mzs,SummedInts);
      SummedSpectrum.RT = SpectraData[Si][2];
      SummedSpectrum.TSi = TSi;
      ExtractedSpectra[Ei][TSi][Si-1] = SummedSpectrum;
      var ScaledSummedInts = [];
      var obs_expected_arr = SummedInts.map((inten,i) => [inten,TS.ints[i]]);
      var oe_filter_sort = obs_expected_arr.filter((oe) => (oe[0] && (oe[1] >= TSProplimit))).map((oe) => [oe[0]/oe[1],oe[1]]).sort((a,b) => (a[0] - b[0]));
      if (oe_filter_sort.length) {
       var smallest_ratio = oe_filter_sort[0][0];
       ScaledSummedInts = SummedInts.map((inten,i) => TS.ints[i] * smallest_ratio);
      }
      else {
       ScaledSummedInts = SummedInts.map(() => 0)
      }
      ExtractedSpectraScaled[Ei][TSi][Si-1] = new MSLIB.Data.Spectrum(TS.mzs,ScaledSummedInts);
     }
     var xic = (HML.Config._FindMaxIntensityByLowestIsotopologue 
                ? ExtractedSpectraScaled[Ei][TSi].map((sp) => sp.getTotalIntensity())
                : ExtractedSpectra[Ei][TSi].map((sp) => sp.getTotalIntensity()));
 
     var IsMax = MSLIB.Math.maxima(xic);
     var BestMaximum = ExtractedSpectra[Ei][TSi].reduce(function(RunningBest,S,Si) {
      if (!IsMax[Si]) return(RunningBest);
      else {
       if (HML.Config.RTOrder && LastQuantRT) {
        if (HML.Config.RTOrder == 1 && (S.RT < LastQuantRT)) return(RunningBest);
        if (HML.Config.RTOrder == -1 && (S.RT > LastQuantRT)) return(RunningBest);
       }
       if ((HML.Config.RTMaxShift && LastQuantRT) && (Math.abs(S.RT - LastQuantRT) > HML.Config.MaxShift )) return(RunningBest);
       var SignalEnhancedSpectrum = S.clone();
       if (Si > 0 && Si < ExtractedSpectra[Ei][TSi].length-1) {
        SignalEnhancedSpectrum.ints = SignalEnhancedSpectrum.ints.map(
         (mz,i) => (
          ExtractedSpectra[Ei][TSi][Si-1].ints[i] +
          ExtractedSpectra[Ei][TSi][Si].ints[i] +
          ExtractedSpectra[Ei][TSi][Si+1].ints[i]
         )
        );
       }
       var score = SignalEnhancedSpectrum.getNormalisedSpectralContrastAngleTo(TS,0);
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
     Quant[Ei] = [scaled_total_int,incorp,score];
     if (FullData) {
      QuantExtended[Ei].RT = rt;
      QuantExtended[Ei].Intensity = scaled_total_int;
      QuantExtended[Ei].Incorporation = incorp;    
      QuantExtended[Ei].Score = score;
      QuantExtended[Ei].Spectrum_mzs = spectrum.mzs;
      QuantExtended[Ei].Spectrum_ints = spectrum.ints;
      QuantExtended[Ei].ScaledSpectrum_mzs = scaled_spectrum.mzs;
      QuantExtended[Ei].ScaledSpectrum_ints = scaled_spectrum.ints;
      QuantExtended[Ei].Chromatogram_rts = ExtractedSpectra[Ei][BestTSi].map((S) => S.RT);
      QuantExtended[Ei].Chromatogram_ints = (HML.Config._FindMaxIntensityByLowestIsotopologue 
                                             ? ExtractedSpectraScaled[Ei][BestTSi]
                                             : ExtractedSpectra[Ei][BestTSi]).map((S) => S.getTotalIntensity());
     }
    }
    else {
     //console.log(BestMatchedDist);
    }
   });
   if (!FullData) {
    postMessage(["TaskComplete",QuantRequest,Quant]);
   }
   else {
    postMessage(["TaskComplete",QuantRequest,Quant,QuantExtended]);
   }
   postMessage(["Ready",true]);
  }

  return {
   onProcess : onProcess,
   _SOURCE : _SOURCE
  }

 }();

 var WorkerURI = MSLIB.Common.getMSLIBWorkerURI(function(e) {
   //HML.QuantitationWorker
   switch(e.data[0]) {
    case "Process" :
     WorkerInternal.onProcess(e.data[1],e.data[2],e.data[3]);
     break;
    default : self.postMessage(["Response","Unknown message type:"+e.data[0]]);
   }
  },
  [WorkerInternal],["WorkerInternal"]
 );

 return QuantitationWorker;

}();