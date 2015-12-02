"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.IsoCalc = function() {

 var FRACTION_LIMIT = 0.000001;
 
 var Atom = function(params) {
  if (typeof(params) != "object") {
   console.log("parameters must be supplied as an object");
   return {};
  }
  if ((typeof(params.isotopes) == "object") && Array.isArray(params.isotopes)) {
   if (params.isotopes.length) {
    var abundance_total = 0;
    for (var i in params.isotopes) {
     if (Array.isArray(params.isotopes[i]) && (params.isotopes[i].length == 2) && (typeof(params.isotopes[i][0]) == "number") && (typeof(params.isotopes[i][1]) == "number")) {
      abundance_total += params.isotopes[i][1];
     }
     else {
      console.log("isotopes parameter must be in form [[isotopologue1,abundance1],[isotopologue2,abundance2]] etc");
      return {};
     }    
    }
    this.isotopes = [];
    for (var i in params.isotopes) {
     this.isotopes[i] = [];
     this.isotopes[i][0] = params.isotopes[i][0];
     this.isotopes[i][1] = params.isotopes[i][1]/abundance_total;
    }
   }
   else {
    console.log("isotopes parameter contains no data");
    return {};
   }
  }
  else {
   console.log("isotopes parameter undefined");
   return {};
  }
  if (typeof(params.symbol) != "undefined") {
   if (typeof(params.symbol) == "string") {
    this.symbol = params.symbol;
   }
   else {
    console.log("invalid Atomic symbol specified");
    return {};
   }
  }
  if ((typeof(this.isotopes) != "object") || !Array.isArray(this.isotopes) || !this.isotopes.length) {
   console.log("uncaught error while constructing Atom");
   return {};
  }
 }
 
 var Hyperatom = function(params) {
  Atom.apply(this,arguments);
 }
 Hyperatom.prototype.convolute = function(conv_ha) {
  if ((typeof(conv_ha) != "object") || (conv_ha.constructor !== Hyperatom)) {
   console.log("can only convolute with another Hyperatom");
   return {};
  }
  var isotope_array = [];
  isotope_array = isotope_array.concat.apply(isotope_array,
   this.isotopes.map(
    function(i) {
     return conv_ha.isotopes.map(
      function(j) {
       return [i[0]+j[0],i[1]*j[1]];
      }
     )
    }
   )
  );
  var isotope_hash = {};
  for (var i in isotope_array) {
   if (typeof(isotope_hash[isotope_array[i][0]]) == "undefined") {
    isotope_hash[isotope_array[i][0]] = isotope_array[i][1];
   }
   else {
    isotope_hash[isotope_array[i][0]] += isotope_array[i][1];
   }
  }
  var iso_hash_keys = Object.keys(isotope_hash).sort(
   function(a,b) {
    return a-b;
   }  
  )
  var final_array = iso_hash_keys.map(
   function(i) {
    return [parseFloat(i),isotope_hash[i]];
   }
  );
  var final_array_filtered = final_array.filter(
   function(i) {
    return i[1] > FRACTION_LIMIT;
   }
  );
  return new HML.IsoCalc.Hyperatom({isotopes:final_array_filtered})
 }
 Hyperatom.prototype.with_charge = function(charge) {
  var charged_array = this.isotopes.map(
   function(i) {
    return [i[0]/charge,i[1]];
   }
  );
  return new HML.IsoCalc.Hyperatom({isotopes:charged_array})
 }
 Hyperatom.prototype.as_spectrum = function() {
  return new HML.Data.Spectrum(this.isotopes.map(function(e){return e[0]}),this.isotopes.map(function(e){return e[1]}));
 }
 
 var Molecule = function(params) {
  if (typeof(params) != "object") {
   console.log("parameters must be supplied as an object");
   return {};
  }
  if (typeof(params.atoms) == "object") {
   var els = Object.keys(params.atoms);
   this.atoms = {};
   for (var i in els) {
    if ((typeof(els[i]) == "string") && (typeof(params.atoms[els[i]]) == "number")) {
     var element = ElementalConstants.getElementName(els[i]);
     if (element) {
      this.atoms[element] = params.atoms[els[i]];
     }
     else {
      console.log("element "+els[i]+" is unknown");
      return {};
     }
    }
    else {
     console.log("atoms parameter must be in form {element1:count1,element2:count2} etc");
     return {};
    }
   }
  }
  else {
   console.log("atoms parameter undefined");
   return {};
  }
 }
 
 var AminoAcid = function(params) {
  if (typeof(params) != "object") {
   console.log("parameters must be supplied as an object");
   return {};
  }
  Molecule.apply(this,arguments);
  if (typeof(params.lettercode) != "undefined") {
   if ((typeof(params.lettercode) == "string") && (params.lettercode.length == 1)) {
    this.lettercode = new RegExp(params.lettercode,"ig");
   }
   else {
    console.log("lettercode parameter must be a single character");
    return {};
   }
  }
  else {
   console.log("lettercode parameter undefined");
   return {};
  }
 }
 
 var Modification = function(params) {
  if (typeof(params) != "object") {
   console.log("parameters must be supplied as an object");
   return {};
  }
  Molecule.apply(this,arguments);
  if (typeof(params.name) != "undefined") {
   if ((typeof(params.name) == "string")) {
    this.name = params.name;
   }
   else {
    console.log("name parameter must be a string");
    return {};
   }
  }
  else {
   console.log("name parameter undefined");
   return {};
  }
 }
 
 var Peptide = function(params) {
  if (typeof(params) != "object") {
   console.log("parameters must be supplied as an object");
   return {};
  }
  if (typeof(params.sequence) != "undefined") {
   if (typeof(params.sequence) == "string") {
    this.sequence = params.sequence;
    var validation_match = this.sequence.match(get_validation_pattern());
    if (validation_match) {
     this.atoms = {};
     for (var i in water.atoms) {
      this.atoms[i] = water.atoms[i];
     }
     Object.keys(AminoAcids).forEach(function(aa) {
      var aa_matches = this.sequence.match(AminoAcids[aa].lettercode);
      if (aa_matches) {
       var aa_count = aa_matches.length;
       var atom_keys = Object.keys(AminoAcids[aa].atoms);
       for (var j in atom_keys) {
        var aa_atoms = (aa_count * AminoAcids[aa].atoms[atom_keys[j]]);
        if (typeof(this.atoms[atom_keys[j]]) == "undefined") {
         this.atoms[atom_keys[j]] = aa_atoms;
        }
        else {
         this.atoms[atom_keys[j]] += aa_atoms;
        }
       }
      }
     },this);
     if (typeof(params.modifications) != "undefined") {
      if ((typeof(params.modifications) == "object") && Array.isArray(params.modifications) && !params.modifications.map(function(a){return ((typeof(a) != "object") || (a.constructor !== HML.IsoCalc.Modification))}).reduce(function(a,b){return a+b})) {
       this.modifications = params.modifications;
       for (var i in params.modifications) {
        var atom_keys = Object.keys(params.modifications[i].atoms);
        for (var j in atom_keys) {
         if (typeof(this.atoms[atom_keys[j]]) == "undefined") {
          this.atoms[atom_keys[j]] = 0;
         }
         this.atoms[atom_keys[j]] += (params.modifications[i].atoms[atom_keys[j]]);
        }       
       }
      }
      else {
       console.log("modifications parameter must be an array of HML.IsoCalc.Modification objects");
       return {};
      }
     }
     if (typeof(params.charge) != "undefined") {
      if ((typeof(params.charge) == "number") && !isNaN(params.charge) && (function(x){return (x|0)===x;})(parseFloat(params.charge))) {
       this.charge = params.charge;
       if (params.charge > 0) {
        this.atoms["Hydrogen"] += this.charge;
       }
      }
      else {
       console.log("charge parameter must be an integer");
       return {};
      }
     }
     else {
      this.charge = 0;
     }
    }
    else {
     console.log("sequence parameter contains invalid characters: "+this.sequence);
     return {};
    }
   }
   else {
    console.log("sequence parameter must be a string");
    return {};
   }
  }
  else {
   console.log("sequence parameter undefined");
   return {};
  }
 }
 Peptide.prototype.calculate_distribution = function(altEleConst) {
  var atom_keys = Object.keys(this.atoms);
  this.distribution = new HML.IsoCalc.Hyperatom({isotopes:[[0,1]]});
  for (var i in atom_keys) {
   var atom = atom_keys[i];
   var hyperatom_required = this.atoms[atom];
   if (!hyperatom_required) {
    continue;
   }
   var bin_array = hyperatom_required.toString(2).split("").reverse().map(function(j){return parseInt(j)});
   var max_exp = bin_array.length-1;
   var intermediate_hyperatom = {};
   if (altEleConst && altEleConst[atom]) {
    intermediate_hyperatom[0] = new HML.IsoCalc.Hyperatom({isotopes:altEleConst[atom].isotopes});
   }
   else {
    intermediate_hyperatom[0] = new HML.IsoCalc.Hyperatom({isotopes:HML.IsoCalc.ElementalConstants[atom].isotopes});
   }
   for (var j = 0; j < max_exp; j++) {
    intermediate_hyperatom[j+1] = intermediate_hyperatom[j].convolute(intermediate_hyperatom[j]);
   }
   var hyperatom = intermediate_hyperatom[max_exp];
   for (var j = 0; j < max_exp; j++) {
    if (bin_array[j]) {
     hyperatom = hyperatom.convolute(intermediate_hyperatom[j]);
    }
   }
   this.distribution = this.distribution.convolute(hyperatom);
  }
  if (this.charge) {
   this.distribution = this.distribution.with_charge(this.charge);
  }
 }
 Peptide.prototype.get_centroided_distribution = function(ppm_gap,altEleConst) {
  if (typeof(ppm_gap) != "number") {
   console.log("Must provide ppm gap argument as a number")
   return {};
  }
  if (typeof(this.distribution) != "object") {
   this.calculate_distribution(altEleConst);
  }
 // First, find maxima
  var a = this.distribution.isotopes;
  var g = [1];
  for (var i = 1; i < a.length; i++) {
   g[i] = a[i][1] - a[i-1][1];
  }
  var u = 0;
  var is_max = g.map(Number.prototype.valueOf,0);
  for (var i = 1; i < g.length; i++) {
   if (g[i] < 0) {
    if ((g[i-1]) >= 0 && (u > -1)) {
     is_max[Math.floor((i+u-1)/2)] = 1;
    }
    u = -1;
   }
   else if (g[i] > 0) {
    u = i;
   }
  }
  var first_max;
  for (var i = 0; i < a.length; i++) {
   if (is_max[i]) {
    first_max = i;
    break;
   }
  }
  var last_max;
  for (var i = a.length-1; i >= 0; i--) {
   if (is_max[i]) {
    last_max = i;
    break;
   }
  }
 // Then, group to closest maxima
  if (first_max == last_max) {
   console.log(first_max,last_max)
   return new HML.IsoCalc.Hyperatom({isotopes:[centroid(a)]});
  }
  var groups = [[]];
  var maxima = [];
  for (var i in a) {
   if (is_max[i]) {
    maxima.push(a[i][0]);
   }
  }
  var m = 0;
  for (var i in a) {
   if (i < first_max) {
    groups[0].push(a[i]);
   }
   else if (i > last_max) {
    groups[m-1].push(a[i]);
   }
   else if (is_max[i]) {
    groups[m].push(a[i]);
    m++;
    groups[m] = [];
   }
   else if ((a[i][0]-maxima[m-1]) <= (maxima[m]-a[i][0])) {
    groups[m-1].push(a[i]);
   }
   else {
    groups[m].push(a[i]);
   }
  }
  groups = groups.slice(0,m);
  var centroided_groups = groups.map(function(i){return centroid(i)});
 
  //Then, group maxima closer than ppm_gap
  var grouped_centroided_groups = [[centroided_groups[0]]];
  var max_gap = (ppm_gap / 1e6);
  for (var i = 1; i < centroided_groups.length; i++) {
   if ((centroided_groups[i][0] - centroided_groups[i-1][0])/centroided_groups[i][0] <= max_gap) {
    grouped_centroided_groups[grouped_centroided_groups.length-1].push(centroided_groups[i]);
   }
   else {
    grouped_centroided_groups[grouped_centroided_groups.length] = [centroided_groups[i]];
   }
  }
  var final_centroids = grouped_centroided_groups.map(function(i){return centroid(i)});
  final_centroids = final_centroids.filter(
   function(i) {
    return i[1] > 0.01;
   }
  );
  return(new HML.IsoCalc.Hyperatom({isotopes:final_centroids}));
 }
 
 //Define constants
 
 var ElementalConstants = {
  getElementName : function(specifier) {
   if (ElementalConstants[specifier]) return specifier;
   var matches = (Object.keys(ElementalConstants).filter(function(ele) {
    if (!ElementalConstants[ele].symbol) return false; 
    switch(specifier.toUpperCase()) {
     case ele.toUpperCase():
     case ElementalConstants[ele].symbol: return true;
     default: return false;
    }
   }));
   if (matches.length == 1) {
    return matches[0];
   }
   else return undefined;
  }
 };

 ElementalConstants["Carbon"]   = new Atom({
                                             symbol: "C",
                                             isotopes:[
                                              [12.0000000,  98.8930],
                                              [13.0033554,   1.0700]
                                             ]});
 ElementalConstants["Hydrogen"] = new Atom({
                                             symbol: "H",
                                             isotopes:[
                                              [ 1.0078246,  99.9850],
                                              [ 2.0141021,   0.0150]
                                             ]});
 ElementalConstants["Nitrogen"] = new Atom({
                                             symbol: "N",
                                             isotopes:[
                                              [14.0030732,  99.6320],
                                              [15.0001088,   0.3680]
                                             ]});
 ElementalConstants["Oxygen"]   = new Atom({
                                             symbol: "O",
                                             isotopes:[
                                              [15.9949141,  99.7590],
                                              [16.9991322,   0.0374],
                                              [17.9991616,   0.2036]
                                             ]});
 ElementalConstants["Sulphur"]  = new Atom({
                                             symbol: "S",
                                             isotopes:[
                                              [31.9720700,  95.0200],
                                              [32.9720700,   0.7500],
                                              [33.9678660,   4.2100],
                                              [35.9670800,   0.0200]
                                             ]});
 
 var water = new Molecule({atoms:{Hydrogen:2,Oxygen:1}});
 
 var AminoAcids = {};
 AminoAcids["Alanine"] =       new AminoAcid({
                                              lettercode:"A",
                                              atoms:{
                                               Carbon  : 3,
                                               Hydrogen: 5,
                                               Nitrogen: 1,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Arginine"] =      new AminoAcid({
                                              lettercode:"R",
                                              atoms:{
                                               Carbon  : 6,
                                               Hydrogen:12,
                                               Nitrogen: 4,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Asparagine"] =    new AminoAcid({
                                              lettercode:"N",
                                              atoms:{
                                               Carbon  : 4,
                                               Hydrogen: 6,
                                               Nitrogen: 2,
                                               Oxygen  : 2
                                              }});
 AminoAcids["Aspartate"] =     new AminoAcid({
                                              lettercode:"D",
                                              atoms:{
                                               Carbon  : 4,
                                               Hydrogen: 5,
                                               Nitrogen: 1,
                                               Oxygen  : 3
                                              }});
 AminoAcids["Cysteine"] =      new AminoAcid({
                                              lettercode:"C",
                                              atoms:{
                                               Carbon  : 3,
                                               Hydrogen: 5,
                                               Nitrogen: 1,
                                               Oxygen  : 1,
                                               Sulphur : 1
                                              }});
 AminoAcids["Glutamate"] =     new AminoAcid({
                                              lettercode:"E",
                                              atoms:{
                                               Carbon  : 5,
                                               Hydrogen: 7,
                                               Nitrogen: 1,
                                               Oxygen  : 3
                                              }});
 AminoAcids["Glutamine"] =     new AminoAcid({
                                              lettercode:"Q",
                                              atoms:{
                                               Carbon  : 5,
                                               Hydrogen: 8,
                                               Nitrogen: 2,
                                               Oxygen  : 2
                                              }});
 AminoAcids["Glycine"] =       new AminoAcid({
                                              lettercode:"G",
                                              atoms:{
                                               Carbon  : 2,
                                               Hydrogen: 3,
                                               Nitrogen: 1,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Histidine"] =     new AminoAcid({
                                              lettercode:"H",
                                              atoms:{
                                               Carbon  : 6,
                                               Hydrogen: 7,
                                               Nitrogen: 3,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Isoleucine"] =    new AminoAcid({
                                              lettercode:"I",
                                              atoms:{
                                               Carbon  : 6,
                                               Hydrogen:11,
                                               Nitrogen: 1,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Leucine"] =       new AminoAcid({
                                              lettercode:"L",
                                              atoms:{
                                               Carbon  : 6,
                                               Hydrogen:11,
                                               Nitrogen: 1,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Lysine"] =        new AminoAcid({
                                              lettercode:"K",
                                              atoms:{
                                               Carbon  : 6,
                                               Hydrogen:12,
                                               Nitrogen: 2,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Methionine"] =    new AminoAcid({
                                              lettercode:"M",
                                              atoms:{
                                               Carbon  : 5,
                                               Hydrogen: 9,
                                               Nitrogen: 1,
                                               Oxygen  : 1,
                                               Sulphur : 1
                                              }});
 AminoAcids["Phenylalanine"] = new AminoAcid({
                                              lettercode:"F",
                                              atoms:{
                                               Carbon  : 9,
                                               Hydrogen: 9,
                                               Nitrogen: 1,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Proline"] =       new AminoAcid({
                                              lettercode:"P",
                                              atoms:{
                                               Carbon  : 5,
                                               Hydrogen: 7,
                                               Nitrogen: 2,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Serine"] =        new AminoAcid({
                                              lettercode:"S",
                                              atoms:{
                                               Carbon  : 3,
                                               Hydrogen: 5,
                                               Nitrogen: 1,
                                               Oxygen  : 2
                                              }});
 AminoAcids["Threonine"] =     new AminoAcid({
                                              lettercode:"T",
                                              atoms:{
                                               Carbon  : 4,
                                               Hydrogen: 7,
                                               Nitrogen: 1,
                                               Oxygen  : 2
                                              }});
 AminoAcids["Tryptophan"] =    new AminoAcid({
                                              lettercode:"W",
                                              atoms:{
                                               Carbon  :11,
                                               Hydrogen:10,
                                               Nitrogen: 2,
                                               Oxygen  : 1
                                              }});
 AminoAcids["Tyrosine"] =      new AminoAcid({
                                              lettercode:"Y",
                                              atoms:{
                                               Carbon  : 9,
                                               Hydrogen: 9,
                                               Nitrogen: 1,
                                               Oxygen  : 2
                                              }});
 AminoAcids["Valine"] =        new AminoAcid({
                                              lettercode:"V",
                                              atoms:{
                                               Carbon  : 5,
                                               Hydrogen: 9,
                                               Nitrogen: 1,
                                               Oxygen  : 1
                                              }});
 
 var get_validation_pattern = function() {
  var available_lettercodes = {};
  Object.keys(AminoAcids).forEach(function(aa) {
   if (typeof(available_lettercodes[AminoAcids[aa].lettercode.source]) != "undefined") {
    console.log("warning - duplicate lettercode "+AminoAcids[aa].lettercode.source+" for "+aa);
   }
   available_lettercodes[AminoAcids[aa].lettercode.source] = 1;
  });
  return new RegExp("^["+Object.keys(available_lettercodes).join("")+"]+$","i");
 }
 
 var centroid = function(arr) {
  if ((typeof(arr) == "object") && Array.isArray(arr) && !arr.map(function(a){return ((typeof(a) != "object") || !Array.isArray(a))}).reduce(function(a,b){return a+b})) {
   var tot_int = arr.reduce(function(acc,ele) {return acc+ele[1]}, 0);
   var weighted_mean_mass = arr.reduce(function(acc,ele) {return acc+(ele[0]*ele[1])/tot_int}, 0);
   return [weighted_mean_mass,tot_int];
  }
  else {
   console.log("array must be in form [[mass1,abundance1],[mass2,abundance2]] etc");
   return [];
  }
 }

 return {
  ElementalConstants: ElementalConstants,
  AminoAcids: AminoAcids,
  Modification: Modification,
  Atom : Atom,
  Hyperatom : Hyperatom,
  Peptide: Peptide
 }

}();