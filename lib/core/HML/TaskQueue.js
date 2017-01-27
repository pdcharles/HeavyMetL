"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.TaskQueue = function() {

  var TaskQueue = function() {
   var TQ = [];
   TQ.Limbo = [];
   TQ.add = function(QuantTaskPackage) {
    if (this.length < HML.Interface.QuantWorkers.length) {
     this.push(QuantTaskPackage[0]);
     QuantTaskPackage[1].continue();
    }
    else {
     this.Limbo.push(QuantTaskPackage);
    }
    this.update();
   }
   TQ.update = function() {
    var nextAvailableWorker = HML.Interface.QuantWorkers.find(QW => QW.Worker.Ready);
    if (nextAvailableWorker && this.length) {
     nextAvailableWorker.process(this.shift());
     if (this.Limbo.length) this.add(this.Limbo.shift());
    }
   }
   return TQ;
  }

  return TaskQueue;

}();