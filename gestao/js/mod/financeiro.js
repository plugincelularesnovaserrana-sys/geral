/* =====================================================================
   FINANCEIRO: despesas, receitas, caixas, bancos, conciliação, calendário
   ===================================================================== */
(function () {
  const r2 = UI.round2;
  const nome = (col, id) => (DB.get(col, id) || {}).nome || '';
  const FIN = window.FIN = {};
  const BADGE = { Pago: 'ok', Vencido: 'danger', 'Vence hoje': 'warn', 'A vencer': 'accent', Cancelado: '' };

  const finFields = tipo => rec => [
    { k: 'titulo', label: 'Título', req: true, w: 2, tab: 'Dados gerais' }, { k: 'pessoa_id', label: tipo === 'R' ? 'Cliente / pagador' : 'Fornecedor / favorecido', ref: 'pessoas', tab: 'Dados gerais' },
    { k: 'categoria_id', label: 'Categoria', ref: { col: 'categoriasfin', filter: c => c.tipo === (tipo === 'R' ? 'Receita' : 'Despesa') }, tab: 'Dados gerais' },
    { k: 'vencimento', label: 'Data de vencimento', type: 'date', req: true, def: () => UI.today(), tab: 'Dados gerais' }, { k: 'competencia', label: 'Data de competência', type: 'date', tab: 'Dados gerais', help: 'Vazio = mesma do vencimento' },
    { k: 'forma_id', label: 'Forma de cobrança', ref: 'formaspag', tab: 'Dados gerais' }, { k: 'parcela', label: 'Número da parcela', tab: 'Dados gerais' },
    { k: 'valor', label: 'Valor (R$)', type: 'money', req: true, tab: 'Dados gerais' }, { k: 'multa', label: 'Multa / juros (R$)', type: 'money', tab: 'Dados gerais' }, { k: 'desconto', label: 'Desconto (R$)', type: 'money', tab: 'Dados gerais' },
    { k: 'total_calc', label: 'Valor total', type: 'calc', fn: d => UI.money((d.valor || 0) + (d.multa || 0) - (d.desconto || 0)), tab: 'Dados gerais' },
    ...(rec.id ? [] : [{ k: 'repetir', label: 'Repetir por quantos meses', type: 'number', def: 1, tab: 'Dados gerais', help: '12 = gera 12 lançamentos mensais' },
      { k: 'ja_pago', label: tipo === 'R' ? 'Já foi recebido?' : 'Já foi pago?', type: 'bool', tab: 'Dados gerais' }]),
    { k: 'tags', label: 'Tags', type: 'multi', ref: 'tagsfin', w: 4, tab: 'Dados gerais' }, { k: 'obs', label: 'Observações', type: 'textarea', w: 4, tab: 'Dados gerais' },
    { k: 'considerar', label: 'Considerar em relatórios (DRE)?', type: 'bool', def: true, tab: 'Detalhes' },
    { k: 'pagamentos_html', type: 'html', w: 4, tab: 'Detalhes', html: d => !d.id ? '<p class="muted small">Os pagamentos aparecem aqui depois de salvar.</p>' : `<h3 class="form-sec">Pagamentos</h3><table class="tbl"><thead><tr><th>Data</th><th>Forma</th><th class="r">Valor</th><th class="r">Taxa</th><th class="r">Líquido</th><th>Compensação</th></tr></thead><tbody>${(d.pagamentos || []).map(p => `<tr><td>${UI.date(p.data)}</td><td>${esc(NEG.forma(p.forma_id).nome || '')}</td><td class="r">${UI.money(p.valor)}</td><td class="r">${UI.money(p.taxa)}</td><td class="r">${UI.money(p.liquido != null ? p.liquido : p.valor)}</td><td>${UI.date(p.compensacao)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum pagamento</td></tr>'}</tbody></table><p class="small muted">Origem: ${esc(d.origem || 'manual')} ${d.origem_id ? '#' + d.origem_id : ''}</p>` }
  ];
  const finCols = tipo => [{ k: 'id', label: 'Id' }, { k: 'origem', label: 'Origem', get: r => (r.origem || 'Manual') + (r.origem_id ? ' #' + r.origem_id : '') },
    { label: 'Categoria', get: r => nome('categoriasfin', r.categoria_id) }, { k: 'titulo', label: 'Título' },
    { label: 'Situação', get: r => NEG.statusVenc(r), html: r => `<span class="badge ${BADGE[NEG.statusVenc(r)] || ''}">${esc(NEG.statusVenc(r))}${r.situacao === 'Parcial' ? ' (parcial)' : ''}</span>` },
    { label: tipo === 'R' ? 'Cliente' : 'Fornecedor', get: r => nome('pessoas', r.pessoa_id) }, { k: 'total', label: 'Valor total', fmt: 'money', get: r => UI.money((r.valor || 0) + (r.multa || 0) - (r.desconto || 0)), sortv: r => r.valor, align: 'r' },
    { k: 'vencimento', label: 'Vencimento', fmt: 'date' }, { k: 'pago', label: tipo === 'R' ? 'Recebido' : 'Pago', fmt: 'money', get: r => UI.money(r.pago || 0), align: 'r' },
    { label: tipo === 'R' ? 'A receber' : 'A pagar', get: r => UI.money(NEG.aPagar(r)), sortv: r => NEG.aPagar(r), align: 'r' },
    { label: 'Forma', get: r => NEG.forma(r.forma_id).nome || '', optional: true }, { k: 'parcela', label: 'Parcela', optional: true }, { k: 'competencia', label: 'Competência', fmt: 'date', optional: true }];
  const finBase = (key, tipo) => CRUD.register(key, {
    col: 'financeiro', title: tipo === 'R' ? 'Receitas (contas a receber)' : 'Despesas (contas a pagar)', single: tipo === 'R' ? 'Receita' : 'Despesa', crumb: 'Financeiro',
    perm: 'financeiro', newLabel: tipo === 'R' ? 'Nova receita' : 'Nova despesa', where: r => r.tipo === tipo, fields: finFields(tipo), cols: finCols(tipo),
    defaults: () => ({ tipo, considerar: true, pagamentos: [] }), search: ['obs', 'parcela'],
    sort: (a, b) => String(a.vencimento).localeCompare(String(b.vencimento)) || a.id - b.id,
    filters: [{ k: 'status', label: 'Situação', opts: ['Vencido', 'Vence hoje', 'A vencer', 'Pago', 'Cancelado'], test: (r, v) => NEG.statusVenc(r) === v },
      { k: 'categoria_id', label: 'Categoria', ref: { col: 'categoriasfin', filter: c => c.tipo === (tipo === 'R' ? 'Receita' : 'Despesa') } },
      { k: 'pessoa_id', label: 'Pessoa', ref: 'pessoas' }, { k: 'origem', label: 'Origem', opts: ['Venda', 'OS', 'Ordem de compra', 'Produto', 'Devolução', 'Fixo'] },
      { k: 'vencimento', label: 'Vencimento', type: 'daterange' }],
    indicators: rows => {
      const ab = rows.filter(r => !['Pago', 'Cancelado'].includes(r.situacao));
      const s = l => UI.money(l.reduce((a, r) => a + NEG.aPagar(r), 0));
      return [{ l: 'Vencem hoje', v: s(ab.filter(r => r.vencimento === UI.today())), cls: 'warn' }, { l: 'Vencidos', v: s(ab.filter(r => r.vencimento < UI.today())), cls: 'danger' },
        { l: 'A vencer', v: s(ab.filter(r => r.vencimento > UI.today())), cls: 'accent' }, { l: tipo === 'R' ? 'Recebidos' : 'Pagos', v: UI.money(rows.reduce((a, r) => a + (r.situacao === 'Cancelado' ? 0 : r.pago || 0), 0)), cls: 'ok' },
        { l: 'Total no período', v: UI.money(rows.filter(r => r.situacao !== 'Cancelado').reduce((a, r) => a + (r.valor || 0) + (r.multa || 0) - (r.desconto || 0), 0)) }];
    },
    rowClass: r => r.situacao === 'Cancelado' ? 'row-off' : '',
    footer: (c, rows) => c.label === 'Valor total' ? UI.money(rows.filter(r => r.situacao !== 'Cancelado').reduce((a, r) => a + (r.valor || 0) + (r.multa || 0) - (r.desconto || 0), 0)) : c.label === (tipo === 'R' ? 'A receber' : 'A pagar') ? UI.money(rows.filter(r => r.situacao !== 'Cancelado').reduce((a, r) => a + NEG.aPagar(r), 0)) : '',
    validate: (d, rec) => { if (rec.id && rec.pago > (d.valor || 0) + (d.multa || 0) - (d.desconto || 0) + 0.004) return 'O valor ficou menor que o já pago'; },
    beforeSave: (d, rec) => { d.tipo = tipo; d.competencia = d.competencia || d.vencimento; d.total = r2((d.valor || 0) + (d.multa || 0) - (d.desconto || 0)); d.situacao = rec.situacao === 'Cancelado' ? 'Cancelado' : NEG.situacaoFin(Object.assign({}, rec, d)); },
    afterSave: (rec, isNew) => {
      if (!isNew) return;
      const n = Math.max(1, Number(rec.repetir) || 1);
      const extra = { repetir: undefined, ja_pago: undefined };
      DB.update('financeiro', rec.id, Object.assign({ parcela: n > 1 ? `1/${n}` : rec.parcela }, extra), { silent: true });
      for (let i = 1; i < n; i++) NEG.lancar(Object.assign({}, rec, extra, { id: undefined, created_at: undefined, pagamentos: [], vencimento: UI.addMonths(rec.vencimento, i), competencia: UI.addMonths(rec.competencia || rec.vencimento, i), parcela: `${i + 1}/${n}` }));
      if (rec.ja_pago) { const f = rec.forma_id || (DB.list('formaspag').find(x => x.tipo === 'Dinheiro') || {}).id; NEG.baixar(rec.id, { forma_id: f, valor: NEG.aPagar(DB.get('financeiro', rec.id)), data: rec.vencimento }); }
    },
    afterSaveGo: () => '#/c/' + key,
    deleteBlock: r => ({ Venda: `Este lançamento foi gerado pela venda #${r.origem_id}. Para desfazer, cancele a venda ou faça a devolução em Vendas.`, OS: `Este lançamento foi gerado pela OS #${r.origem_id}. Para desfazer, altere os pagamentos ou cancele a OS.` })[r.origem] || '',
    deleteMsg: r => r.pago > 0 ? `Este lançamento tem ${UI.money(r.pago)} pagos. Ao excluir, os pagamentos serão estornados do caixa/banco. Ele pode ser restaurado em "Ver registros excluídos" (sem os pagamentos).` : '',
    onDelete: r => { if (r.pago > 0) NEG.estornarPagamentos(r, 'Exclusão'); },
    actions: [
      { label: tipo === 'R' ? 'Receber' : 'Pagar', show: r => !['Pago', 'Cancelado'].includes(r.situacao), fn: (r, re) => FIN.baixa(r, re) },
      { label: 'Recibo', show: r => r.pago > 0, fn: r => FIN.recibo(r) },
      { label: 'Cobrar por WhatsApp', show: r => tipo === 'R' && !['Pago', 'Cancelado'].includes(r.situacao), fn: r => FIN.cobrar(r) },
      { label: 'Duplicar lançamento', fn: (r, re) => { NEG.lancar(Object.assign({}, r, { id: undefined, created_at: undefined, pagamentos: [], pago: 0, situacao: 'Em aberto', titulo: r.titulo + ' (cópia)' })); re(); } },
      { label: 'Estornar pagamentos', show: r => r.pago > 0, fn: async (r, re) => { if (!(await UI.confirm('Estornar todos os pagamentos deste lançamento? O valor sai do caixa/banco e o lançamento volta a ficar em aberto.'))) return; NEG.estornarPagamentos(r); UI.toast('Pagamentos estornados'); re(); } },
      { label: 'Cancelar lançamento', show: r => r.situacao !== 'Cancelado' && !r.pago, fn: async (r, re) => { if (await UI.confirm('Cancelar este lançamento?')) { DB.update('financeiro', r.id, { situacao: 'Cancelado' }); re(); } } }
    ],
    tools: [
      { label: tipo === 'R' ? 'Receitas fixas' : 'Despesas fixas', fn: () => App.go('#/c/fixos') },
      ...(tipo === 'R' ? [{ label: 'Imprimir carnê', fn: () => FIN.carne() }] : []),
      { label: 'Importar CSV', fn: re => FIN.importar(tipo, re) }
    ]
  });
  finBase('receitas', 'R');
  finBase('despesas', 'D');

  FIN.baixa = function (r, cb) {
    r = DB.get('financeiro', r.id);
    const rec = r.tipo === 'R';
    const formas = DB.list('formaspag').filter(f => f.ativo !== false && f.tipo !== 'Aparelho na troca' && (rec || f.tipo !== 'Crédito do cliente'));
    const atraso = Math.max(0, UI.daysBetween(r.vencimento, UI.today()));
    const cfg = DB.cfg();
    const juroSug = rec && atraso && (cfg.multa_pct || cfg.juros_dia_pct) ? r2(NEG.aPagar(r) * ((Number(cfg.multa_pct) || 0) / 100 + atraso * (Number(cfg.juros_dia_pct) || 0) / 100)) : 0;
    UI.modal({
      title: (rec ? 'Receber' : 'Pagar') + ' — ' + r.titulo, size: 'md',
      body: `<p>Em aberto: <b>${UI.money(NEG.aPagar(r))}</b> · vencimento ${UI.date(r.vencimento)}${atraso ? ` · <span class="neg">${atraso} dia(s) em atraso</span>` : ''}${rec && r.pessoa_id ? ` · crédito do cliente: ${UI.money(NEG.saldoCredito(r.pessoa_id))}` : ''}</p>
        <div class="grid-form" style="grid-template-columns:1fr 1fr">
          <label class="fld"><span>Forma de pagamento</span><select data-f>${formas.map(f => `<option value="${f.id}"${f.id === r.forma_id ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
          <label class="fld"><span>Data do pagamento</span><input type="date" data-d value="${UI.today()}"></label>
          <label class="fld"><span>Multa / juros a acrescentar (R$)</span><input type="number" step="0.01" data-m value="${juroSug || 0}"></label>
          <label class="fld"><span>Desconto a conceder (R$)</span><input type="number" step="0.01" data-desc value="0"></label>
          <label class="fld"><span>Valor ${rec ? 'recebido' : 'pago'} (R$)</span><input type="number" step="0.01" data-v></label>
          <label class="fld"><span>Taxa (R$)</span><input type="number" step="0.01" data-t value="0"></label>
          <label class="fld w2"><span>Observação</span><input data-o></label></div>
        <p class="small muted">Se o valor for menor que o total, o lançamento fica parcial.</p>`,
      onOpen: ({ body }) => {
        const upd = () => { const m = Number(body.querySelector('[data-m]').value) || 0, d = Number(body.querySelector('[data-desc]').value) || 0; body.querySelector('[data-v]').value = r2(NEG.aPagar(r) + m - d); };
        body.querySelector('[data-m]').addEventListener('input', upd); body.querySelector('[data-desc]').addEventListener('input', upd); upd();
      },
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: rec ? 'Confirmar recebimento' : 'Confirmar pagamento', cls: 'primary', onClick: ({ body }) => {
        const m = Number(body.querySelector('[data-m]').value) || 0, d = Number(body.querySelector('[data-desc]').value) || 0;
        const v = Number(body.querySelector('[data-v]').value) || 0;
        if (!(v > 0)) { UI.toast('Informe o valor', 'erro'); return false; }
        if (m || d) DB.update('financeiro', r.id, { multa: r2((r.multa || 0) + m), desconto: r2((r.desconto || 0) + d) });
        try { NEG.baixar(r.id, { forma_id: Number(body.querySelector('[data-f]').value), valor: v, data: body.querySelector('[data-d]').value, taxa: Number(body.querySelector('[data-t]').value) || 0, obs: body.querySelector('[data-o]').value }); }
        catch (e) { UI.toast(e.message, 'erro'); return false; }
        UI.toast(rec ? 'Recebimento registrado' : 'Pagamento registrado'); cb && cb();
      } }]
    });
  };
  FIN.recibo = function (r) {
    const p = DB.get('pessoas', r.pessoa_id) || {};
    UI.print(UI.docHeader('Recibo', '#' + r.id) + `<p>${r.tipo === 'R' ? 'Recebemos de' : 'Pagamos a'} <b>${esc(p.nome || '__________________')}</b>${p.cpf ? ', CPF/CNPJ ' + esc(p.cpf) : ''}, a importância de <b>${UI.money(r.pago)}</b> referente a <b>${esc(r.titulo)}</b>${r.parcela ? ' (parcela ' + esc(r.parcela) + ')' : ''}.</p>
      <table><tr><th>Data</th><th>Forma</th><th class="r">Valor</th></tr>${(r.pagamentos || []).map(x => `<tr><td>${UI.date(x.data)}</td><td>${esc(NEG.forma(x.forma_id).nome)}</td><td class="r">${UI.money(x.valor)}</td></tr>`).join('')}</table>
      ${NEG.aPagar(r) > 0 ? `<p>Saldo restante: ${UI.money(NEG.aPagar(r))}</p>` : ''}<p>${esc((DB.get('unidades', DB.unitId()) || {}).cidade || '')}, ${UI.date(UI.today())}</p><div class="sign">${esc((DB.get('unidades', DB.unitId()) || {}).nome || '')}</div>`, { formato: DB.cfg().recibo_formato || 'a4' });
  };
  FIN.cobrar = function (r) {
    const p = DB.get('pessoas', r.pessoa_id) || {};
    const m = DB.list('whatsmodelos').find(x => x.tipo === 'Cobrança' && x.padrao);
    UI.whats(p.telefone, UI.fillTemplate(m ? m.texto : 'Olá {cliente}! A parcela de {valor} vence em {vencimento}.', { cliente: (p.nome || '').split(' ')[0], valor: UI.money(NEG.aPagar(r)), vencimento: UI.date(r.vencimento), loja: nome('unidades', DB.unitId()) }));
  };
  FIN.carne = function () {
    UI.modal({
      title: 'Imprimir carnê', size: 'sm', body: `<label class="fld"><span>Cliente</span>${FORM.input({ k: 'p', ref: { col: 'pessoas', filter: r => r.cliente } }, '')}</label><p class="small muted">Imprime as parcelas em aberto do cliente.</p>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Imprimir', cls: 'primary', onClick: ({ body }) => {
        const pid = Number(body.querySelector('[name=p]').value);
        const ps = DB.list('financeiro').filter(f => f.tipo === 'R' && f.pessoa_id === pid && ['Em aberto', 'Parcial'].includes(f.situacao)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
        if (!ps.length) { UI.toast('Nenhuma parcela em aberto', 'erro'); return false; }
        const cli = DB.get('pessoas', pid); const loja = DB.get('unidades', DB.unitId()) || {};
        UI.print(ps.map(f => `<div style="display:grid;grid-template-columns:1fr 2fr;border:1px solid #000;margin-bottom:6mm;page-break-inside:avoid">
          <div style="border-right:1px dashed #000;padding:3mm;font-size:10px"><b>${esc(loja.nome)}</b><br>Parcela ${esc(f.parcela || '')}<br>Venc.: <b>${UI.date(f.vencimento)}</b><br>Valor: <b>${UI.money(NEG.aPagar(f))}</b><br>${esc(cli.nome)}</div>
          <div style="padding:3mm"><b>${esc(loja.nome)}</b> · ${esc(loja.telefone || '')}<br>${esc(f.titulo)}<br>Cliente: <b>${esc(cli.nome)}</b> ${esc(cli.cpf || '')}<br>Parcela <b>${esc(f.parcela || '')}</b> · Vencimento <b>${UI.date(f.vencimento)}</b> · Valor <b>${UI.money(NEG.aPagar(f))}</b>
          <div style="margin-top:4mm">${EST.barcode('R' + f.id, 26)}</div></div></div>`).join(''), { titulo: 'Carnê' });
      } }]
    });
  };
  FIN.importar = async function (tipo, cb) {
    UI.modal({ title: 'Importar lançamentos (CSV)', size: 'md', body: `<pre class="small">titulo;vencimento;valor;categoria;pessoa
Aluguel;2026-11-05;2500,00;Aluguel;Imobiliária</pre><p class="small muted">Datas em AAAA-MM-DD ou DD/MM/AAAA.</p>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Escolher arquivo', cls: 'primary', onClick: async () => {
        const f = await UI.pickFile('.csv,.txt'); if (!f) return;
        const ls = (await UI.readText(f)).split(/\r?\n/).filter(Boolean); ls.shift(); let n = 0;
        ls.forEach(l => { const [titulo, venc, valor, cat, pes] = l.split(';').map(s => (s || '').trim()); if (!titulo) return;
          const dt = venc.includes('/') ? venc.split('/').reverse().join('-') : venc; const c = DB.list('categoriasfin').find(x => x.nome === cat); const p = DB.list('pessoas').find(x => x.nome === pes);
          NEG.lancar({ tipo, titulo, vencimento: dt, valor: Number(String(valor).replace(/\./g, '').replace(',', '.')) || 0, categoria_id: c ? c.id : null, pessoa_id: p ? p.id : null, origem: 'Importação' }); n++; });
        UI.toast(n + ' lançamento(s) importado(s)'); cb && cb();
      } }] });
  };
  FIN.gerarFixos = function () {
    let n = 0;
    const hoje = UI.today();
    DB.list('fixos').filter(f => f.ativo !== false).forEach(f => {
      let prox = f.proximo || hoje;
      const step = d => f.frequencia === 'Semanal' ? UI.addDays(d, 7) : f.frequencia === 'Quinzenal' ? UI.addDays(d, 15) : f.frequencia === 'Anual' ? UI.addMonths(d, 12) : UI.addMonths(d, 1);
      const futuros = () => DB.list('financeiro').filter(x => x.fixo_id === f.id && x.vencimento >= hoje && x.situacao !== 'Cancelado').length;
      let guard = 0;
      while ((prox <= hoje || futuros() < (Number(f.futuros) || 1)) && guard++ < 60) {
        if (!DB.list('financeiro').some(x => x.fixo_id === f.id && x.vencimento === prox)) {
          NEG.lancar({ tipo: f.tipo, titulo: f.titulo, pessoa_id: f.pessoa_id, valor: f.valor, vencimento: prox, categoria_id: f.categoria_id, tags: f.tags, origem: 'Fixo', origem_id: f.id, fixo_id: f.id }); n++;
        }
        prox = step(prox);
      }
      DB.update('fixos', f.id, { proximo: prox }, { silent: true });
    });
    return n;
  };

  /* ---------------- caixas ---------------- */
  CRUD.register('caixas', {
    col: 'caixas', title: 'Caixas', single: 'Caixa', crumb: 'Financeiro', noNew: true, perm: 'caixa', noDelete: true,
    customForm: (el, id) => FIN.caixa(el, id),
    cols: [{ k: 'descricao', label: 'Descrição' }, { k: 'abertura', label: 'Abertura', fmt: 'datetime' }, { k: 'fechamento', label: 'Fechamento', fmt: 'datetime' },
      { label: 'Sangrias', get: r => UI.money(NEG.resumoCaixa(r).sangrias), align: 'r' }, { label: 'Suprimentos', get: r => UI.money(NEG.resumoCaixa(r).suprimentos), align: 'r' },
      { k: 'troco', label: 'Troco inicial', fmt: 'money' }, { label: 'Saldo dos movimentos', get: r => UI.money(NEG.resumoCaixa(r).saldo), align: 'r' },
      { k: 'informado', label: 'Dinheiro informado', fmt: 'money' }, { label: 'Diferença', get: r => r.status === 'Fechado' ? UI.money(r.diferenca || 0) : '', align: 'r' },
      { k: 'status', label: 'Status', badge: r => r.status === 'Aberto' ? 'ok' : '' }, { k: 'usuario', label: 'Aberto por', optional: true }],
    tools: [{ label: 'Abrir caixa', show: () => !NEG.caixaAberto(), fn: re => FIN.abrirCaixa(re) }, { label: 'Ir para o caixa aberto', show: () => !!NEG.caixaAberto(), fn: () => App.go('#/c/caixas/' + NEG.caixaAberto().id) }]
  });
  FIN.abrirCaixa = async function (cb) {
    const v = await UI.prompt('Abrir caixa', { type: 'number', label: 'Troco inicial em dinheiro (R$)', value: '0' });
    if (v == null) return;
    const cx = DB.insert('caixas', { descricao: 'Caixa ' + UI.date(UI.today()) + ' - ' + DB.userName(), abertura: new Date().toISOString(), troco: Number(v) || 0, status: 'Aberto', movs: [], usuario: DB.userName() });
    UI.toast('Caixa aberto'); App.go('#/c/caixas/' + cx.id); cb && cb();
  };
  FIN.caixa = function (el, id) {
    const cx = DB.get('caixas', id);
    if (!cx) { el.innerHTML = '<div class="card empty">Caixa não encontrado.</div>'; return; }
    const r = NEG.resumoCaixa(cx); const cfg = DB.cfg(); const aberto = cx.status === 'Aberto';
    const cego = cfg.fechamento_cego && !App.can('tudo');
    el.innerHTML = App.pageHead(cx.descricao, 'Financeiro > Caixas', `${aberto ? '<button class="btn ghost" data-a="sang">Sangria</button><button class="btn ghost" data-a="sup">Suprimento</button><button class="btn primary" data-a="fechar">Fechar caixa</button>' : '<button class="btn ghost" data-a="wa">Enviar fechamento por WhatsApp</button>'}<button class="btn ghost" data-a="pdf">Imprimir</button><a class="btn ghost" href="#/c/caixas">Voltar</a>`) + `
      <div class="kpis">${cego && aberto ? '' : `<div class="kpi"><span>Troco inicial</span><b>${UI.money(cx.troco)}</b></div><div class="kpi ok"><span>Entradas</span><b>${UI.money(r.entradas)}</b></div><div class="kpi danger"><span>Saídas</span><b>${UI.money(r.saidas)}</b></div>
        <div class="kpi"><span>Suprimentos</span><b>${UI.money(r.suprimentos)}</b></div><div class="kpi"><span>Sangrias</span><b>${UI.money(r.sangrias)}</b></div><div class="kpi accent"><span>Dinheiro esperado na gaveta</span><b>${UI.money(r.esperadoDinheiro)}</b></div>`}
        ${!aberto ? `<div class="kpi"><span>Dinheiro informado</span><b>${UI.money(cx.informado)}</b></div><div class="kpi ${Math.abs(cx.diferenca || 0) > 0.004 ? 'danger' : 'ok'}"><span>Diferença</span><b>${UI.money(cx.diferenca || 0)}</b></div>` : ''}</div>
      ${cego && aberto ? '<p class="intro">Fechamento às cegas ativo: os totais aparecem só depois de informar o dinheiro contado.</p>' : `<section class="card"><h2>Por forma de pagamento</h2>${UI.hbars(Object.entries(r.porForma).map(([l, v]) => ({ l, v })))}</section>`}
      <section class="card"><h2>Movimentos</h2><div class="table-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Tipo</th><th>Forma</th><th>Descrição</th><th>Usuário</th><th class="r">Valor</th></tr></thead><tbody>
        ${(cx.movs || []).slice().reverse().map(m => `<tr><td>${UI.datetime(m.data)}</td><td><span class="badge ${['Entrada', 'Suprimento'].includes(m.tipo) ? 'ok' : 'danger'}">${esc(m.tipo)}</span></td><td>${esc(NEG.forma(m.forma_id).nome || '')}</td><td>${esc(m.desc || '')}${m.origem_id ? ` <span class="muted small">${esc(m.origem)} #${m.origem_id}</span>` : ''}</td><td>${esc(m.usuario || '')}</td><td class="r">${cego && aberto ? '•••' : UI.money(m.valor)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sem movimentos</td></tr>'}</tbody></table></div></section>`;
    const din = (DB.list('formaspag').find(f => f.tipo === 'Dinheiro') || {}).id;
    const mov = async tipo => {
      const v = await UI.prompt(tipo, { type: 'number', label: 'Valor (R$)' }); if (!v) return;
      const d = await UI.prompt(tipo + ' — descrição', { label: 'Motivo' }); if (d == null) return;
      const movs = (cx.movs || []).concat([{ data: new Date().toISOString(), tipo, valor: r2(v), forma_id: din, desc: d, usuario: DB.userName() }]);
      DB.update('caixas', cx.id, { movs }); FIN.caixa(el, id);
    };
    const act = {
      sang: () => mov('Sangria'), sup: () => mov('Suprimento'),
      fechar: async () => {
        const v = await UI.prompt('Fechar caixa', { type: 'number', label: 'Quanto há de dinheiro na gaveta? (R$)' }); if (v == null) return;
        const res = NEG.resumoCaixa(DB.get('caixas', cx.id));
        DB.update('caixas', cx.id, { status: 'Fechado', fechamento: new Date().toISOString(), informado: Number(v), diferenca: r2(Number(v) - res.esperadoDinheiro), saldo_final: res.saldo });
        UI.toast('Caixa fechado'); FIN.caixa(el, id);
      },
      wa: () => { const x = DB.get('caixas', cx.id); const rr = NEG.resumoCaixa(x); UI.whats(DB.cfg().whats_gerente || '', `Fechamento ${x.descricao}\nEntradas: ${UI.money(rr.entradas)}\nSaídas: ${UI.money(rr.saidas)}\nSangrias: ${UI.money(rr.sangrias)}\n${Object.entries(rr.porForma).map(([k, v]) => `${k}: ${UI.money(v)}`).join('\n')}\nDinheiro esperado: ${UI.money(rr.esperadoDinheiro)}\nInformado: ${UI.money(x.informado)}\nDiferença: ${UI.money(x.diferenca)}`); },
      pdf: () => { const x = DB.get('caixas', cx.id); const rr = NEG.resumoCaixa(x); UI.print(UI.docHeader('Fechamento de caixa', x.descricao) + `<table>${[['Abertura', UI.datetime(x.abertura)], ['Fechamento', UI.datetime(x.fechamento)], ['Troco inicial', UI.money(x.troco)], ['Entradas', UI.money(rr.entradas)], ['Saídas', UI.money(rr.saidas)], ['Suprimentos', UI.money(rr.suprimentos)], ['Sangrias', UI.money(rr.sangrias)], ...Object.entries(rr.porForma).map(([k, v]) => [k, UI.money(v)]), ['Dinheiro esperado', UI.money(rr.esperadoDinheiro)], ['Dinheiro informado', UI.money(x.informado)], ['Diferença', UI.money(x.diferenca)]].map(([a, b]) => `<tr><td>${a}</td><td class="r">${b}</td></tr>`).join('')}</table><div class="sign">Responsável</div>`, { formato: '80mm' }); }
    };
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act[b.dataset.a]());
  };

  /* ---------------- bancos ---------------- */
  CRUD.register('bancos', {
    col: 'bancos', title: 'Bancos e saldo bancário', single: 'Banco / conta', crumb: 'Financeiro', perm: 'financeiro',
    fields: [{ k: 'nome', label: 'Nome do banco / conta', req: true, w: 2 }, { k: 'data_inicial', label: 'Data inicial', type: 'date', def: () => UI.today() }, { k: 'saldo_inicial', label: 'Saldo inicial (R$)', type: 'money', def: 0 }, { k: 'ativo', label: 'Ativo?', type: 'bool', def: true }],
    cols: [{ k: 'id', label: 'Cód.' }, { k: 'nome', label: 'Nome do banco' }, { k: 'data_inicial', label: 'Data inicial', fmt: 'date' }, { label: 'Saldo final', get: r => UI.money((r.saldo_inicial || 0) + (r.movs || []).reduce((s, m) => s + m.valor, 0)), align: 'r' }, { k: 'ativo', label: 'Ativo?', fmt: 'bool' }],
    beforeSave: (d, rec) => { d.movs = rec.movs || []; },
    actions: [{ label: 'Movimentações (extrato)', fn: r => {
      let s = r.saldo_inicial || 0;
      UI.modal({ title: 'Extrato — ' + r.nome, size: 'lg', body: `<table class="tbl"><thead><tr><th>Data</th><th>Descrição</th><th class="r">Valor</th><th class="r">Saldo</th></tr></thead><tbody><tr><td>${UI.date(r.data_inicial)}</td><td>Saldo inicial</td><td></td><td class="r">${UI.money(s)}</td></tr>
        ${(r.movs || []).slice().sort((a, b) => a.data.localeCompare(b.data)).map(m => { s += m.valor; return `<tr><td>${UI.date(m.data)}</td><td>${esc(m.desc || '')}${m.conciliado ? ' <span class="badge ok">conciliado</span>' : ''}</td><td class="r ${m.valor < 0 ? 'neg' : 'pos'}">${UI.money(m.valor)}</td><td class="r">${UI.money(s)}</td></tr>`; }).join('')}</tbody></table>` });
    } }, { label: 'Nova transferência', fn: (r, re) => FIN.transferencia(r, re) }],
    tools: [{ label: 'Transferência bancária', fn: re => FIN.transferencia(null, re) }]
  });
  FIN.transferencia = function (origem, cb) {
    const bancos = DB.list('bancos');
    const opts = `<option value="caixa">Caixa aberto (dinheiro)</option>${bancos.map(b => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}`;
    UI.modal({ title: 'Transferência', size: 'sm', body: `<div class="grid-form" style="grid-template-columns:1fr 1fr"><label class="fld"><span>De</span><select data-de>${opts}</select></label><label class="fld"><span>Para</span><select data-para>${opts}</select></label><label class="fld"><span>Valor (R$)</span><input type="number" step="0.01" data-v></label><label class="fld"><span>Data</span><input type="date" data-d value="${UI.today()}"></label></div>`,
      onOpen: ({ body }) => { if (origem) body.querySelector('[data-de]').value = origem.id; },
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Transferir', cls: 'primary', onClick: ({ body }) => {
        const de = body.querySelector('[data-de]').value, para = body.querySelector('[data-para]').value, v = Number(body.querySelector('[data-v]').value), d = body.querySelector('[data-d]').value;
        if (de === para || !(v > 0)) { UI.toast('Escolha contas diferentes e um valor', 'erro'); return false; }
        const din = (DB.list('formaspag').find(f => f.tipo === 'Dinheiro') || {}).id;
        const lado = (id, val, desc) => { if (id === 'caixa') { const cx = NEG.caixaAberto(); if (!cx) throw new Error('Não há caixa aberto'); DB.update('caixas', cx.id, { movs: (cx.movs || []).concat([{ data: new Date().toISOString(), tipo: val < 0 ? 'Sangria' : 'Suprimento', valor: Math.abs(val), forma_id: din, desc, usuario: DB.userName() }]) }); } else NEG.movBanco(Number(id), val, desc, d); };
        try { lado(de, -v, 'Transferência enviada'); lado(para, v, 'Transferência recebida'); } catch (e) { UI.toast(e.message, 'erro'); return false; }
        UI.toast('Transferência registrada'); cb && cb();
      } }] });
  };

  /* ---------------- conciliação bancária (OFX) ---------------- */
  CRUD.register('conciliacoes', {
    col: 'conciliacoes', title: 'Conciliação bancária', single: 'Importação', crumb: 'Financeiro', newLabel: 'Nova importação (OFX)', perm: 'financeiro',
    onNew: () => FIN.importarOFX(), customForm: (el, id) => FIN.conciliar(el, id),
    cols: [{ k: 'id', label: 'Id' }, { label: 'Banco', get: r => nome('bancos', r.banco_id) }, { k: 'arquivo', label: 'Arquivo OFX' }, { label: 'Lançamentos', get: r => (r.itens || []).length },
      { label: 'Progresso', get: r => { const t = (r.itens || []).length; const c = (r.itens || []).filter(i => i.status !== 'Pendente').length; return t ? Math.round(c / t * 100) + '%' : '0%'; } },
      { label: 'Status', get: r => (r.itens || []).every(i => i.status !== 'Pendente') ? 'Concluída' : 'Em andamento', badge: r => (r.itens || []).every(i => i.status !== 'Pendente') ? 'ok' : 'warn' }]
  });
  FIN.parseOFX = function (txt) {
    const get = (blk, tag) => { const m = blk.match(new RegExp('<' + tag + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
    return txt.split(/<STMTTRN>/i).slice(1).map(b => {
      const d = get(b, 'DTPOSTED');
      return { fitid: get(b, 'FITID'), data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, valor: Number(get(b, 'TRNAMT').replace(',', '.')) || 0, desc: get(b, 'MEMO') || get(b, 'NAME'), status: 'Pendente' };
    });
  };
  FIN.importarOFX = function () {
    UI.modal({ title: 'Importar extrato OFX', size: 'sm', body: `<label class="fld"><span>Conta</span>${FORM.input({ k: 'b', ref: 'bancos', req: true }, (DB.list('bancos')[0] || {}).id)}</label><p class="small muted">Baixe o extrato em formato OFX no site ou app do banco.</p>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Escolher arquivo', cls: 'primary', onClick: async ({ body }) => {
        const b = Number(body.querySelector('[name=b]').value); const f = await UI.pickFile('.ofx,.OFX,.txt'); if (!f) return;
        const itens = FIN.parseOFX(await UI.readText(f));
        if (!itens.length) { UI.toast('Nenhum lançamento encontrado no arquivo', 'erro'); return; }
        const c = DB.insert('conciliacoes', { banco_id: b, arquivo: f.name, itens }); App.go('#/c/conciliacoes/' + c.id);
      } }] });
  };
  FIN.conciliar = function (el, id) {
    const c = DB.get('conciliacoes', id);
    const fins = DB.list('financeiro').filter(f => f.situacao !== 'Cancelado');
    const sugerir = it => {
      const alvoTipo = it.valor >= 0 ? 'R' : 'D'; const v = Math.abs(it.valor);
      const pago = fins.filter(f => f.tipo === alvoTipo).flatMap(f => (f.pagamentos || []).map((p, i) => ({ f, p, i }))).find(x => !x.p.conciliado && Math.abs((x.p.liquido || x.p.valor) - v) < 0.011 && Math.abs(UI.daysBetween(x.p.compensacao || x.p.data, it.data)) <= 3);
      if (pago) return { tipo: 'pago', ...pago };
      const aberto = fins.find(f => f.tipo === alvoTipo && ['Em aberto', 'Parcial'].includes(f.situacao) && Math.abs(NEG.aPagar(f) - v) < 0.011);
      if (aberto) return { tipo: 'aberto', f: aberto };
      return null;
    };
    el.innerHTML = App.pageHead('Conciliação — ' + c.arquivo, 'Financeiro > Conciliação bancária', '<a class="btn ghost" href="#/c/conciliacoes">Voltar</a>') + `<p class="intro">Para cada linha do extrato, confirme o lançamento sugerido, crie um novo ou ignore.</p>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Descrição no banco</th><th class="r">Valor</th><th>Sugestão</th><th></th></tr></thead><tbody>
      ${c.itens.map((it, k) => { const s = it.status === 'Pendente' ? sugerir(it) : null; return `<tr data-k="${k}"><td>${UI.date(it.data)}</td><td>${esc(it.desc)}</td><td class="r ${it.valor < 0 ? 'neg' : 'pos'}">${UI.money(it.valor)}</td>
        <td>${it.status !== 'Pendente' ? `<span class="badge ok">${esc(it.status)}</span> ${esc(it.ref || '')}` : s ? `${s.tipo === 'pago' ? 'Pagamento de' : 'Baixar'} <b>${esc(s.f.titulo)}</b>` : '<span class="muted">Sem correspondência</span>'}</td>
        <td>${it.status === 'Pendente' ? `${s ? '<button class="btn sm ok" data-ok>Conciliar</button>' : ''} <button class="btn sm ghost" data-novo>Criar lançamento</button> <button class="btn sm ghost" data-ign>Ignorar</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    const salvar = (k, patch) => { const itens = c.itens.slice(); itens[k] = Object.assign({}, itens[k], patch); DB.update('conciliacoes', c.id, { itens }); FIN.conciliar(el, id); };
    el.querySelector('tbody').addEventListener('click', async e => {
      const tr = e.target.closest('tr[data-k]'); if (!tr) return; const k = Number(tr.dataset.k); const it = c.itens[k];
      if (e.target.closest('[data-ign]')) salvar(k, { status: 'Ignorado' });
      if (e.target.closest('[data-ok]')) {
        const s = sugerir(it);
        if (s.tipo === 'pago') { const pags = s.f.pagamentos.slice(); pags[s.i] = Object.assign({}, pags[s.i], { conciliado: true }); DB.update('financeiro', s.f.id, { pagamentos: pags }); }
        else { const forma = DB.list('formaspag').find(f => f.banco_id === c.banco_id && f.tipo === 'PIX') || DB.list('formaspag').find(f => f.banco_id === c.banco_id); NEG.baixar(s.f.id, { forma_id: forma ? forma.id : null, valor: Math.abs(it.valor), data: it.data }); }
        salvar(k, { status: 'Conciliado', ref: s.f.titulo });
      }
      if (e.target.closest('[data-novo]')) {
        const tipo = it.valor >= 0 ? 'R' : 'D';
        const cat = await UI.prompt('Criar lançamento', { label: 'Título', value: it.desc }); if (cat == null) return;
        const f = NEG.lancar({ tipo, titulo: cat, valor: Math.abs(it.valor), vencimento: it.data, origem: 'Conciliação', origem_id: c.id, pagamentos: [{ data: it.data, valor: Math.abs(it.valor), taxa: 0, liquido: Math.abs(it.valor), conciliado: true }] });
        NEG.movBanco(c.banco_id, it.valor, cat, it.data);
        salvar(k, { status: 'Lançado', ref: f.titulo });
      }
    });
  };

  /* ---------------- calendário ---------------- */
  App.route('/fin/calendario', (el, p, qs) => {
    const mes = qs.get('m') || UI.today().slice(0, 7);
    const [y, m] = mes.split('-').map(Number);
    const first = new Date(y, m - 1, 1, 12); const start = new Date(first); start.setDate(1 - first.getDay());
    const fins = DB.list('financeiro').filter(f => f.situacao !== 'Cancelado');
    const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d.toISOString().slice(0, 10); });
    const prev = UI.addMonths(mes + '-01', -1).slice(0, 7), next = UI.addMonths(mes + '-01', 1).slice(0, 7);
    const doMes = fins.filter(f => f.vencimento.slice(0, 7) === mes);
    el.innerHTML = App.pageHead('Calendário financeiro', 'Financeiro', `<a class="btn ghost" href="#/fin/calendario?m=${prev}">‹ ${UI.monthLabel(prev)}</a><b>${UI.monthLabel(mes)}</b><a class="btn ghost" href="#/fin/calendario?m=${next}">${UI.monthLabel(next)} ›</a>`) + `
      <div class="kpis"><div class="kpi ok"><span>A receber no mês</span><b>${UI.money(doMes.filter(f => f.tipo === 'R').reduce((s, f) => s + NEG.aPagar(f), 0))}</b></div><div class="kpi danger"><span>A pagar no mês</span><b>${UI.money(doMes.filter(f => f.tipo === 'D').reduce((s, f) => s + NEG.aPagar(f), 0))}</b></div></div>
      <div class="card"><div class="cal">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="cal-h">${d}</div>`).join('')}
      ${days.map(d => { const ev = fins.filter(f => f.vencimento === d); return `<div class="cal-d${d.slice(0, 7) !== mes ? ' out' : ''}${d === UI.today() ? ' today' : ''}"><span class="n">${Number(d.slice(8))}</span>
        ${ev.slice(0, 4).map(f => `<a class="cal-ev ${f.tipo === 'R' ? 'r' : 'd'}" href="#/c/${f.tipo === 'R' ? 'receitas' : 'despesas'}/${f.id}" title="${esc(f.titulo)} ${UI.money(f.valor)}">${f.situacao === 'Pago' ? '✓ ' : ''}${UI.money(f.valor)} ${esc(f.titulo)}</a>`).join('')}${ev.length > 4 ? `<span class="small muted">+${ev.length - 4}</span>` : ''}</div>`; }).join('')}</div></div>`;
  });
})();
