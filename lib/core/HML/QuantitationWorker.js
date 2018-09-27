"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.QuantitationWorker = function() {

 var QuantitationWorker = function() {
  this.worker = new Worker(workerURI);
  MSLIB.Common.initialise(this.worker);
  this.worker.addEventListener("message", (function(e) {
   if (e.data[0] == "taskComplete") {
    e.stopImmediatePropagation();
    var qR = new HML.QuantRequest(e.data[1]);
    HML.ui.featuresObject[qR.protein][qR.peptide][qR.charge][qR.modString][11][qR.fileName] = e.data[2];
    HML.ui.processing.completed[e.data[1][4]]++;
    MSLIB.Common.finish(this.worker);
    HML.ui.processing.taskQueue.update();
   }
  }).bind(this));
 };

 QuantitationWorker.prototype.process = function(quantTask) {
  if (!this.worker.ready) throw new Error("QuantitationWorkerNotReady");
  else {
   MSLIB.Common.start(this.worker);
   this.worker.postMessage(["process",quantTask,(HML.ui.processing.toDo == 1),HML.config]);
  }
 }

 var workerInterface = function(e) {
  //HML.QuantitationWorker
  switch(e.data[0]) {
   case "process" :
    workerInternal.onProcess(e.data[1],e.data[2],e.data[3]);
    break;
   default : self.postMessage(["response","Unknown message type:"+e.data[0]]);
  }
 }

 var workerInternal = function _SOURCE() {

  var onProcess = function(quantTask,fullData,currentConfig) {

   quantTask = new HML.QuantTask(quantTask);
   
   var quantRequest = quantTask.request;
   var protein = quantRequest.protein;
   var peptide = quantRequest.peptide;
   var charge = quantRequest.charge;
   var modString = quantRequest.modString;
   var fileName = quantRequest.fileName;

   var extractions = quantTask.extractions;
   var spectralData = quantTask.spectralData;

   quantTask = null;

   var extractedSpectra = extractions.map(e => Array(e.length));
   var extractedSpectraScaled = extractions.map(e => Array(e.length));
   var apexSpectrumIndices = extractions.map(e => Array(e.length));
   var apexSpectrumMatchScores = extractions.map(e => Array(e.length));
   var quant = (fullData? Array(9) : Array(8));
   if (fullData) quant[8] = [{},{}];
   var lastQuantRT = undefined;
   var mzCutoff = 0;
   extractions.forEach(function(e,ei) {
    var tsProplimit = Array(extractions[ei].length);
    extractions[ei].forEach(function (ts,tsi) {
     extractedSpectra[ei][tsi] = Array(spectralData.length);
     extractedSpectraScaled[ei][tsi] = Array(spectralData.length);
     var tsTot = 0;
     var tsints = ts.ints.slice(0).sort((a,b) => (b-a));
     for (var i=0; i<=tsints.length-1; i++) {
      tsTot += tsints[i];
      if (tsTot > currentConfig._considerIsotopologuesInTop) { tsProplimit[tsi] = tsints[i]; break; }
     }
//     if (ei==0) console.log(tsProplimit[tsi]);
     for (var si = 0; si < spectralData.length; si++) {
      var summedInts = [];
      ts.mzs.forEach(function(mz) {
       if (mz > mzCutoff) {
        var mzPpmErr = MSLIB.Math.ppmError(mz,currentConfig.ppmError);
        summedInts.push(MSLIB.Data.Spectrum.prototype.getCroppedSpectrum.call({mzs:spectralData[si][0],ints:spectralData[si][1]},mz-mzPpmErr,mz+mzPpmErr).getTotalIntensity());
       }
       else summedInts.push(0);
      });
      var summedSpectrum = new MSLIB.Data.Spectrum(ts.mzs,summedInts);
      summedSpectrum.rt = spectralData[si][2];
      summedSpectrum.tsi = tsi;
      extractedSpectra[ei][tsi][si] = summedSpectrum;
      var scaledSummedInts = [];
      var obsExpectedArr = summedInts.map((inten,i) => [inten,ts.ints[i]]);
      var oeFilterSort = obsExpectedArr.filter((oe) => (oe[0] && (oe[1] >= tsProplimit[tsi]))).map((oe) => oe[0]/oe[1]).sort((a,b) => (a - b));
//      if (ei==0) console.log(obsExpectedArr.filter((oe) => (oe[0] && (oe[1] >= tsProplimit[tsi]))));
      if (oeFilterSort.length) {
       var smallestRatio = oeFilterSort[0];
       scaledSummedInts = summedInts.map((inten,i) => ts.ints[i] * smallestRatio);
      }
      else {
       scaledSummedInts = summedInts.map(() => 0);
      }
      extractedSpectraScaled[ei][tsi][si] = new MSLIB.Data.Spectrum(ts.mzs,scaledSummedInts);
      extractedSpectraScaled[ei][tsi][si].propLim = tsProplimit[tsi];
     }
     var xic = (currentConfig._findMaxIntensityByLowestIsotopologue 
                ? extractedSpectraScaled[ei][tsi].map((sp) => sp.getTotalIntensity())
                : extractedSpectra[ei][tsi].map((sp) => sp.getTotalIntensity()));
 
     var isMax = MSLIB.Math.maxima(xic);
     var bestMaximum = extractedSpectra[ei][tsi].reduce(function(runningBest,s,si) {
      if (!isMax[si]) return(runningBest);
      else {
       if (lastQuantRT && currentConfig._rtOrder) {
        if ((s.rt < lastQuantRT) && currentConfig._rtOrder == 1) return(runningBest);
        if ((s.rt > lastQuantRT) && currentConfig._rtOrder == -1) return(runningBest);
       }
       if (lastQuantRT && (Math.abs(s.rt - lastQuantRT) > currentConfig.rtMaxShift )) return(runningBest);
       var score;
       if (si > 0 && si < extractedSpectra[ei][tsi].length-1) { //only use first and last spectra for enhancing signal
        signalEnhancedInts = s.ints.map(
         (inten,i) => (
          extractedSpectra[ei][tsi][si-1].ints[i] +
          inten +
          extractedSpectra[ei][tsi][si+1].ints[i]
         )
        );
        score = MSLIB.Data.Spectrum.prototype.getNormalisedKullbackLeiblerDivergenceFrom.call({mzs:s.mzs,ints:signalEnhancedInts},ts,0);
        if (score > runningBest[1]) return([si,score]);
        else return(runningBest);
       }
       else return(runningBest);
      }
     },[0,0]);
     if (bestMaximum[1]) {
      apexSpectrumIndices[ei][tsi] = bestMaximum[0];
      apexSpectrumMatchScores[ei][tsi] = bestMaximum[1];
     }
     else {
      apexSpectrumMatchScores[ei][tsi] = 0;
     }
    });
    var bestMatchedDist = apexSpectrumMatchScores[ei].reduce(function(runningBest,apexScore,apexTsi) {
     if ((apexScore > runningBest[1])) {
      return([apexTsi,apexScore]);
     }
     else {
      return(runningBest);
     }
    },[0,0]);
    if (bestMatchedDist[1]) {
     var bestTsi = bestMatchedDist[0];
     var apexSi = apexSpectrumIndices[ei][bestTsi];
     var spectrum = extractedSpectra[ei][bestTsi][apexSi];
     var scaledSpectrum = extractedSpectraScaled[ei][bestTsi][apexSi];

     quant[ei*4+0] = scaledSpectrum.getTotalIntensity(); //totalint
     quant[ei*4+1] = extractions[ei][bestTsi].incorporation; //incorp
     lastQuantRT = quant[ei*4+2] = spectrum.rt; //rt
     quant[ei*4+3] = bestMatchedDist[1]; //score

     if (fullData) {
      quant[8][ei].spectrumMzs = spectrum.mzs;
      quant[8][ei].spectrumInts = spectrum.ints;
      quant[8][ei].scaledSpectrumMzs = scaledSpectrum.mzs;
      quant[8][ei].scaledSpectrumInts = scaledSpectrum.ints;
      quant[8][ei].scaledSpectrumMinUsedInt = Math.min.apply(null,scaledSpectrum.ints.filter((mz,i) => extractions[ei][bestTsi].ints[i] >= scaledSpectrum.propLim));
      quant[8][ei].chromatogramRts = extractedSpectra[ei][bestTsi].map(s => s.rt);
      quant[8][ei].chromatogramInts = (currentConfig._findMaxIntensityByLowestIsotopologue 
                                        ? extractedSpectraScaled[ei][bestTsi]
                                        : extractedSpectra[ei][bestTsi]).map(s => s.getTotalIntensity());
     }
     //overlapping label correction (crop the raw spectra)
     if ((ei < (extractions.length-1)) && !currentConfig.labelledPeptidesOnly) {
      mzCutoff = Math.max.apply(null,extractions[ei][bestTsi].mzs.filter((mz,i) => (extractions[ei][bestTsi].ints[i] >= tsProplimit[bestTsi]))) || 0;
      mzCutoff += MSLIB.Math.ppmError(mzCutoff,currentConfig.ppmError)
     }
    }
    else {
     //console.log(bestMatchedDist);
    }
   });
   self.postMessage(["taskComplete",quantRequest.toArray(),quant]);
  }

  return {
   onProcess : onProcess,
   _SOURCE : _SOURCE
  }

 }();

 var workerURI = MSLIB.Common.getMSLIBWorkerURI(
  workerInterface,
  ["Common","Math","Data","Chromatogram","Spectrum","Scan"],
  [workerInternal,HML],["workerInternal","HML"],[undefined,["QuantRequest","QuantTask"]]
 );

 return QuantitationWorker;

}();