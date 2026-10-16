/* Model-results page: everything shown here is read from artifacts/runs/index.json and the per-run files.
   Missing values render as "Not measured". No numbers are hard-coded. */
(function (root) {
  'use strict';
  const { i18n } = root.Sutro;
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let lang = 'en'; const T = (k, p) => i18n.t(lang, k, p); const D = (s) => i18n.digits(s, lang);
  const pct = (v) => (v === undefined || v === null || Number.isNaN(v)) ? T('notMeasured') : D((v * 100).toFixed(2) + '%');
  const num = (v, d) => (v === undefined || v === null) ? T('notMeasured') : D(Number(v).toFixed(d === undefined ? 4 : d));

  async function getJSON(url) { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; } }
  async function getText(url) { try { const r = await fetch(url); return r.ok ? await r.text() : null; } catch (e) { return null; } }

  /* minimal SVG line chart; series = [{label, values:[{x,y}], color}] */
  function lineChart(series, opts) {
    const W = 560, H = 220, L = 46, R = 12, Tp = 14, B = 34;
    const xs = series.flatMap((s) => s.values.map((v) => v.x)), ys = series.flatMap((s) => s.values.map((v) => v.y));
    if (!xs.length) return `<p class="none">${esc(T('notMeasured'))}</p>`;
    const x0 = Math.min(...xs), x1 = Math.max(...xs), yMin = opts.yMin !== undefined ? opts.yMin : Math.min(0, ...ys), yMax = opts.yMax !== undefined ? opts.yMax : Math.max(...ys) * 1.05 || 1;
    const sx = (x) => L + (x1 === x0 ? 0 : (x - x0) / (x1 - x0)) * (W - L - R), sy = (y) => Tp + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - Tp - B);
    const ticks = 4; let g = '';
    for (let i = 0; i <= ticks; i++) { const y = yMin + (yMax - yMin) * i / ticks; g += `<line x1="${L}" x2="${W - R}" y1="${sy(y)}" y2="${sy(y)}" class="grid"/><text x="${L - 6}" y="${sy(y) + 4}" class="tick" text-anchor="end">${esc(D(opts.fmt ? opts.fmt(y) : y.toFixed(2)))}</text>`; }
    const xt = Math.min(x1 - x0, 8) || 1;
    for (let i = 0; i <= xt; i++) { const x = x0 + Math.round((x1 - x0) * i / xt); g += `<text x="${sx(x)}" y="${H - 12}" class="tick" text-anchor="middle">${esc(D(x))}</text>`; }
    const paths = series.map((s) => `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${s.values.map((v) => `${sx(v.x).toFixed(1)},${sy(v.y).toFixed(1)}`).join(' ')}"/>`).join('');
    const legend = series.map((s, i) => `<g transform="translate(${L + i * 170},${H - 2})"><rect width="12" height="3" y="-6" fill="${s.color}"/><text x="16" class="tick">${esc(s.label)}</text></g>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(opts.title || '')}"><text x="${L}" y="10" class="tick ttl">${esc(opts.title || '')}</text>${g}${paths}${legend}</svg>`;
  }

  function confusion(cm, mode) {
    if (!cm || !cm.matrix) return `<p class="none">${esc(T('notMeasured'))}</p>`;
    const labels = cm.labels_bn || cm.labels; const M = cm.matrix; const rowSum = M.map((r) => r.reduce((a, b) => a + b, 0));
    const cell = (i, j) => { const v = M[i][j]; const f = rowSum[i] ? v / rowSum[i] : 0; const shown = mode === 'raw' ? D(v) : D((f * 100).toFixed(1)); const a = (mode === 'raw' ? (v / Math.max(1, Math.max(...M.flat()))) : f);
      return `<td style="background:rgba(11,93,59,${(a * 0.85).toFixed(3)});color:${a > 0.5 ? '#fff' : 'inherit'}${i === j ? ';font-weight:600' : ''}">${shown}</td>`; };
    return `<div class="table-wrap"><table class="cm"><thead><tr><th>${esc(T('truth'))}</th>${labels.map((l) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${M.map((r, i) => `<tr><th>${esc(labels[i])}</th>${r.map((_, j) => cell(i, j)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function md(text) { // tiny markdown: headings, bold, code, line breaks
    return esc(text).replace(/^# (.*)$/gm, '<strong>$1</strong>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
  }

  async function renderRun(run, main) {
    const dir = run.dir.replace(/\/$/, '');
    const [cfg, dm, hist, met, cm, card] = await Promise.all([getJSON(dir + '/config.json'), getJSON(dir + '/dataset_manifest.json'), getJSON(dir + '/history.json'), getJSON(dir + '/metrics.json'), getJSON(dir + '/confusion_matrix.json'), getText(dir + '/model_card.md')]);
    const status = (met && met.smoke) ? 'smoke' : (met && met.status) || run.status || 'failed';
    const t = met && met.test ? met.test : null;
    const kv = (k, v) => `<div class="kv"><dt>${esc(T(k))}</dt><dd>${v}</dd></div>`;
    const timing = met && (met.inference_ms_per_line || met.inference_ms_per_image);
    let head = `<section class="card"><div class="run-head"><h2>${esc(run.id)}</h2><span class="tag ${status === 'completed' ? 'ok' : status === 'smoke' ? 'warn' : 'unk'}">${esc(T('status_' + status))}</span>${run.active ? `<span class="tag ok">${esc(T('activeInference'))}</span>` : `<span class="tag neutral">${esc(T('notActive'))}</span>`}</div>
      <dl class="kvs">${kv('mTask', esc(cfg && cfg.task || met && met.task || T('notMeasured')))}${kv('mModel', esc(cfg && cfg.model || T('notMeasured')))}${kv('mData', esc(dm && dm.source || T('notMeasured')))}
      ${kv('mSplit', dm ? `${D(dm.n_train)} / ${D(dm.n_val)} / ${D(dm.n_test)}` : T('notMeasured'))}${kv('mGrouping', esc(dm && dm.grouping || T('notMeasured')))}${kv('mDevice', esc(cfg && cfg.device || T('notMeasured')))}
      ${kv('mEpochs', cfg ? D(cfg.epochs) : T('notMeasured'))}${kv('mFramework', esc(cfg && cfg.framework || T('notMeasured')))}${kv('mSeed', cfg ? D(cfg.seed) : T('notMeasured'))}
      ${kv('mTiming', timing ? `${D(timing.value.toFixed(2))} ${esc(T('msPer'))} ${esc(T('on'))} ${esc(timing.device)}` : T('notMeasured'))}</dl>
      <p class="small note">${esc(T('synthWarn'))}</p></section>`;
    // headline metrics
    let metricsHtml = '';
    if (t && t.cer !== undefined) metricsHtml = `<div class="stats"><div class="stat"><span>${esc(T('cer'))}</span><strong>${pct(t.cer)}</strong></div><div class="stat"><span>${esc(T('exact'))}</span><strong>${pct(t.exact)}</strong></div><div class="stat"><span>${esc(T('n'))}</span><strong>${D(t.n)}</strong></div><div class="stat"><span>${esc(T('valCer'))}</span><strong>${pct(met.val_best_cer)}</strong></div></div>`;
    else if (t && t.accuracy !== undefined) metricsHtml = `<div class="stats"><div class="stat"><span>${esc(T('accuracy'))}</span><strong>${pct(t.accuracy)}</strong></div><div class="stat"><span>${esc(T('macroF1'))}</span><strong>${pct(t.macro_f1)}</strong></div><div class="stat"><span>${esc(T('n'))}</span><strong>${D(met.n_test)}</strong></div><div class="stat"><span>${esc(T('valAcc'))}</span><strong>${pct(met.val && met.val.accuracy)}</strong></div></div>`;
    else metricsHtml = `<p class="none">${esc(T('notMeasured'))}</p>`;
    // curves
    let curves = '';
    if (hist && hist.length) {
      const h = hist;
      if (h[0].val_cer !== undefined) curves = lineChart([{ label: T('loss'), color: '#8a5a00', values: h.map((e) => ({ x: e.epoch, y: e.loss })) }], { title: T('loss'), yMin: 0 }) +
        lineChart([{ label: T('valCer'), color: '#0b5d3b', values: h.map((e) => ({ x: e.epoch, y: e.val_cer })) }, { label: T('valExact'), color: '#2f4f8f', values: h.map((e) => ({ x: e.epoch, y: e.val_exact })) }], { title: T('valCer') + ' / ' + T('valExact'), yMin: 0, yMax: 1 });
      else curves = lineChart([{ label: T('loss'), color: '#8a5a00', values: h.map((e) => ({ x: e.epoch, y: e.train_loss })) }], { title: T('loss'), yMin: 0 }) +
        lineChart([{ label: T('valAcc'), color: '#0b5d3b', values: h.map((e) => ({ x: e.epoch, y: e.val_accuracy })) }, { label: T('macroF1'), color: '#2f4f8f', values: h.map((e) => ({ x: e.epoch, y: e.val_macro_f1 })) }], { title: T('valAcc'), yMin: Math.max(0, Math.min(...h.map((e) => e.val_accuracy)) - 0.05), yMax: 1 });
    } else curves = `<p class="none">${esc(T('notMeasured'))}</p>`;
    // per field / per class
    let table = '';
    if (t && t.by_field) table = `<h3>${esc(T('perField'))}</h3><div class="table-wrap"><table class="mini"><thead><tr><th>field</th><th>${esc(T('n'))}</th><th>${esc(T('cer'))}</th><th>${esc(T('exact'))}</th></tr></thead><tbody>${Object.entries(t.by_field).sort((a, b) => b[1].cer - a[1].cer).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${D(v.n)}</td><td>${pct(v.cer)}</td><td>${pct(v.exact)}</td></tr>`).join('')}</tbody></table></div>`;
    if (t && t.per_class) table = `<h3>${esc(T('perClass'))}</h3><div class="table-wrap"><table class="mini"><thead><tr><th>class</th><th>${esc(T('n'))}</th><th>${esc(T('precision'))}</th><th>${esc(T('recall'))}</th><th>${esc(T('f1'))}</th></tr></thead><tbody>${t.per_class.map((c) => `<tr><td>${esc((cm && cm.labels_bn || [])[c.cls] || c.cls)} (${D(c.cls)})</td><td>${D(c.n)}</td><td>${pct(c.precision)}</td><td>${pct(c.recall)}</td><td>${pct(c.f1)}</td></tr>`).join('')}</tbody></table></div>`;
    if (met && met.by_source_set_test) table += `<h3>${esc(T('bySource'))}</h3><div class="table-wrap"><table class="mini"><thead><tr><th>set</th><th>${esc(T('n'))}</th><th>${esc(T('accuracy'))}</th></tr></thead><tbody>${Object.entries(met.by_source_set_test).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${D(v.n)}</td><td>${pct(v.accuracy)}</td></tr>`).join('')}</tbody></table></div>`;
    const cmHtml = cm ? `<section class="card"><h3>${esc(T('confusion'))}</h3><div class="row-actions"><button class="btn tiny ghost cm-mode active" data-mode="raw" type="button">${esc(T('raw'))}</button><button class="btn tiny ghost cm-mode" data-mode="norm" type="button">${esc(T('normalized'))}</button></div><div id="cm-box">${confusion(cm, 'raw')}</div></section>` : '';
    const files = ['config.json', 'dataset_manifest.json', 'split_manifest.json', 'history.json', 'metrics.json', 'confusion_matrix.json', 'charset.json', 'preprocessing.json', 'model_card.md'];
    main.innerHTML = head + `<section class="card"><h3>${esc(T('mTask'))}</h3>${metricsHtml}</section><section class="card"><h3>${esc(T('curves'))}</h3><div class="charts">${curves}</div></section>` +
      (table ? `<section class="card">${table}</section>` : '') + cmHtml +
      (card ? `<section class="card"><h3>${esc(T('modelCard'))}</h3><p class="small">${md(card)}</p></section>` : '') +
      `<section class="card"><h3>${esc(T('downloads'))}</h3><div class="chips">${files.map((f) => `<a class="chip" href="${esc(dir + '/' + f)}" download>${esc(f)}</a>`).join('')}</div></section>`;
    main.querySelectorAll('.cm-mode').forEach((b) => b.addEventListener('click', () => { main.querySelectorAll('.cm-mode').forEach((x) => x.classList.toggle('active', x === b)); document.getElementById('cm-box').innerHTML = confusion(cm, b.dataset.mode); }));
  }

  async function render(l) {
    lang = l; const main = document.getElementById('models-main'); if (!main) return;
    main.innerHTML = `<section class="card skel-block" aria-busy="true" aria-label="${esc(T('loading'))}"><div class="skeleton" style="width:40%"></div><div class="skeleton" style="width:70%"></div><div class="skeleton tall"></div><div class="skeleton" style="width:55%"></div></section>`;
    let idx = null, failed = false;
    try { const r = await fetch('artifacts/runs/index.json'); idx = r.ok ? await r.json() : null; } catch (e) { failed = true; }
    if (failed) { main.innerHTML = `<div class="error-box" role="alert">${esc(T('loadError'))}</div>`; return; }
    const runs = idx && Array.isArray(idx.runs) ? idx.runs : [];
    if (!runs.length) { main.innerHTML = `<section class="card"><p class="none">${esc(T('noRuns'))}</p></section>`; return; }
    const sel = document.getElementById('run-select');
    sel.innerHTML = runs.map((r) => `<option value="${esc(r.id)}">${esc(r.id)} — ${esc(r.kind || '')}${r.active ? ' ★' : ''}</option>`).join('');
    const q = new URLSearchParams(location.search).get('run'); if (q && runs.some((r) => r.id === q)) sel.value = q;
    const draw = async () => { main.setAttribute('aria-busy', 'true'); await renderRun(runs.find((r) => r.id === sel.value), main); main.removeAttribute('aria-busy'); };
    sel.onchange = draw; await draw();
  }
  root.Sutro = Object.assign(root.Sutro || {}, { renderModels: render });
})(window);
