/**
 * Dark navy SOC map style using CartoDB dark_matter raster tiles (no API key needed).
 * Uses MapLibre GL Style Spec v8.
 */
export const darkNavyStyle = {
  version: 8,
  name: 'VeLo Dark Navy',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#010a16' },
    },
    {
      id: 'carto-dark-tiles',
      type: 'raster',
      source: 'carto-dark',
      paint: {
        'raster-brightness-min': 0,
        'raster-brightness-max': 0.80,   // brighter for visible continent definition
        'raster-saturation': -0.1,        // minimal desaturation keeps more blue tone
        'raster-hue-rotate': 195,         // shift towards deep cyan-navy
        'raster-contrast': 0.18,          // stronger contrast: vivid ocean vs land
        'raster-opacity': 1,
      },
    },
  ],
}

/** Map initial options — centered on Atlantic to show full world map */
export const MAP_INIT = {
  center: [0, 20],    // Atlantic Ocean - shows full world
  zoom: 2,            // zoom level 2 = global view
  minZoom: 1.5,
  maxZoom: 16,
  attributionControl: false,
}
