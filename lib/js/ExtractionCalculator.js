"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.ExtractionCalculator = function() {

 const centroidPpm = 50;

 var _ExtractionCalculator = function(peps,uses) {
  this.peptides = peps;
  this.extractions = Array(peps.length);
  this.uses = uses;
  this.fixedMods = HML.config.fixedMods.split(/[,;]/);
  this.labelledPeptidesOnly = HML.config.labelledPeptidesOnly;

  this.unlabelledMax = Math.min(+HML.config._unlabelledIncorporationWindowMax,100);
  this.unlabelledMin = Math.min(this.unlabelledMax,Math.max(+HML.config._unlabelledIncorporationWindowMin,0));

  this.labelledMax = Math.min(+HML.config.incorporationWindowMax,100);
  this.labelledMin = Math.min(this.labelledMax,Math.max(+HML.config.incorporationWindowMin,0));

  this.stepSize = (ss => isNaN(ss) ? 1 : (ss <= 0 ? 1 : ss))(parseFloat(HML.config._incorpStepSize));
  this.precision =  (a => (a[1] || []).length - parseInt(a[2] || 0))(this.stepSize.toString().split(/[.e]/));
 }

 _ExtractionCalculator.prototype.calculate = function(i) {
  var ex;
  if (!this.extractions[i]) {
   ex = this.labelledPeptidesOnly ? Array(1) : Array(2);
   var sequence = this.peptides[i][0];
   var charge = this.peptides[i][1];
   var vModString = this.peptides[i][2];

   var modifications = [];
   
   if (vModString.length) {
    var vModNames = [];
    var regexMatch;
    var scaffold = /[A-Z]\d+: ([^\s;]+)(?: [^\s;]+)*(?:;|$)/ig;
    var cpfp = /(\d+) x (\S+)(?: |$)/ig;
    switch (true) {
     case (regexMatch = scaffold.exec(vModString)) !== null : { //scaffold
      vModNames = [regexMatch[1]]; 
      while ((regexMatch = scaffold.exec(vModString)) !== null) vModNames.push(regexMatch[1]);
      break;
     }
     case (regexMatch = cpfp.exec(vModString)) !== null : { //cpfp
      vModNames = Array(regexMatch[1]).fill(regexMatch[2]); 
      while ((regexMatch = cpfp.exec(vModString)) !== null) Array.prototype.push.apply(vModNames,Array(regexMatch[1]).fill(regexMatch[2]));
      break;
     }
     default: {
      console.log("Warning: cannot parse variable modification string" +vModString);
      throw new Error("ExtractionCalculatorCannotParseVariableModificationString");
     }
    } 
    vModNames.forEach(vModName => {
     if (HML.modifications[vModName]) modifications.push(new MSLIB.IsoCalc.Modification({name: vModName, atoms: HML.modifications[vModName]}));
     else {
      console.log("Error: unknown variable modification "+vModName);
      throw new Error("ExtractionCalculatorUnknownVariableModification");
     } 
    });
   }

   if (this.fixedMods.length) {
    this.fixedMods.forEach(fModString => {
     var regexMatch = /(\S+) \((\S+)\)/ig.exec(fModString);
     var fModName = regexMatch[1];
     var fModAA = regexMatch[2]
     if (HML.modifications[fModName]) {
      sequence.split("").filter(aa => aa==fModAA).forEach(fMAA => modifications.push(new MSLIB.IsoCalc.Modification({name: fModName, atoms: HML.modifications[fModName]})));
     }
     else {
      console.log("Error: unknown fixed modification "+fModName);
      throw new Error("ExtractionCalculatorUnknownFixedModification");
     } 
    })
   }

   var peptide = new MSLIB.IsoCalc.Peptide({sequence:sequence,charge:charge,modifications:modifications});

//   console.log(peptide);

   var labelledIndex = this.labelledPeptidesOnly ? 0 : 1; 
   if (!this.labelledPeptidesOnly) {
//    ex[0] = [peptide.getCentroidedDistribution(centroidPpm).asSpectrum()];
//    ex[0][0].incorporation = 0;
    ex[0] = Array(Math.ceil((this.unlabelledMax - this.unlabelledMin)/this.stepSize) + 1);
    var altEleConst = {};
    altEleConst["Nitrogen"] = JSON.parse(JSON.stringify(MSLIB.IsoCalc.elementalConstants["Nitrogen"])); //Ensure full copy
    var incIndex = 0;
    for (var n15 = this.unlabelledMin; n15 <= this.unlabelledMax; n15 += this.stepSize) {
     altEleConst["Nitrogen"].isotopes[0][1] = 100 - n15;
     altEleConst["Nitrogen"].isotopes[1][1] = n15;
     var e = peptide.getCentroidedDistribution(centroidPpm,altEleConst).asSpectrum();
     e.incorporation = n15.toFixed(this.precision);
     ex[0][incIndex++] = e;
    }
   }
   ex[labelledIndex] = Array(Math.ceil((this.labelledMax - this.labelledMin)/this.stepSize) + 1);
   var altEleConst = {};
   altEleConst["Nitrogen"] = JSON.parse(JSON.stringify(MSLIB.IsoCalc.elementalConstants["Nitrogen"])); //Ensure full copy
   var incIndex = 0;
   for (var n15 = this.labelledMin; n15 <= this.labelledMax; n15 += this.stepSize) {
    altEleConst["Nitrogen"].isotopes[0][1] = 100 - n15;
    altEleConst["Nitrogen"].isotopes[1][1] = n15;
    var e = peptide.getCentroidedDistribution(centroidPpm,altEleConst).asSpectrum();
    e.incorporation = n15.toFixed(this.precision);
    ex[labelledIndex][incIndex++] = e;
   }
   this.extractions[i] = ex;
  }
  else ex = this.extractions[i];
  if (this.uses !== null && --this.uses[i] <= 0) this.extractions[i] = null;
  return ex;
 }

 return _ExtractionCalculator;

}();