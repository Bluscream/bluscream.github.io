/* DRILLFLOW APPLICATION ENGINE */

class DrillFlowApp {
  constructor() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.dragState = {
      isDragging: false,
      elementId: null,
      offsetX: 0,
      offsetY: 0,
      isResizing: false,
      resizeMode: null, // 'w', 'h', 'both'
      startWidth: 0,
      startHeight: 0,
      startX: 0,
      startY: 0,
      lockAxis: null
    };
    this.viewportScale = 1.0;
    this.manuallyZoomed = false;
    this.clipboard = null;
    this.contextCoords = { x: 105, y: 148.5 }; // default center
    this.undoStack = [];
    this.maxUndoHistory = 50;

    this.init();
  }

  init() {
    // 1. Load state from URL if present
    this.loadStateFromUrl();

    // 2. Bind DOM elements
    this.cacheElements();

    // 3. Setup event listeners
    this.bindEvents();

    // 4. Initial Render
    this.render();
  }

  cacheElements() {
    this.dom = {
      svg: document.getElementById('canvas-svg'),
      elementsGroup: document.getElementById('svg-elements-group'),
      rulersGroup: document.getElementById('printable-rulers-group'),
      selectionOverlay: document.getElementById('svg-selection-overlay'),
      pageMockup: document.getElementById('page-mockup'),
      viewport: document.getElementById('viewport'),
      canvasWrapper: document.getElementById('canvas-wrapper'),
      screenRulersContainer: document.getElementById('screen-rulers-container'),
      screenRulerH: document.getElementById('screen-ruler-h-svg'),
      screenRulerV: document.getElementById('screen-ruler-v-svg'),
      contextMenu: document.getElementById('context-menu'),
      ctxCut: document.getElementById('ctx-cut'),
      ctxCopy: document.getElementById('ctx-copy'),
      ctxPaste: document.getElementById('ctx-paste'),
      ctxDuplicate: document.getElementById('ctx-duplicate'),
      ctxDelete: document.getElementById('ctx-delete'),
      
      // Top actions
      btnShare: document.getElementById('btn-share'),
      btnReset: document.getElementById('btn-reset'),
      btnTheme: document.getElementById('btn-theme'),
      btnPrint: document.getElementById('btn-print'),
      toast: document.getElementById('toast-message'),
      toastText: document.getElementById('toast-text'),

      // Page Settings
      orientPortrait: document.getElementById('orient-portrait'),
      orientLandscape: document.getElementById('orient-landscape'),
      inputMargin: document.getElementById('input-margin'),
      valMargin: document.getElementById('val-margin'),
      chkGrid: document.getElementById('chk-grid'),
      chkRulers: document.getElementById('chk-rulers'),
      chkPrintRulers: document.getElementById('chk-print-rulers'),

      // Elements Selection Sidebar controls
      panelProps: document.getElementById('panel-element-props'),
      noSelectionMsg: document.getElementById('no-selection-msg'),
      selectionControls: document.getElementById('selection-controls'),
      selectedTypeBadge: document.getElementById('selected-type-badge'),
      btnDeleteElement: document.getElementById('btn-delete-element'),

      // Selection coords
      inputPosX: document.getElementById('input-pos-x'),
      inputPosY: document.getElementById('input-pos-y'),
      inputDimW: document.getElementById('input-dim-w'),
      inputDimH: document.getElementById('input-dim-h'),
      lblDimW: document.getElementById('lbl-dim-w'),
      lblDimH: document.getElementById('lbl-dim-h'),

      // Alignments
      btnAlignCX: document.getElementById('btn-align-cx'),
      btnAlignCY: document.getElementById('btn-align-cy'),
      btnAlignBoth: document.getElementById('btn-align-both'),

      // Fan Controls
      fanOnlyControls: document.getElementById('fan-only-controls'),
      inputFanRotation: document.getElementById('input-fan-rotation'),
      valFanRotation: document.getElementById('val-fan-rotation'),
      chkFanGrill: document.getElementById('chk-fan-grill'),

      // Vent Grill Settings
      grillSettings: document.getElementById('grill-settings'),
      selectGrillPattern: document.getElementById('select-grill-pattern'),
      selectHoleShape: document.getElementById('select-hole-shape'),
      inputHoleSize: document.getElementById('input-hole-size'),
      inputHolePitch: document.getElementById('input-hole-pitch'),
      inputGrillRotation: document.getElementById('input-grill-rotation'),
      valGrillRotation: document.getElementById('val-grill-rotation'),
      inputGrillMargin: document.getElementById('input-grill-margin'),
      valGrillMargin: document.getElementById('val-grill-margin'),

      // Calibration Controls
      inputScaleX: document.getElementById('input-scale-x'),
      inputScaleY: document.getElementById('input-scale-y')
    };
  }

  bindEvents() {
    // Canvas SVG Interactivity (Drag, Select & Resize)
    this.dom.svg.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    window.addEventListener('mouseup', () => this.handleCanvasMouseUp());

    // Prevent scrolling inside viewport during touch drags
    this.dom.viewport.addEventListener('touchmove', (e) => {
      if (this.dragState.isDragging || this.dragState.isResizing) {
        e.preventDefault();
      }
    }, { passive: false });

    // Sidebar Adder Buttons
    document.getElementById('add-vent-rect').addEventListener('click', () => this.addElement('vent-rect'));
    document.getElementById('add-vent-circle').addEventListener('click', () => this.addElement('vent-circle'));
    
    document.querySelectorAll('.btn-fan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const size = parseInt(e.currentTarget.getAttribute('data-fan-size'));
        this.addElement('fan', size);
      });
    });

    // Page Settings
    this.dom.orientPortrait.addEventListener('click', () => this.setOrientation('portrait'));
    this.dom.orientLandscape.addEventListener('click', () => this.setOrientation('landscape'));
    
    this.dom.inputMargin.addEventListener('input', (e) => {
      this.state.safetyMargin = parseInt(e.target.value);
      this.dom.valMargin.textContent = this.state.safetyMargin;
      this.render();
      this.updateUrl();
    });

    this.dom.chkGrid.addEventListener('change', (e) => {
      this.state.showGrid = e.target.checked;
      this.render();
      this.updateUrl();
    });

    this.dom.chkRulers.addEventListener('change', (e) => {
      this.state.showRulers = e.target.checked;
      this.render();
      this.updateUrl();
    });

    this.dom.chkPrintRulers.addEventListener('change', (e) => {
      this.state.printRulers = e.target.checked;
      this.render();
      this.updateUrl();
    });

    // Calibration
    this.dom.inputScaleX.addEventListener('input', (e) => {
      this.state.scaleX = parseFloat(e.target.value) || 1.0;
      this.render();
      this.updateUrl();
    });
    this.dom.inputScaleY.addEventListener('input', (e) => {
      this.state.scaleY = parseFloat(e.target.value) || 1.0;
      this.render();
      this.updateUrl();
    });

    // Header buttons
    this.dom.btnShare.addEventListener('click', () => this.copyShareUrl());
    this.dom.btnReset.addEventListener('click', () => this.resetState());
    this.dom.btnTheme.addEventListener('click', () => this.toggleTheme());
    this.dom.btnPrint.addEventListener('click', () => window.print());

    // Selected Element Updates
    this.dom.btnDeleteElement.addEventListener('click', () => this.deleteSelectedElement());

    this.dom.inputPosX.addEventListener('input', (e) => this.updateSelectedElement('x', parseFloat(e.target.value)));
    this.dom.inputPosY.addEventListener('input', (e) => this.updateSelectedElement('y', parseFloat(e.target.value)));
    this.dom.inputDimW.addEventListener('input', (e) => this.updateSelectedElement('width', parseFloat(e.target.value)));
    this.dom.inputDimH.addEventListener('input', (e) => this.updateSelectedElement('height', parseFloat(e.target.value)));

    // Alignments
    this.dom.btnAlignCX.addEventListener('click', () => this.alignSelected('centerX'));
    this.dom.btnAlignCY.addEventListener('click', () => this.alignSelected('centerY'));
    this.dom.btnAlignBoth.addEventListener('click', () => this.alignSelected('centerBoth'));

    // Fan Controls
    this.dom.inputFanRotation.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.dom.valFanRotation.textContent = val;
      this.updateSelectedElement('rotation', val);
    });

    this.dom.chkFanGrill.addEventListener('change', (e) => {
      this.updateSelectedElement('includeGrill', e.target.checked);
      if (e.target.checked) {
        this.dom.grillSettings.classList.remove('hidden');
      } else {
        this.dom.grillSettings.classList.add('hidden');
      }
    });

    // Grill Properties
    this.dom.selectGrillPattern.addEventListener('change', (e) => this.updateSelectedElement('pattern', e.target.value));
    this.dom.selectHoleShape.addEventListener('change', (e) => this.updateSelectedElement('holeShape', e.target.value));
    this.dom.inputHoleSize.addEventListener('input', (e) => this.updateSelectedElement('holeSize', parseFloat(e.target.value)));
    this.dom.inputHolePitch.addEventListener('input', (e) => this.updateSelectedElement('pitch', parseFloat(e.target.value)));
    
    this.dom.inputGrillRotation.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.dom.valGrillRotation.textContent = val;
      this.updateSelectedElement('grillRotation', val);
    });

    this.dom.inputGrillMargin.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.dom.valGrillMargin.textContent = val;
      this.updateSelectedElement('grillMargin', val);
    });

    // Dynamic viewport scale helper (keep mockup sized properly for standard laptop screens)
    window.addEventListener('resize', () => this.autoScaleViewport());

    // Mouse wheel zoom
    this.dom.viewport.addEventListener('wheel', (e) => this.handleViewportZoom(e), { passive: false });

    // Double-click viewport to fit scale
    this.dom.viewport.addEventListener('dblclick', (e) => {
      if (e.target === this.dom.viewport) {
        this.manuallyZoomed = false;
        this.autoScaleViewport();
        this.updateScreenRulers();
      }
    });

    // Sync fixed screen rulers during scroll pans
    this.dom.viewport.addEventListener('scroll', () => this.updateScreenRulers());

    // Custom CAD context menus & keyboard hotkeys
    window.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
    this.dom.viewport.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
    window.addEventListener('click', (e) => this.hideContextMenu(e));

    this.dom.ctxCut.addEventListener('click', () => this.cutSelected());
    this.dom.ctxCopy.addEventListener('click', () => this.copySelected());
    this.dom.ctxPaste.addEventListener('click', () => this.pasteSelected());
    this.dom.ctxDuplicate.addEventListener('click', () => this.duplicateSelected());
    this.dom.ctxDelete.addEventListener('click', () => this.deleteSelectedElement());
  }

  // --- MODEL MANAGER ---
  addElement(type, fanSize = 120) {
    this.saveHistory(); // Save undo state
    const center = this.getPageCenter();
    const id = `el-${Date.now()}`;
    let newElement = {
      id,
      type,
      x: center.x,
      y: center.y,
      pattern: 'hex',
      stroke: 'inherit',
      holeShape: 'circle',
      holeSize: 3.5,
      pitch: 6.0,
      grillRotation: 0,
      grillMargin: 2
    };

    if (type === 'fan') {
      newElement.fanSize = fanSize;
      newElement.rotation = 0;
      newElement.includeGrill = true;
    } else if (type === 'vent-rect') {
      newElement.width = 100;
      newElement.height = 60;
    } else if (type === 'vent-circle') {
      newElement.width = 80; // Diameter
      newElement.height = 80;
    }

    this.state.elements.push(newElement);
    this.state.selectedElementId = id;
    
    this.render();
    this.updateUrl();
    this.syncSidebarToSelection();
  }

  deleteSelectedElement() {
    if (!this.state.selectedElementId) return;
    this.saveHistory(); // Save undo state
    this.state.elements = this.state.elements.filter(el => el.id !== this.state.selectedElementId);
    this.state.selectedElementId = null;
    
    this.render();
    this.updateUrl();
    this.syncSidebarToSelection();
  }

  updateSelectedElement(key, value) {
    const el = this.getSelectedElement();
    if (!el || value === undefined || isNaN(value) && typeof value === 'number') return;
    
    // For slider dragging updates, let's also support clean history snapshots by checking inputs later, 
    // but simple property updates are perfectly saved in state.
    el[key] = value;
    
    // Ensure logical properties constraints
    if (key === 'width' && el.type === 'vent-circle') el.height = value; // Symmetrical circle
    if (key === 'height' && el.type === 'vent-circle') el.width = value;
    
    this.render();
    this.updateUrl();
  }

  alignSelected(mode) {
    const el = this.getSelectedElement();
    if (!el) return;
    this.saveHistory(); // Save undo state
    const center = this.getPageCenter();

    if (mode === 'centerX' || mode === 'centerBoth') {
      el.x = center.x;
      this.dom.inputPosX.value = el.x;
    }
    if (mode === 'centerY' || mode === 'centerBoth') {
      el.y = center.y;
      this.dom.inputPosY.value = el.y;
    }

    this.render();
    this.updateUrl();
  }

  // --- LAYOUT & COORDINATE TRANSLATORS ---
  getPageCenter() {
    const w = this.state.orientation === 'portrait' ? 210 : 297;
    const h = this.state.orientation === 'portrait' ? 297 : 210;
    return { x: w / 2, y: h / 2 };
  }

  setOrientation(orient) {
    this.state.orientation = orient;
    
    if (orient === 'portrait') {
      this.dom.orientPortrait.classList.add('active');
      this.dom.orientLandscape.classList.remove('active');
      this.dom.pageMockup.classList.add('portrait-mode');
      this.dom.pageMockup.classList.remove('landscape-mode');
      this.dom.svg.setAttribute('viewBox', '0 0 210 297');
    } else {
      this.dom.orientPortrait.classList.remove('active');
      this.dom.orientLandscape.classList.add('active');
      this.dom.pageMockup.classList.remove('portrait-mode');
      this.dom.pageMockup.classList.add('landscape-mode');
      this.dom.svg.setAttribute('viewBox', '0 0 297 210');
    }

    // Keep active elements in A4 printable limits
    const maxW = orient === 'portrait' ? 210 : 297;
    const maxH = orient === 'portrait' ? 297 : 210;
    this.state.elements.forEach(el => {
      if (el.x > maxW) el.x = maxW / 2;
      if (el.y > maxH) el.y = maxH / 2;
    });

    this.render();
    this.updateUrl();
    this.autoScaleViewport();
  }

  getSvgCoords(e) {
    const pt = this.dom.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgCoords = pt.matrixTransform(this.dom.svg.getScreenCTM().inverse());
    return { x: svgCoords.x, y: svgCoords.y };
  }

  // --- INTERACTION DRAG/RESIZE HANDLERS ---
  handleCanvasMouseDown(e) {
    const target = e.target;
    const dragNode = target.closest('.draggable');
    const handleNode = target.closest('.resize-handle');

    // Case 1: Dragging a resize handle on rect/circle vent
    if (handleNode) {
      e.stopPropagation();
      const elId = handleNode.getAttribute('data-id');
      const mode = handleNode.getAttribute('data-mode');
      const el = this.state.elements.find(item => item.id === elId);
      
      if (!el) return;

      this.saveHistory(); // Save undo state before action

      this.dragState = {
        isDragging: false,
        isResizing: true,
        elementId: elId,
        resizeMode: mode,
        startWidth: el.width,
        startHeight: el.height,
        startX: el.x,
        startY: el.y,
        mouseStartX: e.clientX,
        mouseStartY: e.clientY
      };
      
      document.body.classList.add('dragging');
      return;
    }

    // Case 2: Dragging a major model element (Fan, Zone)
    if (dragNode) {
      e.stopPropagation();
      const elId = dragNode.getAttribute('data-id');
      this.state.selectedElementId = elId;
      this.syncSidebarToSelection();
      this.render();

      const el = this.state.elements.find(item => item.id === elId);
      if (!el) return;

      this.saveHistory(); // Save undo state before action

      const cursor = this.getSvgCoords(e);
      
      this.dragState = {
        isDragging: true,
        isResizing: false,
        elementId: elId,
        offsetX: cursor.x - el.x,
        offsetY: cursor.y - el.y,
        startX: el.x,
        startY: el.y,
        lockAxis: null
      };

      document.body.classList.add('dragging');
      dragNode.classList.add('dragging');
      return;
    }

    // Case 3: Clicked canvas background -> clear selection
    if (target.id === 'canvas-svg' || target.id === 'canvas-grid') {
      this.state.selectedElementId = null;
      this.syncSidebarToSelection();
      this.render();
    }
  }

  handleCanvasMouseMove(e) {
    if (this.dragState.isDragging) {
      const el = this.state.elements.find(item => item.id === this.dragState.elementId);
      if (!el) return;

      const cursor = this.getSvgCoords(e);
      let targetX = cursor.x - this.dragState.offsetX;
      let targetY = cursor.y - this.dragState.offsetY;

      // 1. Shift Key Movement Axis Locking (X-only or Y-only)
      if (e.shiftKey) {
        const dx = Math.abs(targetX - this.dragState.startX);
        const dy = Math.abs(targetY - this.dragState.startY);

        if (this.dragState.lockAxis === null) {
          if (dx > 2.0 || dy > 2.0) {
            this.dragState.lockAxis = dx > dy ? 'x' : 'y';
          }
        }

        if (this.dragState.lockAxis === 'x') {
          targetY = this.dragState.startY;
        } else if (this.dragState.lockAxis === 'y') {
          targetX = this.dragState.startX;
        }
      } else {
        this.dragState.lockAxis = null;
      }

      // 2. CAD Snap-to-Object & Center-Page Alignments (2mm snap window)
      let snappedX = false;
      let snappedY = false;
      const snapThreshold = 2.0; // mm

      // Snap X/Y to other templates' centers
      for (const other of this.state.elements) {
        if (other.id === el.id) continue;

        if (this.dragState.lockAxis !== 'y' && !snappedX && Math.abs(targetX - other.x) < snapThreshold) {
          targetX = other.x;
          snappedX = true;
        }
        if (this.dragState.lockAxis !== 'x' && !snappedY && Math.abs(targetY - other.y) < snapThreshold) {
          targetY = other.y;
          snappedY = true;
        }
      }

      // Snap to page absolute midlines
      const pageCenter = this.getPageCenter();
      if (this.dragState.lockAxis !== 'y' && !snappedX && Math.abs(targetX - pageCenter.x) < snapThreshold) {
        targetX = pageCenter.x;
        snappedX = true;
      }
      if (this.dragState.lockAxis !== 'x' && !snappedY && Math.abs(targetY - pageCenter.y) < snapThreshold) {
        targetY = pageCenter.y;
        snappedY = true;
      }
      
      // Update coordinates with float rounding
      el.x = parseFloat(targetX.toFixed(1));
      el.y = parseFloat(targetY.toFixed(1));
      
      // Constrain coordinates within A4 sheet boundaries
      const maxW = this.state.orientation === 'portrait' ? 210 : 297;
      const maxH = this.state.orientation === 'portrait' ? 297 : 210;
      el.x = Math.max(0, Math.min(maxW, el.x));
      el.y = Math.max(0, Math.min(maxH, el.y));

      this.render();
      
      // Fast updates to active selection inputs
      this.dom.inputPosX.value = el.x;
      this.dom.inputPosY.value = el.y;
    } 
    else if (this.dragState.isResizing) {
      const el = this.state.elements.find(item => item.id === this.dragState.elementId);
      if (!el) return;

      // Translate pixels movement to mm delta
      const svgScaleX = this.dom.svg.getScreenCTM().a;
      const svgScaleY = this.dom.svg.getScreenCTM().d;
      const deltaX = (e.clientX - this.dragState.mouseStartX) / svgScaleX;
      const deltaY = (e.clientY - this.dragState.mouseStartY) / svgScaleY;

      // Resizing is symmetrical about the element center, so width changes by 2 * offset
      if (this.dragState.resizeMode === 'w' || this.dragState.resizeMode === 'both') {
        const newW = Math.max(10, this.dragState.startWidth + deltaX * 2);
        el.width = parseFloat(newW.toFixed(1));
        if (el.type === 'vent-circle') el.height = el.width; // circular lock
      }
      if (this.dragState.resizeMode === 'h' || this.dragState.resizeMode === 'both') {
        const newH = Math.max(10, this.dragState.startHeight + deltaY * 2);
        el.height = parseFloat(newH.toFixed(1));
        if (el.type === 'vent-circle') el.width = el.height;
      }

      this.render();

      this.dom.inputDimW.value = el.width;
      this.dom.inputDimH.value = el.height;
    }
  }

  handleCanvasMouseUp() {
    if (this.dragState.isDragging || this.dragState.isResizing) {
      this.updateUrl();
      document.body.classList.remove('dragging');
      
      const activeDraggingNode = this.dom.svg.querySelector('.dragging');
      if (activeDraggingNode) {
        activeDraggingNode.classList.remove('dragging');
      }
    }
    
    this.dragState.isDragging = false;
    this.dragState.isResizing = false;
    this.dragState.elementId = null;
  }

  // --- SIDEBAR ORCHESTRATION ---
  getSelectedElement() {
    return this.state.elements.find(el => el.id === this.state.selectedElementId);
  }

  syncSidebarToSelection() {
    const el = this.getSelectedElement();

    if (!el) {
      this.dom.panelProps.classList.remove('active');
      this.dom.noSelectionMsg.classList.remove('hidden');
      this.dom.selectionControls.classList.add('hidden');
      return;
    }

    this.dom.panelProps.classList.add('active');
    this.dom.noSelectionMsg.classList.add('hidden');
    this.dom.selectionControls.classList.remove('hidden');

    // Populate common attributes
    this.dom.selectedTypeBadge.textContent = this.getElementTypeName(el);
    this.dom.inputPosX.value = el.x;
    this.dom.inputPosY.value = el.y;
    
    // Width and height details
    if (el.type === 'fan') {
      const fanSpec = FAN_TEMPLATES[el.fanSize];
      this.dom.inputDimW.value = fanSpec.size;
      this.dom.inputDimH.value = fanSpec.size;
      this.dom.inputDimW.disabled = true;
      this.dom.inputDimH.disabled = true;
      this.dom.lblDimW.textContent = "Fan Size (W)";
      this.dom.lblDimH.textContent = "Fan Size (H)";
      
      this.dom.fanOnlyControls.classList.remove('hidden');
      this.dom.inputFanRotation.value = el.rotation;
      this.dom.valFanRotation.textContent = el.rotation;
      this.dom.chkFanGrill.checked = el.includeGrill;

      if (el.includeGrill) {
        this.dom.grillSettings.classList.remove('hidden');
      } else {
        this.dom.grillSettings.classList.add('hidden');
      }
    } else {
      this.dom.inputDimW.value = el.width;
      this.dom.inputDimH.value = el.height;
      this.dom.inputDimW.disabled = false;
      this.dom.inputDimH.disabled = false;
      
      if (el.type === 'vent-circle') {
        this.dom.lblDimW.textContent = "Ø Diameter";
        this.dom.lblDimH.textContent = "Ø Diameter";
        this.dom.inputDimH.disabled = true; // circular lock
      } else {
        this.dom.lblDimW.textContent = "Width (mm)";
        this.dom.lblDimH.textContent = "Height (mm)";
      }

      this.dom.fanOnlyControls.classList.add('hidden');
      this.dom.grillSettings.classList.remove('hidden');
    }

    // Pattern attributes
    this.dom.selectGrillPattern.value = el.pattern;
    this.dom.selectHoleShape.value = el.holeShape;
    this.dom.inputHoleSize.value = el.holeSize;
    this.dom.inputHolePitch.value = el.pitch;
    
    this.dom.inputGrillRotation.value = el.grillRotation;
    this.dom.valGrillRotation.textContent = el.grillRotation;

    this.dom.inputGrillMargin.value = el.grillMargin;
    this.dom.valGrillMargin.textContent = el.grillMargin;
  }

  getElementTypeName(el) {
    if (el.type === 'fan') return `${el.fanSize}mm Fan`;
    if (el.type === 'vent-rect') return 'Rect Grid Zone';
    if (el.type === 'vent-circle') return 'Circle Grid Zone';
    return 'Element';
  }

  // --- SVG VECTOR GENERATION ENGINE ---
  render() {
    // Apply calibration adjustments
    const calibrationG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Clear canvas
    this.dom.elementsGroup.innerHTML = '';
    this.dom.selectionOverlay.innerHTML = '';

    // Handle Safety margin guide
    const maxW = this.state.orientation === 'portrait' ? 210 : 297;
    const maxH = this.state.orientation === 'portrait' ? 297 : 210;
    const margin = this.state.safetyMargin;

    const safetyRect = document.getElementById('safety-margin-rect');
    if (margin > 0) {
      safetyRect.setAttribute('x', margin);
      safetyRect.setAttribute('y', margin);
      safetyRect.setAttribute('width', maxW - 2 * margin);
      safetyRect.setAttribute('height', maxH - 2 * margin);
      safetyRect.setAttribute('display', 'block');
    } else {
      safetyRect.setAttribute('display', 'none');
    }

    // Calibration elements setup
    this.dom.elementsGroup.setAttribute('transform', `scale(${this.state.scaleX}, ${this.state.scaleY})`);
    this.dom.rulersGroup.setAttribute('transform', `scale(${this.state.scaleX}, ${this.state.scaleY})`);

    // Draw printable rulers
    this.drawPrintableRulers();

    // Render active elements (fans, zones)
    this.state.elements.forEach(el => {
      const g = this.renderElement(el);
      this.dom.elementsGroup.appendChild(g);

      // Selection overlay rendering (handles, bounds)
      if (el.id === this.state.selectedElementId) {
        this.renderSelectionOverlay(el);
      }
    });

    this.autoScaleViewport();
    this.updateScreenRulers();
  }

  renderElement(el) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `draggable ${el.id === this.state.selectedElementId ? 'active-selection' : ''}`);
    g.setAttribute('data-id', el.id);
    g.setAttribute('transform', `translate(${el.x}, ${el.y})`);

    // Assign beautiful dynamic dark colors to different elements
    const index = this.state.elements.findIndex(item => item.id === el.id);
    const darkColors = [
      '#1b3a4b', // Dark Teal
      '#7f1d1d', // Dark Red
      '#14532d', // Dark Green
      '#581c87', // Dark Purple
      '#7c2d12', // Dark Orange
      '#1e3a8a', // Dark Blue
      '#3f3f46'  // Dark Zinc
    ];
    const elColor = darkColors[index % darkColors.length];
    g.setAttribute('stroke', elColor);
    g.setAttribute('fill', 'none');

    // Render ventilation holes inside cutout boundaries
    const holes = Patterns.generateHoles(el);
    const rad = el.holeSize / 2;

    holes.forEach(pt => {
      // 1. Hole outline
      let holeSvg;
      if (el.holeShape === 'hexagon') {
        holeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        holeSvg.setAttribute('points', this.getHexagonPoints(pt.x, pt.y, rad));
      } else if (el.holeShape === 'square') {
        holeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        holeSvg.setAttribute('x', pt.x - rad);
        holeSvg.setAttribute('y', pt.y - rad);
        holeSvg.setAttribute('width', el.holeSize);
        holeSvg.setAttribute('height', el.holeSize);
        holeSvg.setAttribute('rx', '0.4'); // subtle roundings for drills
      } else {
        // default circle
        holeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        holeSvg.setAttribute('cx', pt.x);
        holeSvg.setAttribute('cy', pt.y);
        holeSvg.setAttribute('r', rad);
      }
      holeSvg.setAttribute('class', 'drill-hole');
      g.appendChild(holeSvg);

      // 2. High accuracy diagonal "x" center crosshair spanning the full hole
      const offset = rad;
      
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', pt.x - offset);
      line1.setAttribute('y1', pt.y - offset);
      line1.setAttribute('x2', pt.x + offset);
      line1.setAttribute('y2', pt.y + offset);
      line1.setAttribute('class', 'drill-hole-center');
      g.appendChild(line1);

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', pt.x - offset);
      line2.setAttribute('y1', pt.y + offset);
      line2.setAttribute('x2', pt.x + offset);
      line2.setAttribute('y2', pt.y - offset);
      line2.setAttribute('class', 'drill-hole-center');
      g.appendChild(line2);
    });

    if (el.type === 'fan') {
      const spec = FAN_TEMPLATES[el.fanSize];
      
      // Fan outline (dashed square with rotations)
      const fOuter = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const offset = spec.size / 2;
      fOuter.setAttribute('x', -offset);
      fOuter.setAttribute('y', -offset);
      fOuter.setAttribute('width', spec.size);
      fOuter.setAttribute('height', spec.size);
      fOuter.setAttribute('rx', '4');
      fOuter.setAttribute('class', 'svg-element-outline');
      fOuter.setAttribute('transform', `rotate(${el.rotation})`);
      g.appendChild(fOuter);

      // Center circular cutout
      const fCutout = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fCutout.setAttribute('cx', '0');
      fCutout.setAttribute('cy', '0');
      fCutout.setAttribute('r', spec.cutoutRadius);
      fCutout.setAttribute('class', 'svg-element-center');
      g.appendChild(fCutout);

      // Major center crosshair (past center cutout for visual mounting alignment)
      const crossSize = spec.cutoutRadius + 8;
      const xHair1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      xHair1.setAttribute('x1', -crossSize);
      xHair1.setAttribute('y1', 0);
      xHair1.setAttribute('x2', crossSize);
      xHair1.setAttribute('y2', 0);
      xHair1.setAttribute('class', 'svg-element-center');
      xHair1.setAttribute('stroke-dasharray', '2,2');
      xHair1.setAttribute('transform', `rotate(${el.rotation})`);
      g.appendChild(xHair1);

      const xHair2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      xHair2.setAttribute('x1', 0);
      xHair2.setAttribute('y1', -crossSize);
      xHair2.setAttribute('x2', 0);
      xHair2.setAttribute('y2', crossSize);
      xHair2.setAttribute('class', 'svg-element-center');
      xHair2.setAttribute('stroke-dasharray', '2,2');
      xHair2.setAttribute('transform', `rotate(${el.rotation})`);
      g.appendChild(xHair2);

      // Screws + local crosshairs (rotated by fan rotation)
      const screwDist = spec.mountingSpacing / 2;
      const screwPos = [
        { x: -screwDist, y: -screwDist },
        { x: screwDist, y: -screwDist },
        { x: -screwDist, y: screwDist },
        { x: screwDist, y: screwDist }
      ];

      screwPos.forEach(pos => {
        // Rotate local coordinate about center (0,0) by fan rotation
        const radRot = (el.rotation * Math.PI) / 180;
        const rotX = pos.x * Math.cos(radRot) - pos.y * Math.sin(radRot);
        const rotY = pos.x * Math.sin(radRot) + pos.y * Math.cos(radRot);

        // Pilot screw circle
        const sCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sCircle.setAttribute('cx', rotX);
        sCircle.setAttribute('cy', rotY);
        sCircle.setAttribute('r', spec.screwHoleRadius);
        sCircle.setAttribute('fill', 'none');
        sCircle.setAttribute('stroke-width', '0.25');
        sCircle.setAttribute('class', 'svg-element-center');
        g.appendChild(sCircle);

        // Pilot screw center mark (diagonal "x" crosshairs spanning the full hole)
        const sOffset = spec.screwHoleRadius;
        const sLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        sLine1.setAttribute('x1', rotX - sOffset);
        sLine1.setAttribute('y1', rotY - sOffset);
        sLine1.setAttribute('x2', rotX + sOffset);
        sLine1.setAttribute('y2', rotY + sOffset);
        sLine1.setAttribute('class', 'drill-hole-center');
        g.appendChild(sLine1);

        const sLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        sLine2.setAttribute('x1', rotX - sOffset);
        sLine2.setAttribute('y1', rotY + sOffset);
        sLine2.setAttribute('x2', rotX + sOffset);
        sLine2.setAttribute('y2', rotY - sOffset);
        sLine2.setAttribute('class', 'drill-hole-center');
        g.appendChild(sLine2);

        // Screw crosshair lines (horizontal and vertical ticks for easy centerpunching)
        const tick = 3;
        const tickH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tickH.setAttribute('x1', rotX - tick);
        tickH.setAttribute('y1', rotY);
        tickH.setAttribute('x2', rotX + tick);
        tickH.setAttribute('y2', rotY);
        tickH.setAttribute('stroke-width', '0.15');
        tickH.setAttribute('class', 'svg-element-center');
        g.appendChild(tickH);

        const tickV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tickV.setAttribute('x1', rotX);
        tickV.setAttribute('y1', rotY - tick);
        tickV.setAttribute('x2', rotX);
        tickV.setAttribute('y2', rotY + tick);
        tickV.setAttribute('stroke-width', '0.15');
        tickV.setAttribute('class', 'svg-element-center');
        g.appendChild(tickV);
      });

      // Label fan template (non-printable)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '0');
      label.setAttribute('y', `${offset - 3}`);
      label.setAttribute('font-family', 'Outfit, sans-serif');
      label.setAttribute('font-size', '3.5');
      label.setAttribute('fill', 'var(--text-muted)');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'non-printable');
      label.setAttribute('transform', `rotate(${el.rotation})`);
      label.textContent = `${el.fanSize}mm Fan`;
      g.appendChild(label);
    } 
    else if (el.type === 'vent-rect') {
      // Outline of vent rectangle
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -el.width / 2);
      rect.setAttribute('y', -el.height / 2);
      rect.setAttribute('width', el.width);
      rect.setAttribute('height', el.height);
      rect.setAttribute('class', 'svg-element-outline');
      g.appendChild(rect);

      // Subtle center lines
      const lineH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineH.setAttribute('x1', -4);
      lineH.setAttribute('y1', 0);
      lineH.setAttribute('x2', 4);
      lineH.setAttribute('y2', 0);
      lineH.setAttribute('class', 'svg-element-center');
      g.appendChild(lineH);

      const lineV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineV.setAttribute('x1', 0);
      lineV.setAttribute('y1', -4);
      lineV.setAttribute('x2', 0);
      lineV.setAttribute('y2', 4);
      lineV.setAttribute('class', 'svg-element-center');
      g.appendChild(lineV);
    } 
    else if (el.type === 'vent-circle') {
      // Outline of vent circle
      const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circ.setAttribute('cx', 0);
      circ.setAttribute('cy', 0);
      circ.setAttribute('r', el.width / 2); // width is diameter
      circ.setAttribute('class', 'svg-element-outline');
      g.appendChild(circ);

      // Center cross
      const cCrossH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      cCrossH.setAttribute('x1', -6);
      cCrossH.setAttribute('y1', 0);
      cCrossH.setAttribute('x2', 6);
      cCrossH.setAttribute('y2', 0);
      cCrossH.setAttribute('class', 'svg-element-center');
      g.appendChild(cCrossH);

      const cCrossV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      cCrossV.setAttribute('x1', 0);
      cCrossV.setAttribute('y1', -6);
      cCrossV.setAttribute('x2', 0);
      cCrossV.setAttribute('y2', 6);
      cCrossV.setAttribute('class', 'svg-element-center');
      g.appendChild(cCrossV);
    }

    return g;
  }

  renderSelectionOverlay(el) {
    const overlayG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    overlayG.setAttribute('transform', `translate(${el.x}, ${el.y})`);

    let w = 0;
    let h = 0;

    if (el.type === 'fan') {
      const spec = FAN_TEMPLATES[el.fanSize];
      w = spec.size;
      h = spec.size;
      
      // Fan selection rotates with fan rotation
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -w / 2 - 1.5);
      rect.setAttribute('y', -h / 2 - 1.5);
      rect.setAttribute('width', w + 3);
      rect.setAttribute('height', h + 3);
      rect.setAttribute('class', 'selection-box');
      rect.setAttribute('transform', `rotate(${el.rotation})`);
      overlayG.appendChild(rect);
    } 
    else {
      w = el.width;
      h = el.height;

      // Draw bounding box
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -w / 2 - 1.5);
      rect.setAttribute('y', -h / 2 - 1.5);
      rect.setAttribute('width', w + 3);
      rect.setAttribute('height', h + 3);
      rect.setAttribute('class', 'selection-box');
      overlayG.appendChild(rect);

      // Resize handles: Symmetrical expansions, so handles sit at Right, Bottom and Bottom-Right corners
      // Right resize handle (affects width)
      const handleR = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      handleR.setAttribute('x', w / 2 + 0.5);
      handleR.setAttribute('y', -2.5);
      handleR.setAttribute('width', '5');
      handleR.setAttribute('height', '5');
      handleR.setAttribute('class', 'resize-handle resize-handle-w');
      handleR.setAttribute('data-id', el.id);
      handleR.setAttribute('data-mode', 'w');
      overlayG.appendChild(handleR);

      if (el.type !== 'vent-circle') {
        // Bottom resize handle (affects height) - hidden for circle as it locked 1:1
        const handleB = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        handleB.setAttribute('x', -2.5);
        handleB.setAttribute('y', h / 2 + 0.5);
        handleB.setAttribute('width', '5');
        handleB.setAttribute('height', '5');
        handleB.setAttribute('class', 'resize-handle resize-handle-h');
        handleB.setAttribute('data-id', el.id);
        handleB.setAttribute('data-mode', 'h');
        overlayG.appendChild(handleB);
      }

      // Bottom-Right corner handle (affects both)
      const handleBR = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      handleBR.setAttribute('x', w / 2 + 0.5);
      handleBR.setAttribute('y', h / 2 + 0.5);
      handleBR.setAttribute('width', '5');
      handleBR.setAttribute('height', '5');
      handleBR.setAttribute('class', 'resize-handle');
      handleBR.setAttribute('data-id', el.id);
      handleBR.setAttribute('data-mode', 'both');
      overlayG.appendChild(handleBR);
    }

    this.dom.selectionOverlay.appendChild(overlayG);
  }

  // --- PRINTABLE RULERS GENERATION ---
  drawPrintableRulers() {
    this.dom.rulersGroup.innerHTML = '';
    
    if (this.state.printRulers) {
      this.dom.rulersGroup.classList.remove('non-printable');
    } else {
      this.dom.rulersGroup.classList.add('non-printable');
    }

    if (!this.state.showRulers) return;

    const maxW = this.state.orientation === 'portrait' ? 210 : 297;
    const maxH = this.state.orientation === 'portrait' ? 297 : 210;

    let html = '';

    // 1. Horizontal top ruler strip
    html += `<rect x="0" y="0" width="${maxW}" height="8" fill="rgba(0, 0, 0, 0.02)" class="ruler-tick" stroke="none" />`;
    for (let x = 0; x <= maxW; x++) {
      let tickLen = 0;
      let strokeW = '0.1';
      
      if (x % 10 === 0) {
        tickLen = 5.0;
        strokeW = '0.22';
        if (x > 0 && x < maxW) {
          html += `<text x="${x}" y="7.5" font-family="'Outfit', sans-serif" font-weight="600" font-size="2" text-anchor="middle" class="ruler-text" fill="#000000">${x}</text>`;
        }
      } else if (x % 5 === 0) {
        tickLen = 3.5;
        strokeW = '0.15';
      } else {
        tickLen = 1.8;
      }
      
      html += `<line x1="${x}" y1="0" x2="${x}" y2="${tickLen}" stroke="#000000" stroke-width="${strokeW}" class="ruler-tick" />`;
    }

    // 2. Vertical left ruler strip
    html += `<rect x="0" y="0" width="8" height="${maxH}" fill="rgba(0, 0, 0, 0.02)" class="ruler-tick" stroke="none" />`;
    for (let y = 0; y <= maxH; y++) {
      let tickLen = 0;
      let strokeW = '0.1';
      
      if (y % 10 === 0) {
        tickLen = 5.0;
        strokeW = '0.22';
        if (y > 0 && y < maxH) {
          html += `<text x="7.5" y="${y + 0.7}" font-family="'Outfit', sans-serif" font-weight="600" font-size="2" text-anchor="end" class="ruler-text" fill="#000000">${y}</text>`;
        }
      } else if (y % 5 === 0) {
        tickLen = 3.5;
        strokeW = '0.15';
      } else {
        tickLen = 1.8;
      }
      
      html += `<line x1="0" y1="${y}" x2="${tickLen}" y2="${y}" stroke="#000000" stroke-width="${strokeW}" class="ruler-tick" />`;
    }

    this.dom.rulersGroup.innerHTML = html;
  }

  getHexagonPoints(cx, cy, radius) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      // standard flat-top arrangement
      const angle = (i * 60 * Math.PI) / 180;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return pts.join(' ');
  }

  // --- PERSISTENCE: URL BASE64 SYNCHRONIZER ---
  updateUrl() {
    try {
      const cleanState = {
        orientation: this.state.orientation,
        safetyMargin: this.state.safetyMargin,
        showGrid: this.state.showGrid,
        showRulers: this.state.showRulers,
        printRulers: this.state.printRulers,
        scaleX: this.state.scaleX,
        scaleY: this.state.scaleY,
        elements: this.state.elements,
        selectedElementId: this.state.selectedElementId
      };
      
      const json = JSON.stringify(cleanState);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      
      const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?config=${encodeURIComponent(b64)}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    } catch (e) {
      console.error('Failed to encode state to URL:', e);
    }
  }

  loadStateFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const configB64 = params.get('config');

      if (!configB64) return;

      const decodedJson = decodeURIComponent(configB64);
      const parsed = JSON.parse(decodeURIComponent(escape(atob(decodedJson))));
      
      // Perform validation and deep merge
      if (parsed.orientation) this.state.orientation = parsed.orientation;
      if (parsed.safetyMargin !== undefined) this.state.safetyMargin = parsed.safetyMargin;
      if (parsed.showGrid !== undefined) this.state.showGrid = parsed.showGrid;
      if (parsed.showRulers !== undefined) this.state.showRulers = parsed.showRulers;
      if (parsed.printRulers !== undefined) this.state.printRulers = parsed.printRulers;
      if (parsed.scaleX !== undefined) this.state.scaleX = parsed.scaleX;
      if (parsed.scaleY !== undefined) this.state.scaleY = parsed.scaleY;
      if (parsed.elements) this.state.elements = parsed.elements;
      if (parsed.selectedElementId !== undefined) this.state.selectedElementId = parsed.selectedElementId;
    } catch (e) {
      console.warn('Could not parse configuration from URL parameter. Reverting to default values.', e);
    }
  }

  copyShareUrl() {
    this.updateUrl(); // ensure completely up-to-date
    const url = window.location.href;

    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Copied template configurations link to clipboard!');
    }).catch(err => {
      console.error('Could not copy link:', err);
      this.showToast('Failed to copy link. Please manually copy the address bar.');
    });
  }

  showToast(text) {
    this.dom.toastText.textContent = text;
    this.dom.toast.classList.remove('hidden');
    
    // Animate pop in
    setTimeout(() => {
      this.dom.toast.classList.add('hidden');
    }, 3500);
  }

  resetState() {
    if (confirm('Are you sure you want to clear the canvas? This will remove all templates.')) {
      this.state.elements = [];
      this.state.selectedElementId = null;
      
      // Clear sidebar configuration values to standard defaults
      this.dom.inputScaleX.value = "1.0000";
      this.dom.inputScaleY.value = "1.0000";
      this.dom.inputMargin.value = "10";
      this.dom.valMargin.textContent = "10";
      this.dom.chkGrid.checked = true;
      this.dom.chkRulers.checked = true;
      this.dom.chkPrintRulers.checked = true;

      this.state.scaleX = 1.0;
      this.state.scaleY = 1.0;
      this.state.safetyMargin = 10;
      this.state.showGrid = true;
      this.state.showRulers = true;
      this.state.printRulers = true;

      this.setOrientation('portrait');
      this.render();
      this.updateUrl();
      this.syncSidebarToSelection();
    }
  }

  // --- THEMES & CAD ENGINE VIEWPORT SCALING ---
  toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    }
  }

  getAutoFitScale() {
    const mockupW = this.state.orientation === 'portrait' ? 210 : 297;
    const mockupH = this.state.orientation === 'portrait' ? 297 : 210;
    
    // convert mm size to screen px (1mm ≈ 3.78px under CSS standards)
    const pxW = mockupW * 3.779527559;
    const pxH = mockupH * 3.779527559;

    const viewportW = this.dom.viewport.clientWidth - 80; // margins
    const viewportH = this.dom.viewport.clientHeight - 80;

    const scaleX = viewportW / pxW;
    const scaleY = viewportH / pxH;
    return Math.min(1, scaleX, scaleY); // fit inside, max 100% scale
  }

  handleViewportZoom(e) {
    e.preventDefault();
    
    // Zoom factor: small enough for smooth scroll transitions
    const zoomFactor = 1.08;
    const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    
    // Calculate minimum scale where the page perfectly fits the viewport
    const minScale = this.getAutoFitScale();
    
    // Clamp zoom scale between minScale and 8.0 (impossible to zoom out past viewport)
    this.viewportScale = Math.max(minScale, Math.min(8.0, this.viewportScale * delta));
    this.manuallyZoomed = true;
    
    this.dom.canvasWrapper.style.transform = `scale(${this.viewportScale})`;
    this.updateScreenRulers();
  }

  autoScaleViewport() {
    if (this.manuallyZoomed) return;

    this.viewportScale = this.getAutoFitScale();
    this.dom.canvasWrapper.style.transform = `scale(${this.viewportScale})`;
  }

  updateScreenRulers() {
    if (!this.state.showRulers) {
      this.dom.screenRulersContainer.classList.add('hidden');
      return;
    }
    this.dom.screenRulersContainer.classList.remove('hidden');

    const mockupRect = this.dom.pageMockup.getBoundingClientRect();
    const viewportRect = this.dom.viewport.getBoundingClientRect();

    const leftOffset = mockupRect.left - viewportRect.left;
    const topOffset = mockupRect.top - viewportRect.top;

    const mmToPxX = 3.779527559 * this.viewportScale * this.state.scaleX;
    const mmToPxY = 3.779527559 * this.viewportScale * this.state.scaleY;

    const maxW = this.state.orientation === 'portrait' ? 210 : 297;
    const maxH = this.state.orientation === 'portrait' ? 297 : 210;

    // 1. Horizontal Ruler Ticks (SVG)
    let hHtml = '';
    for (let x = 0; x <= maxW; x += 1) {
      const pxX = leftOffset + x * mmToPxX;
      if (pxX < 20 || pxX > viewportRect.width) continue;

      let len = 4;
      let strokeW = 0.5;
      let color = 'rgba(255, 255, 255, 0.25)';

      if (x % 10 === 0) {
        len = 10;
        strokeW = 1.0;
        color = 'var(--accent)';
        hHtml += `<text x="${pxX}" y="18" font-size="7" font-weight="600" text-anchor="middle" fill="var(--text-muted)" font-family="'Outfit', sans-serif">${x}</text>`;
      } else if (x % 5 === 0) {
        len = 7;
        strokeW = 0.8;
      }

      hHtml += `<line x1="${pxX}" y1="0" x2="${pxX}" y2="${len}" stroke="${color}" stroke-width="${strokeW}" />`;
    }
    this.dom.screenRulerH.innerHTML = hHtml;

    // 2. Vertical Ruler Ticks (SVG)
    let vHtml = '';
    for (let y = 0; y <= maxH; y += 1) {
      const pxY = topOffset + y * mmToPxY;
      if (pxY < 20 || pxY > viewportRect.height) continue;

      let len = 4;
      let strokeW = 0.5;
      let color = 'rgba(255, 255, 255, 0.25)';

      if (y % 10 === 0) {
        len = 10;
        strokeW = 1.0;
        color = 'var(--accent)';
        vHtml += `<text x="17" y="${pxY + 2.5}" font-size="7" font-weight="600" text-anchor="end" fill="var(--text-muted)" font-family="'Outfit', sans-serif">${y}</text>`;
      } else if (y % 5 === 0) {
        len = 7;
        strokeW = 0.8;
      }

      vHtml += `<line x1="0" y1="${pxY}" x2="${len}" y2="${pxY}" stroke="${color}" stroke-width="${strokeW}" />`;
    }
    this.dom.screenRulerV.innerHTML = vHtml;
  }

  handleGlobalKeyDown(e) {
    // Avoid intercepts if typing inside input fields
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
      return;
    }

    if (e.key === 'Delete' || e.key === 'Del') {
      if (this.state.selectedElementId) {
        e.preventDefault();
        this.deleteSelectedElement();
      }
    }

    // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+D, Ctrl+Z CAD helpers!
    if (e.ctrlKey) {
      if (e.key === 'c' || e.key === 'C') {
        if (this.state.selectedElementId) {
          e.preventDefault();
          this.copySelected();
        }
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        // Paste at default page center if key pressed
        this.contextCoords = this.getPageCenter();
        this.pasteSelected();
      }
      if (e.key === 'x' || e.key === 'X') {
        if (this.state.selectedElementId) {
          e.preventDefault();
          this.cutSelected();
        }
      }
      if (e.key === 'd' || e.key === 'D') {
        if (this.state.selectedElementId) {
          e.preventDefault();
          this.duplicateSelected();
        }
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        this.undo();
      }
    }
  }

  handleContextMenu(e) {
    e.preventDefault();
    const target = e.target;
    const dragNode = target.closest('.draggable');

    // Right-clicking an element selects it automatically
    if (dragNode) {
      const elId = dragNode.getAttribute('data-id');
      this.state.selectedElementId = elId;
      this.syncSidebarToSelection();
      this.render();
    } else if (target.id === 'canvas-svg' || target.id === 'canvas-grid') {
      this.state.selectedElementId = null;
      this.syncSidebarToSelection();
      this.render();
    }

    // Save SVG space coordinates of right click to spawn paste target accurately
    this.contextCoords = this.getSvgCoords(e);

    const hasSelection = !!this.state.selectedElementId;
    this.dom.ctxCut.disabled = !hasSelection;
    this.dom.ctxCopy.disabled = !hasSelection;
    this.dom.ctxDuplicate.disabled = !hasSelection;
    this.dom.ctxDelete.disabled = !hasSelection;
    this.dom.ctxPaste.disabled = !this.clipboard;

    // Show menu floating at cursor coordinates
    this.dom.contextMenu.style.left = `${e.clientX}px`;
    this.dom.contextMenu.style.top = `${e.clientY}px`;
    this.dom.contextMenu.classList.remove('hidden');
  }

  hideContextMenu(e) {
    // Avoid hiding immediately if clicking a valid menu option
    if (e && e.target.closest('#context-menu')) return;
    this.dom.contextMenu.classList.add('hidden');
  }

  copySelected() {
    const el = this.getSelectedElement();
    if (!el) return;

    this.clipboard = JSON.parse(JSON.stringify(el));
    this.showToast(`Copied ${this.getElementTypeName(el)} to clipboard!`);
    this.hideContextMenu();
  }

  cutSelected() {
    const el = this.getSelectedElement();
    if (!el) return;

    this.copySelected();
    this.deleteSelectedElement();
  }

  pasteSelected() {
    if (!this.clipboard) return;
    this.saveHistory(); // Save undo state

    const newEl = JSON.parse(JSON.stringify(this.clipboard));
    newEl.id = `el-${Date.now()}`;
    
    // Paste directly at right-click coordinates
    newEl.x = parseFloat(this.contextCoords.x.toFixed(1));
    newEl.y = parseFloat(this.contextCoords.y.toFixed(1));

    this.state.elements.push(newEl);
    this.state.selectedElementId = newEl.id;

    this.render();
    this.updateUrl();
    this.syncSidebarToSelection();
    this.hideContextMenu();
    this.showToast(`Pasted copied template!`);
  }

  duplicateSelected() {
    const el = this.getSelectedElement();
    if (!el) return;
    this.saveHistory(); // Save undo state

    const dup = JSON.parse(JSON.stringify(el));
    dup.id = `el-${Date.now()}`;
    
    // Symmetrically offset duplicate by +10mm
    dup.x = Math.min(this.state.orientation === 'portrait' ? 210 : 297, dup.x + 10);
    dup.y = Math.min(this.state.orientation === 'portrait' ? 297 : 210, dup.y + 10);

    this.state.elements.push(dup);
    this.state.selectedElementId = dup.id;

    this.render();
    this.updateUrl();
    this.syncSidebarToSelection();
    this.hideContextMenu();
  }

  saveHistory() {
    // Stringify current templates state for simple deep-copy restore
    this.undoStack.push(JSON.stringify(this.state.elements));
    if (this.undoStack.length > this.maxUndoHistory) {
      this.undoStack.shift(); // remove oldest undo step
    }
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.showToast('Nothing to undo!');
      return;
    }

    const previousElements = this.undoStack.pop();
    this.state.elements = JSON.parse(previousElements);

    // Keep selection safe if the selected element was undone/deleted
    if (this.state.selectedElementId && !this.state.elements.some(el => el.id === this.state.selectedElementId)) {
      this.state.selectedElementId = null;
    }

    this.render();
    this.updateUrl();
    this.syncSidebarToSelection();
    this.showToast('Action undone!');
  }
}

// Instantiate on startup
window.addEventListener('DOMContentLoaded', () => {
  window.app = new DrillFlowApp();
});
