/* Escenario three.js compartido por las tres herramientas.
   Fondo transparente (se ve el blanco de la página), sombras suaves y una órbita propia:
   con ratón se arrastra en las dos direcciones; en pantallas táctiles solo en horizontal,
   para que el gesto vertical siga desplazando la página, y con dos dedos se acerca o aleja.
   Solo dibuja cuando algo cambia. */
(function () {
  function Stage(canvas, opts) {
    opts = opts || {};
    var THREE = window.THREE;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputEncoding' in this.renderer) this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 0.1, opts.far || 5000);
    this.target = new THREE.Vector3().fromArray(opts.target || [0, 0, 0]);
    this.radius = opts.radius || 40;
    this.azimuth = opts.azimuth == null ? -0.7 : opts.azimuth;
    this.elevation = opts.elevation == null ? 0.6 : opts.elevation;
    this.minElevation = opts.minElevation == null ? 0.15 : opts.minElevation;
    this.maxElevation = opts.maxElevation == null ? 1.45 : opts.maxElevation;
    this.zoom = 1;                                              // pinch or ctrl + wheel; 1 = the framing of the tool
    this.minZoom = opts.minZoom || 0.35; this.maxZoom = opts.maxZoom || 1.6;

    var hemi = new THREE.HemisphereLight(0xffffff, 0xcfcfca, 0.85);
    this.scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    var s = opts.shadowSize || 30;
    sun.position.set(s * 0.6, s * 1.4, s * 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = s * 5;
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.sun = sun;

    this.dirty = true;
    this.running = false;
    this.onFrame = null;
    this.placeCamera();
    this.bindOrbit();
    this.bindResize();
  }

  Stage.prototype.placeCamera = function () {
    var ce = Math.cos(this.elevation), r = this.radius * this.zoom;
    this.camera.position.set(
      this.target.x + r * ce * Math.sin(this.azimuth),
      this.target.y + r * Math.sin(this.elevation),
      this.target.z + r * ce * Math.cos(this.azimuth)
    );
    this.camera.lookAt(this.target);
    this.dirty = true;
  };

  Stage.prototype.bindOrbit = function () {
    var self = this, c = this.canvas, drag = null, touches = {}, pinch = null;
    c.style.touchAction = 'pan-y';
    var dist = function () {
      var p = Object.keys(touches).map(function (k) { return touches[k]; });
      return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
    };
    c.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (e.pointerType === 'touch') {
        touches[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (Object.keys(touches).length === 2) {          // second finger: pinch to zoom, no rotation
          drag = null; pinch = { d: dist(), z: self.zoom };
          c.classList.add('is-dragging');
          return;
        }
        if (pinch) return;
      }
      drag = { x: e.clientX, y: e.clientY, az: self.azimuth, el: self.elevation, mouse: e.pointerType === 'mouse', id: e.pointerId };
      if (drag.mouse) c.setPointerCapture(e.pointerId);
      c.classList.add('is-dragging');
    });
    c.addEventListener('pointermove', function (e) {
      if (touches[e.pointerId]) { touches[e.pointerId].x = e.clientX; touches[e.pointerId].y = e.clientY; }
      if (pinch && Object.keys(touches).length === 2) {
        self.zoom = Math.max(self.minZoom, Math.min(self.maxZoom, pinch.z * pinch.d / dist()));
        self.placeCamera();
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      self.azimuth = drag.az - (e.clientX - drag.x) * 0.008;
      if (drag.mouse) self.elevation = Math.max(self.minElevation, Math.min(self.maxElevation, drag.el + (e.clientY - drag.y) * 0.006));
      self.placeCamera();
    });
    function end(e) {
      delete touches[e.pointerId];
      if (Object.keys(touches).length < 2) pinch = null;     // the finger left after a pinch does not rotate
      if (drag && e.pointerId === drag.id) drag = null;
      if (!drag && !pinch) c.classList.remove('is-dragging');
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    /* Trackpad pinch (ctrl + wheel) zooms the model instead of the page; a plain wheel still scrolls. */
    c.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      self.zoom = Math.max(self.minZoom, Math.min(self.maxZoom, self.zoom * Math.exp(e.deltaY * 0.01)));
      self.placeCamera();
    }, { passive: false });
    c.addEventListener('keydown', function (e) {
      var step = 0.12;
      if (e.key === 'ArrowLeft') self.azimuth += step;
      else if (e.key === 'ArrowRight') self.azimuth -= step;
      else if (e.key === 'ArrowUp') self.elevation = Math.min(self.maxElevation, self.elevation + step);
      else if (e.key === 'ArrowDown') self.elevation = Math.max(self.minElevation, self.elevation - step);
      else if (e.key === '+' || e.key === '=') self.zoom = Math.max(self.minZoom, self.zoom / 1.15);
      else if (e.key === '-') self.zoom = Math.min(self.maxZoom, self.zoom * 1.15);
      else return;
      e.preventDefault();
      self.placeCamera();
    });
  };

  Stage.prototype.bindResize = function () {
    var self = this;
    function fit() {
      var w = self.canvas.clientWidth, h = self.canvas.clientHeight;
      if (!w || !h) return;
      self.renderer.setSize(w, h, false);
      self.camera.aspect = w / h;
      self.camera.updateProjectionMatrix();
      if (self.onResize) self.onResize(w, h);
      self.dirty = true;
    }
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(this.canvas);
    window.addEventListener('resize', fit);
    fit();
  };

  Stage.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    var self = this;
    (function loop(t) {
      if (!self.running) return;
      if (self.onFrame && self.onFrame(t)) self.dirty = true;
      if (self.dirty) { if (self.draw) self.draw(); else self.renderer.render(self.scene, self.camera); self.dirty = false; if (self.afterRender) self.afterRender(); }
      requestAnimationFrame(loop);
    })(performance.now());
  };
  Stage.prototype.stop = function () { this.running = false; };
  Stage.prototype.request = function () { this.dirty = true; };

  /* Arranca cuando el lienzo entra en pantalla y se para al salir. */
  Stage.prototype.whenVisible = function () {
    var self = this;
    if (!('IntersectionObserver' in window)) { this.start(); return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) self.start(); else self.stop(); });
    }).observe(this.canvas);
  };

  /* Generador pseudoaleatorio con semilla, para que cada variante se pueda repetir. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  window.BlogStage = { Stage: Stage, rng: rng };
})();
