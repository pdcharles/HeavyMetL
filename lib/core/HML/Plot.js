"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.Plot = function() {

 var COLOURS = [
  ["rgb(0,153,0)","rgb(0,204,0)"],
  ["rgb(51,51,255)","rgb(204,204,255)"],
  ["rgb(255,51,51)","rgb(255,153,153)"]
 ]; 

 var MS1FeatureRelAbundance = function(feature,labels) {
  
  var quant = labels.map((lb,i) => (feature[0][i].length ? feature[0][i][0] : 0));
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
  if (!quant.filter((q) => q).length) return new fabric.Text("No Quantitation",{fontFamily:tickfontfamily});
  var gleft = -(g.width/2)+xlmarg;
  var gtop = -(g.height/2)+ytmarg;
  var xtick = 1;
  var xticks = labels.length;
  var xscale = gwidth/labels.length;
  var max_int = Math.max.apply(null, quant.filter((q) => q)) || 0;
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

 var MS1FeatureChromatogram = function(feature,labels,idrts) {

  var chromatograms = labels.map((lb,i) => (feature[0][i].length 
                                             ? new MSLIB.Data.Chromatogram(
                                                feature[1][i].Chromatogram_rts,
                                                feature[1][i].Chromatogram_ints
                                               )
                                             : null));
  chromatograms.forEach(function(chr,i) {
   if (chr) {
    chr.Label = labels[i];
    chr.QERT = feature[1][i].RT;
    chr.QEIntensity = feature[1][i].Intensity;
   }
  });
  var colourlist = COLOURS.slice(0);
  colourlist = colourlist.filter((cl,i) => chromatograms[i]);
  chromatograms = chromatograms.filter((chr) => chr);

  var gwidth = 300;
  var gheight = 200;
  var xlmarg = 80;
  var xrmarg = 40;
  var ytmarg = 90;
  var ybmarg = 40; 
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
  var min_rt = Math.min.apply(null, chromatograms.map((chr) => chr.getMinRT()));
  var max_rt = Math.max.apply(null, chromatograms.map((chr) => chr.getMaxRT()));
  var xtick = Math.max(Math.floor((max_rt-min_rt)*100)/1000,0.1)*2;
  var xmin = Math.floor(min_rt) - xtick/2;
  var xmax = Math.ceil(max_rt) + xtick/2;
  var xticks = Math.ceil(Math.round(xmax-xmin)/xtick);
  var xtickdp = (xtick < 10 ? xtick < 1 ? 2 : 1 : 0);
  var xscale = gwidth/(xmax-xmin);
  var ymax = Math.round(Math.log10(Math.max.apply(null, chromatograms.map((chr) => chr.getMaxIntensity()))))+1;
  var yticks = ymax;
  var ytick = 1;
  var yscale = gheight/ymax;
  var strbase = "M 0 0 M "+gwidth+" -"+gheight+" M 0 0 z";

  var qe = [];   
  chromatograms.forEach(function(chr,chr_i) {
   var pathstr = strbase + " M "+((min_rt-xmin)*xscale)+" 0";
   for (var i in chr.rts) {
    var x = ((chr.rts[i]-xmin)*xscale);
    var y = (Math.log10(chr.ints[i] || 1)*yscale);
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

   var quanteventpathstr = strbase + " M "+((chr.QERT-xmin)*xscale)+" -"+(Math.log10(chr.QEIntensity)*yscale)+" L "+((chr.QERT-xmin)*xscale)+" -"+(ymax*yscale);
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

  if (idrts != null && idrts.length) {
   idrts.forEach(function(idrt) {
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
   });
  }


  var xaxisstr = strbase + " M 0 0 ";
  for (var xt = 1; xt <= xticks; xt++) {
   var x = ((xt*xtick)*xscale);
   if (xt) {
    xaxisstr += " L "+x+" 0 M "+x+" 0"
    if (xt < xticks) {
     xaxisstr += "L "+x+" "+tickmarkerlength+" M "+x+" 0";
     var txt = new fabric.Text(((xt*xtick)+xmin).toFixed(xtickdp), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft+x, top: gtop+gheight+tickmarkerlength, originX: "left", originY: "top"});
     txt.set({left: txt.left-(txt.width+txt.height)/2, top: txt.top+(txt.height+txt.width)/2, angle: -45});
     g.add(txt);
    }
   }
  }
  var xaxispath = new fabric.Path(xaxisstr,{stroke:"black", left: gleft, top: gtop, originX: "left", originY: "top"});
  g.add(xaxispath);

  var yaxisstr = strbase + " M 0 0 L -"+tickmarkerlength+" 0 M 0 0";
  for (var yt = 0; yt <= yticks; yt++) {
   var y = ((yt*ytick)*yscale);
   var txt = new fabric.Text(Math.pow(10,yt*ytick).toExponential(0), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft-20, top: gtop+gheight-y, originX: "left", originY: "top"});
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

 var MS1FeatureSpectrum = function(feature,label,label_i) {

  var spectrum = new MSLIB.Data.Spectrum(
                      feature[1][label_i].Spectrum_mzs,
                      feature[1][label_i].Spectrum_ints
                     );
  var scaled_spectrum = new MSLIB.Data.Spectrum(
                             feature[1][label_i].ScaledSpectrum_mzs,
                             feature[1][label_i].ScaledSpectrum_ints
                            );
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
  var min_mz = spectrum.getMinMz();
  var max_mz = spectrum.getMaxMz();
  var xtick = 0.5;
  var xmin = Math.floor(min_mz) - xtick;
  var xmax = Math.ceil(max_mz) + xtick;
  var xticks = Math.ceil(Math.round(xmax-xmin)/xtick);
  var xscale = gwidth/(xmax-xmin);
  var max_int = Math.max(spectrum.getMaxIntensity(),scaled_spectrum.getMaxIntensity());
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

  var scaled_spectrumpathstr = strbase;
  var mz_labels = [];
  for (var i in scaled_spectrum.mzs) {
   var err = MSLIB.Math.ppmError(scaled_spectrum.mzs[i],HML.Config.PpmError);
   var x_low = ((scaled_spectrum.mzs[i]-err-xmin)*xscale);
   var x_hi  = ((scaled_spectrum.mzs[i]+err-xmin)*xscale);
   var x_txt = ((scaled_spectrum.mzs[i]-xmin)*xscale);
   var y_scaled = (scaled_spectrum.ints[i]*yscale);
   var y_obs = (spectrum.ints[i]*yscale);
   scaled_spectrumpathstr += " M "+x_low+" 0 L "+x_low+" -"+y_scaled+" L "+x_hi+" -"+y_scaled+" L "+x_hi+" 0 L "+x_low+" 0 z";
   scaled_spectrumpathstr += " M "+(x_low-(gwidth/50))+" -"+y_scaled+" L "+(x_hi+(gwidth/50))+" -"+y_scaled+" z";
   var txt = new fabric.Text(scaled_spectrum.mzs[i].toFixed(2), {textAlign: "left", fontSize: labelfontsize, fontFamily:labelfontfamily, left: gleft+x_txt, top: gtop+gheight-Math.max(y_scaled,y_obs)-labeloffset, originX: "left", originY: "top"});
   txt.set({left: txt.left-(txt.height/2), top: txt.top-(txt.height/4), angle: -90});
   mz_labels.push(txt);
  } 
  var scaled_spectrumpath = new fabric.Path(scaled_spectrumpathstr, {
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
  g.add(scaled_spectrumpath);
  mz_labels.forEach(function(l) {
   g.add(l);
  });

  var spectrumpathstr = strbase; 
  for (var i in spectrum.mzs) {
   var x = ((spectrum.mzs[i]-xmin)*xscale);
   var y = (spectrum.ints[i]*yscale);
   spectrumpathstr += " M "+x+" 0 L "+x+" -"+y+" z";
  } 
  var spectrumpath = new fabric.Path(spectrumpathstr, {
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
  g.add(spectrumpath);

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

  var titletxt = new fabric.Text("Label: "+label+" ("+feature[1][label_i].Incorporation+"%)   -   idotp: "+feature[1][label_i].Score.toFixed(2), {textAlign: "center", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft+(xmax-xmin)/2*xscale, top: gtop+gheight+tickmarkerlength*3, originX: "left", originY: "top"});
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