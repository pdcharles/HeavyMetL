"use strict";

if (typeof HML == 'undefined') var HML = {};
if (typeof HML.Format == 'undefined') HML.Format = {};
if (typeof zpipe != 'undefined') HML.Format.MzFile = function() {

 //try to optimise buffer size in bytes for various tasks
 //for indexoffset and header, want to grab entire header in one read most of the time, but not too much of the spectrum
 //however if offsets are not indexed, need to slurp huge chucks of the file and locate scan tags by regex
 //for spectrum (if can't calculate length), want to grab a large chunk but not too large or inefficient for the very numerous low-data spectra

 const INDEXOFFSET_SLICE_SIZE = 1000;
 const UNINDEXED_OFFSET_SLICE_SIZE = 5000000;
 const HEADER_SLICE_SIZE = 3000;
 const MZML_SPECTRUM_SLICE_SIZE = 12000;
 const MZXML_SPECTRUM_SLICE_SIZE = 24000;
 
 var MzFile = function(f) {
  HML.Format.MsDataFile.call(this, f);
  if (f.name.match(/\.mzML$/i)) {
   this.FileType = "mzML";
  }
  else if (f.name.match(/\.mzXML$/i)) {
   this.FileType = "mzXML";
  }
  else {
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
   this.CurrentScan.Internal.CompressionType      = [];
   this.CurrentScan.Internal.BinaryDataPrecision  = [];
   this.CurrentScan.Internal.BinaryDataLength     = [];
   this.CurrentScan.Internal.BinaryDataOffset     = [];
   this.CurrentScan.Internal.BinaryDataID         = [];
   this.Reader.TextBuffer = "";
   this.Reader.readText(
    parseScanHeader,
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
   parseSpectrumData[this.FileType],
   this.CurrentScan.Internal.BinaryDataOffset[0],
   this.CurrentScan.Internal.BinaryDataLength[0] ?
    this.CurrentScan.Internal.BinaryDataLength[0] + (this.FileType == "mzML" ? 10 : 9) :
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
      //add a spectrum binary length calc here?
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

 var parseScanHeader = function() {
  var text = this.TextBuffer + this.result;
  var end_ele_index = text.lastIndexOf(">") + 1;
  var eles = text.substr(0,end_ele_index).split(">").slice(0,-1);
  for (var i = 0; i < eles.length; i++) {
   if (this.Parent.FileType == "mzML" && /<binary$/.exec(eles[i])) {
    if (this.Parent.CurrentScan.Internal.BinaryDataListCount != 2) {
     console.log("Error: Unexpected number of binary data arrays in mzML");
    }
    //current binary element offset is start position of the text + length of this and all previous eles + i + 1(correct for missing >)
    this.Parent.CurrentScan.Internal.BinaryDataOffset.push(this.Position - text.length + eles.slice(0,i+1).join("").length + i + 1)   
    if (!this.Parent.CurrentScan.Internal.BinaryDataOffset[1]) {
     if (this.Parent.CurrentScan.Internal.BinaryDataLength[0]) {
      this.Position = +this.Parent.CurrentScan.Internal.BinaryDataOffset[0]+this.Parent.CurrentScan.Internal.BinaryDataLength[0] + 9;
     }
     else { //finding second binary element when no BinaryDataLength - large read from BinaryDataOffset of the first binary element
      this.Position = +this.Parent.CurrentScan.Internal.BinaryDataOffset[0];
     }
    }
    break;
   }
   regex[this.Parent.FileType].ScanKeys.forEach(function(key) {
    var regexmatch = regex[this.Parent.FileType].Scan[key].exec(eles[i]);
    if (regexmatch) {
     var scope = this.Parent.CurrentScan;
     var value = (isNaN(regexmatch[1]) ? regexmatch[1] : (+regexmatch[1]));
     if (typeof(scope[key]) == "undefined") {
      scope = this.Parent.CurrentScan.Internal;
     }
     if (Array.isArray(scope[key])) {
      scope[key].push(value);
     }
     else {
      scope[key] = value;
     }
    }
   },this);
   if (this.Parent.FileType == "mzXML" && /<peaks\s/.exec(eles[i])) {
    this.Parent.CurrentScan.Internal.BinaryDataID.push('mz-int');
    this.Parent.CurrentScan.Internal.BinaryDataOffset.push(this.Position - text.length + eles.slice(0,i+1).join("").length + i + 1);
    break;
   }
  }
  if (this.Parent.CurrentScan.Internal.BinaryDataOffset[(this.Parent.FileType == "mzML" ? 1 : 0)]) {
   //Standardise values
   if (this.Parent.FileType == "mzXML" || this.Parent.CurrentScan.Internal.RTUnits=="second") {
    this.Parent.CurrentScan.RetentionTime /= 60;
   }
   if (this.Parent.FileType == "mzML") {
    this.Parent.CurrentScan.ActivationMethods = this.Parent.CurrentScan.ActivationMethods.map(function(m) {
     switch(m) {
      case 1000133 : return "CID";
      case 1000422 : return "HCD";
      case 1000598 : return "ETD";
      case 1000599 : return "PQD";
      default : return m;
     }
    });
    if (this.Parent.CurrentScan.Centroided == null) this.Parent.CurrentScan.Centroided = 0;
   }
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
   this.TextBuffer = this.Parent.CurrentScan.Internal.BinaryDataOffset[0] ? "" : text.substr(end_ele_index)
   this.readText(
    parseScanHeader,
    this.Position,
    this.Parent.CurrentScan.Internal.BinaryDataOffset[0] ? MZML_SPECTRUM_SLICE_SIZE : HEADER_SLICE_SIZE
   );
  }
 };

 var parseSpectrumData = {
  mzML : function() {
   var text = this.TextBuffer.replace(/\n|\r/gm,"") + this.result;
   var binary_index = text.indexOf("</binary>");
   if (binary_index >= 0) {
    text = text.substr(0,binary_index);
    if (!this.firstBinaryArray) {
     this.firstBinaryArray = text;
     this.readText(
      parseSpectrumData.mzML,
      this.Parent.CurrentScan.Internal.BinaryDataOffset[1],
      this.Parent.CurrentScan.Internal.BinaryDataLength[1] ? this.Parent.CurrentScan.Internal.BinaryDataLength[1] + 10 : MZML_SPECTRUM_SLICE_SIZE
     );
    }
    else {
     var first = decodeByteArray(this.firstBinaryArray,this.Parent.CurrentScan.Internal.CompressionType[0],this.Parent.CurrentScan.Internal.BinaryDataPrecision[0],true);
     var second = decodeByteArray(text,this.Parent.CurrentScan.Internal.CompressionType[1],this.Parent.CurrentScan.Internal.BinaryDataPrecision[1],true);
     var a = [];
     var b = [];
     if (this.Parent.CurrentScan.Internal.BinaryDataID[0] == 1000514 && this.Parent.CurrentScan.Internal.BinaryDataID[1] == 1000515) {
      a = first;
      b = second;
     }
     else if (this.Parent.CurrentScan.Internal.BinaryDataID[0] == 1000515 && this.Parent.CurrentScan.Internal.BinaryDataID[1] == 1000514) {
      b = first;
      a = second;
     }
     else {
      console.log("Error: Unrecognised mz/int order of binary data in mzML");
     }
     this.Parent.CurrentScan.SpectrumData.mzs = a.filter(function(mz,i) {return b[i]});
     this.Parent.CurrentScan.SpectrumData.ints = b.filter(function(inten,i) {return b[i]});
     delete this.firstBinaryArray;
     Finished.call(this.Parent);
    }
   }
   else {
    this.TextBuffer = text;
    this.readText(
     parseSpectrumData.mzML,
     this.Position,
     MZML_SPECTRUM_SLICE_SIZE
    )
   }
  },
  mzXML : function() {
   var text = this.TextBuffer.replace(/\n|\r/gm,"") + this.result;
   var end_peaks_index = text.indexOf("</peaks>")
   if (end_peaks_index >= 0) {
    text = text.substr(0,end_peaks_index);
    var values = decodeByteArray(text,this.Parent.CurrentScan.Internal.CompressionType[0],this.Parent.CurrentScan.Internal.BinaryDataPrecision[0],(this.Parent.CurrentScan.Internal.BinaryDataEndianness!="network"))
    var a = [];
    var b = [];
    if (this.Parent.CurrentScan.Internal.BinaryDataID[0] == "-int") {
     for (var i = 0; i < values.length; i = i+2) { 
      a.push(values[i]);
      b.push(values[i+1]);
     }
    }
    else {
     for (var i = 0; i < values.length; i = i+2) { 
      b.push(values[i]); 
      a.push(values[i+1]);
     }
    }
    this.Parent.CurrentScan.SpectrumData.mzs = a.filter(function(mz,i) {return b[i]});
    this.Parent.CurrentScan.SpectrumData.ints = b.filter(function(inten,i) {return b[i]});
    Finished.call(this.Parent);
   }
   else {
    this.TextBuffer = text;
    this.readText(
     parseSpectrumData.mzXML,
     this.Position,
     MZXML_SPECTRUM_SLICE_SIZE
    );
   }
  }
 };

 //------------------------------------------------------------------------------
 //Format-specific regexes for data extraction
 //------------------------------------------------------------------------------

 var regex = {};
 regex.mzML = {
  Index : /<indexListOffset>(\d+)<\/indexListOffset>/,
  ScanOffset : /<offset\sidRef=".*?scan=(\d+)".*?>(\d+)$/,
  Scan : {
   ScanNumber : /<spectrum\s(?:[^]+\s)?id=".*?scan=(\d+)"/,
   MsLevel : /<cvParam\s(?:[^]+\s)?accession="MS:1000511" name="ms level" value="(\d+)"/,
   Centroided : /<cvParam\s(?:[^]+\s)?accession="MS:1000127" name="centroid spectrum"/,
   RetentionTime : /<cvParam\s(?:[^]+\s)?accession="MS:1000016" name="scan start time" value="(\d+\.?\d+)"/,
   RTUnits : /<cvParam\s(?:[^]+\s)?accession="MS:1000016" name="scan start time"\s(?:[^]+\s)?unitName="(.+?)"/,
   LowMz : /<cvParam\s(?:[^]+\s)?accession="MS:1000501" name="scan window lower limit" value="(.+?)"/,
   HighMz : /<cvParam\s(?:[^]+\s)?accession="MS:1000500" name="scan window upper limit" value="(.+?)"/,
   BasePeakMz : /<cvParam\s(?:[^]+\s)?accession="MS:1000504" name="base peak m\/z" value="(.+?)"/,
   BasePeakIntensity : /<cvParam\s(?:[^]+\s)?accession="MS:1000505" name="base peak intensity" value="(.+?)"/,
   PrecursorMzs : /<cvParam\s(?:[^]+\s)?accession="MS:1000744" name="selected ion m\/z" value="(\d+\.?\d+)"/,
   PrecursorCharges : /<cvParam\s(?:[^]+\s)?accession="MS:1000041" name="charge state" value="(\d+)"/,
   PrecursorIntensities : /<cvParam\s(?:[^]+\s)?accession="MS:1000042" name="peak intensity" value="(\d+\.?\d*e?\+?\d*)"/,
   ActivationMethods : /<cvParam\s(?:[^]+\s)?accession="MS:(1000133|1000422|1000598|1000599)"/,
   BinaryDataListCount : /<binaryDataArrayList\s(?:[^]+\s)?count="(\d+)"/,
   BinaryDataLength : /<binaryDataArray\s(?:[^]+\s)?encodedLength="(\d+)"/,
   CompressionType : /<cvParam\s(?:[^]+\s)?accession="MS:1000574" name="(zlib) compression"/,
   BinaryDataPrecision : /<cvParam\s(?:[^]+\s)?accession="(?:MS:1000521|MS:1000523)" name="(32|64)-bit float"/,
   BinaryDataID : /<cvParam\s(?:[^]+\s)?accession="MS:(1000514|1000515)"/
  }
 }
 regex.mzML.ScanKeys = Object.keys(regex.mzML.Scan);

 regex.mzXML = {
  Index : /<indexOffset>(\d+)<\/indexOffset>/,
  ScanOffset : /<offset\sid="(\d+)".*?>(\d+)$/,
  Scan : {
   ScanNumber : /<scan\s(?:[^]+\s)?num="(\d+?)"/,
   MsLevel : /<scan\s(?:[^]+\s)?msLevel="(\d+?)"/,
   Centroided : /<scan\s(?:[^]+\s)?centroided="([01])"/,
   RetentionTime : /<scan\s(?:[^]+\s)?retentionTime="PT(\d+\.?\d+)S"/,
   LowMz : /<scan\s(?:[^]+\s)?startMz="(.+?)"/,
   HighMz : /<scan\s(?:[^]+\s)?endMz="(.+?)"/,
   BasePeakMz : /<scan\s(?:[^]+\s)?basePeakMz="(.+?)"/,
   BasePeakIntensity : /<scan\s(?:[^]+\s)?basePeakIntensity="(.+?)"/,
   PrecursorMzs : /(\d+\.?\d+)<\/precursorMz/,
   PrecursorCharges : /<precursorMz\s(?:[^]+\s)?precursorCharge="(\d+?)"/,
   PrecursorIntensities : /<precursorMz\s(?:[^]+\s)?precursorIntensity="(\d+\.?\d*e?\+?\d*)"/,
   ActivationMethods : /<precursorMz\s(?:[^]+\s)?activationMethod="(.+?)"/,
   BinaryDataLength :  /<peaks\s(?:[^]+\s)?compressedLen="(\d+)"/,
   CompressionType : /<peaks\s(?:[^]+\s)?compressionType="(.+)"/,
   BinaryDataPrecision : /<peaks\s(?:[^]+\s)?precision="(\d+)"/,  
   BinaryDataID : /<peaks\s(?:[^]+\s)?contentType=".+?(-?int-?)"/,
   BinaryDataEndianness : /<peaks\s(?:[^]+\s)?byteOrder="(.+?)"/
  }
 }
 regex.mzXML.ScanKeys = Object.keys(regex.mzXML.Scan);
 
 //------------------------------------------------------------------------------
 //Data array decoding
 //------------------------------------------------------------------------------
 
 var decodeByteArray = function(t,c,p,e) {
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
  if (p == 32) {
   if (bytes.length % 4) {
    console.log("Error: Byte array length not a multiple of 4");
   }
   for (var i = 0; i < dV.byteLength; i = i+4) { 
    values.push(dV.getFloat32(i,e)); 
   }
  }
  else if (p == 64) {
   if (bytes.length % 8) {
    console.log("Error: Byte array length not a multiple of 8");
   }
   for (var i = 0; i < dV.byteLength-1; i = i+8) { 
    values.push(dV.getFloat64(i,e)); 
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