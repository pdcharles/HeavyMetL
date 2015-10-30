if (typeof HML == 'undefined') {
 HML = {};
}
HML.Quantifier = function(){

 var waitForMzReadyFunc = function(func) {
  if (this.MzFile.Ready) {
   func.bind(this)();
  }
  else {
   window.setTimeout(waitForMzReadyFunc.bind(this), 1, func);
  }
 }

 var IndexedMzFile = function(file) {

  this.Ready = 0;
  this.Progress = 0;
  this.MzFile = new HML.Format.MzFile(file);
  this.MS1Scans = [];
  this.Minutes = [];
  
  this.FirstMS1Scan = 0;
  this.LastMS1Scan = 0;

  var waitForMzReady = waitForMzReadyFunc.bind(this);

  var getFirstScan = (function() {
   this.FirstMS1Scan = this.MzFile.getFirstScanNumber() || console.log("Warning: can't get first scan number"); 
   this.LastMS1Scan = this.MzFile.getLastScanNumber() || console.log("Warning: can't get last scan number");
   this.MzFile.fetchScan(this.FirstMS1Scan);
   waitForMzReady(getNextScan);
  }).bind(this);
 
  var previousMS1 = 0;
  var getNextScan = (function() {
   if (this.MzFile.Scan.msLevel == 1) {
    var thisScanNumber = this.MzFile.Scan.scanNumber;
    this.MS1Scans[thisScanNumber] = this.MzFile.Scan;
    if (previousMS1) {
     this.MS1Scans[previousMS1].nextMS1 = thisScanNumber;
     this.MS1Scans[thisScanNumber].previousMS1 = previousMS1;
    }
    var minute = Math.round(this.MS1Scans[thisScanNumber].retentionTime);
    if (!this.Minutes[minute]) {
     this.Minutes[minute] = [];
    }
    this.Minutes[minute].push(thisScanNumber);
    previousMS1 = thisScanNumber;
   }
   if (this.MzFile.Scan.scanNumber < this.LastMS1Scan) {
    this.Progress = (this.MzFile.Scan.scanNumber/(this.LastMS1Scan)) * 100;
    this.MzFile.fetchScan(this.MzFile.getNextScanNumber(this.MzFile.Scan.scanNumber));
    waitForMzReady(getNextScan);
   }
   else {
    this.Ready = 1;
    this.Progress = 100;
   }
  }).bind(this);
 
  this.getPreviousMS1 = function(scan_number) {
   if (!scan_number) { return null };
   return this.MS1Scans[scan_number].previousMS1 || null;
  }
 
  this.getNextMS1 = function(scan_number) {
   if (!scan_number) { return null };
   return this.MS1Scans[scan_number].nextMS1 || null;
  }
 
  this.getNearestMS1fromRT = function(retention_time,match_low) {
   if (!this.Ready || !this.Minutes.length) { return null };
   var S = this.MS1Scans;
   var firstMS1RT = S[this.FirstMS1Scan].retentionTime;
   var lastMS1RT = S[this.LastMS1Scan].retentionTime;
   if (retention_time <= firstMS1RT) { return this.FirstMS1Scan };
   if (retention_time >= lastMS1RT) { return this.LastMS1Scan };
   var minute = Math.round(retention_time);
   var possibles = this.Minutes[minute];
   //check for exact match
   for (var i = 0; i < possibles.length; i++) {
    if (S[possibles[i]].retentionTime == retention_time) { return S[possibles[i]].scanNumber }; 
   }
   //Otherwise find closest match
   var firstRTMinute = Math.round(firstMS1RT);
   var lastRTMinute = Math.round(lastMS1RT);
   var range = 0;
   do {
    range++;
    var minute_to_add = minute + (match_low ? -range : range);
    if ((minute_to_add < firstRTMinute) || (minute_to_add > lastRTMinute)) {
     return null;
    }
    possibles = possibles.concat(this.Minutes[minute_to_add] || []);
   } while (possibles.length < 1);
   if (match_low) {
    possibles.sort(function(a,b) {return S[b].retentionTime-S[a].retentionTime});
    for (var i = 0; i < possibles.length; i++) {
     if (S[possibles[i]].retentionTime < retention_time) { 
      return S[possibles[i]].scanNumber; 
     }
    }
   }
   else {
    possibles.sort(function(a,b) {return S[a].retentionTime-S[b].retentionTime});
    for (var i = 0; i < possibles.length; i++) {
     if (S[possibles[i]].retentionTime > retention_time) { 
      return S[possibles[i]].scanNumber;
     }
    }
   }
   return null;
  }
  
  this.getNearestMS1fromScan = function(scan_number,match_low) {
   if (!this.Ready || !this.Minutes.length) { return null };
   var S = this.MS1Scans;
   if (S[scan_number]) { return scan_number };
   var s = scan_number;
   if (match_low) {
    while (!this.MS1Scans[--s] && (s > this.FirstMS1Scan)) {};
    if (this.MS1Scans[s]) {
     return(s);
    }
    else {
     return(null);
    }
   }
   else {
    while (!this.MS1Scans[++s] && (s <= this.LastMS1Scan)) {};
    if (this.MS1Scans[s]) {
     return(s);
    }
    else {
     return(null);
    }
   }
  }

  this.MzFile.fetchScanOffsets();
  waitForMzReady(getFirstScan);
 }

 var Feature = function(IndexedMzFile,extractions,ppmError,rtStart,rtEnd) {
  this.Ready = 0;
  this.Progress = 0;
  this.Index = IndexedMzFile;
  this.MzFile = this.Index.MzFile;
  this.Extractions = extractions;
  this.ppmError = ppmError;
  this.FirstMS1Scan = this.Index.getNearestMS1fromRT(rtStart);
  this.LastMS1Scan = this.Index.getNearestMS1fromRT(rtEnd,true);

  //extraction distributions format
  //{label1:[dist1,dist2], label2:[dist1,dist2]}

  this._dists_to_process = 0;
  var all_min_mzs = [];
  var all_max_mzs = []
  Object.keys(this.Extractions).forEach(function(label) {
   this.Extractions[label].forEach(function(dist) {
    if (dist.length) {
     all_min_mzs.push(dist[0][0]);
     all_max_mzs.push(dist[dist.length-1][0]);
    }
    this._dists_to_process++;
   },this);
  },this);
  
  this.ExtractionMinMz = Math.min.apply(null,all_min_mzs);
  this.ExtractionMinMz -= HML.Math.ppmError(this.ExtractionMinMz,ppmError)*2;
  this.ExtractionMaxMz = Math.max.apply(null,all_max_mzs);
  this.ExtractionMaxMz += HML.Math.ppmError(this.ExtractionMaxMz,ppmError)*2;
  
  this.ExtractedSpectra = [];
  this.ExtractionMatches = {};
  this.Quant = {};
 
  var waitForMzReady = waitForMzReadyFunc.bind(this);
 
  var getFirstScan = (function() {
   this.MzFile.Scan = this.Index.MS1Scans[this.FirstMS1Scan];
   this.MzFile.fetchSpectrumData();
   waitForMzReady(getNextScan);
  }).bind(this);
 
  var getNextScan = (function() {
   var curr_scan = this.MzFile.Scan;
   var spectrum = new HML.Data.Spectrum(curr_scan.spectrumData.mzs,curr_scan.spectrumData.ints).getCroppedSpectrum(this.ExtractionMinMz,this.ExtractionMaxMz);
   this.ExtractedSpectra[curr_scan.scanNumber] = spectrum;
   if (curr_scan.scanNumber < this.LastMS1Scan) {
    this.Progress = ((curr_scan.scanNumber-this.FirstMS1Scan)/(this.LastMS1Scan-this.FirstMS1Scan))*75; // extraction is first 50%
    //console.log([curr_scan.scanNumber,(curr_scan.scanNumber-this.FirstMS1Scan),(this.LastMS1Scan-this.FirstMS1Scan),this.Progress])
    this.MzFile.Scan = this.Index.MS1Scans[this.Index.getNextMS1(curr_scan.scanNumber)];
    this.MzFile.fetchSpectrumData();
    waitForMzReady(getNextScan);
   }
   else {
    quantify();
   }
  }).bind(this);

  var quantify = (function() {
   Object.keys(this.Extractions).forEach(function(label) {
    console.log(label);
    this.Quant[label] = {}
    this.ExtractionMatches[label] = [];
    this.Extractions[label].forEach(function(dist,dist_n) {
     var MatchMzs = dist.map(function(e){return e[0]}); 
     var MatchSpectrum =  new HML.Data.Spectrum(MatchMzs,dist.map(function(e){return e[1]}));
     this.ExtractionMatches[label][dist_n] = {};
     this.ExtractionMatches[label][dist_n].MatchSpectrum = MatchSpectrum;
     this.ExtractionMatches[label][dist_n].CroppedSpectra = [];
     this.ExtractionMatches[label][dist_n].MatchScores = [];
     this.ExtractedSpectra.forEach(function(ExSp,curr_scan) {
      var ExInts = [];
      MatchMzs.forEach(function(mz) {
       mzPpmErr = HML.Math.ppmError(mz,ppmError);
       ExInts.push(ExSp.getCroppedSpectrum(mz-mzPpmErr,mz+mzPpmErr).getTotalIntensity())
      });
      var SlicedExSp = new HML.Data.Spectrum(MatchMzs,ExInts);
      SlicedExSp.scanNumber = curr_scan;
      this.ExtractionMatches[label][dist_n].CroppedSpectra.push(SlicedExSp);
      //Save time by calculating this AFTER maxima identified since only use maxima values?
      this.ExtractionMatches[label][dist_n].MatchScores.push(SlicedExSp.getNormalisedSpectralContrastAngleTo(MatchSpectrum,0));
     },this);
     //find local maxima/minima
     //code from isocalc (move to math?)
     this.ExtractionMatches[label][dist_n].IntegratedSpectrumMatchScore = 0;
     var scores = this.ExtractionMatches[label][dist_n].MatchScores;
     var xic = this.ExtractionMatches[label][dist_n].CroppedSpectra.map(function(sp) {return sp.getTotalIntensity()});
     if (xic.length) {
      var diff = [0];
      for (var i = 1; i < xic.length; i++) {
       diff[i] = xic[i] - xic[i-1];
      }
      var u = -1;
      var d = -1;
      var is_max = diff.map(Number.prototype.valueOf,0);
      var is_min = diff.map(Number.prototype.valueOf,0);
      for (var i = 1; i < diff.length; i++) {
       if (diff[i] < 0) {
        if ((diff[i-1]) >= 0 && (u > -1)) {
         is_max[Math.floor((i+u-1)/2)] = 1;
        }
        u = -1;
        d = i
       }
       else if (diff[i] > 0) {
        if ((diff[i-1]) <= 0 && (d > -1)) {
         is_min[Math.floor((i+u-1)/2)] = 1;
        }       
        u = i;
        d = -1;
       }
      }
      var minima = xic.filter(function(ele,i) { return(is_min[i]) });
      if (!minima.length) {
       minima = [xic[0],xic[xic.length-1]];
      }
      var bgNoise = minima.reduce(function(a,b) { return a+b })/minima.length;  //average of minima
      var bestMaximum = scores.reduce(function(running_best,curr_score,i) {
       if (is_max[i] && (running_best[0] < curr_score)) {
        return([curr_score,i]);
       }
       else {
        return(running_best);
       }
      },[0,0]);
      if (bestMaximum[0]) {
       var peakMaxIndex = bestMaximum[1];
       var peakFirstIndex = peakMaxIndex;
       while ((peakFirstIndex >= 0) && (xic[peakFirstIndex] > bgNoise)) { peakFirstIndex-- };
       peakFirstIndex++;
       var peakLastIndex = peakMaxIndex;
       while ((peakLastIndex < xic.length) && (xic[peakLastIndex] > bgNoise)) { peakLastIndex++ };
       peakLastIndex--;
       var peakInts = MatchMzs.map(Number.prototype.valueOf,0);
       for (var i = peakFirstIndex; i <= peakLastIndex; i++) {
        peakInts = peakInts.map(function(int,j) {
         return (int+this.ExtractionMatches[label][dist_n].CroppedSpectra[i].ints[j]);
        },this);
       }
       var IntegratedSpectrum = new HML.Data.Spectrum(MatchMzs,peakInts);
       this.ExtractionMatches[label][dist_n].peakFirstIndex = peakFirstIndex;
       this.ExtractionMatches[label][dist_n].peakLastIndex = peakLastIndex;
       this.ExtractionMatches[label][dist_n].IntegratedSpectrum = IntegratedSpectrum;
       this.ExtractionMatches[label][dist_n].IntegratedSpectrumMatchScore = IntegratedSpectrum.getNormalisedSpectralContrastAngleTo(MatchSpectrum,0);
      }
     }
     this.Progress = 75 + ((dist_n+1)/this._dists_to_process) * 75; //quant is last 25%
    },this);
    var bestMatchedDist = this.ExtractionMatches[label].reduce(function(running_best,curr_dist,dist_n) {
     if ((running_best[0] < curr_dist.IntegratedSpectrumMatchScore)) {
      return([curr_dist.IntegratedSpectrumMatchScore,dist_n]);
     }
     else {
      return(running_best);
     }
    },[0,0]);
    if (bestMatchedDist[0]) {
     var best_dist_n = bestMatchedDist[1];
     console.log(bestMatchedDist);
     this.Quant[label].IntegratedSpectrum = this.ExtractionMatches[label][best_dist_n].IntegratedSpectrum;
     this.Quant[label].IntegratedSpectrumMatchScore = bestMatchedDist[0];
     this.Quant[label].BestMatchingDistribution = best_dist_n;
     var first = this.ExtractionMatches[label][best_dist_n].peakFirstIndex;
     var last = this.ExtractionMatches[label][best_dist_n].peakLastIndex;
     var peakSpectra = this.ExtractionMatches[label][best_dist_n].CroppedSpectra.filter(function(ele,i) {
      return ((i >= first) && (i <= last));
     });
     var xic = peakSpectra.map(function(sp) {return sp.getTotalIntensity()});
     var RTs = peakSpectra.map(function(sp) {return this.Index.MS1Scans[sp.scanNumber].retentionTime},this);
     this.Quant[label].Chromatogram = new HML.Data.Chromatogram(RTs,xic);
     this.Quant[label].Area = this.Quant[label].Chromatogram.getIntegratedArea();
     this.Quant[label].MaxInt = this.Quant[label].Chromatogram.getMaxIntensity();
    }
    else {
     this.Quant[label].QuantFailed = 1;
    }
   },this);
   this.Ready = 1;
   this.Progress = 100;
  }).bind(this);
 
  waitForMzReady(getFirstScan);
 }

 return {
  IndexedMzFile : IndexedMzFile,
  Feature : Feature
 }

}();