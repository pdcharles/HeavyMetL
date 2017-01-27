"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.ExtractionCalculator = function() {

 var Peptides,Extractions,Uses;

 const CentroidPPM = 50;

 var ExtractionCalculator = function(Ps,Us) {
  Peptides = Ps;
  Extractions = Array(Ps.length);
  Uses = Us;
 }

 ExtractionCalculator.prototype.calculate = function(i) {
  var Ex;
  if (!Extractions[i]) {
   Ex =  Array(2);
   var Sequence = Peptides[i][0];
   var Charge = Peptides[i][1];
   var Modstring = Peptides[i][2];
   var Modsplit = Modstring.split(";");
   var Modifications = [];
   Modsplit.forEach(function(mod) {
    if (mod.length) {
     var regexmatch = /[A-Z]\d+: (\S+)/i.exec(mod);
     if (regexmatch) {
      if (HML.Modifications[regexmatch[1]]) {
       Modifications.push(new MSLIB.IsoCalc.Modification({name: regexmatch[1], atoms: HML.Modifications[regexmatch[1]]}));
      }
      else console.log("Warning: unknown modification "+regexmatch[1]);
     }
     else console.log("Warning: cannot parse modification "+mod);
    }
   });
   var peptide = new MSLIB.IsoCalc.Peptide({sequence:Sequence,charge:Charge,modifications:Modifications});
   Ex[0] = [peptide.getCentroidedDistribution(CentroidPPM).asSpectrum()];
   Ex[0][0].Incorporation = 0;
   Ex[1] = [];
   var AltEleConst = {};
   AltEleConst["Nitrogen"] = JSON.parse(JSON.stringify(MSLIB.IsoCalc.ElementalConstants["Nitrogen"])); //Ensure full copy
   for (var N_15 = +HML.Config.IncorporationWindowMin; N_15 <= +HML.Config.IncorporationWindowMax; N_15++) {
    AltEleConst["Nitrogen"].isotopes[0][1] = 100 - N_15;
    AltEleConst["Nitrogen"].isotopes[1][1] = N_15;
    var E = peptide.getCentroidedDistribution(CentroidPPM,AltEleConst).asSpectrum();
    E.Incorporation = N_15;
    Ex[1].push(E);
   }
   Extractions[i] = Ex;
  }
  else Ex = Extractions[i];
  if (--Uses[i] <= 0) Extractions[i] = null;
  return Ex;
 }

 return ExtractionCalculator;

}();