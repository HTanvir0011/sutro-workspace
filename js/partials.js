/* Injects the shared header/footer containers and the script tags each page needs, so the six HTML files stay small. */
(function () {
  'use strict';
  const b = document.body;
  if (!document.querySelector('link[rel=icon]')) { const l = document.createElement('link'); l.rel = 'icon'; l.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%230b5d3b'/%3E%3Ctext x='16' y='22' font-size='17' text-anchor='middle' fill='%23fdfbf5' font-family='serif'%3E%E0%A6%B8%E0%A7%82%3C/text%3E%3C/svg%3E"; document.head.appendChild(l); }
  const head = document.createElement('header'); head.id = 'site-header'; head.className = 'site-header';
  b.insertBefore(head, b.firstChild);
  if (b.dataset.casebar === 'true') { const cb = document.createElement('div'); cb.id = 'case-bar'; cb.className = 'case-bar'; head.after(cb); }
  const foot = document.createElement('footer'); foot.id = 'site-footer'; foot.className = 'footer muted small'; b.appendChild(foot);
})();
