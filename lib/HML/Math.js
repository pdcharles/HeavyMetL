if (typeof HML == 'undefined') {
 HML = {};
}
HML.Math = {
 
 log2 : function(x) {
  return(Math.log(x)/Math.log(2));
 },
 
 percentile : function(a,p) {
  if ((typeof(a) == "object") && Array.isArray(a)) {
   console.log("first argument to percentile must be an array");
   return Number.NaN;
  }
  var r = (p * (a.length/100));
  var v;
  if (r < 1) {
   v = a[0];
  }
  else if (r > a.length) {
   v = a[a.length-1];
  }
  else if(!(r % 1)) {
   v = a[r-1];
  }
  else {
   var k = Math.floor(r);
   var k1 = Math.ceil(r);
   var pk = k * (100/a.length);
   v = a[k-1] + (p-pk)*(a.length/100)*(a[k1-1]-a[k-1]);
  }
  return(v);
 },
 
 erfc : function(x) {
  var z = Math.abs(x);
  var t = 2.0/(2.0+z);
  var ans = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (1.48851587 + (t * (-0.82215223 + t * 0.17087277)))))))));
  return( x >= 0.0 ? ans : 2.0-ans);
 },
 
 //Based on code from Skyline statistics library
 dotProduct : function(vector_a,vector_b) {
  if ([vector_a,vector_b].some(function(v) {return !((typeof(v) == "object") && Array.isArray(v))})) {
   console.log("both arguments to dotProduct must be an array");
   return Number.NaN;
  }
  if (vector_a.length != vector_b.length) {
   console.log("arguments to dotProduct must be of equal length");
   return Number.NaN;
  }
  var sumCross = 0;
  var sumLeft  = 0;
  var sumRight = 0;
  for (var i = 0, len = vector_a.length; i < len; i++) {
   var left = vector_a[i];
   var right = vector_b[i];
   sumCross += left*right;
   sumLeft += left*left;
   sumRight += right*right;
  }
  if (sumLeft == 0 || sumRight == 0) {
   return (sumLeft == 0 && sumRight == 0 ? 1.0 : 0);
  }
  else {
   return Math.min(1.0, sumCross/Math.sqrt(sumLeft*sumRight));
  }
 },
 
 normalisedSpectralContrastAngle : function(dotProduct) {
  return (1 - Math.acos(dotProduct)*2/Math.PI);
 },
 
 unitLengthVector : function(arr) {
  var total = arr.reduce(function(a,b){return a+b});
  return (total ? arr.map(function(a){return a/total}) : arr);
 },
 
 sqrtVector : function(arr) {
  return arr.map(function(a){return Math.sqrt(a)});
 },
 
 sqrtUnitNormalisedSpectralContrastAngle : function(vector_a,vector_b) {
  return HML.Math.normalisedSpectralContrastAngle(
          HML.Math.dotProduct(
           HML.Math.unitLengthVector(HML.Math.sqrtVector(vector_a)),
           HML.Math.unitLengthVector(HML.Math.sqrtVector(vector_b))
          )
         );
 },
 
 avgPpmDiff : function(a,b) {
  return (Math.abs(a-b)/((a+b)/2) * 1000000);
 },

 ppmError : function(mass,ppm) {
  return (mass/1000000)*ppm;
 }

};