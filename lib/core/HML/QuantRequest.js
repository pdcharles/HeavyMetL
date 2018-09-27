"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.QuantRequest = function _SOURCE() {

 const QRLEN = 8;

 var _QuantRequest = function(a) {
  if (a === undefined) a = new Array(QRLEN) 
  else if (!(Array.isArray(a) && a.length == QRLEN)) throw new Error("QuantRequestMalformed");
  this.protein              = a[0];
  this.peptide              = a[1];
  this.charge               = a[2];
  this.modString            = a[3];
  this.fileName             = a[4];
  this.ms1RT                = a[5];
  this.scanRange            = a[6];
  this.extractionCalcIndex  = a[7];
 };

 _QuantRequest.prototype.toArray = function() {
  var a = new Array(QRLEN);
  a[0] = this.protein;
  a[1] = this.peptide;
  a[2] = this.charge;
  a[3] = this.modString;
  a[4] = this.fileName;
  a[5] = this.ms1RT;
  a[6] = this.scanRange;
  a[7] = this.extractionCalcIndex;
  return(a)
 };

 _QuantRequest._SOURCE = _SOURCE;

 return _QuantRequest;

}();