"use strict";

if (typeof HML == 'undefined') var HML = {};
if (typeof HML.Format == 'undefined') HML.Format = {};
if (typeof zpipe != 'undefined') HML.Format.MzFile = function() {

 //try to optimise buffer size in bytes for various tasks
 //for indexoffset and header, want to grab entire header in one read most of the time, but not too much of the spectrum
 //however if offsets are not indexed, need to slurp huge chucks of the file and locate scan tags by regex
 //for offsetlist, want to grab several large chunks
 //for spectrum, want to grab a large chunk but not too large or inefficient for the very numerous low-data spectra

 var INDEXOFFSET_SLICE_SIZE = 1000;
 var UNINDEXED_OFFSET_SLICE_SIZE = 5000000;
 var HEADER_SLICE_SIZE = 2000;
 var MZML_SPECTRUM_SLICE_SIZE = 12000;
 var MZXML_SPECTRUM_SLICE_SIZE = 24000;
 
 var MzFile = function(f) {
  HML.Format.MsDataFile.call(this, f);
  if (!filetype[this.FileType]) {
   console.log("Error: unsupported file type");
   return {};
  }
  this.Internal.Offsets.Index = 0;
 };
 MzFile.prototype = Object.create(HML.Format.MsDataFile.prototype);

 //------------------------------------------------------------------------------
 //MzFile ASync methods
 //------------------------------------------------------------------------------

 var Starting = function() {
  this.Ready = 0;
  this.Progress = 0;
 }

 var Finished = function() {
  this.Ready = 1;
  this.Progress = 100;
 }

 MzFile.prototype.fetchScanOffsets = function(prefetchScanHeaders) {
  if (!this.Ready) return("MzFileNotReady");
  Starting.call(this);
  this.Scans = [];
  if (prefetchScanHeaders) this.Internal.PrefetchScanHeaders = true;
  return this.Reader.readText(
   parseScanOffsetStart,
   this.Reader.File.size-INDEXOFFSET_SLICE_SIZE
  );
 };

 MzFile.prototype.fetchScanHeader = function(scan,prefetchSpectrumData) {
  if (!this.Internal.FetchAll) {
   if (!this.Ready) return("MzFileNotReady");
   if (!this.Scans.length) return("MzFileNoScanOffsets");
   if (!this.Scans[scan]) return("MzFileScanUnknown");
   Starting.call(this);
  }
  if (prefetchSpectrumData) this.Internal.PrefetchSpectrum = true;
  if (this.Scans[scan] && this.Scans[scan].Scan) {
   this.CurrentScan = this.Scans[scan].Scan;
   if (prefetchSpectrumData) {
    this.fetchSpectrumData();
   }
   else {
    Finished.call(this)
   }
  }
  else {
   this.CurrentScan = new HML.Data.Scan();
   this.Reader.TextBuffer = "";
   this.Reader.readText(
    filetype[this.FileType].parseScanHeader,
    this.Scans[scan].Offset,
    HEADER_SLICE_SIZE
   );
  }
 };

 MzFile.prototype.fetchAllScanHeaders = function() {
  if (this.Internal.PrefetchScanHeaders) delete this.Internal.PrefetchScanHeaders;
  else if (!this.Ready) return("MzFileNotReady");
  if (!this.Scans.length) this.fetchScanOffsets(true);
  else {
   Starting.call(this);
   this.Internal.FetchAll = true;
   this.fetchScanHeader(this.getFirstScanNumber());
  }
 };
 
 MzFile.prototype.fetchSpectrumData = function() {
  if (this.Internal.PrefetchSpectrum) delete this.Internal.PrefetchSpectrum;
  else {
   if (!this.Ready) return("MzFileNotReady");
   Starting.call(this);
  }
  if (!this.Scans.length) return("MzFileNoScanOffsets");
  if (!this.CurrentScan) return("MzFileScanNotLoaded");
  this.CurrentScan.SpectrumData = {};
  this.Reader.TextBuffer = "";
  this.Reader.readText(
   filetype[this.FileType].parseSpectrumData,
   this.CurrentScan.BinaryDataOffset[0],
   this.CurrentScan.BinaryDataLength[0] ?
    this.CurrentScan.BinaryDataLength[0] + (this.FileType == "mzML" ? 10 : 9) :
    (this.FileType == "mzML" ? MZML_SPECTRUM_SLICE_SIZE : MZXML_SPECTRUM_SLICE_SIZE)
  );
 };

 //Post-read callback functions

 var parseScanOffsetStart = function() {
  var regexmatch = regex[this.Parent.FileType].Index.exec(this.result);
  if (regexmatch) {
   this.Parent.Internal.Offsets.Index = +regexmatch[1];
   this.readText(
    parseScanOffsetList,
    this.Parent.Internal.Offsets.Index
   );
  }
  else {
   if (this.Parent.FileType == "mzXML") {
    console.log("Warning: Index offset is undefined - will manually parse scan offsets");
    this.TextBuffer = "";
    this.readText(
     parseUnindexedScanOffsets,
     0,
     UNINDEXED_OFFSET_SLICE_SIZE
    );
   }
   else console.log("Can't find Index offset");
  }
 };

 var parseUnindexedScanOffsets = function() {
  var text = this.TextBuffer + this.result;
  var text_offset = this.Position - UNINDEXED_OFFSET_SLICE_SIZE - this.TextBuffer.length;
  var RE = /<scan num="(\d+)"/g;
  var end_scannum_index;
  while ((regexmatch = RE.exec(text)) !== null) {
   this.Parent.Scans[regexmatch[1]] = (text_offset + RE.lastIndex - regexmatch[0].length);
   end_scannum_index = RE.lastIndex;
  }
  text = text.substr(end_scannum_index);
  if (text.match(/<\/mzXML>/)) {
   if (this.Parent.Internal.PrefetchScanHeaders) {
    this.Parent.fetchAllScanHeaders();
   }
   else {
    Finished.call(this.Parent);
   }
  }
  else {
   this.TextBuffer = text;
   this.readText(
    parseUnindexedScanOffsets,
    this.Position,
    UNINDEXED_OFFSET_SLICE_SIZE
   );
  }
 };

 var parseScanOffsetList = function() {
  var end_offset_index = this.result.lastIndexOf("</offset>") + 9;
  if (end_offset_index != 8) {
   var offsets = this.result.substr(0,end_offset_index).split("</offset>");
   var previousScan = null;
   for (var i = 0; i < offsets.length-1; i++) {
    var regexmatch = regex[this.Parent.FileType].ScanOffset.exec(offsets[i]);
    if (regexmatch) {
     this.Parent.Scans[+regexmatch[1]] = {};
     this.Parent.Scans[+regexmatch[1]].Offset = +regexmatch[2];
     if (previousScan) {
      this.Parent.Scans[previousScan].Length = this.Parent.Scans[+regexmatch[1]].Offset - this.Parent.Scans[previousScan].Offset;
      this.Parent.Scans[previousScan].Next = +regexmatch[1];
      this.Parent.Scans[+regexmatch[1]].Previous = previousScan;
     }
     previousScan = +regexmatch[1];
    }
   }
  }
  else {
   console.log("Can't find any indexList offset entries");
  }
  if (this.Parent.Internal.PrefetchScanHeaders) {
   this.Parent.fetchAllScanHeaders();
  }
  else {
   Finished.call(this.Parent);
  }
 }

 var regex = {};
 regex.mzML = {
  Index : /<indexListOffset>(\d+)<\/indexListOffset>/,
  ScanOffset : /<offset idRef=".*?scan=(\d+)".*?>(\d+)$/
 }
 regex.mzXML = {
  Index : /<indexOffset>(\d+)<\/indexOffset>/,
  ScanOffset : /<offset id="(\d+)".*?>(\d+)$/
 }

 
 //------------------------------------------------------------------------------
 //mzML-specific code
 //------------------------------------------------------------------------------
 
 var filetype = {}

 filetype.mzML = {
//  parseScanOffsetStart : function() {
//   var regexmatch = /<indexListOffset>(\d+)<\/indexListOffset>/.exec(this.result);
//   if (regexmatch) {
//    this.Parent.Internal.Offsets.Index = +regexmatch[1];
//    this.readText(
//     filetype.mzML.parseScanOffsetList,
//     this.Parent.Internal.Offsets.Index
//    );
//   }
//   else {
//    console.log("Can't find indexListOffset");
//   }
//  },  
//  parseScanOffsetList : function() {
//   var end_offset_index = this.result.lastIndexOf("</offset>") + 9;
//   if (end_offset_index != 8) {
//    var offsets = this.result.substr(0,end_offset_index).split("</offset>");
//    var previousScan = null;
//    for (var i = 0; i < offsets.length-1; i++) {
//     var regexmatch = /<offset idRef=".*?scan=(\d+)".*?>(\d+)$/.exec(offsets[i]);
//     if (regexmatch) {
//      this.Parent.Scans[+regexmatch[1]] = {};
//      this.Parent.Scans[+regexmatch[1]].Offset = +regexmatch[2];
//      if (previousScan) {
//       this.Parent.Scans[previousScan].Length = this.Parent.Scans[+regexmatch[1]].Offset - this.Parent.Scans[previousScan].Offset;
//       this.Parent.Scans[previousScan].Next = +regexmatch[1];
//       this.Parent.Scans[+regexmatch[1]].Previous = previousScan;
//      }
//      previousScan = +regexmatch[1];
//     }
//    }
//   }
//   else {
//    console.log("Can't find any indexList offset entries");
//   }
//   this.Parent.Progress = 100;
//   this.Parent.Ready = 1;
//  },
  parseScanHeader : function() {
   var text = this.TextBuffer + this.result;
   var end_ele_index = text.lastIndexOf(">") + 1;
   var eles = text.substr(0,end_ele_index).split(">");
   for (var i = 0; i < eles.length-1; i++) {
    var regexmatch;
    if (/<spectrum /.exec(eles[i])) {
     regexmatch = /id=".*?scan=(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.ScanNumber = +regexmatch[1];
     }
    }
    else if (/<cvParam /.exec(eles[i])) {
     regexmatch = /accession="MS:1000511" name="ms level" value="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.MsLevel = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000127" name="centroid spectrum" value=""/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.Centroided = 1;
     }
     regexmatch = /accession="MS:1000016" name="scan start time" value="(\d+\.?\d+)"/.exec(eles[i]);
     if (regexmatch) {
      if (/unitName="minute"/.exec(eles[i])) {
       this.Parent.CurrentScan.RetentionTime = +regexmatch[1]/60;
      }
     }
     regexmatch = /accession="MS:1000528" name="lowest observed m\/z" value="(.+?)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.LowMz = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000527" name="highest observed m\/z" value="(.+?)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.HighMz = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000504" name="base peak m\/z" value="(.+?)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.BasePeakMz = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000505" name="base peak intensity" value="(.+?)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.BasePeakIntensity = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000744" name="selected ion m\/z" value="(\d+\.?\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.PrecursorMz = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000041" name="charge state" value="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.PrecursorCharge = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000042" name="peak intensity" value="(\d+\.?\d*e?\+?\d*)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.PrecursorIntensity = +regexmatch[1];
     }
     if (/accession="MS:1000133" name="collision-induced dissociation"/.exec(eles[i])) {
      this.Parent.CurrentScan.ActivationMethod = "CID";
     }
     if (/accession="MS:1000422" name="high-energy collision-induced dissociation"/.exec(eles[i])) {
      this.Parent.CurrentScan.ActivationMethod = "HCD";
     }
     if (/accession="MS:1000598" name="electron transfer dissociation"/.exec(eles[i])) {
      this.Parent.CurrentScan.ActivationMethod = "ETD";
     }
     if (/accession="MS:1000599" name="pulsed q dissociation"/.exec(eles[i])) {
      this.Parent.CurrentScan.ActivationMethod = "PQD";
     }
     regexmatch = /accession="MS:1000574" name="zlib compression"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.CompressionType.push("zlib");
     }
     regexmatch = /accession="(?:MS:1000521|MS:1000523)" name="(32|64)-bit float"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.BinaryDataPrecision.push(+regexmatch[1]);
     }
     if (/accession="MS:1000514" name="m\/z array"/.exec(eles[i])) {
      this.Parent.CurrentScan.BinaryDataID.push("mz");
     }
     if (/accession="MS:1000515" name="intensity array"/.exec(eles[i])) {
      this.Parent.CurrentScan.BinaryDataID.push("int");
     }
    }
    else if (/<binaryDataArrayList /.exec(eles[i])) {
     regexmatch = /count="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      if (regexmatch[1] != "2") {
       console.log("Error: Unexpected number of binary data arrays in mzML");
      }
     }
    }
    else if (/<binaryDataArray /.exec(eles[i])) {
     regexmatch = /encodedLength="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.BinaryDataLength.push(+regexmatch[1]);
     }
    }
    else if (/<binary$/.exec(eles[i])) {
     //current binary element offset is start position of the text + length of this and all previous eles + i + 1(correct for missing >)
     this.Parent.CurrentScan.BinaryDataOffset.push(this.Position - text.length + eles.slice(0,i+1).join("").length + i + 1)   
     if (!this.Parent.CurrentScan.BinaryDataOffset[1]) {
      if (this.Parent.CurrentScan.BinaryDataLength[0]) {
       this.Position = +this.Parent.CurrentScan.BinaryDataOffset[0]+this.Parent.CurrentScan.BinaryDataLength[0] + 9;
      }
      else { //finding second binary element when no BinaryDataLength - large read from BinaryDataOffset of the first binary element
       this.Position = +this.Parent.CurrentScan.BinaryDataOffset[0];
      }
     }
     break;
    }
   }
   if (this.Parent.CurrentScan.BinaryDataOffset[1]) {
    if (this.Parent.Internal.PrefetchSpectrum) {
     this.Parent.fetchSpectrumData();
    }
    else {
     if (this.Parent.Internal.FetchAll) {
      this.Parent.Scans[this.Parent.CurrentScan.ScanNumber].Scan = this.Parent.CurrentScan;
      if (this.Parent.getNextScanNumber(this.Parent.CurrentScan.ScanNumber)) {
       this.Parent.Progress = (this.Parent.CurrentScan.ScanNumber/this.Parent.getLastScanNumber())*100;
       this.Parent.fetchScanHeader(this.Parent.getNextScanNumber(this.Parent.CurrentScan.ScanNumber))
      }
      else {
       delete this.Parent.Internal.FetchAll;
       Finished.call(this.Parent);
      }
     }
     else {
      Finished.call(this.Parent);
     }
    }
   }
   else {
    this.TextBuffer = this.Parent.CurrentScan.BinaryDataOffset[0] ? "" : text.substr(end_ele_index)
    this.readText(
     filetype.mzML.parseScanHeader,
     this.Position,
     this.Parent.CurrentScan.BinaryDataOffset[0] ? MZML_SPECTRUM_SLICE_SIZE : HEADER_SLICE_SIZE
    );
   }
  },
  parseSpectrumData : function() {
   var text = this.TextBuffer + this.result;
   var binary_index = text.indexOf("</binary>");
   if (binary_index >= 0) {
    text = text.substr(0,binary_index);
    text = text.replace(/\n|\r/gm,"");
    if (!this.firstBinaryArray) {
     this.firstBinaryArray = text;
     this.readText(
      filetype.mzML.parseSpectrumData,
      this.Parent.CurrentScan.BinaryDataOffset[1],
      this.Parent.CurrentScan.BinaryDataLength[1] ? this.Parent.CurrentScan.BinaryDataLength[1] + 10 : MZML_SPECTRUM_SLICE_SIZE
     );
    }
    else {
     console.log(this.firstBinaryArray);
     console.log(text);
     var a = decodeByteArray(this.firstBinaryArray,this.Parent.CurrentScan.CompressionType[0],this.Parent.CurrentScan.BinaryDataPrecision[0]);
     var b = decodeByteArray(text,this.Parent.CurrentScan.CompressionType[1],this.Parent.CurrentScan.BinaryDataPrecision[1]);
     if (this.Parent.CurrentScan.BinaryDataID[0] == "mz" && this.Parent.CurrentScan.BinaryDataID[1] == "int") {
      this.Parent.CurrentScan.SpectrumData.mzs = a;
      this.Parent.CurrentScan.SpectrumData.ints = b;
     }
     else if (this.Parent.CurrentScan.BinaryDataID[0] == "int" && this.Parent.CurrentScan.BinaryDataID[1] == "mz") {
      this.Parent.CurrentScan.SpectrumData.mzs = b;
      this.Parent.CurrentScan.SpectrumData.ints = a;
     }
     else {
      console.log("Error: Unrecognised mz/int order of binary data in mzML");
     }
     delete this.firstBinaryArray;
     Finished.call(this.Parent);
    }
   }
   else {
    this.TextBuffer = text;
    this.readText(
     filetype.mzML.parseSpectrumData,
     this.Position,
     MZML_SPECTRUM_SLICE_SIZE
    )
   }
  }
 };
 
 //------------------------------------------------------------------------------
 //mzXML-specific code
 //------------------------------------------------------------------------------
 
 filetype.mzXML = {
//  parseScanOffsetStart : function() {
//   var regexmatch = /<indexOffset>(\d+)<\/indexOffset>/.exec(this.result);
//   if (regexmatch) {
//    this.Parent.Internal.Offsets.Index = regexmatch[1];
//    this.readText(
//     filetype.mzXML.parseScanOffsetList,
//     this.Parent.Internal.Offsets.Index
//    );
//   }
//   else {
//    console.log("Warning: Offsets.Index is undefined - will manually parse scan offsets");
//    this.readText(
//     filetype.mzXML.parseUnindexedScanOffsets,
//     0,
//     UNINDEXED_OFFSET_SLICE_SIZE
//    );
//   }
//  },
//  parseScanOffsetList : function() {
//   var end_offset_index = this.result.lastIndexOf("</offset>") + 9;
//   if (end_offset_index != 8) {
//    var offsets = this.result.substr(0,end_offset_index).split("</offset>");
//    var previousScan = null;
//    for (var i = 0; i < offsets.length-1; i++) {
//     var regexmatch = /<offset id="(\d+)".*?>(\d+)/.exec(offsets[i]);
//     if (regexmatch) {
//      this.Parent.Scans[+regexmatch[1]] = {};
//      this.Parent.Scans[+regexmatch[1]].Offset = +regexmatch[2];
//      if (previousScan) {
//       this.Parent.Scans[previousScan].Next = +regexmatch[1];
//       this.Parent.Scans[+regexmatch[1]].Previous = previousScan;
//      }
//      previousScan = +regexmatch[1];
//     }
//    }
//   }
//   else {
//    console.log("Can't find any indexList offset entries");
//   }
//   this.Parent.Progress = 100;
//   this.Parent.Ready = 1;
//  },
//  parseUnindexedScanOffsets : function() {
//   var text = this.TextBuffer + this.result;
//   var text_offset = this.Position - UNINDEXED_OFFSET_SLICE_SIZE - this.TextBuffer.length;
//   var RE = /<scan num="(\d+)"/g;
//   var end_scannum_index;
//   while ((regexmatch = RE.exec(text)) !== null) {
//    this.Parent.Scans[regexmatch[1]] = (text_offset + RE.lastIndex - regexmatch[0].length);
//    end_scannum_index = RE.lastIndex;
//   }
//   text = text.substr(end_scannum_index);
//   if (text.match(/<\/mzXML>/)) {
//    this.Parent.Progress = 100;
//    this.Parent.Ready = 1;
//   }
//   else {
//    this.TextBuffer = text;
//    this.readText(
//     filetype.mzXML.parseUnindexedScans,
//     this.Position,
//     UNINDEXED_OFFSET_SLICE_SIZE
//    );
//   }
//  },
  parseScanHeader : function() {
   var text = this.TextBuffer + this.result;
   var end_ele_index = text.lastIndexOf(">") + 1;
   var eles = text.substr(0,end_ele_index).split(">");
   for (var i = 0; i < eles.length-1; i++) {
    var regexmatch;
    if (/<scan /.exec(eles[i])) {
     regexmatch = /num="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.ScanNumber = +regexmatch[1];
     }
     regexmatch = /msLevel="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.MsLevel = +regexmatch[1];
     }
     regexmatch = /Centroided="([01])"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.Centroided = +regexmatch[1];
     }
     regexmatch = /retentionTime="PT(\d+\.?\d+)S"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.RetentionTime = +regexmatch[1]/60;
     }
     regexmatch = /lowMz="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.LowMz = +regexmatch[1];
     }
     regexmatch = /highMz="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.HighMz = +regexmatch[1];
     }
     regexmatch = /basePeakMz="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.BasePeakMz = +regexmatch[1];
     }
     regexmatch = /basePeakIntensity="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.BasePeakIntensity = +regexmatch[1];
     }
    }
    else if (/<precursorMz /.exec(eles[i])) {
     regexmatch = /precursorIntensity="(\d+\.?\d*e?\+?\d*)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.PrecursorIntensity = +regexmatch[1];
     }
     regexmatch = /precursorCharge="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.PrecursorCharge = +regexmatch[1];
     }
     regexmatch = /activationMethod="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.ActivationMethod = regexmatch[1];
     }
    }
    else if (/\d+\.?\d+<\/precursorMz>/.exec(eles[i])) {
     regexmatch = /(\d+\.?\d+)<\/precursorMz>/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.PrecursorMz = +regexmatch[1];
     }
    }
    else if (/<peaks/.exec(eles[i])) {
     regexmatch = /compressionType="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.CompressionType.push(regexmatch[1]);
     }
     regexmatch = /compressedLen="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.BinaryDataLength.push(4*Math.ceil(regexmatch[1]/3)); //compressedLen is length after compression but before base64 encoding, need to convert
     }
     regexmatch = /precision="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.Parent.CurrentScan.BinaryDataPrecision.push(+regexmatch[1]);
     }
     this.Parent.CurrentScan.BinaryDataID.push('mz-int');
     this.Parent.CurrentScan.BinaryDataOffset.push(this.Position - text.length + eles.slice(0,i+1).join("").length + i + 1)   
     break;
    }
   }
   if (this.Parent.CurrentScan.BinaryDataOffset[0]) {
    if (this.Parent.Internal.PrefetchSpectrum) {
     console.log(this.Parent.CurrentScan.ScanNumber);
     this.Parent.fetchSpectrumData();
    }
    else {
     if (this.Parent.Internal.FetchAll) {
      this.Parent.Scans[this.Parent.CurrentScan.ScanNumber].Scan = this.Parent.CurrentScan;
      if (this.Parent.getNextScanNumber(this.Parent.CurrentScan.ScanNumber)) {
       this.Parent.Progress = (this.Parent.CurrentScan.ScanNumber/this.Parent.getLastScanNumber())*100;
       this.Parent.fetchScanHeader(this.Parent.getNextScanNumber(this.Parent.CurrentScan.ScanNumber))
      }
      else {
       delete this.Parent.Internal.FetchAll;
       Finished.call(this.Parent);
      }
     }
     else {
      Finished.call(this.Parent);
     }
    }
   }
   else {
    this.TextBuffer = text.substr(end_ele_index);
    this.readText(
     filetype.mzXML.parseScanHeader,
     this.Position,
     HEADER_SLICE_SIZE
    );
   }
  },
  parseSpectrumData : function() {
   var text = this.TextBuffer + this.result;
   var end_peaks_index = text.indexOf("</peaks>")
   if (end_peaks_index >= 0) {
    text = text.substr(0,end_peaks_index);
    text = text.replace(/\n|\r/gm,"");
    var values = decodeByteArray(text,this.Parent.CurrentScan.CompressionType[0],this.Parent.CurrentScan.BinaryDataPrecision[0])
    this.Parent.CurrentScan.SpectrumData.mzs = [];
    this.Parent.CurrentScan.SpectrumData.ints = [];
    if (this.Parent.CurrentScan.BinaryDataID[0] == "mz-int") {
     for (var i = 0; i < values.length; i = i+2) { 
      this.Parent.CurrentScan.SpectrumData.mzs.push(values[i]);
      this.Parent.CurrentScan.SpectrumData.ints.push(values[i+1])
     }
    }
    else {
     console.log("Error: Unrecognised mz/int order of binary data in mzXML");
    }
    Finished.call(this.Parent);
   }
   else {
    this.TextBuffer = text;
    this.readText(
     filetype.mzXML.parseSpectrumData,
     this.Position,
     MZXML_SPECTRUM_SLICE_SIZE
    );
   }
  }
 };
 
 //------------------------------------------------------------------------------
 //Data array decoding
 //------------------------------------------------------------------------------
 
 var decodeByteArray = function(t,c,p) {
  if (!t.length) {
   return [];
  }
  var s = window.atob(t); //decode base64
  if (c && (c == "zlib")) {
   try {
    s = zpipe.inflate(s); //deflate zlib
   }
   catch (err) {
    console.log("Error: zpipe threw error (" + err + ") for compressed text:" + t);
    return [];
   }  
  }
  var bytes = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) { 
   bytes[i] = s.charCodeAt(i);
  } 
  var dV = new DataView(bytes.buffer);  //Have to use DataView to access in Big-Endian format
  var values = [];
  if (p == "32") {
   if (bytes.length % 4) {
    console.log("Error: Byte array length not a multiple of 4");
   }
   for (var i = 0; i < dV.byteLength; i = i+4) { 
    values.push(dV.getFloat32(i)); 
   }
  }
  else if (p == "64") {
   if (bytes.length % 8) {
    console.log("Error: Byte array length not a multiple of 8");
   }
   for (var i = 0; i < dV.byteLength-1; i = i+8) { 
    values.push(dV.getFloat64(i)); 
   }
  }
  else {
   console.log("Error: Unknown precision value");
  }
  return values;
 }

 return MzFile;

}();

else  {
 console.log("Warning: MzFile requires zpipe!");
}