/* Latent Studio · Entre dos formas.
   Dos volúmenes descritos como campos de distancia sobre una malla de vóxeles. El deslizador mezcla
   los dos campos y la malla se llena donde la mezcla queda dentro. La tesis aprendía este espacio con
   una red generativa 3D; aquí la transición es lineal, para ver la idea con las manos. */
(function () {
  var N = 18;                    // vóxeles por lado
  var H = N / 2;

  function box(x, y, z, cx, cy, cz, hx, hy, hz) {
    var dx = Math.abs(x - cx) - hx, dy = Math.abs(y - cy) - hy, dz = Math.abs(z - cz) - hz;
    var ox = Math.max(dx, 0), oy = Math.max(dy, 0), oz = Math.max(dz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(dx, dy, dz), 0);
  }
  /* y = 0 es el suelo; cada forma cabe en un cubo de N vóxeles. */
  var SHAPES = {
    nave: { name: 'Gabled hall', f: function (x, y, z) {
      var body = box(x, y, z, 0, 3, 0, 8, 3, 3.5);
      var roof = Math.max(box(x, y, z, 0, 8, 0, 8, 2.5, 3.5), (Math.abs(z) + (y - 6) * 1.2 - 3.5) / 1.56);
      return Math.min(body, roof);
    } },
    torre: { name: 'Tower', f: function (x, y, z) { return box(x, y, z, 0, 8, 0, 3, 8, 3); } },
    patio: { name: 'Courtyard', f: function (x, y, z) {
      return Math.max(box(x, y, z, 0, 2.5, 0, 7.5, 2.5, 7.5), -box(x, y, z, 0, 2.5, 0, 3.5, 4, 3.5));
    } },
    escalonado: { name: 'Stepped', f: function (x, y, z) {
      return Math.min(box(x, y, z, -3, 2, 0, 5, 2, 6), box(x, y, z, 1, 5.5, 0, 4, 1.5, 6), box(x, y, z, 4.5, 9, 0, 2.5, 2, 6));
    } },
    puente: { name: 'Bridge', f: function (x, y, z) {
      return Math.max(box(x, y, z, 0, 5, 0, 8, 5, 3), -box(x, y, z, 0, 3, 0, 4.5, 3.2, 4));
    } }
  };

  function init(root) {
    var THREE = window.THREE, B = window.BlogStage;
    var canvas = root.querySelector('canvas');
    var selA = root.querySelector('[data-input="a"]'), selB = root.querySelector('[data-input="b"]');
    var t = root.querySelector('[data-input="t"]'), tOut = root.querySelector('[data-output="t"]');
    var play = root.querySelector('[data-act="play"]');
    var read = root.querySelector('[data-read]');

    Object.keys(SHAPES).forEach(function (k) {
      [selA, selB].forEach(function (s) { var o = document.createElement('option'); o.value = k; o.textContent = SHAPES[k].name; s.appendChild(o); });
    });
    selA.value = 'nave'; selB.value = 'torre';

    var stage = new B.Stage(canvas, { radius: 46, target: [0, 5.5, 0], azimuth: -0.75, elevation: 0.45, shadowSize: 18 });
    var scene = stage.scene;
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    var clay = new THREE.MeshStandardMaterial({ color: 0xf3f2ef, roughness: 0.92 });
    var cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.94, 0.94, 0.94), clay, N * N * N);
    cubes.castShadow = cubes.receiveShadow = true; cubes.count = 0; scene.add(cubes);

    /* Campos precalculados en el centro de cada vóxel. */
    var cache = {};
    function field(key) {
      if (cache[key]) return cache[key];
      var f = new Float32Array(N * N * N), fn = SHAPES[key].f, k = 0;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) for (var l = 0; l < N; l++) f[k++] = fn(i - H + 0.5, j + 0.5, l - H + 0.5);
      return (cache[key] = f);
    }

    var m4 = new THREE.Matrix4();
    function build() {
      var a = field(selA.value), b = field(selB.value), s = Number(t.value) / 100, k = 0;
      cubes.count = 0;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) for (var l = 0; l < N; l++, k++) {
        if ((1 - s) * a[k] + s * b[k] <= 0) {
          m4.makeTranslation(i - H + 0.5, j + 0.5, l - H + 0.5);
          cubes.setMatrixAt(cubes.count++, m4);
        }
      }
      cubes.instanceMatrix.needsUpdate = true;
      tOut.textContent = 't = ' + s.toFixed(2);
      read.textContent = SHAPES[selA.value].name + ' → ' + SHAPES[selB.value].name + ' · ' + cubes.count + ' voxels';
      stage.request();
    }

    var anim = null;
    play.addEventListener('click', function () {
      if (anim) { anim = null; play.textContent = 'Play'; return; }
      anim = { t0: performance.now(), from: Number(t.value) };
      play.textContent = 'Stop';
    });
    stage.onFrame = function (now) {
      if (!anim) return false;
      var p = ((now - anim.t0) / 4000 + anim.from / 200) % 1;   // ida y vuelta en 8 s
      var val = Math.round((p < 0.5 ? p * 2 : 2 - p * 2) * 100);
      if (val !== Number(t.value)) { t.value = val; build(); }
      return false;
    };
    [selA, selB].forEach(function (s) { s.addEventListener('change', build); });
    t.addEventListener('input', function () { if (anim) { anim = null; play.textContent = 'Play'; } build(); });
    build();
    stage.whenVisible();
  }

  (window.BlogTools = window.BlogTools || {})['latent-studio'] = init;
})();
