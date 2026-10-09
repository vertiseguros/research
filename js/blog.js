/* Notas de investigación: una página, varias vistas.
   #synergism, #ease y #latent-studio abren cada entrada; sin almohadilla se ve la portada.
   Las entradas sin publicar (data-published="false") no salen en la portada, pero su enlace funciona.
   Con ONLY puesto se ve solo esa nota: sin portada, sin las demás, y la flecha de volver no hace nada.
   Para recuperar la portada, dejar ONLY = ''. */
(function () {
  var ONLY = 'synergism';
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var views = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── three.js bajo demanda ─────────────────────────────────── */
  var threeReady = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    if (threeReady) return threeReady;
    threeReady = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = THREE_URL; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    return threeReady;
  }
  function startTool(view) {
    var tool = view.querySelector('.tool');
    if (!tool || tool.dataset.started) return;
    tool.dataset.started = '1';
    loadThree().then(function () {
      var init = window.BlogTools && window.BlogTools[tool.dataset.tool];
      if (init) init(tool);
    }).catch(function () {
      var r = tool.querySelector('[data-read]');
      if (r) r.textContent = 'three.js could not be loaded. Reload the page to see the tool.';
    });
  }

  /* ── Vistas ────────────────────────────────────────────────── */
  function show() {
    var id = location.hash.replace('#', '');
    if (ONLY) id = ONLY;
    var target = views.filter(function (v) { return v.dataset.view === id; })[0] || views[0];
    views.forEach(function (v) { v.hidden = v !== target; });
    document.title = target.dataset.title || document.title;
    window.scrollTo(0, 0);
    target.querySelectorAll('.rail').forEach(function (r) { if (r._update) { r.scrollLeft = 0; r._update(); } });
    if (target.querySelector('.tool')) startTool(target);
  }
  window.addEventListener('hashchange', show);
  if (ONLY) document.querySelectorAll('a[href="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* Los enlaces entre notas que apuntan a entradas sin publicar se ocultan */
  document.querySelectorAll('.entries [data-published="false"] a').forEach(function (a) {
    document.querySelectorAll('.post-nav a[href="' + a.getAttribute('href') + '"]').forEach(function (l) { l.hidden = true; });
  });

  /* ── Mesas de láminas ──────────────────────────────────────── */
  document.querySelectorAll('[data-goto]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = document.getElementById(b.dataset.goto);
      if (el) el.closest('.tool').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });
  document.querySelectorAll('.rail-block').forEach(function (post) {
    var rail = post.querySelector('.rail');
    if (!rail) return;
    var plates = Array.prototype.slice.call(rail.querySelectorAll('.plate'));
    var count = post.querySelector('.count');
    var prev = post.querySelector('[data-dir="-1"]');
    var next = post.querySelector('[data-dir="1"]');
    var inset = function () { return plates[0].offsetLeft; };
    function current() {
      var x = rail.scrollLeft + inset() + 2, idx = 0;
      plates.forEach(function (p, i) { if (p.offsetLeft <= x) idx = i; });
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2) idx = plates.length - 1;
      return idx;
    }
    function update() {
      count.textContent = pad(current() + 1) + ' / ' + pad(plates.length);
      prev.disabled = rail.scrollLeft <= 1;
      next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
    }
    rail._update = update;
    function go(dir) {
      var i = current();
      if (dir < 0 && rail.scrollLeft > plates[i].offsetLeft - inset() + 2) dir = 0;
      var target = plates[Math.max(0, Math.min(plates.length - 1, i + dir))];
      rail.scrollTo({ left: target.offsetLeft - inset(), behavior: reduce ? 'auto' : 'smooth' });
    }
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    var drag = null;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: rail.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; rail.classList.add('is-dragging'); }
      if (drag.moved) rail.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      var moved = drag.moved; drag = null;
      rail.classList.remove('is-dragging');
      if (moved) { rail.dataset.justDragged = '1'; setTimeout(function () { delete rail.dataset.justDragged; }, 0); }
    });
    rail.addEventListener('click', function (e) { if (rail.dataset.justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  /* ── Lámina ampliada ───────────────────────────────────────── */
  var dialog = document.querySelector('dialog.zoom');
  var big = dialog.querySelector('.zoom-stage img');
  var cap = dialog.querySelector('.zoom-cap');
  var title = dialog.querySelector('.zoom-title');
  var list = [], at = 0;
  function showPlate(i) {
    at = (i + list.length) % list.length;
    var fig = list[at], img = fig.querySelector('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    big.className = fig.classList.contains('photo') ? 'photo' : '';
    cap.innerHTML = fig.querySelector('figcaption').innerHTML;
    title.textContent = fig.closest('.post').querySelector('h1').textContent;
  }
  document.querySelectorAll('.plate button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var fig = btn.closest('.plate');
      list = Array.prototype.slice.call(fig.closest('.post').querySelectorAll('.plate'));
      showPlate(list.indexOf(fig));
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    });
  });
  function close() { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); }
  dialog.querySelector('.zoom-close').addEventListener('click', close);
  dialog.querySelector('.zoom-stage').addEventListener('click', close);
  dialog.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () { showPlate(at + Number(b.dataset.step)); });
  });
  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') showPlate(at + 1);
    if (e.key === 'ArrowLeft') showPlate(at - 1);
  });

  show();
})();
