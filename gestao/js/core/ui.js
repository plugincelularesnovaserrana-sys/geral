/* Utilitários de interface: formatação, modais, avisos, impressão, exportação */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const round2 = v => Math.round(num(v) * 100) / 100;

  const UI = {
    esc, num, round2,
    money(v) { return num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
    n2(v) { return num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    int(v) { return num(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }); },
    pct(v) { return num(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%'; },
    today() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
    nowLocal() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); },
    addDays(iso, n) { const d = new Date(UI.dia(iso) + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); },
    addMonths(iso, n) {
      const d = new Date(UI.dia(iso) + 'T12:00:00'); const day = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return d.toISOString().slice(0, 10);
    },
    date(v) { if (!v) return ''; const s = String(v); const [y, m, d] = UI.dia(s).split('-'); return d ? `${d}/${m}/${y}` : s; },
    datetime(v) { if (!v) return ''; const d = new Date(v); return isNaN(d) ? UI.date(v) : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
    daysBetween(a, b) { return Math.round((new Date(UI.dia(b)) - new Date(UI.dia(a))) / 86400000); },
    /* data (AAAA-MM-DD) no fuso local; aceita data pura ou data/hora ISO com fuso (ex.: 2026-10-14T23:30:00.000Z) */
    dia(v) { if (!v) return ''; const s = String(v); if (s.length <= 10 || !/(Z|[+-]\d\d:?\d\d)$/i.test(s)) return s.slice(0, 10); const d = new Date(s); return isNaN(d) ? s.slice(0, 10) : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
    monthKey(v) { return UI.dia(v).slice(0, 7); },
    monthLabel(k) { const [y, m] = k.split('-'); return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][Number(m) - 1] + '/' + y; },
    onlyDigits(s) { return String(s || '').replace(/\D/g, ''); },

    /* ---------- avisos ---------- */
    toast(msg, tipo = 'ok') {
      let box = document.getElementById('toasts');
      if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
      const t = document.createElement('div');
      t.className = 'toast toast-' + tipo; t.textContent = msg;
      t.setAttribute('role', 'status');
      box.appendChild(t);
      setTimeout(() => t.classList.add('out'), 3200);
      setTimeout(() => t.remove(), 3700);
    },

    /* ---------- modais ---------- */
    modal({ title, body, size = 'md', buttons = [], onOpen }) {
      const wrap = document.createElement('div');
      wrap.className = 'modal-wrap';
      wrap.innerHTML = `<div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fechar">${window.FX ? FX.ic('x') : '×'}</button></header>
        <div class="modal-body"></div>
        <footer class="modal-foot"></footer></div>`;
      const bodyEl = wrap.querySelector('.modal-body');
      if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
      const foot = wrap.querySelector('.modal-foot');
      const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = e => { if (e.key === 'Escape') close(); };
      buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'btn ' + (b.cls || '');
        btn.textContent = b.label;
        btn.onclick = async () => { const r = b.onClick ? await b.onClick({ close, body: bodyEl, wrap }) : null; if (r !== false && b.close !== false) close(); };
        foot.appendChild(btn);
      });
      if (!buttons.length) foot.remove();
      wrap.querySelector('[data-close]').onclick = close;
      wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      const first = bodyEl.querySelector('input,select,textarea');
      if (first) setTimeout(() => first.focus(), 30);
      if (onOpen) onOpen({ body: bodyEl, close, wrap });
      return { close, body: bodyEl, wrap };
    },
    confirm(msg, { ok = 'Confirmar', danger = false } = {}) {
      return new Promise(res => {
        UI.modal({
          title: 'Confirmar', size: 'sm', body: `<p>${esc(msg)}</p>`,
          buttons: [{ label: 'Cancelar', cls: 'ghost', onClick: () => res(false) }, { label: ok, cls: danger ? 'danger' : 'primary', onClick: () => res(true) }]
        });
      });
    },
    prompt(msg, { value = '', type = 'text', label = '' } = {}) {
      return new Promise(res => {
        let done = false;
        const m = UI.modal({
          title: msg, size: 'sm',
          body: `<label class="fld"><span>${esc(label)}</span><input type="${type}" value="${esc(value)}" data-p></label>`,
          buttons: [{ label: 'Cancelar', cls: 'ghost', onClick: () => { done = true; res(null); } },
          { label: 'OK', cls: 'primary', onClick: ({ body }) => { done = true; res(body.querySelector('[data-p]').value); } }]
        });
        m.body.querySelector('[data-p]').addEventListener('keydown', e => { if (e.key === 'Enter') { done = true; res(e.target.value); m.close(); } });
      });
    },

    /* Senha mestre: pedida em ações sensíveis quando configurada */
    async master(acao) {
      const senhas = DB.list('senhasmestre').filter(s => s.ativa !== false && (!s.permissoes || !s.permissoes.length || s.permissoes.includes(acao)));
      if (!senhas.length) return true;
      const u = DB.user();
      if (u && u.perfil === 'gerente') return true;
      const v = await UI.prompt('Senha mestre necessária', { type: 'password', label: 'Peça ao gerente para digitar a senha mestre' });
      if (v == null) return false;
      const ok = senhas.some(s => s.senha === v);
      if (!ok) UI.toast('Senha mestre incorreta', 'erro');
      return ok;
    },

    /* ---------- arquivos ---------- */
    download(name, content, mime = 'text/plain') {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime + ';charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    toCSV(cols, rows) {
      const q = v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const head = cols.map(c => q(c.label)).join(';');
      const body = rows.map(r => cols.map(c => q(c.text ? c.text(r) : (c.raw ? c.raw(r) : r[c.k]))).join(';')).join('\n');
      return '﻿' + head + '\n' + body;
    },
    pickFile(accept) {
      return new Promise(res => {
        const i = document.createElement('input'); i.type = 'file'; if (accept) i.accept = accept;
        i.onchange = () => res(i.files[0] || null); i.click();
      });
    },
    readText(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); }); },
    readDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); },

    /* ---------- impressão ---------- */
    print(html, { formato = 'a4', titulo = 'Documento' } = {}) {
      const w = window.open('', '_blank');
      if (!w) { UI.toast('Libere pop-ups para imprimir', 'erro'); return; }
      const largura = formato === '80mm' ? 'width:72mm;font-size:11px;' : 'max-width:190mm;font-size:12px;';
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
        <style>body{font-family:Arial,sans-serif;${largura}margin:8mm auto;color:#111}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:12px 0 4px}
        table{width:100%;border-collapse:collapse;margin:6px 0}th,td{border-bottom:1px solid #ccc;padding:3px 4px;text-align:left;vertical-align:top}
        .r{text-align:right}.c{text-align:center}.muted{color:#555}.tot{font-weight:bold;font-size:13px}.box{border:1px solid #999;padding:6px;margin:6px 0}
        .sign{margin-top:40px;border-top:1px solid #000;width:60%;text-align:center;padding-top:4px}.head{display:flex;justify-content:space-between;gap:8px;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}
        .barcode{font-family:'Libre Barcode 39',monospace;font-size:34px}@media print{button{display:none}}</style></head>
        <body>${html}<p class="c"><button onclick="print()">Imprimir</button></p></body></html>`);
      w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350);
    },
    docHeader(titulo, sub) {
      const c = DB.cfg(); const u = DB.get('unidades', DB.unitId()) || {};
      return `<div class="head"><div><h1>${esc(u.nome || c.empresa_nome || 'Minha Loja')}</h1>
        <div class="muted">${esc(u.cnpj || '')} ${esc(u.telefone || '')}<br>${esc(u.endereco || '')}</div></div>
        <div style="text-align:right"><h1>${esc(titulo)}</h1><div class="muted">${esc(sub || '')}</div></div></div>`;
    },

    /* WhatsApp: abre conversa com texto pronto */
    whats(fone, texto) {
      let n = UI.onlyDigits(fone);
      if (n && n.length <= 11) n = '55' + n;
      window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(texto || ''), '_blank');
    },
    fillTemplate(tpl, vars) { return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m); },

    /* ---------- gráficos simples (SVG) ---------- */
    barChart(data, { height = 180, fmt = UI.money, color = 'var(--accent)' } = {}) {
      if (!data.length) return '<p class="empty">Sem dados no período.</p>';
      const max = Math.max(...data.map(d => d.v), 1);
      const cols = data.map(d => `<div class="vbar" title="${esc(d.l)}: ${esc(fmt(d.v))}">
          <div class="vbar-track"><i style="height:${Math.max(d.v / max * 100, d.v ? 2 : 0).toFixed(1)}%;background:${color}"></i></div>
          <span class="vbar-l">${esc(d.l)}</span></div>`).join('');
      return `<div class="vbars" style="height:${height}px" role="img" aria-label="Gráfico de barras">${cols}</div>`;
    },
    hbars(data, { fmt = UI.money } = {}) {
      if (!data.length) return '<p class="empty">Sem dados no período.</p>';
      const max = Math.max(...data.map(d => d.v), 1);
      return `<div class="hbars">${data.map(d => `<div class="hbar"><span class="hbar-l" title="${esc(d.l)}">${esc(d.l)}</span><span class="hbar-t"><i style="width:${(d.v / max * 100).toFixed(1)}%"></i></span><span class="hbar-v">${esc(fmt(d.v))}</span></div>`).join('')}</div>`;
    }
  };

  window.UI = UI;
  window.esc = esc;
})();
