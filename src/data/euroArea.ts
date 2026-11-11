/** Euro-area members as of 2026, excluding any later accession that is not hardcoded here. */
export const EURO_AREA = [
  "AUT",
  "BEL",
  "CYP",
  "DEU",
  "ESP",
  "EST",
  "FIN",
  "FRA",
  "GRC",
  "HRV",
  "IRL",
  "ITA",
  "LTU",
  "LUX",
  "LVA",
  "MLT",
  "NLD",
  "PRT",
  "SVK",
  "SVN",
] as const;

export const ECB_ENDPOINT = {
  longitude: 8.6821,
  latitude: 50.1109,
  label: "European Central Bank, Frankfurt",
};

export const IMF_ENDPOINT = {
  longitude: -77.0369,
  latitude: 38.9072,
  label: "International Monetary Fund, Washington",
};
