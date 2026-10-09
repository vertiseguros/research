/* SYneRgism · Sun and shade in the trench.
   Rebuilds the project's massing logic in the browser:
     1. one empty rectangle per segment (the largest is the square) with shades on its corners,
     2. four bridges crossing the plot (they can be moved),
     3. solar radiation on the floor that stays open, with the trench walls and the city around as obstacles,
     4. a voxel topography that always starts at the plot edge and steps down inward over the most exposed cells.
   The grid fills the PLOT rectangle of the context model (53.03 × 253.79 m) with 25 × 111 cells and 4 levels of 1.94 m,
   3 below the street. Only the edge can rise one box above the street.
   Sun: Damascus weather file (TMYx 2007–2021). Context: CONTEXT_1.3dm, as a mesh and a 1 m height map. */
(function () {
  var NX = 25, NY = 111, NZ = 4, STREET = 3, MAXH = STREET + 1;   // 3 layers below the street, 1 above at the edge
  var W = 53.032, L = 253.793;                                // PLOT rectangle
  var CX = W / NX, CY = L / NY, CZ = 1.94, FLOOR = -STREET * CZ, NXY = NX * NY;
  var BRIDGE_ROWS = 2, MIN_GAP = 6, END_GAP = 5;
  var INITIAL = [26, 64, 78, 95];                             // rows of the four crossings in the project model
  var SUN = [[0.0338,0.9659,0.2566,88.1],[0.7011,0.7071,0.0923,64.4],[0.2053,0.9659,0.1576,54.2],[-0.2053,0.9659,0.1576,51.6],[-0.3904,0.9063,0.1617,40.5],[0.5299,0.8192,0.2195,37.6],[0.8121,0.5736,-0.1069,36.0],[-0.2573,0.9063,0.3353,28.2],[-0.7011,0.7071,0.0923,27.9],[-0.5687,0.8192,0.0749,27.7],[-0.8121,0.5736,-0.1069,27.3],[0.2573,0.9063,0.3353,27.1],[0.419,0.9063,0.0552,25.1],[0.8986,0.4226,-0.1183,24.0],[-0.8986,0.4226,-0.1183,23.2],[0.0552,0.9063,0.419,20.9],[0.3353,0.9063,0.2573,19.6],[-0.455,0.8192,0.3492,18.6],[-0.8121,0.5736,0.1069,17.3],[-0.419,0.9063,0.0552,16.8],[-0.2195,0.8192,0.5299,16.0],[-0.1576,0.9659,0.2053,15.4],[-0.6533,0.7071,0.2706,14.4],[0.2195,0.8192,0.5299,14.0],[-0.5299,0.8192,0.2195,13.3],[0.8121,0.5736,0.1069,12.1],[0.455,0.8192,0.3492,11.8],[-0.0749,0.8192,0.5687,11.0],[0.3904,0.9063,0.1617,10.7],[-0.561,0.7071,0.4305,10.1],[0.5687,0.8192,0.0749,9.7],[0.6533,0.7071,0.2706,9.1],[0.561,0.7071,0.4305,8.4],[0.7568,0.5736,0.3135,8.1],[-0.7568,0.5736,0.3135,7.9],[0.8986,0.4226,0.1183,7.1],[0.8924,0.2588,-0.3696,6.9],[0.9577,0.2588,-0.1261,4.8],[0.3492,0.8192,0.455,4.2],[0.8373,0.4226,0.3468,4.2],[0.9577,0.2588,0.1261,3.9],[-0.8924,0.2588,-0.3696,3.8],[-0.8986,0.4226,0.1183,3.4],[0.4305,0.7071,0.561,3.4],[-0.8373,0.4226,0.3468,2.8]];
  var DAY = [[0.9394,0.1515,-0.3077,0.067],[0.9185,0.3556,-0.1729,0.224],[0.8351,0.5482,-0.0456,0.407],[0.6947,0.7163,0.0654,0.577],[0.507,0.8483,0.1527,0.716],[0.2847,0.9353,0.2102,0.807],[0.043,0.9713,0.2341,0.839],[-0.2017,0.9538,0.2228,0.812],[-0.4326,0.884,0.1769,0.726],[-0.6341,0.7668,0.0998,0.586],[-0.7924,0.6099,-0.0035,0.409],[-0.8968,0.4242,-0.1258,0.218],[-0.94,0.2223,-0.2589,0.046]];
  var HOUR = [[-0.94,0.2223,-0.2589,0.046]];
  /* Tres periodos del archivo climático. Valores en kWh/m² sobre el plano horizontal. */
  var PERIODS = {
    day: { sun: DAY, diffuse: 1.505, unit: 'kWh/m²', k: 1, dec: 1, label: '25 July, the hottest day of the year (41.4 °C)' },
    hour: { sun: HOUR, diffuse: 0.035, unit: 'Wh/m²', k: 1000, dec: 0, label: '25 July at 18:00, the hottest hour of the year (41.4 °C, sun 13° high from the west-northwest)' },
    noon: { sun: [[0.043,0.9713,0.2341,0.839]], diffuse: 0.153, unit: 'Wh/m²', k: 1000, dec: 0, label: '25 July at 12:00, the strongest sun of the hottest day (38.4 °C, sun 76° high from the south)' },
    summer: { sun: SUN, diffuse: 238.1, unit: 'kWh/m²', k: 1, dec: 0, label: 'May to September, cumulative' }
  };

  /* Cielo difuso: tres anillos, peso de cada dirección según su aporte a una superficie horizontal. */
  var SKY_DIRS = (function () {
    var rings = [[20, 8], [45, 6], [72, 3]], out = [], tot = 0;
    rings.forEach(function (r) {
      var a = r[0] * Math.PI / 180, w = Math.sin(a) * Math.cos(a) + (r[0] > 60 ? 0.25 : 0);
      for (var n = 0; n < r[1]; n++) {
        var az = (n + 0.5) / r[1] * Math.PI * 2;
        out.push([Math.cos(a) * Math.sin(az), Math.sin(a), -Math.cos(a) * Math.cos(az), w / r[1]]);
        tot += w / r[1];
      }
    });
    out.forEach(function (d) { d[3] /= tot; });
    return out;
  })();
  var RAYS, RMAX, PERIOD;
  function setPeriod(name) {
    PERIOD = PERIODS[name];
    RAYS = PERIOD.sun.concat(SKY_DIRS.map(function (d) { return [d[0], d[1], d[2], d[3] * PERIOD.diffuse]; }));
    RMAX = RAYS.reduce(function (s, d) { return s + d[3]; }, 0);
    prepareStatic();
  }
  setPeriod('day');

  function idx(i, j, k) { return (k * NY + j) * NX + i; }
  function cxp(i) { return (i - NX / 2 + 0.5) * CX; }
  function czp(j) { return (NY / 2 - j - 0.5) * CY; }          // j = 0 at the south end

  /* ── Lógica: formación del volumen ─────────────────────────── */
  function segments(bridges) {
    var segs = [], a = 0;
    bridges.forEach(function (b) { segs.push([a, b]); a = b + BRIDGE_ROWS; });
    segs.push([a, NY]);
    return segs;
  }

  /* Fixed obstacles for each floor cell and sun direction: the trench walls below the street and
     the context buildings (height map). Computed once per period and whenever the context arrives. */
  var CTX = null, STATIC = null;
  function staticBlocked(i, j, d) {
    var x = cxp(i), z = czp(j), y = FLOOR + 0.05, dx = d[0], dy = d[1], dz = d[2];
    var tx = dx > 0 ? (W / 2 - x) / dx : dx < 0 ? (-W / 2 - x) / dx : Infinity;
    var tz = dz > 0 ? (L / 2 - z) / dz : dz < 0 ? (-L / 2 - z) / dz : Infinity;
    var t = Math.min(tx, tz);
    if (t === Infinity) return false;
    if (y + dy * t < 0) return true;                          // hits the trench wall
    if (!CTX) return false;
    var step = 0.8 / Math.hypot(dx, dz);
    for (var n = 0; n < 2000; n++, t += step) {
      var py = y + dy * t;
      if (py > CTX.top) return false;
      var ix = Math.floor((x + dx * t - CTX.x0) / CTX.res), iz = Math.floor((z + dz * t - CTX.z0) / CTX.res);
      if (ix < 0 || iz < 0 || ix >= CTX.nx || iz >= CTX.nz) return false;
      if (CTX.h[iz * CTX.nx + ix] * CTX.scale > py) return true;
    }
    return false;
  }
  function prepareStatic() {
    STATIC = new Uint8Array(RAYS.length * NXY);
    for (var r = 0; r < RAYS.length; r++) for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++)
      STATIC[r * NXY + j * NX + i] = staticBlocked(i, j, RAYS[r]) ? 1 : 0;
  }

  /* Context file: display mesh, height map and street blocks (see tools/export_context.py). */
  function parseContext(buf) {
    var dv = new DataView(buf), o = 4, I = function () { var v = dv.getInt32(o, true); o += 4; return v; }, F = function () { var v = dv.getFloat32(o, true); o += 4; return v; };
    var nv = I(), ni = I(), hnx = I(), hnz = I(), nb = I(), isz = I();
    var x0 = F(), z0 = F(), res = F(), scale = F();
    var pos = new Int16Array(buf, o, nv * 3); o += nv * 6; o = (o + 3) & ~3;
    var index = isz === 2 ? new Uint16Array(buf, o, ni) : new Uint32Array(buf, o, ni); o += ni * isz; o = (o + 3) & ~3;
    var h = new Uint8Array(buf, o, hnx * hnz); o += hnx * hnz; o = (o + 1) & ~1;
    var top = 0; for (var k = 0; k < h.length; k++) if (h[k] > top) top = h[k];
    var blocks = [];
    for (var b = 0; b < nb; b++) { var n = dv.getUint16(o, true); o += 2; blocks.push(new Int16Array(buf.slice(o, o + n * 4))); o += n * 4; }
    return { pos: pos, index: index, blocks: blocks, map: { x0: x0, z0: z0, res: res, scale: scale, nx: hnx, nz: hnz, h: h, top: top * scale + 0.01 } };
  }
  function setContext(ctx) { CTX = ctx ? ctx.map : null; prepareStatic(); }

  /* One ray through the voxel grid (DDA). Leaving the grid means only the fixed obstacles remain. */
  function lit(occ, i, j, r) {
    if (STATIC[r * NXY + j * NX + i]) return false;
    return clearOf(occ, i, j, RAYS[r]);
  }
  function clearOf(occ, i, j, d) {
    var px = i + 0.5, py = j + 0.5, pz = 0.02;
    var dx = d[0] / CX, dy = -d[2] / CY, dz = d[1] / CZ;
    var ci = i, cj = j, ck = 0;
    var si = dx > 0 ? 1 : -1, sj = dy > 0 ? 1 : -1;
    var tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = 1 / dz;
    var tx = dx !== 0 ? ((dx > 0 ? ci + 1 - px : px - ci) * tdx) : Infinity;
    var ty = dy !== 0 ? ((dy > 0 ? cj + 1 - py : py - cj) * tdy) : Infinity;
    var tz = (1 - pz) * tdz;
    for (var n = 0; n < 400; n++) {
      if (tx < ty && tx < tz) { ci += si; tx += tdx; }
      else if (ty < tz) { cj += sj; ty += tdy; }
      else { ck += 1; tz += tdz; }
      if (ck >= NZ || ci < 0 || ci >= NX || cj < 0 || cj >= NY) return true;
      if (occ[idx(ci, cj, ck)]) return false;
    }
    return true;
  }
  function sunDir(month, day, t) {
    var doy = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], N = day;
    for (var m = 0; m < month - 1; m++) N += doy[m];
    var g = 2 * Math.PI / 365 * (N - 1 + (t - 12) / 24);
    var eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var ha = ((t * 60 + eot + 4 * 36.516 - 60 * 2) / 4 - 180) * Math.PI / 180, la = 33.412 * Math.PI / 180;
    var alt = Math.asin(Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha));
    if (alt <= 0) return null;
    var az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la)) + Math.PI;
    return [Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)];
  }
  var WIN_RAYS = {};
  function windowRays(w) {
    var R = WIN_RAYS[w];
    if (R && R.ctx === CTX) return R;
    var h0 = w === 'am' ? 7 : 11, h1 = w === 'am' ? 12 : 17, dirs = [];
    for (var k = 0; k < (h1 - h0) * 4; k++) { var d = sunDir(7, 25, h0 + (k + 0.5) / 4); if (d) dirs.push(d); }
    var stat = new Uint8Array(dirs.length * NXY);
    for (var r = 0; r < dirs.length; r++) for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) stat[r * NXY + j * NX + i] = staticBlocked(i, j, dirs[r]) ? 1 : 0;
    return (WIN_RAYS[w] = { dirs: dirs, stat: stat, ctx: CTX });
  }
  function radiationAt(occ, i, j) {
    var s = 0;
    for (var r = 0; r < RAYS.length; r++) if (lit(occ, i, j, r)) s += RAYS[r][3];
    return s;
  }
  function radiation(occ, mask, out) {
    for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
      var c = j * NX + i;
      out[c] = mask[c] ? radiationAt(occ, i, j) : -1;
    }
    return out;
  }

  /* Sun hours on the trench floor, shaded only by the trench walls and the city (tools/sun_hours.py),
     as in the project's sun-hour study: 7–12 for a morning market, 11–17 for an afternoon market.
     The bridges stay out of this map; they hardly change it. Values in 0.05 h, one byte per cell. */
  var SUN_HOURS = {
    day_am: 'Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NzIyKBkAAGRkZGRkZGRkZGRkZGRkZGRkX19fX1VGLRRkZGRkZGRkZGRkZGRkZGRkX19fWlpVRi0UZGRkZGRkZGRkZGRkZGRkZF9fWlpaVUYtFGRkZGRkZGRkZGRkZGRkZGRfX1paVVBGLRRkZGRkZGRkZGRkZGRkZGRkX19aWlVQRi0UZGRkZGRkZGRkZGRkZGRkZF9fWlpVUEYtFGRkZGRkZGRkZGRkZGRkZF9fX1paVVBGLRRkZGRkZGRkZGRkZGRkZGRfX1paVVVQRi0UZGRkZGRkZGRkZGRkZGRkZF9fWlVVUEYtFGRkZGRkZGRkZGRkZGRkZGRfX1paVVBGLRRkZGRkZGRkZGRkZGRkZGRkX19aWlVQRi0UZGRkZGRkZGRkZGRkZGRkZF9fWlpVUEYtFGRkZGRkZGRkZGRkZGRfX19fX1paVVBGLRRkZGRkZGRkZGRkZGRkX19fWlpaWlVQRi0UZGRkZGRkZGRkZGRkZF9fWlpVVVBQUEYtFGRkZGRkZGRkZGRkZGRfX19aVVVQS0tGLRRkZGRkZGRkZGRkZGRkX19fWlpVUEtLRi0UZGRkZGRkZGRkZGRkZF9fWlpaVVBQS0YtFGRkZGRkZGRkZGRkZGRfX1paVVVQUEtGLRRkZGRkZGRkZGRkZGRkZGRfX1paUEtLRi0UZGRkZGRkZGRkZGRkZGRkZGRkZF9VS0YtFGRkZGRkZGRkZGRkZGRkZGRkZGRkX1VGLRRkZGRkZGRkZGRkZGRkZGRkZGRkZF9VRi0UZGRkZGRkZGRkZGRkZGRkZGRkZGRfVUYtFGRkZGRkZGRkZGRkZGRkZGRkZGRkX1VGLRRkZGRkZGRkZGRkZGRkZGRkZGRkZF9VRi0UZGRkZGRkZGRkZGRkZGRkZGRkZGRfVUYtFGRkZGRkZGRkZGRkZGRkZGRkZGRkX1VGLRRkZGRkZGRkZGRkZGRkZGRkZGRkZF9VRi0UZGRkZGRkZGRkZGRkZGRkZGRkZGRfVUYtFGRkZGRkZGRkZGRfX19fX19fX19fX1VGLRRkZGRkZGRkZGRkX19aWlVVVVVVVVVVRi0UZGRkZGRkZGRkZF9fWlpVVVBLS0ZGRkYtFGRkZGRkZGRkZGRfX1paVVVQS0ZGQTw3LRRkZGRkZGRkZGRkX19aWlVVUEtGRkE8Ny0UZGRkZGRkZGRkZF9fWlpVVVBLRkZBPDctFGRkZGRkZGRkZGRfX1paVVVQS0ZGQTw3LRRkZGRkZGRkZGRkX19aWlVVUEtGRkE8Ny0UZGRkZGRkZGRkZF9fWlpVVVBLRkZBPDctFGRkZGRkZGRkZGRfX1paVVVQS0ZGQTw3LRRkZGRkZGRkZGRkX19aWlVVUEtGRkE8Ny0UZGRkZGRkZGRkZGRkWlpVVVBLRkZBPDctFGRkZGRkZGRkZF9fX19fWlpVUEZGQTw3LRRkZGRkZGRkZGRfX1paWlpaWlVQUEZBNy0UZGRkZGRkZGRkX19aWlpVUFBLS0tLS0EtFGRkZGRkZGRkZF9fWlpaVVBQS0ZBPDw3LRRkZGRkZGRkZGRfX1paWlVQUEtGQTw3Mi0UZGRkZGRkZGRkZGRaWlpVUFBLRkE8NzItFGRkZGRkZGRkZGRkZF9fVVBQS0ZBPDcyLRRkZGRkZGRkZGRkZGRkZGRkX1pGQTw3Mi0UZGRkZGRkZGRkZGRkZGRkZGRkZF9LNzItFGRkZGRkZGRkZGRkX19fX19fX2RkX1VGLRRkZGRkZGRkZGRkZF9fWlpaWlpaWlpVRi0UZGRkZGRkZGRkZGRfX1paVVBQUFBQUEYtFGRkZGRkZGRkZGRkX19aWlVQUEtGQTw8LRRkZGRkZGRkZGRkZF9fWlpVUFBLRkE8Ny0UZGRkZGRkZGRkZGRkZF9fWlVQS0ZBPDctFGRkZGRkZGRkZGRkZGRkZGRfWlVLQTw3LRRkZGRkZGRkZGRkZGRkZGRkZF9fWlBGNy0UZGRkZGRkZGRkZGRkZGRkZGRfX1pVUEYtFGRkZGRkZGRkZGRkX19fX19fX1pVUFBGLRRkZGRkZGRkZGRkZF9fWlpaWlpaVVBLRi0UZGRkZGRkZGRkZGRfX1paVVVQS0tLS0YtFGRkZGRkZGRkZGRkX19aWlVVUEtGQTw3LRRkZGRkZGRkZGRkZF9fWlpVVVBLRkE8Ny0UZGRkZGRkZGRkZGRfX1paVVVQS0ZBPDctFGRkZGRkZGRkZGRkX19aWlVVUEtGQTw3LRRkZGRkZGRkZGRkZGRkX19aWlVLRkE8Ny0UZGRkZGRkZGRkZGRfX1paWlpVUEtGPDctFGRkZGRkZGRkZGRkX19aWlVQUFBQS0Y3LRRkZGRkZGRkZGRkZF9fWlpVUFBLRkFBPC0UZGRkZGRkZGRkZGRfX1paVVBQS0ZBPDctFGRkZGRkZGRkZGRkX19aWlVQUEtGQTw3LRRkZGRkZGRkZGRkZF9fWlpVUFBLRkE8Ny0UZGRkZGRkZGRkZGRkZF9aVVBQS0ZBPDctFGRkZGRkZGRkZGRkZGRkZF9aWlVQRjw3LRRkZGRkZGRkZGRkZGRkZGRkZGRkX1VGNy0UZGRkZGRkZGRkZGRkZGRkZGRkX1paVUYtFGRkZGRkZGRkZGRkZGRkZGRkZF9aWlVGLRRkZGRkZGRkZGRkZGRkZGRkZGRfWlpVRi0UZGRkZGRkZGRkZGRkZGRkZGRkX1paVUYtFGRkZGRkZGRkZGRkZGRkZGRkZF9aWlVGLRRkZGRkZGRkZGRkZGRkZGRkZGRkX1pVRi0UZGRkZGRkZGRkZGRkZGRkZGRkZGRfVUYtFGRkZGRkZGRkZGRkZGRkZGRkZGRkX1VGLRRkZGRkZGRkZGRkZGRkZGRkZGRkZF9VRi0UZGRkZGRkZGRkZGRkZGRkZGRkZGRfVUYtFGRkZGRkZGRkZGRkZGRkZGRkZF9aWlVGLRRkZGRkZGRkZGRkZGRkZGRkZGRfWlVQRi0UZGRkZGRkZGRkZGRkZGRkZGRkX1pVUEYtFGRkZGRkZGRkZGRkZGRkZGRkZF9aVVBGLRRkZGRkZGRkZGRkZGRkZGRkZGRfWlVQRi0UZGRkZGRkZGRkZGRkZGRkZGRkX1pVUEYtFGRkZGRkZGRkZGRkZGRkZGRkZF9aVVBGLRRkZGRkZGRkZGRkZGRkZGRkZGRkX1VQRi0UZGRkZGRkZGRkZGRkZGRkZGRkZF9aVUYtFGRkZGRkZGRkZGRkZGRkZGRkZGRfWlVGLRRkZGRkZGRkZGRkZGRkZGRkZGRkX1pVRi0UZGRkZGRkZGRkZGRkZGRkZGRkZF9aVUYtFGRkZGRkZGRkZGRkZGRkZGRkZGRfWlVGLRRkZGRkZGRkZGRkZGRkZGRkZGRkX1pVRi0UZGRkZGRkZGRkZGRkZGRkZGRkZF9aVUYtFGRkZGRkZGRkZGRkZGRkZGRkZGRfWlVGLRRkZGRkZGRkZGRkZGRkZGRkZGRkX1pVRi0UZGRkZGRkZGRkZGRkZGRkZGRkZF9aVUYtFGRkZGRkZGRkZGRkZGRkZGRkZGRfWlVGLRRkZGRkZGRkZGRkZGRkZGRkZGRkX1pVRi0UZGRkZGRkZGRkZGRkZGRkZGRkZF9aVUYtFGRkZGRkZGRkZGRkZGRkZGRkZGRfWlVGLRRkZGRkZGRkZGRkZGRkZGRkZGRkZFpVRi0U',
    day_pm: 'AAUZKDI8QUZBQUFBQUFBQUZGRkZGRkZGRh43S1pkbm5ubm5ubm5zc3N4eHh4eHh4eHgeN0taZGlpaWlpbm5uc3NzeHh4eHh4eHh4HjdLWl9kZGlpaW5ubnNzc3h4eHh4eHh4eB43S1pfZGRpaWlubnNzc3N4eHh4eHh4eHgeN0taX2RkaWlubm5zc3NzeHh4eHh4eHh4HjdLWl9kZGlpbm5ubnNzc3h4eHh4eHh4eB43S1pfZGRpaWlubm5zc3NzeHh4eHh4eHgeN0taX2RkaWlpbm5uc3Nzc3h4eHh4eHh4HjdLWl9kZGlpaW5ubnNzc3h4eHh4eHh4eB43S1pfZGRkaWlubm5zc3N4eHh4eHh4eHgeN0taX19kZGlpbm5uc3NzeHh4eHh4eHh4HjdLWl9fZGRpaW5ubnN4eHh4eHh4eHh4eB43S1pfZGRpaWluc3Nzc3h4eHh4eHh4eHgeN0taX2RkaW5ubnNzc3h4eHh4eHh4eHh4HjdLWl9kaWlubm5zc3N4eHh4eHh4eHh4eB43S1pkZGlpbm5uc3NzeHh4eHh4eHh4eHgeN0taX2RpaWlubnNzc3h4eHh4eHh4eHh4HjdLWl9kaWlubm5zc3NzeHh4eHh4eHh4eB43S1pkZGlpbm5uc3Nzc3h4eHh4eHh4eHgeN0taZGRpaWlubnNzc3N4eHh4eHh4eHh4HjdLWl9kaWlpbm5zc3NzeHh4eHh4eHh4eB43S1pfZGlpaW5uc3h4eHh4eHh4eHh4eHgeN0taX2Rpbm54eHh4eHh4eHh4eHh4eHh4HjdLWl9kbnh4eHh4eHh4eHh4eHh4eHh4eB43S1pkbnN4eHh4eHh4eHh4eHh4eHh4eHgeN0taZG5zeHh4eHh4eHh4eHh4eHh4eHh4HjdLWmRuc3h4eHh4eHh4eHh4eHh4eHh4eB43S1pkbnN4eHh4eHh4eHh4eHh4eHh4eHgeN0taZG5zeHh4eHh4eHh4eHh4eHh4eHh4HjdLWmRuc3h4eHh4eHh4eHh4eHh4eHh4eB43S1pkbnNzc3N4eHh4eHh4eHh4eHh4eHgeN0taZG5ubnNzeHh4eHh4eHh4eHh4eHh4HjdLWmRpbm5zc3h4eHh4eHh4eHh4eHh4eB43S1pkaW5uc3NzeHh4eHh4eHh4eHh4eHgeN0taZGlubm5zc3Nzc3h4eHh4eHh4eHh4HjdLWmRpaW5ubm5uc3N4eHh4eHh4eHh4eB43S1pkZGRpaW5uc3Nzc3Nzc3Nzc3N4eHgeN0taWl9kaWlubnNzc3Nzc3Nzc3Nzc3NzHjdLVVpkZGlpbm5ubm5ubm5uc3Nzc3Nzcx43S1pfZGRpaWlpaWlpaW5ubm5ubnNzc3MeN0taZGRkZGRkZGRpaWlpaWlubm5zc3NzHjdLWlpaWl9fZGRkZGRkaWlpbm5uc3Nzcx43S1BVVVpaWlpaX19kZGlpaW5ubnNzc3MeN0tLS1BQUFVaWl9fZGRpaWlubm5zc3NzHjc8QUZLUFBVWlpfX2RkaWlpbm5uc3Nzcx43PEFGS1BQVVpaX19kZGlpaW5ubnNzc3MeNzxBRktQUFVaWl9fZGRpaWlubm5zc3NzHjc8QUZLUFBVWlpfX2RkaWlpbm5zeHh4eB43PEFGS1BQVVpaX19kZG5ubnN4eHh4eHgeNzxBRktQUFVaWl9kaWlubnNzc3N4eHh4Hjc8QUZLUFBaX19kZG5ubm5uc3Nzc3h4eB43PEFGVVpaX2RkaWlpaW5ubnNzc3N4eHgeNzxLVVpfX2RkZGRpaWlubm5zc3NzeHh4HjdGWlpaWlpfX2RkaWlpaW5uc3Nzc3h4eB43S0tQVVVaX19kZGRpaWlubnNzc3N4eHgeN0ZLUFVVWlpfX2RkaWlpbm5zc3N4eHh4HjdGS0tQVVVaX19kZGlpaW5uc3NzeHh4eB43QUZLUFVVWl9fZGRpaW5ubnN4eHh4eHgeN0FGS1BVVVpfX2RpaW5zeHh4eHh4eHh4HjdBRktQVVVkZGlpc3h4eHh4eHh4eHh4eB43QUZLVVpkaWl4eHh4eHh4eHh4eHh4eHgeN0ZLUFppc3Nzc3h4eHh4eHh4eHh4eHh4HjdGVV9ubm5uc3N4eHh4eHh4eHh4eHh4eB43S1pkaWluc3NzeHh4eHh4eHh4eHh4eHgeN0taZGlubnNzc3h4eHh4eHh4eHh4eHh4HjdLWmRpbm5zc3N4eHh4eHh4eHh4eHh4eB43S1pkaW5uc3Nzc3Nzc3Nzc3NzeHhzc3MeN0taZGlubnNzbm5ubm5ubnNzc3Nzc3NzHjdLWmRpbmlpaWlpaW5ubm5ubm5ubm5ubh43S1pkZGRkZGRkaWlubm5ubm5ubm5ubm4eN0taWlpaX2RkZGlpaWlpaWlpaWlpbm5uHjdLUFVaWl9kZGRkZGRkZGRkaWlpaW5ubh43S1BVWlpaWlpaWlpfX19kZGlpaWlubm4eN0tQUFBVVVVVVVpaWl9fZGRpaWlpbm5uHjdBRkZGS0tQUFVVWlpfX2RkaWlpaW5ucx4yNzxBRkZLUFBVVVpaX19kZGlubm5zc3geMjc8QUZGS1BQVVVaX2RkaWlzc3NzeHh4HjI3PEFGRktQUFVaZGRpbnNzeHh4eHh4eB4yNzxBRkZLVVVfX2lpbnNzc3N4eHh4eHgeMjc8QUtQVV9fZGRubm5uc3NzeHh4eHh4HjI3QUtVWl9kaWlpaW5ubnNzc3h4eHh4eB4yPFBaZGRkZGRkaWlubm5zc3N4eHh4eHgeN0taWlpaX19kZGlpbm5uc3NzeHh4eHh4HjdLUFBVWl9fZGRpaW5ubnNzc3h4eHh4eB43RlBQVVpfX2RkaWlubm54eHh4eHh4eHgeN0ZQUFVaX19kZGlpc3NzeHh4eHh4eHh4HjdGUFBVWl9fZGRubnNzc3h4eHh4eHh4eB43RlBQVVpfZGlpbm5zc3N4eHh4eHh4eHgeN0ZQVV9fZGlpaW5uc3NzeHh4eHh4eHh4HjdLVVpfX2RpaWlubnNzc3N4eHh4eHh4eB43S1VaX19kaWlpbm5uc3N4eHh4eHh4eHgeN0tVWl9fZGlpaWlubnNzeHh4eHh4eHh4HjdLVVpfX19kaWlubnNzc3h4eHh4eHh4eB43S1VVWl9fZGlubm5zc3N4eHh4eHh4eHgeN0tQVVpfZGlpaW5ueHh4eHh4eHhzc3NzHjdLUFpaX2RkaW5zeHh4eHNzc3Nzc3Nzcx43S1BVWl9pbnNzc3Nzc25ubm5ubm5ubm4eN0tQWmRpbm5ubm5ubm5paWlpaWlpbm5uHjdLWmRkaWlpaWlpaWlpaWlpaWlpaW5ubh43S1pkZGRkZF9fX19fX19kZGlpaWlubm4eN0taWlpaWlpaWlpaX19fZGRpaWlpbm5uHjdGS0tLS1BQVVVaWl9fX2RkaWlpaW5ubh43PDxBRkZLUFVVWlpfX19kZGlpaWlubm4eMjc8QUZGS1BVVVpaX19fZGRpaWlpbm5uHjI3PEFGRktQVVVaWl9fX2RkaWlpaW5ucx4yNzxBRkZLUFVVWlpfX19kZGlpaWluc3MeMjc8QUZGS1BVVVpaX19fZGRpbm5ubnNzHjI3PEFGRktQVVVaWl9fX2lpaW5ubm5zcx4yNzxBRkZLUFVVWl9fZGRpaWlubm5uc24eMjc8QUZGS1BVWlpfX2RkaWlpaWlpaWlp',
    summer_am: 'MTExMTExMTExMTExMTExMTExMTAtJRoQBlxcXFxcXFxcXFxcXFxcXFxcXFtYVUs+LBRkZGRkZGRkZGRkZGRkZGRkY2NgXlpSQzAWZGRkZGRkZGRkZGRkZGRkY2NiXl1YUkMwFmRkZGRkZGRkZGRkZGRkY2NiYF5bV1FDMBZkZGRkZGRkZGRkZGRkZGNjYmBdWldRQzAWZGRkZGRkZGRkZGRkZGNjYmFfXFpWUUMwFmRkZGRkZGRkZGRkZGNjY2FgXltYVlFDMBZkZGRkZGRkZGRkZGRjY2JhYF1bV1VRQzAWZGRkZGRkZGRkZGRjY2JiYV9dWlhVUUMwFmRkZGRkZGRkZGRkY2NiYmBfXVpXVFFDMBZkZGRkZGRkZGRkZGNjYmFgX11aV1RRQzAWZGRkZGRkZGRkZGNjY2JhYV9dWlhUUUMwFmRkZGRkZGRkZGRjY2NiYV9dXFlXVFFDMBZkZGRkZGRkZGRkY2NiYWBeXFpYVVNRQzAWZGRkZGRkZGRkZGNjYmFgXlxYV1RRTkMwFmRkZGRkZGRkZGRjY2JhX15bWVZUT01DMBZkZGRkZGRkZGRjY2NiYF9dW1lVU1BNQzAWZGRkZGRkZGRkY2NiYWFfXFtYVVJQTEMwFmRkZGRkZGRkY2NjYmFgX11bV1VST0xDMBZkZGRkZGRkZGRjYmJhYF9eXFtXVU9MQzAWZGRkZGRkZGRjY2JiYWBgX15dWllUTEMwFmRkZGRkZGRkY2NiYmFhYWBfXl1cV05DMBZkZGRkZGRkY2NjY2JhYWFgYF9eXVlPQzAWZGRkZGRkZGNjY2NiYmJhYWBgX15aUEMwFmRkZGRkZGRjY2NjYmJiYmFhYWBfWlFDMBZkZGRkZGRkY2NjY2NjYmJiYmFhYFtRQzAWZGRkZGRkZGRkY2NjY2NjYmJiYmBbUUMwFmRkZGRkZGRkZGNjY2NjY2NjY2JhXFFDMBZkZGRkZGRkZGRkZGRkZGRkZGRjYl1SQzAWZGRkZGRkZGRkZGRkY2NjY2NjYmFdUkMwFmRkZGRkZGRkZGRkY2JhYGBgYF9eWlJDMBZkZGRkZGRkZGRjY2JgX15cW1paWFZQQzAWZGRkZGRkZGRjY2JhX15cWVhVU1BMSEAwFmRkZGRkZGRkY2NiYV5dWldVUk9LR0I7MBZkZGRkZGRkY2NiYWBdXFlWU1BNSEQ+ODAWZGRkZGRkY2NjYmFfXFtYVFJOSkZCPTcwFmRkZGRkZGNjYmFgXlxaVlNRTUlFQDs2MBZkZGRkZGNjYmJhX15bWVZSUExIRD86NTAWZGRkZGNjY2JhYV9dW1lVUk9MSEM/OjUwFmRkZGRjY2NiYWBfXVtZVVJPTEdDPzo1MBZkZGRkY2NjYmFgX11bWVVST0xHQz86NTAWZGRkZGNjY2JhYF9eXFpWUlBMR0M/OjUwFmRkZGRjY2NiYWFfXVtZV1VSTklFQDo1MBZkZGRkY2NjYmFhX11bWFZUUU9MSEQ+NTAWZGRkZGNjY2JhYF9cWlhWU1BNSkZDQDowFmRkZGRjY2NiYWBfXFpXVVJPTEhEQDw3MBZkZGRkY2NiYmFgX1xaV1VRTktHQz86NS8WZGRkZGNjYmJhYF9dXFhVUU5LR0M+OjUvFmRkZGRjY2JiYWBgXl1bWVVQS0dDPjo1LxZkZGRjY2NiYmJhYF9eXVtZVlNOSEA6NS8WZGRkY2NjY2JiYWFgX15dXFpYVVNMQTcvFmRkZGNjY2NiYmFhYF9dXFtaWVhWUUg9LxZkZGRjY2NjYmJiYWBfXVtZV1dWVFFLPzAWZGRkY2NjY2NjYmFgX11aWFVUUk5LSEEwFmRkZGRkY2NjY2JhYV9dWldUUk9LRkI8MBZkZGRkZGRjY2NiYWBfXVpXVFFNSkVAOjAWZGRkZGRkZGNjYmJhYF9dWlhUTklEQDkwFmRkZGRkZGRjY2NiYmFgXl1bWFROR0A4MBZkZGRkZGRjY2NiYmFhYF9eXVpWUUxGOzAWZGRkZGRkY2NjYmJhYWBgX11bV1NOST4wFmRkZGRkZGNjY2JiYWFfXlxbWVZTTklAMBZkZGRkZGRjY2NjYmFhXl1aWFVTUU5KQTAWZGRkZGRkZGNjY2JhYF1bWVZTUE1KRkAwFmRkZGRkZGRkY2NiYWBdW1hVUk5LRkI8MBZkZGRkZGRkZGNjYmFgXVtYVVFOSkVBOzAWZGRkZGRkZGRjY2JhX1xaV1RRTUlEPzowFmRkZGRkZGRjY2JiYF9dWlZTUExIQz45MBZkZGRkZGRjY2NiYWBeXFtYVVFNSEM9ODAWZGRkZGRkY2NiYmFgXlxaV1VSUE1HQDcwFmRkZGRkZGNjYmJhYF5bWVdUUU5LSEI7MBZkZGRkZGRjY2JiYWBeW1lWUlBMSEM/OTAWZGRkZGRkY2NiYmFgXltYVVJPS0dCPTgwFmRkZGRkZGNjYmJhX15bWFVST0tHQj04MBZkZGRkZGRjY2JiYV9eW1hVUk9LRkI9NzAWZGRkZGRkY2NiYmFgXl1bV1NQS0ZCPTcwFmRkZGRkZGNjYmJhYF9eXVtZVlJNRz03MBZkZGRkZGRjY2JiYWFgX15dXFpYVU9EODAWZGRkZGRkY2NiYmJhYWBfX15dW1dSST0wFmRkZGRkZGNjY2JiYmFhYGBfXlxYU0w/MBZkZGRkZGRjY2NjYmJiYWFhYF9dWVROQTAWZGRkZGRkZGNjY2NiYmJiYWFfXVlWT0IwFmRkZGRkZGRkY2NjY2NjY2JiYF5aV1BCMBZkZGRkZGRkZGRkZGRkZGNjYmFfXVlRQzAWZGRkZGRkZGRkZGRkZGRkY2JiYF9bUkMwFmRkZGRkZGRkZGRkZGRkZGNjYmFfXFJDMBZkZGRkZGRkZGRkZGRkZGRjY2JhYFxSQzAWZGRkZGRkZGRkZGRkZGRkZGNjYV9cUkMwFmRkZGRkZGRkZGRkZGRkZGRjYmBdWVJDMBZkZGRkZGRkZGRkZGRkZGRkY2JgXFhRQzAWZGRkZGRkZGRkZGRkZGRkZGNhX1tXUUMwFmRkZGRkZGRkZGRkZGRkZGNiYV9bVlFDMBZkZGRkZGRkZGRkZGRkZGNjYmFeWlZRQzAWZGRkZGRkZGRkZGRkZGRjY2JgXlpVUUMwFmRkZGRkZGRkZGRkZGRkY2NiYF5bVVFDMBZkZGRkZGRkZGRkZGRkZGNjYmFfXFdRQzAWZGRkZGRkZGRkZGRkZGRjY2JhYF1YUUMwFmRkZGRkZGRkZGRkZGRkY2NiYWBdWVJDMBZkZGRkZGRkZGRkZGRkZGNjYmJgXVlSQzAWZGRkZGRkZGRkZGRkZGRkY2NiYF5ZUkMwFmRkZGRkZGRkZGRkZGRkZGNjYmFeWVJDMBZkZGRkZGRkZGRkZGRkZGRkY2JhXlpSQzAWZGRkZGRkZGRkZGRkZGRkZGNiYV9bUkMwFmRkZGRkZGRkZGRkZGRkZGRjYmFfW1JDMBZkZGRkZGRkZGRkZGRkZGRkY2JhX1tSQzAWZGRkZGRkZGRkZGRkZGRkZGNiYl9cUkMwFmRkZGRkZGRkZGRkZGRkZGRjY2JgXFJDMBZkZGRkZGRkZGRkZGRkZGRkY2NiYFxSQzAWZGRkZGRkZGRkZGRkZGRkZGNjYmBcUkMwFmRkZGRkZGRkZGRkZGRkZGRjY2JgXFJDMBZiYmJiYmJiYmJiYmJiYmJiYmFgXltSQzAW',
    summer_pm: 'BxEcJi00Nzk6Ojo7PDw9Pj4/Pz8/P0BAQBgvQU9YX2FjZGZnaGlqa2xsbW1ubm5ub28ZM0dVXmNmaGpsbm9xcnN0dXZ2d3d3d3d4GTNHVVxhZGdpa2xucHFzdHV1dnZ3d3d3dxkzR1VcYGNmaGpsbm9wcXN0dXV2dnZ3d3cZM0dVW19jZWdqa21vcHFyc3R1dXZ2dnd3GTNHVVtfYmVmaWpsbm9wcXNzdHV1dnZ2dhkzR1VbXmFjZWhqa21ub3Byc3N0dXV1dnYZM0dVWl5gY2VnaWpsbm9wcXJzdHR1dXV2GTNHVVpdX2JkZmhpa21ucHFyc3N0dHV1dRkzR1VaXF9hZGZoamttb3BxcnNzdHR1dXUZM0dVWVxfYmNmaGprbm9wcXJzc3R0dXV1GTNHVVlcX2FkZmlqbG5wcXFyc3N0dHV1dRkzR1VZXV9iZWdpa2xucHFycnN0dHR1dXUZM0dVWl1gYmVnaWttb3BxcnNzdHR1dXV1GTNHVVteYWNmZ2prbW9wcXJzc3R0dHV1dRkzR1VbXmFjZmhqa21vcHFyc3N0dHV1dXUZM0dVW15hY2Zoamxtb3BxcnNzdHR1dXV1GTNHVVxeYWNmaGpsbW9wcXJzc3R0dXV1dRkzR1VcX2JkZmhqbG1vcHFyc3N0dHV1dXUZM0dVXF9iZGZoamxtb3BxcnNzdHR1dXV2GTNHVVxfYmRmaGttbnBxcnJzdHR0dXV1dhkzR1VcX2JlaGttb3BxcXJzc3R0dXV1dXYZM0dVXF9kaWxub3BxcnJzc3R0dHV1dXV2GTNHVVxiZ2xucHFxcnNzc3R0dXV1dXV1dhkzR1VdZGlub3FycnNzdHR0dHV1dXV1dnYZM0dVXmVqbnBycnNzdHR0dXV1dXV2dnZ2GTNHVV5lam9xcnNzdHR1dXV1dnZ2dnZ2dhkzR1VeZmtwcnNzdHR1dXV1dnZ2dnZ2dncZM0dVX2ZrcHJzdHR1dXZ2dnZ2dnZ3d3d3GTNHVV9nbHBxc3R1dXZ2dnZ2d3d3d3d3dxkzR1VfZ2tucHJ0dXV2dnd3d3d3d3d3d3cZM0dVX2ZqbW9yc3R1dnZ3d3d3d3d3eHh4GTNHVV9lam1vcXN0dXZ2d3d3d3d3eHh4eBkzR1VfZWlsbnBxcnN0dXZ2d3d3d3d3d3gZM0dVX2VoamxubnBxc3R0dXV2dnZ3d3d3GTNHVV9jZmhpa21vcHFycnNzdHR1dnZ2dxkzR1VdYGNmaGpsbW5vcHBxcnNzdHR0dXUZM0dUW19hZWdpamtsbW5vcHBxcXJzc3R1GTNHVFpeYWRlZ2hpamtsbW5ub29xcXJzdBkzR1RaXV9hYmRmZ2hpamtrbW1ucHFxcnMZM0dVWFpcX2BiZGVmZmhpamxsbW9wcXJzGTNHUVVYWlxdX2BhY2VmaGlrbG1ub3BxchkzR09SVFZYWVxeX2JjZWdoamtsbm9wcXIZM0NJTE9SVVdaXF5gYmRmZ2lra21ub3FyGTM+REhMUFNVWFtdX2JkZWdpamttbm9wcRkzPEJGSk5RVFhaXF9hY2VmaGpqbG5vcXIZMzpARUlNUFNXWVxeYGJkZmhqa25vcHFyGTM5PkNHTE9SVlhbXV9iZGZpa2xub3BxchkzOD5CR0tOUVVYWl5gY2Zoamtsbm9wcXIZMzg9QkZKTlFVWVxgYmVmaGprbW5wcHFyGTM4PUJHS1FUWVxfYWNlZ2lqbG1tcHFxchkzOD5GTVJWWVxeYGJkZ2hpamxtbm9wcXIZMzlFTVFUV1pcXmFjZGZoaWpsbW5wcXJyGTM/SE1QVFZaXF5gYmRmZ2lrbG5vcHFycxkzQEdLUFNWWFteX2JkZmdpa2xub3BxcnMZM0BGSk5RVFhaXV9iY2VnaWttbnBxcnJzGTM/RElNUFRXWl1fYWRmaGpsbm9wcXJzcxkzPkNITFBTV1pcYGNlaGpsbm9wcXJyc3MZMz5DSExQVFhcX2NmaWtsbm9wcXFyc3N0GTM+Q0hNUlhdYmVoamttbm9wcXJyc3NzdBkzP0RJUFdeYmVoamxtb3BwcXJyc3NzdHQZM0BIT1hdYWVnamxtbnBwcXJyc3NzdHR0GTNDTFRbX2NmaGttbnBxcXJyc3N0dHR0dBkzRE9YXmJlZ2lsbm9wcXJyc3N0dHR1dXUZM0VRWmBjZmhqbW5vcHFxcnJzc3R0dHR1GTNFUlthZGdpa21ub3BwcXFycnNzc3NzdBkzRlNcYmVnaWprbG1ubnBwcHFxcnJycnMZM0ZUXWNlZmhpamprbW1ubm9vcHBwcHFyGTNHVF5iY2RmZmhpamtrbGxtbW1ub29wcRkzR1VcX2BhY2RmZ2hpaWpqa2xsbG1ub3AZM0dSWFxeX2JiY2VlZmZnaGlqa2tsbW5vGTNHT1VZXF1eX2BhYmNkZWZnaWlqbG1tbhkzR05TVldZWltcXl9hYmNlZWdoaWtsbW4ZM0VKTk9SU1ZXWVtcX2BiY2RmZ2hrbG5vGTI+Q0dKTU9SVVdZW11eYWJkZ2hqbG5vcBkxOj9DR0lMUFJVV1ldX2JkZmlrbW5vcHEZMDg9QURIS05RVFhcX2JkZ2lrbW5vcHFxGTA3Oz9DR0pOU1dbXmFkZ2hqbG1ucHBxchkvNTo+Q0hNUldbXmFjZWdpamxub3BxcXIZLzU6QUdNU1daXV9iZGZoaWtsbm9wcXJyGS81P0dOUlZZW15gYmRmaGprbW5vcHFxchkwO0ZMUFNWWVteYGJkZmhqa21ub3BxcnIZMT9HTFBSVlhbXmBjZWZoamttb3BwcXJyGTJBR0tPUlZYW15hY2VmaWttbm9wcXJychkyQUdLT1JWWVxfYWRnaGttbm9wcXFyc3MZMkJHS1BTV1lcYGNmaGlsbW9wcXFycnNzGTNDSExQU1dbX2JkZ2lrbW5vcHFycnNzdBkzQ0hMUlZaXWBjZWhqa21vcHFycnNzdHQZM0RLUFVYW19hZGZpamxtb3BxcnNzdHR0GTNFTVJWWV1gYmVnaWtsbnBxcnJzc3R0dRkzRk5TV1pdYWNkZ2lrbm9wcXJzc3R0dXUZM0ZOU1daXWBjZWdqa21vcXJyc3R0dHV1GTNGT1NWWl1gY2ZoamxucHFyc3N0dHR0dBkzRk5SVlpdYWNmaGxtb3BxcnJycnNzc3MZM0dOU1daXmFjZ2tsbm9vb3BwcHFxcXFyGTNHTlNXWl9jZ2lsbG1tbm5ub29vcHBwcRkzR05TWV1iZWdoaWpqa2tsbGxsbW5ub3AZM0dQWFxgY2RlZmZnaGhoaWlqa2xtbW5vGTNHUlpcXmBhYmNjZGRlZmdnaWlqbGxtbhkzR1NXWVtcXV5fYGBiYmRlZmhpamtsbG4ZM0dQU1RVV1haW11eYGFjZGVnaGlqa2xtGTNCR0tNUFJVV1hbXF5gYmNkZmdoamtsbRkxPEJGSk1PUlVXWVtdX2FjY2VnaGlqa20ZMDk+Q0dKTVBTVVhaXF5gYmNlZmdpa2xtGTA3PEFFSEtPUlRXWVtdX2FiZGZoamtsbRkvNjs/Q0dKTVBTVlhaXF5hYmVmaGlrbG0ZLzU5PkJGSExPUlVXWlxfYWJkZmhpa2xtGS80OT1BRUhLTlFVV1pcX2FiZGZoaWprbBkvNDg9QURHTE9SVVhaXV9hY2RmZmhpamsZLzQ4PUFFSU1QU1ZYWlxeX2BhYmNjZGRl'
  };
  var WINDOWS = { am: { label: 'Morning 7–12', hours: 5 }, pm: { label: 'Afternoon 11–17', hours: 6 } };
  function sunMap(period, w) {
    var b = atob(SUN_HOURS[period + '_' + w]), out = new Float32Array(b.length);
    for (var k = 0; k < b.length; k++) out[k] = b.charCodeAt(k) * 0.05;
    return out;
  }
  var PROGRAMMES = {
    G: { name: 'Green communal space', short: 'Green', color: '#9ccdcf' },
    T: { name: 'Temporal market', short: 'Temporal', color: '#ef9138' },
    P: { name: 'Stored market', short: 'Stored', color: '#262625' }
  };
  /* Zones, as in the occupation plan (01.14): west, middle and east band of every segment between
     bridges, segments from south to north. */
  var BANDS = [[0, 7], [7, 18], [18, 25]];
  var PRESETS = {
    pm: [['P', 'G', 'T'], ['P', 'T', 'G'], ['P', 'T', 'T'], ['P', 'T', 'G'], ['P', 'T', 'T']],
    am: [['T', 'G', 'P'], ['G', 'T', 'T'], ['T', 'G', 'T'], ['G', 'G', 'T'], ['G', 'G', 'P']]
  };
  var DEFAULT_PROG = PRESETS.pm;
  var SHADE0 = 0.15;                                          // a cell counts as shaded from 15 % of the opening hours
  var DEFAULT_CFG = { w: 'pm', cover: 1, period: 'day' };

  /* One sun optimization for the whole plot: the cells the city shades during the market's opening
     hours (at least 15 % of them), the deepest shade first; the deeper the shade, the taller the
     platform (1 to 3 layers; at the plot edge a 3 becomes 4, one box above the street).
     `cover` keeps that share of the shaded area, most shaded first.
     The zones only decide what appears on each cell of that optimization: permanent platforms,
     temporary tables (on shaded cells only) or, in green zones, trees. */
  function generate(bridges, prog, cfg) {
    var occ = new Uint8Array(NX * NY * NZ);
    var kind = new Uint8Array(NX * NY * NZ);                 // 1 permanent · 2 bridge · 3 temporary · 5 tree crown
    var use = new Uint8Array(NXY);                            // 0 passage · 1 green · 2 temporary · 3 permanent · 4 open ground
    var put = function (i, j, k, t) { occ[idx(i, j, k)] = 1; kind[idx(i, j, k)] = t; };
    var i, j, k, c, under = new Uint8Array(NXY);
    bridges.forEach(function (b) {
      for (j = b; j < b + BRIDGE_ROWS; j++) for (i = 0; i < NX; i++) { for (k = 0; k <= STREET; k++) put(i, j, k, 2); under[j * NX + i] = 1; }
    });
    var S = sunMap(cfg.period, cfg.w), WH = WINDOWS[cfg.w].hours;
    var shade = function (c) { return 1 - S[c] / WH; };

    /* 1 · the shaded ground, the same for every zone */
    var zone = new Uint8Array(NXY);
    for (c = 0; c < NXY; c++) if (!under[c] && shade(c) >= SHADE0) zone[c] = 1;
    var seen = new Uint8Array(NXY);
    for (c = 0; c < NXY; c++) {                               // drop specks of fewer than 4 cells
      if (!zone[c] || seen[c]) continue;
      var stack = [c], comp = []; seen[c] = 1;
      while (stack.length) {
        var q = stack.pop(); comp.push(q);
        var qi = q % NX, qj = (q - qi) / NX;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (e) {
          var ni = qi + e[0], nj = qj + e[1], n = nj * NX + ni;
          if (ni >= 0 && ni < NX && nj >= 0 && nj < NY && zone[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
        });
      }
      if (comp.length < 4) comp.forEach(function (q) { zone[q] = 0; });
    }
    if (cfg.cover < 1) {
      var cells = []; for (c = 0; c < NXY; c++) if (zone[c]) cells.push(c);
      cells.sort(function (a, b) { return shade(b) - shade(a); });
      for (k = Math.round(cells.length * cfg.cover); k < cells.length; k++) zone[cells[k]] = 0;
    }
    var height = function (c, cap) {
      return Math.min(cap, 1 + Math.floor(Math.pow((shade(c) - SHADE0) / (1 - SHADE0), 0.7) * 3));
    };

    /* 2 · the zones decide what stands on it */
    segments(bridges).forEach(function (sg, sI) {
      var a = sg[0], b = sg[1];
      BANDS.forEach(function (band, k3) {
        var code = (prog[sI] || DEFAULT_PROG[sI])[k3], i0 = band[0], i1 = band[1];
        for (j = a; j < b; j++) for (i = i0; i < i1; i++) {
          c = j * NX + i;
          if (code === 'G') {
            use[c] = 1;
            if ((j - a) % 3 === 1 && (i - i0) % 3 === 1 && j < b - 1) { put(i, j, 1, 5); put(i, j, 2, 5); }
          } else if (!zone[c]) use[c] = 4;
          else if (code === 'P') {
            var h = height(c, STREET);
            if (h === STREET && (i === 0 || i === NX - 1)) h = MAXH;
            use[c] = 3; for (k = 0; k < h; k++) put(i, j, k, 1);
          } else {
            use[c] = 2;                                       // tables of 3 × 2 cells with aisles, only in the shade
            if ((j - a) % 3 !== 2 && (i - i0) % 4 !== 3) for (k = 0, h = height(c, 2); k < h; k++) put(i, j, k, 3);
          }
        }
      });
    });

    /* Readout: for every zone, the sun hours its structures (platforms, tables, tree crowns) take away
       from the pavement during the opening hours: sun on the floor with the city only, minus sun with
       the structures as well, ray by ray every 15 minutes. The bridges are left out, as in the map. */
    var R = windowRays(cfg.w), nr = R.dirs.length, occA = new Uint8Array(occ.length);
    for (c = 0; c < occ.length; c++) occA[c] = occ[c] && kind[c] !== 2 ? 1 : 0;
    var per = {};
    [1, 2, 3, 4].forEach(function (u) { per[u] = { area: 0, n: 0, block: 0 }; });
    for (c = 0; c < NXY; c++) {
      var u = use[c]; if (!u) continue;
      i = c % NX; j = (c - i) / NX;
      var sCity = 0, sWith = 0, covered = occA[c];
      for (var r = 0; r < nr; r++) {
        if (R.stat[r * NXY + c]) continue;
        sCity += 0.25;
        if (!covered && clearOf(occA, i, j, R.dirs[r])) sWith += 0.25;
      }
      per[u].area += CX * CY; per[u].n++; per[u].block += sCity - sWith;
    }
    var vol = 0;
    for (c = 0; c < occ.length; c++) if (occ[c] && (kind[c] === 1 || kind[c] === 3)) vol += CX * CY * CZ;
    return { occ: occ, kind: kind, use: use, sun: S, per: per, vol: vol };
  }

  /* ── Vista ─────────────────────────────────────────────────── */
  function init(root) {
    var THREE = window.THREE, B = window.BlogStage;
    var canvas = root.querySelector('canvas');
    var status = root.querySelector('[data-read]');
    var stats = root.querySelector('[data-stats]');
    var optBtns = Array.prototype.slice.call(root.querySelectorAll('[data-opt]'));
    var coverIn = root.querySelector('[data-input="cover"]'), coverOut = root.querySelector('[data-output="cover"]');
    var progBox = root.querySelector('[data-prog]'), mini = root.querySelector('[data-mini]'), miniKey = root.querySelector('[data-mini-key]');
    var viewBtns = Array.prototype.slice.call(root.querySelectorAll('[data-view-mode]'));

    /* North at the top, as in the zone plan; the distance follows the shape of the canvas so the whole
       trench stays in view, from a wide desktop frame to a phone held upright. */
    var stage = new B.Stage(canvas, { radius: 440, azimuth: -0.2, elevation: 0.8, minElevation: 0.2, maxElevation: 1.5, far: 4000, shadowSize: 230 });
    stage.target.set(0, -3, 12);
    var R0 = 440;
    function frame(w, h) {
      var a = w / h;                                  // the field of view is vertical: the length always fits,
      stage.radius = Math.max(R0 * (a < 0.8 ? 1.06 : 1), 170 / a);   // only a very narrow frame needs more distance
      stage.placeCamera();
    }
    var aoResize = null;
    stage.onResize = function (w, h) { frame(w, h); if (aoResize) aoResize(w, h); };
    frame(canvas.clientWidth || 700, canvas.clientHeight || 780);
    stage.sun.position.set(140, 260, 100);
    stage.sun.shadow.mapSize.set(4096, 4096);
    var scene = stage.scene;

    /* Street level around the trench (the PLOT rectangle), the trench floor and, once loaded, the city. */
    var street = new THREE.MeshLambertMaterial({ color: 0xffffff });          // lit, it melts into the white page
    var white = new THREE.MeshLambertMaterial({ color: 0xf7f7f5 });
    var GX = 120, GZ0 = 270, GZ1 = 240, DEPTH = -FLOOR + 0.4;
    [[-W / 2 - (GX - W / 2) / 2, (GZ1 - GZ0) / 2, GX - W / 2, GZ0 + GZ1],
     [W / 2 + (GX - W / 2) / 2, (GZ1 - GZ0) / 2, GX - W / 2, GZ0 + GZ1],
     [0, -L / 2 - (GZ0 - L / 2) / 2, W, GZ0 - L / 2],
     [0, L / 2 + (GZ1 - L / 2) / 2, W, GZ1 - L / 2]].forEach(function (g) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(g[2], DEPTH, g[3]), street);
      m.position.set(g[0], -DEPTH / 2, g[1]); m.receiveShadow = true; m.castShadow = true; scene.add(m);
    });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshLambertMaterial({ color: 0xdcdbd6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; scene.add(floor);

    function addContext(ctx) {
      var g = new THREE.BufferGeometry(), P = new Float32Array(ctx.pos.length);
      for (var k = 0; k < P.length; k++) P[k] = ctx.pos[k] / 100;
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setIndex(new THREE.BufferAttribute(ctx.index, 1));
      g = g.toNonIndexed(); g.computeVertexNormals();               // faceted normals, also read by the occlusion pass
      var city = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xf4f4f2 }));
      city.castShadow = true; city.receiveShadow = true; scene.add(city);
      ctx.blocks.forEach(function (pts) {
        var sh = new THREE.Shape();
        for (var k = 0; k < pts.length; k += 2) { var x = pts[k] / 10, y = -pts[k + 1] / 10; if (k) sh.lineTo(x, y); else sh.moveTo(x, y); }
        var bg = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }); bg.rotateX(-Math.PI / 2);
        var bm = new THREE.Mesh(bg, white); bm.receiveShadow = true; scene.add(bm);
      });
      stage.request();
    }

    /* Mapa de radiación sobre el suelo. */
    var tileGeo = new THREE.PlaneGeometry(CX * 0.96, CY * 0.96); tileGeo.rotateX(-Math.PI / 2);
    var heat = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), NX * NY);
    var m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) { m4.makeTranslation(cxp(i), FLOOR + 0.03, czp(j)); heat.setMatrixAt(j * NX + i, m4); heat.setColorAt(j * NX + i, col.set(0xffffff)); }
    scene.add(heat);

    /* Cajas: cara blanca con el borde de la celda dibujado. */
    function edgeTex(fill, line) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = line; g.lineWidth = 5; g.strokeRect(2.5, 2.5, 59, 59);
      var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
    }
    var boxGeo = new THREE.BoxGeometry(CX, CZ, CY);
    var boxMat = new THREE.MeshLambertMaterial({ map: edgeTex('#f5f5f3', '#e0281f') });
    var bridgeMat = new THREE.MeshLambertMaterial({ map: edgeTex('#f6dedb', '#e0281f') });
    var shadeMat = new THREE.MeshLambertMaterial({ map: edgeTex('#fbf1e6', '#ef9138') });   // temporary stalls
    var CAP = NX * NY * NZ;
    var boxes = new THREE.InstancedMesh(boxGeo, boxMat, CAP);
    var bBoxes = new THREE.InstancedMesh(boxGeo, bridgeMat, NX * BRIDGE_ROWS * 2 * 4);
    var sBoxes = new THREE.InstancedMesh(boxGeo, shadeMat, NXY);
    var ghostMat = new THREE.MeshBasicMaterial({ color: 0x262625, transparent: true, opacity: 0.08, depthWrite: false });
    var ghost = new THREE.InstancedMesh(boxGeo, ghostMat, CAP);
    [boxes, bBoxes, sBoxes].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
    scene.add(ghost);

    /* Trees in the green bands: a trunk and a crown, white like the rest of the model. */
    var trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6), crownGeo = new THREE.IcosahedronGeometry(1, 1);
    var trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0xb9b6ae }), NXY);
    var crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0xf1f3ee }), NXY);
    [trunks, crowns].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; scene.add(m); });

    /* Estructura: pilares, vigas de borde, forjados y la cubierta como última capa. */
    var wood = new THREE.MeshLambertMaterial({ color: 0xf7f6f2 });
    var timber = new THREE.MeshLambertMaterial({ color: 0x8f8a80 });
    var posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1, 0.16), timber, 12000);
    var beams = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.22, 0.12), timber, 16000);
    var slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(CX, 0.1, CY), wood, CAP);
    var roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(CX + 0.3, 0.22, CY + 0.3), wood, NX * NY + 400);
    var struct = [posts, beams, slabs, roofs];
    struct.forEach(function (m) { m.castShadow = true; m.receiveShadow = true; scene.add(m); });

    /* Asas de los puentes, en rojo, sobre la calle a ambos lados de la trinchera. */
    var red = new THREE.MeshBasicMaterial({ color: 0xe0281f });
    var handleGeo = new THREE.CylinderGeometry(2.6, 2.6, 0.6, 28);
    var barGeo = new THREE.BoxGeometry(W + 8, 0.25, 0.5);
    var handles = [], pickables = [];
    for (var h = 0; h < 4; h++) {
      var grp = new THREE.Group();
      var bar = new THREE.Mesh(barGeo, red); bar.position.y = 0.2 + CZ;
      var hl = new THREE.Mesh(handleGeo, red), hr = new THREE.Mesh(handleGeo, red);
      hl.position.set(-(W / 2 + 4.2), 0.35, 0); hr.position.set(W / 2 + 4.2, 0.35, 0);
      [bar, hl, hr].forEach(function (m) { m.userData.bridge = h; grp.add(m); pickables.push(m); });
      scene.add(grp); handles.push(grp);
    }

    var bridges = INITIAL.slice(), mode = 'boxes', model = null;
    var q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    var fmt = function (n) { return Math.round(n).toLocaleString('en-GB'); };

    function ramp(t) {
      // gris → amarillo → naranja → rojo
      var stops = [[0, 0xd9d8d3], [0.45, 0xf2c14e], [0.75, 0xe8762b], [1, 0xc0281f]];
      for (var n = 1; n < stops.length; n++) if (t <= stops[n][0]) {
        var a = stops[n - 1], b = stops[n], u = (t - a[0]) / (b[0] - a[0]);
        return col.set(a[1]).lerp(new THREE.Color(b[1]), u);
      }
      return col.set(stops[stops.length - 1][1]);
    }

    function draw() {
      var occ = model.occ, kind = model.kind, n = [0, 0, 0, 0], g = 0;
      var meshes = [null, boxes, bBoxes, sBoxes];
      for (var k = 0; k < NZ; k++) for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
        var id = idx(i, j, k); if (!occ[id] || kind[id] === 5) continue;
        m4.makeTranslation(cxp(i), FLOOR + (k + 0.5) * CZ, czp(j));
        var t = kind[id], mesh = meshes[t];
        if (n[t] < mesh.instanceMatrix.count) mesh.setMatrixAt(n[t]++, m4);
        ghost.setMatrixAt(g++, m4);
      }
      boxes.count = n[1]; bBoxes.count = n[2]; sBoxes.count = n[3]; ghost.count = g;
      var nt = 0;
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        if (kind[idx(i, j, 1)] !== 5) continue;
        m4.compose(v.set(cxp(i), FLOOR + 1.1, czp(j)), q.set(0, 0, 0, 1), s.set(1, 2.2, 1)); trunks.setMatrixAt(nt, m4);
        m4.compose(v.set(cxp(i), FLOOR + 3.6, czp(j)), q.set(0, 0, 0, 1), s.set(1.8, 1.8, 1.8)); crowns.setMatrixAt(nt++, m4);
      }
      trunks.count = crowns.count = nt;

      /* Estructura a partir de la ocupación. */
      var np = 0, nb = 0, ns = 0, nr = 0, seen = {};
      var O = function (i, j, k) { return i >= 0 && i < NX && j >= 0 && j < NY && k >= 0 && k < NZ && occ[idx(i, j, k)] && kind[idx(i, j, k)] !== 5; };
      for (k = 0; k < NZ; k++) for (j = 0; j <= NY; j++) for (i = 0; i <= NX; i++) {
        var a = O(i - 1, j - 1, k), b = O(i, j - 1, k), c = O(i - 1, j, k), d = O(i, j, k);
        var cnt = a + b + c + d; if (!cnt) continue;
        var edge = cnt < 4, lattice = (i % 2 === 0 && j % 2 === 0);
        if (!(edge || lattice) || np >= 12000) continue;
        var x = (i - NX / 2) * CX, z = (NY / 2 - j) * CY;
        m4.compose(v.set(x, FLOOR + (k + 0.5) * CZ, z), q.set(0, 0, 0, 1), s.set(1, CZ, 1)); posts.setMatrixAt(np++, m4);
      }
      for (k = 0; k < NZ; k++) for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        if (!O(i, j, k)) continue;
        var y = FLOOR + (k + 1) * CZ, topFree = !O(i, j, k + 1);
        if (topFree) { if (nr < roofs.instanceMatrix.count) { m4.makeTranslation(cxp(i), y - 0.11, czp(j)); roofs.setMatrixAt(nr++, m4); } }
        else if (ns < CAP) { m4.makeTranslation(cxp(i), y - 0.05, czp(j)); slabs.setMatrixAt(ns++, m4); }
        // vigas solo en los bordes de cada planta
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (e) {
          if (O(i + e[0], j + e[1], k) || nb >= 16000) return;
          var horiz = e[0] === 0;
          var bx = cxp(i) + e[0] * CX / 2, bz = czp(j) - e[1] * CY / 2;
          q.setFromAxisAngle(up, horiz ? 0 : Math.PI / 2);
          m4.compose(v.set(bx, y - 0.26, bz), q, s.set(horiz ? CX : CY, 1, 1)); beams.setMatrixAt(nb++, m4);
        });
      }
      posts.count = np; beams.count = nb; slabs.count = ns; roofs.count = nr;
      [boxes, bBoxes, sBoxes, ghost, posts, beams, slabs, roofs, trunks, crowns].forEach(function (m) { m.instanceMatrix.needsUpdate = true; });

      paintFloor();

      handles.forEach(function (grp, b) { grp.position.z = czp(bridges[b] + BRIDGE_ROWS / 2 - 0.5); });
      applyMode();
    }

    /* Floor: programme colours (green zones, temporary market, permanent market, open ground). */
    var USE_COL = [0xd9d8d3, 0xc4e1e2, 0xf6cfa6, 0x8c8c88, 0xdedcd6];
    function paintFloor() {
      for (var c = 0; c < NXY; c++) heat.setColorAt(c, col.set(USE_COL[model.use[c]]));
      heat.instanceColor.needsUpdate = true;
    }
    function applyMode() {
      var isBox = mode === 'boxes', isStr = mode === 'structure';
      boxes.visible = bBoxes.visible = sBoxes.visible = isBox;
      struct.forEach(function (m) { m.visible = isStr; });
      ghost.visible = false; heat.visible = true;
      if (model) paintFloor();
      viewBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.viewMode === mode ? 'true' : 'false'); });
      stage.request();
    }

    var cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
    var prog = DEFAULT_PROG.map(function (r) { return r.slice(); });
    var h1 = function (x) { return x.toLocaleString('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 }); };
    function compute() {
      cfg.cover = Number(coverIn.value) / 100;
      coverOut.textContent = coverIn.value + ' %';
      optBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.opt === cfg.w ? 'true' : 'false'); });
      model = generate(bridges, prog, cfg);
      draw();
      var html = '';
      [['P', 3], ['T', 2], ['G', 1]].forEach(function (pp) {
        var r = model.per[pp[1]];
        html += '<div><span><i class="sw" style="background:' + PROGRAMMES[pp[0]].color + '"></i>' + PROGRAMMES[pp[0]].name + '</span>' +
          (r.n ? '<b>' + fmt(r.area) + ' m²</b><b class="hrs">−' + h1(r.block / r.n) + ' sun hours</b>' : '<b>—</b>') + '</div>';
      });
      stats.innerHTML = html;
      drawEditor(); drawMini();
    }

    /* Zone selector: the plot in plan and to scale along its length, north at the top, three bands per
       segment. Tap a band to change it; drag a bridge by its handles, or focus a handle and use the arrows. */
    var ORDER = ['G', 'T', 'P'];
    var pc = function (v) { return (v / NY * 100).toFixed(3) + '%'; };
    function drawEditor() {
      var segs = segments(bridges), html = '<div class="prog-plan" role="group" aria-label="Zones by segment, north at the top">';
      for (var sI = segs.length - 1; sI >= 0; sI--) {
        var sg = segs[sI];
        BANDS.forEach(function (band, k3) {
          var P = PROGRAMMES[prog[sI][k3]];
          html += '<button type="button" class="band" data-seg="' + sI + '" data-band="' + k3 + '" style="top:' + pc(NY - sg[1]) + ';height:' + pc(sg[1] - sg[0]) +
            ';left:' + (band[0] / NX * 100).toFixed(3) + '%;width:' + ((band[1] - band[0]) / NX * 100).toFixed(3) + '%;background:' + P.color +
            '" aria-label="Segment ' + (segs.length - sI) + ' from the north, ' + ['west', 'middle', 'east'][k3] + ' band: ' + P.name + '. Tap to change." title="' + P.name + '"></button>';
        });
      }
      for (var n = bridges.length - 1; n >= 0; n--) {
        html += '<div class="prog-bridge" data-bridge="' + n + '" style="top:' + pc(NY - bridges[n] - BRIDGE_ROWS) + ';height:' + pc(BRIDGE_ROWS) + '">' +
          '<span class="bh-bar"></span>' +
          '<button type="button" class="bh bh-w" data-bridge="' + n + '" aria-label="Bridge ' + (bridges.length - n) + ' from the north. Drag it, or use the up and down arrows, to move it along the trench."></button>' +
          '<span class="bh bh-e" aria-hidden="true"></span></div>';
      }
      html += '</div><ul class="prog-key">' + ORDER.map(function (c) { return '<li><i class="sw" style="background:' + PROGRAMMES[c].color + '"></i>' + PROGRAMMES[c].short + '</li>'; }).join('') + '</ul>';
      progBox.innerHTML = html;
      if (pdrag) progBox.querySelector('.prog-plan').classList.add('is-dragging');
    }
    progBox.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-seg]'); if (!b) return;
      var sI = Number(b.dataset.seg), k3 = Number(b.dataset.band);
      prog[sI][k3] = ORDER[(ORDER.indexOf(prog[sI][k3]) + 1) % 3];
      compute();
      var again = progBox.querySelector('button[data-seg="' + sI + '"][data-band="' + k3 + '"]'); if (again) again.focus();
    });
    /* The plan is redrawn while a bridge moves, so the pointer is held by the plan's box, which stays. */
    var pdrag = null;
    function rowAt(clientY) {
      var rc = progBox.querySelector('.prog-plan').getBoundingClientRect();
      return Math.round(NY - (clientY - rc.top) / rc.height * NY - BRIDGE_ROWS / 2);
    }
    progBox.addEventListener('pointerdown', function (e) {
      var h = e.target.closest('[data-bridge]'); if (!h || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      pdrag = { b: Number(h.dataset.bridge), id: e.pointerId, off: rowAt(e.clientY) - bridges[Number(h.dataset.bridge)] };
      progBox.setPointerCapture(e.pointerId);
      progBox.querySelector('.prog-plan').classList.add('is-dragging');
    });
    progBox.addEventListener('pointermove', function (e) {
      if (!pdrag || e.pointerId !== pdrag.id) return;
      if (place(pdrag.b, rowAt(e.clientY) - pdrag.off)) later();
    });
    function endPlan(e) {
      if (!pdrag || e.pointerId !== pdrag.id) return;
      pdrag = null;
      var pl = progBox.querySelector('.prog-plan'); if (pl) pl.classList.remove('is-dragging');
    }
    progBox.addEventListener('pointerup', endPlan);
    progBox.addEventListener('pointercancel', endPlan);
    progBox.addEventListener('keydown', function (e) {
      var h = e.target.closest('button[data-bridge]'); if (!h) return;
      var n = Number(h.dataset.bridge), d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      if (place(n, bridges[n] + d)) compute();
      var again = progBox.querySelector('button[data-bridge="' + n + '"]'); if (again) again.focus();
    });

    /* Miniature: the sun-hour map of the chosen opening time, white = most sun, with the market on it. */
    function drawMini() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = mini.clientWidth || 168, h = mini.clientHeight || 420;
      mini.width = Math.round(w * dpr); mini.height = Math.round(h * dpr);
      var g = mini.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var S = model.sun, lo = Infinity, hi = -Infinity, cw = w / NX, ch = h / NY;
      for (var k = 0; k < NXY; k++) { if (S[k] < lo) lo = S[k]; if (S[k] > hi) hi = S[k]; }
      for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
        var c = j * NX + i, y = (NY - 1 - j) * ch, x = i * cw;
        if (!model.use[c]) { g.fillStyle = '#dcdcd8'; g.fillRect(x, y, cw + 0.5, ch + 0.5); continue; }
        var v = Math.round(255 * (0.08 + 0.92 * (S[c] - lo) / Math.max(1e-6, hi - lo)));
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, y, cw + 0.5, ch + 0.5);
      }
      /* The market's limit (stored and temporal together) as one dashed line: cell edges between market and
         non-market, merged into straight runs so the dashes stay even. */
      var mk = function (i, j) { return i >= 0 && i < NX && j >= 0 && j < NY && (model.use[j * NX + i] === 2 || model.use[j * NX + i] === 3); };
      g.beginPath();
      for (j = 0; j <= NY; j++) {                     // horizontal edges, between rows j-1 and j
        var run = -1;
        for (i = 0; i <= NX; i++) {
          var e = i < NX && mk(i, j - 1) !== mk(i, j);
          if (e && run < 0) run = i;
          if (!e && run >= 0) { var yy = (NY - j) * ch; g.moveTo(run * cw, yy); g.lineTo(i * cw, yy); run = -1; }
        }
      }
      for (i = 0; i <= NX; i++) {                     // vertical edges, between columns i-1 and i
        var run2 = -1;
        for (j = 0; j <= NY; j++) {
          var e2 = j < NY && mk(i - 1, j) !== mk(i, j);
          if (e2 && run2 < 0) run2 = j;
          if (!e2 && run2 >= 0) { var xx = i * cw; g.moveTo(xx, (NY - run2) * ch); g.lineTo(xx, (NY - j) * ch); run2 = -1; }
        }
      }
      g.setLineDash([4, 3]); g.lineWidth = 1.6; g.strokeStyle = '#262625'; g.stroke(); g.setLineDash([]);
      miniKey.innerHTML = 'July 25th · ' + (cfg.w === 'am' ? '7–12' : '11–17') + '<br>white = more sun';
    }
    optBtns.forEach(function (b) { b.addEventListener('click', function () {
      cfg.w = b.dataset.opt; prog = PRESETS[cfg.w].map(function (r) { return r.slice(); }); compute();
    }); });
    coverIn.addEventListener('input', compute);

    /* Arrastrar un puente por la trinchera. */
    var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    var dragging = -1, pending = false;
    function later() {
      handles.forEach(function (grp, b) { grp.position.z = czp(bridges[b] + BRIDGE_ROWS / 2 - 0.5); });
      stage.request();
      if (!pending) { pending = true; requestAnimationFrame(function () { pending = false; compute(); }); }
    }
    function pick(e) {
      var rc = canvas.getBoundingClientRect();
      ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
      ray.setFromCamera(ptr, stage.camera);
    }
    function place(b, row) {
      var lo = b === 0 ? END_GAP : bridges[b - 1] + BRIDGE_ROWS + MIN_GAP;
      var hi = b === 3 ? NY - END_GAP - BRIDGE_ROWS : bridges[b + 1] - BRIDGE_ROWS - MIN_GAP;
      row = Math.max(lo, Math.min(hi, row));
      if (row === bridges[b]) return false;
      bridges[b] = row; return true;
    }
    canvas.parentElement.addEventListener('pointerdown', function (e) {
      if (e.target !== canvas || e.button !== 0 || e.pointerType === 'touch') return;
      pick(e);
      var h = ray.intersectObjects(pickables, false)[0];
      if (!h) return;
      dragging = h.object.userData.bridge;
      e.stopPropagation(); e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }, true);
    canvas.addEventListener('pointermove', function (e) {
      pick(e);
      if (dragging < 0) {
        canvas.style.cursor = ray.intersectObjects(pickables, false).length ? 'grab' : '';
        return;
      }
      if (!ray.ray.intersectPlane(plane, hit)) return;
      var row = Math.round(NY / 2 - hit.z / CY - BRIDGE_ROWS / 2);
      if (place(dragging, row)) later();
    });
    function release() { if (dragging >= 0) { dragging = -1; canvas.style.cursor = ''; } }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    viewBtns.forEach(function (b) { b.addEventListener('click', function () { mode = b.dataset.viewMode; applyMode(); }); });

    compute();
    stage.whenVisible();

    /* Ambient occlusion: soft contact shade where boxes, terraces, walls and buildings meet.
       Screen-space (SSAOPass from the three.js r128 examples); without it the scene renders as before. */
    var EX = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
    var AO_FILES = ['shaders/CopyShader.js', 'shaders/SSAOShader.js', 'math/SimplexNoise.js', 'postprocessing/EffectComposer.js', 'postprocessing/SSAOPass.js'];
    function loadScript(src) {
      return new Promise(function (ok, fail) { var t = document.createElement('script'); t.src = src; t.onload = ok; t.onerror = fail; document.head.appendChild(t); });
    }
    AO_FILES.reduce(function (p, f) { return p.then(function () { return loadScript(EX + f); }); }, Promise.resolve()).then(function () {
      if (!THREE.SSAOPass) return;
      scene.background = new THREE.Color(0xffffff);                 // same white as the page
      stage.camera.near = 2; stage.camera.far = 1000; stage.camera.updateProjectionMatrix();
      THREE.SSAOShader.fragmentShader = THREE.SSAOShader.fragmentShader
        .replace('vec3( 1.0 - occlusion )', 'vec3( 1.0 - 0.85 * occlusion )')
        .replace('float viewZ = getViewZ( depth );', 'if ( depth >= 0.9999 ) { gl_FragColor = vec4( 1.0 ); return; }\n\t\t\tfloat viewZ = getViewZ( depth );');   // the empty sky stays as white as the page
      var dpr = stage.renderer.getPixelRatio();
      var w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
      var ao = new THREE.SSAOPass(scene, stage.camera, w * dpr, h * dpr);
      ao.kernelRadius = 3.2; ao.kernelSize = 24;
      ao.minDistance = 0.0004; ao.maxDistance = 0.008;
      ao.renderToScreen = true;
      ao.normalRenderTarget.depthTexture.type = THREE.UnsignedIntType;   // 32-bit depth: no banding on long flat surfaces
      ao.beautyRenderTarget.texture.encoding = THREE.sRGBEncoding;
      if (stage.renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) {
        var rt = new THREE.WebGLMultisampleRenderTarget(w * dpr, h * dpr, { format: THREE.RGBAFormat, encoding: THREE.sRGBEncoding });
        ao.beautyRenderTarget.dispose(); ao.beautyRenderTarget = rt;
        ao.ssaoMaterial.uniforms.tDiffuse.value = rt.texture;
      }
      var hide = [ghost, heat];   // the floor tiles and the ghost boxes stay out of the occlusion
      var ov = ao.overrideVisibility;
      ao.overrideVisibility = function () { ov.call(this); hide.forEach(function (m) { m.visible = false; }); };
      aoResize = function (w, h) { var d = stage.renderer.getPixelRatio(); ao.setSize(w * d, h * d); };
      stage.draw = function () { ao.render(stage.renderer, null); };
      stage.request();
    }).catch(function () {});

    if (root.dataset.src) {
      var base = '';
      status.textContent = 'Loading the city around the plot…';
      fetch(root.dataset.src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
        var bin = atob(j.data), u8 = new Uint8Array(bin.length);
        for (var k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
        var buf = u8.buffer;
        var ctx = parseContext(buf);
        addContext(ctx);
        setContext(ctx);
        status.textContent = base;
        compute();
      }).catch(function () {
        status.textContent = 'The city context could not be loaded; the sun is computed with the trench walls only.';
      });
    }
  }

  (window.BlogTools = window.BlogTools || {}).synergism = init;
  if (typeof module !== 'undefined') module.exports = { DEFAULT_CFG: DEFAULT_CFG, PRESETS: PRESETS, generate: generate, setPeriod: setPeriod, parseContext: parseContext, setContext: setContext, rmax: function () { return RMAX; }, NX: NX, NY: NY };
})();
