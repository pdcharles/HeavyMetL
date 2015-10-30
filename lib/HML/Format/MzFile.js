//------------------------------------------------------------------------------
//requires zpipe!
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
//requires browser support for FileReader methods
//------------------------------------------------------------------------------

if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
 alert('File APIs are not fully supported in this browser.');
}

if (typeof HML == 'undefined') {
 HML = {};
}

if (typeof HML.File == 'undefined') {
 HML.Format = {};
}

HML.Format.MzFile = function() {
 
 //try to optimise buffer size in bytes for various tasks
 //for indexoffset and header, want to grab entire header in one read most of the time, but not too much of the spectrum
 //however if offsets are not indexed, need to slurp huge chucks of the file and locate scan tags by regex
 //for offsetlist, want to grab several large chunks
 //for spectrum, want to grab a large chunk but not too large or inefficient for the very numerous low-data spectra

 var USE_INDICES = 1;
 var INDEXOFFSET_SLICE_SIZE = 1000;
 var UNINDEXED_OFFSET_SLICE_SIZE = 5000000;
 var HEADER_SLICE_SIZE = 2000;
 var MZML_SPECTRUM_SLICE_SIZE = 12000;
 var MZXML_SPECTRUM_SLICE_SIZE = 24000;
 
 var MzFile = function(f) {
  if (!f) {
   console.log("Error: file path not specified");
   return;
  }
  this.File = f;
  if (f.name.match(/\.mzML$/i)) {
   this.FileType = "mzML";
  }
  else if (f.name.match(/\.mzXML$/i)) {
   this.FileType = "mzXML";
  }
  else {
   this.FileType = "unknown";
   console.log("Error: unknown file type");
   return;
  }
  this.Ready       = 1;
  this.Progress    = 100;
  this.ScanOffsets = [];
  this.IndexOffset = 0;
  this.Scan        = new Scan;
 };
 
 var Scan = function() {
  this.scanNumber         = 0;
  this.Populated          = 0;
  this.msLevel            = 0;
  this.centroided         = 0;
  this.retentionTime      = 0;
  this.lowMz              = 0;
  this.highMz             = 0;
  this.basePeakMz         = 0;
  this.basePeakIntensity  = 0;
  this.precursorIntensity = 0;
  this.precursorCharge    = 0;
  this.activationMethod   = 0;
  this.precursorMz        = 0;
  this.compressionType    = [];
  this.precision          = [];
  this.binaryDataLength   = [];
  this.binaryDataOffset   = [];
  this.binaryDataID       = [];
  this.spectrumData       = {};
 };
 
 
 //------------------------------------------------------------------------------
 //MzFile methods
 //------------------------------------------------------------------------------
 
 MzFile.prototype.getFirstScanNumber = function() {
  if (this.ScanOffsets.length) {
   var s = 0;
   var last_scan = this.getLastScanNumber()
   while (!this.ScanOffsets[++s] && (scan <= last_scan)) {};
   if (this.ScanOffsets[s]) {
    return(s);
   }
   else {
    return(null);
   }
  }
  else {
   return(null);
  }
 };
 
 MzFile.prototype.getLastScanNumber = function() {
  if (this.ScanOffsets.length) {
   return(this.ScanOffsets.length-1);
  }
  else {
   return(null);
  }
 };
 
 MzFile.prototype.getPreviousScanNumber = function(scan) {
  if (this.ScanOffsets.length && this.ScanOffsets[scan]) {
   var s = scan;
   while (!this.ScanOffsets[--s] && (s > 0)) {};
   if (this.ScanOffsets[s]) {
    return(s);
   }
   else {
    return(null);
   }
  }
  else {
   return(null);
  }
 };
 
 MzFile.prototype.getNextScanNumber = function(scan) {
  if (this.ScanOffsets.length && this.ScanOffsets[scan]) {
   var s = scan;
   var last_scan = this.getLastScanNumber()
   while (!this.ScanOffsets[++s] && (scan <= last_scan)) {};
   if (this.ScanOffsets[s]) {
    return(s);
   }
   else {
    return(null);
   }
  }
  else {
   return(null);
  }
 };
 
 //Populate Scan Offsets
 MzFile.prototype.fetchScanOffsets = function() {
  this.Ready = 0;
  this.Progress = 0;
  (new bufferedFileReader(
   this.File,
   this.File.size-INDEXOFFSET_SLICE_SIZE,
   INDEXOFFSET_SLICE_SIZE,
   filetype[this.FileType].parseScanOffsetStart,
   fetchScanOffsets2,
   this
  )).read_data();
 };
 
 var fetchScanOffsets2 = function() {
  if (this.IndexOffset && USE_INDICES) {
   this.ScanOffsets = [];
   (new bufferedFileReader(
    this.File,
    this.IndexOffset,
    this.File.size - this.IndexOffset,
    filetype[this.FileType].parseScanOffsetList,
    SetReady,
    this
   )).read_data();
  }
  else if (this.FileType == "mzXML") {
   console.log("Warning: IndexOffset is undefined - will manually parse scan offsets");
   this.ScanOffsets = [];
   (new bufferedFileReader(
    this.File,
    0,
    UNINDEXED_OFFSET_SLICE_SIZE,
    filetype.mzXML.parseUnindexedScanOffsets,
    SetReady,
    this
   )).read_data();
  }
  else {
   console.log("IndexOffset is undefined");
  }
 };
 
 //Populate Single Scan Header
 MzFile.prototype.fetchScan = function(scan,prefetchSpectrumData) {
  if (this.ScanOffsets.length && this.ScanOffsets[scan]) {
   this.Ready = 0;
   this.Scan = new Scan();
   (new bufferedFileReader(
    this.File,
    this.ScanOffsets[scan],
    HEADER_SLICE_SIZE,
    filetype[this.FileType].parseScanHeader,
    (prefetchSpectrumData ? this.fetchSpectrumData : SetReady),
    this
   )).read_data();
  }
  else {
   console.log("fetchScan failed");
  }
 };
 
 //Populate Spectrum
 MzFile.prototype.fetchSpectrumData = function() {
  if (this.Scan && this.Scan.Populated) {
   this.Ready = 0;
   this.Scan.spectrumData = {};
   (new bufferedFileReader(
    this.File,
    this.Scan.binaryDataOffset[0],
    this.Scan.binaryDataLength[0] ? this.Scan.binaryDataLength[0] + (this.FileType == "mzML" ? 10 : 9) : (this.FileType == "mzML" ? MZML_SPECTRUM_SLICE_SIZE : MZXML_SPECTRUM_SLICE_SIZE), //can probably be further optimised
    filetype[this.FileType].parseSpectrumData,
    SetReady,
    this
   )).read_data();
  }
 };
 
 //------------------------------------------------------------------------------
 //Chained function endpoint
 //------------------------------------------------------------------------------
 
 var SetReady = function() {
  this.Progress = 100;
  this.Ready = 1;
 };
 
 //------------------------------------------------------------------------------
 //mzML-specific code
 //------------------------------------------------------------------------------
 
 var filetype = {}

 filetype.mzML = {
  parseScanOffsetStart : function() {
   var regexmatch = /<indexListOffset>(\d+)<\/indexListOffset>/.exec(this.result);
   if (regexmatch) {
    this.parent_context.IndexOffset = +regexmatch[1];
   }
   else {
    console.log("Can't find indexListOffset");
   }
   return(0);
  },  
  parseScanOffsetList : function() {
   var text = this.buffer + this.result;
   var end_offset_index = text.lastIndexOf("</offset>") + 9;
   var offsets = text.substr(0,end_offset_index).split("</offset>");
   for (var i = 0; i < offsets.length-1; i++) {
    var regexmatch = /<offset idRef=".*?scan=(\d+)".*?>(\d+)$/.exec(offsets[i]);
    if (regexmatch) {
     this.parent_context.ScanOffsets[regexmatch[1]] = +regexmatch[2];
    }
   }
   text = text.substr(end_offset_index);
   this.parent_context.Progress = 100-((this.file.size - this.read_position)/(this.file.size - this.parent_context.IndexOffset))*100;
   if (text.match(/<indexListOffset>/)) {
    this.parent_context.Populated = 1;
    return(0);
   }
   else {
    this.buffer = text;
    return(1);
   }
  },
  parseScanHeader : function() {
   var text = this.buffer + this.result;
   var end_ele_index = text.lastIndexOf(">") + 1;
   var eles = text.substr(0,end_ele_index).split(">");
   for (var i = 0; i < eles.length-1; i++) {
    var regexmatch;
    if (/<spectrum /.exec(eles[i])) {
     regexmatch = /id=".*?scan=(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.scanNumber = +regexmatch[1];
     }
    }
    else if (/<cvParam /.exec(eles[i])) {
     regexmatch = /accession="MS:1000511" name="ms level" value="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.msLevel = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000127" name="centroid spectrum" value=""/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.centroided = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000016" name="scan start time" value="(\d+\.?\d+)"/.exec(eles[i]);
     if (regexmatch) {
      if (/unitName="minute"/.exec(eles[i])) {
       this.parent_context.Scan.retentionTime = +regexmatch[1]/60;
      }
     }
     regexmatch = /accession="MS:1000528" name="lowest observed m\/z" value="(.+?)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.lowMz = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000527" name="highest observed m\/z" value="(.+?)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.highMz = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000504" name="base peak m\/z" value="(.+?)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.basePeakMz = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000505" name="base peak intensity" value="(.+?)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.basePeakIntensity = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000744" name="selected ion m\/z" value="(\d+\.?\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.precursorMz = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000041" name="charge state" value="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.precursorCharge = +regexmatch[1];
     }
     regexmatch = /accession="MS:1000042" name="peak intensity" value="(\d+\.?\d*e?\+?\d*)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.precursorIntensity = +regexmatch[1];
     }
     if (/accession="MS:1000133" name="collision-induced dissociation"/.exec(eles[i])) {
      this.parent_context.Scan.activationMethod = "CID";
     }
     if (/accession="MS:1000422" name="high-energy collision-induced dissociation"/.exec(eles[i])) {
      this.parent_context.Scan.activationMethod = "HCD";
     }
     if (/accession="MS:1000598" name="electron transfer dissociation"/.exec(eles[i])) {
      this.parent_context.Scan.activationMethod = "ETD";
     }
     if (/accession="MS:1000599" name="pulsed q dissociation"/.exec(eles[i])) {
      this.parent_context.Scan.activationMethod = "PQD";
     }
     regexmatch = /accession="MS:1000574" name="zlib compression"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.compressionType.push("zlib");
     }
     regexmatch = /accession="(?:MS:1000521|MS:1000523)" name="(32|64)-bit float"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.precision.push(+regexmatch[1]);
     }
     if (/accession="MS:1000514" name="m\/z array"/.exec(eles[i])) {
      this.parent_context.Scan.binaryDataID.push("mz");
     }
     if (/accession="MS:1000515" name="intensity array"/.exec(eles[i])) {
      this.parent_context.Scan.binaryDataID.push("int");
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
      this.parent_context.Scan.binaryDataLength.push(+regexmatch[1]);
     }
    }
    else if (/<binary$/.exec(eles[i])) {
     //current binary element offset is start position of the text + length of this and all previous eles + i + 1(correct for missing >)
     this.parent_context.Scan.binaryDataOffset.push(this.read_position - text.length + eles.slice(0,i+1).join("").length + i + 1)   
     if (!this.parent_context.Scan.binaryDataOffset[1]) {
      if (this.parent_context.Scan.binaryDataLength[0]) {
       this.read_position = +this.parent_context.Scan.binaryDataOffset[0]+this.parent_context.Scan.binaryDataLength[0] + 9;
      }
      else { //finding second binary element when no binaryDataLength - large read from binaryDataOffset of the first binary element
       this.read_position = +this.parent_context.Scan.binaryDataOffset[0];
       this.slice_size = MZML_SPECTRUM_SLICE_SIZE;
      }
     }
     text = "";
     break;  //Always break after finding first binary element and do a new read with no buffer
    }
   }
   if (this.parent_context.Scan.binaryDataOffset[1]) {
    this.parent_context.Scan.Populated = 1;
    return(0);
   }
   else {
    text = text.substr(end_ele_index);
    this.buffer = text;
    return(1);
   }
  },
  parseSpectrumData : function() {
   var text = this.buffer + this.result;
   var binary_index = text.indexOf("</binary>");
   if (binary_index >= 0) {
    text = text.substr(0,binary_index);
    text = text.replace(/\n|\r/gm,"");
    if (!this.firstBinaryArray) {
     this.read_position = +this.parent_context.Scan.binaryDataOffset[1];
     this.slice_size = +this.parent_context.Scan.binaryDataLength[1] + 9;
     this.firstBinaryArray = text;
     this.buffer = "";
     return(1);
    }
    else {
     var a,b;
     a = decodeByteArray(this.firstBinaryArray,this.parent_context.Scan.compressionType[0],this.parent_context.Scan.precision[0]);
     b = decodeByteArray(text,this.parent_context.Scan.compressionType[1],this.parent_context.Scan.precision[1]);
     if (this.parent_context.Scan.binaryDataID[0] == "mz" && this.parent_context.Scan.binaryDataID[1] == "int") {
      this.parent_context.Scan.spectrumData.mzs = a;
      this.parent_context.Scan.spectrumData.ints = b;
     }
     else if (this.parent_context.Scan.binaryDataID[0] == "int" && this.parent_context.Scan.binaryDataID[1] == "mz") {
      this.parent_context.Scan.spectrumData.mzs = b;
      this.parent_context.Scan.spectrumData.ints = a;
     }
     else {
      console.log("Error: Unrecognised mz/int order of binary data in mzML");
     }
     return(0);
    }
   }
   else {
    this.buffer = text;
    return(1);
   }
  }
 };
 
 //------------------------------------------------------------------------------
 //mzXML-specific code
 //------------------------------------------------------------------------------
 
 filetype.mzXML = {
  parseScanOffsetStart : function() {
   var regexmatch = /<indexOffset>(\d+)<\/indexOffset>/.exec(this.result);
   if (regexmatch) {
    this.parent_context.IndexOffset = regexmatch[1];
   }
   else {
    console.log("Can't find indexOffset");
   }
   return(0);
  },
  parseScanOffsetList : function() {
   var text = this.buffer + this.result;
   var end_offset_index = text.lastIndexOf("</offset>") + 9;
   var offsets = text.substr(0,end_offset_index).split("</offset>");
   for (var i = 0; i < offsets.length-1; i++) {
    var regexmatch = /<offset id="(\d+)".*?>(\d+)/.exec(offsets[i]);
    if (regexmatch) {
     this.parent_context.ScanOffsets[regexmatch[1]] = +regexmatch[2];
    }
   }
   text = text.substr(end_offset_index);
   if (text.match(/<indexOffset>/)) {
    this.parent_context.Populated = 1;
    return(0);
   }
   else {
    this.buffer = text;
    return(1);
   }
  },
  parseUnindexedScanOffsets : function() {
   var text = this.buffer + this.result;
   var text_offset = this.read_position - this.slice_size - this.buffer.length;
   var RE = /<scan num="(\d+)"/g;
   var end_scannum_index;
   while ((regexmatch = RE.exec(text)) !== null) {
    this.parent_context.ScanOffsets[regexmatch[1]] = (text_offset + RE.lastIndex - regexmatch[0].length);
    end_scannum_index = RE.lastIndex;
   }
   text = text.substr(end_scannum_index);
   if (text.match(/<\/mzXML>/)) {
    this.parent_context.Populated = 1;
    return(0);
   }
   else {
    this.buffer = text;
    return(1);
   }
  },
  parseScanHeader : function() {
   var text = this.buffer + this.result;
   var end_ele_index = text.lastIndexOf(">") + 1;
   var eles = text.substr(0,end_ele_index).split(">");
   for (var i = 0; i < eles.length-1; i++) {
    var regexmatch;
    if (/<scan /.exec(eles[i])) {
     regexmatch = /num="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.scanNumber = +regexmatch[1];
     }
     regexmatch = /msLevel="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.msLevel = +regexmatch[1];
     }
     regexmatch = /centroided="([01])"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.centroided = +regexmatch[1];
     }
     regexmatch = /retentionTime="PT(\d+\.?\d+)S"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.retentionTime = +regexmatch[1]/60;
     }
     regexmatch = /lowMz="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.lowMz = +regexmatch[1];
     }
     regexmatch = /highMz="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.highMz = +regexmatch[1];
     }
     regexmatch = /basePeakMz="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.basePeakMz = +regexmatch[1];
     }
     regexmatch = /basePeakIntensity="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.basePeakIntensity = +regexmatch[1];
     }
    }
    else if (/<precursorMz /.exec(eles[i])) {
     regexmatch = /precursorIntensity="(\d+\.?\d*e?\+?\d*)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.precursorIntensity = +regexmatch[1];
     }
     regexmatch = /precursorCharge="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.precursorCharge = +regexmatch[1];
     }
     regexmatch = /activationMethod="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.activationMethod = regexmatch[1];
     }
    }
    else if (/\d+\.?\d+<\/precursorMz>/.exec(eles[i])) {
     regexmatch = /(\d+\.?\d+)<\/precursorMz>/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.precursorMz = +regexmatch[1];
     }
    }
    else if (/<peaks/.exec(eles[i])) {
     regexmatch = /compressionType="(.+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.compressionType.push(regexmatch[1]);
     }
     regexmatch = /compressedLen="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.binaryDataLength.push(4*Math.ceil(regexmatch[1]/3)); //compressedLen is length after compression but before base64 encoding, need to convert
     }
     regexmatch = /precision="(\d+)"/.exec(eles[i]);
     if (regexmatch) {
      this.parent_context.Scan.precision.push(+regexmatch[1]);
     }
     this.parent_context.Scan.binaryDataID.push('mz-int');
     this.parent_context.Scan.binaryDataOffset.push(this.read_position - text.length + eles.slice(0,i+1).join("").length + i + 1)   
     break;
    }
   }
   if (this.parent_context.Scan.binaryDataOffset[0]) {
    this.parent_context.Scan.Populated = 1;
    return(0);
   }
   else {
    text = text.substr(end_ele_index);
    this.buffer = text;
    return(1);
   }
  },
  parseSpectrumData : function() {
   var text = this.buffer + this.result;
   var end_peaks_index = text.indexOf("</peaks>")
   if (end_peaks_index >= 0) {
    text = text.substr(0,end_peaks_index);
    text = text.replace(/\n|\r/gm,"");
    var values = decodeByteArray(text,this.parent_context.Scan.compressionType[0],this.parent_context.Scan.precision[0])
    this.parent_context.Scan.spectrumData.mzs = [];
    this.parent_context.Scan.spectrumData.ints = [];
    if (this.parent_context.Scan.binaryDataID[0] == "mz-int") {
     for (var i = 0; i < values.length; i = i+2) { 
      this.parent_context.Scan.spectrumData.mzs.push(values[i]);
      this.parent_context.Scan.spectrumData.ints.push(values[i+1])
     }
    }
    else {
     console.log("Error: Unrecognised mz/int order of binary data in mzXML");
    }
    return(0);
   }
   else {
    this.buffer = text;
    return(1);
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
  s = window.atob(t); //decode base64
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
  var dV = new DataView(bytes.buffer);
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
 
 //------------------------------------------------------------------------------
 //bufferedFileReader extends FileReader for chained async processing
 //------------------------------------------------------------------------------
 
 var bufferedFileReader = function(file,readPosition,sliceSize,parseFunction,followupFunction,parentContext) {
  var reader = new FileReader();
  reader.buffer = "";
  if ((typeof(file) !== 'undefined')) {
   reader.file = file;
  }
  else {
   console.log("Error: Invalid File object");
   return;
  }
  if ((typeof(readPosition) !== 'undefined')) {
   reader.read_position = +readPosition;
  }
  else {
   console.log("Error: Invalid readPosition");
   return;
  }
  if ((typeof(sliceSize) !== 'undefined')) {
   reader.slice_size = +sliceSize;
  }
  else {
   console.log("Error: Invalid sliceSize");
   return;
  }
  if ((typeof(parseFunction) !== 'undefined')) {
   reader.parse_data = parseFunction;
  }
  else {
   console.log("Error: Invalid parseFunction");
   return;
  }
  if ((typeof(followupFunction) !== 'undefined')) {
   reader.followup = followupFunction;
  }
  else {
   console.log("Error: Invalid followupFunction");
   return;
  }
  if ((typeof(parentContext) !== 'undefined')) {
   reader.parent_context = parentContext;
  }
  else {
   reader.parent_context = undefined;
  }
  reader.read_data = function() {
   if (this.read_position >= this.file.size) {
    console.log("Error: End of file before offset " + this.read_position);
   }
   else {
    var fileSlice;
    if ((this.file.size - this.read_position) > this.slice_size) {
     fileSlice = this.file.slice(this.read_position, this.read_position + this.slice_size);
     this.read_position = this.read_position + this.slice_size;
    }
    else {
     fileSlice = this.file.slice(this.read_position);
     this.read_position = this.file.size;
    }
    this.readAsText(fileSlice);
   }
  };
  reader.process_read = function() {
   if (!this.error) {
    if (this.parse_data()) {
     this.read_data();
    }
    else {
     if (this.parent_context) {
      this.followup.apply(this.parent_context);
     }
     else {
      this.followup();
     }
    }
   }
   else {
    console.log("Error: Failed to read file - "+this.error);  
   }
  };
  reader.onloadend = function(e) {e.target.process_read()};
  reader.onerror = function(e) {console.log("Error: In file " + e.target.file + " -  " + e.target.error)};
  return reader;
 };

 return MzFile;

}();