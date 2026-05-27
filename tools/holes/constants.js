/* DRILLFLOW CONSTANTS & DEFAULT STATE */

// Standard computer fan dimensions and hole layouts in millimeters (mm)
const FAN_TEMPLATES = {
  40: {
    name: '40mm Fan',
    size: 40,
    mountingSpacing: 32, // Distance between screw holes center-to-center
    cutoutRadius: 19,    // Center circle airflow radius (38mm diameter)
    screwHoleRadius: 2.15 // Ø4.3mm screw hole size
  },
  60: {
    name: '60mm Fan',
    size: 60,
    mountingSpacing: 50, // 50x50mm spacing
    cutoutRadius: 29,    // 58mm diameter
    screwHoleRadius: 2.15
  },
  80: {
    name: '80mm Fan',
    size: 80,
    mountingSpacing: 71.5,
    cutoutRadius: 38.5,  // 77mm diameter
    screwHoleRadius: 2.15
  },
  92: {
    name: '92mm Fan',
    size: 92,
    mountingSpacing: 82.5,
    cutoutRadius: 44.5,  // 89mm diameter
    screwHoleRadius: 2.15
  },
  120: {
    name: '120mm Fan',
    size: 120,
    mountingSpacing: 105,
    cutoutRadius: 57.5,  // 115mm diameter
    screwHoleRadius: 2.15
  },
  140: {
    name: '140mm Fan',
    size: 140,
    mountingSpacing: 125,
    cutoutRadius: 67.5,  // 135mm diameter
    screwHoleRadius: 2.15
  },
  200: {
    name: '200mm Fan',
    size: 200,
    mountingSpacing: 154,
    cutoutRadius: 95,    // 190mm diameter
    screwHoleRadius: 2.25 // Ø4.5mm screw hole size
  }
};

// Initial app configurations & default layout state
const DEFAULT_STATE = {
  orientation: 'portrait',  // 'portrait' | 'landscape'
  safetyMargin: 10,         // mm
  showGrid: true,
  showRulers: true,
  printRulers: true,
  scaleX: 1.0000,           // Calibration multiplier for X
  scaleY: 1.0000,           // Calibration multiplier for Y
  elements: [
    {
      id: 'default-fan',
      type: 'fan',
      fanSize: 120,
      x: 105,               // mm (center of A4 page)
      y: 105,               // mm
      rotation: 0,          // degrees
      includeGrill: true,
      pattern: 'hex',
      holeShape: 'circle',
      holeSize: 3.5,
      pitch: 6.0,
      grillRotation: 0,
      grillMargin: 2
    },
    {
      id: 'default-vent',
      type: 'vent-rect',
      x: 105,
      y: 215,
      width: 140,
      height: 45,
      pattern: 'straight',
      holeShape: 'hexagon',
      holeSize: 4.0,
      pitch: 6.5,
      grillRotation: 15,
      grillMargin: 3
    }
  ],
  selectedElementId: 'default-fan'
};
