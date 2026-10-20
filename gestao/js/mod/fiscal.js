/* =====================================================================
   FISCAL: registro de notas, NF de entrada (upgrade), captura de XML
   A emissão real na SEFAZ exige certificado digital e servidor; por
   enquanto as notas são registradas aqui e emitidas no emissor da loja.
   ===================================================================== */
(function () {
  const nome = (col, id) => (DB.get(col, id) || {}).nome || '';
  const FISCAL = window.FISCAL = {};
  const AVISO = 'A emissão automática na SEFAZ entra na versão com servidor. Por enquanto registre aqui as notas emitidas no emissor da loja para manter o controle junto das vendas.';

  CRUD.register('nfe', {
    col: 'nfe', title: 'NF-e / NFC-e', single: 'Nota fiscal', crumb: 'Fiscal', newLabel: 'Registrar nota', perm: 'fiscal', intro: AVISO,
    fields: [{ k: 'modelo', label: 'Modelo', opts: ['NF-e (55)', 'NFC-e (65)', 'NFS-e'], def: 'NFC-e (65)' }, { k: 'numero', label: 'Número', req: true }, { k: 'serie', label: 'Série', def: () => (DB.get('unidades', DB.unitId()) || {}).nfe_serie || '1' },
      { k: 'tipo_op', label: 'Tipo de operação', opts: ['Saída', 'Entrada', 'Devolução'], def: 'Saída' }, { k: 'natureza_id', label: 'Natureza da operação', ref: 'naturezas' },
      { k: 'pessoa_id', label: 'Destinatário', ref: 'pessoas', w: 2 }, { k: 'venda_id', label: 'Venda', ref: { col: 'vendas', label: r => `#${r.id} - ${nome('pessoas', r.cliente_id)} - ${UI.money(r.total)}`, filter: r => r.status === 'Concluída' } },
      { k: 'data', label: 'Data de emissão', type: 'date', def: () => UI.today() }, { k: 'valor', label: 'Valor total (R$)', type: 'money', req: true },
      { k: 'cfop', label: 'CFOP' }, { k: 'status', label: 'Status', opts: ['Autorizada', 'Rejeitada', 'Cancelada', 'Em digitação'], def: 'Autorizada' },
      { k: 'chave', label: 'Chave de acesso (44 dígitos)', w: 2 }, { k: 'motivo', label: 'Motivo (rejeição/cancelamento)', w: 2 }, { k: 'transportador_id', label: 'Transportador', ref: 'transportadores' }],
    cols: [{ k: 'id', label: 'Cód' }, { k: 'numero', label: 'Nº' }, { k: 'modelo', label: 'Modelo' }, { k: 'tipo_op', label: 'Operação' }, { label: 'Destinatário', get: r => nome('pessoas', r.pessoa_id) },
      { k: 'data', label: 'Emissão', fmt: 'date' }, { k: 'valor', label: 'Valor', fmt: 'money' }, { k: 'venda_id', label: 'Venda', get: r => r.venda_id ? '#' + r.venda_id : '' },
      { k: 'status', label: 'Status', badge: r => ({ Autorizada: 'ok', Rejeitada: 'danger', Cancelada: 'danger' }[r.status] || 'warn') }],
    filters: [{ k: 'status', label: 'Status', opts: ['Autorizada', 'Rejeitada', 'Cancelada', 'Em digitação'] }, { k: 'data', label: 'Período', type: 'daterange' }],
    afterSave: (r, isNew) => { if (isNew && r.venda_id) DB.update('vendas', r.venda_id, { nf_id: r.id, nf_numero: r.numero }, { silent: true }); if (isNew) { const u = DB.get('unidades', DB.unitId()); if (u && Number(r.numero) > (u.nfe_ultima || 0)) DB.update('unidades', u.id, { nfe_ultima: Number(r.numero) }, { silent: true }); } }
  });
  FISCAL.registrarNF = function (v) {
    const u = DB.get('unidades', DB.unitId()) || {};
    CRUD.quickForm('nfe', { venda_id: v.id, pessoa_id: v.cliente_id, valor: v.total, numero: String((u.nfe_ultima || 0) + 1), serie: u.nfe_serie || '1', modelo: 'NFC-e (65)', tipo_op: 'Saída', status: 'Autorizada', data: UI.today() }, () => App.render());
  };

  CRUD.register('nfeentrada', {
    col: 'nfeentrada', title: 'NF de entrada — aparelhos recebidos (upgrade)', single: 'NF de entrada', crumb: 'Fiscal', perm: 'fiscal', newLabel: 'Lançar NF de entrada',
    intro: 'Cada aparelho recebido do cliente na troca gera uma pendência aqui, para emitir a nota de entrada. ' + AVISO,
    fields: [{ k: 'pessoa_id', label: 'Cliente / fornecedor', ref: 'pessoas', req: true, w: 2 }, { k: 'venda_id', label: 'Venda', ref: { col: 'vendas', label: r => '#' + r.id } },
      { k: 'produto_id', label: 'Produto', ref: { col: 'produtos', label: r => NEG.descProduto(r) + (r.imei ? ' · ' + r.imei : ''), filter: r => r.tipo === 'Aparelho' } }, { k: 'produtos', label: 'Descrição dos produtos', w: 2 },
      { k: 'valor', label: 'Valor total (R$)', type: 'money', req: true }, { k: 'numero', label: 'Nº da nota' }, { k: 'data', label: 'Data', type: 'date', def: () => UI.today() },
      { k: 'status', label: 'Status', opts: ['Pendente', 'Emitida', 'Cancelada'], def: 'Pendente' }, { k: 'chave', label: 'Chave de acesso', w: 2 }],
    cols: [{ k: 'id', label: 'Cód' }, { k: 'numero', label: 'Nº NF' }, { label: 'Cliente / fornecedor', get: r => nome('pessoas', r.pessoa_id) }, { k: 'data', label: 'Data', fmt: 'date' },
      { k: 'produtos', label: 'Produto(s)' }, { k: 'valor', label: 'Valor', fmt: 'money' }, { k: 'status', label: 'Status', badge: r => ({ Emitida: 'ok', Cancelada: 'danger' }[r.status] || 'warn') }],
    indicators: rows => [{ l: 'Quantidade', v: rows.length }, { l: 'Pendentes', v: rows.filter(r => r.status === 'Pendente').length, cls: 'warn' }, { l: 'Valor total', v: UI.money(rows.reduce((s, r) => s + (r.valor || 0), 0)) }],
    actions: [{ label: 'Marcar como emitida', show: r => r.status === 'Pendente', fn: async (r, re) => { const n = await UI.prompt('Número da nota de entrada'); if (n) { DB.update('nfeentrada', r.id, { numero: n, status: 'Emitida' }); re(); } } },
      { label: 'Imprimir prévia', fn: r => { const p = DB.get('pessoas', r.pessoa_id) || {}; UI.print(UI.docHeader('Prévia - NF de entrada', UI.date(r.data)) + `<p>Remetente: <b>${esc(p.nome || '')}</b> ${esc(p.cpf || '')}<br>${esc([p.rua, p.numero, p.bairro, p.cidade, p.uf].filter(Boolean).join(', '))}</p><table><tr><th>Produto</th><th class="r">Valor</th></tr><tr><td>${esc(r.produtos)}</td><td class="r">${UI.money(r.valor)}</td></tr></table>`); } }]
  });

  /* ---------------- leitura de XML de NF-e ---------------- */
  FISCAL.parseNFe = function (xml) {
    try {
      const d = new DOMParser().parseFromString(xml, 'text/xml');
      const t = (el, tag) => { const x = (el || d).getElementsByTagName(tag)[0]; return x ? x.textContent.trim() : ''; };
      const inf = d.getElementsByTagName('infNFe')[0]; if (!inf) return null;
      const emit = d.getElementsByTagName('emit')[0];
      return {
        chave: (inf.getAttribute('Id') || '').replace(/^NFe/, ''), numero: t(d.getElementsByTagName('ide')[0], 'nNF'), serie: t(d.getElementsByTagName('ide')[0], 'serie'),
        emissao: (t(d.getElementsByTagName('ide')[0], 'dhEmi') || t(d.getElementsByTagName('ide')[0], 'dEmi')).slice(0, 10),
        emit: { cnpj: t(emit, 'CNPJ') || t(emit, 'CPF'), nome: t(emit, 'xNome'), fantasia: t(emit, 'xFant'), uf: t(emit, 'UF'), cidade: t(emit, 'xMun'), fone: t(emit, 'fone') },
        valor: Number(t(d.getElementsByTagName('ICMSTot')[0], 'vNF')) || 0,
        itens: [...d.getElementsByTagName('det')].map(det => { const p = det.getElementsByTagName('prod')[0]; return { codigo: t(p, 'cProd'), ean: t(p, 'cEAN').replace('SEM GTIN', ''), descricao: t(p, 'xProd'), ncm: t(p, 'NCM'), cfop: t(p, 'CFOP'), qtd: Number(t(p, 'qCom')) || 1, valor_unit: Number(t(p, 'vUnCom')) || 0, total: Number(t(p, 'vProd')) || 0 }; })
      };
    } catch (e) { console.error(e); return null; }
  };
  FISCAL.fornecedorDaNota = function (nf) {
    const doc = UI.onlyDigits(nf.emit.cnpj);
    let f = DB.list('pessoas').find(p => UI.onlyDigits(p.cpf) === doc);
    if (!f) f = DB.insert('pessoas', { nome: nf.emit.fantasia || nf.emit.nome, cpf: nf.emit.cnpj, fornecedor: true, cliente: false, tipo_pessoa: 'Jurídica', uf: nf.emit.uf, cidade: nf.emit.cidade, telefone: nf.emit.fone });
    else if (!f.fornecedor) DB.update('pessoas', f.id, { fornecedor: true });
    return f;
  };
  CRUD.register('dfe', {
    col: 'dfe', title: 'Capturador de XML — notas de entrada', single: 'Nota de entrada', crumb: 'Fiscal', noNew: true, noEdit: true, perm: 'fiscal',
    intro: 'Importe o XML enviado pelo fornecedor: o sistema cadastra o fornecedor e, se você quiser, coloca os itens no estoque e gera a conta a pagar.',
    cols: [{ k: 'id', label: 'Id' }, { label: 'Fornecedor', get: r => nome('pessoas', r.fornecedor_id) }, { k: 'emissao', label: 'Emissão', fmt: 'date' }, { k: 'numero', label: 'Nº' }, { k: 'serie', label: 'Série' },
      { k: 'valor', label: 'Valor', fmt: 'money' }, { k: 'status_estoque', label: 'Estoque', badge: r => r.status_estoque === 'Importado' ? 'ok' : 'warn' }, { k: 'chave', label: 'Chave', optional: true }],
    tools: [{ label: 'Importar XML', fn: re => FISCAL.importarXML(re) }],
    actions: [{ label: 'Importar no estoque', show: r => r.status_estoque !== 'Importado', fn: (r, re) => FISCAL.xmlNoEstoque(r, re) },
      { label: 'Ver itens', fn: r => UI.modal({ title: 'Nota ' + r.numero, size: 'lg', body: `<table class="tbl"><thead><tr><th>Código</th><th>Descrição</th><th>NCM</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead><tbody>${r.itens.map(i => `<tr><td>${esc(i.codigo)}</td><td>${esc(i.descricao)}</td><td>${esc(i.ncm)}</td><td class="r">${i.qtd}</td><td class="r">${UI.money(i.valor_unit)}</td><td class="r">${UI.money(i.total)}</td></tr>`).join('')}</tbody></table>` }) },
      { label: 'Baixar XML', fn: r => UI.download(`nfe-${r.numero}.xml`, r.xml, 'text/xml') }]
  });
  FISCAL.importarXML = async function (cb) {
    const f = await UI.pickFile('.xml'); if (!f) return;
    const xml = await UI.readText(f); const nf = FISCAL.parseNFe(xml);
    if (!nf) { UI.toast('Este arquivo não parece um XML de NF-e', 'erro'); return; }
    if (DB.list('dfe').some(x => x.chave && x.chave === nf.chave)) { UI.toast('Esta nota já foi importada', 'aviso'); return; }
    const forn = FISCAL.fornecedorDaNota(nf);
    DB.insert('dfe', Object.assign({}, nf, { fornecedor_id: forn.id, status_estoque: 'Pendente', xml: xml.length < 300000 ? xml : '' }));
    UI.toast('Nota ' + nf.numero + ' importada'); cb && cb();
  };
  FISCAL.xmlNoEstoque = function (r, cb) {
    UI.modal({
      title: 'Colocar itens da nota ' + r.numero + ' no estoque', size: 'lg',
      body: `<p class="small muted">Para cada item, defina o tipo e o preço de venda. Itens com o mesmo código de barras de um produto existente somam ao estoque dele.</p>
        <table class="tbl"><thead><tr><th>Item</th><th>Tipo</th><th class="r">Qtd</th><th class="r">Custo</th><th class="r">Preço de venda</th></tr></thead><tbody>
        ${r.itens.map((i, k) => `<tr data-k="${k}"><td>${esc(i.descricao)}${i.ean ? `<div class="small muted">EAN ${esc(i.ean)}</div>` : ''}</td><td><select class="inline-inp" style="width:auto" data-tipo>${NEG.TIPOS_PRODUTO.filter(t => t !== 'Serviço').map(t => `<option${t === 'Acessório' ? ' selected' : ''}>${t}</option>`).join('')}</select></td><td class="r">${i.qtd}</td><td class="r">${UI.money(i.valor_unit)}</td><td class="r"><input class="inline-inp" type="number" step="0.01" data-preco value="${UI.round2(i.valor_unit * 2)}"></td></tr>`).join('')}</tbody></table>
        <label class="chk"><input type="checkbox" data-desp checked> Gerar conta a pagar de ${UI.money(r.valor)}</label>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Importar no estoque', cls: 'primary', onClick: ({ body }) => {
        body.querySelectorAll('tr[data-k]').forEach(tr => {
          const i = r.itens[tr.dataset.k]; const tipo = tr.querySelector('[data-tipo]').value; const preco = Number(tr.querySelector('[data-preco]').value) || 0;
          let p = i.ean ? DB.list('produtos').find(x => x.codigo_barras === i.ean) : null;
          if (!p) p = DB.insert('produtos', { tipo, nome: i.descricao, codigo_barras: i.ean, sku: i.codigo, ncm: i.ncm, custo: i.valor_unit, preco, quantidade: 0, fornecedor_id: r.fornecedor_id, disponibilidade_id: (DB.list('disponibilidades')[0] || {}).id, data_entrada: UI.today(), chave_nfe: r.chave });
          else DB.update('produtos', p.id, { custo: i.valor_unit, preco: preco || p.preco });
          NEG.movEstoque(p.id, i.qtd, 'Entrada', 'XML de NF-e', r.id, 'Nota ' + r.numero);
        });
        if (body.querySelector('[data-desp]').checked) NEG.lancar({ tipo: 'D', titulo: `NF ${r.numero} - ${nome('pessoas', r.fornecedor_id)}`, pessoa_id: r.fornecedor_id, valor: r.valor, vencimento: UI.addDays(UI.today(), 30), categoria_id: (DB.list('categoriasfin').find(c => c.sistema === 'compra') || {}).id, origem: 'XML de NF-e', origem_id: r.id, considerar: false });
        DB.update('dfe', r.id, { status_estoque: 'Importado' });
        UI.toast('Itens no estoque'); cb && cb();
      } }]
    });
  };

  /* histórico de NFs de vendas */
  App.route('/fiscal/vendasnf', el => {
    CRUD.register('vendasnf', {
      title: 'Vendas com nota fiscal', crumb: 'Fiscal', noNew: true, noEdit: true, noDelete: true,
      rows: () => DB.list('vendas').filter(v => v.status !== 'Pré-venda').map(v => { const n = DB.get('nfe', v.nf_id) || {}; return Object.assign({}, v, { nf_numero: n.numero || '', nf_status: n.status || 'Sem nota', nf_modelo: n.modelo || '', nf_data: n.data, nf_cfop: n.cfop || '' }); }),
      cols: [{ k: 'id', label: 'Venda' }, { label: 'Cliente', get: r => nome('pessoas', r.cliente_id) }, { k: 'data', label: 'Data da venda', fmt: 'date' }, { label: 'Produto(s)', get: r => r.itens.map(i => i.descricao).join(', ') },
        { k: 'total', label: 'Valor da venda', fmt: 'money' }, { k: 'nf_modelo', label: 'Modelo' }, { k: 'nf_numero', label: 'Nº da nota' }, { k: 'nf_data', label: 'Emissão', fmt: 'date' }, { k: 'nf_cfop', label: 'CFOP', optional: true },
        { k: 'status', label: 'Status venda' }, { k: 'nf_status', label: 'Status NF', badge: r => ({ Autorizada: 'ok', 'Sem nota': 'warn' }[r.nf_status] || 'danger') }],
      filters: [{ k: 'nf_status', label: 'Status NF', opts: ['Sem nota', 'Autorizada', 'Rejeitada', 'Cancelada'] }, { k: 'data', label: 'Período', type: 'daterange' }],
      indicators: rows => [{ l: 'Vendas com nota', v: UI.money(rows.filter(r => r.nf_status === 'Autorizada').reduce((s, r) => s + (r.total || 0), 0)), cls: 'ok' }, { l: 'Vendas sem nota', v: UI.money(rows.filter(r => r.nf_status === 'Sem nota' && r.status === 'Concluída').reduce((s, r) => s + (r.total || 0), 0)), cls: 'warn' }],
      actions: [{ label: 'Registrar NF', show: r => r.nf_status === 'Sem nota' && r.status === 'Concluída', fn: r => FISCAL.registrarNF(r) }],
      onRowClick: r => App.go('#/c/vendas/' + r.id)
    });
    CRUD.list('vendasnf', el);
  });
})();
