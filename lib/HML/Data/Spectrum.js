"use strict";

if (typeof HML == 'undefined') var HML = {};
if (typeof HML.Data == 'undefined') HML.Data = {};

HML.Data.Spectrum = function() {

 var Spectrum = function(mzs,ints) {
  if ([mzs,ints].some(function(v) {return !((typeof(v) == "object") && Array.isArray(v))})) {
   console.log("both arguments to Spectrum must be an array");
   return {};
  }
  if (mzs.length != ints.length) {
   console.log("both arguments to Spectrum must be of equal length");
   return {};
  }
  this.mzs = mzs.map(function(v){return parseFloat(v)});
  this.ints = ints.map(function(v){return parseFloat(v)});
 }

 Spectrum.prototype.getCroppedSpectrum = function(mz_min,mz_max) {
  //maybe replace this with a slice?
  function crop_filter(ele,i) {
   return((this.mzs[i] >= mz_min) && (this.mzs[i] <= mz_max));
  }
  return new Spectrum(this.mzs.filter(crop_filter.bind(this)),this.ints.filter(crop_filter.bind(this)),1);
 };

 Spectrum.prototype.getMinMz = function() {
  if(!this.mzs.length) {
   return 0;
  }
  else {
   return Math.min.apply(null,this.mzs);
  }
 };

 Spectrum.prototype.getMaxMz = function() {
  if(!this.mzs.length) {
   return 0;
  }
  else {
   return Math.max.apply(null,this.mzs);
  }
 };

 Spectrum.prototype.getMaxIntensity = function() {
  if(!this.ints.length) {
   return 0;
  }
  else {
   return Math.max.apply(null,this.ints);
  }
 };

 Spectrum.prototype.getTotalIntensity = function() {
  if(!this.ints.length) {
   return 0;
  }
  else {
   return(this.ints.reduce(function(a,b){return a+b}));
  }
 };

 Spectrum.prototype.getBasePeakIndex = function() {
  var maxIndex = 0;
  var maxInt = 0;
  for (var i in this.ints) {
   if (this.ints[i] > maxInt) {
    maxIndex = i;
    maxInt = this.ints[i];
   }
  }
  return(maxIndex);
 };

 Spectrum.prototype.getBasePeakMz = function() {
  return(this.mzs[this.getBasePeakIndex()]);
 };

 Spectrum.prototype.getBasePeakIntensity = function() {
  return(this.ints[this.getBasePeakIndex()]);
 };

 Spectrum.prototype.getMatchedSpectra = function(comparator,mzPPMError) {
  if ((typeof(comparator) != "object") || (comparator.constructor !== this.constructor)) {
   console.log("can only getMatchedMz from another Spectrum");
   return Number.NaN;
  } 
  if (typeof(mzPPMError) == "undefined") {
   console.log("mzPPMError must be specified");
   return Number.NaN;
  }
 
  var diffs = [];
  for (var i in this.mzs) {
   for (var j in comparator.mzs) {
    diffs.push([i,j,HML.Math.avgPpmDiff(this.mzs[i],comparator.mzs[j])]);
   }
  }
  diffs.sort(function(a,b) {return a[2] - b[2]});
 
  var this_matched = [];
  for (var i in this.mzs) {
   this_matched[i] = 0;
  }
  var comp_matched = [];
  for (var j in comparator.mzs) {
   comp_matched[j] = 0;
  }
 
  var this_matchlist = [];
  var comp_matchlist = [];
  for (var d in diffs) {
   if (diffs[d][2] > mzPPMError) {
    break;
   }
   if (this_matched[diffs[d][0]] || comp_matched[diffs[d][1]]) {
    continue;
   }
   else {
    this_matchlist.push([this.mzs[diffs[d][0]],this.ints[diffs[d][0]]]);
    comp_matchlist.push([comparator.mzs[diffs[d][1]],comparator.ints[diffs[d][1]]]);
    this_matched[diffs[d][0]] = 1;
    comp_matched[diffs[d][1]] = 1;
   }
  }
 
  for (var i in this.mzs) {
   if (!this_matched[i]) {
    this_matchlist.push([this.mzs[i],this.ints[i]]);
    comp_matchlist.push([this.mzs[i],0]);
   }
  }
  for (var j in comparator.mzs) {
   if (!comp_matched[j]) {
    this_matchlist.push([comparator.mzs[j],0]);
    comp_matchlist.push([comparator.mzs[j],comparator.ints[j]]);
   }
  }
 
  this_matchlist.sort(function(a,b) {return a[0] - b[0]});
  comp_matchlist.sort(function(a,b) {return a[0] - b[0]});
 
  return ([
           new Spectrum(this_matchlist.map(function(a){return a[0]}),this_matchlist.map(function(a){return a[1]})),
           new Spectrum(comp_matchlist.map(function(a){return a[0]}),comp_matchlist.map(function(a){return a[1]}))
          ]);
 };

 Spectrum.prototype.getNormalisedSpectralContrastAngleTo = function(comparator,mzPPMError) {
  if ((typeof(comparator) != "object") || (comparator.constructor !== this.constructor)) {
   console.log("can only getNormalisedSpectralContrastAngleTo another Spectrum");
   return Number.NaN;
  }
  if (typeof(mzPPMError) == "undefined") {
   mzPPMError = 5.0;
  }
  var matched_spectra = this.getMatchedSpectra(comparator,mzPPMError);
  return HML.Math.sqrtUnitNormalisedSpectralContrastAngle(matched_spectra[0].ints,matched_spectra[1].ints);
 };

 return Spectrum;

}();