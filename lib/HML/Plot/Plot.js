"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.Plot = function() {

 var COLOURS = [
  ["rgb(0,153,0)","rgb(0,204,0)"],
  ["rgb(51,51,255)","rgb(204,204,255)"],
  ["rgb(255,51,51)","rgb(255,153,153)"]
 ]; 

 var MS1FeatureRelAbundance = function(feature,labels) {
  
  var quant = labels.map(function(label) {return feature.Quant[label].Failed ? 0 : feature.Quant[label].PermutationNormalisedIntensity});
  var gwidth = 300;
  var gheight = 200;
  var xlmarg = 80;
  var xrmarg = 40;
  var ytmarg = 90;
  var ybmarg = 40;
  var yticks = 11; 
  var labeloffset = 5;
  var labelfontsize = 15;
  var labelfontfamily = "Calibri";
  var tickmarkerlength = 10;
  var tickfontsize = 12;
  var tickfontfamily = "Calibri";
  var g = new fabric.Group([],{
   left: 0,
   top: 0,
   width: gwidth + xlmarg + xrmarg,
   height: gheight + ytmarg + ybmarg,
   hasBorders: true,
   originX: "left",
   originY: "top"
  }); 
  if (!quant.filter(function(q) {return q}).length) return new fabric.Text("No Quantitation",{fontFamily:tickfontfamily});
  var gleft = -(g.width/2)+xlmarg;
  var gtop = -(g.height/2)+ytmarg;
  var xtick = 1;
  var xticks = labels.length;
  var xscale = gwidth/labels.length;
  var max_int = Math.max.apply(null, quant.filter(function(q) {return q})) || 0;
  var ytick = (max_int.toPrecision(1)/yticks);
  if ((max_int > 0) && ytick) {
   while ((yticks * ytick.toPrecision(2)) <= max_int) {
    ytick = ytick*1.1;
   }
  }
  ytick = ytick.toPrecision(2);
  var ymax = yticks * ytick;
  var yscale = gheight/ymax;
  var strbase = "M 0 0 M "+gwidth+" -"+gheight+" M 0 0 z";
  quant.forEach(function(q,i) {
   var colours = COLOURS[i];
   var boxstr = strbase + " M "+(i*xscale)+" 0 L "+(i*xscale)+" -"+q*yscale+" L "+((i+1)*xscale)+" -"+q*yscale+" L "+((i+1)*xscale)+" 0 z";
   var boxpath = new fabric.Path(boxstr, {
                                   globalCompositeOperation: "source-over",
                                   stroke: colours[0],
                                   fill: colours[1],
                                   opacity: 0.3,
                                   left: gleft, 
                                   top: gtop,
                                   flipY: false,
                                   width: gwidth,
                                   height: gheight,
                                   originX: "left",
                                   originY: "top"
                                  });
   g.add(boxpath);
   var txt = new fabric.Text((labels[i]+"\n"+q.toExponential(4)), {fill: colours[0], textAlign: "center", fontSize: labelfontsize, fontFamily:labelfontfamily, left: gleft+(i*xscale), top: (gtop+gheight-q*yscale), originX: "left", originY: "top"});
   txt.set({left: txt.left+(xscale/2)-(txt.width/2), top: txt.top-txt.height});
   g.add(txt);
  });

  var xaxisstr = strbase + " M 0 0 L "+(labels.length*xscale)+" 0 z";
  var xaxispath = new fabric.Path(xaxisstr,{stroke:"black", left: gleft, top: gtop, originX: "left", originY: "top"});
  g.add(xaxispath);

  var yaxisstr = strbase + " M 0 0 L -"+tickmarkerlength+" 0 M 0 0";
  for (var yt = 0; yt <= yticks; yt++) {
   var y = ((yt*ytick)*yscale);
   var txt = new fabric.Text((yt*ytick).toExponential(4), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft-20, top: gtop+gheight-y, originX: "left", originY: "top"});
   txt.set({left: txt.left-txt.width-tickmarkerlength/5, top: txt.top-(txt.height/2)});
   g.add(txt);
   if (yt) {
    yaxisstr += " L 0 -"+y+" M 0 -"+y+" L -"+tickmarkerlength+" -"+y+" M 0 -"+y+"";
   }
  }
  var yaxispath = new fabric.Path(yaxisstr,{stroke:"black", left: gleft-tickmarkerlength, top: gtop, originX: "left", originY: "top"});
  g.add(yaxispath); 
  return g;
 };

 var MS1FeatureChromatogram = function(feature,labels,idrt) {

  var chromatograms = labels.map(function(label) {return feature.Quant[label].QuantFailed ? null : feature.Quant[label].Chromatogram});
  chromatograms.forEach(function(chr,i) {
   if (chr) {
    chr.Label = labels[i];
    chr.QERT = feature.Quant[labels[i]].RT;
    chr.QEIntensity = feature.Quant[labels[i]].Intensity;
   }
  });
  var colourlist = COLOURS.slice(0);
  colourlist = colourlist.filter(function(cl,i) {return chromatograms[i]});
  chromatograms = chromatograms.filter(function(chr) {return chr});

  var gwidth = 300;
  var gheight = 200;
  var xlmarg = 80;
  var xrmarg = 40;
  var ytmarg = 90;
  var ybmarg = 40;
  var yticks = 11; 
  var labeloffset = 5;
  var labelfontsize = 12;
  var labelheight = (new fabric.Text("I",{fontSize: labelfontsize})).height;
  var labelfontfamily = "Calibri";
  var tickmarkerlength = 10;
  var tickfontsize = 12;
  var tickfontfamily = "Calibri";
  var g = new fabric.Group([],{
   left: 0,
   top: 0,
   width: gwidth + xlmarg + xrmarg,
   height: gheight + ytmarg + ybmarg,
   hasBorders: true,
   originX: "left",
   originY: "top"
  }); 
  if (!chromatograms.length) return g;

  var gleft = -(g.width/2)+xlmarg;
  var gtop = -(g.height/2)+ytmarg;
  var min_rt = Math.min.apply(null, chromatograms.map(function(chr) {return chr.getMinRT()}));
  var max_rt = Math.max.apply(null, chromatograms.map(function(chr) {return chr.getMaxRT()}));
  var xtick = Math.max(Math.floor((max_rt-min_rt)*100)/1000,0.05)*2;
  var xmin = Math.floor(min_rt) - xtick/2;
  var xmax = Math.ceil(max_rt) + xtick/2;
  var xticks = Math.ceil(Math.round(xmax-xmin)/xtick);
  var xtickdp = (xtick < 10 ? xtick < 1 ? 2 : 1 : 0);
  var xscale = gwidth/(xmax-xmin);
  var max_int = Math.max.apply(null, chromatograms.map(function(chr) {return chr.getMaxIntensity()}));
  var ytick = (max_int.toPrecision(1)/(yticks-1));
  if (max_int && ytick) {
   while (((yticks-1) * ytick.toPrecision(2)) <= max_int) {
    ytick = ytick*1.1;
   }
  }
  ytick = ytick.toPrecision(2);
  var ymax = yticks * ytick;
  var yscale = gheight/ymax;
  var strbase = "M 0 0 M "+gwidth+" -"+gheight+" M 0 0 z";

  var qe = [];   
  chromatograms.forEach(function(chr,chr_i) {
   var pathstr = strbase + " M "+((min_rt-xmin)*xscale)+" 0";
   for (var i in chr.rts) {
    var x = ((chr.rts[i]-xmin)*xscale);
    var y = (chr.ints[i]*yscale);
    pathstr += " L "+x+" -"+y;
   } 
   pathstr += " L "+((max_rt-xmin)*xscale)+" 0 z";
   var colours = colourlist.shift();
 
   var graphpath = new fabric.Path(pathstr, {
                                   globalCompositeOperation: "source-over",
                                   stroke: colours[0],
                                   fill: colours[1],
                                   opacity: 0.3,
                                   left: gleft, 
                                   top: gtop,
                                   flipY: false,
                                   width: gwidth,
                                   height: gheight,
                                   originX: "left",
                                   originY: "top"
                                  });
   g.add(graphpath);

   var quanteventpathstr = strbase + " M "+((chr.QERT-xmin)*xscale)+" -"+(chr.QEIntensity*yscale)+" L "+((chr.QERT-xmin)*xscale)+" -"+(ymax*yscale);
   var quanteventpath = new fabric.Path(quanteventpathstr, {
                                   globalCompositeOperation: "source-over",
                                   stroke: "rgb(0,0,0)",
                                   left: gleft, 
                                   top: gtop,
                                   flipY: false,
                                   width: gwidth,
                                   height: gheight,
                                   originX: "left",
                                   originY: "top"
                                  });
   qe.push(quanteventpath);
   
   var txt = new fabric.Text(chr.Label+" ("+chr.QERT.toFixed(2)+")", {fill: colours[0], textAlign: "left", fontSize: labelfontsize, fontFamily:labelfontfamily, left: gleft+((chr.QERT-xmin)*xscale), top: gtop+gheight-ymax*yscale-chr_i*(labelheight+labeloffset), originX: "left", originY: "top"});
   txt.set({left: txt.left-(txt.height/2), top: txt.top-(txt.height/2), angle: -45});
   qe.push(txt);
  });
  qe.forEach(function(ele) {
   g.add(ele);
  });

  if (idrt != null) { 
   var idrtpathstr = strbase + " M "+((idrt-xmin)*xscale)+" 0 L "+((idrt-xmin)*xscale)+" -"+(ymax*yscale);
   var idrtpath = new fabric.Path(idrtpathstr, {
                                   globalCompositeOperation: "source-over",
                                   stroke: "rgb(255,0,0)",
                                   left: gleft, 
                                   top: gtop,
                                   flipY: false,
                                   width: gwidth,
                                   height: gheight,
                                   originX: "left",
                                   originY: "top"
                                  });
   g.add(idrtpath);
   var txt = new fabric.Text("ID ("+idrt.toFixed(2)+")", {fill: "rgb(255,0,0)", textAlign: "left", fontSize: labelfontsize, fontFamily:labelfontfamily, left: gleft+((idrt-xmin)*xscale), top: gtop+gheight-ymax*yscale, originX: "left", originY: "top"});
   txt.set({left: txt.left-(txt.height/2), top: txt.top-(txt.height/2), angle: -45});
   g.add(txt);
  }


  var xaxisstr = strbase + " M 0 0 ";
  for (var xt = 1; xt <= xticks; xt++) {
   var x = ((xt*xtick)*xscale);
   if (xt) {
    xaxisstr += " L "+x+" 0 M "+x+" 0"
    if (xt < xticks) {
     xaxisstr += "L "+x+" "+tickmarkerlength+" M "+x+" 0";
     var txt = new fabric.Text(((xt*xtick)+xmin).toFixed(xtickdp), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft+x, top: gtop+gheight+tickmarkerlength, originX: "left", originY: "top"});
     txt.set({left: txt.left-(txt.width/2)});
     g.add(txt);
    }
   }
  }
  var xaxispath = new fabric.Path(xaxisstr,{stroke:"black", left: gleft, top: gtop, originX: "left", originY: "top"});
  g.add(xaxispath);
  var yaxisstr = strbase + " M 0 0 L -"+tickmarkerlength+" 0 M 0 0";
  for (var yt = 0; yt <= yticks; yt++) {
   var y = ((yt*ytick)*yscale);
   var txt = new fabric.Text((yt*ytick).toExponential(4), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft-20, top: gtop+gheight-y, originX: "left", originY: "top"});
   txt.set({left: txt.left-txt.width-tickmarkerlength/5, top: txt.top-(txt.height/2)});
   g.add(txt);
   if (yt) {
    yaxisstr += " L 0 -"+y+" M 0 -"+y+" L -"+tickmarkerlength+" -"+y+" M 0 -"+y+"";
   }
  }
  var yaxispath = new fabric.Path(yaxisstr,{stroke:"black", left: gleft-tickmarkerlength, top: gtop, originX: "left", originY: "top"});
  g.add(yaxispath); 
  return g;
 };

 var MS1FeatureSpectrum = function(feature,label) {

  var spectrum = feature.Quant[label].Spectrum;
  var theospectrum = feature.Extractions[label][feature.Quant[label].MatchedDistributionIndex];
  var theospectrumnorm = (theospectrum.ints[spectrum.getBasePeakIndex()] / spectrum.getBasePeakIntensity()) || 1;
  var permspectrum = feature.Quant[label].SpectrumPermutation;

  var gwidth = 300;
  var gheight = 200;
  var xlmarg = 80;
  var xrmarg = 40;
  var ytmarg = 30;
  var ybmarg = 60;
  var yticks = 10;
  var labeloffset = 5;
  var labelfontsize = 12;
  var labelfontfamily = "Calibri";
  var tickmarkerlength = 10;
  var tickfontsize = 12;
  var tickfontfamily = "Calibri";
  var g = new fabric.Group([],{
   left: 0,
   top: 0,
   width: gwidth + xlmarg + xrmarg,
   height: gheight + ytmarg + ybmarg,
   hasBorders: true,
   originX: "left",
   originY: "top"
  }); 

  var gleft = -(g.width/2)+xlmarg;
  var gtop = -(g.height/2)+ytmarg;
  var min_mz = feature.Quant[label].Spectrum.getMinMz();
  var max_mz = feature.Quant[label].Spectrum.getMaxMz();
  var xtick = 0.5;
  var xmin = Math.floor(min_mz) - xtick;
  var xmax = Math.ceil(max_mz) + xtick;
  var xticks = Math.ceil(Math.round(xmax-xmin)/xtick);
  var xscale = gwidth/(xmax-xmin);
  var max_int = theospectrum.getMaxIntensity()/theospectrumnorm;
  var ytick = (max_int.toPrecision(1)/yticks);
  if (max_int && ytick) {
   while ((yticks * ytick.toPrecision(2)) <= max_int) {
    ytick = ytick*1.1;
   }
  }
  ytick = ytick.toPrecision(2);
  var ymax = yticks * ytick;
  var yscale = gheight/ymax;
  var strbase = "M 0 0 M "+gwidth+" -"+gheight+" M 0 0 z";

  var theospectrumpathstr = strbase;
  var mz_labels = [];
  for (var i in theospectrum.mzs) {
   var err = HML.Math.ppmError(theospectrum.mzs[i],feature.PpmError);
   var x_low = ((theospectrum.mzs[i]-err-xmin)*xscale);
   var x_hi  = ((theospectrum.mzs[i]+err-xmin)*xscale);
   var x_txt = ((theospectrum.mzs[i]-xmin)*xscale);
   var y_theo = (theospectrum.ints[i]/theospectrumnorm*yscale);
   var y_obs = (spectrum.ints[i]*yscale);
   theospectrumpathstr += " M "+x_low+" 0 L "+x_low+" -"+y_theo+" L "+x_hi+" -"+y_theo+" L "+x_hi+" 0 L "+x_low+" 0 z";
   theospectrumpathstr += " M "+(x_low-(gwidth/50))+" -"+y_theo+" L "+(x_hi+(gwidth/50))+" -"+y_theo+" z";
   var txt = new fabric.Text(theospectrum.mzs[i].toFixed(2), {textAlign: "left", fontSize: labelfontsize, fontFamily:labelfontfamily, left: gleft+x_txt, top: gtop+gheight-Math.max(y_theo,y_obs)-labeloffset, originX: "left", originY: "top"});
   txt.set({left: txt.left-(txt.height/2), top: txt.top-(txt.height/4), angle: -90});
   mz_labels.push(txt);
  } 
  var theospectrumpath = new fabric.Path(theospectrumpathstr, {
                                  globalCompositeOperation: "source-over",
                                  stroke: "rgb(102,255,255)", fill: "rgb(102,255,255)",
                                  left: gleft, 
                                  top: gtop,
                                  flipY: false,
                                  width: gwidth,
                                  height: gheight,
                                  originX: "left",
                                  originY: "top"
                                 });
  g.add(theospectrumpath);
  mz_labels.forEach(function(l) {
   g.add(l);
  });

  var excluded_x = ((spectrum.mzs[permspectrum.ExcludedIndex]-xmin)*xscale);
  var excluded_y = (spectrum.ints[permspectrum.ExcludedIndex]*yscale);
  var excludedpeakpathstr = strbase + " M "+excluded_x+" 0 L "+excluded_x+" -"+excluded_y+" z";
  var excludedpeakpath = new fabric.Path(excludedpeakpathstr, {
                                  globalCompositeOperation: "source-over",
                                  stroke: "rgb(255,102,102)",
                                  left: gleft, 
                                  top: gtop,
                                  flipY: false,
                                  width: gwidth,
                                  height: gheight,
                                  originX: "left",
                                  originY: "top"
                                 });
  g.add(excludedpeakpath);

  var permspectrumpathstr = strbase; 
  for (var i in permspectrum.mzs) {
   var x = ((permspectrum.mzs[i]-xmin)*xscale);
   var y = (permspectrum.ints[i]*yscale);
   permspectrumpathstr += " M "+x+" 0 L "+x+" -"+y+" z";
  } 
  var permspectrumpath = new fabric.Path(permspectrumpathstr, {
                                  globalCompositeOperation: "source-over",
                                  stroke: "rgb(0,0,0)",
                                  left: gleft, 
                                  top: gtop,
                                  flipY: false,
                                  width: gwidth,
                                  height: gheight,
                                  originX: "left",
                                  originY: "top"
                                 });
  g.add(permspectrumpath);

  var xaxisstr = strbase + " M 0 0 ";
  var dt = 0;
  for (var xt = 0; xt <= xticks; xt++) {
   var x = ((xt*xtick)*xscale);
   if (dt) {
    var txt = new fabric.Text(((xt*xtick)+xmin).toFixed(0), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft+x, top: gtop+gheight+tickmarkerlength, originX: "left", originY: "top"});
    txt.set({left: txt.left-(txt.width/2)});
    g.add(txt);
    dt = 0;
   }
   else {
    dt = 1;
   }
   if (xt) {
    xaxisstr += " L "+x+" 0 M "+x+" 0"
    if (xt < xticks) xaxisstr += "L "+x+" "+tickmarkerlength+" M "+x+" 0";
   }
  }
  var xaxispath = new fabric.Path(xaxisstr,{stroke:"black", left: gleft, top: gtop, originX: "left", originY: "top"});
  g.add(xaxispath);
  var yaxisstr = strbase + " M 0 0 L -"+tickmarkerlength+" 0 M 0 0";
  for (var yt = 0; yt <= yticks; yt++) {
   var y = ((yt*ytick)*yscale);
   var txt = new fabric.Text((yt*ytick).toExponential(4), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft-20, top: gtop+gheight-y, originX: "left", originY: "top"});
   txt.set({left: txt.left-txt.width-tickmarkerlength/5, top: txt.top-(txt.height/2)});
   g.add(txt);
   if (yt) {
    yaxisstr += " L 0 -"+y+" M 0 -"+y+" L -"+tickmarkerlength+" -"+y+" M 0 -"+y+"";
   }
  }
  var yaxispath = new fabric.Path(yaxisstr,{stroke:"black", left: gleft-tickmarkerlength, top: gtop, originX: "left", originY: "top"});
  g.add(yaxispath); 

  var titletxt = new fabric.Text("Label: "+label+" ("+feature.Quant[label].MatchedDistributionIncorporation+"%)   -   idotp: "+feature.Quant[label].SpectrumMatchScore.toFixed(2), {textAlign: "center", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft+(xmax-xmin)/2*xscale, top: gtop+gheight+tickmarkerlength*3, originX: "left", originY: "top"});
  titletxt.set({left: titletxt.left-(titletxt.width/2)});
  g.add(titletxt); 

  return g;
 };

 return {
  MS1FeatureRelAbundance : MS1FeatureRelAbundance,
  MS1FeatureChromatogram : MS1FeatureChromatogram,
  MS1FeatureSpectrum : MS1FeatureSpectrum
 }
}();