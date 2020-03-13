if (typeof HML == 'undefined') HML = {};

HML.config = {
 //Basic Options (Visible in Settings)
 fixedMods : "Carbamidomethyl (C)", //assume these modifications are on all matching residues (mods are defined in modifications.js) 
 ppmError : 10, //lowering this can increase performance (and quant quality, but only if data is high resolution and has good mass accuracy)
 rtSearchWindow  : 0.5, //lowering this increases performance but may result in missing the peak if chromatographic reproducibility is low (mins)
 rtMaxShift : 0.2, //inter-peak max gap (mins).  Zero means labelled peak will always be measured at unlabelled peak apex
 labelledPeptidesOnly : false,
 incorporationWindowMin : 10, //lowest % incorporation to look for
 incorporationWindowMax : 95, //highest % incorporation to look for
 peptideScoreThreshold : 0.85,
 displayChromatogramIntensitiesLogged : false, //whether to show the chromatogram intensities on a log10 scale
 displayYAxisDecimalPlaces : 2,


 //Advanced Options (Hidden from Settings)
 _incorpStepSize: 1, //what increments of incorporation to test for (default 1, i.e. 1%, 2%, 3% etc)
 _rtOrder : 0, //should the heavy peak elute before (-1) or after (1) the light peak.  Zero disables this constraint.
 _findMaxIntensityByLowestIsotopologue : true, //locate peak apex using the lowest intensity isotopologue in each scan to calculate the intensity of the full distribution (makes algorithm more robust vs co-elution)
 _considerIsotopologuesInTop : 0.7, //what proportion of the distribution to consider when locating peak apexes (setting to 1 will include low proportion isotopologues and will in most cases increase noise & decrease quant quality).  Also used to define the mass range of the unlabelled feature not considered in the labelled feature quantation step.
 _quantitationThreads : 8, //best set to the number of logical processors (allowing for hyperthreading).  Lower numbers underutilise resources and higher numbers will waste time with context switching.
 _rawFileMaxBlockProcessSize : Math.pow(2,28)-Math.pow(2,4), //String length limit is (2^28)-1 in Firefox and (2^28)-(2^4) in Chrome.  N.B. Safari has a limit of (2^31)-1 but Safari is not a currently targeted browser.  If processing Thermo Raw Files (and therefore using ArrayBuffers not strings) the memory limit is potentially much larger.  Setting value to 2^27 or lower may avoid some memory-related stability issues (though these seem to have been fixed in recent browser versions).
 //!!Experimental!!:
 _unlabelledIncorporationWindowMin : 0.368, //Equivalent of incorporationWindowMin for the unlabelled channel. Default 0.368
 _unlabelledIncorporationWindowMax : 0.368 //Equivalent of incorporationWindowMax for the unlabelled channel. Default 0.368
}