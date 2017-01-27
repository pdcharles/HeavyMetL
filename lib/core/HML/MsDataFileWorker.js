"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.MsDataFileWorker = function() {

 var MsDataFileWorker = function(File) {
  this.File = File;
  this.Scans = null;
  this.QuantRequests = null;
  this.Dispatched = 0;
  this.Worker = getNewWorker(this);
  MSLIB.Common.starting.call(this.Worker);
  this.Worker.postMessage(["Init",File]);
 }

 MsDataFileWorker.prototype.restart = function(report) {
  this.Worker.terminate();
  delete this.Worker;
  if (this.QuantRequests) {
   try {
    if (report) console.log("Restarting Worker " + this.File.name);
    this.Worker = getNewWorker(this);
    this.Worker.postMessage(["Init",this.File,this.Scans]);
    MSLIB.Common.whenReady(this.Worker,() => {
     if (this.Dispatched < this.QuantRequests.length) this.quantify(this.QuantRequests,this.Dispatched);
     if (report) console.log("Worker " + this.File.name + " successfully restarted at dispatch index " + this.Dispatched);
    });
   }
   catch(error) {
    console.log("Cannot restart Worker " + this.File.name + ": " + error.message);
   }
  }
 };
 MsDataFileWorker.prototype.callFunc = function(FuncName,Args) {
  if (this.Worker.Ready) {
   MSLIB.Common.starting.call(this.Worker);
   this.LastCall = [FuncName,Args];
   this.Worker.postMessage(["CallFunc",FuncName,Args]);
  }
  else throw new Error("WorkerNotReady");
 };
 MsDataFileWorker.prototype.quantify = function(QuantRequests,StartIndex) {
  MSLIB.Common.whenReady(this.Worker,() => {
   MSLIB.Common.starting.call(this.Worker);
   this.QuantRequests = QuantRequests;
   StartIndex = StartIndex || 0;
   this.Dispatched = StartIndex;
   this.Worker.postMessage(["Quantify",QuantRequests,StartIndex,HML.Config,HML.Modifications]);
  });
 };
 MsDataFileWorker.prototype.continue = function() {
  this.Dispatched++;
  this.Worker.postMessage(["Continue",true]);
 };
 MsDataFileWorker.prototype.reportInternals = function() {
  this.Worker.postMessage(["ReportInternals"]);
 };
 
 var getNewWorker = function(thisArg) {
  var W = new Worker(WorkerURI);
  MSLIB.Common.initialise.call(W);
  W.addEventListener("error", handleError.bind(thisArg));
  W.addEventListener("message", handleMessage.bind(thisArg));
  return W;
 }

 var handleError = function(e) {
  e.stopImmediatePropagation();
  console.log("Error detected in Worker " + this.File.name + ": " + e.message);
  this.restart(true);
 };

 var handleMessage = function(e) {
  switch (e.data[0]) {
   case "Error" :
    e.stopImmediatePropagation();
    console.log("Error sent from Worker " + this.File.name + ": " + e.data[1]);
    break;
   case "Initialised" :
    e.stopImmediatePropagation();
    if (e.data[1]) this.Scans = e.data[1];
    MSLIB.Common.finished.call(this.Worker);
    break;
   case "Progress" :
    e.stopImmediatePropagation();
    MSLIB.Common.progress.call(this.Worker,e.data[1]);
    break;
   case "FuncResponse" :
    e.stopImmediatePropagation();
    if(isNaN(e.data[1])) throw new Error("WorkerGaveNaNCallFuncResponse");
    this.FuncResponse = e.data[1];
    MSLIB.Common.finished.call(this.Worker);
    break;
   case "ExtractionsRequest" :
    e.stopImmediatePropagation();
    this.Worker.postMessage(["ExtractionsResponse",HML.Interface.Processing.ExtractionCalculator.calculate(e.data[1])]);
    break;
   case "DispatchToQuantQueue" :
    e.stopImmediatePropagation();
    HML.Interface.Processing.TaskQueue.add([e.data[1],this]);
    break;
   case "Complete" :
    e.stopImmediatePropagation();
    if (e.data[1] < this.QuantRequests.length) throw new Error("WorkerQuantitationEndedPrematurely");
    MSLIB.Common.finished.call(this.Worker);
    break;
   case "Internals" :
    e.stopImmediatePropagation();
    console.log(e.data[1]);
    break;
   default : console.log(e.data);
  }
 };

 var WorkerInternal = function _SOURCE() {

  var HML = {};
  var MsDataFile,
      QuantRequests,
      MaxBytes,
      PrepareQRIndex,
      DispatchQRIndex,
      LastDispatchSuccessful,
      QuantTask,
      CurrentReadStartOffset,
      CurrentReadEndOffset,
      CurrentReadStartScan,
      CurrentReadEndScan,
      PreviousFeatureSpectra,
      PreviousFeatureSNMax,
      CurrentFeatureSpectra,
      FeatureScanNumbers,
      FeatureSNi,
      FeatureSNiMax,
      CurrentFeatureSN,
      ExtractionMinMz,
      ExtractionMaxMz;

  var onInit = function(File,Scans) {
   if (!MsDataFile) {
    self.addEventListener("error", function(e) {
     e.stopImmediatePropagation();
     self.postMessage(["Error",e.message]);
     onReportInternals();
    });
    if (File.name.match(/\.raw$/i)) {
     MsDataFile = new MSLIB.Format.ThermoRawFile(File);
    }
    else {
     MsDataFile = new MSLIB.Format.MzFile(File);
    }
    if (Scans) {
     MsDataFile.Scans = Scans;
     self.postMessage(["Initialised",MsDataFile.Scans]);
    }
    else {
     MsDataFile.fetchAllScanHeaders();
     var ProgressUpdateInterval = self.setInterval(() => {
      self.postMessage(["Progress",MsDataFile.Progress]);
      if (MsDataFile.Ready) {
       self.clearInterval(ProgressUpdateInterval);
       self.postMessage(["Initialised",MsDataFile.Scans]);
      }
     },100);
    }
   }
  };

  var onCallFunc = function(Func,Args) {
   self.postMessage(["FuncResponse",MsDataFile[Func].apply(MsDataFile,Args)]);
  };

  var onQuantify = function(QR,StartIndex,CurrConfig,ModDefs) {
   if (QR.length && (StartIndex < QR.length)) {
    HML.Config = CurrConfig;
    HML.Modifications = ModDefs;
    MaxBytes = HML.Config._RawFileMaxBlockProcessSize || 0;
    if (!MaxBytes) console.log("Warning: Max block process size is undefined or set to zero; reverting to one-read-per-feature");
    QuantRequests = QR.sort((a,b) => (a[5] - b[5]));
    PrepareQRIndex = StartIndex;
    DispatchQRIndex = StartIndex;
    PreviousFeatureSpectra = {};
    LastDispatchSuccessful = true;
    prepareNewBlock();
   }
  };

  var prepareNewBlock = function() {
   CurrentReadStartOffset = null;
   CurrentReadEndOffset = null;
   CurrentReadStartScan = null;
   CurrentReadEndScan = null;
   FeatureScanNumbers = null;
   FeatureSNi = null;
   FeatureSNiMax = null;
   CurrentFeatureSN = null;
   ExtractionMinMz = null;
   ExtractionMaxMz = null;
   prepareNextQR();
  };

  var prepareNextQR = function() {
   var SpectrumStartScan,SpectrumEndScan,SpectrumEndOffset;
   SpectrumStartScan = MsDataFile.getNearestMSXScanNumberfromRT(1,QuantRequests[PrepareQRIndex][5]-(+HML.Config.RTSearchWindow));
   if (CurrentReadStartOffset == null) {
    CurrentReadStartScan = SpectrumStartScan;
    CurrentReadStartOffset = MsDataFile.Scans[CurrentReadStartScan].Offset;
   }
   SpectrumEndScan = MsDataFile.getNearestMSXScanNumberfromRT(1,QuantRequests[PrepareQRIndex][5]+(+HML.Config.RTSearchWindow),true);
   SpectrumEndOffset = MsDataFile.Scans[SpectrumEndScan].Offset + MsDataFile.Scans[SpectrumEndScan].Length;
   if ((SpectrumEndOffset - CurrentReadStartOffset) >= MaxBytes) {
    var SpectrumStartOffset = MsDataFile.Scans[SpectrumStartScan].Offset;
    if (CurrentReadStartOffset == SpectrumStartOffset) console.log("Warning ("+MsDataFile.Reader.File.name+"): Single feature read larger ("+(SpectrumEndOffset - SpectrumStartOffset)+") than max block size ("+MaxBytes+") in Scans "+SpectrumStartScan+" to "+SpectrumEndScan+"; Offsets "+SpectrumStartOffset+" to "+SpectrumEndOffset);
    else preloadBlock(); // load WITHOUT advancing PrepareQRIndex (so next block starts with this one)
   }
   else {
    if (SpectrumEndOffset > CurrentReadEndOffset) {
     CurrentReadEndScan = SpectrumEndScan;
     CurrentReadEndOffset = SpectrumEndOffset;
    }
    QuantRequests[PrepareQRIndex][6] = [SpectrumStartScan,SpectrumEndScan];
    if (++PrepareQRIndex >= QuantRequests.length) preloadBlock();
    else prepareNextQR();
   }
  };
 
  var preloadBlock = function() {
   var readFunc = (
                   (MsDataFile.FileType == "mzML" || MsDataFile.FileType == "mzXML") 
                   ? MsDataFile.Reader.readText 
                   : MsDataFile.Reader.readBinary
                  );
   readFunc.call(MsDataFile.Reader,
    constructNextQR,
    CurrentReadStartOffset,
    CurrentReadEndOffset-CurrentReadStartOffset
   );
  };
 
  var constructNextQR = function() {
   QuantTask = [QuantRequests[DispatchQRIndex],undefined,undefined];
   self.postMessage(["ExtractionsRequest",QuantTask[0][7]]);
  }

  var onExtractionsResponse = function(Extractions) {
   QuantTask[1] = Extractions;
   var StartScan = QuantTask[0][6][0];
   var EndScan = QuantTask[0][6][1];
   FeatureScanNumbers = MsDataFile.Scans.slice(StartScan,EndScan+1).filter((ele) => (ele.Scan.MsLevel == 1)).map((ele) => ele.Scan.ScanNumber);
   FeatureSNi = 0;
   FeatureSNiMax = (FeatureScanNumbers.length-1);   
   var AllMinMzs = [];
   var AllMaxMzs = []
   QuantTask[1].forEach(function(E) {
    E.forEach(function(TS) {
     if (TS.mzs.length) {
      AllMinMzs.push(MSLIB.Data.Spectrum.prototype.getMinMz.call(TS));
      AllMaxMzs.push(MSLIB.Data.Spectrum.prototype.getMaxMz.call(TS));
     }
    });
   });  
   ExtractionMinMz = Math.min.apply(null,AllMinMzs);
   ExtractionMinMz -= MSLIB.Math.ppmError(ExtractionMinMz,HML.Config.PpmError)*2;
   ExtractionMaxMz = Math.max.apply(null,AllMaxMzs);
   ExtractionMaxMz += MSLIB.Math.ppmError(ExtractionMaxMz,HML.Config.PpmError)*2;
   CurrentFeatureSpectra = {};
   FeatureSpectraCropped = {};
   while((CurrentFeatureSN = FeatureScanNumbers[FeatureSNi]) <= PreviousFeatureSNMax) {
    CurrentFeatureSpectra[CurrentFeatureSN] = PreviousFeatureSpectra[CurrentFeatureSN];
    FeatureSNi++;
   }
   PreviousFeatureSpectra = {};
   PreviousFeatureSNMax = null;
   getNextScan();
  };

  var getNextScan = function() {
   if (FeatureSNi <= FeatureSNiMax) {
    MsDataFile.fetchScanHeader(CurrentFeatureSN = FeatureScanNumbers[FeatureSNi++],true);
    MSLIB.Common.whenReady(MsDataFile,storeScan);
   }
   else processScans();
  };

  var storeScan = function() {
   CurrentFeatureSpectra[CurrentFeatureSN] = [MsDataFile.CurrentScan.Spectrum.mzs,MsDataFile.CurrentScan.Spectrum.ints,MsDataFile.CurrentScan.RetentionTime];
   getNextScan();
  }

  var processScans = function() {
   QuantTask[2] = FeatureScanNumbers.map(
    sn => {
     var mask = CurrentFeatureSpectra[sn][0].map((ele,i) => ((ele >= ExtractionMinMz) && (ele <= ExtractionMaxMz)));
     var start = mask.indexOf(true);
     var end = mask.lastIndexOf(true)+1;
     return [
      CurrentFeatureSpectra[sn][0].slice(start,end),
      CurrentFeatureSpectra[sn][1].slice(start,end),
      CurrentFeatureSpectra[sn][2]
     ]
    }
   );
   self.postMessage(["DispatchToQuantQueue",QuantTask]);
  };

  var onContinue = function() {
   if (++DispatchQRIndex < QuantRequests.length) {
    FeatureScanNumbers.forEach(sn => PreviousFeatureSpectra[sn] = CurrentFeatureSpectra[sn]);
    PreviousFeatureSNMax = FeatureScanNumbers[FeatureSNiMax];  
    if (DispatchQRIndex < PrepareQRIndex) constructNextQR();
    else prepareNewBlock();
   }
   else self.postMessage(["Complete",DispatchQRIndex]);
  };
 
  var onReportInternals = function() {
   self.postMessage(["Internals",{
    PrepareQRIndex : PrepareQRIndex,
    DispatchQRIndex : DispatchQRIndex,
    CurrentReadStartOffset : CurrentReadStartOffset,
    CurrentReadEndOffset : CurrentReadEndOffset,
    CurrentReadStartScan : CurrentReadStartScan,
    CurrentReadEndScan : CurrentReadEndScan,
    FeatureSNi : FeatureSNi,
    FeatureSNiMax : FeatureSNiMax,
    ExtractionMinMz : ExtractionMinMz,
    ExtractionMaxMz: ExtractionMaxMz
   }]); 
  };
 
  return {
   onInit : onInit,
   onCallFunc : onCallFunc,
   onQuantify : onQuantify,
   onExtractionsResponse : onExtractionsResponse,
   onContinue : onContinue,
   onReportInternals : onReportInternals,
   _SOURCE : _SOURCE
  }

 }();

 var WorkerURI = MSLIB.Common.getMSLIBWorkerURI(function(e) {
   //HML.MsDataFileWorker
   switch(e.data[0]) {
    case "Init" :
     WorkerInternal.onInit(e.data[1]);
     break;
    case "CallFunc" :
     WorkerInternal.onCallFunc(e.data[1],e.data[2]);
     break;
    case "Quantify" :
     WorkerInternal.onQuantify(e.data[1],e.data[2],e.data[3],e.data[4]);
     break;
    case "ExtractionsResponse" :
     WorkerInternal.onExtractionsResponse(e.data[1]);
     break;
    case "Continue" :
     WorkerInternal.onContinue();
     break;
    case "ReportInternals" :
     WorkerInternal.onReportInternals();
     break;
    default : self.postMessage(["Response","Unknown message type:"+e.data[0]]);
   }
  },
  ["MSLIB","Common","Math","Data","Spectrum","Scan","Format","MsDataFile","MzFile","ThermoRawFile"],
  [WorkerInternal,zlib],["WorkerInternal","zlib"]
 );

 return MsDataFileWorker;

}();