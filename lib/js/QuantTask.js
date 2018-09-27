"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.QuantTask = function _SOURCE() {

 const QTLEN = 3;

 var _QuantTask = function(a) {
  if (a === undefined) a = new Array(QTLEN);
  else if (!(Array.isArray(a))) throw new Error("QuantTaskMalformed");
  if (a[0].constructor === HML.QuantRequest) this.request = a[0];
  else this.request = new HML.QuantRequest(a[0]);
  this.extractions          = a[1];
  this.spectralData         = a[2];
 };

 _QuantTask.prototype.toArray = function() {
  var a = new Array(QTLEN);
  a[0]  = this.request.toArray();
  a[1]  = this.extractions;
  a[2]  = this.spectralData;
  return(a);
 };

 _QuantTask._SOURCE = _SOURCE;

 return _QuantTask;

}();