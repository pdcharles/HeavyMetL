"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.QuantifiedProtein = function() {

 var _QuantifiedProtein = function(proteinFeatures,files) {

  var peptides = Object.keys(proteinFeatures).sort();

  var peptideScores = peptides.map(peptide =>
   Array.prototype.concat.apply([],
    Object.keys(proteinFeatures[peptide]).map(charge =>
     Object.keys(proteinFeatures[peptide][charge]).map(modString =>
      files.map(
       file => (
                proteinFeatures[peptide][charge][modString][5] && //contributes
                proteinFeatures[peptide][charge][modString][11][file] ? //quantified in this file
                [
                 proteinFeatures[peptide][charge][modString][11][file][3],
                 proteinFeatures[peptide][charge][modString][11][file][7]
                ] :
                null
               )
      )
     )
    )
   ).sort((a,b) => averageIntensityAcrossFilesAndLabel(b) - averageIntensityAcrossFilesAndLabel(a))[0]
  );

  var peptideQuants = peptides.map(peptide =>
   Array.prototype.concat.apply([],
    Object.keys(proteinFeatures[peptide]).map(charge =>
     Object.keys(proteinFeatures[peptide][charge]).map(modString =>
      files.map(
       file => (
                proteinFeatures[peptide][charge][modString][5] && //contributes
                proteinFeatures[peptide][charge][modString][11][file] && //quantified in this file
                (
                 HML.config.peptideScoreThreshold ? (
                  HML.config.labelledPeptidesOnly ?
                  proteinFeatures[peptide][charge][modString][11][file][3] >= HML.config.peptideScoreThreshold :
                  proteinFeatures[peptide][charge][modString][11][file][3] >= HML.config.peptideScoreThreshold &&
                  proteinFeatures[peptide][charge][modString][11][file][7] >= HML.config.peptideScoreThreshold 
                 ) : 
                 true
                ) ? (
                 HML.config.labelledPeptidesOnly ?
                  [
                   proteinFeatures[peptide][charge][modString][11][file][0],
                   proteinFeatures[peptide][charge][modString][11][file][1]
                  ] :
                  [
                   proteinFeatures[peptide][charge][modString][11][file][0],
                   proteinFeatures[peptide][charge][modString][11][file][4],
                   proteinFeatures[peptide][charge][modString][11][file][1],
                   proteinFeatures[peptide][charge][modString][11][file][5]
                  ]
                ) :
                null
               )
      )
     )
    )
   ).sort((a,b) => averageIntensityAcrossFilesAndLabel(b) - averageIntensityAcrossFilesAndLabel(a))[0]
  );

  var results = {};

  if (HML.config.labelledPeptidesOnly) {
   var labelledIncorps = files.map((file,i) => peptideQuants.map(pq => pq[i] ? pq[i][1] : null));
   var labelledIncorpsMedian = files.map((file,i) => MSLIB.Math.median(labelledIncorps[i]));
   var labelledIncorpsMAD = files.map((file,i) => MSLIB.Math.mad(labelledIncorps[i]));
   files.forEach((file,i) => {
                            var incorps = new Array(peptides.length);
                            peptides.forEach((peptide,j) => incorps[j] = [peptide,labelledIncorps[i][j]]);
                            results[file] = {
                                             incorps: incorps,
                                             incorpMedians: [labelledIncorpsMedian[i]],
                                             incorpMADs: [labelledIncorpsMAD[i]]
                                            }
                           });

  } 
  else {
   var ratios = files.map((file,i) => peptideQuants.map(pq => pq[i] ? pq[i][0]/pq[i][1] : null));
   var ratioMedians = files.map((file,i) =>  MSLIB.Math.median(ratios[i]));
   var ratioMADs = files.map((file,i) =>  MSLIB.Math.mad(ratios[i]));
   var unlabelledIncorps = files.map((file,i) => peptideQuants.map(pq => pq[i] ? pq[i][2] : null));
   var labelledIncorps = files.map((file,i) => peptideQuants.map(pq => pq[i] ? pq[i][3] : null));
   var unlabelledIncorpsMedian = files.map((file,i) => MSLIB.Math.median(unlabelledIncorps[i]));
   var unlabelledIncorpsMAD = files.map((file,i) => MSLIB.Math.mad(unlabelledIncorps[i]));
   var labelledIncorpsMedian = files.map((file,i) => MSLIB.Math.median(labelledIncorps[i]));
   var labelledIncorpsMAD = files.map((file,i) => MSLIB.Math.mad(labelledIncorps[i]));
   files.forEach((file,i) => {
                              var pepRatios = new Array(peptides.length);
                              peptides.forEach((peptide,j) => pepRatios[j] = [peptide,ratios[i][j]]);
                              var incorps = new Array(peptides.length);
                              peptides.forEach((peptide,j) => incorps[j] = [peptide,unlabelledIncorps[i][j],labelledIncorps[i][j]]);
                              results[file] = {
                                               ratios: pepRatios,
                                               ratioMedian: ratioMedians[i],
                                               ratioMAD: ratioMADs[i],
                                               incorps: incorps,
                                               incorpMedians: [unlabelledIncorpsMedian[i],labelledIncorpsMedian[i]],
                                               incorpMADs: [unlabelledIncorpsMAD[i],labelledIncorpsMAD[i]]
                                              }
                             });
  }
  return results;
 }

 var averageIntensityAcrossFilesAndLabel = function(fileQuants) {
  return(MSLIB.Math.mean(Array.prototype.concat.apply([],fileQuants.map(e => e && e.slice(0,2) || 0))));
 }

 return _QuantifiedProtein;

}();