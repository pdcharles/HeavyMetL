if (typeof HML == 'undefined') HML = {};

HML.modifications = {
  Carbamidomethyl : {
                      Carbon  : 2,
                      Hydrogen: 3,
                      Nitrogen: 1,
                      Oxygen  : 1
                    },
  Oxidation       : {
                      Oxygen  : 1
                    },
  Acetyl          : {
                      Carbon  : 2,
                      Hydrogen: 2,
                      Oxygen  : 1
                    },
  Deamidated      : {
                      Hydrogen: -1,
                      Nitrogen: -1,
                      Oxygen  : 1
                    }
}