"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.Common = function(){

 //Implement a fast ready-wait as 4ms minimum window.setTimeout is too slow
 //http://dbaron.org/log/20100309-faster-timeouts

 var waitStack = [];
 var waitUntil = function(tfunc,rfunc) {
  waitStack.push([tfunc,rfunc])
  window.postMessage("waitUntil", "*");
 }
 
 window.addEventListener("message", function(e) {
  if (e.source == window && e.data == "waitUntil") {
   e.stopPropagation();
   if (waitStack.length > 0) {
    var args = waitStack.shift();
    if (args[0]()) args[1]();
    else {
     waitStack.push([args[0],args[1]])
     window.postMessage("waitUntil", "*");
    }
   }
  }
 },true);

 return {
  waitUntil: waitUntil,
 }

}();