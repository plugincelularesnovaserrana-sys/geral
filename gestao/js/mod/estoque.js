/* =====================================================================
   COMPRAS / ESTOQUE
   ===================================================================== */
(function () {
  const r2 = UI.round2;
  const T = (k, label, extra) => Object.assign({ k, label }, extra || {});
  const nomeRef = (col, id) => (DB.get(col, id) || {}).nome || '';
  const EST = window.EST = {};

  /* ---------------- campos do produto ---------------- */
  const APAR = ['Aparelho'];
  const NAO_APAR = ['Acessório', 'Peça', 'Bike/Patinete', 'Serviço'];
  const produtoFields = rec => [
    T('tipo', 'Tipo', { opts: () => NEG.TIPOS_PRODUTO, req: true, tab: 'Dados gerais', def: 'Aparelho' }),
    T('modelo_id', 'Modelo do aparelho', { ref: 'modelos', tab: 'Dados gerais', w: 2, only: APAR }),
    T('nome', 'Nome do produto', { tab: 'Dados gerais', w: 2, only: NAO_APAR }),
    T('disponibilidade_id', 'Disponibilidade', { ref: 'disponibilidades', req: true, tab: 'Dados gerais', def: () => (DB.list('disponibilidades')[0] || {}).id }),
    T('imei', 'IMEI', { tab: 'Dados gerais', only: APAR }), T('imei2', 'IMEI 2', { tab: 'Dados gerais', only: APAR }),
    T('gb_id', 'GB', { ref: 'gbs', tab: 'Dados gerais', only: APAR }), T('ram', 'Memória RAM', { tab: 'Dados gerais', only: APAR }),
    T('cor_id', 'Cor', { ref: 'cores', tab: 'Dados gerais' }), T('estado_id', 'Estado do aparelho', { ref: 'estados', tab: 'Dados gerais', only: APAR }),
    T('bateria', 'Saúde da bateria (%)', { type: 'number', tab: 'Dados gerais', only: APAR }), T('ciclos', 'Ciclos da bateria', { type: 'number', tab: 'Dados gerais', only: APAR }),
    T('serial', 'Número de série', { tab: 'Dados gerais' }), T('codigo_barras', 'Código de barras', { tab: 'Dados gerais' }), T('sku', 'SKU', { tab: 'Dados gerais' }),
    T('marca_id', 'Marca', { ref: 'marcas', tab: 'Dados gerais' }), T('categoria_id', 'Categoria', { ref: 'categorias', tab: 'Dados gerais' }),
    T('subcategoria_id', 'Subcategoria', { ref: 'subcategorias', tab: 'Dados gerais' }),
    T('quantidade', rec.id ? 'Quantidade (ajuste pela ação "Ajustar quantidade")' : 'Quantidade inicial', { type: 'number', tab: 'Dados gerais', def: 1, ro: !!rec.id }),
    T('qtd_minima', 'Quantidade mínima', { type: 'number', tab: 'Dados gerais' }),
    T('custo', 'Valor de custo (R$)', { type: 'money', req: true, tab: 'Dados gerais', perm: 'ver_custo' }), T('preco', 'Valor de venda (R$)', { type: 'money', req: true, tab: 'Dados gerais' }),
    T('markup', 'Mark-up', { type: 'calc', tab: 'Dados gerais', perm: 'ver_custo', fn: d => d.custo ? UI.pct((d.preco - d.custo) / d.custo * 100) : '—' }),
    T('margem', 'Margem', { type: 'calc', tab: 'Dados gerais', perm: 'ver_custo', fn: d => d.preco ? UI.pct((d.preco - d.custo) / d.preco * 100) : '—' }),
    T('lucro', 'Lucro', { type: 'calc', tab: 'Dados gerais', perm: 'ver_custo', fn: d => UI.money((d.preco || 0) - (d.custo || 0)) }),
    T('preco2', 'Valor de venda 2 (R$)', { type: 'money', tab: 'Dados gerais', help: 'Ex.: preço de atacado' }), T('preco3', 'Valor de venda 3 (R$)', { type: 'money', tab: 'Dados gerais' }),
    T('data_entrada', 'Data de entrada', { type: 'date', tab: 'Dados gerais', def: () => UI.today() }), T('garantia_dias', 'Dias de garantia', { type: 'number', tab: 'Dados gerais', def: () => DB.cfg().garantia_padrao || 90 }),
    T('tags', 'Tags', { type: 'multi', ref: 'tagsproduto', tab: 'Dados gerais', w: 4 }), T('obs', 'Observação', { type: 'textarea', tab: 'Dados gerais', w: 4 }),
    T('fornecedor_id', 'Fornecedor', { ref: { col: 'pessoas', filter: r => r.fornecedor || r.cliente }, tab: 'Fornecedor e compra', w: 2 }),
    ...(rec.id ? [] : [T('gerar_despesa', 'Gerar despesa da compra no financeiro?', { type: 'bool', tab: 'Fornecedor e compra', w: 2 }),
      T('compra_forma_id', 'Forma de pagamento da compra', { ref: 'formaspag', tab: 'Fornecedor e compra' }), T('compra_parcelas', 'Parcelas', { type: 'number', def: 1, tab: 'Fornecedor e compra' }),
      T('compra_venc', '1º vencimento', { type: 'date', def: () => UI.today(), tab: 'Fornecedor e compra' }), T('compra_paga', 'Já está paga?', { type: 'bool', def: true, tab: 'Fornecedor e compra' })]),
    T('tipoproduto_id', 'Tipo de produto (fiscal)', { ref: 'tiposproduto', tab: 'Dados para nota fiscal', w: 2 }), T('ncm', 'NCM', { tab: 'Dados para nota fiscal' }), T('cest', 'CEST', { tab: 'Dados para nota fiscal' }),
    T('cst', 'CST/CSOSN', { tab: 'Dados para nota fiscal' }), T('origem_fiscal', 'Origem', { opts: ['0 - Nacional', '1 - Estrangeira (importação direta)', '2 - Estrangeira (mercado interno)'], tab: 'Dados para nota fiscal' }),
    T('cfop_est', 'CFOP estadual (saída)', { tab: 'Dados para nota fiscal' }), T('cfop_inter', 'CFOP interestadual (saída)', { tab: 'Dados para nota fiscal' }),
    T('tributacao_id', 'Tributação', { ref: 'tributacoes', tab: 'Dados para nota fiscal' }),
    T('catalogo', 'Exibir no catálogo online?', { type: 'bool', tab: 'Catálogo' }), T('catalogo_ordem', 'Ordem de exibição', { type: 'number', tab: 'Catálogo' }),
    T('foto', 'Foto (link da imagem)', { tab: 'Catálogo', w: 2 }),
    ...DB.list('camposextras').filter(c => c.tela === 'Produto').map(c => T('x_' + c.id, c.nome, { type: { Número: 'number', Data: 'date', 'Sim/Não': 'bool' }[c.tipo] || 'text', req: c.obrigatorio, tab: 'Outras informações' })),
    T('checklist_id', 'Modelo de checklist', { ref: 'checklists', tab: 'Outras informações' }), T('origem', 'Origem do produto', { tab: 'Outras informações', w: 2 })
  ];
  const bindProduto = (form) => {
    const fields = produtoFields({});
    const tipoSel = form.querySelector('[name=tipo]');
    const sync = () => fields.filter(f => f.only).forEach(f => { const el = form.querySelector(`[data-fld="${f.k}"]`); if (el) el.hidden = !f.only.includes(tipoSel.value); });
    tipoSel.addEventListener('change', sync); sync();
    const tp = form.querySelector('[name=tipoproduto_id]');
    tp?.addEventListener('change', () => { const t = DB.get('tiposproduto', tp.value); if (!t) return; ['ncm', 'cest', 'cst'].forEach(k => { const i = form.querySelector(`[name=${k}]`); if (i && !i.value) i.value = t[k] || ''; }); ['cfop_est', 'cfop_inter'].forEach(k => { const i = form.querySelector(`[name=${k}]`); if (i && !i.value) i.value = t[k] || ''; }); });
  };
  const validaProduto = (d, rec) => {
    if (d.tipo === 'Aparelho' && !d.modelo_id) return 'Escolha o modelo do aparelho';
    if (d.tipo !== 'Aparelho' && !d.nome) return 'Informe o nome do produto';
    if (d.imei && DB.cfg().estoque_imei_unico !== false && DB.list('produtos', { allUnits: true }).some(p => p.id !== rec.id && p.imei === d.imei && p.quantidade > 0)) return 'Já existe um aparelho em estoque com este IMEI';
    if (d.codigo_barras && d.tipo !== 'Aparelho' && DB.list('produtos').some(p => p.id !== rec.id && p.codigo_barras === d.codigo_barras)) return 'Código de barras já usado em outro produto';
  };
  const posCadastro = (p, isNew) => {
    if (!isNew) return;
    const q = Number(p.quantidade) || 0;
    DB.update('produtos', p.id, { quantidade: 0, gerar_despesa: undefined }, { silent: true });
    if (q) NEG.movEstoque(p.id, q, 'Entrada', 'Cadastro de produto', p.id);
    if (p.gerar_despesa && p.custo > 0 && q > 0) {
      const n = Math.max(1, Number(p.compra_parcelas) || 1); const total = r2(p.custo * q);
      const cat = (DB.list('categoriasfin').find(c => c.sistema === 'compra') || {}).id;
      for (let i = 0; i < n; i++) {
        const d = NEG.lancar({ tipo: 'D', titulo: `Compra: ${NEG.descProduto(p)}${n > 1 ? ` (${i + 1}/${n})` : ''}`, pessoa_id: p.fornecedor_id, valor: i === n - 1 ? r2(total - r2(total / n) * (n - 1)) : r2(total / n),
          vencimento: UI.addMonths(p.compra_venc || UI.today(), i), categoria_id: cat, origem: 'Produto', origem_id: p.id, forma_id: p.compra_forma_id, parcela: n > 1 ? `${i + 1}/${n}` : '', considerar: false });
        if (p.compra_paga && p.compra_forma_id && i === 0 && n === 1) NEG.baixar(d.id, { forma_id: p.compra_forma_id, valor: d.valor, data: UI.today() });
      }
    }
  };

  const diasEstoque = p => p.data_entrada ? UI.daysBetween(p.data_entrada, UI.today()) : '';
  const dispCol = { label: 'Disponibilidade', get: r => nomeRef('disponibilidades', r.disponibilidade_id), html: r => { const d = DB.get('disponibilidades', r.disponibilidade_id) || {}; return `<span class="badge" style="border-color:${esc(d.cor || '')};color:${esc(d.cor || '')}">${esc(d.nome || '')}</span>`; } };
  const prodCols = [T('id', 'Cód.'), { label: 'Descrição', get: r => NEG.descProduto(r), sortv: r => NEG.descProduto(r) }, T('imei', 'IMEI'), T('tipo', 'Tipo'),
    { k: 'quantidade', label: 'Qtd', align: 'r', sortv: r => r.quantidade }, T('custo', 'Custo', { fmt: 'money', perm: 'ver_custo' }), T('preco', 'Venda', { fmt: 'money' }),
    T('preco2', 'Venda 2', { fmt: 'money', optional: true }), T('data_entrada', 'Entrada', { fmt: 'date' }), { label: 'Dias em estoque', get: diasEstoque, align: 'r', sortv: r => Number(diasEstoque(r)) || 0 },
    dispCol, { label: 'Estado', get: r => nomeRef('estados', r.estado_id), optional: true }, { label: 'Bateria', get: r => r.bateria ? r.bateria + '%' : '', optional: true },
    { label: 'Marca', get: r => nomeRef('marcas', r.marca_id), optional: true }, { label: 'Categoria', get: r => nomeRef('categorias', r.categoria_id), optional: true },
    T('codigo_barras', 'Código de barras', { optional: true }), { label: 'Fornecedor', get: r => nomeRef('pessoas', r.fornecedor_id), optional: true }];
  const prodFilters = [{ k: 'tipo', label: 'Tipo', opts: () => NEG.TIPOS_PRODUTO }, { k: 'disponibilidade_id', label: 'Disponibilidade', ref: 'disponibilidades' },
    { k: 'estado_id', label: 'Estado', ref: 'estados' }, { k: 'marca_id', label: 'Marca', ref: 'marcas' },
    { k: 'com_estoque', label: 'Com estoque', opts: ['Sim', 'Não'], test: (r, v) => v === 'Sim' ? r.quantidade > 0 : r.quantidade <= 0 }];
  const prodIndicators = rows => {
    const comEst = rows.filter(r => r.quantidade > 0);
    const out = [{ l: 'Produtos com estoque', v: UI.int(comEst.length) }, { l: 'Unidades', v: UI.int(comEst.reduce((s, r) => s + r.quantidade, 0)) }];
    if (App.can('ver_custo')) out.push({ l: 'Custo do estoque', v: UI.money(comEst.reduce((s, r) => s + r.quantidade * (r.custo || 0), 0)) });
    out.push({ l: 'Potencial de venda', v: UI.money(comEst.reduce((s, r) => s + r.quantidade * (r.preco || 0), 0)), cls: 'accent' });
    return out;
  };
  const prodActions = [
    { label: 'Vender', show: r => r.quantidade > 0 || r.tipo === 'Serviço', fn: r => App.go('#/pdv?produto=' + r.id) },
    { label: 'Gerar etiqueta', fn: r => EST.etiquetas([{ produto: r, qtd: 1 }]) },
    { label: 'Ajustar quantidade', show: r => r.tipo !== 'Serviço', fn: (r, re) => EST.ajustar(r, re) },
    { label: 'Transferir para outra loja', show: r => r.quantidade > 0 && DB.list('unidades').length > 1, fn: (r, re) => EST.transferir(r, re) },
    { label: 'Termo de compra', show: r => r.tipo === 'Aparelho', fn: r => EST.termoCompra(r) },
    { label: 'Histórico do produto', fn: r => EST.historico(r) },
    { label: 'Duplicar', fn: (r, re) => { const c = JSON.parse(JSON.stringify(r)); ['id', 'created_at', 'updated_at', 'imei', 'imei2', 'serial'].forEach(k => delete c[k]); c.quantidade = 0; DB.insert('produtos', c); UI.toast('Produto duplicado com quantidade zero'); re(); } }
  ];
  const prodBase = (key, title, extra) => CRUD.register(key, Object.assign({
    col: 'produtos', title, single: 'Produto', crumb: 'Compras / Estoque', perm: 'estoque', fields: produtoFields, cols: prodCols, filters: prodFilters,
    search: ['imei2', 'serial', 'sku', 'codigo_barras', 'obs'], indicators: prodIndicators, actions: prodActions, validate: validaProduto, bind: bindProduto, afterSave: posCadastro,
    rowClass: r => r.tipo === 'Serviço' ? '' : r.quantidade <= 0 ? 'row-off' : (r.qtd_minima && r.quantidade < r.qtd_minima ? 'row-warn' : ''), saveNew: true,
    tools: [{ label: 'Importar CSV', fn: re => EST.importarCSV(re) }, { label: 'Editar em massa', fn: re => EST.massa(re) }, { label: 'Estoque de todas as lojas', fn: () => App.go('#/estoque/multi') }, { label: 'Histórico de transferências', fn: () => App.go('#/c/transferencias') }],
    onDelete: r => { if (r.quantidade > 0) NEG.movEstoque(r.id, -r.quantidade, 'Saída', 'Exclusão do produto', r.id); }
  }, extra));
  prodBase('produtos', 'Estoque atual');
  prodBase('consultaestoque', 'Consulta de estoque', { crumb: 'Vendas > Consulta de estoque', perm: null, noNew: true, noEdit: true, noDelete: true,
    where: r => r.quantidade > 0 && (DB.get('disponibilidades', r.disponibilidade_id) || {}).exibir_venda !== false, onRowClick: r => EST.historico(r, true),
    actions: prodActions.filter(a => ['Vender', 'Gerar etiqueta', 'Termo de compra'].includes(a.label)) });
  prodBase('pecas', 'Estoque de peças', { crumb: 'Ordem de Serviço', where: r => r.tipo === 'Peça', defaults: () => ({ tipo: 'Peça' }), perm: null,
    cols: prodCols.concat([T('qtd_minima', 'Qtd. mínima'), T('ncm', 'NCM', { optional: true })]) });
  prodBase('vendidos', 'Produtos vendidos / sem estoque', { where: r => r.quantidade <= 0 && r.tipo !== 'Serviço', noNew: true });
  App.route('/estoque/consulta', el => CRUD.list('consultaestoque', el));
  App.route('/estoque/pecas', el => CRUD.list('pecas', el));
  App.route('/estoque/vendidos', el => CRUD.list('vendidos', el));
  App.route('/estoque/multi', el => {
    const units = DB.list('unidades');
    const prods = DB.list('produtos', { allUnits: true }).filter(p => p.quantidade > 0);
    const grupos = {};
    prods.forEach(p => { const k = NEG.descProduto(p); grupos[k] = grupos[k] || {}; grupos[k][p.unidade_id] = (grupos[k][p.unidade_id] || 0) + p.quantidade; });
    el.innerHTML = App.pageHead('Estoque de todas as lojas', 'Compras / Estoque') + `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Produto</th>${units.map(u => `<th class="r">${esc(u.apelido || u.nome)}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>
      ${Object.keys(grupos).sort().map(k => `<tr><td>${esc(k)}</td>${units.map(u => `<td class="r">${grupos[k][u.id] || ''}</td>`).join('')}<td class="r"><b>${Object.values(grupos[k]).reduce((s, x) => s + x, 0)}</b></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Sem estoque</td></tr>'}</tbody></table></div></div>`;
  });

  /* ---------------- ações de produto ---------------- */
  EST.ajustar = async function (p, cb) {
    if (DB.cfg().estoque_senha_editar && !(await UI.master('editar_estoque'))) return;
    UI.modal({
      title: 'Ajustar quantidade — ' + NEG.descProduto(p), size: 'sm',
      body: `<p>Quantidade atual: <b>${p.quantidade}</b></p><div class="grid-form" style="grid-template-columns:1fr 1fr">
        <label class="fld"><span>Movimento</span><select data-t><option value="Entrada">Entrada (+)</option><option value="Saída">Saída (−)</option><option value="Ajuste">Definir quantidade exata</option></select></label>
        <label class="fld"><span>Quantidade</span><input type="number" step="1" data-q value="1"></label><label class="fld w2"><span>Motivo</span><input data-o placeholder="Ex.: perda, avaria, contagem"></label></div>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Salvar', cls: 'primary', onClick: ({ body }) => {
        const t = body.querySelector('[data-t]').value; const q = Number(body.querySelector('[data-q]').value) || 0; const o = body.querySelector('[data-o]').value;
        const delta = t === 'Entrada' ? q : t === 'Saída' ? -q : q - p.quantidade;
        if (!delta) return;
        NEG.movEstoque(p.id, delta, delta > 0 ? 'Entrada' : 'Saída', 'Ajuste manual', p.id, o); UI.toast('Estoque ajustado'); cb && cb();
      } }]
    });
  };
  EST.transferir = function (p, cb) {
    const outras = DB.list('unidades').filter(u => u.id !== DB.unitId());
    UI.modal({
      title: 'Transferir — ' + NEG.descProduto(p), size: 'sm',
      body: `<div class="grid-form" style="grid-template-columns:1fr 1fr"><label class="fld"><span>Para a loja</span><select data-u>${outras.map(u => `<option value="${u.id}">${esc(u.nome)}</option>`).join('')}</select></label>
        <label class="fld"><span>Quantidade</span><input type="number" min="1" max="${p.quantidade}" value="1" data-q${p.imei ? ' disabled' : ''}></label></div>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Transferir', cls: 'primary', onClick: ({ body }) => {
        const dest = Number(body.querySelector('[data-u]').value); const q = Math.min(p.quantidade, Number(body.querySelector('[data-q]').value) || 1);
        let alvo = DB.list('produtos', { allUnits: true }).find(x => x.unidade_id === dest && x.id !== p.id && ((p.imei && x.imei === p.imei) || (!p.imei && p.codigo_barras && x.codigo_barras === p.codigo_barras) || (!p.imei && NEG.descProduto(x) === NEG.descProduto(p) && x.preco === p.preco)));
        if (!alvo) { const c = JSON.parse(JSON.stringify(p)); ['id', 'created_at', 'updated_at'].forEach(k => delete c[k]); c.quantidade = 0; c.unidade_id = dest; alvo = DB.insert('produtos', c); }
        NEG.movEstoque(p.id, -q, 'Saída', 'Transferência', alvo.id, 'Para ' + nomeRef('unidades', dest));
        const prev = DB.unitId(); DB.setMeta({ unidade_id: dest }); NEG.movEstoque(alvo.id, q, 'Entrada', 'Transferência', p.id, 'De ' + nomeRef('unidades', prev)); DB.setMeta({ unidade_id: prev });
        DB.insert('transferencias', { produto: NEG.descProduto(p), origem_id: prev, destino_id: dest, quantidade: q, produto_origem_id: p.id, produto_destino_id: alvo.id, data: new Date().toISOString() });
        UI.toast('Transferido'); cb && cb();
      } }]
    });
  };
  CRUD.register('transferencias', {
    col: 'transferencias', title: 'Histórico de transferências', crumb: 'Compras / Estoque', noNew: true, noEdit: true, noDelete: true,
    cols: [T('data', 'Data', { fmt: 'datetime' }), T('produto', 'Produto'), { label: 'Origem', get: r => nomeRef('unidades', r.origem_id) }, { label: 'Destino', get: r => nomeRef('unidades', r.destino_id) }, T('quantidade', 'Qtd'), T('created_by', 'Usuário')]
  });
  EST.termoCompra = function (p) {
    const t = DB.list('termos').find(x => x.tipo === 'Termo de compra');
    const forn = DB.get('pessoas', p.fornecedor_cliente_id || p.fornecedor_id) || {};
    const txt = t ? UI.fillTemplate(t.texto, { cliente: forn.nome || '______________________', cpf: forn.cpf || '______________', produto: NEG.descProduto(p), imei: p.imei || '', data: UI.date(p.data_entrada || UI.today()), loja: nomeRef('unidades', DB.unitId()) }) : '';
    UI.print(UI.docHeader(t ? t.nome : 'Termo de compra', UI.date(p.data_entrada)) + `<p><b>Aparelho:</b> ${esc(NEG.descProduto(p))} · IMEI ${esc(p.imei || '')} · Valor pago: ${UI.money(p.custo)}</p><div class="box" style="white-space:pre-wrap">${esc(txt)}</div><div class="sign">${esc(forn.nome || 'Vendedor do aparelho')}</div>`);
  };
  EST.historico = function (p, consulta) {
    const movs = DB.list('movestoque', { allUnits: true }).filter(m => m.produto_id === p.id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const imeis = p.imei ? DB.list('imeihist').filter(h => h.imei === p.imei) : [];
    UI.modal({
      title: NEG.descProduto(p), size: 'lg',
      body: `<div class="kpis"><div class="kpi"><span>Estoque</span><b>${p.quantidade}</b></div><div class="kpi accent"><span>Preço</span><b>${UI.money(p.preco)}</b>${p.preco2 ? `<small>Preço 2: ${UI.money(p.preco2)}</small>` : ''}</div>
        ${p.imei ? `<div class="kpi"><span>IMEI</span><b style="font-size:15px">${esc(p.imei)}</b></div>` : ''}${p.bateria ? `<div class="kpi"><span>Bateria</span><b>${p.bateria}%</b></div>` : ''}<div class="kpi"><span>Dias em estoque</span><b>${diasEstoque(p)}</b></div></div>
        ${p.obs ? `<p>${esc(p.obs)}</p>` : ''}<h3 class="form-sec">Movimentações</h3><table class="tbl"><thead><tr><th>Data</th><th>Tipo</th><th>Origem</th><th class="r">Qtd</th><th class="r">Saldo</th><th>Obs.</th><th>Usuário</th></tr></thead><tbody>
        ${movs.map(m => `<tr><td>${UI.datetime(m.data)}</td><td>${esc(m.tipo)}</td><td>${esc(m.origem)} ${m.origem_id ? '#' + m.origem_id : ''}</td><td class="r">${m.quantidade}</td><td class="r">${m.saldo}</td><td>${esc(m.obs || '')}</td><td>${esc(m.created_by)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sem movimentos</td></tr>'}</tbody></table>
        ${imeis.length ? `<h3 class="form-sec">Histórico do IMEI</h3>${imeis.map(h => `<div class="small">${UI.datetime(h.data)} — ${esc(h.evento)}</div>`).join('')}` : ''}`,
      buttons: consulta && p.quantidade > 0 ? [{ label: 'Fechar', cls: 'ghost' }, { label: 'Vender', cls: 'primary', onClick: () => App.go('#/pdv?produto=' + p.id) }] : [{ label: 'Fechar', cls: 'ghost' }]
    });
  };
  EST.massa = function (cb) {
    UI.modal({
      title: 'Editar em massa', size: 'sm',
      body: `<p class="small muted">Aplica a todos os produtos com estoque do tipo escolhido.</p><div class="grid-form" style="grid-template-columns:1fr 1fr">
        <label class="fld"><span>Tipo</span><select data-tipo>${NEG.TIPOS_PRODUTO.map(t => `<option>${t}</option>`).join('')}</select></label>
        <label class="fld"><span>Ação</span><select data-acao><option value="preco_pct">Reajustar preço de venda (%)</option><option value="garantia">Definir dias de garantia</option><option value="disp">Definir disponibilidade</option></select></label>
        <label class="fld"><span>Valor</span><input data-val type="number" step="0.01"></label>
        <label class="fld"><span>Disponibilidade</span>${FORM.input({ k: 'disp', ref: 'disponibilidades' }, '')}</label></div>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Aplicar', cls: 'primary', onClick: async ({ body }) => {
        const tipo = body.querySelector('[data-tipo]').value, acao = body.querySelector('[data-acao]').value, val = Number(body.querySelector('[data-val]').value), disp = Number(body.querySelector('[name=disp]').value);
        const alvo = DB.list('produtos').filter(p => p.tipo === tipo && p.quantidade > 0);
        alvo.forEach(p => {
          if (acao === 'preco_pct') DB.update('produtos', p.id, { preco: r2(p.preco * (1 + val / 100)) });
          if (acao === 'garantia') DB.update('produtos', p.id, { garantia_dias: val });
          if (acao === 'disp' && disp) DB.update('produtos', p.id, { disponibilidade_id: disp });
        });
        UI.toast(alvo.length + ' produto(s) alterado(s)'); cb && cb();
      } }]
    });
  };
  EST.importarCSV = async function (cb) {
    UI.modal({
      title: 'Importar produtos (CSV)', size: 'md',
      body: `<p>Arquivo separado por ponto e vírgula, com cabeçalho:</p><pre class="small">tipo;nome;imei;custo;preco;quantidade;codigo_barras;categoria
Acessório;Capa iPhone 15;;10;39,90;20;789000000001;Capas e películas
Aparelho;iPhone 13 128GB Preto;350000000000099;2100;2799;1;;Smartphones</pre><p class="small muted">Em aparelhos, o nome pode trazer modelo, GB e cor; ele vira a descrição.</p>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Escolher arquivo', cls: 'primary', onClick: async () => {
        const f = await UI.pickFile('.csv,.txt'); if (!f) return;
        const lines = (await UI.readText(f)).split(/\r?\n/).filter(Boolean);
        const head = lines.shift().split(';').map(h => h.trim().toLowerCase());
        const num = s => Number(String(s || '0').replace(/\./g, '').replace(',', '.')) || 0;
        let n = 0;
        lines.forEach(l => {
          const c = l.split(';'); const o = {}; head.forEach((h, i) => o[h] = (c[i] || '').trim());
          const cat = DB.list('categorias').find(x => x.nome === o.categoria);
          const p = DB.insert('produtos', { tipo: NEG.TIPOS_PRODUTO.includes(o.tipo) ? o.tipo : 'Acessório', nome: o.nome, imei: o.imei, custo: num(o.custo), preco: num(o.preco), quantidade: 0, codigo_barras: o.codigo_barras, categoria_id: cat ? cat.id : null, disponibilidade_id: (DB.list('disponibilidades')[0] || {}).id, data_entrada: UI.today() }, { silent: true });
          if (num(o.quantidade)) NEG.movEstoque(p.id, num(o.quantidade), 'Entrada', 'Importação', p.id);
          n++;
        });
        UI.toast(n + ' produto(s) importado(s)'); cb && cb();
      } }]
    });
  };

  /* ---------------- movimentações ---------------- */
  CRUD.register('movestoque', {
    col: 'movestoque', title: 'Movimentações de estoque', crumb: 'Compras / Estoque', noEdit: true, noDelete: true, newLabel: 'Lançar movimento',
    onNew: () => {
      const flds = [{ k: 'produto_id', label: 'Produto', ref: { col: 'produtos', label: r => `${NEG.descProduto(r)} (estoque ${r.quantidade})`, filter: r => r.tipo !== 'Serviço' }, req: true, w: 2 },
        { k: 'tipo', label: 'Tipo', opts: ['Entrada', 'Saída'], req: true, def: 'Entrada' }, { k: 'qtd', label: 'Quantidade', type: 'number', req: true, def: 1 }, { k: 'obs', label: 'Observação', w: 4 }];
      UI.modal({ title: 'Lançar movimento', size: 'md', body: `<div class="grid-form">${FORM.render(flds, {})}</div>`, buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Lançar', cls: 'primary', onClick: ({ body }) => {
        const d = FORM.read(body, flds); const e = FORM.validate(body, flds, d); if (e) { UI.toast(e, 'erro'); return false; }
        NEG.movEstoque(d.produto_id, d.tipo === 'Entrada' ? d.qtd : -d.qtd, d.tipo, 'Movimento manual', null, d.obs); UI.toast('Movimento lançado'); App.render();
      } }] });
    },
    cols: [T('produto_id', 'Id produto'), T('produto', 'Produto'), { label: 'Fornecedor', get: r => nomeRef('pessoas', r.fornecedor_id), optional: true }, T('created_by', 'Usuário'),
      T('data', 'Data', { fmt: 'datetime' }), T('tipo', 'Tipo', { badge: r => r.tipo === 'Entrada' ? 'ok' : 'danger' }), T('origem', 'Origem'), T('origem_id', 'Id origem'),
      T('quantidade', 'Qtd', { align: 'r' }), T('saldo', 'Qtd após', { align: 'r' }), T('custo', 'Custo', { fmt: 'money', perm: 'ver_custo', optional: true }), T('total_custo', 'Total custo', { fmt: 'money', perm: 'ver_custo' }),
      T('total_venda', 'Total venda', { fmt: 'money' }), T('obs', 'Observação')],
    filters: [{ k: 'tipo', label: 'Tipo', opts: ['Entrada', 'Saída'] }, { k: 'origem', label: 'Origem', opts: () => [...new Set(DB.list('movestoque').map(m => m.origem))] }, { k: 'data', label: 'Período', type: 'daterange' }],
    onRowClick: r => { const p = DB.get('produtos', r.produto_id); if (p) EST.historico(p); }
  });

  /* ---------------- ordem de compra ---------------- */
  CRUD.register('ordenscompra', {
    col: 'ordenscompra', title: 'Ordens de compra', single: 'Ordem de compra', crumb: 'Compras / Estoque', newLabel: 'Nova', perm: 'estoque',
    customForm: (el, id) => EST.ordemCompra(el, id === 'novo' ? null : id),
    cols: [T('id', 'Id'), T('codigo', 'Código'), T('situacao', 'Situação', { badge: r => ({ Recebida: 'ok', Cancelada: 'danger' }[r.situacao] || 'warn') }), T('data', 'Data da compra', { fmt: 'date' }),
      { label: 'Fornecedor', get: r => nomeRef('pessoas', r.fornecedor_id) }, { label: 'Itens', get: r => (r.itens || []).reduce((s, i) => s + (i.qtd || 0), 0), align: 'r' }, T('total', 'Valor total', { fmt: 'money' })],
    filters: [{ k: 'situacao', label: 'Situação', opts: ['Aberta', 'Recebida', 'Cancelada'] }, { k: 'data', label: 'Período', type: 'daterange' }],
    actions: [{ label: 'Imprimir', fn: r => UI.print(UI.docHeader('Ordem de compra #' + r.id, UI.date(r.data)) + `<p>Fornecedor: <b>${esc(nomeRef('pessoas', r.fornecedor_id))}</b></p><table><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Custo</th><th class="r">Total</th></tr>${(r.itens || []).map(i => `<tr><td>${esc(i.descricao)}${i.imei ? ' · IMEI ' + esc(i.imei) : ''}</td><td class="r">${i.qtd}</td><td class="r">${UI.money(i.custo)}</td><td class="r">${UI.money(i.custo * i.qtd)}</td></tr>`).join('')}</table><p class="r tot">Total ${UI.money(r.total)}</p>`) },
      { label: 'Gerar etiquetas', show: r => r.situacao === 'Recebida', fn: r => EST.etiquetas((r.itens || []).filter(i => i.produto_id).map(i => ({ produto: DB.get('produtos', i.produto_id), qtd: i.qtd }))) }],
    canDelete: r => r.situacao !== 'Recebida'
  });
  EST.ordemCompra = function (el, id) {
    const oc = id ? JSON.parse(JSON.stringify(DB.get('ordenscompra', id))) : { data: UI.today(), situacao: 'Aberta', itens: [], frete: 0, parcelas: 1, venc: UI.today() };
    const ro = oc.situacao !== 'Aberta';
    el.innerHTML = App.pageHead(id ? 'Ordem de compra #' + id : 'Nova ordem de compra', 'Compras / Estoque > Ordens de compra', `<a class="btn ghost" href="#/c/ordenscompra">Voltar</a>${!ro ? '<button class="btn ghost" data-xml>Importar XML da nota</button>' : ''}`) + `
      <section class="card"><div class="grid-form">
        <label class="fld w2 req"><span>Fornecedor</span>${FORM.input({ k: 'fornecedor_id', ref: { col: 'pessoas', filter: r => r.fornecedor } }, oc.fornecedor_id)}</label>
        <label class="fld"><span>Código / nº da nota</span><input name="codigo" value="${esc(oc.codigo || '')}"></label>
        <label class="fld"><span>Data da compra</span><input type="date" name="data" value="${esc(oc.data)}"></label>
        <label class="fld"><span>Frete (R$)</span><input type="number" step="0.01" name="frete" value="${oc.frete || 0}"></label>
        <label class="fld"><span>Forma de pagamento</span>${FORM.input({ k: 'forma_id', ref: 'formaspag' }, oc.forma_id)}</label>
        <label class="fld"><span>Parcelas</span><input type="number" name="parcelas" min="1" value="${oc.parcelas || 1}"></label>
        <label class="fld"><span>1º vencimento</span><input type="date" name="venc" value="${esc(oc.venc || UI.today())}"></label>
        <label class="fld w4"><span>Observação</span><input name="obs" value="${esc(oc.obs || '')}"></label></div></section>
      <section class="card"><h2>Itens</h2>${!ro ? `<div class="row-form">
        <label class="fld" style="flex:2"><span>Produto já cadastrado</span>${FORM.input({ k: 'add_prod', ref: { col: 'produtos', label: r => NEG.descProduto(r), filter: r => r.tipo !== 'Aparelho' && r.tipo !== 'Serviço' } }, '')}</label>
        <button class="btn" data-add-ex>Adicionar</button><button class="btn ghost" data-add-novo>Produto novo</button></div>` : ''}
        <div class="table-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Produto</th><th>Tipo</th><th>IMEI</th><th class="r">Qtd</th><th class="r">Custo unit.</th><th class="r">Venda unit.</th><th class="r">Total</th><th></th></tr></thead><tbody data-it></tbody><tfoot><tr><td colspan="6" class="r">Total da compra</td><td class="r" data-tot></td><td></td></tr></tfoot></table></div></section>
      <div class="form-actions">${ro ? `<span class="muted">Ordem ${esc(oc.situacao.toLowerCase())}${oc.recebida_em ? ' em ' + UI.datetime(oc.recebida_em) : ''}.</span>` : '<button class="btn ghost" data-cancelar>Cancelar ordem</button><button class="btn" data-salvar>Salvar</button><button class="btn ok" data-receber>Receber mercadoria</button>'}</div>`;
    const $ = s => el.querySelector(s);
    const render = () => {
      $('[data-it]').innerHTML = oc.itens.map((i, k) => `<tr data-k="${k}"><td>${ro ? esc(i.descricao) : `<input class="inline-inp wide" data-f="descricao" value="${esc(i.descricao)}"${i.produto_id ? ' disabled' : ''}>`}</td><td>${esc(i.tipo)}</td>
        <td>${i.tipo === 'Aparelho' && !ro ? `<input class="inline-inp wide" data-f="imei" value="${esc(i.imei || '')}">` : esc(i.imei || '')}</td>
        <td class="r">${ro ? i.qtd : `<input class="inline-inp" style="width:60px" type="number" data-f="qtd" value="${i.qtd}"${i.tipo === 'Aparelho' ? ' disabled' : ''}>`}</td>
        <td class="r">${ro ? UI.money(i.custo) : `<input class="inline-inp" type="number" step="0.01" data-f="custo" value="${i.custo}">`}</td>
        <td class="r">${ro ? UI.money(i.preco) : `<input class="inline-inp" type="number" step="0.01" data-f="preco" value="${i.preco || 0}">`}</td>
        <td class="r">${UI.money(i.custo * i.qtd)}</td><td>${ro ? '' : '<button class="icon-btn" data-rm aria-label="Remover">×</button>'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Sem itens</td></tr>';
      totOC();
    };
    const totOC = () => { oc.total = r2(oc.itens.reduce((s, i) => s + i.custo * i.qtd, 0) + (Number($('[name=frete]').value) || 0)); $('[data-tot]').textContent = UI.money(oc.total); };
    render();
    if (ro) { el.querySelectorAll('input,select').forEach(i => i.disabled = true); return; }
    $('[data-it]').addEventListener('change', e => { const f = e.target.dataset.f; if (!f) return; const tr = e.target.closest('tr'); const it = oc.itens[tr.dataset.k]; it[f] = ['qtd', 'custo', 'preco'].includes(f) ? Number(e.target.value) || 0 : e.target.value; tr.querySelector('td:nth-last-child(2)').textContent = UI.money(it.custo * it.qtd); totOC(); });
    $('[data-it]').addEventListener('click', e => { if (e.target.closest('[data-rm]')) { oc.itens.splice(e.target.closest('tr').dataset.k, 1); render(); } });
    $('[name=frete]').addEventListener('input', totOC);
    $('[data-add-ex]').onclick = () => { const p = DB.get('produtos', $('[name=add_prod]').value); if (!p) return; oc.itens.push({ produto_id: p.id, descricao: NEG.descProduto(p), tipo: p.tipo, qtd: 1, custo: p.custo || 0, preco: p.preco || 0 }); render(); };
    $('[data-add-novo]').onclick = () => {
      const flds = [{ k: 'tipo', label: 'Tipo', opts: NEG.TIPOS_PRODUTO.filter(t => t !== 'Serviço'), def: 'Aparelho' }, { k: 'modelo_id', label: 'Modelo (aparelho)', ref: 'modelos' }, { k: 'gb_id', label: 'GB', ref: 'gbs' },
        { k: 'cor_id', label: 'Cor', ref: 'cores' }, { k: 'estado_id', label: 'Estado', ref: 'estados' }, { k: 'nome', label: 'Nome (outros tipos)', w: 2 }, { k: 'qtd', label: 'Quantidade', type: 'number', def: 1, help: 'Aparelhos: uma linha por IMEI' },
        { k: 'custo', label: 'Custo unit.', type: 'money', req: true }, { k: 'preco', label: 'Venda unit.', type: 'money' }, { k: 'imeis', label: 'IMEIs (um por linha)', type: 'textarea', w: 4 }];
      UI.modal({ title: 'Produto novo', size: 'md', body: `<div class="grid-form" style="grid-template-columns:1fr 1fr">${FORM.render(flds, {})}</div>`, buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Adicionar', cls: 'primary', onClick: ({ body }) => {
        const d = FORM.read(body, flds);
        const base = { tipo: d.tipo, modelo_id: d.modelo_id, gb_id: d.gb_id, cor_id: d.cor_id, estado_id: d.estado_id, nome: d.nome, custo: d.custo || 0, preco: d.preco || 0 };
        const desc = NEG.descProduto(base);
        if (d.tipo === 'Aparelho') {
          const imeis = String(d.imeis || '').split(/\s*\n\s*/).filter(Boolean);
          const n = imeis.length || Number(d.qtd) || 1;
          for (let i = 0; i < n; i++) oc.itens.push(Object.assign({}, base, { descricao: desc, qtd: 1, imei: imeis[i] || '' }));
        } else oc.itens.push(Object.assign({}, base, { descricao: desc, qtd: Number(d.qtd) || 1 }));
        render();
      } }] });
    };
    const read = () => { ['fornecedor_id', 'forma_id'].forEach(k => oc[k] = Number(el.querySelector(`[name=${k}]`).value) || null); ['codigo', 'data', 'venc', 'obs'].forEach(k => oc[k] = el.querySelector(`[name=${k}]`).value); oc.frete = Number($('[name=frete]').value) || 0; oc.parcelas = Number($('[name=parcelas]').value) || 1; render(); };
    const save = () => { read(); if (!oc.fornecedor_id) { UI.toast('Escolha o fornecedor', 'erro'); return null; } if (oc.id) DB.update('ordenscompra', oc.id, oc); else Object.assign(oc, DB.insert('ordenscompra', oc)); return oc; };
    $('[data-salvar]').onclick = () => { if (save()) { UI.toast('Ordem salva'); App.go('#/c/ordenscompra'); } };
    $('[data-cancelar]').onclick = async () => { if (oc.id && await UI.confirm('Cancelar esta ordem de compra?')) { DB.update('ordenscompra', oc.id, { situacao: 'Cancelada' }); App.go('#/c/ordenscompra'); } };
    $('[data-xml]').onclick = async () => { const f = await UI.pickFile('.xml'); if (!f) return; const nf = FISCAL.parseNFe(await UI.readText(f)); if (!nf) { UI.toast('XML inválido', 'erro'); return; }
      const forn = FISCAL.fornecedorDaNota(nf); $('[name=fornecedor_id]').innerHTML = FORM.input({ k: 'x', ref: { col: 'pessoas', filter: r => r.fornecedor } }, forn.id).replace(/^<select[^>]*>|<\/select>$/g, ''); $('[name=fornecedor_id]').value = forn.id;
      $('[name=codigo]').value = nf.numero; nf.itens.forEach(i => oc.itens.push({ tipo: 'Acessório', nome: i.descricao, descricao: i.descricao, qtd: i.qtd, custo: i.valor_unit, preco: 0, codigo_barras: i.ean, ncm: i.ncm })); oc.chave = nf.chave; render(); UI.toast('Itens da nota adicionados'); };
    $('[data-receber]').onclick = async () => {
      const s = save(); if (!s) return;
      if (!s.itens.length) { UI.toast('Sem itens', 'erro'); return; }
      if (s.itens.some(i => i.tipo === 'Aparelho' && !i.imei)) { if (!(await UI.confirm('Há aparelhos sem IMEI. Receber assim mesmo?'))) return; }
      s.itens.forEach(i => {
        let p = i.produto_id ? DB.get('produtos', i.produto_id) : null;
        if (!p) {
          p = DB.insert('produtos', { tipo: i.tipo, modelo_id: i.modelo_id, gb_id: i.gb_id, cor_id: i.cor_id, estado_id: i.estado_id, nome: i.tipo === 'Aparelho' ? '' : i.descricao, imei: i.imei || '', custo: i.custo, preco: i.preco || 0,
            quantidade: 0, codigo_barras: i.codigo_barras || '', ncm: i.ncm || '', fornecedor_id: s.fornecedor_id, disponibilidade_id: (DB.list('disponibilidades')[0] || {}).id, data_entrada: s.data, garantia_dias: DB.cfg().garantia_padrao, origem: 'Ordem de compra #' + s.id, chave_nfe: s.chave || '' });
          i.produto_id = p.id;
        } else DB.update('produtos', p.id, { custo: i.custo, preco: i.preco || p.preco });
        NEG.movEstoque(p.id, i.qtd, 'Entrada', 'Ordem de compra', s.id, s.codigo ? 'Nota ' + s.codigo : '');
      });
      const n = Math.max(1, s.parcelas || 1); const cat = (DB.list('categoriasfin').find(c => c.sistema === 'compra') || {}).id;
      for (let k = 0; k < n; k++) NEG.lancar({ tipo: 'D', titulo: `Ordem de compra #${s.id}${n > 1 ? ` (${k + 1}/${n})` : ''}`, pessoa_id: s.fornecedor_id, valor: k === n - 1 ? r2(s.total - r2(s.total / n) * (n - 1)) : r2(s.total / n), vencimento: UI.addMonths(s.venc || UI.today(), k), categoria_id: cat, origem: 'Ordem de compra', origem_id: s.id, forma_id: s.forma_id, parcela: n > 1 ? `${k + 1}/${n}` : '', considerar: false });
      DB.update('ordenscompra', s.id, { situacao: 'Recebida', recebida_em: new Date().toISOString(), itens: s.itens });
      UI.toast('Mercadoria recebida: estoque e contas a pagar atualizados'); App.go('#/c/ordenscompra');
    };
  };

  /* ---------------- inventário ---------------- */
  CRUD.register('inventarios', {
    col: 'inventarios', title: 'Inventários', single: 'Inventário', crumb: 'Compras / Estoque', newLabel: 'Novo inventário', perm: 'estoque',
    customForm: (el, id) => EST.inventario(el, id === 'novo' ? null : id),
    cols: [T('id', 'Id'), T('descricao', 'Descrição'), T('data', 'Data', { fmt: 'date' }), T('situacao', 'Situação', { badge: r => r.situacao === 'Aplicado' ? 'ok' : 'warn' }),
      { label: 'Itens contados', get: r => (r.itens || []).filter(i => i.contado !== '' && i.contado != null).length }, { label: 'Divergências', get: r => (r.itens || []).filter(i => i.contado !== '' && i.contado != null && Number(i.contado) !== i.sistema).length }]
  });
  EST.inventario = function (el, id) {
    const inv = id ? JSON.parse(JSON.stringify(DB.get('inventarios', id))) : { data: UI.today(), descricao: 'Inventário ' + UI.date(UI.today()), situacao: 'Em contagem', tipo: '', itens: null };
    const ro = inv.situacao === 'Aplicado';
    if (!inv.itens) inv.itens = DB.list('produtos').filter(p => p.tipo !== 'Serviço' && (!inv.tipo || p.tipo === inv.tipo)).map(p => ({ produto_id: p.id, descricao: NEG.descProduto(p), imei: p.imei || '', sistema: p.quantidade, contado: '' }));
    el.innerHTML = App.pageHead(inv.descricao, 'Compras / Estoque > Inventário', `<a class="btn ghost" href="#/c/inventarios">Voltar</a>`) + `
      <div class="card"><div class="row-form"><label class="fld"><span>Descrição</span><input class="inp" name="descricao" value="${esc(inv.descricao)}"${ro ? ' disabled' : ''}></label>
        <label class="fld"><span>Ler código / IMEI (soma 1 na contagem)</span><input class="inp" data-scan placeholder="Leia o código e tecle Enter"${ro ? ' disabled' : ''}></label>
        <label class="fld"><span>Filtrar</span><input class="inp" data-q></label></div></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Produto</th><th>IMEI</th><th class="r">No sistema</th><th class="r">Contado</th><th class="r">Diferença</th></tr></thead><tbody data-b></tbody></table></div></div>
      ${ro ? '' : '<div class="form-actions"><button class="btn" data-salvar>Salvar contagem</button><button class="btn ok" data-aplicar>Aplicar ajustes no estoque</button></div>'}`;
    const tb = el.querySelector('[data-b]');
    const render = () => {
      const q = (el.querySelector('[data-q]').value || '').toLowerCase();
      tb.innerHTML = inv.itens.map((i, k) => ({ i, k })).filter(({ i }) => !q || (i.descricao + i.imei).toLowerCase().includes(q)).map(({ i, k }) => {
        const dif = i.contado === '' || i.contado == null ? '' : Number(i.contado) - i.sistema;
        return `<tr data-k="${k}"><td>${esc(i.descricao)}</td><td>${esc(i.imei)}</td><td class="r">${i.sistema}</td><td class="r"><input class="inline-inp" type="number" data-c value="${i.contado}"${ro ? ' disabled' : ''}></td><td class="r ${dif < 0 ? 'neg' : dif > 0 ? 'pos' : ''}">${dif === '' ? '' : (dif > 0 ? '+' : '') + dif}</td></tr>`;
      }).join('');
    };
    render();
    el.querySelector('[data-q]').addEventListener('input', render);
    tb.addEventListener('change', e => { if (e.target.dataset.c !== undefined) { inv.itens[e.target.closest('tr').dataset.k].contado = e.target.value === '' ? '' : Number(e.target.value); render(); } });
    el.querySelector('[data-scan]').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return; e.preventDefault();
      const c = e.target.value.trim(); e.target.value = '';
      const k = inv.itens.findIndex(i => { const p = DB.get('produtos', i.produto_id) || {}; return i.imei === c || p.codigo_barras === c || String(p.id) === c; });
      if (k < 0) { UI.toast('Código não encontrado', 'erro'); return; }
      inv.itens[k].contado = (Number(inv.itens[k].contado) || 0) + 1; render(); UI.toast(inv.itens[k].descricao + ': ' + inv.itens[k].contado);
    });
    const save = () => { inv.descricao = el.querySelector('[name=descricao]').value; if (inv.id) DB.update('inventarios', inv.id, inv); else Object.assign(inv, DB.insert('inventarios', inv)); };
    el.querySelector('[data-salvar]')?.addEventListener('click', () => { save(); UI.toast('Contagem salva'); });
    el.querySelector('[data-aplicar]')?.addEventListener('click', async () => {
      const difs = inv.itens.filter(i => i.contado !== '' && i.contado != null && Number(i.contado) !== i.sistema);
      if (!(await UI.confirm(`Aplicar ${difs.length} ajuste(s) no estoque? Itens não contados ficam como estão.`))) return;
      save();
      difs.forEach(i => { const p = DB.get('produtos', i.produto_id); if (p) NEG.movEstoque(p.id, Number(i.contado) - p.quantidade, Number(i.contado) > p.quantidade ? 'Entrada' : 'Saída', 'Inventário', inv.id, inv.descricao); });
      DB.update('inventarios', inv.id, { situacao: 'Aplicado', aplicado_em: new Date().toISOString() });
      UI.toast('Inventário aplicado'); App.go('#/c/inventarios');
    });
  };

  /* ---------------- histórico de IMEI ---------------- */
  App.route('/estoque/imei', (el, p, qs) => {
    el.innerHTML = App.pageHead('Histórico de IMEI', 'Compras / Estoque') + `<div class="card"><div class="row-form"><label class="fld"><span>IMEI ou número de série</span><input class="inp" data-i value="${esc(qs.get('imei') || '')}" placeholder="Digite e tecle Enter"></label><button class="btn primary" data-b>Buscar</button></div></div><div data-out></div>`;
    const busca = () => {
      const q = el.querySelector('[data-i]').value.trim(); if (!q) return;
      const prods = DB.list('produtos', { allUnits: true, deleted: false }).filter(x => x.imei === q || x.imei2 === q || x.serial === q);
      const ev = DB.list('imeihist').filter(h => h.imei === q);
      const vendas = DB.list('vendas', { allUnits: true }).filter(v => v.itens.some(i => i.imei === q) || (v.pagamentos || []).some(pg => pg.aparelho && pg.aparelho.imei === q));
      const os = DB.list('os', { allUnits: true }).filter(o => (o.aparelhos || []).some(a => a.imei === q));
      el.querySelector('[data-out]').innerHTML = `<div class="cols-2"><section class="card"><h2>Produtos</h2>${prods.map(x => `<p><a href="#/c/produtos/${x.id}">${esc(NEG.descProduto(x))}</a> — estoque ${x.quantidade} — ${esc(nomeRef('unidades', x.unidade_id))}</p>`).join('') || '<p class="muted">Nenhum produto com este IMEI.</p>'}</section>
        <section class="card"><h2>Linha do tempo</h2>${ev.sort((a, b) => a.data.localeCompare(b.data)).map(h => `<div class="small">${UI.datetime(h.data)} — ${esc(h.evento)}</div>`).join('') || '<p class="muted">Sem eventos.</p>'}</section></div>
        <div class="cols-2"><section class="card"><h2>Vendas</h2>${vendas.map(v => `<p><a href="#/c/vendas/${v.id}">Venda #${v.id}</a> — ${UI.date(v.data)} — ${esc(nomeRef('pessoas', v.cliente_id))} — ${esc(v.status)}</p>`).join('') || '<p class="muted">Nenhuma.</p>'}</section>
        <section class="card"><h2>Ordens de serviço</h2>${os.map(o => `<p><a href="#/os/${o.id}">OS #${o.id}</a> — ${UI.date(o.created_at)} — ${esc(nomeRef('pessoas', o.cliente_id))}</p>`).join('') || '<p class="muted">Nenhuma.</p>'}</section></div>`;
    };
    el.querySelector('[data-b]').onclick = busca;
    el.querySelector('[data-i]').addEventListener('keydown', e => { if (e.key === 'Enter') busca(); });
    if (qs.get('imei')) busca();
  });

  /* ---------------- etiquetas + código de barras (Code 128) ---------------- */
  const C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
  EST.barcode = function (txt, h = 34) {
    txt = String(txt || '').replace(/[^\x20-\x7e]/g, '');
    if (!txt) return '';
    const codes = [104]; let sum = 104;
    [...txt].forEach((ch, i) => { const c = ch.charCodeAt(0) - 32; codes.push(c); sum += c * (i + 1); });
    codes.push(sum % 103, 106);
    let x = 10, bars = '';
    codes.forEach(c => { [...C128[c]].forEach((w, i) => { w = Number(w); if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${h}"/>`; x += w; }); });
    return `<svg viewBox="0 0 ${x + 10} ${h}" width="100%" height="${h}" preserveAspectRatio="none" style="display:block">${bars}</svg>`;
  };
  EST.etiquetas = function (lista) {
    const modelo = DB.list('modelosetiqueta')[0] || { largura: 50, altura: 30, colunas: 3, campos: ['Descrição', 'Preço', 'IMEI', 'Código'] };
    const cp = modelo.campos || [];
    const loja = nomeRef('unidades', DB.unitId());
    const cards = [];
    lista.forEach(({ produto: p, qtd }) => { for (let i = 0; i < (qtd || 1); i++) cards.push(p); });
    if (!cards.length) { UI.toast('Nada para imprimir', 'erro'); return; }
    const parcela = p => { const f = DB.list('formaspag').find(x => x.tipo === 'Crédito'); if (!f) return ''; const n = Math.min(12, f.max_parcelas || 12); return `${n}x ${UI.money(p.preco / n)}`; };
    const html = `<style>.lbl{width:${modelo.largura}mm;height:${modelo.altura}mm;border:1px dashed #bbb;padding:1.5mm;box-sizing:border-box;overflow:hidden;font-size:8px;display:inline-block;vertical-align:top;margin:0 1mm 1mm 0}.lbl b{font-size:9px;display:block;line-height:1.1}.lbl .pr{font-size:12px;font-weight:bold}@media print{.lbl{border:0}}</style>
      ${cards.map(p => `<div class="lbl">${cp.includes('Descrição') ? `<b>${esc(NEG.descProduto(p))}</b>` : ''}${cp.includes('Estado') ? esc(nomeRef('estados', p.estado_id)) + ' ' : ''}${cp.includes('Bateria') && p.bateria ? 'Bat. ' + p.bateria + '%' : ''}
        ${cp.includes('Preço') ? `<div class="pr">${UI.money(p.preco)}</div>` : ''}${cp.includes('Preço parcelado') ? `<div>${parcela(p)}</div>` : ''}${cp.includes('IMEI') && p.imei ? `<div>IMEI ${esc(p.imei)}</div>` : ''}
        ${cp.includes('Código') ? EST.barcode(p.imei || p.codigo_barras || String(p.id), 22) + `<div style="text-align:center">${esc(p.imei || p.codigo_barras || p.id)}</div>` : ''}${cp.includes('Loja') ? `<div>${esc(loja)}</div>` : ''}</div>`).join('')}`;
    DB.insert('etiquetas', { modelo: modelo.nome, produtos: cards.length, descricao: [...new Set(cards.map(p => NEG.descProduto(p)))].slice(0, 5).join(', ') }, { silent: true });
    UI.print(html, { titulo: 'Etiquetas' });
  };
  App.route('/estoque/etiquetas', el => {
    const fila = [];
    el.innerHTML = App.pageHead('Etiquetas', 'Compras / Estoque', '<a class="btn ghost" href="#/c/modelosetiqueta">Modelos de etiqueta</a>') + `
      <div class="card"><div class="row-form"><label class="fld" style="flex:2"><span>Produto</span>${FORM.input({ k: 'p', ref: { col: 'produtos', label: r => NEG.descProduto(r) + (r.imei ? ' · ' + r.imei : ''), filter: r => r.quantidade > 0 } }, '')}</label>
        <label class="fld" style="max-width:120px"><span>Quantidade</span><input class="inp" type="number" min="1" value="1" data-q></label><button class="btn" data-add>Adicionar</button>
        <button class="btn ghost" data-todos>Todos com estoque</button></div>
        <table class="tbl" style="margin-top:12px"><thead><tr><th>Produto</th><th class="r">Etiquetas</th><th></th></tr></thead><tbody data-f></tbody></table>
        <div class="form-actions"><button class="btn primary" data-print>Imprimir etiquetas</button></div></div>
      <div class="card"><h2>Últimas gerações</h2>${DB.list('etiquetas').slice(-10).reverse().map(e => `<div class="small">${UI.datetime(e.created_at)} — ${e.produtos} etiqueta(s) — ${esc(e.descricao || '')}</div>`).join('') || '<p class="muted small">Nenhuma ainda.</p>'}</div>`;
    const render = () => { el.querySelector('[data-f]').innerHTML = fila.map((x, i) => `<tr><td>${esc(NEG.descProduto(x.produto))}</td><td class="r">${x.qtd}</td><td><button class="icon-btn" data-rm="${i}">×</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Adicione produtos</td></tr>'; };
    render();
    el.querySelector('[data-add]').onclick = () => { const p = DB.get('produtos', el.querySelector('[name=p]').value); if (p) { fila.push({ produto: p, qtd: Number(el.querySelector('[data-q]').value) || 1 }); render(); } };
    el.querySelector('[data-todos]').onclick = () => { DB.list('produtos').filter(p => p.quantidade > 0 && p.tipo !== 'Serviço' && p.tipo !== 'Peça').forEach(p => fila.push({ produto: p, qtd: p.imei ? 1 : p.quantidade })); render(); };
    el.querySelector('[data-f]').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { fila.splice(b.dataset.rm, 1); render(); } });
    el.querySelector('[data-print]').onclick = () => EST.etiquetas(fila);
  });
})();
