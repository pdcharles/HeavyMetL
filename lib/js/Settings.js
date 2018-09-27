"use strict";

if (typeof HML == 'undefined') var HML = {};

//HML Config params shown in Settings dialog

HML.settings = [
 //key,label,description,force recalc
 ["fixedMods","Fixed Modifications","List of fixed modifications (comma or semicolon-separated). Format is \"Modification Name (Residue Single Letter)\" e.g. \"Carbamidomethyl (C)\"",true],
 ["ppmError","m/z Error Tolerance (ppm)","M/z window around theoretical m/z values in which to extract observed intensity.",true],
 ["rtSearchWindow","Retention Time Window (min)","Retention time window about observed/estimated peptide identification time in which to extract spectra.",true],
 ["rtMaxShift","Maximum Peak Apex Shift (min)","Maximum retention time shift to allow when searching for labelled signal apex relative to unlabelled signal apex (if one was found).",true],
 ["labelledPeptidesOnly","Do Not Quantify Unlabelled Signal","Do not quantify unlabelled signal, or correct for unlabelled signal presence when quantifying labelled signal.",true],
 ["incorporationWindowMin","Minimum Label Incorporation %","Minumum incorporation percentage tested when quantifying labelled signal.",true],
 ["incorporationWindowMax","Maximum Label Incorporation %","Maximum incorporation percentage tested when quantifying labelled signal.",true],
 ["peptideScoreThreshold","Peptide Match Score Threshold","Do not use peptides with Similarity Score below this value for protein-level quantitation.",false],
 ["displayChromatogramIntensitiesLogged","Show XICs on Log10 Scale","Show XIC y axis on log scale to accentuate chomatographic variation at peak boundaries. Affects displayed graphics only.",false],
 ["displayYAxisDecimalPlaces","Y-Axis Precision","Number of decimal places to show.  Affects displayed graphics only.",false],
]