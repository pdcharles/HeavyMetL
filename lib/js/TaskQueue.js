"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.TaskQueue = function() {

  var _TaskQueue = function(workers) {
   var TQ = [];
   TQ.workers = workers;
   TQ.limbo = [];
   TQ.add = function(quantTaskPackage) {
    if (this.length < this.workers.length) {
     this.push(quantTaskPackage[0]);
     quantTaskPackage[1].continue();
    }
    else {
     this.limbo.push(quantTaskPackage);
    }
    this.update();
   }
   TQ.update = function() {
    var nextAvailableWorker = this.workers.find(QW => QW.worker.ready);
    if (nextAvailableWorker && this.length) {
     nextAvailableWorker.process(this.shift());
     if (this.limbo.length) this.add(this.limbo.shift());
    }
   }
   return TQ;
  }

  return _TaskQueue;

}();