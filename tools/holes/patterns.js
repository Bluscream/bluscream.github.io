/* DRILLFLOW PATTERN GENERATION ALGORITHMS */

const Patterns = {
  /**
   * Dispatches and generates relative hole points ({x, y} relative to local center) based on element config
   */
  generateHoles(el) {
    if (el.type === 'fan' && !el.includeGrill) return [];

    const d = parseFloat(el.holeSize) || 3.0;
    const p = parseFloat(el.pitch) || 6.0;
    const rot = parseFloat(el.grillRotation) || 0;
    const margin = parseFloat(el.grillMargin) !== undefined ? parseFloat(el.grillMargin) : 2.0;
    const pattern = el.pattern || 'hex';

    if (el.type === 'fan') {
      // Fan cutout area is always circular
      const fanSpec = FAN_TEMPLATES[el.fanSize];
      if (!fanSpec) return [];
      return this.generateCircleGrid(fanSpec.cutoutRadius, d, p, pattern, rot, margin);
    } else if (el.type === 'vent-rect') {
      const w = parseFloat(el.width) || 50;
      const h = parseFloat(el.height) || 50;
      return this.generateRectangleGrid(w, h, d, p, pattern, rot, margin);
    } else if (el.type === 'vent-circle') {
      const r = parseFloat(el.width) / 2 || 25; // using width as diameter for circular zones
      return this.generateCircleGrid(r, d, p, pattern, rot, margin);
    }

    return [];
  },

  /**
   * Generates grid points inside a rectangular boundary (centered at 0,0)
   */
  generateRectangleGrid(w, h, d, p, pattern, rotation, margin) {
    const points = [];
    const rad = d / 2;
    const limitX = w / 2 - margin;
    const limitY = h / 2 - margin;

    if (limitX <= 0 || limitY <= 0) return points;

    if (pattern === 'concentric') {
      // Concentric circles inside rectangle bounds: generate concentric grid up to max diagonal radius
      // and filter out points outside rectangular boundary
      const maxR = Math.sqrt(limitX * limitX + limitY * limitY);
      const tempPoints = this.generateConcentricGrid(maxR + p, d, p, rotation, 0);
      
      return tempPoints.filter(pt => {
        return Math.abs(pt.x) <= limitX - rad && Math.abs(pt.y) <= limitY - rad;
      });
    }

    // Straight Grid or Hex Grid
    const diagonal = Math.sqrt(w * w + h * h);
    const maxSpan = diagonal + p * 2;
    const colSpacing = p;
    const rowSpacing = pattern === 'hex' ? p * Math.sin(Math.PI / 3) : p;

    const cols = Math.ceil(maxSpan / colSpacing) + 2;
    const rows = Math.ceil(maxSpan / rowSpacing) + 2;

    const startX = -maxSpan / 2;
    const startY = -maxSpan / 2;

    const rotRad = (rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    for (let r = 0; r < rows; r++) {
      const y = startY + r * rowSpacing;
      // Stagger alternate rows in Hex layout
      const rowShift = (pattern === 'hex' && r % 2 !== 0) ? colSpacing / 2 : 0;

      for (let c = 0; c < cols; c++) {
        const x = startX + c * colSpacing + rowShift;

        // Apply grid rotation around (0,0)
        const rotX = x * cosR - y * sinR;
        const rotY = x * sinR + y * cosR;

        // Keep complete holes only (distance from boundaries >= radius)
        if (Math.abs(rotX) <= limitX - rad && Math.abs(rotY) <= limitY - rad) {
          points.push({ x: rotX, y: rotY });
        }
      }
    }

    return points;
  },

  /**
   * Generates grid points inside a circular boundary (centered at 0,0)
   */
  generateCircleGrid(radius, d, p, pattern, rotation, margin) {
    const points = [];
    const rad = d / 2;
    const limitR = radius - margin - rad;

    if (limitR <= 0) return points;

    if (pattern === 'concentric') {
      return this.generateConcentricGrid(radius, d, p, rotation, margin);
    }

    // Straight Grid or Hex Grid inside circular mask
    const maxSpan = radius * 2 + p * 2;
    const colSpacing = p;
    const rowSpacing = pattern === 'hex' ? p * Math.sin(Math.PI / 3) : p;

    const cols = Math.ceil(maxSpan / colSpacing) + 2;
    const rows = Math.ceil(maxSpan / rowSpacing) + 2;

    const startX = -maxSpan / 2;
    const startY = -maxSpan / 2;

    const rotRad = (rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    for (let r = 0; r < rows; r++) {
      const y = startY + r * rowSpacing;
      const rowShift = (pattern === 'hex' && r % 2 !== 0) ? colSpacing / 2 : 0;

      for (let c = 0; c < cols; c++) {
        const x = startX + c * colSpacing + rowShift;

        // Grid rotation
        const rotX = x * cosR - y * sinR;
        const rotY = x * sinR + y * cosR;

        // Keep complete holes only
        const dist = Math.sqrt(rotX * rotX + rotY * rotY);
        if (dist <= limitR) {
          points.push({ x: rotX, y: rotY });
        }
      }
    }

    return points;
  },

  /**
   * Generates concentric circle points (spiral arrangement)
   */
  generateConcentricGrid(radius, d, p, rotation, margin) {
    const points = [];
    const rad = d / 2;
    const limitR = radius - margin - rad;

    if (limitR <= 0) return points;

    // Optional center hole
    if (margin + rad <= radius) {
      points.push({ x: 0, y: 0 });
    }

    const rotRad = (rotation * Math.PI) / 180;
    let currentR = p;

    while (currentR <= limitR) {
      const circum = 2 * Math.PI * currentR;
      const count = Math.round(circum / p);

      if (count >= 1) {
        const angleStep = (2 * Math.PI) / count;
        for (let i = 0; i < count; i++) {
          const angle = i * angleStep + rotRad;
          points.push({
            x: currentR * Math.cos(angle),
            y: currentR * Math.sin(angle)
          });
        }
      }
      currentR += p;
    }

    return points;
  }
};
