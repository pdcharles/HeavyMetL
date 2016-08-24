"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.MsDataFileWorker = function() {

 var MsDataFileWorker = function(File) {
  this.File = File;
  this.ScanString = null;
  this.QuantRequests = null;
  this.Dispatched = 0;
  this.Worker = getNewWorker(this);
  this.Worker.postMessage(["Init",File]);
 }
 MsDataFileWorker.prototype.restart = function(report) {
  this.Worker.terminate();
  delete this.Worker;
  if (this.QuantRequests) {
   try {
    if (report) console.log("Restarting Worker " + this.File.name);
    this.Worker = getNewWorker(this);
    this.Worker.postMessage(["Init",this.File,this.ScanString]);
    MSLIB.Common.waitUntil(() => this.Worker.Ready,() => {
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
   this.Worker.Ready = false;
   this.LastCall = [FuncName,Args];
   this.Worker.postMessage(["CallFunc",FuncName,Args]);
  }
  else {
   this.Response = "WorkerNotReady";
  }
 };
 MsDataFileWorker.prototype.quantify = function(QuantRequests,StartIndex) {
  if (this.Worker.Ready) {
   this.Worker.Ready = false;
   this.QuantRequests = QuantRequests;
   StartIndex = StartIndex || 0;
   this.Dispatched = StartIndex;
   this.Worker.postMessage(["Quantify",QuantRequests,StartIndex,HML.Config,HML.Modifications]);
  }
  else {
   this.Response = "WorkerNotReady";
  }
 };
 MsDataFileWorker.prototype.reportInternals = function() {
  this.Worker.postMessage(["ReportInternals"]);
 };
 
 var getNewWorker = function(thisArg) {
  var Worker = new MSLIB.Common.MSLIBWorker(WorkerURI);
  Worker.Ready = false;
  Worker.Progress = 0;
  Worker.addEventListener("error", handleError.bind(thisArg));
  Worker.addEventListener("message", handleMessage.bind(thisArg));
  return Worker;
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
   case "ScanString" :
    e.stopImmediatePropagation();
    this.ScanString = e.data[1];
    break;
   case "Response" :
    e.stopImmediatePropagation();
    this.Response = e.data[1];
    break;
   case "DispatchToQuantQueue" :
    e.stopImmediatePropagation();
    var AddedToQueue = HML.Interface.Processing.TaskQueue.add(e.data[1]);
    if (AddedToQueue) this.Dispatched++;
    this.Worker.postMessage(["DispatchResponse",AddedToQueue]);
    break;
   case "BlockComplete" :
    e.stopImmediatePropagation();
    this.restart(); //restarting worker between blocks avoids memory leaks crashing/slowing the worker threads
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
      CurrentReadStartOffset,
      CurrentReadEndOffset,
      CurrentReadStartScan,
      CurrentReadEndScan,
      PreviousFeatureSpectra,
      CurrentFeatureSpectra,
      FeatureScanNumbers,
      FeatureSNi,
      FeatureSNiMax,
      CurrentFeatureSN,
      Extractions,
      ExtractionMinMz,
      ExtractionMaxMz,
      FeatureSpectraData;

  var onInit = function(File,ScanString) {
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
    if (ScanString) {
     MsDataFile.Scans = JSON.parse(ScanString);
     self.postMessage(["Ready",true]);
    }
    else {
     var ProgressUpdateInterval = self.setInterval(() => {  
      self.postMessage(["Progress",MsDataFile.Progress]);
      if (MsDataFile.Ready) {
       self.clearInterval(ProgressUpdateInterval);
       self.postMessage(["ScanString",JSON.stringify(MsDataFile.Scans)]);
       self.postMessage(["Ready",true]);
      }
     },100);
     self.postMessage(["Response",MsDataFile.fetchAllScanHeaders()]);
    }
   }
  };

  var onCallFunc = function(Func,Args) {
   self.postMessage(["Response",MsDataFile[Func].apply(MsDataFile,Args)]);
   self.postMessage(["Ready",true]);
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
   Extractions = null;
   ExtractionMinMz = null;
   ExtractionMaxMz = null;
   FeatureSpectraData = null;
   prepareNextQR();
  };

  var prepareNextQR = function() {
   var QR = QuantRequests[PrepareQRIndex];
   var SpectrumStartScan,SpectrumEndScan,SpectrumEndOffset;
   SpectrumStartScan = MsDataFile.getNearestMSXScanNumberfromRT(1,QR[5]-(+HML.Config.RTSearchWindow));
   if (CurrentReadStartOffset == null) {
    CurrentReadStartScan = SpectrumStartScan;
    CurrentReadStartOffset = MsDataFile.Scans[CurrentReadStartScan].Offset;
   }
   SpectrumEndScan = MsDataFile.getNearestMSXScanNumberfromRT(1,QR[5]+(+HML.Config.RTSearchWindow),true);
   SpectrumEndOffset = MsDataFile.Scans[SpectrumEndScan].Offset + MsDataFile.Scans[SpectrumEndScan].Length;
   if ((SpectrumEndOffset - CurrentReadStartOffset) >= MaxBytes) {
    var SpectrumStartOffset = MsDataFile.Scans[SpectrumStartScan].Offset;
    if (CurrentReadStartOffset == SpectrumStartOffset) console.log("Warning ("+MsDataFile.Reader.File.name+"): Single spectrum read larger ("+(SpectrumEndOffset - SpectrumStartOffset)+") than max block size ("+MaxBytes+") in Scans "+SpectrumStartScan+" to "+SpectrumEndScan+"; Offsets "+SpectrumStartOffset+" to "+SpectrumEndOffset);
    else preloadBlock();
   }
   else {
    if (SpectrumEndOffset > CurrentReadEndOffset) {
     CurrentReadEndScan = SpectrumEndScan;
     CurrentReadEndOffset = SpectrumEndOffset;
    }
    QR[6] = [SpectrumStartScan,SpectrumEndScan];
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
   var QR = QuantRequests[DispatchQRIndex];
   var Sequence = QR[1];
   var Charge = QR[2];
   var Modstring = QR[3];
   //Index 4 is FileName
   //Index 5 is RetentionTime
   var StartScan = QR[6][0];
   var EndScan = QR[6][1];
   Extractions = [];
   var Modsplit = Modstring.split(";");
   var Modifications = [];
   Modsplit.forEach(function(mod) {
    if (mod.length) {
     var regexmatch = /[A-Z]\d+: (\S+)/i.exec(mod);
     if (regexmatch) {
      if (HML.Modifications[regexmatch[1]]) {
       Modifications.push(new MSLIB.IsoCalc.Modification({name: regexmatch[1], atoms: HML.Modifications[regexmatch[1]]}));
      }
      else console.log("Warning: unknown modification "+regexmatch[1]);
     }
     else console.log("Warning: cannot parse modification "+mod);
    }
   });
   Extractions[0] = [new MSLIB.IsoCalc.Peptide({sequence:Sequence,charge:Charge,modifications:Modifications}).getCentroidedDistribution(10).asSpectrum()];
   Extractions[0][0].Incorporation = 0;
   Extractions[1] = [];
   var AltEleConst = {};
   AltEleConst["Nitrogen"] = JSON.parse(JSON.stringify(MSLIB.IsoCalc.ElementalConstants["Nitrogen"])); //Ensure full copy
   for (var N_15 = +HML.Config.IncorporationWindowMin; N_15 <= +HML.Config.IncorporationWindowMax; N_15++) {
    AltEleConst["Nitrogen"].isotopes[0][1] = 100 - N_15;
    AltEleConst["Nitrogen"].isotopes[1][1] = N_15;
    var E = new MSLIB.IsoCalc.Peptide({sequence:Sequence,charge:Charge,modifications:Modifications}).getCentroidedDistribution(10,AltEleConst).asSpectrum();
    E.Incorporation = N_15;
    Extractions[1].push(E);
   }
   FeatureScanNumbers = MsDataFile.Scans.slice(StartScan,EndScan+1).filter((ele) => (ele.Scan.MsLevel == 1)).map((ele) => ele.Scan.ScanNumber);
   FeatureSNi = -1;
   FeatureSNiMax = (FeatureScanNumbers.length-1);   
   var AllMinMzs = [];
   var AllMaxMzs = []
   Extractions.forEach(function(E) {
    E.forEach(function(TS) {
     if (TS.mzs.length) {
      AllMinMzs.push(TS.getMinMz());
      AllMaxMzs.push(TS.getMaxMz());
     }
    });
   });  
   ExtractionMinMz = Math.min.apply(null,AllMinMzs);
   ExtractionMinMz -= MSLIB.Math.ppmError(ExtractionMinMz,HML.Config.PpmError)*2;
   ExtractionMaxMz = Math.max.apply(null,AllMaxMzs);
   ExtractionMaxMz += MSLIB.Math.ppmError(ExtractionMaxMz,HML.Config.PpmError)*2;
   CurrentFeatureSpectra = {};
   FeatureSpectraData = null;
   getNextScan();
  };

  var getNextScan = function() {
   if (FeatureSNi < FeatureSNiMax) {
    CurrentFeatureSN = FeatureScanNumbers[++FeatureSNi];
    if (!PreviousFeatureSpectra[CurrentFeatureSN]) {
     MsDataFile.fetchScanHeader(CurrentFeatureSN,true);
     MSLIB.Common.waitUntil(()=>MsDataFile.Ready,storeScan);
    }
    else MSLIB.Common.waitUntil(()=>true,copyScan);
   }
   else processScans();
  };

  var storeScan = function() {
   CurrentFeatureSpectra[CurrentFeatureSN] = [MsDataFile.CurrentScan.Spectrum.mzs,MsDataFile.CurrentScan.Spectrum.ints,MsDataFile.CurrentScan.RetentionTime];
   getNextScan();
  }

  var copyScan = function() {
   CurrentFeatureSpectra[CurrentFeatureSN] = PreviousFeatureSpectra[CurrentFeatureSN];
   getNextScan();
  }

  var processScans = function() {
   PreviousFeatureSpectra = {};
   FeatureSpectraData = FeatureScanNumbers.map(
    sn => {
     PreviousFeatureSpectra[sn] = CurrentFeatureSpectra[sn];
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
   finaliseQR(); 
  };

  var finaliseQR = function() {
   var QR = QuantRequests[DispatchQRIndex];
   var QuantTask = [QR,Extractions,FeatureSpectraData];
   self.postMessage(["DispatchToQuantQueue",QuantTask]);
  }

  var onDispatchResponse = function(Response) {
   if (Response) {
    if (++DispatchQRIndex < PrepareQRIndex) constructNextQR();
    else self.postMessage(["BlockComplete"]);
   }
   else finaliseQR();
  };
 
  var onReportInternals = function() {
   self.postMessage(["Internals",[
    [PrepareQRIndex,DispatchQRIndex],
    [[CurrentReadStartOffset,CurrentReadEndOffset],[CurrentReadStartScan,CurrentReadEndScan]],
    [FeatureSNi,FeatureSNiMax,ExtractionMinMz,ExtractionMaxMz]
   ]]); 
  };
 
  return {
   onInit : onInit,
   onCallFunc : onCallFunc,
   onQuantify : onQuantify,
   onDispatchResponse : onDispatchResponse,
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
    case "DispatchResponse" :
     WorkerInternal.onDispatchResponse(e.data[1]);
     break;
    case "ReportInternals" :
     WorkerInternal.onReportInternals();
     break;
    default : self.postMessage(["Response","Unknown message type:"+e.data[0]]);
   }
  },
  [WorkerInternal,zlib],["WorkerInternal","zlib"]
 );

 return MsDataFileWorker;

}();