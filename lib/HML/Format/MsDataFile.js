"use strict";

if (typeof HML == 'undefined') var HML = {};
if (typeof HML.Format == 'undefined') HML.Format = {};

HML.Format.MsDataFile = function() {

 var MsDataFile = function(f) {
  if (!f) {
   console.log("Error: file path not specified");
   return {};
  }
  if (f.name.match(/\.mzML$/i)) {
   this.FileType = "mzML";
  }
  else if (f.name.match(/\.mzXML$/i)) {
   this.FileType = "mzXML";
  }
  else if (f.name.match(/\.raw$/i)) {
   this.FileType = "ThermoRaw";
  }
  else {
   this.FileType = "unknown";
   console.log("Error: unknown file type");
   return {};
  }
  this.Reader      = new HML.Reader(f,this);
  this.Ready       = 1;
  this.Progress    = 100;
  this.Report      = 0;
  this.Scans       = [];
  this.Internal    = {Offsets: {}, Minutes: []};
  this.CurrentScan = new HML.Data.Scan();
 };

 MsDataFile.prototype.getFirstScanNumber = function() {
  if (this.Scans.length) {
   var s = this.Scans.findIndex(function(e) { return e != undefined });
   return (s >= 0 ? s : null);
  }
  else {
   return(null);
  }
 };
 
 MsDataFile.prototype.getLastScanNumber = function() {
  if (this.Scans.length) {
   return(this.Scans.length-1);
  }
  else {
   return(null);
  }
 };
 
 MsDataFile.prototype.getPreviousScanNumber = function(scan) {
  if (this.Scans.length && this.Scans[scan]) {
   return(this.Scans[scan].Previous || null);
  }
  else {
   return(null);
  }
 };
 
 MsDataFile.prototype.getNextScanNumber = function(scan) {
  if (this.Scans.length && this.Scans[scan]) {
   return(this.Scans[scan].Next || null);
  }
  else {
   return(null);
  }
 };

 var populateMinutes = function() {
  this.Scans.forEach(function(ele) {
   var minute = Math.round(ele.Scan.RetentionTime);
   if (!this.Internal.Minutes[minute]) {
    this.Internal.Minutes[minute] = [];
   }
   this.Internal.Minutes[minute].push(ele.Scan.ScanNumber);
  });
 }

 MsDataFile.prototype.getNearestMSXScanNumberfromRT = function(mslevel,retention_time,match_low) {
  if (!this.Ready) return null;
  if (!this.Internal.Minutes.length) populateMinutes.call(this);
  var S = this.Scans.filter(function(ele) { return ele.Scan.msLevel == mslevel }).map(function(ele) {return ele.Scan.ScanNumber});
  var firstMSXRT = this.Scans[S[0]].Scan.RetentionTime;
  var lastMSXRT = this.Scans[S[S.length-1]].Scan.RetentionTime;
  if (retention_time <= firstMSXRT) { return S[0] };
  if (retention_time >= lastMSXRT) { return S[S.length-1] };
  var minute = Math.round(retention_time);
  var possibles = this.Internal.Minutes[minute].filter(function(p) { return this.Scans[p].Scan.msLevel == mslevel });
  //check for exact match
  for (var i = 0; i < possibles.length; i++) {
   if (this.Scans[possibles[i]].RetentionTime == retention_time) { return possibles[i] }; 
  }
  //Otherwise find closest match
  var firstRTMinute = Math.round(firstMSXRT);
  var lastRTMinute = Math.round(lastMSXRT);
  var range = 0;
  do {
   range++;
   var minute_to_add = minute + (match_low ? -range : range);
   if ((minute_to_add < firstRTMinute) || (minute_to_add > lastRTMinute)) {
    return null;
   }
   possibles = possibles.concat(this.Internal.Minutes[minute_to_add].filter(function(p) { return this.Scans[p].Scan.msLevel == mslevel }) || []);
  } while (possibles.length < 1);
  if (match_low) {
   possibles.sort(function(a,b) {return this.Scans[b].Scan.RetentionTime-this.Scans[a].Scan.RetentionTime});
   for (var i = 0; i < possibles.length; i++) {
    if (this.Scans[possibles[i]].RetentionTime < retention_time) { 
     return possibles[i]; 
    }
   }
  }
  else {
   possibles.sort(function(a,b) {return S[a].RetentionTime-S[b].RetentionTime});
   for (var i = 0; i < possibles.length; i++) {
    if (S[possibles[i]].RetentionTime > retention_time) { 
     return possibles[i];
    }
   }
  }
  return null;
 }
 
 MsDataFile.prototype.getNearestMSXScanNumberfromScanNumber = function(mslevel,scan_number,match_low) {
  if (!this.Ready) return null;
  var s = scan_number;
  var firstScan = this.getFirstScanNumber();
  if (!this.Scans[s]) { //e.g. Might be an MS2 and the mzFile only has MS1
   while(--s >= firstScan) { if (this.Scans[s]) break };
  };
  if (!this.Scans[s]) { return null }; //Still couldn't find the scan
  if (this.Scans[s].Scan.MsLevel == mslevel) { return s };
  if (match_low) {
   do { s = this.getPreviousScanNumber(s) } while ((this.Scans[s].Scan.MsLevel != mslevel) && (s >= firstScan));
   if (this.Scans[s].Scan.MsLevel == mslevel) {
    return(s);
   }
   else {
    return(null);
   }
  }
  else {
   var lastScan  = this.getLastScanNumber();
   do { s = this.MzFile.getNextScanNumber(s) } while ((this.Scans[s].Scan.MsLevel != mslevel) && (s <= this.LastMS1Scan));
   if (this.Scans[s].Scan.MsLevel == mslevel) {
    return(s);
   }
   else {
    return(null);
   }
  }
 }

 MsDataFile.prototype.getNearestMSXRTfromScanNumber = function(mslevel,scan_number,match_low) {
  var s = this.getNearestMSXScanNumberfromScanNumber(mslevel,scan_number,match_low);
  return(s != null ? this.Scans[s].Scan.RetentionTime : null);
 }

 //Async PlaceHolders

 MsDataFile.prototype.fetchScanOffsets = function(prefetchScanHeaders) {
  return("MsDataFileNotImplemented");
  console.log("Not Implemented!");
 }

 MsDataFile.prototype.fetchScanHeader = function(scan,prefetchSpectrumData) {
  return("MsDataFileNotImplemented");
  console.log("Not Implemented!");
 }

 MsDataFile.prototype.fetchAllScanHeaders = function() {
  return("MsDataFileNotImplemented");
  console.log("Not Implemented!");
 }

 MsDataFile.prototype.fetchSpectrumData = function() {
  return("MsDataFileNotImplemented");
  console.log("Not Implemented!");
 }


 return MsDataFile;

}();