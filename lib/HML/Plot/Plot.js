"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.Plot = function() {
 var Spectrum = function(spectrum) {
  var gwidth = 300;
  var gheight = 200;
  var xlmarg = 80;
  var xrmarg = 40;
  var ytmarg = 20;
  var ybmarg = 40;
  var yticks = 10;
  var labeloffset = 5;
  var labelfontsize = 9;
  var labelfontfamily = "Calibri";
  var tickmarkerlength = 20;
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
  var xticks = Math.round(xmax-xmin)/xtick;
  var xscale = gwidth/(xmax-xmin);
  var max_int = spectrum.getMaxIntensity();
  var ytick = (max_int.toPrecision(1)/yticks);
  if (max_int && ytick) {
   while ((yticks * ytick.toPrecision(2)) <= max_int) {
    ytick = ytick*1.1;
   }
  }
  ytick = ytick.toPrecision(2);
  var ymax = yticks * ytick;
  var ytickdp = (ytick < 10 ? ytick < 1 ? 2 : 1 : 0);
  var yscale = gheight/ymax;
  var strbase = "M 0 0 M "+gwidth+" -"+gheight+" M 0 0";
  var pathstr = strbase;
  var mz_labels = [];
  for (var i in spectrum.mzs) {
   var x = ((spectrum.mzs[i]-xmin)*xscale);
   var y = (spectrum.ints[i]*yscale);
   pathstr += " M "+x+" 0 L "+x+" -"+y+" z";
   var txt = new fabric.Text(spectrum.mzs[i].toFixed(2), {textAlign: "left", fontSize: labelfontsize, fontFamily:labelfontfamily, left: gleft+x, top: gtop+gheight-y-labeloffset, originX: "left", originY: "top"});
   txt.set({left: txt.left-(txt.width/2)+(txt.height/2), top: txt.top-(txt.height/2), angle: -45});
   mz_labels.push(txt);
  } 
  var graphpath = new fabric.Path(pathstr, {
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
  g.add(graphpath);
  mz_labels.forEach(function(l) {
   g.add(l);
  });
  var xaxisstr = strbase + " M 0 0 L 0 "+tickmarkerlength+" M 0 0 ";
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
    xaxisstr += " L "+x+" 0 M "+x+" 0 L "+x+" "+tickmarkerlength+" M "+x+" 0";
   }
  }
  var xaxispath = new fabric.Path(xaxisstr,{stroke:"black", left: gleft, top: gtop, originX: "left", originY: "top"});
  g.add(xaxispath);
  var yaxisstr = strbase + " M 0 0 L -"+tickmarkerlength+" 0 M 0 0";
  for (var yt = 0; yt <= yticks; yt++) {
   var y = ((yt*ytick)*yscale);
   var txt = new fabric.Text((yt*ytick).toFixed(ytickdp), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft-20, top: gtop+gheight-y, originX: "left", originY: "top"});
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
 var Chromatogram = function(chromatogram) {
  var gwidth = 300;
  var gheight = 200;
  var xlmarg = 80;
  var xrmarg = 40;
  var ytmarg = 20;
  var ybmarg = 40;
  var yticks = 10;
  var tickmarkerlength = 20;
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
  var min_rt = chromatogram.getMinRT();
  var max_rt = chromatogram.getMaxRT();
  var xtick = Math.max.apply(null,[Math.floor((max_rt-min_rt)*10)/10,0.05]);
  var xmin = Math.floor(min_rt*10)/10 - xtick;
  var xmax = Math.ceil(max_rt*10)/10 + xtick;
  var xticks = Math.round(xmax-xmin)/xtick;
  var xtickdp = (xtick < 10 ? xtick < 1 ? 2 : 1 : 0);
  var xscale = gwidth/(xmax-xmin);
  var max_int = chromatogram.getMaxIntensity();
  var ytick = (max_int.toPrecision(1)/yticks);
  if (max_int && ytick) {
   while ((yticks * ytick.toPrecision(2)) <= max_int) {
    ytick = ytick*1.1;
   }
  }
  ytick = ytick.toPrecision(2);
  var ymax = yticks * ytick;
  var ytickdp = (ytick < 10 ? ytick < 1 ? 2 : 1 : 0);
  var yscale = gheight/ymax;
  var strbase = "M 0 0 M "+gwidth+" -"+gheight+" M 0 0";
  var pathstr = strbase + " M "+((min_rt-xmin)*xscale)+" 0";
  for (var i in chromatogram.rts) {
   var x = ((chromatogram.rts[i]-xmin)*xscale);
   var y = (chromatogram.ints[i]*yscale);
   pathstr += " L "+x+" -"+y+" z M "+x+" -"+y;
  } 
  pathstr += " L "+((max_rt-xmin)*xscale)+" 0 z";

  var graphpath = new fabric.Path(pathstr, {
                                  globalCompositeOperation: "source-over",
                                  stroke: "rgb(0,0,0)",
                                  fill: "rgb(224,224,224)",
                                  left: gleft, 
                                  top: gtop,
                                  flipY: false,
                                  width: gwidth,
                                  height: gheight,
                                  originX: "left",
                                  originY: "top"
                                 });
  g.add(graphpath);

  var xaxisstr = strbase + " M 0 0 L 0 "+tickmarkerlength+" M 0 0";
  var dt = 0;
  for (var xt = 0; xt <= xticks; xt++) {
   var x = ((xt*xtick)*xscale);
   if (dt) {
    var txt = new fabric.Text(((xt*xtick)+xmin).toFixed(xtickdp), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft+x, top: gtop+gheight+tickmarkerlength, originX: "left", originY: "top"});
    txt.set({left: txt.left-(txt.width/2)});
    g.add(txt);
    dt = 0;
   }
   else {
    dt = 1;
   }
   if (xt) {
    xaxisstr += " L "+x+" 0 M "+x+" 0 L "+x+" "+tickmarkerlength+" M "+x+" 0";
   }
  }
  var xaxispath = new fabric.Path(xaxisstr,{stroke:"black", left: gleft, top: gtop, originX: "left", originY: "top"});
  g.add(xaxispath);
  var yaxisstr = strbase + " M 0 0 L -"+tickmarkerlength+" 0 M 0 0";
  for (var yt = 0; yt <= yticks; yt++) {
   var y = ((yt*ytick)*yscale);
   var txt = new fabric.Text((yt*ytick).toFixed(ytickdp), {textAlign: "left", fontSize: tickfontsize, fontFamily:tickfontfamily, left: gleft-20, top: gtop+gheight-y, originX: "left", originY: "top"});
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
 return {
  Spectrum : Spectrum,
  Chromatogram : Chromatogram
 }
}();