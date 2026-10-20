/* =====================================================================
   Motor de cadastros: listagem + formulário a partir de uma definição.
   Cada tela de cadastro do sistema é só um objeto em schemas.js.
   ===================================================================== */
(function () {
  const S = {};          // definições registradas
  const listState = {};  // estado de filtros/ordenação por tela

  /* ---------------- campos de formulário (reutilizável) ---------------- */
  const FORM = {
    options(f, data) {
      let o = typeof f.opts === 'function' ? f.opts(data || {}) : f.opts;
      if (f.ref) {
        const ref = typeof f.ref === 'string' ? { col: f.ref } : f.ref;
        let rows = DB.list(ref.col, { allUnits: ref.allUnits });
        if (ref.filter) rows = rows.filter(r => ref.filter(r, data || {}));
        const lab = ref.label || 'nome';
        o = rows.map(r => ({ v: r.id, l: typeof lab === 'function' ? lab(r) : (r[lab] || r.descricao || r.nome || ('#' + r.id)) }))
          .sort((a, b) => String(a.l).localeCompare(String(b.l), 'pt-BR'));
      }
      return (o || []).map(x => typeof x === 'object' ? x : { v: x, l: x });
    },
    labelOf(f, v, data) {
      if (v == null || v === '') return '';
      if (f.type === 'bool') return v ? 'Sim' : 'Não';
      if (f.ref || f.opts) {
        const opts = FORM.options(f, data);
        if (Array.isArray(v)) return v.map(x => (opts.find(o => String(o.v) === String(x)) || { l: x }).l).join(', ');
        const o = opts.find(o => String(o.v) === String(v));
        return o ? o.l : v;
      }
      if (f.type === 'money') return UI.money(v);
      if (f.type === 'date') return UI.date(v);
      if (f.type === 'datetime') return UI.datetime(v);
      if (f.type === 'percent') return UI.pct(v);
      return v;
    },
    input(f, val, data) {
      const id = 'f_' + f.k;
      const req = f.req ? ' required' : '';
      const ro = f.ro ? ' readonly disabled' : '';
      const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
      if (val == null) val = typeof f.def === 'function' ? f.def(data) : (f.def != null ? f.def : '');
      switch (f.type) {
        case 'textarea': return `<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}"${req}${ro}${ph}>${esc(val)}</textarea>`;
        case 'bool': return `<select id="${id}" name="${f.k}" data-type="bool"${ro}><option value="0"${!val ? ' selected' : ''}>Não</option><option value="1"${val ? ' selected' : ''}>Sim</option></select>`;
        case 'money': case 'number': case 'percent':
          return `<input id="${id}" name="${f.k}" type="number" step="${f.step || (f.type === 'number' ? 'any' : '0.01')}" inputmode="decimal" value="${val === '' ? '' : esc(val)}" data-type="num"${req}${ro}${ph}>`;
        case 'date': return `<input id="${id}" name="${f.k}" type="date" value="${esc(String(val).slice(0, 10))}"${req}${ro}>`;
        case 'datetime': return `<input id="${id}" name="${f.k}" type="datetime-local" value="${esc(String(val).slice(0, 16))}"${req}${ro}>`;
        case 'image': return `<div class="img-fld" data-img="${f.k}"><input type="hidden" name="${f.k}" value="${esc(val)}"><div class="img-prev">${val ? `<img src="${esc(val)}" alt="">` : '<span class="small muted">Sem imagem</span>'}</div>
          <label class="btn ghost sm">Escolher imagem<input type="file" accept="image/*" data-img-file hidden></label><button type="button" class="btn ghost sm" data-img-clear>Remover</button></div>`;
        case 'color': return `<input id="${id}" name="${f.k}" type="color" value="${esc(val || '#2f5bea')}"${ro}>`;
        case 'password': return `<input id="${id}" name="${f.k}" type="password" value="${esc(val)}"${req}${ro} autocomplete="new-password">`;
        case 'multi': {
          const sel = Array.isArray(val) ? val.map(String) : [];
          const opts = FORM.options(f, data);
          if (!opts.length) return `<div class="muted small">Nenhuma opção cadastrada</div>`;
          return `<div class="chips-pick" data-multi="${f.k}">${opts.map(o => `<label class="chip-pick"><input type="checkbox" value="${esc(o.v)}"${sel.includes(String(o.v)) ? ' checked' : ''}${ro}> ${esc(o.l)}</label>`).join('')}</div>`;
        }
        case 'select': case 'ref': default:
          if (f.ref || f.opts) {
            const opts = FORM.options(f, data);
            return `<select id="${id}" name="${f.k}"${f.ref ? ' data-type="ref"' : ''}${req}${ro}>
              <option value="">${f.req ? 'Selecione' : '—'}</option>
              ${opts.map(o => `<option value="${esc(o.v)}"${String(o.v) === String(val) ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
          }
          return `<input id="${id}" name="${f.k}" type="${f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}" value="${esc(val)}"${req}${ro}${ph}${f.max ? ` maxlength="${f.max}"` : ''}>`;
      }
    },
    field(f, data) {
      if (f.type === 'section') return `<h3 class="form-sec">${esc(f.label)}</h3>`;
      if (f.type === 'calc') return `<div class="fld w${f.w || 1}"><span>${esc(f.label)}</span><output data-calc="${f.k}" class="calc">${esc(f.fn(data || {}))}</output></div>`;
      if (f.type === 'html') return `<div class="fld w${f.w || 4}">${f.html(data || {})}</div>`;
      const v = data ? data[f.k] : undefined;
      return `<label class="fld w${f.w || 1}${f.req ? ' req' : ''}" data-fld="${f.k}"><span>${esc(f.label)}</span>${FORM.input(f, v, data)}${f.help ? `<small>${esc(f.help)}</small>` : ''}</label>`;
    },
    render(fields, data) {
      const vis = fields.filter(f => (!f.hidden || !f.hidden(data || {})) && (!f.perm || App.can(f.perm)));
      const tabs = [...new Set(vis.map(f => f.tab).filter(Boolean))];
      if (!tabs.length) return `<div class="grid-form">${vis.map(f => FORM.field(f, data)).join('')}</div>`;
      return `<div class="tabs" role="tablist">${tabs.map((t, i) => `<button type="button" role="tab" class="tab${i ? '' : ' on'}" data-tab="${i}">${esc(t)}</button>`).join('')}</div>
        ${tabs.map((t, i) => `<div class="tabpane${i ? '' : ' on'}" data-pane="${i}"><div class="grid-form">${vis.filter(f => (f.tab || tabs[0]) === t).map(f => FORM.field(f, data)).join('')}</div></div>`).join('')}`;
    },
    bindTabs(root) {
      root.querySelectorAll('.tabs').forEach(tb => {
        tb.addEventListener('click', e => {
          const b = e.target.closest('[data-tab]'); if (!b) return;
          const scope = tb.parentElement;
          tb.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
          scope.querySelectorAll(':scope > .tabpane').forEach(p => p.classList.toggle('on', p.dataset.pane === b.dataset.tab));
        });
      });
    },
    read(root, fields) {
      const out = {};
      fields.forEach(f => {
        if (['section', 'calc', 'html'].includes(f.type)) return;
        if (f.type === 'multi') {
          const box = root.querySelector(`[data-multi="${f.k}"]`);
          if (box) out[f.k] = [...box.querySelectorAll('input:checked')].map(i => isNaN(i.value) ? i.value : Number(i.value));
          return;
        }
        const el = root.querySelector(`[name="${f.k}"]`);
        if (!el) return;
        let v = el.value;
        if (el.dataset.type === 'bool') v = v === '1';
        else if (el.dataset.type === 'num') v = v === '' ? null : Number(v);
        else if (el.dataset.type === 'ref') v = v === '' ? null : (isNaN(v) ? v : Number(v));
        out[f.k] = v;
      });
      return out;
    },
    validate(root, fields, data) {
      for (const f of fields) {
        if (f.req && (data[f.k] == null || data[f.k] === '' || (Array.isArray(data[f.k]) && !data[f.k].length))) {
          const el = root.querySelector(`[data-fld="${f.k}"]`);
          if (el) { el.classList.add('err'); const tp = el.closest('.tabpane'); if (tp) root.querySelector(`[data-tab="${tp.dataset.pane}"]`)?.click(); el.querySelector('input,select,textarea')?.focus(); }
          return `Preencha: ${f.label}`;
        }
      }
      return null;
    },
    liveCalc(root, fields) {
      const calcs = fields.filter(f => f.type === 'calc');
      if (!calcs.length) return;
      const upd = () => { const d = FORM.read(root, fields); calcs.forEach(c => { const o = root.querySelector(`[data-calc="${c.k}"]`); if (o) o.textContent = c.fn(d); }); };
      root.addEventListener('input', upd); root.addEventListener('change', upd);
    }
  };

  /* ---------------- formatação de colunas ---------------- */
  function cellValue(c, r, sc) {
    if (c.get) return c.get(r);
    const f = (sc._flds || (sc._flds = typeof sc.fields === 'function' ? sc.fields({}) : (sc.fields || []))).find(x => x.k === c.k);
    const v = r[c.k];
    if (c.fmt === 'money') return UI.money(v);
    if (c.fmt === 'date') return UI.date(v);
    if (c.fmt === 'datetime') return UI.datetime(v);
    if (c.fmt === 'pct') return UI.pct(v);
    if (c.fmt === 'bool') return v ? 'Sim' : 'Não';
    if (f) return FORM.labelOf(f, v, r);
    return v == null ? '' : v;
  }
  function cellHTML(c, r, sc) {
    if (c.html) return c.html(r);
    const v = cellValue(c, r, sc);
    if (c.badge) { const cls = typeof c.badge === 'function' ? c.badge(r) : ''; return `<span class="badge ${cls}">${esc(v)}</span>`; }
    if (c.color) return `<span class="dot" style="background:${esc(r[c.k])}"></span>`;
    return esc(v);
  }
  const alignOf = c => c.align || (['money', 'pct'].includes(c.fmt) ? 'r' : '');

  /* ---------------- listagem ---------------- */
  function renderList(key, el) {
    const sc = S[key];
    sc._flds = null;
    const st = listState[key] = listState[key] || { q: '', f: {}, page: 1, per: 50, sort: null, dir: 1, deleted: false };
    const prefCols = (DB.meta().colprefs || {})[key];
    const allCols = (typeof sc.cols === 'function' ? sc.cols() : sc.cols).filter(c => !c.perm || App.can(c.perm));
    const cols = prefCols ? allCols.filter(c => prefCols.includes(c.label)) : allCols.filter(c => !c.optional);

    let rows = sc.rows ? sc.rows() : DB.list(sc.col, { deleted: st.deleted ? 'only' : false, allUnits: sc.allUnits });
    if (sc.where) rows = rows.filter(sc.where);
    if (st.q) {
      const q = st.q.toLowerCase();
      rows = rows.filter(r => allCols.some(c => String(cellValue(c, r, sc)).toLowerCase().includes(q)) || (sc.search || []).some(k => String(r[k] || '').toLowerCase().includes(q)));
    }
    (sc.filters || []).forEach(flt => {
      const v = st.f[flt.k];
      if (v == null || v === '') return;
      if (flt.type === 'daterange') {
        if (v.de) rows = rows.filter(r => UI.dia(flt.get ? flt.get(r) : r[flt.k] || '') >= v.de);
        if (v.ate) rows = rows.filter(r => UI.dia(flt.get ? flt.get(r) : r[flt.k] || '') <= v.ate);
      } else if (flt.test) rows = rows.filter(r => flt.test(r, v));
      else rows = rows.filter(r => String(flt.get ? flt.get(r) : r[flt.k]) === String(v));
    });
    if (st.sort != null) {
      const c = allCols.find(x => x.label === st.sort);
      if (c) rows = rows.slice().sort((a, b) => {
        const va = c.sortv ? c.sortv(a) : (c.k ? a[c.k] : cellValue(c, a, sc)), vb = c.sortv ? c.sortv(b) : (c.k ? b[c.k] : cellValue(c, b, sc));
        return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true })) * st.dir;
      });
    } else rows = rows.slice().sort(sc.sort || ((a, b) => b.id - a.id));

    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / st.per));
    if (st.page > pages) st.page = pages;
    const pageRows = rows.slice((st.page - 1) * st.per, st.page * st.per);
    const ind = sc.indicators ? sc.indicators(rows) : [];
    const canDel = !sc.noDelete && App.can('excluir');

    el.innerHTML = `
      ${App.pageHead(sc.title, sc.crumb, `
        ${(sc.tools || []).filter(t => !t.show || t.show()).map((t, i) => `<button class="btn ghost" data-tool="${i}">${esc(t.label)}</button>`).join('')}
        <div class="menu-btn"><button class="btn ghost" data-more aria-haspopup="true">${FX.ic('sliders-horizontal')}Ferramentas</button>
          <div class="dropdown" hidden>
            <button data-x="csv">Exportar CSV</button><button data-x="print">Imprimir / PDF</button>
            <button data-x="cols">Modelo de lista (colunas)</button>
            ${!sc.noDelete && !sc.rows ? `<button data-x="del">${st.deleted ? 'Ver ativos' : 'Ver registros excluídos'}</button>` : ''}
          </div></div>
        ${sc.noNew ? '' : `<button class="btn primary" data-new>${FX.ic('plus')}${esc(sc.newLabel || 'Cadastrar')}</button>`}`)}
      ${sc.intro ? `<p class="intro">${sc.intro}</p>` : ''}
      ${ind.length ? `<div class="kpis">${ind.map(i => `<div class="kpi ${i.cls || ''}"><span>${esc(i.l)}</span><b>${esc(i.v)}</b></div>`).join('')}</div>` : ''}
      <div class="card">
        <div class="list-bar">
          <input type="search" class="search" placeholder="Buscar..." value="${esc(st.q)}" aria-label="Buscar">
          ${(sc.filters || []).map(flt => filterHTML(flt, st.f[flt.k])).join('')}
          ${Object.keys(st.f).some(k => st.f[k] && (typeof st.f[k] !== 'object' || st.f[k].de || st.f[k].ate)) || st.q ? '<button class="btn ghost sm" data-clear>Limpar filtros</button>' : ''}
          <span class="grow"></span><span class="muted small">${UI.int(total)} registro(s)${st.deleted ? ' excluídos' : ''}</span>
        </div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr>${cols.map(c => `<th class="${alignOf(c)}" data-sort="${esc(c.label)}" tabindex="0">${esc(c.label)}${st.sort === c.label ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th class="act-col"></th></tr></thead>
          <tbody>${pageRows.length ? pageRows.map(r => `<tr data-id="${r.id}" class="${sc.rowClass ? sc.rowClass(r) : ''}">${cols.map(c => `<td class="${alignOf(c)}">${cellHTML(c, r, sc)}</td>`).join('')}
            <td class="act-col">${rowActions(sc, r, st, canDel)}</td></tr>`).join('') : `<tr><td colspan="${cols.length + 1}"><div class="empty-state"><span class="ill">${FX.ic(st.q || Object.keys(st.f).length ? 'search-x' : st.deleted ? 'trash-2' : 'inbox')}</span>${st.q ? 'Nada encontrado para "' + esc(st.q) + '".' : st.deleted ? 'Nenhum registro excluído.' : (sc.empty || 'Nada cadastrado ainda.')}${!st.q && !st.deleted && !sc.noNew ? `<button class="btn primary sm" data-new2>${FX.ic('plus')}${esc(sc.newLabel || 'Cadastrar')}</button>` : ''}</div></td></tr>`}</tbody>
          ${sc.footer && pageRows.length ? `<tfoot><tr>${cols.map(c => `<td class="${alignOf(c)}">${esc(sc.footer(c, rows) || '')}</td>`).join('')}<td></td></tr></tfoot>` : ''}
        </table></div>
        <div class="pager">
          <select data-per aria-label="Itens por página">${[50, 100, 500].map(n => `<option${n === st.per ? ' selected' : ''}>${n}</option>`).join('')}</select>
          <button class="btn ghost sm" data-pg="-1"${st.page <= 1 ? ' disabled' : ''}>Anterior</button>
          <span class="small">Página ${st.page} de ${pages}</span>
          <button class="btn ghost sm" data-pg="1"${st.page >= pages ? ' disabled' : ''}>Próxima</button>
        </div>
      </div>`;

    const rerender = () => renderList(key, el);
    const search = el.querySelector('.search');
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = search.value; st.page = 1; rerender(); el.querySelector('.search').focus(); const s = el.querySelector('.search'); s.setSelectionRange(s.value.length, s.value.length); }, 250); });
    el.querySelectorAll('[data-filter]').forEach(inp => inp.addEventListener('change', () => {
      const k = inp.dataset.filter;
      if (inp.dataset.part) { st.f[k] = st.f[k] || {}; st.f[k][inp.dataset.part] = inp.value; } else st.f[k] = inp.value;
      st.page = 1; rerender();
    }));
    el.querySelector('[data-clear]')?.addEventListener('click', () => { st.q = ''; st.f = {}; rerender(); });
    el.querySelectorAll('[data-sort]').forEach(th => th.addEventListener('click', () => { if (st.sort === th.dataset.sort) st.dir *= -1; else { st.sort = th.dataset.sort; st.dir = 1; } rerender(); }));
    el.querySelector('[data-per]').addEventListener('change', e => { st.per = Number(e.target.value); st.page = 1; rerender(); });
    el.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => { st.page += Number(b.dataset.pg); rerender(); }));
    el.querySelectorAll('[data-new],[data-new2]').forEach(b => b.addEventListener('click', () => sc.onNew ? sc.onNew() : location.hash = `#/c/${key}/novo`));
    el.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => sc.tools.filter(t => !t.show || t.show())[b.dataset.tool].fn(rerender)));
    const more = el.querySelector('[data-more]');
    more.addEventListener('click', e => { e.stopPropagation(); const d = more.nextElementSibling; d.hidden = !d.hidden; });
    el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => {
      const x = b.dataset.x;
      if (x === 'csv') UI.download(`${key}.csv`, UI.toCSV(allCols.map(c => ({ label: c.label, text: r => cellValue(c, r, sc) })), rows), 'text/csv');
      if (x === 'print') UI.print(UI.docHeader(sc.title, UI.datetime(new Date())) + `<table><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>${rows.map(r => `<tr>${cols.map(c => `<td class="${alignOf(c)}">${esc(cellValue(c, r, sc))}</td>`).join('')}</tr>`).join('')}</table>`, { titulo: sc.title });
      if (x === 'del') { st.deleted = !st.deleted; st.page = 1; rerender(); }
      if (x === 'cols') chooseCols(key, allCols, cols, rerender);
    }));
    el.querySelector('tbody').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const rec = sc.rows ? sc.rows().find(r => String(r.id) === tr.dataset.id) : DB.get(sc.col, tr.dataset.id);
      if (b) { e.stopPropagation(); handleAct(b.dataset.act, sc, key, rec, rerender); return; }
      if (e.target.closest('.act-col, a, button, input')) return;
      if (sc.onRowClick) sc.onRowClick(rec, rerender);
      else if (!sc.noEdit && !st.deleted) location.hash = `#/c/${key}/${rec.id}`;
    });
    el.querySelectorAll('.act-menu > button').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.act-menu .dropdown').forEach(d => { if (d !== b.nextElementSibling) d.hidden = true; });
      b.nextElementSibling.hidden = !b.nextElementSibling.hidden;
    }));
  }

  function filterHTML(flt, v) {
    if (flt.type === 'daterange') {
      v = v || {};
      return `<label class="flt">${esc(flt.label)} <input type="date" data-filter="${flt.k}" data-part="de" value="${esc(v.de || '')}"> a <input type="date" data-filter="${flt.k}" data-part="ate" value="${esc(v.ate || '')}"></label>`;
    }
    const opts = FORM.options(flt, {});
    return `<select data-filter="${flt.k}" aria-label="${esc(flt.label)}"><option value="">${esc(flt.label)}: todos</option>${opts.map(o => `<option value="${esc(o.v)}"${String(o.v) === String(v) ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  }

  function rowActions(sc, r, st, canDel) {
    if (st.deleted) return `<button class="btn ghost sm" data-act="restore">Restaurar</button>`;
    const acts = (sc.actions || []).filter(a => !a.show || a.show(r));
    const items = [
      ...(!sc.noEdit ? [{ id: 'edit', label: 'Editar' }] : []),
      ...acts.map((a, i) => ({ id: 'a' + i, label: typeof a.label === 'function' ? a.label(r) : a.label })),
      ...(canDel && (!sc.canDelete || sc.canDelete(r)) ? [{ id: 'del', label: 'Excluir', cls: 'danger-t' }] : [])
    ];
    if (!items.length) return '';
    return `<div class="act-menu"><button class="icon-btn" aria-label="Ações">${FX.ic('ellipsis-vertical')}</button><div class="dropdown right" hidden>${items.map(i => `<button data-act="${i.id}" class="${i.cls || ''}">${esc(i.label)}</button>`).join('')}</div></div>`;
  }

  async function handleAct(act, sc, key, rec, rerender) {
    document.querySelectorAll('.act-menu .dropdown').forEach(d => d.hidden = true);
    if (act === 'edit') { location.hash = `#/c/${key}/${rec.id}`; return; }
    if (act === 'restore') { DB.restore(sc.col, rec.id); UI.toast('Registro restaurado'); rerender(); return; }
    if (act === 'del') {
      const bloqueio = sc.deleteBlock && sc.deleteBlock(rec);
      if (bloqueio) { UI.toast(bloqueio, 'aviso'); return; }
      if (!(await UI.master('excluir'))) return;
      const motivo = DB.cfg().pedir_motivo_exclusao ? await UI.prompt('Motivo da exclusão', { label: 'Descreva o motivo' }) : '';
      if (motivo === null) return;
      if (!(await UI.confirm((sc.deleteMsg && sc.deleteMsg(rec)) || 'Excluir este registro? Ele pode ser restaurado em "Ver registros excluídos".', { ok: 'Excluir', danger: true }))) return;
      if (sc.onDelete && sc.onDelete(rec) === false) return;
      DB.remove(sc.col, rec.id, motivo); UI.toast('Registro excluído'); rerender(); return;
    }
    const a = (sc.actions || []).filter(x => !x.show || x.show(rec))[Number(act.slice(1))];
    if (a) await a.fn(rec, rerender);
  }

  function chooseCols(key, allCols, cols, rerender) {
    const cur = cols.map(c => c.label);
    UI.modal({
      title: 'Modelo de lista', size: 'sm',
      body: `<p class="muted small">Escolha as colunas que aparecem para você nesta tela.</p>${allCols.map(c => `<label class="chk"><input type="checkbox" value="${esc(c.label)}"${cur.includes(c.label) ? ' checked' : ''}> ${esc(c.label)}</label>`).join('')}`,
      buttons: [
        { label: 'Restaurar padrão', cls: 'ghost', onClick: () => { const p = DB.meta().colprefs || {}; delete p[key]; DB.setMeta({ colprefs: p }); rerender(); } },
        { label: 'Salvar', cls: 'primary', onClick: ({ body }) => { const sel = [...body.querySelectorAll('input:checked')].map(i => i.value); const p = DB.meta().colprefs || {}; p[key] = sel; DB.setMeta({ colprefs: p }); rerender(); } }
      ]
    });
  }

  /* ---------------- formulário ---------------- */
  function renderForm(key, id, el) {
    const sc = S[key];
    const isNew = id === 'novo';
    const rec = isNew ? (sc.defaults ? sc.defaults() : {}) : DB.get(sc.col, id);
    if (!rec) { el.innerHTML = '<div class="card empty">Registro não encontrado.</div>'; return; }
    const fields = typeof sc.fields === 'function' ? sc.fields(rec) : sc.fields;
    const title = (isNew ? 'Novo: ' : 'Editar: ') + (sc.single || sc.title);
    el.innerHTML = `${App.pageHead(title, sc.crumb, `<button class="btn ghost" data-back>Voltar</button>`)}
      <form class="card form" novalidate>
        ${FORM.render(fields, rec)}
        ${!isNew ? `<p class="muted small meta-line">Criado em ${UI.datetime(rec.created_at)} por ${esc(rec.created_by || '')}${rec.updated_at ? ` · alterado em ${UI.datetime(rec.updated_at)} por ${esc(rec.updated_by || '')}` : ''}</p>` : ''}
        <div class="form-actions">
          <button type="button" class="btn ghost" data-back>Cancelar</button>
          ${sc.saveNew ? '<button type="button" class="btn" data-savenew>Salvar e novo</button>' : ''}
          <button type="submit" class="btn primary">Salvar</button>
        </div>
      </form>`;
    const form = el.querySelector('form');
    FORM.bindTabs(form);
    FORM.liveCalc(form, fields);
    if (sc.bind) sc.bind(form, rec);
    el.querySelectorAll('[data-back]').forEach(b => b.onclick = () => history.length > 1 ? history.back() : location.hash = `#/c/${key}`);
    const save = (andNew) => {
      form.querySelectorAll('.err').forEach(x => x.classList.remove('err'));
      const data = FORM.read(form, fields);
      const err = FORM.validate(form, fields, data) || (sc.validate && sc.validate(data, rec, isNew));
      if (err) { UI.toast(err, 'erro'); return; }
      if (sc.beforeSave) sc.beforeSave(data, rec, isNew);
      let saved;
      if (isNew) saved = DB.insert(sc.col, Object.assign({}, rec, data));
      else saved = DB.update(sc.col, rec.id, data);
      if (sc.afterSave) sc.afterSave(saved, isNew, rec);
      UI.toast('Salvo');
      if (andNew) renderForm(key, 'novo', el);
      else if (sc.afterSaveGo) location.hash = sc.afterSaveGo(saved);
      else location.hash = `#/c/${key}`;
    };
    form.addEventListener('submit', e => { e.preventDefault(); save(false); });
    el.querySelector('[data-savenew]')?.addEventListener('click', () => save(true));
  }

  /* Abre um formulário de schema dentro de um modal (cadastro rápido) */
  function quickForm(key, rec, onSaved) {
    const sc = S[key];
    const isNew = !rec || !rec.id;
    const data = rec || (sc.defaults ? sc.defaults() : {});
    const fields = (typeof sc.fields === 'function' ? sc.fields(data) : sc.fields);
    UI.modal({
      title: (isNew ? 'Cadastrar ' : 'Editar ') + (sc.single || sc.title).toLowerCase(), size: 'lg',
      body: `<form class="form" novalidate>${FORM.render(fields, data)}</form>`,
      onOpen: ({ body }) => { FORM.bindTabs(body); FORM.liveCalc(body, fields); if (sc.bind) sc.bind(body, data); },
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, {
        label: 'Salvar', cls: 'primary', onClick: ({ body }) => {
          const d = FORM.read(body, fields);
          const err = FORM.validate(body, fields, d) || (sc.validate && sc.validate(d, data, isNew));
          if (err) { UI.toast(err, 'erro'); return false; }
          if (sc.beforeSave) sc.beforeSave(d, data, isNew);
          const saved = isNew ? DB.insert(sc.col, Object.assign({}, data, d)) : DB.update(sc.col, data.id, d);
          if (sc.afterSave) sc.afterSave(saved, isNew, data);
          UI.toast('Salvo'); if (onSaved) onSaved(saved);
        }
      }]
    });
  }

  window.FORM = FORM;
  window.CRUD = {
    S, register(key, sc) { S[key] = Object.assign({ key }, sc); },
    list: renderList, form: renderForm, quickForm, cellValue,
    reset(key) { delete listState[key]; },
    setFilter(key, f) { listState[key] = Object.assign(listState[key] || { q: '', f: {}, page: 1, per: 50, sort: null, dir: 1, deleted: false }, { f }); }
  };
})();

/* campo de imagem (ex.: logotipo): reduz a imagem e guarda como texto no próprio cadastro */
document.addEventListener('change', async e => {
  const inp = e.target.closest('[data-img-file]'); if (!inp || !inp.files[0]) return;
  const box = inp.closest('[data-img]'); const file = inp.files[0];
  if (file.size > 3 * 1024 * 1024) { UI.toast('Imagem muito grande (máx. 3 MB)', 'erro'); return; }
  const url = await UI.readDataURL(file);
  const img = new Image(); img.src = url; await new Promise(r => { img.onload = r; img.onerror = r; });
  const max = 360, k = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
  const c = document.createElement('canvas'); c.width = Math.round((img.width || 1) * k); c.height = Math.round((img.height || 1) * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const out = file.type === 'image/png' || file.type === 'image/svg+xml' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88);
  box.querySelector('input[type=hidden]').value = out;
  box.querySelector('.img-prev').innerHTML = `<img src="${out}" alt="">`;
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-img-clear]'); if (!b) return;
  const box = b.closest('[data-img]'); box.querySelector('input[type=hidden]').value = ''; box.querySelector('.img-prev').innerHTML = '<span class="small muted">Sem imagem</span>';
});

