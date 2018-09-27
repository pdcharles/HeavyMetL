"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.MsDataFileWorker = function() {

 var _MsDataFileWorker = function(file) {
  this.file = file;
  this.scans = null;
  this.quantRequests = null;
  this.dispatched = 0;
  this.worker = getNewWorker(this);
  MSLIB.Common.start(this.worker);
  this.worker.postMessage(["init",file]);
 }

 _MsDataFileWorker.prototype.restart = function(report) {
  this.worker.terminate();
  delete this.worker;
  if (this.quantRequests) {
   try {
    if (report) console.log("Restarting Worker " + this.file.name);
    this.worker = getNewWorker(this);
    this.worker.postMessage(["init",this.file,this.scans]);
    MSLIB.Common.whenReady(this.worker,() => {
     if (this.dispatched < this.quantRequests.length) this.prepareQuantTasks(this.quantRequests,this.dispatched);
     if (report) console.log("Worker " + this.file.name + " successfully restarted at dispatch index " + this.dispatched);
    });
   }
   catch(error) {
    console.log("Cannot restart Worker " + this.file.name + ": " + error.message);
   }
  }
 };
 _MsDataFileWorker.prototype.callFunc = function(funcName,args) {
  if (!this.worker.ready) throw new Error("MsDataFileWorkerNotReady");
  else {
   MSLIB.Common.start(this.worker);
   this.LastCall = [funcName,args];
   this.worker.postMessage(["callFunc",funcName,args]);
  }
 };
 _MsDataFileWorker.prototype.prepareQuantTasks = function(quantRequests,startIndex) {
  if (!this.worker.ready) throw new Error("MsDataFileWorkerNotReady");
  else {
   MSLIB.Common.start(this.worker);
   this.quantRequests = quantRequests;
   startIndex = startIndex || 0;
   this.dispatched = startIndex;
   this.worker.postMessage(["prepareQuantTasks",quantRequests,startIndex,HML.config]);
  }
 };
 _MsDataFileWorker.prototype.continue = function() {
  this.dispatched++;
  this.worker.postMessage(["continue",true]);
 };
 _MsDataFileWorker.prototype.reportInternals = function() {
  this.worker.postMessage(["reportInternals"]);
 };
 
 var getNewWorker = function(thisArg) {
  var worker = new Worker(workerURI);
  MSLIB.Common.initialise(worker);
  worker.lastMessageAcknowledged = null;
  worker.addEventListener("error", handleError.bind(thisArg));
  worker.addEventListener("message", handleMessage.bind(thisArg));
  return worker;
 }

 var handleError = function(e) {
  e.stopImmediatePropagation();
  console.log("Error detected in Worker " + this.file.name + ": " + e.message);
  if (e.message == "uncaught exception: out of memory") this.restart(true);
 };

 var handleMessage = function(e) {
  switch (e.data[0]) {
//   case "Error" :
//    e.stopImmediatePropagation();
//    console.log("Error sent from Worker " + this.file.name + ": " + e.data[1]);
//    break;
   case "acknowledge" :
    this.worker.lastMessageAcknowledged = e.data[1];
    break;
   case "initialised" :
    e.stopImmediatePropagation();
    if (e.data[1]) this.scans = e.data[1];
    MSLIB.Common.finish(this.worker);
    break;
   case "progress" :
    e.stopImmediatePropagation();
    MSLIB.Common.progress(this.worker,e.data[1]);
    break;
   case "funcResponse" :
    e.stopImmediatePropagation();
    if(isNaN(e.data[1])) throw new Error("MsDataFileWorkerGaveNaNFuncResponse");
    else {
     this.funcResponse = e.data[1];
     MSLIB.Common.finish(this.worker);
    }
    break;
   case "extractionsRequest" :
    e.stopImmediatePropagation();
    this.worker.postMessage(["extractionsResponse",HML.ui.processing.extractionCalculator.calculate(e.data[1])]);
    break;
   case "dispatchToQuantQueue" :
    e.stopImmediatePropagation();
    HML.ui.processing.taskQueue.add([e.data[1],this]);
    break;
   case "complete" :
    e.stopImmediatePropagation();
    if (e.data[1] < this.quantRequests.length) throw new Error("WorkerQuantitationEndedPrematurely");
    MSLIB.Common.finish(this.worker);
    break;
   case "internals" :
    e.stopImmediatePropagation();
    console.log(e.data[1]);
    break;
   default : console.log(e.data);
  }
 };

 var workerInternal = function _SOURCE() {

  var msDataFile,
      quantRequests,
      config,
      maxBytes,
      prepareQRIndex,
      dispatchQRIndex,
      quantTask,
      currentReadStartOffset,
      currentReadEndOffset,
      currentReadStartScan,
      currentReadEndScan,
      previousFeatureSpectra,
      previousFeatureSNMax,
      currentFeatureSpectra,
      featureScanNumbers,
      featureSNi,
      featureSNiMax,
      currentFeatureSN,
      extractionMinMz,
      extractionMaxMz;

  var onInit = function(file,scans) {
   if (!msDataFile) {
    self.addEventListener("error", function(e) {
     e.stopImmediatePropagation();
     onReportInternals();
    });
    if (file.name.match(/\.raw$/i)) {
     msDataFile = new MSLIB.Format.ThermoRawFile(file);
    }
    else {
     msDataFile = new MSLIB.Format.MzFile(file);
    }
//    msDataFile.reader.report = true;
    if (scans) {
     msDataFile.scans = scans;
     self.postMessage(["initialised",msDataFile.scans]);
    }
    else {
     msDataFile.fetchAllScanHeaders();
     var progressUpdateInterval = self.setInterval(() => {
      self.postMessage(["progress",msDataFile.progress]);
      if (msDataFile.ready) {
       self.clearInterval(progressUpdateInterval);
       self.postMessage(["initialised",msDataFile.scans]);
      }
     },1000);
    }
   }
   else throw new Error("MsDataFileWorkerAlreadyInitialised");
  };

  var onCallFunc = function(func,args) {
   self.postMessage(["funcResponse",msDataFile[func].apply(msDataFile,args)]);
  };

  var onprepareQuantTasks = function(qrs,startIndex,configObj) {
   if (qrs.length && (startIndex < qrs.length)) {
    config = configObj;
    maxBytes = config._rawFileMaxBlockProcessSize || 0;
    if (!maxBytes) console.log("Warning: Max block process size is undefined or set to zero; reverting to one-read-per-feature");
    quantRequests = qrs.map(qr => new HML.QuantRequest(qr)).sort((a,b) => a.ms1RT - b.ms1RT);
    prepareQRIndex = startIndex;
    dispatchQRIndex = startIndex;
    previousFeatureSpectra = {};
    prepareNewBlock();
   }
  };

  var prepareNewBlock = function() {
   currentReadStartOffset = null;
   currentReadEndOffset = null;
   currentReadStartScan = null;
   currentReadEndScan = null;
   featureScanNumbers = null;
   featureSNi = null;
   featureSNiMax = null;
   currentFeatureSN = null;
   extractionMinMz = null;
   extractionMaxMz = null;
   prepareNextQR();
  };

  var prepareNextQR = function() {
   var spectrumStartScan,spectrumEndScan,spectrumEndOffset;
   spectrumStartScan = msDataFile.getNearestMSXScanNumberfromRT(1,quantRequests[prepareQRIndex].ms1RT-(+config.rtSearchWindow));
   if (spectrumStartScan > msDataFile.getFirstScanNumber()) {
    spectrumStartScan = msDataFile.getPreviousScanNumber(spectrumStartScan,1);
   }
   if (spectrumStartScan === null) throw new Error("MsDataFileWorkerGotNullValueForStartScan");
   if (currentReadStartOffset == null) {
    currentReadStartScan = spectrumStartScan;
    currentReadStartOffset = msDataFile.scans[currentReadStartScan].offset;
   }
   spectrumEndScan = msDataFile.getNearestMSXScanNumberfromRT(1,quantRequests[prepareQRIndex].ms1RT+(+config.rtSearchWindow),true);
   if (spectrumEndScan < msDataFile.getLastScanNumber()) {
    spectrumEndScan = msDataFile.getNextScanNumber(spectrumEndScan,1);
   }
   var twoAfter = msDataFile.getNextScanNumber(msDataFile.getNextScanNumber(spectrumStartScan,1),1);
   if (twoAfter !== null && spectrumEndScan < twoAfter) {
    spectrumEndScan = twoAfter;
   }
   if (spectrumEndScan === null) throw new Error("MsDataFileWorkerGotNullValueForEndScan");
   spectrumEndOffset = msDataFile.scans[spectrumEndScan].offset + msDataFile.scans[spectrumEndScan].length;
   if ((spectrumEndOffset - currentReadStartOffset) >= maxBytes) {
    var spectrumStartOffset = msDataFile.scans[spectrumStartScan].offset;
    if (currentReadStartOffset == spectrumStartOffset) {
     console.log("Error ("+msDataFile.reader.file.name+"): Single feature read larger ("+(spectrumEndOffset - spectrumStartOffset)+") than max block size ("+maxBytes+") in scans "+spectrumStartScan+" to "+spectrumEndScan+"; Offsets "+spectrumStartOffset+" to "+spectrumEndOffset);
     throw new Error("MsDataFileWorkerSingleFeatureReadLargerThanMaxBytes");
    }
    else preloadBlock(); // load WITHOUT advancing prepareQRIndex (so next block starts with this one)
   }
   else {
    if ((currentReadEndOffset === null) || (spectrumEndOffset > currentReadEndOffset)) {
     currentReadEndScan = spectrumEndScan;
     currentReadEndOffset = spectrumEndOffset;
    }
    quantRequests[prepareQRIndex].scanRange = [spectrumStartScan,spectrumEndScan];
    if (++prepareQRIndex >= quantRequests.length) preloadBlock();
    else prepareNextQR();
   }
  };
 
  var preloadBlock = function() {
   var readFunc = (
                   (msDataFile.fileType == "mzML" || msDataFile.fileType == "mzXML") 
                   ? msDataFile.reader.readText 
                   : msDataFile.reader.readBinary
                  );
   readFunc.call(msDataFile.reader,
    constructNextQR,
    currentReadStartOffset,
    currentReadEndOffset-currentReadStartOffset
   );
  };
 
  var constructNextQR = function() {
   quantTask = new HML.QuantTask([quantRequests[dispatchQRIndex]])
   self.postMessage(["extractionsRequest",quantTask.request.extractionCalcIndex]);
  }

  var onExtractionsResponse = function(extractions) {
   quantTask.extractions = extractions;
   var StartScan = quantTask.request.scanRange[0];
   var EndScan = quantTask.request.scanRange[1];
   featureScanNumbers = msDataFile.scans.slice(StartScan,EndScan+1).filter((ele) => (ele.scanData[1] == 1)).map((ele) => ele.scanData[0]);
   featureSNi = 0;
   featureSNiMax = (featureScanNumbers.length-1);   
   var AllMinMzs = [];
   var AllMaxMzs = []
   quantTask.extractions.forEach(function(e) {
    e.forEach(function(ts) {
     if (ts.mzs.length) {
      AllMinMzs.push(MSLIB.Data.Spectrum.prototype.getMinMz.call(ts));
      AllMaxMzs.push(MSLIB.Data.Spectrum.prototype.getMaxMz.call(ts));
     }
    });
   });  
   extractionMinMz = Math.min.apply(null,AllMinMzs);
//   extractionMinMz -= MSLIB.Math.ppmError(extractionMinMz,config.ppmError)*2;
   extractionMaxMz = Math.max.apply(null,AllMaxMzs);
//   extractionMaxMz += MSLIB.Math.ppmError(extractionMaxMz,config.ppmError)*2;
   currentFeatureSpectra = {};
   while((currentFeatureSN = featureScanNumbers[featureSNi]) <= previousFeatureSNMax) {
    currentFeatureSpectra[currentFeatureSN] = previousFeatureSpectra[currentFeatureSN];
    featureSNi++;
   }
   previousFeatureSpectra = {};
   previousFeatureSNMax = null;
   getNextScan();
  };

  var getNextScan = function() {
   if (featureSNi <= featureSNiMax) {
    msDataFile.fetchScanHeader(currentFeatureSN = featureScanNumbers[featureSNi++],true);
    MSLIB.Common.whenReady(msDataFile,storeScan);
   }
   else processScans();
  };

  var storeScan = function() {
   currentFeatureSpectra[currentFeatureSN] = [msDataFile.currentScan.spectrum.mzs,msDataFile.currentScan.spectrum.ints,msDataFile.currentScan.retentionTime];
   getNextScan();
  }

  var processScans = function() {
   quantTask.spectralData = featureScanNumbers.map(
    sn => {
     var mask = currentFeatureSpectra[sn][0].map((ele,i) => ((ele >= extractionMinMz) && (ele <= extractionMaxMz)));
     var start = mask.indexOf(true);
     var end = mask.lastIndexOf(true)+1;
     return [
      currentFeatureSpectra[sn][0].slice(start,end),
      currentFeatureSpectra[sn][1].slice(start,end),
      currentFeatureSpectra[sn][2]
     ]
    }
   );
   self.postMessage(["dispatchToQuantQueue",quantTask.toArray()]);
  };

  var onContinue = function() {
   if (++dispatchQRIndex < quantRequests.length) {
    featureScanNumbers.forEach(sn => previousFeatureSpectra[sn] = currentFeatureSpectra[sn]);
    previousFeatureSNMax = featureScanNumbers[featureSNiMax];  
    if (dispatchQRIndex < prepareQRIndex) constructNextQR();
    else prepareNewBlock();
   }
   else self.postMessage(["complete",dispatchQRIndex]);
  };
 
  var onReportInternals = function() {
   self.postMessage(["internals",{
    prepareQRIndex : prepareQRIndex,
    dispatchQRIndex : dispatchQRIndex,
    currentReadStartOffset : currentReadStartOffset,
    currentReadEndOffset : currentReadEndOffset,
    currentReadStartScan : currentReadStartScan,
    currentReadEndScan : currentReadEndScan,
    featureSNi : featureSNi,
    featureSNiMax : featureSNiMax,
    extractionMinMz : extractionMinMz,
    extractionMaxMz : extractionMaxMz,
   }]); 
  };
 
  return {
   onInit : onInit,
   onCallFunc : onCallFunc,
   onprepareQuantTasks : onprepareQuantTasks,
   onExtractionsResponse : onExtractionsResponse,
   onContinue : onContinue,
   onReportInternals : onReportInternals,
   _SOURCE : _SOURCE
  }

 }();

 var workerURI = MSLIB.Common.getMSLIBWorkerURI(function(e) {
   //HML.MsDataFileWorker
   self.postMessage(["acknowledge",e.data[0]]);
   switch(e.data[0]) {
    case "init" :
     workerInternal.onInit(e.data[1]);
     break;
    case "callFunc" :
     workerInternal.onCallFunc(e.data[1],e.data[2]);
     break;
    case "prepareQuantTasks" :
     workerInternal.onprepareQuantTasks(e.data[1],e.data[2],e.data[3],e.data[4]);
     break;
    case "extractionsResponse" :
     workerInternal.onExtractionsResponse(e.data[1]);
     break;
    case "continue" :
     workerInternal.onContinue();
     break;
    case "reportInternals" :
     workerInternal.onReportInternals();
     break;
    default : self.postMessage(["response","Unknown message type:"+e.data[0]]);
   }
  },
  ["MSLIB","Common","Math","Data","Spectrum","Scan","Format","MsDataFile","MzFile","ThermoRawFile"],
  [workerInternal,zlib,HML],["workerInternal","zlib","HML"],[undefined,undefined,["QuantRequest","QuantTask"]]
 );

 return _MsDataFileWorker;

}();