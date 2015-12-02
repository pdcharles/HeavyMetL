"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.Reader = function() {

 var Reader = function(f,parent) {
  var r = new FileReader();
  if ((typeof(f) !== 'undefined')) {
   r.File = f;
  }
  else {
   console.log("Error: Invalid File object");
   return {};
  }
  r.Parent = parent;
  r.Position = 0;
  r.Report = 0;
  r.onerror = function(e) {console.log("Error: In file " + e.target.File + " -  " + e.target.error)};
  //r.getFileSlice = getFileSlice;
  r.readBinary = readBinary;
  r.readText = readText;
  return r;
 };

 var getFileSlice = function(pos,len) {
  if (pos >= this.File.size) {
   console.log("Error: Last valid file offset ("+(this.File.size-1)+") is before offset " + pos);
   return(null);
  }
  else {
   var fS;
   if ((len != null) && (len < (this.File.size - pos))) {
    fS = this.File.slice(pos, pos + len);
    this.Position = pos + len;
   }
   else {
    fS = this.File.slice(pos);
    this.Position = this.File.size;
   }
   return(fS);
  }
 }

 var readBinary = function(callback,pos,len,saveAsBuffer) {
  if (this.readyState == 1) return("ReaderNotReady");
  if (this.BinaryBuffer && (pos >= this.BinaryBufferOffset) && ((pos + len) <= (this.BinaryBufferOffset+this.BinaryBuffer.byteLength))) {
   this.Position = pos + len;
   var bbpos = pos - this.BinaryBufferOffset;
   HML.Common.waitUntil(function(){return true},callback.bind({result: this.BinaryBuffer.slice(bbpos, bbpos + len), Parent: this.Parent, Position: this.Position}));
  }
  else {
   if (this.BinaryBuffer) {
    if (this.Report) console.log(">>>>>Clear BinaryBuffer<<<<<");
    delete this.BinaryBuffer;
    delete this.BinaryBufferOffset;
   }
   var fS = getFileSlice.call(this,pos,len);
   if (fS) {
    if (saveAsBuffer) {
     if (this.Report) console.log(">>>>>Load bytes "+pos+" to "+this.Position+" into BinaryBuffer<<<<<");
     this.onloadend = (function() {
      this.BinaryBuffer = this.result.slice(0);
      this.BinaryBufferOffset = this.Position - this.BinaryBuffer.byteLength;
      callback.call(this);
     }).bind(this);
    }
    else {
     this.onloadend = callback.bind(this);
    }
    this.readAsArrayBuffer(fS);
   }
   else {
    return("ReaderInvalidFileSlice");
   }
  }
 }

 var readText = function(callback,pos,len) {
  if (this.readyState == 1) return("ReaderNotReady");
  var fS = getFileSlice.call(this,pos,len);
  if (fS) {
   this.onloadend = callback.bind(this);
   this.readAsText(fS);
  }
  else {
   return("ReaderInvalidFileSlice");
  }
 }

 return Reader;

}();