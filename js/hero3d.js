/*
 * Home-page hero: a mouza of low-poly plots on an ink-navy field with one plot's document history stacked above it.
 * Data comes from window.SutroHero (built by app.js from demo case B via the real engine): cards (documents), years.
 * Interactions: drag or arrow keys to rotate; hover a document to see which it is; click to open it in Intake;
 * the page's year slider fades documents later than the chosen year (SutroHero.onYear). Illustrative only.
 * Falls back to the inline SVG when WebGL is unavailable, the viewport is narrow, or reduced motion is set.
 */
(function () {
  'use strict';
  const host = document.getElementById('hero3d');
  const fallback = document.getElementById('hero-fallback');
  const hoverEl = document.getElementById('hero-hover');
  if (!host) return;
  const H = window.SutroHero || { cards: [], caseId: 'demo-b' };
  const narrow = window.matchMedia('(max-width: 720px)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (narrow || reduced || !hasGL || typeof THREE === 'undefined') { host.hidden = true; fallback.hidden = false; return; }
  fallback.hidden = true;

  const W = () => host.clientWidth, Hh = () => host.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.setSize(W(), Hh()); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, W() / Hh(), 0.1, 100); camera.position.set(7.5, 6.3, 9); camera.lookAt(0, 0.9, 0);
  scene.add(new THREE.HemisphereLight(0xe8eef5, 0x1a2a3a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2dc, 0.8); sun.position.set(4, 8, 3); scene.add(sun);
  const css = getComputedStyle(document.documentElement);
  const col = (v, d) => new THREE.Color((css.getPropertyValue(v) || d).trim() || d);
  const copper = col('--copper', '#b65a2e'), paper = col('--sheet', '#fffdf8'), ink = col('--navy', '#0f1f2e'), rule = col('--rule', '#c9bfaa');
  const fieldCols = [0x2f4a5e, 0x355369, 0x3b5d73, 0x2a4458, 0x416680];

  /* ---- Plots: a jittered grid of extruded quads (seeded so the scene is stable) ---- */
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const group = new THREE.Group(); scene.add(group);
  const COLS = 7, ROWS = 5, S = 1.25; const verts = [];
  for (let r = 0; r <= ROWS; r++) { verts[r] = []; for (let c = 0; c <= COLS; c++) { const edge = r === 0 || r === ROWS || c === 0 || c === COLS; const j = edge ? 0 : 0.22; verts[r][c] = [(c - COLS / 2) * S + (rnd() - 0.5) * j, (r - ROWS / 2) * S + (rnd() - 0.5) * j]; } }
  const plots = []; const focus = { r: 2, c: 3 };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = [verts[r][c], verts[r][c + 1], verts[r + 1][c + 1], verts[r + 1][c]];
    const shape = new THREE.Shape(); shape.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) shape.lineTo(p[i][0], p[i][1]); shape.closePath();
    const isFocus = r === focus.r && c === focus.c;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: isFocus ? 0.28 : 0.12 + rnd() * 0.08, bevelEnabled: false });
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: isFocus ? copper : fieldCols[(r * COLS + c) % fieldCols.length] })); m.rotation.x = -Math.PI / 2; group.add(m);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: isFocus ? 0xfff1e6 : 0x6f8aa3, transparent: true, opacity: isFocus ? 0.95 : 0.45 })); edges.rotation.x = -Math.PI / 2; group.add(edges);
    plots.push({ mesh: m, isFocus, cx: p.reduce((a, q) => a + q[0], 0) / 4, cz: p.reduce((a, q) => a + q[1], 0) / 4 });
  }
  const fp = plots.find((p) => p.isFocus);

  /* ---- Document cards above the focus plot (one per supplied document, in year order) ---- */
  const list = H.cards && H.cards.length ? H.cards : [{ label: 'SA 1962', year: 1962 }, { label: 'Heir 1985', year: 1985 }, { label: 'BS 1998', year: 1998 }, { label: 'Deed 2011', year: 2011 }];
  function cardTexture(text, accent) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 160; const g = c.getContext('2d');
    g.fillStyle = '#' + paper.getHexString(); g.fillRect(0, 0, 320, 160); g.strokeStyle = '#' + rule.getHexString(); g.lineWidth = 3; g.strokeRect(3, 3, 314, 154);
    g.fillStyle = '#' + (accent ? copper : rule).getHexString(); g.fillRect(16, 16, 64, 7);
    g.fillStyle = '#' + ink.getHexString(); g.font = '600 26px "Fraunces", "Noto Serif Bengali", "Nirmala UI", Georgia, serif'; g.fillText(String(text).slice(0, 24), 16, 72);
    g.fillStyle = '#' + rule.getHexString(); for (let i = 0; i < 4; i++) g.fillRect(16, 94 + i * 14, 150 + (i % 2) * 70, 4);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  const cards = []; const stack = new THREE.Group(); stack.position.set(fp.cx, 0, fp.cz); group.add(stack);
  list.forEach((c, i) => {
    const y = 1.1 + i * 0.8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: cardTexture(c.label, i === list.length - 1), transparent: true, opacity: 1 }));
    mesh.position.set(0.1 * (i % 2 ? 1 : -1), y, 0); mesh.rotation.y = -0.6; stack.add(mesh); cards.push({ mesh, y, i, id: c.id, year: c.year, label: c.label, scale: 1 });
  });
  const linePts = [new THREE.Vector3(0, 0.3, 0)]; cards.forEach((c) => linePts.push(new THREE.Vector3(c.mesh.position.x, c.y - 0.43, 0)));
  stack.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineDashedMaterial({ color: 0xe39a6f, dashSize: 0.12, gapSize: 0.08 })).computeLineDistances());
  [[2, 2], [1, 3]].map(([r, c]) => plots[r * COLS + c]).forEach((p) => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(fp.cx, 0.3, fp.cz), new THREE.Vector3((fp.cx + p.cx) / 2, 0.9, (fp.cz + p.cz) / 2), new THREE.Vector3(p.cx, 0.22, p.cz));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), new THREE.LineBasicMaterial({ color: 0xe39a6f, transparent: true, opacity: 0.8 }))); p.mesh.material.color.lerp(copper, 0.35);
  });

  /* ---- Interaction ---- */
  let targetRot = 0.35, rot = 0.35, dragging = false, lastX = 0, downX = 0, downY = 0, running = true, auto = true, hovered = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) { const r = host.getBoundingClientRect(); ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1; ray.setFromCamera(ndc, camera); const hits = ray.intersectObjects(cards.map((c) => c.mesh)); return hits.length ? cards.find((c) => c.mesh === hits[0].object) : null; }
  function setHover(c) {
    if (c === hovered) return; hovered = c;
    if (hoverEl) { if (c) { hoverEl.textContent = `${c.label} · ${c.year} ↗`; hoverEl.classList.add('show'); } else hoverEl.classList.remove('show'); }
    host.style.cursor = c ? 'pointer' : 'grab';
  }
  host.addEventListener('pointerdown', (e) => { dragging = true; lastX = downX = e.clientX; downY = e.clientY; auto = false; try { host.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } });
  host.addEventListener('pointermove', (e) => { if (dragging) { targetRot += (e.clientX - lastX) * 0.006; lastX = e.clientX; } else setHover(pick(e)); });
  host.addEventListener('pointerleave', () => setHover(null));
  const stop = () => { dragging = false; setTimeout(() => { auto = true; }, 4000); };
  host.addEventListener('pointerup', (e) => { const moved = Math.hypot(e.clientX - downX, e.clientY - downY) > 5; stop(); if (!moved) { const c = pick(e); if (c && c.id) location.href = `intake.html?case=${encodeURIComponent(H.caseId)}#doc-${encodeURIComponent(c.id)}`; } });
  host.addEventListener('pointercancel', stop);
  host.setAttribute('tabindex', '0'); host.setAttribute('role', 'img');
  host.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { targetRot -= 0.15; auto = false; } if (e.key === 'ArrowRight') { targetRot += 0.15; auto = false; } });
  H.onYear = (y) => cards.forEach((c) => { c.mesh.material.opacity = (c.year === undefined || c.year <= y) ? 1 : 0.15; });
  if ('IntersectionObserver' in window) new IntersectionObserver((en) => { running = en[0].isIntersecting; if (running) tick(); }, { threshold: 0.05 }).observe(host);
  window.addEventListener('resize', () => { renderer.setSize(W(), Hh()); camera.aspect = W() / Hh(); camera.updateProjectionMatrix(); });
  const t0 = performance.now();
  function tick() {
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    if (auto && !dragging) targetRot += 0.0016;
    rot += (targetRot - rot) * 0.08; group.rotation.y = rot;
    cards.forEach((c) => { const target = c === hovered ? 1.12 : 1; c.scale += (target - c.scale) * 0.2; c.mesh.scale.setScalar(c.scale); c.mesh.position.y = c.y + Math.sin(t * 1.1 + c.i) * 0.03; c.mesh.rotation.y = -0.6 - rot; });
    renderer.render(scene, camera); requestAnimationFrame(tick);
  }
  tick();
})();
