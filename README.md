# FX Watch

Photorealistic globe for country, regional, and global macro monitoring. Each country view has three layers: economic indicators, bilateral swap lines plus IMF credit outstanding, and a transparent currency-crisis early-warning score.

The globe uses keyless Esri World Imagery. Indicator history comes from the World Bank API. Swap sizes are a sourced registry, and drawings stay blank unless a publisher names the amount.

```bash
npm install
npm run fetch-data
npm test
npm run dev
```

`fetch-data` rewrites `public/dashboard.json` and `public/geo/countries.geojson`.
