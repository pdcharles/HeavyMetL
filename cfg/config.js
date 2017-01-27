if (typeof HML == 'undefined') HML = {};

HML.Config = {
 //Basic Options (Visible in Settings)
 FixedMods : "Carbamidomethyl (C)", //assume these modifications are on all matching residues (mods are defined in Modifications.js) 
 PpmError : 5, //lowering this can increase performance (and quant quality if data is high resolution and good mass accuracy)
 RTSearchWindow  : 0.5, //lowering this increases performance but may result in missing the peak if chromatographic reproducibility is low (mins)
 RTMaxShift  : 0.05, //max distance between light and heavy peak apex (mins).  Zero means heavy peak will always be measured at light peak apex
 RTOrder  : 0, //should the heavy peak elute before (-1) or after (1) the light peak.  Zero disables this constraint.
 IncorporationWindowMin : 10, //lowest % incorporation to look for
 IncorporationWindowMax : 100, //highest % incorporation to look for
 DisplayChromatogramIntensitiesLogged : false, //whether to show the chromatogram intensities on a log10 scale
 DisplayYAxisDecimalPlaces : 2,

 //Advanced Options (Hidden from Settings)
 _MatchScoreThreshold : 0.85, //Distribution of scores shows a fairly sharp elbow at 0.85
 _ExcludeLowerMassLabelMassesFromMatching : true,
 _FindMaxIntensityByLowestIsotopologue : true, //locate peak apex using the lowest intensity isotopologue in each scan to calculate the intensity of the full distribution (makes algorithm more robust vs co-elution)
 _ConsiderIsotopologuesInTop : 0.7, //what proportion of the distribution to consider when locating peak apexes (setting to 1 will include low proportion isotopologues and will in most cases increase noise & decrease quant quality).  Also used to define the mass range of the unlabelled feature not considered in the labelled feature quantation step.
 _QuantitationThreads : 8, //best set to the number of logical processors (allowing for hyperthreading).  Lower numbers underutilise resources and higher numbers will waste time with context switching.
 _RawFileMaxBlockProcessSize : Math.pow(2,27), //String length limit is (2^28)-1 in Firefox and (2^28)-(2^4) in Chrome.  N.B. Safari has a limit of (2^31)-1 but Safari is not a currently targeted browser.  If processing Thermo Raw Files (and therefore using ArrayBuffers not strings) the memory limit is potentially much larger.  The default of 2^27 avoids some memory-related stability issues at higher numbers.
}
