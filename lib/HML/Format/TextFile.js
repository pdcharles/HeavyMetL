"use strict";

//------------------------------------------------------------------------------
//requires browser support for FileReader methods
//------------------------------------------------------------------------------

if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
 alert('File APIs are not fully supported in this browser.');
}

if (!CSV) {
 alert('Missing CSV library');
}

if (typeof HML == 'undefined') HML = {};
if (typeof HML.Format == 'undefined') HML.Format = {};

HML.Format.TextFile = function () {

 var SLICE_SIZE = parseInt(50000000); //in bytes
 
 var TextFile = function(f) {
  this.File                   = f;
  this.Ready                  = 1;
  this.Progress               = 100;
  this.Delimiter              = "";
  this.UseFirstLineAsHeaders  = 0;
  this.Quoting                = 0;
  this.Headers                = [];
  this.Lines                  = [];
 };
 
 TextFile.prototype.load = function() {
  if (!this.File) {
   console.log("Error: Invalid File object");
   return;
  }
  this.Ready       = 0;
  this.Progress    = 0;
  this.Headers     = [];
  this.Lines       = [];
  var reader = new FileReader();
  reader.file = this.File;
  reader.parent = this;
  reader.buffer = "";
  reader.read_position = parseInt(0);
  reader.onerror = function(e) {console.log("Error: In file " + e.target.file + " -  " + e.target.error)};
  reader.read_data = function() {
   this.parent.Progress = (this.read_position/this.file.size)*100;
   if (this.read_position >= this.file.size) { //on completion
    if (this.read_position > this.file.size) {
     console.log("Warning - read position past end of file");
    }
    if (this.parent.UseFirstLineAsHeaders && this.parent.Lines.length && !this.parent.Headers.length) {
     this.parent.Headers = this.parent.Lines.shift();
    }
    this.parent.Ready = 1;
    this.parent.Progress = 100;
   }
   else {
    var fileSlice;
    if ((this.file.size - this.read_position) > SLICE_SIZE) {
     fileSlice = this.file.slice(this.read_position, this.read_position + SLICE_SIZE);
     this.read_position = this.read_position + SLICE_SIZE;
    }
    else {
     fileSlice = this.file.slice(this.read_position);
     this.read_position = this.file.size;
    }
    this.readAsText(fileSlice);
   }
  };
  reader.onloadend = function(e) {e.target.process_read()};
  reader.process_read = function() {
   if (this.readyState == 2) {
    var text = this.buffer + this.result;
    text = text.replace(/\r\n?/gm,"\n");
    var end_index = text.lastIndexOf("\n") + 1;
    var lines = text.substr(0,end_index).split("\n");
    for (var i = 0; i < lines.length-1; i++) {
     if (this.parent.Delimiter) {
      CSV.COLUMN_SEPARATOR = this.parent.Delimiter;
      this.parent.Lines.push(CSV.parse(lines[i])[0]);
     }
     else {
      this.parent.Lines.push([lines[i]]);
     }
    }
    if (end_index > 0) {
     text = text.substr(end_index);
    }
    this.buffer = text;
    this.read_data()
   }
   else {
    report("Error reading file (unsuccessful read)");
   }
  };
  reader.read_data();
 };

 return TextFile;

}();