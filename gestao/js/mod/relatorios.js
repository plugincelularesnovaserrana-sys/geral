/* =====================================================================
   RELATÓRIOS: motor de agrupamento + relatórios específicos
   ===================================================================== */
(function () {
  const r2 = UI.round2;
  const nome = (col, id) => (DB.get(col, id) || {}).nome || '';
  const REL = window.REL = { list: [], st: {} };
  const add = REL.add = (id, grupo, titulo, render, extra = {}) => { REL.list.push(Object.assign({ id, grupo, titulo, render }, extra)); App.route('/rel/' + id, (el, p, qs) => REL.abrir(id, el, qs)); };
  const GRUPOS = ['Clientes', 'Financeiro', 'Vendas e estoque', 'Ordem de serviço', 'Vendedores', 'Gestão', 'Fiscal', 'Legado'];

  const GICON = { Clientes: 'users', Financeiro: 'wallet', 'Vendas e estoque': 'package', 'Ordem de serviço': 'wrench', Vendedores: 'user-check', Gestão: 'briefcase', Fiscal: 'receipt-text', Legado: 'archive' };
  window.REPORT_MENU = () => [['Visão geral', '#/relatorios'], ['DRE regime de caixa', '#/rel/drecaixa'], ['DRE gerencial (competência)', '#/rel/dre'], ['Produtos vendidos', '#/rel/itensperiodo'], ['Comissão de vendedores', '#/rel/comissao'],
    ...GRUPOS.map(g => ({ sub: g, icon: GICON[g], items: REL.list.filter(r => r.grupo === g).map(r => [r.titulo, '#/rel/' + r.id]) }))];
  App.route('/relatorios', el => {
    el.innerHTML = App.pageHead('Relatórios', 'Relatórios') + GRUPOS.map(g => `<section class="card"><h2>${g}</h2><div class="tiles">${REL.list.filter(r => r.grupo === g).map(r => `<a class="tile" href="#/rel/${r.id}"><h3>${esc(r.titulo)}</h3>${r.desc ? `<p>${esc(r.desc)}</p>` : ''}</a>`).join('')}</div></section>`).join('');
  });

  /* ---------- dados de apoio ---------- */
  const inP = (d, st) => { const x = UI.dia(d); return (!st.de || x >= st.de) && (!st.ate || x <= st.ate); };
  REL.vendas = (st, all) => DB.list('vendas', { allUnits: all }).filter(v => v.status === 'Concluída' && inP(v.data, st));
  REL.itens = (st, all) => {
    const out = [];
    REL.vendas(st, all).forEach(v => {
      const tot = v.total || 1;
      (v.itens || []).forEach(i => {
        if (i.devolvido) return;
        const p = DB.get('produtos', i.produto_id) || {};
        const valor = r2(i.preco * i.qtd - (i.desconto || 0) + (i.seguro_valor || 0));
        const custo = r2((i.custo || 0) * i.qtd);
        const taxa = r2((v.total_taxas || 0) * valor / tot);
        out.push({ venda: v, data: v.data, valor, custo, taxa, lucro: r2(valor - custo - taxa), qtd: i.qtd, desconto: i.desconto || 0, descricao: i.descricao, tipo: i.tipo || p.tipo || 'Serviço',
          modelo: nome('modelos', p.modelo_id) || i.descricao, gb: nome('gbs', p.gb_id), cor: nome('cores', p.cor_id), estado: nome('estados', p.estado_id), categoria: nome('categorias', p.categoria_id),
          subcategoria: nome('subcategorias', p.subcategoria_id), marca: nome('marcas', p.marca_id), ncm: p.ncm || '', vendedor: nome('vendedores', v.vendedor_id), vendedor_id: v.vendedor_id,
          cliente: nome('pessoas', v.cliente_id), canal: nome('canais', v.canal_id), tipovenda: nome('tiposvenda', v.tipovenda_id), entrega: nome('tiposentrega', v.tipoentrega_id), loja: nome('unidades', v.unidade_id), produto_id: i.produto_id });
      });
    });
    return out;
  };
  REL.osFin = (st, all) => DB.list('os', { allUnits: all }).filter(o => { const s = DB.get('situacoesos', o.situacao_id) || {}; return s.finalidade === 'Finalizada' && inP(o.data_finalizacao, st); });
  REL.pagamentos = (st, tipo) => {
    const out = [];
    DB.list('financeiro').filter(f => f.situacao !== 'Cancelado' && (!tipo || f.tipo === tipo)).forEach(f => (f.pagamentos || []).forEach(p => { if (inP(p.data, st)) out.push({ f, p }); }));
    return out;
  };
  const periodoKey = (d, per) => per === 'Diário' ? UI.dia(d) : per === 'Mensal' ? UI.dia(d).slice(0, 7) : per === 'Anual' ? UI.dia(d).slice(0, 4) : '';
  const periodoLabel = (k, per) => per === 'Diário' ? UI.date(k) : per === 'Mensal' ? UI.monthLabel(k) : k;

  /* ---------- tabela agrupada genérica ---------- */
  REL.agrupar = (rows, dims, metricas, per, dateKey = 'data') => {
    const map = new Map();
    rows.forEach(r => {
      const keys = (per && per !== 'Nenhum' ? [periodoKey(r[dateKey], per)] : []).concat(dims.map(d => r[d] || '—'));
      const k = keys.join('¦');
      if (!map.has(k)) map.set(k, { keys, rows: [] });
      map.get(k).rows.push(r);
    });
    return [...map.values()].map(g => Object.assign({ keys: g.keys }, ...metricas.map(m => ({ [m.k]: m.fn(g.rows) }))));
  };
  const M = {
    qtd: { k: 'qtd', label: 'Quantidade', fn: rs => rs.reduce((s, r) => s + (r.qtd || 0), 0), fmt: UI.int },
    vendas: { k: 'nvendas', label: 'Qtd. de vendas', fn: rs => new Set(rs.map(r => r.venda.id)).size, fmt: UI.int },
    fat: { k: 'fat', label: 'Faturamento', fn: rs => r2(rs.reduce((s, r) => s + r.valor, 0)), fmt: UI.money },
    custo: { k: 'custo', label: 'Custo', fn: rs => r2(rs.reduce((s, r) => s + r.custo, 0)), fmt: UI.money, cost: true },
    taxa: { k: 'taxa', label: 'Taxas', fn: rs => r2(rs.reduce((s, r) => s + r.taxa, 0)), fmt: UI.money, cost: true },
    lucro: { k: 'lucro', label: 'Lucro total', fn: rs => r2(rs.reduce((s, r) => s + r.lucro, 0)), fmt: UI.money, cost: true },
    lucroMed: { k: 'lucromed', label: 'Lucro médio', fn: rs => { const q = rs.reduce((s, r) => s + (r.qtd || 0), 0); return q ? r2(rs.reduce((s, r) => s + r.lucro, 0) / q) : 0; }, fmt: UI.money, cost: true },
    pct: { k: 'pct', label: '% lucro', fn: rs => { const f = rs.reduce((s, r) => s + r.valor, 0); return f ? r2(rs.reduce((s, r) => s + r.lucro, 0) / f * 100) : 0; }, fmt: UI.pct, cost: true },
    desc: { k: 'desc', label: 'Desconto', fn: rs => r2(rs.reduce((s, r) => s + (r.desconto || 0), 0)), fmt: UI.money },
    ticket: { k: 'ticket', label: 'Ticket médio', fn: rs => { const n = new Set(rs.map(r => r.venda.id)).size; return n ? r2(rs.reduce((s, r) => s + r.valor, 0) / n) : 0; }, fmt: UI.money }
  };
  const DIMS = { modelo: 'Modelo / produto', gb: 'GB', cor: 'Cor', tipo: 'Tipo de produto', estado: 'Estado', categoria: 'Categoria', subcategoria: 'Subcategoria', marca: 'Marca', ncm: 'NCM',
    vendedor: 'Vendedor', cliente: 'Cliente', canal: 'Canal de venda', tipovenda: 'Tipo de venda', entrega: 'Tipo de entrega', loja: 'Loja', descricao: 'Produto' };

  REL.tabela = (cols, rows, opts = {}) => {
    REL._last = { cols, rows };
    if (!rows.length) return '<p class="empty">Nada encontrado no período.</p>';
    const tot = opts.total ? cols.map(c => c.sum ? c.fmt(rows.reduce((s, r) => s + (Number(c.raw ? c.raw(r) : r[c.k]) || 0), 0)) : '') : null;
    return `<div class="table-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.r ? 'r' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(r => `<tr${opts.link ? ` onclick="location.hash='${opts.link(r)}'"` : ''}>${cols.map(c => `<td class="${c.r ? 'r' : ''}">${c.html ? c.html(r) : esc(c.fmt ? c.fmt(c.raw ? c.raw(r) : r[c.k]) : (c.raw ? c.raw(r) : r[c.k]))}</td>`).join('')}</tr>`).join('')}</tbody>
      ${tot ? `<tfoot><tr>${tot.map((t, i) => `<td class="${cols[i].r ? 'r' : ''}">${i === 0 && !t ? 'Total' : esc(t)}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  };
  REL.agrupado = (cfg) => (el, st) => {
    const dims = st.dims || cfg.dims;
    const showCost = App.can('ver_custo');
    const mets = cfg.metricas.filter(m => !m.cost || showCost);
    const rows = REL.agrupar(cfg.fonte(st), dims, mets, st.per || cfg.per || 'Nenhum', cfg.dateKey).sort((a, b) => cfg.sortPer && a.keys[0] !== b.keys[0] ? String(a.keys[0]).localeCompare(String(b.keys[0])) : (b[mets[0].k === 'qtd' && mets[1] ? mets[1].k : mets[0].k] || 0) - (a[mets[0].k === 'qtd' && mets[1] ? mets[1].k : mets[0].k] || 0));
    const per = st.per || cfg.per || 'Nenhum';
    const cols = [...(per !== 'Nenhum' ? [{ label: per === 'Diário' ? 'Dia' : per === 'Mensal' ? 'Mês' : 'Ano', raw: r => r.keys[0], fmt: k => periodoLabel(k, per) }] : []),
      ...dims.map((d, i) => ({ label: DIMS[d] || d, raw: r => r.keys[i + (per !== 'Nenhum' ? 1 : 0)] })),
      ...mets.map(m => ({ label: m.label, k: m.k, fmt: m.fmt, r: true, sum: !['lucromed', 'pct', 'ticket'].includes(m.k) }))];
    const chartM = mets.find(m => m.k === 'fat') || mets[0];
    const top = rows.slice().sort((a, b) => b[chartM.k] - a[chartM.k]).slice(0, 10).map(r => ({ l: r.keys.map((k, i) => i === 0 && per !== 'Nenhum' ? periodoLabel(k, per) : k).join(' · '), v: r[chartM.k] }));
    el.innerHTML = (rows.length ? `<section class="card"><h2>${esc(chartM.label)} — 10 maiores</h2>${UI.hbars(top, { fmt: chartM.fmt })}</section>` : '') + `<section class="card">${REL.tabela(cols, rows, { total: true })}</section>`;
  };

  /* ---------- casca comum: filtros, exportar ---------- */
  REL.abrir = (id, el, qs) => {
    const rep = REL.list.find(r => r.id === id);
    const st = REL.st[id] = REL.st[id] || Object.assign({ de: UI.today().slice(0, 8) + '01', ate: UI.today(), per: rep.per || 'Nenhum' }, rep.st || {});
    if (qs && qs.get('de')) { st.de = qs.get('de'); st.ate = qs.get('ate') || st.ate; }
    const atalhos = [['Hoje', UI.today(), UI.today()], ['Este mês', UI.today().slice(0, 8) + '01', UI.today()], ['Mês passado', UI.addMonths(UI.today().slice(0, 8) + '01', -1), UI.addDays(UI.today().slice(0, 8) + '01', -1)], ['Este ano', UI.today().slice(0, 4) + '-01-01', UI.today()], ['12 meses', UI.addMonths(UI.today(), -12), UI.today()]];
    el.innerHTML = App.pageHead(rep.titulo, 'Relatórios > ' + rep.grupo, `<button class="btn ghost" data-csv>Exportar CSV</button><button class="btn ghost" data-print>Imprimir / PDF</button>`) + `
      ${rep.desc ? `<p class="intro">${esc(rep.desc)}</p>` : ''}
      <div class="card list-bar">${rep.semPeriodo ? '' : `<label class="flt">De <input type="date" data-de value="${st.de}"> a <input type="date" data-ate value="${st.ate}"></label>
        ${atalhos.map(([l, a, b]) => `<button class="btn ghost sm" data-at="${a}|${b}">${l}</button>`).join('')}`}
        ${rep.periodicidade ? `<select data-per aria-label="Periodicidade">${['Nenhum', 'Diário', 'Mensal', 'Anual'].map(p => `<option${p === st.per ? ' selected' : ''}>${p === 'Nenhum' ? 'Sem agrupar por data' : p}</option>`).join('')}</select>` : ''}
        ${rep.dims ? `<span class="small muted">Agrupar por:</span>${Object.keys(DIMS).filter(d => rep.dims.includes(d)).map(d => `<label class="chip-pick"><input type="checkbox" data-dim="${d}"${(st.dims || rep.dimsPadrao).includes(d) ? ' checked' : ''}> ${DIMS[d]}</label>`).join('')}` : ''}
        ${rep.filtros ? rep.filtros(st) : ''}</div>
      <div data-out></div>`;
    const out = el.querySelector('[data-out]');
    const run = () => { try { rep.render(out, st); } catch (e) { console.error(e); out.innerHTML = `<div class="card"><pre class="small">${esc(e.stack)}</pre></div>`; } };
    if (rep.dims && !st.dims) st.dims = rep.dimsPadrao.slice();
    const bar = el.querySelector('.list-bar');
    bar.addEventListener('change', e => {
      if (e.target.matches('[data-de]')) st.de = e.target.value; if (e.target.matches('[data-ate]')) st.ate = e.target.value;
      if (e.target.matches('[data-per]')) st.per = e.target.value;
      if (e.target.matches('[data-dim]')) { st.dims = [...bar.querySelectorAll('[data-dim]:checked')].map(i => i.dataset.dim); if (!st.dims.length) st.dims = [e.target.dataset.dim]; }
      if (e.target.dataset.st) st[e.target.dataset.st] = e.target.value;
      run();
    });
    bar.querySelectorAll('[data-at]').forEach(b => b.onclick = () => { [st.de, st.ate] = b.dataset.at.split('|'); bar.querySelector('[data-de]').value = st.de; bar.querySelector('[data-ate]').value = st.ate; run(); });
    el.querySelector('[data-csv]').onclick = () => { const L = REL._last; if (!L) return; UI.download(id + '.csv', UI.toCSV(L.cols.map(c => ({ label: c.label, text: r => { const v = c.raw ? c.raw(r) : r[c.k]; return c.fmt ? c.fmt(v) : v; } })), L.rows), 'text/csv'); };
    el.querySelector('[data-print]').onclick = () => UI.print(UI.docHeader(rep.titulo, rep.semPeriodo ? UI.date(UI.today()) : `${UI.date(st.de)} a ${UI.date(st.ate)}`) + out.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, ''), { titulo: rep.titulo });
    run();
  };
  const sel = (key, label, opts, st, vazio) => `<select data-st="${key}" aria-label="${esc(label)}"><option value="">${esc(vazio || label + ': todos')}</option>${opts.map(o => `<option value="${esc(o.v)}"${String(o.v) === String(st[key] || '') ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  const vendOpts = () => DB.list('vendedores').map(v => ({ v: v.id, l: v.nome }));
  const kpis = arr => `<div class="kpis">${arr.map(k => `<div class="kpi ${k.c || ''}"><span>${esc(k.l)}</span><b>${esc(k.v)}</b>${k.s ? `<small>${esc(k.s)}</small>` : ''}</div>`).join('')}</div>`;

  /* =================== CLIENTES =================== */
  add('indicacoes', 'Clientes', 'Programa de indicação', (el, st) => {
    const vs = REL.vendas(st).filter(v => { const c = DB.get('pessoas', v.cliente_id); return c && c.indicado_por; });
    const ind = new Set(vs.map(v => DB.get('pessoas', v.cliente_id).indicado_por));
    el.innerHTML = kpis([{ l: 'Clientes indicadores', v: ind.size }, { l: 'Vendas indicadas', v: vs.length }, { l: 'Faturamento', v: UI.money(vs.reduce((s, v) => s + v.total, 0)), c: 'accent' }]) +
      `<section class="card">${REL.tabela([{ label: 'Venda', k: 'id' }, { label: 'Cliente', raw: v => nome('pessoas', v.cliente_id) }, { label: 'Indicado por', raw: v => nome('pessoas', DB.get('pessoas', v.cliente_id).indicado_por) }, { label: 'Vendedor', raw: v => nome('vendedores', v.vendedor_id) }, { label: 'Data', k: 'data', fmt: UI.date }, { label: 'Valor', k: 'total', fmt: UI.money, r: true, sum: true }], vs, { total: true, link: v => '#/c/vendas/' + v.id })}</section>`;
  }, { desc: 'Vendas para clientes que vieram por indicação (campo "Indicado por" no cadastro).' });
  add('perfilclientes', 'Clientes', 'Perfil de clientes', el => {
    const cl = DB.list('pessoas').filter(p => p.cliente);
    const gasto = {}; DB.list('vendas').filter(v => v.status === 'Concluída').forEach(v => { gasto[v.cliente_id] = (gasto[v.cliente_id] || 0) + v.total; });
    const cont = (fn) => { const m = {}; cl.forEach(c => { const k = fn(c) || 'Não informado'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 10); };
    const idade = c => { if (!c.nascimento) return ''; const a = Math.floor(UI.daysBetween(c.nascimento, UI.today()) / 365.25); return a < 20 ? 'Até 20' : a < 26 ? '21 a 25' : a < 31 ? '26 a 30' : a < 41 ? '31 a 40' : a < 51 ? '41 a 50' : 'Acima de 50'; };
    el.innerHTML = kpis([{ l: 'Clientes na base', v: UI.int(cl.length), c: 'accent' }, { l: 'Clientes que compraram', v: UI.int(Object.keys(gasto).length) }]) + `<div class="cols-2">
      <section class="card"><h2>Top 10 clientes que mais gastaram</h2>${UI.hbars(Object.entries(gasto).map(([id, v]) => ({ l: nome('pessoas', Number(id)), v })).sort((a, b) => b.v - a.v).slice(0, 10))}</section>
      <section class="card"><h2>Top 10 bairros</h2>${UI.hbars(cont(c => c.bairro), { fmt: UI.int })}</section>
      <section class="card"><h2>Top 10 cidades</h2>${UI.hbars(cont(c => c.cidade), { fmt: UI.int })}</section>
      <section class="card"><h2>Faixa etária</h2>${UI.hbars(cont(idade), { fmt: UI.int })}</section>
      <section class="card"><h2>CPF x CNPJ</h2>${UI.hbars(cont(c => c.tipo_pessoa), { fmt: UI.int })}</section>
      <section class="card"><h2>Gênero</h2>${UI.hbars(cont(c => c.genero), { fmt: UI.int })}</section>
      <section class="card"><h2>Origem dos clientes</h2>${UI.hbars(cont(c => c.origem), { fmt: UI.int })}</section></div>`;
  }, { semPeriodo: true });
  add('rankingclientes', 'Clientes', 'Ranking de clientes', (el, st) => {
    const m = {}; REL.vendas(st).forEach(v => { const x = m[v.cliente_id] = m[v.cliente_id] || { id: v.cliente_id, total: 0, itens: 0, ultima: '' }; x.total += v.total; x.itens += v.itens.reduce((s, i) => s + i.qtd, 0); if (v.data > x.ultima) x.ultima = v.data; });
    const rows = Object.values(m).sort((a, b) => b.total - a.total);
    el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Posição', raw: r => rows.indexOf(r) + 1 }, { label: 'Nome', raw: r => nome('pessoas', r.id) }, { label: 'Telefone', raw: r => (DB.get('pessoas', r.id) || {}).telefone || '' }, { label: 'Última compra', k: 'ultima', fmt: UI.date }, { label: 'Itens comprados', k: 'itens', r: true }, { label: 'Valor total', k: 'total', fmt: UI.money, r: true, sum: true }], rows, { total: true, link: r => '#/c/clientes/' + r.id })}</section>`;
  });
  add('aniversario', 'Clientes', 'Aniversariantes', (el, st) => {
    const mes = st.mes || UI.today().slice(5, 7);
    const rows = DB.list('pessoas').filter(p => p.cliente && p.nascimento && p.nascimento.slice(5, 7) === mes).sort((a, b) => a.nascimento.slice(8).localeCompare(b.nascimento.slice(8)));
    const ult = id => DB.list('vendas').filter(v => v.cliente_id === id && v.status === 'Concluída').sort((a, b) => b.data.localeCompare(a.data))[0];
    el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Nome', k: 'nome' }, { label: 'Telefone', k: 'telefone' }, { label: 'Aniversário', raw: r => r.nascimento.slice(8) + '/' + r.nascimento.slice(5, 7) }, { label: 'Última compra', raw: r => (ult(r.id) || {}).data, fmt: UI.date },
      { label: 'Último produto', raw: r => ((ult(r.id) || { itens: [{}] }).itens[0] || {}).descricao || '' }, { label: 'Último vendedor', raw: r => nome('vendedores', (ult(r.id) || {}).vendedor_id) },
      { label: '', html: r => r.telefone ? `<button class="btn sm ghost" onclick="event.stopPropagation();REL.parabens(${r.id})">Parabenizar</button>` : '' }], rows)}</section>`;
  }, { semPeriodo: true, filtros: st => sel('mes', 'Mês', ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => ({ v: m, l: UI.monthLabel('2000-' + m).split('/')[0] })), Object.assign({ mes: st.mes || UI.today().slice(5, 7) }, st)) });
  REL.parabens = id => { const c = DB.get('pessoas', id); const m = DB.list('whatsmodelos').find(x => x.tipo === 'Aniversário' && x.padrao); UI.whats(c.telefone, UI.fillTemplate(m ? m.texto : 'Feliz aniversário, {cliente}!', { cliente: c.nome.split(' ')[0], loja: nome('unidades', DB.unitId()) })); };
  add('nps', 'Clientes', 'NPS', el => { App.go('#/c/nps'); }, { semPeriodo: true });

  /* =================== FINANCEIRO =================== */
  const dreLinhas = (st, porComp) => {
    const lanc = DB.list('financeiro').filter(f => f.situacao !== 'Cancelado' && f.considerar !== false);
    const data = f => porComp ? f.competencia || f.vencimento : ((f.pagamentos || [])[0] || {}).data;
    const vs = REL.vendas(st); const os = REL.osFin(st);
    const recVendas = vs.reduce((s, v) => s + v.total, 0), recOS = os.reduce((s, o) => s + NEG.totaisOS(o).total, 0);
    const cmv = vs.reduce((s, v) => s + (v.total_custo || 0), 0), cmvOS = os.reduce((s, o) => s + NEG.totaisOS(o).custo, 0);
    const taxas = vs.reduce((s, v) => s + (v.total_taxas || 0), 0) + os.reduce((s, o) => s + NEG.totaisOS(o).taxas, 0);
    const grupos = {};
    lanc.filter(f => f.tipo === 'D' && inP(data(f), st)).forEach(f => { const c = DB.get('categoriasfin', f.categoria_id) || {}; if (['Não considerar', 'Devoluções'].includes(c.dre)) return; const g = c.dre || 'Despesa operacional'; grupos[g] = grupos[g] || {}; grupos[g][c.nome || 'Sem categoria'] = (grupos[g][c.nome || 'Sem categoria'] || 0) + (porComp ? f.total || f.valor : (f.pagamentos || []).filter(p => inP(p.data, st)).reduce((s, p) => s + p.valor, 0)); });
    const outrasRec = lanc.filter(f => f.tipo === 'R' && !['Venda', 'OS', 'Crédito'].includes(f.origem) && inP(data(f), st)).reduce((s, f) => s + (f.total || f.valor || 0), 0);
    return { recVendas, recOS, outrasRec, cmv, cmvOS, taxas, grupos, nVendas: vs.length, nOS: os.length };
  };
  add('dre', 'Financeiro', 'DRE gerencial (competência)', (el, st) => {
    const comp = st.comp === 'caixa' ? false : true;
    const d = dreLinhas(st, comp);
    const receita = d.recVendas + d.recOS + d.outrasRec;
    const bruto = receita - d.cmv - d.cmvOS - d.taxas;
    const desp = Object.values(d.grupos).reduce((s, g) => s + Object.values(g).reduce((a, b) => a + b, 0), 0);
    const liquido = bruto - desp;
    const L = (l, v, cls, ind) => `<tr class="${cls || ''}"><td style="padding-left:${ind ? 28 : 10}px">${esc(l)}</td><td class="r">${UI.money(v)}</td><td class="r muted">${receita ? UI.pct(v / receita * 100) : ''}</td></tr>`;
    el.innerHTML = kpis([{ l: 'Receita bruta', v: UI.money(receita), c: 'accent' }, { l: 'Lucro bruto', v: UI.money(bruto) }, { l: 'Despesas', v: UI.money(desp), c: 'danger' }, { l: 'Lucro líquido', v: UI.money(liquido), c: liquido >= 0 ? 'ok' : 'danger', s: receita ? UI.pct(liquido / receita * 100) + ' da receita' : '' }]) +
      `<section class="card"><table class="tbl"><thead><tr><th>Descrição</th><th class="r">Valor</th><th class="r">% receita</th></tr></thead><tbody>
      ${L('Receita de vendas', d.recVendas, '', true)}${L('Receita de OS', d.recOS, '', true)}${L('Outras receitas', d.outrasRec, '', true)}${L('(=) Receita bruta', receita, 'row-warn')}
      ${L('(−) Custo das mercadorias vendidas', -d.cmv, '', true)}${L('(−) Custo das OS (peças e serviços)', -d.cmvOS, '', true)}${L('(−) Taxas de cartão', -d.taxas, '', true)}${L('(=) Lucro bruto', bruto, 'row-warn')}
      ${Object.entries(d.grupos).map(([g, cats]) => L('(−) ' + g, -Object.values(cats).reduce((a, b) => a + b, 0)) + Object.entries(cats).map(([c, v]) => L(c, -v, 'muted', true)).join('')).join('')}
      ${L('(=) Lucro líquido', liquido, liquido >= 0 ? 'row-warn' : 'row-danger')}</tbody></table>
      <p class="small muted">Receitas de vendas e OS vêm das vendas concluídas e OS finalizadas no período. Compras de mercadoria não entram como despesa (já entram como custo quando o produto é vendido). Configure grupos em Financeiro > Categorias.</p></section>`;
  }, { filtros: st => sel('comp', 'Despesas por', [{ v: 'caixa', l: 'Despesas por data de pagamento' }], st, 'Despesas por competência'), desc: 'Demonstrativo de resultado: receitas, custos, taxas e despesas do período.' });
  const mensal = (st, comOS, all, porLoja) => {
    const m = {};
    const key = d => porLoja ? 'x' : UI.dia(d).slice(0, 7);
    REL.vendas(st, all).forEach(v => { const k = porLoja ? v.unidade_id : key(v.data); const x = m[k] = m[k] || { k, fat: 0, fatv: 0, fato: 0, cmv: 0, lucro: 0, lucv: 0, luco: 0, nv: 0, no: 0, taxas: 0, desp: 0 }; x.fat += v.total; x.fatv += v.total; x.cmv += v.total_custo || 0; x.lucro += v.lucro || 0; x.lucv += v.lucro || 0; x.nv++; x.taxas += v.total_taxas || 0; });
    if (comOS) REL.osFin(st, all).forEach(o => { const t = NEG.totaisOS(o); const k = porLoja ? o.unidade_id : key(o.data_finalizacao); const x = m[k] = m[k] || { k, fat: 0, fatv: 0, fato: 0, cmv: 0, lucro: 0, lucv: 0, luco: 0, nv: 0, no: 0, taxas: 0, desp: 0 }; x.fat += t.total; x.fato += t.total; x.cmv += t.custo; x.lucro += t.lucro; x.luco += t.lucro; x.no++; x.taxas += t.taxas; });
    DB.list('financeiro', { allUnits: all }).filter(f => f.tipo === 'D' && f.situacao !== 'Cancelado' && f.considerar !== false && inP(f.competencia || f.vencimento, st)).forEach(f => { const c = DB.get('categoriasfin', f.categoria_id) || {}; if (['Não considerar', 'Devoluções'].includes(c.dre)) return; const k = porLoja ? f.unidade_id : key(f.competencia || f.vencimento); const x = m[k] = m[k] || { k, fat: 0, fatv: 0, fato: 0, cmv: 0, lucro: 0, lucv: 0, luco: 0, nv: 0, no: 0, taxas: 0, desp: 0 }; x.desp += f.total || f.valor || 0; });
    return Object.values(m).sort((a, b) => String(a.k).localeCompare(String(b.k))).map(x => Object.assign(x, { liq: r2(x.lucro - x.desp), pliq: x.fat ? r2((x.lucro - x.desp) / x.fat * 100) : 0, ticket: (x.nv + x.no) ? r2(x.fat / (x.nv + x.no)) : 0, lucmed: (x.nv + x.no) ? r2(x.lucro / (x.nv + x.no)) : 0 }));
  };
  const finCols = (comOS, porLoja) => [{ label: porLoja ? 'Loja' : 'Mês', raw: r => r.k, fmt: k => porLoja ? nome('unidades', Number(k)) : UI.monthLabel(k) }, { label: 'Faturamento total', k: 'fat', fmt: UI.money, r: true, sum: true },
    ...(comOS ? [{ label: 'Fat. vendas', k: 'fatv', fmt: UI.money, r: true, sum: true }, { label: 'Fat. OS', k: 'fato', fmt: UI.money, r: true, sum: true }] : []),
    { label: 'CMV', k: 'cmv', fmt: UI.money, r: true, sum: true }, { label: 'Lucro bruto', k: 'lucro', fmt: UI.money, r: true, sum: true },
    { label: 'Qtd. vendas', k: 'nv', r: true, sum: true, fmt: UI.int }, ...(comOS ? [{ label: 'Qtd. OS', k: 'no', r: true, sum: true, fmt: UI.int }] : []), { label: 'Ticket médio', k: 'ticket', fmt: UI.money, r: true },
    { label: 'Despesas', k: 'desp', fmt: UI.money, r: true, sum: true }, { label: 'Lucro líquido', k: 'liq', fmt: UI.money, r: true, sum: true }, { label: '% líquido', k: 'pliq', fmt: UI.pct, r: true },
    { label: 'Lucro médio', k: 'lucmed', fmt: UI.money, r: true }, { label: 'Taxas cartão', k: 'taxas', fmt: UI.money, r: true, sum: true }];
  add('finvendas', 'Financeiro', 'Relatório financeiro de vendas', (el, st) => { const rows = mensal(st); el.innerHTML = `<section class="card"><h2>Lucro líquido por mês</h2>${UI.barChart(rows.map(r => ({ l: UI.monthLabel(r.k), v: Math.max(0, r.liq) })))}</section><section class="card">${REL.tabela(finCols(false), rows, { total: true })}</section>`; }, { st: { de: UI.addMonths(UI.today().slice(0, 8) + '01', -11) } });
  add('finvendasos', 'Financeiro', 'Relatório financeiro vendas + OS', (el, st) => { const rows = mensal(st, true); el.innerHTML = `<section class="card">${REL.tabela(finCols(true), rows, { total: true })}</section>`; }, { st: { de: UI.addMonths(UI.today().slice(0, 8) + '01', -11) } });
  add('finmulti', 'Financeiro', 'Relatório financeiro multilojas', (el, st) => { const rows = mensal(st, true, true, true); el.innerHTML = `<section class="card">${REL.tabela(finCols(true, true), rows, { total: true })}</section>`; });
  add('financeiro', 'Financeiro', 'Relatório financeiro (lançamentos)', (el, st) => {
    let rows = DB.list('financeiro').filter(f => f.situacao !== 'Cancelado' && inP(f.vencimento, st));
    if (st.tipo) rows = rows.filter(f => f.tipo === st.tipo);
    if (st.sit) rows = rows.filter(f => NEG.statusVenc(f) === st.sit);
    const porForma = {}; rows.forEach(f => (f.pagamentos || []).forEach(p => { const k = NEG.forma(p.forma_id).nome || 'Outros'; porForma[k] = (porForma[k] || 0) + (f.tipo === 'R' ? p.valor : -p.valor); }));
    el.innerHTML = `<section class="card"><h2>Resumo por forma de pagamento (recebido − pago)</h2>${REL.tabela([{ label: 'Forma', k: 'l' }, { label: 'Valor', k: 'v', fmt: UI.money, r: true, sum: true }], Object.entries(porForma).map(([l, v]) => ({ l, v })), { total: true })}</section>
      <section class="card">${REL.tabela([{ label: 'Vencimento', k: 'vencimento', fmt: UI.date }, { label: 'Tipo', raw: f => f.tipo === 'R' ? 'Receita' : 'Despesa' }, { label: 'Situação', raw: f => NEG.statusVenc(f) }, { label: 'Pessoa', raw: f => nome('pessoas', f.pessoa_id) }, { label: 'Título', k: 'titulo' }, { label: 'Origem', k: 'origem' }, { label: 'Categoria', raw: f => nome('categoriasfin', f.categoria_id) },
        { label: 'Valor total', raw: f => f.tipo === 'R' ? f.total || f.valor : -(f.total || f.valor), fmt: UI.money, r: true, sum: true }, { label: 'Pago', raw: f => f.tipo === 'R' ? f.pago || 0 : -(f.pago || 0), fmt: UI.money, r: true, sum: true }, { label: 'A pagar/receber', raw: f => f.tipo === 'R' ? NEG.aPagar(f) : -NEG.aPagar(f), fmt: UI.money, r: true, sum: true }], rows.sort((a, b) => a.vencimento.localeCompare(b.vencimento)), { total: true, link: f => `#/c/${f.tipo === 'R' ? 'receitas' : 'despesas'}/${f.id}` })}</section>`;
  }, { filtros: st => sel('tipo', 'Tipo', [{ v: 'R', l: 'Receitas' }, { v: 'D', l: 'Despesas' }], st) + sel('sit', 'Situação', ['Vencido', 'Vence hoje', 'A vencer', 'Pago'].map(x => ({ v: x, l: x })), st) });
  const formasRel = (st, porDia, porTipo) => {
    const m = {};
    REL.pagamentos(st, 'R').forEach(({ f, p }) => {
      const v = f.origem === 'Venda' ? DB.get('vendas', f.origem_id) : null;
      const k = [porDia ? p.data : p.data.slice(0, 7), NEG.forma(p.forma_id).nome || 'Outros', porTipo ? nome('tiposvenda', (v || {}).tipovenda_id) || '—' : (f.origem || 'Manual')].join('¦');
      const x = m[k] = m[k] || { keys: k.split('¦'), valor: 0, taxa: 0 }; x.valor += p.valor; x.taxa += p.taxa || 0;
    });
    const rows = Object.values(m).sort((a, b) => a.keys[0].localeCompare(b.keys[0]) || b.valor - a.valor);
    const tot = rows.reduce((s, r) => s + r.valor, 0);
    return { rows, tot };
  };
  add('formaspag', 'Financeiro', 'Total por forma de pagamento', (el, st) => { const { rows, tot } = formasRel(st); el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Mês', raw: r => r.keys[0], fmt: UI.monthLabel }, { label: 'Forma de pagamento', raw: r => r.keys[1] }, { label: 'Origem', raw: r => r.keys[2] }, { label: 'Valor total', k: 'valor', fmt: UI.money, r: true, sum: true }, { label: 'Percentual', raw: r => tot ? r.valor / tot * 100 : 0, fmt: UI.pct, r: true }], rows, { total: true })}</section>`; });
  add('formaspagdia', 'Financeiro', 'Formas de pagamento por dia', (el, st) => { const { rows } = formasRel(st, true); el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Data', raw: r => r.keys[0], fmt: UI.date }, { label: 'Forma de pagamento', raw: r => r.keys[1] }, { label: 'Origem', raw: r => r.keys[2] }, { label: 'Valor total', k: 'valor', fmt: UI.money, r: true, sum: true }], rows, { total: true })}</section>`; });
  add('sangrias', 'Financeiro', 'Suprimentos e sangrias', (el, st) => {
    const rows = []; DB.list('caixas').forEach(c => (c.movs || []).filter(m => ['Sangria', 'Suprimento'].includes(m.tipo) && inP(m.data, st)).forEach(m => rows.push(Object.assign({ caixa: c.descricao }, m))));
    const s = t => rows.filter(r => r.tipo === t).reduce((a, r) => a + r.valor, 0);
    el.innerHTML = kpis([{ l: 'Total suprimentos', v: UI.money(s('Suprimento')), c: 'ok' }, { l: 'Total sangrias', v: UI.money(s('Sangria')), c: 'danger' }, { l: 'Saldo', v: UI.money(s('Suprimento') - s('Sangria')) }]) + `<section class="card">${REL.tabela([{ label: 'Data/hora', k: 'data', fmt: UI.datetime }, { label: 'Caixa', k: 'caixa' }, { label: 'Tipo', k: 'tipo' }, { label: 'Usuário', k: 'usuario' }, { label: 'Valor', k: 'valor', fmt: UI.money, r: true }, { label: 'Observação', k: 'desc' }], rows)}</section>`;
  });
  add('movfin', 'Financeiro', 'Movimentações financeiras', (el, st) => {
    const rows = REL.pagamentos(st).map(({ f, p }) => ({ data: p.data, tipo: f.tipo, origem: (f.origem || 'Manual') + (f.origem_id ? ' #' + f.origem_id : ''), forma: NEG.forma(p.forma_id).nome || '', banco: nome('bancos', NEG.forma(p.forma_id).banco_id), valor: f.tipo === 'R' ? p.valor : -p.valor, titulo: f.titulo, f }));
    const ent = rows.filter(r => r.valor > 0).reduce((s, r) => s + r.valor, 0), sai = rows.filter(r => r.valor < 0).reduce((s, r) => s - r.valor, 0);
    el.innerHTML = kpis([{ l: 'Total de entradas', v: UI.money(ent), c: 'ok' }, { l: 'Total de saídas', v: UI.money(sai), c: 'danger' }, { l: 'Saldo', v: UI.money(ent - sai), c: 'accent' }]) +
      `<section class="card">${REL.tabela([{ label: 'Data', k: 'data', fmt: UI.date }, { label: 'Descrição', k: 'titulo' }, { label: 'Origem', k: 'origem' }, { label: 'Forma de pagamento', k: 'forma' }, { label: 'Banco', k: 'banco' }, { label: 'Valor', k: 'valor', fmt: UI.money, r: true, sum: true, html: r => `<span class="${r.valor < 0 ? 'neg' : 'pos'}">${UI.money(r.valor)}</span>` }], rows.sort((a, b) => a.data.localeCompare(b.data)), { total: true, link: r => `#/c/${r.tipo === 'R' ? 'receitas' : 'despesas'}/${r.f.id}` })}</section>`;
  });

  /* =================== VENDAS E ESTOQUE =================== */
  add('itensperiodo', 'Vendas e estoque', 'Produtos vendidos por período', REL.agrupado({ fonte: REL.itens, metricas: [M.qtd, M.fat, M.custo, M.lucro, M.lucroMed, M.pct, M.desc] }),
    { periodicidade: true, dims: Object.keys(DIMS), dimsPadrao: ['modelo', 'tipo'], desc: 'Escolha como agrupar: modelo, GB, tipo, estado, categoria, vendedor, canal...' });
  add('resumoestoque', 'Vendas e estoque', 'Resumo de estoque', el => {
    const ps = DB.list('produtos').filter(p => p.quantidade > 0 && p.tipo !== 'Serviço');
    const m = {}; ps.forEach(p => { const x = m[p.tipo] = m[p.tipo] || { tipo: p.tipo, qtd: 0, custo: 0, venda: 0 }; x.qtd += p.quantidade; x.custo += p.quantidade * (p.custo || 0); x.venda += p.quantidade * (p.preco || 0); });
    const rows = Object.values(m);
    el.innerHTML = kpis([...(App.can('ver_custo') ? [{ l: 'Custo do estoque', v: UI.money(rows.reduce((s, r) => s + r.custo, 0)) }] : []), { l: 'Potencial de venda', v: UI.money(rows.reduce((s, r) => s + r.venda, 0)), c: 'accent' }]) +
      `<section class="card">${REL.tabela([{ label: 'Tipo', k: 'tipo' }, { label: 'Quantidade', k: 'qtd', r: true, sum: true, fmt: UI.int }, ...(App.can('ver_custo') ? [{ label: 'Custo total', k: 'custo', fmt: UI.money, r: true, sum: true }] : []), { label: 'Potencial de venda', k: 'venda', fmt: UI.money, r: true, sum: true }], rows, { total: true })}</section>`;
  }, { semPeriodo: true });
  const estoqueRows = (all) => DB.list('produtos', { allUnits: all }).filter(p => p.quantidade > 0 && p.tipo !== 'Serviço').map(p => ({ qtd: p.quantidade, valor: p.quantidade * (p.preco || 0), custo: p.quantidade * (p.custo || 0), tipo: p.tipo, modelo: NEG.descProduto(Object.assign({}, p, { gb_id: null, cor_id: null, estado_id: null })), gb: nome('gbs', p.gb_id), cor: nome('cores', p.cor_id), estado: nome('estados', p.estado_id), categoria: nome('categorias', p.categoria_id), subcategoria: nome('subcategorias', p.subcategoria_id), marca: nome('marcas', p.marca_id), descricao: NEG.descProduto(p), loja: nome('unidades', p.unidade_id) }));
  const ME = [{ k: 'qtd', label: 'Quantidade', fn: rs => rs.reduce((s, r) => s + r.qtd, 0), fmt: UI.int }, { k: 'custo', label: 'Custo total', fn: rs => r2(rs.reduce((s, r) => s + r.custo, 0)), fmt: UI.money, cost: true },
    { k: 'cmed', label: 'Custo médio', fn: rs => { const q = rs.reduce((s, r) => s + r.qtd, 0); return q ? r2(rs.reduce((s, r) => s + r.custo, 0) / q) : 0; }, fmt: UI.money, cost: true },
    { k: 'fat', label: 'Venda total', fn: rs => r2(rs.reduce((s, r) => s + r.valor, 0)), fmt: UI.money }, { k: 'vmed', label: 'Venda média', fn: rs => { const q = rs.reduce((s, r) => s + r.qtd, 0); return q ? r2(rs.reduce((s, r) => s + r.valor, 0) / q) : 0; }, fmt: UI.money }];
  add('detalheestoque', 'Vendas e estoque', 'Detalhes do estoque', REL.agrupado({ fonte: () => estoqueRows(), metricas: ME }), { semPeriodo: true, dims: ['modelo', 'gb', 'cor', 'tipo', 'estado', 'categoria', 'subcategoria', 'marca', 'descricao'], dimsPadrao: ['modelo', 'gb'] });
  add('vendas', 'Vendas e estoque', 'Relatório de vendas', (el, st) => {
    let vs = REL.vendas(st); if (st.vend) vs = vs.filter(v => String(v.vendedor_id) === st.vend);
    const pf = {}; vs.forEach(v => (v.pagamentos || []).forEach(p => { const k = NEG.forma(p.forma_id).nome; const x = pf[k] = pf[k] || { l: k, n: 0, v: 0 }; x.n++; x.v += p.valor; }));
    const sc = App.can('ver_custo');
    el.innerHTML = kpis([{ l: 'Vendas', v: UI.int(vs.length) }, { l: 'Faturamento', v: UI.money(vs.reduce((s, v) => s + v.total, 0)), c: 'accent' }, ...(sc ? [{ l: 'Lucro', v: UI.money(vs.reduce((s, v) => s + (v.lucro || 0), 0)), c: 'ok' }] : [])]) +
      `<section class="card"><h2>Resumo por forma de pagamento</h2>${REL.tabela([{ label: 'Forma', k: 'l' }, { label: 'Quantidade', k: 'n', r: true, sum: true, fmt: UI.int }, { label: 'Valor total', k: 'v', fmt: UI.money, r: true, sum: true }], Object.values(pf), { total: true })}</section>
      <section class="card">${REL.tabela([{ label: 'Venda', k: 'id' }, { label: 'Data', k: 'data', fmt: UI.datetime }, { label: 'Cliente', raw: v => nome('pessoas', v.cliente_id) }, { label: 'Vendedor', raw: v => nome('vendedores', v.vendedor_id) }, { label: 'Desconto', k: 'desconto_total', fmt: UI.money, r: true, sum: true },
        { label: 'Faturamento', k: 'total', fmt: UI.money, r: true, sum: true }, ...(sc ? [{ label: 'Custo', k: 'total_custo', fmt: UI.money, r: true, sum: true }, { label: 'Taxa', k: 'total_taxas', fmt: UI.money, r: true, sum: true }, { label: 'Lucro', k: 'lucro', fmt: UI.money, r: true, sum: true }, { label: '% lucro', raw: v => v.total ? v.lucro / v.total * 100 : 0, fmt: UI.pct, r: true }] : [])], vs, { total: true, link: v => '#/c/vendas/' + v.id })}</section>`;
  }, { filtros: st => sel('vend', 'Vendedor', vendOpts(), st) });
  add('historicovendas', 'Vendas e estoque', 'Histórico de vendas (resumo)', (el, st) => {
    const vs = REL.vendas(st); const it = REL.itens(st); const fat = vs.reduce((s, v) => s + v.total, 0); const luc = vs.reduce((s, v) => s + (v.lucro || 0), 0); const sc = App.can('ver_custo');
    const hora = Array.from({ length: 24 }, (_, h) => ({ l: h + 'h', v: vs.filter(v => new Date(v.data).getHours() === h).length })).filter((x, i) => i >= 8 && i <= 20);
    const dia = {}; vs.forEach(v => { const k = UI.dia(v.data); dia[k] = (dia[k] || 0) + v.total; });
    el.innerHTML = kpis([{ l: 'Faturamento', v: UI.money(fat), c: 'accent' }, { l: 'Qtd. vendas', v: UI.int(vs.length) }, { l: 'Produtos vendidos', v: UI.int(it.reduce((s, i) => s + i.qtd, 0)) }, { l: 'Ticket médio', v: UI.money(vs.length ? fat / vs.length : 0) },
      ...(sc ? [{ l: 'Lucro total', v: UI.money(luc), c: 'ok' }, { l: 'Margem média', v: UI.pct(fat ? luc / fat * 100 : 0) }, { l: 'Custo total', v: UI.money(vs.reduce((s, v) => s + (v.total_custo || 0), 0)) }] : []), { l: 'Desconto total', v: UI.money(vs.reduce((s, v) => s + (v.desconto_total || 0), 0)) }]) +
      `<div class="cols-2"><section class="card"><h2>Vendas por hora do dia</h2>${UI.barChart(hora, { fmt: UI.int })}</section><section class="card"><h2>Faturamento por dia</h2>${UI.barChart(Object.keys(dia).sort().map(k => ({ l: k.slice(8), v: dia[k] })))}</section></div>`;
    REL._last = { cols: [{ label: 'Dia', k: 'd' }, { label: 'Faturamento', k: 'v' }], rows: Object.keys(dia).sort().map(k => ({ d: k, v: dia[k] })) };
  });
  add('upgrade', 'Vendas e estoque', 'Vendas de upgrade e downgrade', (el, st) => {
    const rows = [];
    REL.vendas(st).forEach(v => (v.pagamentos || []).filter(p => p.produto_id).forEach(p => {
      const prod = DB.get('produtos', p.produto_id) || {};
      const rev = DB.list('vendas').find(x => x.status === 'Concluída' && x.itens.some(i => i.produto_id === prod.id));
      const it = rev ? rev.itens.find(i => i.produto_id === prod.id) : null;
      rows.push({ venda: v.id, data: v.data, tipo: nome('tiposvenda', v.tipovenda_id), produto: NEG.descProduto(prod), custo: p.valor, valor_venda: v.total, status: prod.quantidade > 0 ? 'Em estoque' : 'Vendido', dias: rev ? UI.daysBetween(prod.data_entrada || v.data, rev.data) : UI.daysBetween(prod.data_entrada || v.data, UI.today()), revenda_id: rev ? rev.id : '', revenda: it ? it.preco * it.qtd - (it.desconto || 0) : 0, lucro: it ? it.preco * it.qtd - (it.desconto || 0) - p.valor : 0 });
    }));
    el.innerHTML = kpis([{ l: 'Aparelhos recebidos', v: rows.length }, { l: 'Já revendidos', v: rows.filter(r => r.status === 'Vendido').length }, { l: 'Lucro na revenda', v: UI.money(rows.reduce((s, r) => s + r.lucro, 0)), c: 'ok' }]) +
      `<section class="card">${REL.tabela([{ label: 'Venda', k: 'venda' }, { label: 'Data', k: 'data', fmt: UI.date }, { label: 'Tipo', k: 'tipo' }, { label: 'Aparelho de entrada', k: 'produto' }, { label: 'Custo de entrada', k: 'custo', fmt: UI.money, r: true, sum: true }, { label: 'Valor da venda', k: 'valor_venda', fmt: UI.money, r: true }, { label: 'Status', k: 'status' }, { label: 'Dias em estoque', k: 'dias', r: true }, { label: 'Revenda', k: 'revenda_id' }, { label: 'Valor de revenda', k: 'revenda', fmt: UI.money, r: true, sum: true }, { label: 'Lucro na revenda', k: 'lucro', fmt: UI.money, r: true, sum: true }], rows, { total: true, link: r => '#/c/vendas/' + r.venda })}</section>`;
  }, { desc: 'Aparelhos que entraram como pagamento (aparelho na troca) e o resultado da revenda.' });
  add('projecoes', 'Vendas e estoque', 'Dashboard analítico de projeções', (el, st) => {
    const hoje = UI.today(); const ini = hoje.slice(0, 8) + '01'; const diasMes = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0).getDate(); const dia = Number(hoje.slice(8));
    const filt = rows => rows.filter(i => (!st.tipo || i.tipo === st.tipo) && (!st.vend || String(i.vendedor_id) === st.vend));
    const m = (de, ate) => { const it = filt(REL.itens({ de, ate })); const fat = it.reduce((s, i) => s + i.valor, 0); const n = new Set(it.map(i => i.venda.id)).size; return { fat, luc: it.reduce((s, i) => s + i.lucro, 0), qtd: it.reduce((s, i) => s + i.qtd, 0), n, ticket: n ? fat / n : 0 }; };
    const atual = m(ini, hoje); const f = diasMes / dia;
    const proj = { fat: atual.fat * f, luc: atual.luc * f, qtd: atual.qtd * f, n: atual.n * f, ticket: atual.ticket };
    const rows = [];
    for (let i = 5; i >= 1; i--) { const a = UI.addMonths(ini, -i); rows.push(Object.assign({ mes: a.slice(0, 7), status: 'Realizado' }, m(a, UI.addDays(UI.addMonths(a, 1), -1)))); }
    rows.push(Object.assign({ mes: ini.slice(0, 7), status: 'Parcial (até hoje)' }, atual), Object.assign({ mes: ini.slice(0, 7), status: 'Projeção do mês' }, proj));
    const sc = App.can('ver_custo');
    el.innerHTML = kpis([{ l: 'Faturamento projetado', v: UI.money(proj.fat), c: 'accent', s: `realizado ${UI.money(atual.fat)} em ${dia} de ${diasMes} dias` }, ...(sc ? [{ l: 'Lucro projetado', v: UI.money(proj.luc), c: 'ok' }] : []), { l: 'Vendas projetadas', v: UI.int(proj.n) }, { l: 'Ticket médio', v: UI.money(proj.ticket) }]) +
      `<section class="card"><h2>Faturamento por mês</h2>${UI.barChart(rows.filter(r => r.status !== 'Parcial (até hoje)').map(r => ({ l: UI.monthLabel(r.mes).slice(0, 3) + (r.status.startsWith('Proj') ? '*' : ''), v: r.fat })))}<p class="small muted">* projeção pelo ritmo do mês até hoje.</p></section>
      <section class="card">${REL.tabela([{ label: 'Mês', raw: r => r.mes, fmt: UI.monthLabel }, { label: 'Status', k: 'status' }, { label: 'Faturamento', k: 'fat', fmt: UI.money, r: true }, { label: 'Produtos vendidos', k: 'qtd', fmt: UI.int, r: true }, ...(sc ? [{ label: 'Lucro total', k: 'luc', fmt: UI.money, r: true }, { label: 'Lucro médio por venda', raw: r => r.n ? r.luc / r.n : 0, fmt: UI.money, r: true }] : []), { label: 'Qtd. vendas', k: 'n', fmt: UI.int, r: true }, { label: 'Ticket médio', k: 'ticket', fmt: UI.money, r: true }], rows)}</section>`;
  }, { semPeriodo: true, filtros: st => sel('tipo', 'Tipo de produto', NEG.TIPOS_PRODUTO.map(t => ({ v: t, l: t })), st) + sel('vend', 'Vendedor', vendOpts(), st) });

  /* =================== OS =================== */
  add('detalheos', 'Ordem de serviço', 'Relatório detalhado de OS', (el, st) => {
    const rows = REL.osFin(st).map(o => Object.assign({ o }, NEG.totaisOS(o)));
    const sc = App.can('ver_custo');
    el.innerHTML = `<section class="card">${REL.tabela([{ label: 'OS', raw: r => r.o.id }, { label: 'Cliente', raw: r => nome('pessoas', r.o.cliente_id) }, { label: 'Criação', raw: r => r.o.created_at, fmt: UI.date }, { label: 'Finalização', raw: r => r.o.data_finalizacao, fmt: UI.date }, { label: 'Tipo', raw: r => nome('tiposos', r.o.tipo_id) }, { label: 'Serviços', raw: r => (r.o.servicos || []).map(s => s.descricao).join(', ') }, { label: 'Técnico', raw: r => nome('pessoas', r.o.tecnico_id) },
      ...(sc ? [{ label: 'Custo', k: 'custo', fmt: UI.money, r: true, sum: true }] : []), { label: 'Valor total', k: 'total', fmt: UI.money, r: true, sum: true }, ...(sc ? [{ label: 'Taxa', k: 'taxas', fmt: UI.money, r: true, sum: true }, { label: 'Lucro', k: 'lucro', fmt: UI.money, r: true, sum: true }, { label: 'Margem', raw: r => r.total ? r.lucro / r.total * 100 : 0, fmt: UI.pct, r: true }] : [])], rows, { total: true, link: r => '#/os/' + r.o.id })}</section>`;
  }, { desc: 'OS finalizadas no período.' });
  add('relos', 'Ordem de serviço', 'Relatório de ordens de serviço', REL.agrupado({ fonte: st => REL.osFin(st).map(o => { const t = NEG.totaisOS(o); return { data: o.data_finalizacao, qtd: 1, valor: t.total, custo: t.custo, taxa: t.taxas, lucro: t.lucro, venda: { id: o.id }, tecnico: nome('pessoas', o.tecnico_id) || '—', tipo: nome('tiposos', o.tipo_id), canal: nome('canais', o.canal_id), vendedor: nome('vendedores', o.vendedor_id), cliente: nome('pessoas', o.cliente_id) }; }), metricas: [M.qtd, M.fat, M.custo, M.lucro, M.pct] }),
    { periodicidade: true, dims: ['tecnico', 'tipo', 'canal', 'vendedor', 'cliente'], dimsPadrao: ['tecnico'] });
  DIMS.tecnico = 'Técnico';
  add('comissaotecnico', 'Ordem de serviço', 'Comissão de técnicos', (el, st) => {
    const m = {};
    REL.osFin(st).forEach(o => (o.servicos || []).forEach(s => { const k = (o.tecnico_id || 0) + '¦' + s.descricao; const x = m[k] = m[k] || { tec: o.tecnico_id, serv: s.descricao, n: 0, v: 0, l: 0 }; x.n++; x.v += (s.valor || 0) - (s.desconto || 0); x.l += (s.valor || 0) - (s.desconto || 0) - (s.custo || 0); }));
    const pct = id => Number((DB.get('pessoas', id) || {}).comissao_pct || DB.cfg().comissao_tecnico_pct || 0);
    const rows = Object.values(m).map(x => Object.assign(x, { pct: pct(x.tec), com: r2(x.l * pct(x.tec) / 100) }));
    el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Técnico', raw: r => nome('pessoas', r.tec) || 'Sem técnico' }, { label: 'Serviço', k: 'serv' }, { label: 'Quantidade', k: 'n', r: true, sum: true, fmt: UI.int }, { label: 'Valor', k: 'v', fmt: UI.money, r: true, sum: true }, { label: 'Lucro', k: 'l', fmt: UI.money, r: true, sum: true }, { label: '% comissão', k: 'pct', fmt: UI.pct, r: true }, { label: 'Comissão', k: 'com', fmt: UI.money, r: true, sum: true }], rows, { total: true })}<p class="small muted">Comissão sobre o lucro do serviço; percentual em Configurações > Parâmetros gerais.</p></section>`;
  });

  /* =================== VENDEDORES =================== */
  const porVendedor = st => { const m = {}; REL.itens(st).forEach(i => { const x = m[i.vendedor_id] = m[i.vendedor_id] || { id: i.vendedor_id, fat: 0, luc: 0, qtd: 0, vendas: new Set() }; x.fat += i.valor; x.luc += i.lucro; x.qtd += i.qtd; x.vendas.add(i.venda.id); }); return Object.values(m).map(x => Object.assign(x, { n: x.vendas.size, ticket: x.vendas.size ? x.fat / x.vendas.size : 0 })).sort((a, b) => b.fat - a.fat); };
  add('rankingvendedores', 'Vendedores', 'Ranking de vendedores', (el, st) => {
    const rows = porVendedor(st); const sc = App.can('ver_custo') || !DB.cfg().bloquear_lucro_vendedor;
    el.innerHTML = `<section class="card"><h2>Faturamento por vendedor</h2>${UI.hbars(rows.map(r => ({ l: nome('vendedores', r.id), v: r.fat })))}</section><section class="card">${REL.tabela([{ label: 'Posição', raw: r => rows.indexOf(r) + 1 }, { label: 'Vendedor', raw: r => nome('vendedores', r.id) }, { label: 'Faturamento', k: 'fat', fmt: UI.money, r: true, sum: true }, ...(sc ? [{ label: 'Lucro', k: 'luc', fmt: UI.money, r: true, sum: true }] : []), { label: 'Ticket médio', k: 'ticket', fmt: UI.money, r: true }, { label: 'Qtd. vendas', k: 'n', r: true, sum: true, fmt: UI.int }], rows, { total: true })}</section>`;
  });
  add('comissao', 'Vendedores', 'Comissão de vendedores', (el, st) => {
    const m = {};
    REL.itens(st).forEach(i => { const k = i.vendedor_id + '¦' + i.tipo; const x = m[k] = m[k] || { vid: i.vendedor_id, tipo: i.tipo, qtd: 0, v: 0, l: 0 }; x.qtd += i.qtd; x.v += i.valor; x.l += i.lucro; });
    const rows = Object.values(m).map(x => { const c = NEG.comissao(x.vid, x.v, x.l, x.tipo); return Object.assign(x, { modelo: c.modelo, pct: c.pct, com: c.valor }); });
    const tot = {}; rows.forEach(r => tot[r.vid] = (tot[r.vid] || 0) + r.com);
    el.innerHTML = kpis(Object.entries(tot).map(([id, v]) => ({ l: nome('vendedores', Number(id)), v: UI.money(v), c: 'accent' }))) + `<section class="card">${REL.tabela([{ label: 'Vendedor', raw: r => nome('vendedores', r.vid) }, { label: 'Tipo de produto', k: 'tipo' }, { label: 'Quantidade vendida', k: 'qtd', r: true, sum: true, fmt: UI.int }, { label: 'Valor vendido', k: 'v', fmt: UI.money, r: true, sum: true }, { label: 'Lucro', k: 'l', fmt: UI.money, r: true, sum: true }, { label: 'Modelo de comissão', k: 'modelo' }, { label: 'Coeficiente', k: 'pct', fmt: UI.pct, r: true }, { label: 'Comissão', k: 'com', fmt: UI.money, r: true, sum: true }], rows, { total: true })}<p class="small muted">Regras em Vendas > Configurações > Vendedores.</p></section>`;
  });
  add('dashvendedor', 'Vendedores', 'Dashboard do vendedor', (el, st) => {
    const vid = st.vend || (DB.user() || {}).vendedor_id;
    const it = REL.itens(st).filter(i => String(i.vendedor_id) === String(vid));
    const vs = [...new Set(it.map(i => i.venda))];
    const metas = DB.list('metas').filter(m => (!m.vendedor_id || String(m.vendedor_id) === String(vid)) && m.data_ini <= st.ate && m.data_fim >= st.de);
    el.innerHTML = kpis([{ l: 'Produtos vendidos', v: UI.int(it.reduce((s, i) => s + i.qtd, 0)) }, { l: 'Qtd. vendas', v: vs.length }, { l: 'Faturamento', v: UI.money(it.reduce((s, i) => s + i.valor, 0)), c: 'accent' }]) +
      (metas.length ? `<section class="card"><h2>Metas</h2>${metas.map(m => REL.metaBar(m)).join('')}</section>` : '') +
      `<section class="card"><h2>Últimas vendas</h2>${REL.tabela([{ label: 'Venda', raw: r => r.venda.id }, { label: 'Cliente', k: 'cliente' }, { label: 'Data', k: 'data', fmt: UI.date }, { label: 'Tipo', k: 'tipo' }, { label: 'Produto', k: 'descricao' }, { label: 'Qtd', k: 'qtd', r: true }, { label: 'Faturamento', k: 'valor', fmt: UI.money, r: true, sum: true }], it.sort((a, b) => b.data.localeCompare(a.data)), { total: true, link: r => '#/c/vendas/' + r.venda.id })}</section>`;
  }, { filtros: st => sel('vend', 'Vendedor', vendOpts(), Object.assign({ vend: (DB.user() || {}).vendedor_id }, st)) });
  const vendMensal = (st, multi) => REL.agrupado({ fonte: s => REL.itens(s, multi), metricas: [M.qtd, M.fat, M.lucro] });
  add('relvendedores', 'Vendedores', 'Relatório de vendedores', vendMensal(), { periodicidade: true, per: 'Mensal', dims: ['vendedor', 'tipo'], dimsPadrao: ['vendedor', 'tipo'] });
  add('relvendedoresmulti', 'Vendedores', 'Vendedores — todas as lojas', vendMensal(null, true), { periodicidade: true, per: 'Mensal', dims: ['loja', 'vendedor', 'tipo'], dimsPadrao: ['loja', 'vendedor'] });
  add('vendedoresdia', 'Vendedores', 'Vendas por vendedor (por dia)', REL.agrupado({ fonte: REL.itens, metricas: [M.vendas, M.qtd, M.fat, M.lucro], sortPer: true }), { periodicidade: true, per: 'Diário', dims: ['vendedor', 'tipo'], dimsPadrao: ['vendedor'] });
  add('vendedorforma', 'Vendedores', 'Total por vendedor e forma de pagamento', (el, st) => {
    const m = {}; REL.vendas(st).forEach(v => (v.pagamentos || []).forEach(p => { const k = v.vendedor_id + '¦' + p.forma_id; const x = m[k] = m[k] || { vid: v.vendedor_id, f: p.forma_id, n: 0, v: 0 }; x.n++; x.v += p.valor; }));
    el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Vendedor', raw: r => nome('vendedores', r.vid) }, { label: 'Forma de pagamento', raw: r => NEG.forma(r.f).nome }, { label: 'Quantidade', k: 'n', r: true, sum: true, fmt: UI.int }, { label: 'Valor', k: 'v', fmt: UI.money, r: true, sum: true }], Object.values(m), { total: true })}</section>`;
  });
  REL.metaValor = m => {
    const st = { de: m.data_ini, ate: m.data_fim };
    if (m.categoria === 'Ordem de serviço') { const os = REL.osFin(st).filter(o => !m.tecnico_id || o.tecnico_id === m.tecnico_id); return /Lucro/.test(m.tipo) ? os.reduce((s, o) => s + NEG.totaisOS(o).lucro, 0) : /Quantidade/.test(m.tipo) ? os.length : os.reduce((s, o) => s + NEG.totaisOS(o).total, 0); }
    let it = REL.itens(st);
    if (m.vendedor_id && /vendedor/i.test(m.tipo)) it = it.filter(i => i.vendedor_id === m.vendedor_id);
    if (m.tipo_produto && /tipo de produto|por tipo/i.test(m.tipo)) it = it.filter(i => i.tipo === m.tipo_produto);
    return /Lucro/.test(m.tipo) ? it.reduce((s, i) => s + i.lucro, 0) : /Quantidade/.test(m.tipo) ? it.reduce((s, i) => s + i.qtd, 0) : it.reduce((s, i) => s + i.valor, 0);
  };
  REL.metaBar = m => {
    const real = REL.metaValor(m); const pct = m.valor ? real / m.valor * 100 : 0; const qtdTipo = /Quantidade/.test(m.tipo);
    const diasT = UI.daysBetween(m.data_ini, m.data_fim) + 1; const diasP = Math.min(diasT, Math.max(0, UI.daysBetween(m.data_ini, UI.today()) + 1));
    const esperado = diasT ? diasP / diasT * 100 : 0;
    return `<div style="margin-bottom:14px"><div class="row-form" style="justify-content:space-between"><b>${esc(m.tipo)}${m.vendedor_id ? ' — ' + esc(nome('vendedores', m.vendedor_id)) : ''}${m.tipo_produto ? ' — ' + esc(m.tipo_produto) : ''}</b><span>${qtdTipo ? UI.int(real) : UI.money(real)} de ${qtdTipo ? UI.int(m.valor) : UI.money(m.valor)} · <b>${UI.pct(pct)}</b></span></div>
      <div class="hbar-t" style="height:16px;position:relative"><i style="width:${Math.min(100, pct)}%;background:${pct >= esperado ? 'var(--ok)' : 'var(--warn)'}"></i><span title="Esperado até hoje" style="position:absolute;top:-2px;bottom:-2px;left:${Math.min(100, esperado)}%;width:2px;background:var(--text)"></span></div>
      <div class="small muted">${UI.date(m.data_ini)} a ${UI.date(m.data_fim)} · esperado até hoje: ${UI.pct(esperado)} ${pct >= esperado ? '· no ritmo' : '· abaixo do ritmo'}</div></div>`;
  };
  add('metas', 'Vendedores', 'Dashboard de metas', (el, st) => {
    const ms = DB.list('metas').filter(m => m.data_ini <= st.ate && m.data_fim >= st.de);
    el.innerHTML = ms.length ? `<section class="card">${ms.map(REL.metaBar).join('')}</section>` : `<div class="card empty">Nenhuma meta no período. <a href="#/c/metas/novo">Cadastrar meta</a></div>`;
  }, { desc: 'A linha escura marca quanto já deveria ter sido feito até hoje.' });

  /* =================== GESTÃO =================== */
  add('recap', 'Gestão', 'Recap anual', (el, st) => {
    const ano = st.ano || UI.today().slice(0, 4); const s = { de: ano + '-01-01', ate: ano + '-12-31' };
    const it = REL.itens(s);
    const g = (k, mk) => { const m = {}; it.forEach(i => { const x = m[i[k]] = m[i[k]] || { l: i[k], q: 0, v: 0, l2: 0 }; x.q += i.qtd; x.v += i.valor; x.l2 += i.lucro; }); return Object.values(m); };
    const prods = g('modelo'); const cli = g('cliente');
    const mes = Array.from({ length: 12 }, (_, i) => { const k = ano + '-' + String(i + 1).padStart(2, '0'); return { l: UI.monthLabel(k).slice(0, 3), v: it.filter(x => UI.dia(x.data).slice(0, 7) === k).reduce((a, x) => a + x.valor, 0) }; });
    el.innerHTML = kpis([{ l: 'Faturamento do ano', v: UI.money(it.reduce((a, i) => a + i.valor, 0)), c: 'accent' }, { l: 'Vendas', v: UI.int(new Set(it.map(i => i.venda.id)).size) }, { l: 'Produtos vendidos', v: UI.int(it.reduce((a, i) => a + i.qtd, 0)) }]) +
      `<section class="card"><h2>Faturamento por mês em ${ano}</h2>${UI.barChart(mes)}</section><div class="cols-2"><section class="card"><h2>Produtos mais vendidos</h2>${UI.hbars(prods.sort((a, b) => b.q - a.q).slice(0, 10).map(x => ({ l: x.l, v: x.q })), { fmt: UI.int })}</section>
      ${App.can('ver_custo') ? `<section class="card"><h2>Produtos com maior margem</h2>${UI.hbars(prods.filter(x => x.v > 0).sort((a, b) => b.l2 / b.v - a.l2 / a.v).slice(0, 10).map(x => ({ l: x.l, v: x.l2 / x.v * 100 })), { fmt: UI.pct })}</section>` : ''}
      <section class="card"><h2>Melhores clientes</h2>${UI.hbars(cli.sort((a, b) => b.v - a.v).slice(0, 10).map(x => ({ l: x.l, v: x.v })))}</section></div>`;
  }, { semPeriodo: true, filtros: st => sel('ano', 'Ano', [0, 1, 2].map(i => String(Number(UI.today().slice(0, 4)) - i)).map(a => ({ v: a, l: a })), Object.assign({ ano: UI.today().slice(0, 4) }, st)) });
  add('usomodulo', 'Gestão', 'Uso do sistema por módulo', (el, st) => {
    const a = DB.raw('auditoria').filter(x => inP(x.data, st));
    const m = {}; a.forEach(x => { const k = x.origem + '¦' + x.usuario; const y = m[k] = m[k] || { o: x.origem, u: x.usuario, c: 0, a: 0, e: 0 }; if (x.operacao === 'Criação') y.c++; else if (x.operacao === 'Exclusão') y.e++; else y.a++; });
    el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Módulo / cadastro', k: 'o' }, { label: 'Usuário', k: 'u' }, { label: 'Criações', k: 'c', r: true, sum: true, fmt: UI.int }, { label: 'Alterações', k: 'a', r: true, sum: true, fmt: UI.int }, { label: 'Exclusões', k: 'e', r: true, sum: true, fmt: UI.int }], Object.values(m).sort((x, y) => (y.c + y.a) - (x.c + x.a)), { total: true })}</section>`;
  });
  add('catalogoacessos', 'Gestão', 'Acessos ao catálogo', el => { el.innerHTML = '<div class="card empty">A contagem de acessos ao catálogo online precisa do servidor e entra na próxima versão.</div>'; }, { semPeriodo: true });

  /* =================== FISCAL =================== */
  add('nfe', 'Fiscal', 'Relatório de notas fiscais', (el, st) => {
    const sai = DB.list('nfe').filter(n => inP(n.data, st)); const ent = DB.list('nfeentrada').filter(n => inP(n.data, st)).map(n => Object.assign({ tipo_op: 'Entrada (upgrade)' }, n)); const dfe = DB.list('dfe').filter(n => inP(n.emissao, st)).map(n => ({ tipo_op: 'Entrada (fornecedor)', numero: n.numero, data: n.emissao, valor: n.valor, pessoa_id: n.fornecedor_id, status: 'Recebida' }));
    const rows = [...sai, ...ent, ...dfe];
    el.innerHTML = kpis([{ l: 'Notas de entrada', v: ent.length + dfe.length }, { l: 'Notas de saída', v: sai.length }, { l: 'Valor de saída', v: UI.money(sai.filter(n => n.status === 'Autorizada').reduce((s, n) => s + n.valor, 0)), c: 'accent' }]) +
      `<section class="card">${REL.tabela([{ label: 'Operação', k: 'tipo_op' }, { label: 'Destinatário / emitente', raw: n => nome('pessoas', n.pessoa_id) }, { label: 'Data', k: 'data', fmt: UI.date }, { label: 'Nº', k: 'numero' }, { label: 'Valor', k: 'valor', fmt: UI.money, r: true, sum: true }, { label: 'Status', k: 'status' }], rows, { total: true })}</section>`;
  });

  /* =================== LEGADO (visões prontas) =================== */
  const leg = (id, t, dims, per, mets) => add(id, 'Legado', t, REL.agrupado({ fonte: REL.itens, metricas: mets || [M.qtd, M.fat, M.lucro, M.pct], sortPer: true }), { periodicidade: true, per, dims: Object.keys(DIMS), dimsPadrao: dims });
  leg('leg_itens', 'Itens vendidos (mensal)', ['modelo', 'gb', 'tipo', 'estado'], 'Mensal');
  leg('leg_itensdia', 'Itens vendidos (por dia)', ['modelo', 'tipo'], 'Diário');
  leg('leg_itensprod', 'Itens vendidos (por produto)', ['descricao', 'cor', 'gb', 'estado'], 'Nenhum');
  add('leg_estoqueap', 'Legado', 'Estoque por aparelho', REL.agrupado({ fonte: () => estoqueRows().filter(r => r.tipo === 'Aparelho'), metricas: ME }), { semPeriodo: true, dims: ['modelo', 'estado'], dimsPadrao: ['modelo', 'estado'] });
  add('leg_estoquegb', 'Legado', 'Estoque por modelo, GB e cor', REL.agrupado({ fonte: () => estoqueRows(), metricas: ME }), { semPeriodo: true, dims: ['modelo', 'gb', 'cor', 'estado'], dimsPadrao: ['modelo', 'gb', 'cor'] });
  add('leg_estoquemulti', 'Legado', 'Estoque — todas as lojas', REL.agrupado({ fonte: () => estoqueRows(true), metricas: ME }), { semPeriodo: true, dims: ['loja', 'modelo', 'gb'], dimsPadrao: ['loja', 'modelo'] });
  add('leg_dashgeral', 'Legado', 'Dashboard geral', (el, st) => {
    const vs = REL.vendas(st); const dia = {}; const mes = {};
    vs.forEach(v => { dia[UI.dia(v.data)] = (dia[UI.dia(v.data)] || 0) + 1; mes[UI.dia(v.data).slice(0, 7)] = (mes[UI.dia(v.data).slice(0, 7)] || 0) + v.total; });
    el.innerHTML = kpis([{ l: 'Venda total', v: UI.money(vs.reduce((s, v) => s + v.total, 0)), c: 'accent' }, { l: 'Quantidade de vendas', v: vs.length }, { l: 'Total em estoque', v: UI.int(DB.list('produtos').filter(p => p.tipo !== 'Serviço').reduce((s, p) => s + Math.max(0, p.quantidade), 0)) }]) +
      `<section class="card"><h2>Quantidade de vendas por dia</h2>${UI.barChart(Object.keys(dia).sort().map(k => ({ l: k.slice(8), v: dia[k] })), { fmt: UI.int })}</section><section class="card"><h2>Total de vendas por mês</h2>${UI.barChart(Object.keys(mes).sort().map(k => ({ l: UI.monthLabel(k), v: mes[k] })))}</section>`;
  }, { st: { de: UI.addMonths(UI.today().slice(0, 8) + '01', -5) } });
  add('leg_dashdiario', 'Legado', 'Dashboard diário', el => App.go('#/inicio'), { semPeriodo: true });
  leg('leg_entrega', 'Vendas por tipo de entrega', ['entrega'], 'Mensal', [M.vendas, M.fat]);
  leg('leg_tipoprod', 'Lucro por tipo de produto', ['tipo'], 'Mensal', [M.qtd, M.lucroMed, M.lucro, M.fat, M.pct, M.custo, M.desc]);
  add('leg_consolidada', 'Legado', 'Venda consolidada', (el, st) => { const vs = REL.vendas(st); el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Venda', k: 'id' }, { label: 'Data', k: 'data', fmt: UI.date }, { label: 'Tipo', raw: v => nome('tiposvenda', v.tipovenda_id) }, { label: 'Canal', raw: v => nome('canais', v.canal_id) }, { label: 'Vendedor', raw: v => nome('vendedores', v.vendedor_id) }, { label: 'Cliente', raw: v => nome('pessoas', v.cliente_id) }, { label: 'Valor total', k: 'total', fmt: UI.money, r: true, sum: true }, ...(App.can('ver_custo') ? [{ label: 'Lucro', k: 'lucro', fmt: UI.money, r: true, sum: true }, { label: '% lucro', raw: v => v.total ? v.lucro / v.total * 100 : 0, fmt: UI.pct, r: true }] : []), { label: 'Produtos', raw: v => v.itens.map(i => i.descricao).join(', ') }], vs, { total: true, link: v => '#/c/vendas/' + v.id })}</section>`; });
  leg('leg_funil', 'Funil de vendas (por tipo de venda)', ['tipovenda'], 'Mensal', [M.vendas, M.lucroMed, M.lucro, M.fat, M.pct, M.custo, M.desc]);
  leg('leg_canal', 'Vendas por canal de venda', ['canal'], 'Mensal', [M.vendas, M.fat]);
  leg('leg_estado', 'Vendas por estado do aparelho', ['estado'], 'Mensal', [M.qtd, M.fat]);
  add('leg_formastipo', 'Legado', 'Formas de pagamento por dia e tipo de venda', (el, st) => { const { rows } = formasRel(st, true, true); el.innerHTML = `<section class="card">${REL.tabela([{ label: 'Data', raw: r => r.keys[0], fmt: UI.date }, { label: 'Forma', raw: r => r.keys[1] }, { label: 'Tipo de venda', raw: r => r.keys[2] }, { label: 'Valor total', k: 'valor', fmt: UI.money, r: true, sum: true }, { label: 'Taxa', k: 'taxa', fmt: UI.money, r: true, sum: true }, { label: 'Líquido', raw: r => r.valor - r.taxa, fmt: UI.money, r: true, sum: true }], rows, { total: true })}</section>`; });
})();
