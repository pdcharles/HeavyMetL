"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.QuantitationWorker = function() {

 var QuantitationWorker = function() {
  this.Worker = new Worker(WorkerURI);
  MSLIB.Common.initialise.call(this.Worker);
  this.Worker.addEventListener("message", handleMessage.bind(this));
 };
 QuantitationWorker.prototype.process = function(QuantTask) {
  if (this.Worker.Ready) {
   MSLIB.Common.starting.call(this.Worker);
   this.Worker.postMessage(["Process",QuantTask,HML.Config,HML.Interface.Processing.SelectedOnly]);
  }
 }
 
 var handleMessage = function(e) {
  if (e.data[0] == "TaskComplete") {
   e.stopImmediatePropagation();
   HML.Interface.addQuantResult(e.data[1],e.data[2],e.data[3])
   HML.Interface.Processing.Completed[e.data[1][4]]++;
   MSLIB.Common.finished.call(this.Worker);
   HML.Interface.Processing.TaskQueue.update();
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
   var Quant = (FullData? Array(9) : Array(8));
   if (FullData) Quant[8] = [{},{}];
   var LastQuantRT = undefined;
   var MzCutoff = 0;
   Extractions.forEach(function(E,Ei) {
    var TSProplimit = Array(Extractions[Ei].length);
    Extractions[Ei].forEach(function (TS,TSi) {
     ExtractedSpectra[Ei][TSi] = Array(SpectraData.length);
     ExtractedSpectraScaled[Ei][TSi] = Array(SpectraData.length);
     var TSTot = 0;
     var TSInts = TS.ints.slice(0).sort((a,b) => (b-a));
     for (var i=0; i<=TSInts.length-1; i++) {
      TSTot += TSInts[i];
      if (TSTot > HML.Config._ConsiderIsotopologuesInTop) { TSProplimit[TSi] = TSInts[i]; break; }
     }
     for (var Si = 0; Si < SpectraData.length; Si++) {
      var SummedInts = [];
      TS.mzs.forEach(function(mz) {
       if (mz > MzCutoff) {
        var mzPpmErr = MSLIB.Math.ppmError(mz,HML.Config.PpmError);
        SummedInts.push(MSLIB.Data.Spectrum.prototype.getCroppedSpectrum.call({mzs:SpectraData[Si][0],ints:SpectraData[Si][1]},mz-mzPpmErr,mz+mzPpmErr).getTotalIntensity());
       }
       else SummedInts.push(0);
      });
      var SummedSpectrum = new MSLIB.Data.Spectrum(TS.mzs,SummedInts);
      SummedSpectrum.RT = SpectraData[Si][2];
      SummedSpectrum.TSi = TSi;
      ExtractedSpectra[Ei][TSi][Si] = SummedSpectrum;
      var ScaledSummedInts = [];
      var obs_expected_arr = SummedInts.map((inten,i) => [inten,TS.ints[i]]);
      var oe_filter_sort = obs_expected_arr.filter((oe) => (oe[0] && (oe[1] >= TSProplimit[TSi]))).map((oe) => [oe[0]/oe[1],oe[1]]).sort((a,b) => (a[0] - b[0]));
      if (oe_filter_sort.length) {
       var smallest_ratio = oe_filter_sort[0][0];
       ScaledSummedInts = SummedInts.map((inten,i) => TS.ints[i] * smallest_ratio);
      }
      else {
       ScaledSummedInts = SummedInts.map(() => 0)
      }
      ExtractedSpectraScaled[Ei][TSi][Si] = new MSLIB.Data.Spectrum(TS.mzs,ScaledSummedInts);
     }
     var xic = (HML.Config._FindMaxIntensityByLowestIsotopologue 
                ? ExtractedSpectraScaled[Ei][TSi].map((sp) => sp.getTotalIntensity())
                : ExtractedSpectra[Ei][TSi].map((sp) => sp.getTotalIntensity()));
 
     var IsMax = MSLIB.Math.maxima(xic);
     var BestMaximum = ExtractedSpectra[Ei][TSi].reduce(function(RunningBest,S,Si) {
      if (!IsMax[Si]) return(RunningBest);
      else {
       if (LastQuantRT && HML.Config.RTOrder) {
        if ((S.RT < LastQuantRT) && HML.Config.RTOrder == 1) return(RunningBest);
        if ((S.RT > LastQuantRT) && HML.Config.RTOrder == -1) return(RunningBest);
       }
       if (LastQuantRT && (Math.abs(S.RT - LastQuantRT) > HML.Config.RTMaxShift )) return(RunningBest);
       var score;
       if (Si > 0 && Si < ExtractedSpectra[Ei][TSi].length-1) {
        SignalEnhancedInts = S.ints.map(
         (inten,i) => (
          ExtractedSpectra[Ei][TSi][Si-1].ints[i] +
          inten +
          ExtractedSpectra[Ei][TSi][Si+1].ints[i]
         )
        );
        score = MSLIB.Data.Spectrum.prototype.getSimilarityScoreAgainst.call({mzs:S.mzs,ints:SignalEnhancedInts},TS,0)
       }
       else score = S.getSimilarityScoreAgainst(TS,0);
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
     var Spectrum = ExtractedSpectra[Ei][BestTSi][ApexSi];
     var ScaledSpectrum = ExtractedSpectraScaled[Ei][BestTSi][ApexSi];

     Quant[Ei*4+0] = ScaledSpectrum.getTotalIntensity(); //totalint
     Quant[Ei*4+1] = Extractions[Ei][BestTSi].Incorporation; //incorp
     LastQuantRT = Quant[Ei*4+2] = Spectrum.RT; //rt
     Quant[Ei*4+3] = BestMatchedDist[1]; //score

     if (FullData) {
      Quant[8][Ei].Spectrum_mzs = Spectrum.mzs;
      Quant[8][Ei].Spectrum_ints = Spectrum.ints;
      Quant[8][Ei].ScaledSpectrum_mzs = ScaledSpectrum.mzs;
      Quant[8][Ei].ScaledSpectrum_ints = ScaledSpectrum.ints;
      Quant[8][Ei].Chromatogram_rts = ExtractedSpectra[Ei][BestTSi].map((S) => S.RT);
      Quant[8][Ei].Chromatogram_ints = (HML.Config._FindMaxIntensityByLowestIsotopologue 
                                        ? ExtractedSpectraScaled[Ei][BestTSi]
                                        : ExtractedSpectra[Ei][BestTSi]).map((S) => S.getTotalIntensity());
     }
     //overlapping label correction (crop the raw spectra)
     if ((Ei < (Extractions.length-1)) && HML.Config._ExcludeLowerMassLabelMassesFromMatching) {
      MzCutoff = Math.max.apply(null,Extractions[Ei][BestTSi].mzs.filter((mz,i) => (Extractions[Ei][BestTSi].ints[i] >= TSProplimit[BestTSi]))) || 0;
      MzCutoff += MSLIB.Math.ppmError(MzCutoff,HML.Config.PpmError)
     }
    }
    else {
     //console.log(BestMatchedDist);
    }
   });
   postMessage(["TaskComplete",QuantRequest,Quant]);
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
  ["Common","Math","Data","Chromatogram","Spectrum","Scan"],
  [WorkerInternal],["WorkerInternal"]
 );

 return QuantitationWorker;

}();