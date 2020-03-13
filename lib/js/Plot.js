"use strict";

if (typeof HML == 'undefined') var HML = {};

HML.Plot = function() {

 var COLOURS = [
  ["rgb(0,153,0)","rgb(0,204,0)"],
  ["rgb(51,51,255)","rgb(204,204,255)"],
  ["rgb(255,51,51)","rgb(255,153,153)"]
 ]; 

 var title = function(text) {
  var t = new fabric.Text(text, {textAlign: "center", fontSize: 16, fontFamily:HML.ui.fontFamily, left: 0, top: 0, originX: "left", originY: "top"});
  t.set({left: t.left-(t.width/2), fontWeight:"bold"});
  return t;
 }

 var MS1FeatureRelAbundance = function(feature,labels) {
  var quant = labels.map((lb,i) => feature[i*4] || 0);
  var gWidth = 300;
  var gHeight = 200;
  var xlMar = 80;
  var xrMar = 40;
  var ytMar = 90;
  var ybMar = 40;
  var yTicks = 11; 
  var labelOffset = 5;
  var labelFontSize = 15;
  var tickMarkerLength = 10;
  var tickFontSize = 12;
  var g = new fabric.Group([],{
   left: 0,
   top: 0,
   width: gWidth + xlMar + xrMar,
   height: gHeight + ytMar + ybMar,
   hasBorders: true,
   originX: "left",
   originY: "top"
  }); 
  if (!quant.filter((q) => q).length) return new fabric.Text("No Quantitation",{fontFamily:HML.ui.fontFamily});
  var gLeft = -(g.width/2)+xlMar;
  var gTop = -(g.height/2)+ytMar;
  var xTick = 1;
  var xTicks = labels.length;
  var xScale = gWidth/labels.length;
  var maxInt = Math.max.apply(null, quant) || 0;
  var yTick = (maxInt.toPrecision(1)/yTicks);
  if ((maxInt > 0) && yTick) {
   while ((yTicks * yTick.toPrecision(2)) <= maxInt) {
    yTick = yTick*1.1;
   }
  }
  yTick = yTick.toPrecision(2);
  var yMax = yTicks * yTick;
  var yScale = gHeight/yMax;
  var strBase = "M 0 0 M "+gWidth+" -"+gHeight+" M 0 0 z";
  quant.forEach(function(q,i) {
   var colours = COLOURS[i];
   var boxstr = strBase + " M "+(i*xScale)+" 0 L "+(i*xScale)+" -"+q*yScale+" L "+((i+1)*xScale)+" -"+q*yScale+" L "+((i+1)*xScale)+" 0 z";
   var boxPath = new fabric.Path(boxstr, {
                                   globalCompositeOperation: "source-over",
                                   stroke: colours[0],
                                   fill: colours[1],
                                   opacity: 0.3,
                                   left: gLeft, 
                                   top: gTop,
                                   flipY: false,
                                   width: gWidth,
                                   height: gHeight,
                                   originX: "left",
                                   originY: "top"
                                  });
   g.add(boxPath);
   var txt = new fabric.Text((labels[i]+"\n"+q.toExponential(4)), {fill: colours[0], textAlign: "center", fontSize: labelFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+(i*xScale), top: (gTop+gHeight-q*yScale), originX: "left", originY: "top"});
   txt.set({left: txt.left+(xScale/2)-(txt.width/2), top: txt.top-txt.height});
   g.add(txt);
  });

  var xAxisStr = strBase + " M 0 0 L "+(labels.length*xScale)+" 0 z";
  var xAxisPath = new fabric.Path(xAxisStr,{stroke:"black", left: gLeft, top: gTop, originX: "left", originY: "top"});
  g.add(xAxisPath);

  var yAxisStr = strBase + " M 0 0 L -"+tickMarkerLength+" 0 M 0 0";
  for (var yt = 0; yt <= yTicks; yt++) {
   var y = ((yt*yTick)*yScale);
   var txt = new fabric.Text((yt*yTick).toExponential(HML.config.displayYAxisDecimalPlaces), {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft-20, top: gTop+gHeight-y, originX: "left", originY: "top"});
   txt.set({left: txt.left-txt.width-tickMarkerLength/5, top: txt.top-(txt.height/2)});
   g.add(txt);
   if (yt) {
    yAxisStr += " L 0 -"+y+" M 0 -"+y+" L -"+tickMarkerLength+" -"+y+" M 0 -"+y+"";
   }
  }
  var yAxisPath = new fabric.Path(yAxisStr,{stroke:"black", left: gLeft-tickMarkerLength, top: gTop, originX: "left", originY: "top"});
  g.add(yAxisPath);

  var yAxisTitle = new fabric.Text("Intensity", {textAlign: "center", fontSize: tickFontSize-2, fontFamily:HML.ui.fontFamily, left: gLeft, top: gTop, originX: "left", originY: "top"});
  yAxisTitle.set({top: yAxisTitle.top-(yAxisTitle.height/2), left: yAxisTitle.left-(yAxisTitle.height/2), fontStyle:"italic", fontWeight:"bold",angle:-90});
  g.add(yAxisTitle);

  return g;
 };

 var MS1FeatureChromatogram = function(feature,labels,idrts) {

  var chromatograms = labels.map((lb,i) => (feature[i*4] 
                                             ? new MSLIB.Data.Chromatogram(
                                                feature[8][i].chromatogramRts,
                                                feature[8][i].chromatogramInts
                                               )
                                             : null));
  chromatograms.forEach(function(chr,i) {
   if (chr) {
    chr.Label = labels[i];
    chr.QERT = feature[i*4+2];
    chr.QEIntensity = feature[i*4];
   }
  });
  var colourlist = COLOURS.slice(0);
  colourlist = colourlist.filter((cl,i) => chromatograms[i]);
  chromatograms = chromatograms.filter((chr) => chr);

  var gWidth = 300;
  var gHeight = 200;
  var xlMar = 80;
  var xrMar = 40;
  var ytMar = 90;
  var ybMar = 40; 
  var labelOffset = 5;
  var labelFontSize = 12;
  var labelheight = (new fabric.Text("I",{fontSize: labelFontSize})).height;
  var tickMarkerLength = 10;
  var tickFontSize = 12;
  var g = new fabric.Group([],{
   left: 0,
   top: 0,
   width: gWidth + xlMar + xrMar,
   height: gHeight + ytMar + ybMar,
   hasBorders: true,
   originX: "left",
   originY: "top"
  }); 
  if (!chromatograms.length) return g;

  var gLeft = -(g.width/2)+xlMar;
  var gTop = -(g.height/2)+ytMar;
  var minRt = Math.min.apply(null, chromatograms.map((chr) => chr.getMinRT()));
  var maxRt = Math.max.apply(null, chromatograms.map((chr) => chr.getMaxRT()));
  var xTick = Math.max(Math.floor((maxRt-minRt)*100)/1000,0.1)*2;
  var xTickdp = (xTick < 10 ? xTick < 1 ? 2 : 1 : 0);
  var xMin = minRt - xTick/2;
  var xMax = maxRt + xTick/2;
  var xTicks = Math.ceil((xMax-xMin)/xTick);
  xMax = xTicks*xTick;
  var xScale = gWidth/xMax;
  var intMax = Math.max.apply(null, chromatograms.map((chr) => chr.getMaxIntensity()));
  var logIntMax = Math.log10(intMax || 1);
  var logIntUpperBound = ( logIntMax < Math.ceil(logIntMax)-0.5 ? Math.ceil(logIntMax)-0.5 : Math.ceil(logIntMax) );
  var yMax,yTicks;
  if (HML.config.displayChromatogramIntensitiesLogged) {
   yMax = yTicks = logIntUpperBound;
  }
  else {
   yMax = Math.pow(10,logIntUpperBound);
   yTicks = 10;
  }
  var yTick = yMax / yTicks
  var yScale = gHeight/yMax;
  var strBase = "M 0 0 M "+gWidth+" -"+gHeight+" M 0 0 z";

  var qe = [];   
  chromatograms.forEach(function(chr,chrIndex) {
   var PathStr = strBase + " M "+((minRt-xMin)*xScale)+" 0";
   for (var i in chr.rts) {
    var x = ((chr.rts[i]-xMin)*xScale);
    var y = (HML.config.displayChromatogramIntensitiesLogged ? Math.log10(chr.ints[i] || 1) : chr.ints[i])*yScale;
    PathStr += " L "+x+" -"+y;
   } 
   PathStr += " L "+((maxRt-xMin)*xScale)+" 0 z";
   var colours = colourlist.shift();
 
   var graphPath = new fabric.Path(PathStr, {
                                   globalCompositeOperation: "source-over",
                                   stroke: colours[0],
                                   fill: colours[1],
                                   opacity: 0.3,
                                   left: gLeft, 
                                   top: gTop,
                                   flipY: false,
                                   width: gWidth,
                                   height: gHeight,
                                   originX: "left",
                                   originY: "top"
                                  });
   g.add(graphPath);

   var quanteventPathStr = strBase + " M "+((chr.QERT-xMin)*xScale)+" -"+(Math.log10(chr.QEIntensity)*yScale)+" L "+((chr.QERT-xMin)*xScale)+" -"+(yMax*yScale);
   var quanteventPath = new fabric.Path(quanteventPathStr, {
                                   globalCompositeOperation: "source-over",
                                   stroke: "rgb(0,0,0)",
                                   left: gLeft, 
                                   top: gTop,
                                   flipY: false,
                                   width: gWidth,
                                   height: gHeight,
                                   originX: "left",
                                   originY: "top"
                                  });
   qe.push(quanteventPath);
   
   var txt = new fabric.Text(chr.Label+" ("+chr.QERT.toFixed(2)+")", {fill: colours[0], textAlign: "left", fontSize: labelFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+((chr.QERT-xMin)*xScale), top: gTop+gHeight-yMax*yScale-chrIndex*(labelheight+labelOffset), originX: "left", originY: "top"});
   txt.set({left: txt.left-(txt.height/2), top: txt.top-(txt.height/2), angle: -45});
   qe.push(txt);
  });
  qe.forEach(function(ele) {
   g.add(ele);
  });

  if (idrts != null && idrts.length) {
   idrts.forEach(function(idrt) {
    var idrtPathStr = strBase + " M "+((idrt-xMin)*xScale)+" 0 L "+((idrt-xMin)*xScale)+" -"+(yMax*yScale);
    var idrtPath = new fabric.Path(idrtPathStr, {
                                    globalCompositeOperation: "source-over",
                                    stroke: "rgb(255,0,0)",
                                    left: gLeft, 
                                    top: gTop,
                                    flipY: false,
                                    width: gWidth,
                                    height: gHeight,
                                    originX: "left",
                                    originY: "top"
                                   });
    g.add(idrtPath);
    var txt = new fabric.Text("ID ("+idrt.toFixed(2)+")", {fill: "rgb(255,0,0)", textAlign: "left", fontSize: labelFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+((idrt-xMin)*xScale), top: gTop+gHeight-yMax*yScale-2*(labelheight+labelOffset), originX: "left", originY: "top"});
    txt.set({left: txt.left-(txt.height/2), top: txt.top-(txt.height/2), angle: -45});
    g.add(txt);
   });
  }


  var xAxisStr = strBase + " M 0 0 ";
  for (var xt = 1; xt <= xTicks; xt++) {
   var x = ((xt*xTick)*xScale);
   if (xt) {
    xAxisStr += " L "+x+" 0 M "+x+" 0"
    if (xt < xTicks) {
     xAxisStr += "L "+x+" "+tickMarkerLength+" M "+x+" 0";
     var txt = new fabric.Text(((xt*xTick)+xMin).toFixed(xTickdp), {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+x, top: gTop+gHeight+tickMarkerLength, originX: "left", originY: "top"});
     txt.set({left: txt.left-(txt.width+txt.height)/2, top: txt.top+(txt.height+txt.width)/2, angle: -45});
     g.add(txt);
    }
   }
  }
  
  var xAxisPath = new fabric.Path(xAxisStr,{stroke:"black", left: gLeft, top: gTop, originX: "left", originY: "top"});
  g.add(xAxisPath);

  var yAxisStr = strBase + " M 0 0 L -"+tickMarkerLength+" 0 M 0 0";
  for (var yt = 0; yt <= yTicks; yt++) {
   var y = ((yt*yTick)*yScale);
   var yTickval = yt*yTick;
   var yTickvalLabel = (HML.config.displayChromatogramIntensitiesLogged ? Math.pow(10,yTickval).toExponential(0) : yTickval.toExponential(HML.config.displayYAxisDecimalPlaces));
   var txt = new fabric.Text(yTickvalLabel, {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft-20, top: gTop+gHeight-y, originX: "left", originY: "top"});
   txt.set({left: txt.left-txt.width-tickMarkerLength/5, top: txt.top-(txt.height/2)});
   g.add(txt);
   if (yt) {
    yAxisStr += " L 0 -"+y+" M 0 -"+y+" L -"+tickMarkerLength+" -"+y+" M 0 -"+y+"";
   }
  }
  var yAxisPath = new fabric.Path(yAxisStr,{stroke:"black", left: gLeft-tickMarkerLength, top: gTop, originX: "left", originY: "top"});
  g.add(yAxisPath);

  var xAxisTitle = new fabric.Text("Time", {textAlign: "center", fontSize: tickFontSize-2, fontFamily:HML.ui.fontFamily, left: gLeft+gWidth, top: gTop+gHeight, originX: "left", originY: "top"});
  xAxisTitle.set({top: xAxisTitle.top-(xAxisTitle.height/2), left: xAxisTitle.left+(xAxisTitle.height/2), fontStyle:"italic", fontWeight:"bold"});
  g.add(xAxisTitle);

  var yAxisTitle = new fabric.Text("Intensity", {textAlign: "center", fontSize: tickFontSize-2, fontFamily:HML.ui.fontFamily, left: gLeft, top: gTop, originX: "left", originY: "top"});
  yAxisTitle.set({top: yAxisTitle.top-(yAxisTitle.height/2), left: yAxisTitle.left-(yAxisTitle.height/2), fontStyle:"italic", fontWeight:"bold",angle:-90});
  g.add(yAxisTitle);

  return g;
 };

 var MS1FeatureSpectrum = function(feature,label,labelIndex) {

  var spectrum = new MSLIB.Data.Spectrum(
                      feature[8][labelIndex].spectrumMzs,
                      feature[8][labelIndex].spectrumInts
                     );
  var scaledSpectrum = new MSLIB.Data.Spectrum(
                             feature[8][labelIndex].scaledSpectrumMzs,
                             feature[8][labelIndex].scaledSpectrumInts
                            );
  var scaledSpectrumMinUsedInt = feature[8][labelIndex].scaledSpectrumMinUsedInt;
 
  var gWidth = 300;
  var gHeight = 200;
  var xlMar = 80;
  var xrMar = 40;
  var ytMar = 50;
  var ybMar = 60;
  var yTicks = 9;
  var labelOffset = 5;
  var labelFontSize = 12;
  var tickMarkerLength = 10;
  var tickFontSize = 12;
  var g = new fabric.Group([],{
   left: 0,
   top: 0,
   width: gWidth + xlMar + xrMar,
   height: gHeight + ytMar + ybMar,
   hasBorders: true,
   originX: "left",
   originY: "top"
  }); 

  var gLeft = -(g.width/2)+xlMar;
  var gTop = -(g.height/2)+ytMar;
  var minMz = spectrum.getMinMz();
  var maxMz = spectrum.getMaxMz();
  var xTick = 0.5;
  var xMin = Math.floor(minMz) - xTick;
  var xMax = Math.ceil(maxMz) + xTick;
  var xTicks = Math.ceil(Math.round(xMax-xMin)/xTick);
  var xScale = gWidth/(xMax-xMin);
  var maxInt = Math.max(spectrum.getMaxIntensity(),scaledSpectrum.getMaxIntensity());
  var yTick = (maxInt.toPrecision(1)/yTicks);
  if (maxInt && yTick) {
   while ((yTicks * yTick.toPrecision(2)) <= maxInt) {
    yTick = yTick*1.1;
   }
  }
  yTick = yTick.toPrecision(2);
  yTicks += 1;
  var yMax = yTicks * yTick;
  var yScale = gHeight/yMax;
  var strBase = "M 0 0 M "+gWidth+" -"+gHeight+" M 0 0 z";

  var propShaderPathStr = strBase;
  x = xTicks*xTick*xScale;
  y = scaledSpectrumMinUsedInt*yScale;
  propShaderPathStr += " L 0 -"+y+" L "+x+" -"+y+" L "+x+" 0 z";

  var propShaderPath = new fabric.Path(propShaderPathStr, {
                                  globalCompositeOperation: "source-over",
                                  stroke: false,
                                  fill: "rgba(60,60,60,0.1)",
                                  left: gLeft, 
                                  top: gTop,
                                  flipY: false,
                                  width: gWidth,
                                  height: gHeight,
                                  originX: "left",
                                  originY: "top"
                                 });
  g.add(propShaderPath);

  var scaledSpectrumPathStr = strBase;
  var mzLabels = [];
  for (var i in scaledSpectrum.mzs) {
   var err = MSLIB.Math.ppmError(scaledSpectrum.mzs[i],HML.config.ppmError);
   var xLow = ((scaledSpectrum.mzs[i]-err-xMin)*xScale);
   var xHi  = ((scaledSpectrum.mzs[i]+err-xMin)*xScale);
   var xTxt = ((scaledSpectrum.mzs[i]-xMin)*xScale);
   var yScaled = (scaledSpectrum.ints[i]*yScale);
   var yObs = (spectrum.ints[i]*yScale);
   scaledSpectrumPathStr += " M "+xLow+" 0 L "+xLow+" -"+yScaled+" L "+xHi+" -"+yScaled+" L "+xHi+" 0 L "+xLow+" 0 z";
   scaledSpectrumPathStr += " M "+(xLow-(gWidth/50))+" -"+yScaled+" L "+(xHi+(gWidth/50))+" -"+yScaled+" z";
   var txt = new fabric.Text(scaledSpectrum.mzs[i].toFixed(3), {textAlign: "left", fontSize: labelFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+xTxt, top: gTop+gHeight-Math.max(yScaled,yObs)-labelOffset, originX: "left", originY: "top"});
   txt.set({left: txt.left-(txt.height/2), top: txt.top-(txt.height/5), angle: -90});
   mzLabels.push(txt);
  } 
  var scaledSpectrumPath = new fabric.Path(scaledSpectrumPathStr, {
                                  globalCompositeOperation: "source-over",
                                  stroke: "rgb(255,0,0)", fill: "rgb(255,0,0)",
                                  left: gLeft, 
                                  top: gTop,
                                  flipY: false,
                                  width: gWidth,
                                  height: gHeight,
                                  originX: "left",
                                  originY: "top"
                                 });
  g.add(scaledSpectrumPath);
  mzLabels.forEach(function(l) {
   g.add(l);
  });

  var spectrumPathStr = strBase; 
  for (var i in spectrum.mzs) {
   var x = ((spectrum.mzs[i]-xMin)*xScale);
   var y = (spectrum.ints[i]*yScale);
   spectrumPathStr += " M "+x+" 0 L "+x+" -"+y+" z";
  } 
  var spectrumPath = new fabric.Path(spectrumPathStr, {
                                  globalCompositeOperation: "source-over",
                                  stroke: "rgb(0,0,0)",
                                  left: gLeft, 
                                  top: gTop,
                                  flipY: false,
                                  width: gWidth,
                                  height: gHeight,
                                  originX: "left",
                                  originY: "top"
                                 });
  g.add(spectrumPath);

  var xAxisStr = strBase + " M 0 0 ";
  var dt = 0;
  for (var xt = 0; xt <= xTicks; xt++) {
   var x = xt*xTick*xScale;
   if (dt) {
    var txt = new fabric.Text(((xt*xTick)+xMin).toFixed(0), {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+x, top: gTop+gHeight+tickMarkerLength, originX: "left", originY: "top"});
    txt.set({left: txt.left-(txt.width/2)});
    g.add(txt);
    dt = 0;
   }
   else {
    dt = 1;
   }
   if (xt) {
    xAxisStr += " L "+x+" 0 M "+x+" 0"
    if (xt < xTicks) xAxisStr += "L "+x+" "+tickMarkerLength+" M "+x+" 0";
   }
  }
  var xAxisPath = new fabric.Path(xAxisStr,{stroke:"black", left: gLeft, top: gTop, originX: "left", originY: "top"});
  g.add(xAxisPath);

  var yAxisStr = strBase + " M 0 0 L -"+tickMarkerLength+" 0 M 0 0";
  for (var yt = 0; yt <= yTicks; yt++) {
   var y = ((yt*yTick)*yScale);
   var txt = new fabric.Text((yt*yTick).toExponential(HML.config.displayYAxisDecimalPlaces), {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft-20, top: gTop+gHeight-y, originX: "left", originY: "top"});
   txt.set({left: txt.left-txt.width-tickMarkerLength/5, top: txt.top-(txt.height/2)});
   g.add(txt);
   if (yt) {
    yAxisStr += " L 0 -"+y+" M 0 -"+y+" L -"+tickMarkerLength+" -"+y+" M 0 -"+y+"";
   }
  }
  var yAxisPath = new fabric.Path(yAxisStr,{stroke:"black", left: gLeft-tickMarkerLength, top: gTop, originX: "left", originY: "top"});
  g.add(yAxisPath);

  var xAxisTitle = new fabric.Text("m/z", {textAlign: "center", fontSize: tickFontSize-2, fontFamily:HML.ui.fontFamily, left: gLeft+gWidth, top: gTop+gHeight, originX: "left", originY: "top"});
  xAxisTitle.set({top: xAxisTitle.top-(xAxisTitle.height/2), left: xAxisTitle.left+(xAxisTitle.height/2), fontStyle:"italic", fontWeight:"bold"});
  g.add(xAxisTitle);

  var yAxisTitle = new fabric.Text("Intensity", {textAlign: "center", fontSize: tickFontSize-2, fontFamily:HML.ui.fontFamily, left: gLeft, top: gTop, originX: "left", originY: "top"});
  yAxisTitle.set({top: yAxisTitle.top-(yAxisTitle.height/2), left: yAxisTitle.left-(yAxisTitle.height/2), fontStyle:"italic", fontWeight:"bold",angle:-90});
  g.add(yAxisTitle);

  var titleTxt = new fabric.Text("Label: "+label+" ("+feature[labelIndex*4+1]+"% ¹⁵N)   -   Score: "+feature[labelIndex*4+3].toFixed(4), {textAlign: "center", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+(xMax-xMin)/2*xScale, top: gTop+gHeight+tickMarkerLength*3, originX: "left", originY: "top"});
  titleTxt.set({left: titleTxt.left-(titleTxt.width/2)});
  g.add(titleTxt);
  var titleTxt2 = new fabric.Text("Isotopologue m/z windows \u00b1"+MSLIB.Math.ppmError(MSLIB.Math.mean(scaledSpectrum.mzs),HML.config.ppmError).toFixed(3), {textAlign: "center", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, fontStyle:"italic", left: gLeft+(xMax-xMin)/2*xScale, top: gTop+gHeight+tickMarkerLength*3+titleTxt.height, originX: "left", originY: "top"});
  titleTxt2.set({left: titleTxt2.left-(titleTxt2.width/2)});
  g.add(titleTxt2);

  return g;
 };

 var ProteinRatio = function(proteinQuant,files) {
  var gWidth = 500;
  var gHeight = 400;
  var xlMar = 80;
  var xrMar = 40;
  var ytMar = 90;
  var ybMar = 40;

  var labelOffset = 5;
  var labelFontSize = 15;
  var tickMarkerLength = 10;
  var tickFontSize = 12;
  var g = new fabric.Group([],{
   left: 0,
   top: 0,
   width: gWidth + xlMar + xrMar,
   height: gHeight + ytMar + ybMar,
   hasBorders: true,
   originX: "left",
   originY: "top"
  });

  var gLeft = -(g.width/2)+xlMar;
  var gTop = -(g.height/2)+ytMar;
  var xTick = 1;
  var xTicks = files.length+1;
  var xScale = gWidth/xTicks;

  var yTick = 0.5;
  var yMin = -0.5;
  var yMax = 0.5;

  var minRatio = Math.min.apply(null, files.map(file => Math.min.apply(null,proteinQuant[file].ratios.map(r=>r[1]).filter(n=>n!==null)))) || 0;
  var maxRatio = Math.max.apply(null, files.map(file => Math.max.apply(null,proteinQuant[file].ratios.map(r=>r[1]).filter(n=>n!==null)))) || 0;

  if (minRatio > 0) yMin = Math.min(Math.floor(MSLIB.Math.log2(minRatio)*2)/2,yMin);
  if (maxRatio > 0) yMax = Math.max(Math.ceil(MSLIB.Math.log2(maxRatio)*2)/2,yMax);

  var yTicks = (yMax-yMin)/yTick; 
  var yScale = gHeight/(yMax-yMin);

  files.forEach((file,i) => {
   proteinQuant[file].ratios.forEach(r => {
    if (r[1] === null) return;
    var y = ((MSLIB.Math.log2(r[1])-yMin)*yScale);
    var pepStr = r[0];
    if (pepStr.length >= 7) pepStr = pepStr.substr(0,5)+"..";
    var txt = new fabric.Text(pepStr, {textAlign: "left", fill:"lightgrey", fontSize: tickFontSize-2, fontFamily:HML.ui.fontFamily, left: gLeft+(i+1)*xScale, top: gTop+gHeight-y, originX: "center", originY: "center"});
    g.add(txt);
   });
   //median
   if (proteinQuant[file].ratioMedian === null) return;
   var y = ((MSLIB.Math.log2(proteinQuant[file].ratioMedian)-yMin)*yScale);
   var medianPoint = new fabric.Rect({width: 8,height: 8, fill:"black", left: gLeft+(i+1)*xScale, top: gTop+gHeight-y,originX: "center",originY: "center",angle: 45});
   g.add(medianPoint);
  });

  var strBase = "M 0 0 M "+gWidth+" -"+gHeight+" M 0 0 z";

  var xAxisStr = strBase + " M 0 "+(yMin*yScale);
  for (var xt = 1; xt <= xTicks; xt++) {
   var x = ((xt*xTick)*xScale);
   xAxisStr += " L "+x+" "+(yMin*yScale)+" M "+x+" "+(yMin*yScale);
   if (xt < xTicks) {
    var txt = new fabric.Text(files[xt-1], {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+x, top: gTop+gHeight+tickMarkerLength+(yMin*yScale), originX: "left", originY: "top"});
    txt.set({left: txt.left-(txt.width/2)});
    g.add(txt);
    xAxisStr += "L "+x+" "+(tickMarkerLength+(yMin*yScale))+" M "+x+" "+(yMin*yScale);
   }
  }
  var xAxisPath = new fabric.Path(xAxisStr,{stroke:"black", left: gLeft, top: gTop, originX: "left", originY: "top"});
  g.add(xAxisPath);

  var yAxisStr = strBase + " M 0 0 L -"+tickMarkerLength+" 0 M 0 0";
  for (var yt = 0; yt <= yTicks; yt++) {
   var y = ((yt*yTick)*yScale);
   var txt = new fabric.Text((yt*yTick+yMin).toFixed(1), {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft-20, top: gTop+gHeight-y, originX: "left", originY: "top"});
   txt.set({left: txt.left-txt.width-tickMarkerLength/5, top: txt.top-(txt.height/2)});
   g.add(txt);
   if (yt) {
    yAxisStr += " L 0 -"+y+" M 0 -"+y+" L -"+tickMarkerLength+" -"+y+" M 0 -"+y+"";
   }
  }
  var yAxisPath = new fabric.Path(yAxisStr,{stroke:"black", left: gLeft-tickMarkerLength, top: gTop, originX: "left", originY: "top"});
  g.add(yAxisPath);

  var titleTxt = new fabric.Text("Log2 Ratio (Unlabelled:Labelled)", {textAlign: "left", fill:"black", fontSize: tickFontSize+2, fontFamily:HML.ui.fontFamily, left: -(gWidth/2), top: -(gHeight/2), originX: "left", originY: "top", fontStyle:"italic", fontWeight:"bold"});
  g.add(titleTxt);
  return g;
 };

 var ProteinIncorp = function(proteinQuant,files) {
  var gWidth = 500;
  var gHeight = 400;
  var xlMar = 80;
  var xrMar = 40;
  var ytMar = 90;
  var ybMar = 40;

  var labelOffset = 5;
  var labelFontSize = 15;
  var tickMarkerLength = 10;
  var tickFontSize = 12;
  var g = new fabric.Group([],{
   left: 0,
   top: 0,
   width: gWidth + xlMar + xrMar,
   height: gHeight + ytMar + ybMar,
   hasBorders: true,
   originX: "left",
   originY: "top"
  });

  var gLeft = -(g.width/2)+xlMar;
  var gTop = -(g.height/2)+ytMar;
  var xTick = 1;
  var xTicks = files.length+1;
  var xScale = gWidth/xTicks;

  var yTick = 10; 

  var yMin = 0;
  var yMax = 100;

  var yTicks = (yMax-yMin)/yTick; 
  var yScale = gHeight/(yMax-yMin);

  files.forEach((file,i) => {
   proteinQuant[file].incorps.forEach(inc => {
    var labelInc = HML.config.labelledPeptidesOnly ? inc[1] : inc[2];
    if (labelInc !== null) {
     var y = labelInc*yScale;
     var pepStr = inc[0];
     if (pepStr.length >= 7) pepStr = pepStr.substr(0,5)+"..";
     var txt = new fabric.Text(pepStr, {textAlign: "left", fill:"lightgrey", fontSize: tickFontSize-2, fontFamily:HML.ui.fontFamily, left: gLeft+(i+1)*xScale, top: gTop+gHeight-y, originX: "center", originY: "center"});
     g.add(txt);
    }
   });
   var medianLabelIncorp = HML.config.labelledPeptidesOnly ? proteinQuant[file].incorpMedians[0] : proteinQuant[file].incorpMedians[1];
   if (medianLabelIncorp !== null) {   
    var y = medianLabelIncorp*yScale;
    var medianPoint = new fabric.Rect({width: 8,height: 8, fill:"black", left: gLeft+(i+1)*xScale, top: gTop+gHeight-y,originX: "center",originY: "center",angle: 45});
    g.add(medianPoint);
   }
  });

  var strBase = "M 0 0 M "+gWidth+" -"+gHeight+" M 0 0 z";

  var xAxisStr = strBase + " M 0 0";
  for (var xt = 1; xt <= xTicks; xt++) {
   var x = ((xt*xTick)*xScale);
   xAxisStr += " L "+x+" 0 M "+x+" 0";
   if (xt < xTicks) {
    var txt = new fabric.Text(files[xt-1], {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft+x, top: gTop+gHeight+tickMarkerLength+(yMin*yScale), originX: "left", originY: "top"});
    txt.set({left: txt.left-(txt.width/2)});
    g.add(txt);
    xAxisStr += "L "+x+" "+tickMarkerLength+" M "+x+" 0";
   }
  }
  var xAxisPath = new fabric.Path(xAxisStr,{stroke:"black", left: gLeft, top: gTop, originX: "left", originY: "top"});
  g.add(xAxisPath);

  var yAxisStr = strBase + " M 0 0 L -"+tickMarkerLength+" 0 M 0 0";
  for (var yt = 0; yt <= yTicks; yt++) {
   var y = ((yt*yTick)*yScale);
   var txt = new fabric.Text((yt*yTick).toFixed(0), {textAlign: "left", fontSize: tickFontSize, fontFamily:HML.ui.fontFamily, left: gLeft-20, top: gTop+gHeight-y, originX: "left", originY: "top"});
   txt.set({left: txt.left-txt.width-tickMarkerLength/5, top: txt.top-(txt.height/2)});
   g.add(txt);
   if (yt) {
    yAxisStr += " L 0 -"+y+" M 0 -"+y+" L -"+tickMarkerLength+" -"+y+" M 0 -"+y+"";
   }
  }
  var yAxisPath = new fabric.Path(yAxisStr,{stroke:"black", left: gLeft-tickMarkerLength, top: gTop, originX: "left", originY: "top"});
  g.add(yAxisPath);

  var titleTxt = new fabric.Text("Label Incorporation Level (%)", {textAlign: "left", fill:"black", fontSize: tickFontSize+2, fontFamily:HML.ui.fontFamily, left: -(gWidth/2), top: -(gHeight/2), originX: "left", originY: "top", fontStyle:"italic", fontWeight:"bold"});
  g.add(titleTxt);
  return g;
 }

 return {
  title : title,
  MS1FeatureRelAbundance : MS1FeatureRelAbundance,
  MS1FeatureChromatogram : MS1FeatureChromatogram,
  MS1FeatureSpectrum : MS1FeatureSpectrum,
  ProteinRatio : ProteinRatio,
  ProteinIncorp : ProteinIncorp
 }
}();