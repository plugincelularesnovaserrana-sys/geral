/* TELA INICIAL: painel do dia com projeção, atalhos, gráficos e agenda */
(function () {
  const nome = (col, id) => (DB.get(col, id) || {}).nome || '';
  const ic = n => FX.ic(n);
  const st = { de: null, ate: null };

  /* rosca de participação (formas de pagamento etc.) */
  window.FX.donut = (dados, { fmt = UI.money, size = 150 } = {}) => {
    const tot = dados.reduce((s, d) => s + d.v, 0);
    if (!tot) return `<div class="empty-state"><span class="ill">${ic('chart-pie')}</span>Sem dados no período.</div>`;
    let lista = dados.slice().sort((a, b) => b.v - a.v);
    if (lista.length > 6) { const resto = lista.slice(5).reduce((s, d) => s + d.v, 0); lista = lista.slice(0, 5).concat([{ l: 'Outros', v: resto, outros: true }]); }
    const r = 54, C = 2 * Math.PI * r; let acc = 0;
    const segs = lista.map((d, i) => {
      const frac = d.v / tot; const len = Math.max(0, frac * C - 3);
      const cor = d.outros ? 'var(--c7)' : `var(--c${i + 1})`;
      const s = `<circle class="seg" r="${r}" cx="70" cy="70" fill="none" stroke="${cor}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" style="animation-delay:${i * .08}s"><title>${esc(d.l)}: ${esc(fmt(d.v))}</title></circle>`;
      acc += frac * C; return s;
    }).join('');
    return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140" width="${size}" height="${size}" role="img" aria-label="Gráfico de rosca" style="transform:rotate(-90deg)">
      <circle r="${r}" cx="70" cy="70" fill="none" stroke="var(--surface-3)" stroke-width="18"></circle>${segs}</svg>
      <div class="legend">${lista.map((d, i) => `<div><i style="background:${d.outros ? 'var(--c7)' : `var(--c${i + 1})`}"></i>${esc(d.l)}<b>${esc(fmt(d.v))}</b><span class="muted small" style="min-width:42px;text-align:right">${UI.pct(d.v / tot * 100)}</span></div>`).join('')}</div></div>`;
  };
  /* anel de progresso */
  window.FX.ring = (pct, rotulo) => {
    const r = 50, C = 2 * Math.PI * r; const p = Math.max(0, Math.min(100, pct));
    return `<div class="ring"><svg viewBox="0 0 120 120" width="120" height="120"><circle r="${r}" cx="60" cy="60" fill="none" stroke="var(--surface-3)" stroke-width="12"/>
      <circle class="bar" r="${r}" cx="60" cy="60" fill="none" stroke="url(#gr)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p / 100)}" style="--full:${C}"/>
      <defs><linearGradient id="gr" x1="0" x2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--mint)"/></linearGradient></defs></svg>
      <div class="ring-v"><div>${UI.pct(pct).replace(/,\d+%/, '%')}<small>${esc(rotulo)}</small></div></div></div>`;
  };

  App.route('/inicio', el => {
    const hoje = UI.today();
    st.de = st.de || hoje; st.ate = st.ate || hoje;
    const inP = d => { const x = UI.dia(d); return x >= st.de && x <= st.ate; };
    const todas = DB.list('vendas').filter(v => v.status === 'Concluída');
    const vendas = todas.filter(v => inP(v.data));
    const fat = vendas.reduce((s, v) => s + v.total, 0), luc = vendas.reduce((s, v) => s + (v.lucro || 0), 0);
    const ini = hoje.slice(0, 8) + '01'; const dia = Number(hoje.slice(8)); const diasMes = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0).getDate();
    const mes = todas.filter(v => UI.dia(v.data) >= ini);
    const fatMes = mes.reduce((s, v) => s + v.total, 0), lucMes = mes.reduce((s, v) => s + (v.lucro || 0), 0);
    const proj = x => x * diasMes / dia;
    const iniAnt = UI.addMonths(ini, -1);
    const fatAnt = todas.filter(v => UI.dia(v.data) >= iniAnt && UI.dia(v.data) < ini).reduce((s, v) => s + v.total, 0);
    const metaLoja = DB.list('metas').find(m => m.tipo === 'Faturamento total da loja' && m.data_ini <= hoje && m.data_fim >= hoje);
    const alvo = metaLoja ? metaLoja.valor : (fatAnt || 0);
    const pctAlvo = alvo ? fatMes / alvo * 100 : 0;
    const showLucro = App.can('ver_custo') || !DB.cfg().bloquear_lucro_vendedor;
    const u = DB.user(); const h = new Date().getHours();
    const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const dataExt = (d => d.charAt(0).toUpperCase() + d.slice(1))(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));

    // financeiro e caixa
    const pags = []; DB.list('financeiro').filter(f => f.situacao !== 'Cancelado').forEach(f => (f.pagamentos || []).forEach(p => { if (inP(p.data)) pags.push({ f, p }); }));
    const soma = fn => pags.filter(fn).reduce((s, x) => s + x.p.valor, 0);
    const caixas = DB.list('caixas').filter(c => inP(c.abertura) || c.status === 'Aberto');
    const movs = caixas.flatMap(c => c.movs || []).filter(m => inP(m.data));
    const sang = movs.filter(m => m.tipo === 'Sangria').reduce((s, m) => s + m.valor, 0), sup = movs.filter(m => m.tipo === 'Suprimento').reduce((s, m) => s + m.valor, 0);
    const COMPRA = ['Ordem de compra', 'Produto', 'XML de NF-e'];
    const E = { vendas: soma(x => x.f.tipo === 'R' && x.f.origem === 'Venda'), os: soma(x => x.f.tipo === 'R' && x.f.origem === 'OS'), outras: soma(x => x.f.tipo === 'R' && !['Venda', 'OS'].includes(x.f.origem)) };
    const S = { compras: soma(x => x.f.tipo === 'D' && COMPRA.includes(x.f.origem)), despesas: soma(x => x.f.tipo === 'D' && !COMPRA.includes(x.f.origem)) };
    const totE = E.vendas + E.os + E.outras + sup, totS = S.compras + S.despesas + sang;
    const formas = {}; vendas.forEach(v => (v.pagamentos || []).forEach(p => { const k = NEG.forma(p.forma_id).nome || 'Outros'; formas[k] = (formas[k] || 0) + p.valor; }));
    const osAb = DB.list('os').filter(o => !['Finalizada', 'Cancelada'].includes((DB.get('situacoesos', o.situacao_id) || {}).finalidade));
    const porDia = {}; todas.filter(v => UI.dia(v.data) >= UI.addDays(hoje, -13)).forEach(v => { const k = UI.dia(v.data); porDia[k] = (porDia[k] || 0) + v.total; });
    const dias14 = Array.from({ length: 14 }, (_, i) => UI.addDays(hoje, i - 13));
    const top = {}; mes.forEach(v => v.itens.filter(i => !i.devolvido).forEach(i => { top[i.descricao] = (top[i.descricao] || 0) + i.qtd; }));
    const aReceber = DB.list('financeiro').filter(f => f.tipo === 'R' && ['Em aberto', 'Parcial'].includes(f.situacao) && f.vencimento <= UI.addDays(hoje, 7)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const aPagar = DB.list('financeiro').filter(f => f.tipo === 'D' && ['Em aberto', 'Parcial'].includes(f.situacao) && f.vencimento <= UI.addDays(hoje, 7)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const aniv = DB.list('pessoas').filter(p => p.cliente && p.nascimento && p.nascimento.slice(5) === hoje.slice(5));
    const osVenc = osAb.filter(o => o.previsao && o.previsao <= hoje);
    const cx = NEG.caixaAberto();
    const fmtDia = d => d === hoje ? 'hoje' : d < hoje ? 'venceu ' + UI.date(d).slice(0, 5) : UI.date(d).slice(0, 5);

    const quick = [['Nova venda', '#/pdv', 'shopping-cart', '#3557ff', '#7b5cff'], ['Nova OS', '#/os/novo', 'wrench', '#0ea5c6', '#3557ff'], ['Upgrade', '#/upgrade/novo', 'repeat', '#7b5cff', '#e0457b'],
      ['Clientes', '#/c/clientes', 'users', '#14b88a', '#0ea5c6'], ['Estoque', '#/estoque/consulta', 'package', '#e39b16', '#e0457b'], ['Receitas', '#/c/receitas', 'hand-coins', '#14b88a', '#3557ff'],
      ['Relatórios', '#/relatorios', 'chart-column', '#3557ff', '#14b88a']];

    el.innerHTML = `
      <section class="hero">
        <div class="hero-row">
          <div><h1>${saud}, ${esc((u.nome || '').split(' ')[0])}!</h1><p>${esc(dataExt)} · ${esc(nome('unidades', DB.unitId()))}</p>
            <p style="margin-top:12px">${vendas.length ? `${vendas.length} venda(s) no período, ticket médio de ${UI.money(fat / vendas.length)}.` : 'Nenhuma venda no período ainda. Bora abrir o caixa?'}</p></div>
          <div class="hero-big"><span>Faturamento do mês</span><b data-count>${UI.money(fatMes)}</b><span>projeção ${UI.money(proj(fatMes))}</span></div>
        </div>
        <div class="hero-prog" title="${metaLoja ? 'Meta do mês' : 'Comparado ao mês passado'}"><i style="width:${Math.min(100, pctAlvo).toFixed(1)}%"></i></div>
        <p class="small" style="margin-top:8px">${alvo ? `${UI.pct(pctAlvo)} ${metaLoja ? 'da meta de ' + UI.money(alvo) : 'do faturamento do mês passado (' + UI.money(alvo) + ')'}` : 'Cadastre uma meta de faturamento da loja para acompanhar aqui.'}</p>
      </section>
      <div class="quick">${quick.map(([l, href, i, a, b]) => `<a href="${href}"><span class="qi" style="--q1:${a};--q2:${b}">${ic(i)}</span>${l}</a>`).join('')}
        ${cx ? `<a href="#/c/caixas/${cx.id}"><span class="qi" style="--q1:#14b88a;--q2:#0f8a5f">${ic('lock-open')}</span>Caixa aberto</a>` : App.can('caixa') ? `<button data-abrir-caixa><span class="qi" style="--q1:#e39b16;--q2:#d23b31">${ic('lock')}</span>Abrir caixa</button>` : ''}</div>
      <div class="list-bar" style="justify-content:flex-end"><label class="flt">${ic('calendar')} De <input type="date" data-de value="${st.de}"> a <input type="date" data-ate value="${st.ate}"></label>
        ${[['Hoje', hoje, hoje], ['7 dias', UI.addDays(hoje, -6), hoje], ['Mês', ini, hoje]].map(([l, a, b]) => `<button class="btn sm ${st.de === a && st.ate === b ? 'primary' : 'ghost'}" data-at="${a}|${b}">${l}</button>`).join('')}</div>
      <div class="kpis">
        <div class="kpi accent"><span>Faturamento</span><b>${UI.money(fat)}</b><small>${vendas.length} venda(s)</small></div>
        ${showLucro ? `<div class="kpi ok"><span>Lucro</span><b>${UI.money(luc)}</b><small>margem ${UI.pct(fat ? luc / fat * 100 : 0)}</small></div>` : ''}
        <div class="kpi"><span>Ticket médio</span><b>${UI.money(vendas.length ? fat / vendas.length : 0)}</b></div>
        ${showLucro ? `<div class="kpi"><span>Lucro médio</span><b>${UI.money(vendas.length ? luc / vendas.length : 0)}</b><small>por venda</small></div>` : ''}
        <div class="kpi warn"><span>OS em aberto</span><b>${osAb.length}</b><small>${osVenc.length} com previsão vencida</small></div>
        <div class="kpi"><span>A receber em 7 dias</span><b>${UI.money(aReceber.reduce((s, f) => s + NEG.aPagar(f), 0))}</b><small>${aReceber.length} parcela(s)</small></div>
      </div>
      <div class="cols-2">
        <section class="card"><h2>${ic('chart-column')}Vendas dos últimos 14 dias</h2>${UI.barChart(dias14.map(d => ({ l: d.slice(8), v: porDia[d] || 0 })), { height: 190 })}</section>
        <section class="card"><h2>${ic('chart-pie')}Formas de pagamento no período</h2>${FX.donut(Object.entries(formas).map(([l, v]) => ({ l, v })))}</section>
      </div>
      <div class="cols-3">
        <section class="card"><h2>${ic('receipt')}Últimas vendas</h2><div class="feed">
          ${vendas.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 7).map(v => `<a class="feed-item" href="#/c/vendas/${v.id}"><span class="fi">${ic(v.itens.some(i => i.tipo === 'Aparelho') ? 'smartphone' : 'shopping-bag')}</span>
            <span class="ft"><b>${esc(nome('pessoas', v.cliente_id))}</b><span>${esc(v.itens.map(i => i.descricao).join(', '))} · ${UI.datetime(v.data).slice(-5)}</span></span><span class="fv">${UI.money(v.total)}</span></a>`).join('')
            || `<div class="empty-state"><span class="ill">${ic('shopping-cart')}</span>Nenhuma venda no período.<a class="btn primary sm" href="#/pdv">${ic('plus')}Fazer uma venda</a></div>`}</div></section>
        <section class="card"><h2>${ic('flame')}Mais vendidos no mês</h2>${UI.hbars(Object.entries(top).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 7), { fmt: UI.int })}
          ${metaLoja ? `<div style="display:flex;justify-content:center;margin-top:16px">${FX.ring(pctAlvo, 'da meta')}</div>` : ''}</section>
        <section class="card"><h2>${ic('calendar-check')}Agenda</h2><div class="feed">
          ${osVenc.slice(0, 3).map(o => `<a class="feed-item" href="#/os/${o.id}"><span class="fi" style="background:var(--danger-2);color:var(--danger)">${ic('wrench')}</span><span class="ft"><b>OS #${o.id} — ${esc(nome('pessoas', o.cliente_id))}</b><span>previsão ${UI.date(o.previsao)}</span></span></a>`).join('')}
          ${aReceber.slice(0, 4).map(f => `<a class="feed-item" href="#/c/receitas/${f.id}"><span class="fi" style="background:var(--ok-2);color:var(--ok)">${ic('arrow-down-left')}</span><span class="ft"><b>${esc(nome('pessoas', f.pessoa_id) || f.titulo)}</b><span>${esc(f.parcela ? 'parcela ' + f.parcela : f.titulo)} · ${fmtDia(f.vencimento)}</span></span><span class="fv">${UI.money(NEG.aPagar(f))}</span></a>`).join('')}
          ${aPagar.slice(0, 3).map(f => `<a class="feed-item" href="#/c/despesas/${f.id}"><span class="fi" style="background:var(--danger-2);color:var(--danger)">${ic('arrow-up-right')}</span><span class="ft"><b>${esc(f.titulo)}</b><span>pagar · ${fmtDia(f.vencimento)}</span></span><span class="fv">${UI.money(NEG.aPagar(f))}</span></a>`).join('')}
          ${aniv.map(p => `<a class="feed-item" href="#/c/clientes/${p.id}"><span class="fi" style="background:var(--warn-2);color:var(--warn)">${ic('cake')}</span><span class="ft"><b>${esc(p.nome)}</b><span>faz aniversário hoje</span></span></a>`).join('')}
          ${!osVenc.length && !aReceber.length && !aPagar.length && !aniv.length ? `<div class="empty-state"><span class="ill">${ic('party-popper')}</span>Nada pendente para os próximos dias.</div>` : ''}</div></section>
      </div>
      <section class="card"><h2>${ic('arrow-left-right')}Entradas e saídas no período</h2>
        <div class="cols-2" style="margin:0">
          <table class="tbl"><tbody><tr><td><b>Entradas</b></td><td class="r"><b class="pos">${UI.money(totE)}</b></td></tr>
            <tr><td>Vendas</td><td class="r">${UI.money(E.vendas)}</td></tr><tr><td>OS finalizadas</td><td class="r">${UI.money(E.os)}</td></tr><tr><td>Outras receitas</td><td class="r">${UI.money(E.outras)}</td></tr><tr><td>Suprimentos</td><td class="r">${UI.money(sup)}</td></tr></tbody></table>
          <table class="tbl"><tbody><tr><td><b>Saídas</b></td><td class="r"><b class="neg">${UI.money(totS)}</b></td></tr>
            <tr><td>Compras de mercadoria</td><td class="r">${UI.money(S.compras)}</td></tr><tr><td>Despesas</td><td class="r">${UI.money(S.despesas)}</td></tr><tr><td>Sangrias</td><td class="r">${UI.money(sang)}</td></tr><tr><td>Saldo</td><td class="r"><b>${UI.money(totE - totS)}</b></td></tr></tbody></table>
        </div></section>`;
    el.querySelectorAll('[data-de],[data-ate]').forEach(i => i.onchange = () => { st.de = el.querySelector('[data-de]').value; st.ate = el.querySelector('[data-ate]').value; App.render(); });
    el.querySelectorAll('[data-at]').forEach(b => b.onclick = () => { [st.de, st.ate] = b.dataset.at.split('|'); App.render(); });
    el.querySelector('[data-abrir-caixa]')?.addEventListener('click', () => FIN.abrirCaixa());
  });
})();
