/* =====================================================================
   Efeitos visuais: tema claro/escuro, ícones, números animados,
   ondulação nos botões, busca rápida (Ctrl+K) e confete.
   Tudo aqui é cosmético: se algo falhar, o sistema continua funcionando.
   ===================================================================== */
(function () {
  const FX = window.FX = {};
  const reduz = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- ícones (Lucide) ---------------- */
  FX.ic = (nome, extra = '') => `<i data-lucide="${nome}" ${extra}></i>`;
  let pend = false;
  FX.icons = () => {
    if (pend) return; pend = true;
    requestAnimationFrame(() => { pend = false; try { window.lucide && lucide.createIcons({ attrs: { 'aria-hidden': 'true' } }); } catch (e) {} });
  };

  /* ---------------- tema ---------------- */
  FX.tema = () => { try { return localStorage.getItem('gestor-tema') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { return 'light'; } };
  FX.aplicarTema = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('gestor-tema', t); } catch (e) {} };
  FX.alternarTema = () => { FX.aplicarTema(FX.tema() === 'dark' ? 'light' : 'dark'); App.needShell = true; App.render(); };
  FX.aplicarTema(FX.tema());

  /* ---------------- números que contam ---------------- */
  const parse = txt => {
    const t = String(txt).trim();
    const m = t.match(/^(-?)(R\$\s?)?(-?[\d.]+(?:,\d+)?)(%?)$/);
    if (!m) return null;
    const num = Number(m[3].replace(/\./g, '').replace(',', '.'));
    if (!isFinite(num)) return null;
    const dec = (m[3].split(',')[1] || '').length;
    return { neg: m[1] === '-' || num < 0, moeda: !!m[2], pct: !!m[4], num: Math.abs(num) * (m[1] === '-' ? -1 : 1), dec };
  };
  const fmt = (p, v) => {
    if (p.moeda) return UI.money(v);
    const s = v.toLocaleString('pt-BR', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec });
    return s + (p.pct ? '%' : '');
  };
  FX.contar = el => {
    if (el.dataset.counted || reduz()) return;
    el.dataset.counted = '1';
    const p = parse(el.textContent);
    if (!p || Math.abs(p.num) < 1) return;
    const fim = p.num, t0 = performance.now(), dur = 900;
    const passo = now => {
      const k = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(p, fim * e);
      if (k < 1) requestAnimationFrame(passo); else el.textContent = fmt(p, fim);
    };
    requestAnimationFrame(passo);
  };

  /* ícone automático nos indicadores, pelo nome */
  const KPI_ICONS = [[/fatura|receita|valor|venda total|total no|potencial|a receber|recebid/i, 'circle-dollar-sign'], [/lucro|margem|líquido/i, 'trending-up'], [/custo|despesa|a pagar|saída|pagos/i, 'trending-down'],
    [/venc|hoje|amanhã|futura|prazo/i, 'calendar-clock'], [/cliente|pessoa|indicador/i, 'users'], [/estoque|produto|unidade|itens/i, 'package'], [/ticket|médio|média/i, 'receipt'],
    [/os |ordem|aberto|andamento|finalizad/i, 'wrench'], [/crédito|saldo/i, 'wallet'], [/qtd|quantidade|vendas|respostas|propostas/i, 'hash'], [/nps|promotor|convers/i, 'smile'], [/caixa|dinheiro|troco|sangria|suprimento/i, 'banknote']];
  const iconeKpi = k => {
    if (k.querySelector('.ki')) return;
    const lab = (k.querySelector('span') || {}).textContent || '';
    const hit = KPI_ICONS.find(([rx]) => rx.test(lab));
    if (hit) k.insertAdjacentHTML('afterbegin', `<span class="ki">${FX.ic(hit[1])}</span>`);
  };

  /* observa a página e aplica os efeitos no que for aparecendo */
  const obs = new MutationObserver(muts => {
    let novo = false;
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return; novo = true;
      const kpis = n.matches && n.matches('.kpi') ? [n] : n.querySelectorAll ? n.querySelectorAll('.kpi') : [];
      kpis.forEach(k => { iconeKpi(k); const b = k.querySelector('b'); if (b) FX.contar(b); });
      if (n.querySelectorAll) n.querySelectorAll('[data-count]').forEach(FX.contar);
    }));
    if (novo) FX.icons();
  });
  document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true }));
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });

  /* ---------------- ondulação nos botões ---------------- */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn'); if (!b || reduz()) return;
    const r = b.getBoundingClientRect(); const s = Math.max(r.width, r.height);
    const sp = document.createElement('span'); sp.className = 'ripple';
    sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(sp); setTimeout(() => sp.remove(), 650);
  });

  /* ---------------- avisos com ícone ---------------- */
  const toastOrig = UI.toast;
  UI.toast = function (msg, tipo = 'ok') {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast toast-' + tipo; t.setAttribute('role', 'status');
    t.innerHTML = `<span class="ti">${FX.ic(tipo === 'erro' ? 'circle-alert' : tipo === 'aviso' ? 'triangle-alert' : 'circle-check')}</span><span></span>`;
    t.lastChild.textContent = msg;
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
  };
  UI.toastOrig = toastOrig;

  /* ---------------- confete ---------------- */
  FX.confete = () => {
    if (reduz()) return;
    const c = document.createElement('canvas'); c.className = 'confetti';
    c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; document.body.appendChild(c);
    const ctx = c.getContext('2d'); ctx.scale(devicePixelRatio, devicePixelRatio);
    const cores = ['#3557ff', '#7b5cff', '#14b88a', '#ffc94d', '#ff6b8b', '#6f8bff'];
    const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6,
      r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cores[(Math.random() * cores.length) | 0], q: Math.random() > .5 }));
    const t0 = performance.now();
    const loop = now => {
      const t = now - t0; ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p => { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.max(0, 1 - t / 2200); ctx.fillStyle = p.c;
        if (p.q) ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2.5, 0, 7); ctx.fill(); } ctx.restore(); });
      if (t < 2200) requestAnimationFrame(loop); else c.remove();
    };
    requestAnimationFrame(loop);
  };

  /* ---------------- busca rápida (Ctrl+K) ---------------- */
  const menuItens = () => {
    const out = [];
    const walk = (items, grupo) => (typeof items === 'function' ? items() : items || []).forEach(it => {
      if (it.sub) walk(it.items, grupo + ' › ' + it.sub); else if (Array.isArray(it)) out.push({ t: it[0], s: grupo, h: it[1], i: 'arrow-right' });
    });
    App.MENU.filter(m => !m.perm || App.can(m.perm)).forEach(m => { if (m.href) out.push({ t: m.label, s: 'Menu', h: m.href, i: m.icon }); else walk(m.items, m.label); });
    return out;
  };
  FX.cmdk = () => {
    if (!DB.user() || document.querySelector('.cmdk')) return;
    const wrap = document.createElement('div'); wrap.className = 'cmdk';
    wrap.innerHTML = `<div class="cmdk-box" role="dialog" aria-label="Busca rápida"><input placeholder="Buscar telas, clientes, produtos, IMEI, vendas, OS..." aria-label="Buscar"><div class="cmdk-list"></div>
      <div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></div></div>`;
    document.body.appendChild(wrap);
    const inp = wrap.querySelector('input'), list = wrap.querySelector('.cmdk-list');
    let itens = [], hl = 0;
    const fechar = () => { wrap.remove(); document.removeEventListener('keydown', tecla, true); };
    const render = () => {
      const q = inp.value.trim().toLowerCase();
      const grupos = [];
      const tela = menuItens().filter(m => !q || (m.t + ' ' + m.s).toLowerCase().includes(q)).slice(0, q ? 8 : 6);
      if (tela.length) grupos.push(['Telas', tela]);
      if (q.length >= 2) {
        const cli = DB.list('pessoas').filter(p => [p.nome, p.cpf, p.telefone].join(' ').toLowerCase().includes(q)).slice(0, 5).map(p => ({ t: p.nome, s: [p.telefone, p.cpf].filter(Boolean).join(' · '), h: '#/c/clientes/' + p.id, i: 'user' }));
        const prod = DB.list('produtos').filter(p => [NEG.descProduto(p), p.imei, p.codigo_barras].join(' ').toLowerCase().includes(q)).slice(0, 6).map(p => ({ t: NEG.descProduto(p), s: (p.imei ? 'IMEI ' + p.imei + ' · ' : '') + 'estoque ' + p.quantidade + ' · ' + UI.money(p.preco), h: '#/c/produtos/' + p.id, i: 'smartphone' }));
        const vds = DB.list('vendas').filter(v => String(v.id) === q.replace('#', '') || ((DB.get('pessoas', v.cliente_id) || {}).nome || '').toLowerCase().includes(q)).slice(-5).reverse().map(v => ({ t: 'Venda #' + v.id + ' — ' + ((DB.get('pessoas', v.cliente_id) || {}).nome || ''), s: UI.date(v.data) + ' · ' + UI.money(v.total) + ' · ' + v.status, h: '#/c/vendas/' + v.id, i: 'shopping-bag' }));
        const os = DB.list('os').filter(o => String(o.id) === q.replace('#', '') || ((DB.get('pessoas', o.cliente_id) || {}).nome || '').toLowerCase().includes(q) || (o.aparelhos || []).some(a => String(a.imei || '').includes(q))).slice(-5).reverse().map(o => ({ t: 'OS #' + o.id + ' — ' + ((DB.get('pessoas', o.cliente_id) || {}).nome || ''), s: (o.aparelhos || []).map(a => a.descricao).join(', '), h: '#/os/' + o.id, i: 'wrench' }));
        [['Clientes', cli], ['Produtos', prod], ['Vendas', vds], ['Ordens de serviço', os]].forEach(g => g[1].length && grupos.push(g));
      }
      itens = grupos.flatMap(g => g[1]); hl = Math.min(hl, Math.max(0, itens.length - 1));
      let k = 0;
      list.innerHTML = grupos.length ? grupos.map(([g, l]) => `<div class="cmdk-group">${g}</div>${l.map(it => `<button class="cmdk-item${k === hl ? ' hl' : ''}" data-k="${k++}"><span class="ci">${FX.ic(it.i)}</span><span>${esc(it.t)}</span><small>${esc(it.s || '')}</small></button>`).join('')}`).join('')
        : `<div class="empty-state"><span class="ill">${FX.ic('search-x')}</span>Nada encontrado para "${esc(inp.value)}"</div>`;
      FX.icons();
    };
    const abrir = k => { const it = itens[k]; if (it) { fechar(); App.go(it.h); } };
    const tecla = e => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % Math.max(1, itens.length); render(); list.querySelector('.hl')?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter') { e.preventDefault(); abrir(hl); }
    };
    document.addEventListener('keydown', tecla, true);
    inp.addEventListener('input', () => { hl = 0; render(); });
    list.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) abrir(Number(b.dataset.k)); });
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) fechar(); });
    render(); inp.focus();
  };
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); FX.cmdk(); } });
})();
