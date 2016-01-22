"use strict";

if (typeof HML == 'undefined') var HML = {};
HML.Quantifier = function(){

 var MS1Feature = function(MsDataFile,Extractions,PpmError,RTStart,RTEnd,MaxShift,Order) {
  this.Ready = 0;
  this.Progress = 0;
  this.MsDataFile = MsDataFile; //need to check fetchAllScanHeaders has run
  this.Extractions = Extractions;
  this.PpmError = PpmError;
  this.RTStart = RTStart;
  this.RTEnd = RTEnd;
  this.MaxShift = MaxShift;
  this.Order = Order;

  this.FirstMS1ScanNumber = this.MsDataFile.getNearestMSXScanNumberfromRT(1,this.RTStart);
  this.LastMS1ScanNumber = this.MsDataFile.getNearestMSXScanNumberfromRT(1,this.RTEnd,true);
  this.MS1ScanNumbers = this.MsDataFile.Scans.slice(this.FirstMS1ScanNumber,this.LastMS1ScanNumber+1).filter(function(ele) {return ele.Scan.MsLevel == 1}).map(function(ele) {return ele.Scan.ScanNumber});
  this.MS1SNi = 0;

  this.TotalExtractions = 0;
  var all_min_mzs = [];
  var all_max_mzs = []
  Object.keys(this.Extractions).forEach(function(label) {
   this.Extractions[label].forEach(function(TheoreticalSpectrum) {
    if (TheoreticalSpectrum.mzs.length) {
     all_min_mzs.push(TheoreticalSpectrum.getMinMz());
     all_max_mzs.push(TheoreticalSpectrum.getMaxMz());
    }
    this.TotalExtractions++;
   },this);
  },this);
  
  this.ExtractionMinMz = Math.min.apply(null,all_min_mzs);
  this.ExtractionMinMz -= MSLIB.Math.ppmError(this.ExtractionMinMz,this.PpmError)*2;
  this.ExtractionMaxMz = Math.max.apply(null,all_max_mzs);
  this.ExtractionMaxMz += MSLIB.Math.ppmError(this.ExtractionMaxMz,this.PpmError)*2;
  
  this.CroppedRawSpectra = [];
  this.ExtractionMatches = {};
  this.Quant = {};
 
  var MsReady = (function(){return this.MsDataFile.Ready}).bind(this);
 
  //get all scans in this.MS1ScanNumbers
  var getFirstScan = (function() {
   this.MsDataFile.fetchScanHeader(this.MS1ScanNumbers[this.MS1SNi],true);
   MSLIB.Common.WaitUntil(MsReady,getNextScan);
  }).bind(this);
 
  var getNextScan = (function() {
   var cs = this.MsDataFile.CurrentScan;
   this.CroppedRawSpectra[cs.ScanNumber] =  new MSLIB.Data.Spectrum(cs.SpectrumData.mzs,cs.SpectrumData.ints).getCroppedSpectrum(this.ExtractionMinMz,this.ExtractionMaxMz);
   this.CroppedRawSpectra[cs.ScanNumber].RT = cs.RetentionTime;   
   if (cs.ScanNumber < this.LastMS1ScanNumber) {
    this.Progress = ((cs.ScanNumber-this.FirstMS1ScanNumber)/(this.LastMS1ScanNumber-this.FirstMS1ScanNumber))*100; // extraction is 99% of the work so just report progress here
    this.MsDataFile.fetchScanHeader(this.MS1ScanNumbers[++this.MS1SNi],true);
    MSLIB.Common.WaitUntil(MsReady,getNextScan);
   }
   else {
    quantify();
   }
  }).bind(this);

  var excludeIndex = function(arr,idx) {
   return arr.filter(function(ele, i) {return i!=idx});
  }

  var quantify = (function() {
   Object.keys(this.Extractions).forEach(function(label) {
//    console.log(label);
    this.Quant[label] = {}
    this.ExtractionMatches[label] = [];
    this.Extractions[label].forEach(function(TheoreticalSpectrum,TSi) {
     this.ExtractionMatches[label][TSi] = {};
     this.ExtractionMatches[label][TSi].Spectra = [];
     this.CroppedRawSpectra.forEach(function(ExSp,curr_scan) {
      var ExInts = [];
      TheoreticalSpectrum.mzs.forEach(function(mz) {
       var mzPpmErr = MSLIB.Math.ppmError(mz,this.PpmError);
       ExInts.push(ExSp.getCroppedSpectrum(mz-mzPpmErr,mz+mzPpmErr).getTotalIntensity())
      },this);
      var croppedSpectrum = new MSLIB.Data.Spectrum(TheoreticalSpectrum.mzs,ExInts);
      croppedSpectrum.RT = ExSp.RT
      croppedSpectrum.TSi = TSi;
      this.ExtractionMatches[label][TSi].Spectra.push(croppedSpectrum);
     },this);
     var xic = this.ExtractionMatches[label][TSi].Spectra.map(function(sp) {return sp.getTotalIntensity()});
//     var is_max = MSLIB.Math.maxima(MSLIB.Math.movingAverage(xic,xic.length/10));
     var is_max = MSLIB.Math.maxima(xic);
     var TSPermutations = TheoreticalSpectrum.ints.map(function(int,i) {
      var ints = excludeIndex(TheoreticalSpectrum.ints,i);
      var permutation = new MSLIB.Data.Spectrum(excludeIndex(TheoreticalSpectrum.mzs,i),ints);
      permutation.ExcludedIndex = i;
      permutation.ExcludedMz = TheoreticalSpectrum.mzs[i];
      permutation.Proportion = ints.reduce(function(a,b) {return a+b});
      return permutation;
     });
     TSPermutations.splice(TheoreticalSpectrum.getBasePeakIndex(),1); //Never consider permutation where highest intensity theoretical peak is excluded 
     var bestMaximum = this.ExtractionMatches[label][TSi].Spectra.reduce((function(running_best,spectrum,i) {
      if (is_max[i]) {
       if (this.Order && this.LastQuantRT) {
        if (this.Order == 1 && (spectrum.RT < this.LastQuantRT)) return(running_best);
        if (this.Order == -1 && (spectrum.RT > this.LastQuantRT)) return(running_best);
       }
       if ((this.MaxShift && this.LastQuantRT) && (Math.abs(spectrum.RT - this.LastQuantRT) > this.MaxShift )) return(running_best);
       var spectrumBasePeakIndex = spectrum.getBasePeakIndex();
       var bestPermutation = TSPermutations.reduce(function(running_best_permutatation,TSP) {
        if (TSP.ExcludedIndex == spectrumBasePeakIndex) return(running_best_permutatation); //Never consider permutation where highest intensity observed peak is excluded
        var permutatationSpectrum = new MSLIB.Data.Spectrum(excludeIndex(spectrum.mzs,TSP.ExcludedIndex),excludeIndex(spectrum.ints,TSP.ExcludedIndex));
        if (permutatationSpectrum.ints.filter(function(int) { return int }).length < 2) return(running_best_permutatation); //Never consider permutation where only one peak is left
        var score = permutatationSpectrum.getNormalisedSpectralContrastAngleTo(TSP,0);
        if (score > running_best_permutatation[1]) {
         permutatationSpectrum.ExcludedIndex = TSP.ExcludedIndex;
         permutatationSpectrum.ExcludedMz = TSP.ExcludedMz;
         permutatationSpectrum.Proportion = TSP.Proportion;
         return([score,permutatationSpectrum]);
        }
        else return(running_best_permutatation);     
       },[0,null]);
       if (bestPermutation[0] > running_best[1]) {
        return([i,bestPermutation[0],bestPermutation[1]]);
       }
       else return(running_best);
      }
      else return(running_best);
     }).bind(this),[0,0,null]);
     if (bestMaximum[1]) {
      this.ExtractionMatches[label][TSi].ApexSpectrum = this.ExtractionMatches[label][TSi].Spectra[bestMaximum[0]];
      this.ExtractionMatches[label][TSi].ApexSpectrumPermutation = bestMaximum[2];
      this.ExtractionMatches[label][TSi].ApexSpectrumPermutationMatchScore = bestMaximum[1];
      this.ExtractionMatches[label][TSi].ApexSpectrumIndex = bestMaximum[0];
     }
     else {
      this.ExtractionMatches[label][TSi].ApexSpectrumPermutationMatchScore = 0;
     }
    },this);
    var bestMatchedDist = this.ExtractionMatches[label].reduce(function(running_best,curr_dist,i) {
     if ((curr_dist.ApexSpectrumPermutationMatchScore > running_best[1])) {
      return([i,curr_dist.ApexSpectrumPermutationMatchScore]);
     }
     else {
      return(running_best);
     }
    },[0,0]);
    if (bestMatchedDist[1]) {
     var best_TSi = bestMatchedDist[1];
     this.Quant[label].Spectrum = this.ExtractionMatches[label][bestMatchedDist[0]].ApexSpectrum;
     this.Quant[label].SpectrumPermutation = this.ExtractionMatches[label][bestMatchedDist[0]].ApexSpectrumPermutation;
     this.Quant[label].PermutationExcludedMz = this.ExtractionMatches[label][bestMatchedDist[0]].ApexSpectrumPermutation.ExcludedMz;
     this.Quant[label].RT = this.LastQuantRT = this.ExtractionMatches[label][bestMatchedDist[0]].ApexSpectrum.RT;
     this.Quant[label].SpectrumMatchScore = bestMatchedDist[1];
     this.Quant[label].MatchedDistributionIndex = this.ExtractionMatches[label][bestMatchedDist[0]].ApexSpectrum.TSi;
     this.Quant[label].MatchedDistributionIncorporation = this.Extractions[label][this.ExtractionMatches[label][bestMatchedDist[0]].ApexSpectrum.TSi].Incorporation;
     var distSpectra = this.ExtractionMatches[label][bestMatchedDist[0]].Spectra
     var RTs = distSpectra.map(function(sp) {return sp.RT});
     var xic = distSpectra.map(function(sp) {return sp.getTotalIntensity()});
     this.Quant[label].Chromatogram = new MSLIB.Data.Chromatogram(RTs,xic);
     this.Quant[label].Intensity = this.Quant[label].Spectrum.getTotalIntensity();
     this.Quant[label].PermutationNormalisedIntensity = this.Quant[label].SpectrumPermutation.getTotalIntensity() / this.Quant[label].SpectrumPermutation.Proportion;
    }
    else {
     this.Quant[label].Failed = true;
    }
   },this);
   this.Ready = 1;
   this.Progress = 100;
  }).bind(this);
 
  MSLIB.Common.WaitUntil(MsReady,getFirstScan);
 }

 return {
  MS1Feature : MS1Feature
 }

}();