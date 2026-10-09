/* EASE · Dos criterios, una ciudad.
   Red peatonal pública de OpenStreetMap alrededor de Puerta del Sol y una cartera de rutas
   candidatas precalculadas hacia tres destinos. La ruta más corta (Dijkstra) va sobre el suelo;
   la preferida según los pesos elegidos flota encima. La selección reproduce routing.js del piloto
   de 2026: pesos explícitos, no aprendidos, y ningún dato personal. */
(function () {
  var SCALE = 0.1;              // 1 unidad = 10 m
  var WALK = 75;                // m por minuto (4,5 km/h)

  function init(root) {
    var THREE = window.THREE, B = window.BlogStage;
    var canvas = root.querySelector('canvas');
    var status = root.querySelector('[data-read]');
    var stats = root.querySelector('[data-stats]');
    var destSel = root.querySelector('[data-input="dest"]');
    var weight = root.querySelector('[data-input="weight"]');
    var weightOut = root.querySelector('[data-output="weight"]');
    var extraSel = root.querySelector('[data-input="extra"]');
    var labels = root.querySelector('.tool-labels');
    status.textContent = 'Loading the street network…';

    var stage = new B.Stage(canvas, { radius: 260, azimuth: 0.35, elevation: 0.85, minElevation: 0.25, maxElevation: 1.5, far: 4000, shadowSize: 10 });
    var scene = stage.scene;

    fetch(root.dataset.src).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (data) { ready(data); }).catch(function () {
      status.textContent = 'The street network could not be loaded. Reload the page to try again.';
    });

    function ready(data) {
      var N = data.nodes;
      function nx(i) { return N[2 * i] * SCALE; }
      function nz(i) { return N[2 * i + 1] * SCALE; }

      /* Calles: una sola geometría de segmentos. */
      var S = data.streets, pos = new Float32Array(S.length / 2 * 3);
      for (var k = 0, p = 0; k < S.length; k += 2) { pos[p++] = S[k] * SCALE; pos[p++] = 0; pos[p++] = S[k + 1] * SCALE; }
      var sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xb3b3af })));

      data.destinations.forEach(function (d, i) {
        var o = document.createElement('option'); o.value = i; o.textContent = d.name; destSel.appendChild(o);
      });

      /* Rutas: un tramo = una caja fina orientada sobre su arista. */
      var ink = new THREE.MeshBasicMaterial({ color: 0x262625 });
      var red = new THREE.MeshBasicMaterial({ color: 0xe0281f });
      var pale = new THREE.MeshBasicMaterial({ color: 0xe0281f, transparent: true, opacity: 0.3 });
      var box = new THREE.BoxGeometry(1, 1, 1);
      var direct = new THREE.InstancedMesh(box, ink, 400);
      var prefer = new THREE.InstancedMesh(box, red, 600);
      var drops = new THREE.InstancedMesh(box, pale, 200);
      [direct, prefer, drops].forEach(function (m) { m.count = 0; scene.add(m); });
      var pinGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
      var pinA = new THREE.Mesh(pinGeo, ink), pinB = new THREE.Mesh(pinGeo, red);
      scene.add(pinA); scene.add(pinB);

      var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
      function lay(im, route, y, h, w) {
        im.count = 0;
        for (var a = 0; a < route.n.length - 1; a++) {
          var i = route.n[a], j = route.n[a + 1];
          var x1 = nx(i), z1 = nz(i), x2 = nx(j), z2 = nz(j), len = Math.hypot(x2 - x1, z2 - z1);
          if (len < 1e-6) continue;
          v.set((x1 + x2) / 2, y, (z1 + z2) / 2);
          q.setFromAxisAngle(up, -Math.atan2(z2 - z1, x2 - x1));
          sc.set(len + w, h, w);
          m4.compose(v, q, sc); im.setMatrixAt(im.count++, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      }
      function lift(route, y, every) {
        drops.count = 0;
        for (var a = 0; a < route.n.length; a += every) {
          var i = route.n[a];
          v.set(nx(i), y / 2, nz(i)); q.set(0, 0, 0, 1); sc.set(0.25, y, 0.25);
          m4.compose(v, q, sc); drops.setMatrixAt(drops.count++, m4);
        }
        drops.instanceMatrix.needsUpdate = true;
      }

      /* Misma lógica que routing.js del explorador de 2026. */
      function select(dest, w, extra) {
        var base = dest.routes[0];
        var score = function (r) { return w * r.c + (1 - w) * r.q - 0.2 * Math.max(0, r.m - base.m) / Math.max(1, extra * WALK) - 0.25 * r.r / r.m; };
        var feasible = dest.routes.filter(function (r) { return r.m <= base.m + extra * WALK + 0.001; });
        var best = feasible.reduce(function (b, r) { return score(r) > score(b) + 1e-12 ? r : b; }, base);
        return { base: base, preferred: best, feasible: feasible };
      }
      function edges(route) {
        var set = {};
        for (var a = 0; a < route.n.length - 1; a++) {
          var i = route.n[a], j = route.n[a + 1];
          set[i < j ? i + ':' + j : j + ':' + i] = Math.hypot(N[2 * i] - N[2 * j], N[2 * i + 1] - N[2 * j + 1]);
        }
        return set;
      }
      function overlap(a, b) {
        var ea = edges(a), eb = edges(b), common = 0, union = 0, key;
        for (key in ea) { union += ea[key]; if (eb[key] != null) common += ea[key]; }
        for (key in eb) if (ea[key] == null) union += eb[key];
        return { common: common, ratio: union ? common / union : 1 };
      }

      var LIFT = 9, lastDest = -1;
      var fmt = function (n, d) { return n.toFixed(d); };
      function update() {
        var dest = data.destinations[Number(destSel.value)];
        var w = Number(weight.value) / 100, extra = Number(extraSel.value);
        weightOut.textContent = 'Shops ' + Math.round(w * 100) + ' % · less traffic ' + Math.round(100 - w * 100) + ' %';
        var r = select(dest, w, extra), o = overlap(r.base, r.preferred);
        lay(direct, r.base, 0.35, 0.7, 1.1);
        lay(prefer, r.preferred, LIFT, 0.7, 1.1);
        lift(r.preferred, LIFT, 6);
        var a = r.base.n[0], b = r.base.n[r.base.n.length - 1];
        pinA.position.set(nx(a), 6, nz(a)); pinA.scale.set(1, 12, 1);
        pinB.position.set(nx(b), 6, nz(b)); pinB.scale.set(1, 12, 1);
        labels.querySelector('[data-label="a"]').textContent = 'Sol';
        labels.querySelector('[data-label="b"]').textContent = dest.name;
        stats.innerHTML =
          '<div><span>Shortest · Dijkstra</span><b>' + fmt(r.base.m / 1000, 2) + ' km · ' + Math.round(r.base.m / WALK) + ' min</b></div>' +
          '<div><span>Preferred · best candidate</span><b>' + fmt(r.preferred.m / 1000, 2) + ' km · +' + fmt((r.preferred.m - r.base.m) / WALK, 1) + ' min</b></div>' +
          '<div><span>Shared segments</span><b>' + fmt(o.common / 1000, 2) + ' km · ' + Math.round(o.ratio * 100) + ' %</b></div>';
        status.textContent = r.feasible.length + ' feasible candidates out of ' + dest.routes.length + '. ' +
          (r.preferred === r.base ? 'With these weights the shortest route wins.' : 'The preferred route detours to find what you asked for.');

        if (lastDest !== Number(destSel.value)) {
          lastDest = Number(destSel.value);
          var xs = [], zs = [];
          r.base.n.concat(r.preferred.n).forEach(function (i) { xs.push(nx(i)); zs.push(nz(i)); });
          var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs), minz = Math.min.apply(null, zs), maxz = Math.max.apply(null, zs);
          stage.target.set((minx + maxx) / 2, 0, (minz + maxz) / 2);
          stage.radius = Math.max(maxx - minx, maxz - minz) * 2.6 + 60;
          stage.placeCamera();
        }
        stage.request();
      }

      /* Etiquetas HTML sobre los dos extremos. */
      var tmp = new THREE.Vector3();
      stage.afterRender = function () {
        [['a', pinA], ['b', pinB]].forEach(function (pair) {
          var el = labels.querySelector('[data-label="' + pair[0] + '"]');
          tmp.copy(pair[1].position); tmp.y = 13; tmp.project(stage.camera);
          var x = (tmp.x + 1) / 2 * canvas.clientWidth, y = (1 - tmp.y) / 2 * canvas.clientHeight;
          el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%, -100%)';
          el.hidden = tmp.z > 1;
        });
      };

      [destSel, extraSel].forEach(function (el) { el.addEventListener('change', update); });
      weight.addEventListener('input', update);
      update();
    }
    stage.whenVisible();
  }

  (window.BlogTools = window.BlogTools || {}).ease = init;
})();
