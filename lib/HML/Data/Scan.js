"use strict";

if (typeof HML == 'undefined') var HML = {};
if (typeof HML.Data == 'undefined') HML.Data = {};

HML.Data.Scan = function() {

 var Scan = function() {
  this.ScanNumber           = 0;
  this.MsLevel              = 0;
  this.Centroided           = 0;
  this.RetentionTime        = 0;
  this.LowMz                = 0;
  this.HighMz               = 0;
  this.TotalCurrent         = 0;
  this.BasePeakMz           = 0;
  this.BasePeakIntensity    = 0;
  this.PrecursorMz          = [];
  this.PrecursorIntensities = [];
  this.PrecursorCharges     = [];
  this.ActivationMethod     = 0;
  this.CompressionType      = [];
  this.BinaryDataPrecision  = [];
  this.BinaryDataLength     = [];
  this.BinaryDataOffset     = [];
  this.BinaryDataID         = [];
  this.HzConversionParams   = [];
  this.SpectrumData         = {};
 };

 return Scan;

}();