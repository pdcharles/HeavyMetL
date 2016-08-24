if (typeof HML == 'undefined') HML = {};

HML.Config = {
 FixedMods : "Carbamidomethyl (C)", //assume these modifications are on all matching residues (mods are defined in Modifications.js) 
 PpmError : 10, //lowering this can increase performance (and quant quality if data is high resolution and good mass accuracy)
 RTSearchWindow  : 1, //lowering this increases performance but may result in missing the peak if chromatographic reproducibility is low
 RTMaxShift  : 0.1, //max distance between light and heavy peak apex
 RTOrder  : -1, //should the heavy peak elute before (-1) or after (1) the light peak.  0 is no constraint
 IncorporationWindowMin : 10, //lowest % incorporation to look for
 IncorporationWindowMax : 100, //highest % incorporation to look for
 _FindMaxIntensityByLowestIsotopologue : true, //locate peak apex using the lowest intensity isotopologue in each scan to calculate the intensity of the full distribution (makes algorithm more robust vs co-elution)
 _ConsiderIsotopologuesInTop : 0.8, //what proportion of the distribution to consider when locating peak apexes (setting to 1 will include low proportion isotopologues and will in most cases increase noise & decrease quant quality) 
 _QuantitationThreads : 8, //best set to the number of cores (allowing for hyperthreading).  Lower numbers underutilise resources and higher numbers will waste time with context switching.
 _RawFileMaxBlockProcessSize : Math.pow(2,27), //String length limit is (2^28)-1 in Firefox and (2^28)-(2^4) in Chrome.  N.B. Safari has a limit of (2^31)-1 but Safari is not a currently targeted browser.  If processing Thermo Raw Files (and therefore using ArrayBuffers not strings) this is potentially much larger.
}
