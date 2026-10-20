/* =====================================================================
   Definições de cadastros. Cada entrada vira uma tela de listagem +
   formulário. Telas com lógica própria (PDV, OS, caixa...) ficam em
   js/mod/*.js e só reaproveitam partes daqui.
   ===================================================================== */
(function () {
  const R = (k, label, ref, extra) => Object.assign({ k, label, ref }, extra || {});
  const T = (k, label, extra) => Object.assign({ k, label }, extra || {});
  const reg = CRUD.register;
  const simple = (key, title, crumb, extraFields = [], extraCols = [], opts = {}) => reg(key, Object.assign({
    col: key, title, single: opts.single || title, crumb,
    fields: [T('nome', 'Descrição', { req: true, w: 2 }), ...extraFields],
    cols: [T('id', 'Id'), T('nome', 'Descrição'), ...extraCols], saveNew: true
  }, opts));
  const pessoaNome = id => (DB.get('pessoas', id) || {}).nome || '';
  const ESTADOS_UF = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

  /* ---------------- PESSOAS (clientes, fornecedores, técnicos, motoboys) ---------------- */
  const pessoaFields = () => [
    T('', 'Identificação', { type: 'section' }),
    T('cliente', 'Cliente', { type: 'bool', def: true }), T('fornecedor', 'Fornecedor', { type: 'bool' }),
    T('tecnico', 'Técnico', { type: 'bool' }), T('motoboy', 'Motoboy', { type: 'bool' }),
    T('tipo_pessoa', 'Tipo', { opts: ['Física', 'Jurídica'], def: 'Física' }), T('cpf', 'CPF/CNPJ'),
    T('origem', 'Origem', { opts: ['Loja física', 'Instagram', 'WhatsApp', 'Indicação', 'Google', 'Site', 'Outros'] }),
    T('nome', 'Nome', { req: true, w: 2 }), T('profissao', 'Profissão'), T('nascimento', 'Data de nascimento', { type: 'date' }),
    T('genero', 'Gênero', { opts: ['Masculino', 'Feminino', 'Outro', 'Não informado'] }),
    T('ie', 'Inscrição estadual'), T('im', 'Inscrição municipal'),
    T('', 'Contato', { type: 'section' }),
    T('telefone', 'Telefone (WhatsApp)', { type: 'tel', req: false }), T('telefone2', 'Telefone alternativo', { type: 'tel' }),
    T('email', 'E-mail', { type: 'email' }), T('instagram', 'Instagram'),
    T('', 'Endereço', { type: 'section' }),
    T('cep', 'CEP'), T('rua', 'Rua', { w: 2 }), T('numero', 'Número'), T('bairro', 'Bairro'), T('cidade', 'Cidade'),
    T('uf', 'Estado', { opts: ESTADOS_UF }), T('complemento', 'Complemento'),
    T('', 'Observações, crédito e tags', { type: 'section' }),
    T('obs', 'Observações', { type: 'textarea', w: 4 }),
    T('tags', 'Tags', { type: 'multi', ref: 'tagspessoa', w: 4 }),
    T('limite_crediario', 'Limite de crediário (R$)', { type: 'money' }),
    T('indicado_por', 'Indicado por', { ref: { col: 'pessoas', filter: r => r.cliente } }),
    T('ia_pode_enviar', 'Pode receber mensagens automáticas?', { type: 'bool', def: true }),
    T('saldo_credito', 'Saldo de crédito', { type: 'calc', fn: d => UI.money(NEG.saldoCredito(d.id)) })
  ];
  const pessoaCols = [T('id', 'Cód.'), T('nome', 'Nome'), T('cpf', 'CPF/CNPJ'), T('telefone', 'Telefone'), T('email', 'E-mail', { optional: true }),
    T('cidade', 'Cidade', { optional: true }), { label: 'Último produto comprado', get: r => NEG_ultimaCompra(r.id) }, { label: 'Crédito', fmt: 'money', get: r => UI.money(NEG.saldoCredito(r.id)), optional: true }];
  window.NEG_ultimaCompra = id => {
    const v = DB.list('vendas').filter(x => x.cliente_id === id && x.status === 'Concluída').sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
    return v ? (v.itens[0] || {}).descricao || '' : '';
  };
  const pessoaActions = [
    { label: 'WhatsApp', fn: r => UI.whats(r.telefone, `Olá ${r.nome.split(' ')[0]}!`) },
    { label: 'Ver histórico de compras', fn: r => App.go('#/vendas/historico?cliente=' + r.id) },
    { label: 'Lançar crédito', fn: (r, re) => window.VENDAS && VENDAS.lancarCredito(r.id, re) },
    { label: 'Nova venda para este cliente', fn: r => App.go('#/pdv?cliente=' + r.id) }
  ];
  const pessoaBase = (key, title, flag, extra = {}) => reg(key, Object.assign({
    col: 'pessoas', title, single: title.replace(/s$/, ''), crumb: 'Pessoas', where: r => r[flag], fields: pessoaFields, cols: pessoaCols,
    defaults: () => ({ [flag]: true, cliente: flag === 'cliente' }), actions: pessoaActions, search: ['cpf', 'telefone', 'email'],
    filters: [{ k: 'tags', label: 'Tag', ref: 'tagspessoa', test: (r, v) => (r.tags || []).map(String).includes(String(v)) }, { k: 'cidade', label: 'Cidade', opts: () => [...new Set(DB.list('pessoas').map(p => p.cidade).filter(Boolean))] }],
    validate: (d, rec) => {
      const doc = UI.onlyDigits(d.cpf);
      if (doc && DB.list('pessoas').some(p => p.id !== rec.id && UI.onlyDigits(p.cpf) === doc)) return 'Já existe uma pessoa com este CPF/CNPJ';
    }
  }, extra));
  pessoaBase('clientes', 'Clientes', 'cliente', {
    intro: 'Clientes, fornecedores, técnicos e motoboys ficam no mesmo cadastro de pessoas; marque os papéis de cada um.',
    indicators: rows => {
      const comVenda = new Set(DB.list('vendas').filter(v => v.status === 'Concluída').map(v => v.cliente_id));
      const recompra = DB.list('pessoas').filter(p => DB.list('vendas').filter(v => v.cliente_id === p.id && v.status === 'Concluída').length > 1).length;
      return [{ l: 'Total de pessoas', v: UI.int(DB.list('pessoas').length) }, { l: 'Total de clientes', v: UI.int(rows.length) },
        { l: 'Clientes que compraram', v: UI.int(comVenda.size) }, { l: 'Índice de recompra', v: UI.pct(comVenda.size ? recompra / comVenda.size * 100 : 0), cls: 'accent' }];
    },
    tools: [{ label: 'Importar CSV', fn: re => window.FERR && FERR.importarPessoas(re) }]
  });
  pessoaBase('fornecedores', 'Fornecedores', 'fornecedor', { crumb: 'Compras / Estoque > Configurações' });
  pessoaBase('tecnicos', 'Técnicos', 'tecnico', { crumb: 'Ordem de Serviço > Configurações' });
  pessoaBase('motoboys', 'Motoboys', 'motoboy', { crumb: 'Vendas > Configurações' });

  /* ---------------- VENDAS: cadastros ---------------- */
  simple('tagspessoa', 'Tags de clientes', 'Vendas > Configurações', [T('cor', 'Cor', { type: 'color' })], [T('cor', 'Cor', { color: true })]);
  simple('tiposvenda', 'Tipos de venda (funil)', 'Vendas > Configurações', [T('ordem', 'Ordem no funil', { type: 'number' }),
    T('locacao', 'É locação?', { type: 'bool', help: 'O pedido é o mesmo da venda, mas o recibo sai como "Pedido de locação", com prazo e termo de locação.' }),
    R('termo_locacao_id', 'Termo de locação', { col: 'termos', filter: t => t.tipo === 'Termo de locação' }, { help: 'Vazio = primeiro termo do tipo "Termo de locação".' })],
    [T('ordem', 'Ordem'), T('locacao', 'Locação', { get: r => r.locacao ? 'Sim' : '' })], { single: 'Tipo de venda' });
  simple('canais', 'Canais de venda', 'Vendas > Configurações', [], [], { single: 'Canal de venda' });
  simple('tiposentrega', 'Tipos de entrega', 'Vendas > Configurações', [T('valor', 'Valor padrão (R$)', { type: 'money' })], [T('valor', 'Valor', { fmt: 'money' })], { single: 'Tipo de entrega' });
  reg('vendedores', {
    col: 'vendedores', title: 'Vendedores', single: 'Vendedor', crumb: 'Vendas > Configurações', saveNew: true,
    fields: [T('nome', 'Nome', { req: true, w: 2 }), T('cpf', 'CPF'), T('ativo', 'Ativo?', { type: 'bool', def: true }),
      T('modelo_comissao', 'Modelo de comissão', { opts: ['Sobre venda', 'Sobre lucro'], def: 'Sobre venda' }), T('comissao_pct', 'Comissão padrão (%)', { type: 'percent' }),
      T('regras_txt', 'Comissão por tipo de produto', { type: 'textarea', w: 4, help: 'Uma regra por linha: Tipo; Modelo; %. Ex.: Aparelho; Sobre lucro; 10' })],
    cols: [T('id', 'Id'), T('nome', 'Nome'), T('cpf', 'CPF'), T('ativo', 'Ativo?', { fmt: 'bool' }), T('comissao_pct', 'Comissão %', { fmt: 'pct' })],
    beforeSave: d => { d.regras = String(d.regras_txt || '').split('\n').map(l => l.split(';').map(s => s.trim())).filter(x => x[0]).map(([tipo, modelo, pct]) => ({ tipo, modelo: modelo || 'Sobre venda', pct: Number(String(pct || 0).replace(',', '.')) })); }
  });
  reg('termos', {
    col: 'termos', title: 'Termos de garantia, compra, entrada e saída', single: 'Termo', crumb: 'Vendas > Configurações',
    fields: [T('tipo', 'Tipo', { req: true, opts: ['Garantia de venda', 'Termo de compra', 'Termo de locação', 'Entrada de OS', 'Saída de OS'] }), T('nome', 'Nome do termo', { req: true, w: 2 }),
      T('dias', 'Dias de garantia', { type: 'number' }), T('texto', 'Texto do termo', { type: 'textarea', rows: 10, w: 4, help: 'Variáveis: {cliente} {cpf} {endereco} {produto} {imei} {dias} {data} {loja} {cnpj_loja} {endereco_loja} {cidade_loja} {recibo} {total}. Locação: {inicio} {fim} {prazo} {parcelas} {valor_parcela} {entrada} {primeiro_venc}. Formatação: linha com "# " = título, "## " = seção, "- " = item de lista, **negrito**.' })],
    cols: [T('id', 'Id'), T('tipo', 'Tipo'), T('nome', 'Nome do termo'), T('dias', 'Dias')],
    actions: [{ label: 'Imprimir', fn: r => UI.print(UI.docHeader(r.nome) + `<div style="white-space:pre-wrap">${esc(r.texto)}</div>`) },
      { label: 'Duplicar', fn: (r, re) => { const c = Object.assign({}, r); delete c.id; c.nome += ' (cópia)'; DB.insert('termos', c); re(); } }]
  });
  reg('whatsmodelos', {
    col: 'whatsmodelos', title: 'Modelos de WhatsApp', single: 'Modelo de WhatsApp', crumb: 'Vendas > Configurações',
    fields: [T('titulo', 'Título', { req: true, w: 2 }), T('tipo', 'Uso', { opts: ['Recibo de venda', 'Ordem de serviço', 'Cobrança', 'Aniversário', 'Pós-venda', 'Outros'] }), T('padrao', 'Padrão?', { type: 'bool' }),
      T('texto', 'Texto', { type: 'textarea', rows: 6, w: 4, help: 'Variáveis: {cliente} {loja} {venda} {os} {total} {situacao} {vencimento} {valor}' })],
    cols: [T('id', 'Id'), T('titulo', 'Título'), T('tipo', 'Uso'), T('padrao', 'Padrão?', { fmt: 'bool' })]
  });
  reg('deliveries', {
    col: 'deliveries', title: 'Delivery', single: 'Delivery', crumb: 'Vendas',
    fields: [T('rota', 'Rota / endereço', { req: true, w: 2 }), R('motoboy_id', 'Motoboy', { col: 'pessoas', filter: r => r.motoboy }), T('status', 'Status', { opts: ['Pendente', 'Em rota', 'Entregue', 'Cancelado'], def: 'Pendente' }),
      T('inicio', 'Início', { type: 'datetime', def: () => UI.nowLocal() }), T('fim', 'Finalização', { type: 'datetime' }), T('custo', 'Custo (R$)', { type: 'money' }), T('cobrado', 'Valor cobrado (R$)', { type: 'money' }),
      R('venda_id', 'Venda', { col: 'vendas', label: r => `#${r.id} - ${pessoaNome(r.cliente_id)}` }), T('obs', 'Observação', { type: 'textarea', w: 4 })],
    cols: [T('id', 'Id'), T('rota', 'Rota'), T('motoboy_id', 'Motoboy'), T('inicio', 'Início', { fmt: 'datetime' }), T('fim', 'Fim', { fmt: 'datetime' }),
      T('custo', 'Custo', { fmt: 'money' }), T('cobrado', 'Cobrado', { fmt: 'money' }), T('venda_id', 'Venda', { get: r => r.venda_id ? '#' + r.venda_id : '' }), T('status', 'Status', { badge: r => ({ Entregue: 'ok', Cancelado: 'danger', 'Em rota': 'accent' }[r.status] || 'warn') })],
    indicators: rows => [{ l: 'Quantidade', v: rows.length }, { l: 'Total de custo', v: UI.money(rows.reduce((s, r) => s + (r.custo || 0), 0)) }, { l: 'Total cobrado', v: UI.money(rows.reduce((s, r) => s + (r.cobrado || 0), 0)) }],
    filters: [{ k: 'status', label: 'Status', opts: ['Pendente', 'Em rota', 'Entregue', 'Cancelado'] }, { k: 'inicio', label: 'Período', type: 'daterange' }],
    actions: [{ label: 'Enviar WhatsApp ao motoboy', fn: r => { const m = DB.get('pessoas', r.motoboy_id) || {}; UI.whats(m.telefone, `Entrega #${r.id}\nRota: ${r.rota}\nValor a cobrar: ${UI.money(r.cobrado)}\n${r.obs || ''}`); } },
      { label: 'Imprimir etiqueta', fn: r => { const v = DB.get('vendas', r.venda_id) || {}; const c = DB.get('pessoas', v.cliente_id) || {}; UI.print(`<div class="box"><h1>Entrega #${r.id}</h1><p><b>${esc(c.nome || '')}</b><br>${esc(r.rota)}<br>${esc(c.telefone || '')}</p><p>Cobrar: <b>${UI.money(r.cobrado)}</b></p></div>`, { formato: '80mm' }); } },
      { label: 'Marcar como entregue', show: r => r.status !== 'Entregue', fn: (r, re) => { DB.update('deliveries', r.id, { status: 'Entregue', fim: UI.nowLocal() }); re(); } }]
  });
  reg('seguros', {
    col: 'seguros', title: 'Seguros', single: 'Seguro', crumb: 'Vendas',
    fields: [R('venda_id', 'Venda', { col: 'vendas', label: r => `#${r.id} - ${pessoaNome(r.cliente_id)}` }), T('item', 'Item da venda', { w: 2 }), R('cliente_id', 'Cliente', { col: 'pessoas', filter: r => r.cliente }),
      T('aparelho', 'Aparelho'), T('valor', 'Valor total (R$)', { type: 'money', req: true }), T('comissao', 'Comissão (R$)', { type: 'money' }),
      T('status', 'Status', { opts: ['Ativo', 'Cancelado', 'Expirado'], def: 'Ativo' }), T('confirmacao', 'Confirmação', { opts: ['Pendente', 'Confirmado'], def: 'Pendente' })],
    cols: [T('id', 'Cód.'), T('venda_id', 'Venda', { get: r => r.venda_id ? '#' + r.venda_id : '' }), T('item', 'Item'), T('cliente_id', 'Cliente'), T('valor', 'Valor', { fmt: 'money' }),
      T('comissao', 'Comissão', { fmt: 'money' }), T('status', 'Status'), T('confirmacao', 'Confirmação'), T('created_at', 'Criação', { fmt: 'date' })],
    filters: [{ k: 'created_at', label: 'Período', type: 'daterange' }],
    footer: (c, rows) => c.k === 'valor' ? UI.money(rows.reduce((s, r) => s + (r.valor || 0), 0)) : c.k === 'comissao' ? UI.money(rows.reduce((s, r) => s + (r.comissao || 0), 0)) : ''
  });
  const TIPOS_META = ['Faturamento total da loja', 'Faturamento por vendedor', 'Faturamento por tipo de produto', 'Faturamento por tipo de produto e vendedor',
    'Quantidade de produtos vendidos por tipo', 'Quantidade por tipo de produto e vendedor', 'Lucro total da loja', 'Lucro por vendedor', 'Lucro por tipo de produto', 'Lucro por tipo de produto e vendedor'];
  window.TIPOS_META = TIPOS_META;
  reg('metas', {
    col: 'metas', title: 'Metas', single: 'Meta', crumb: 'Vendas', saveNew: true,
    tools: [{ label: 'Acessar dashboard', fn: () => App.go('#/rel/metas') }],
    fields: [T('data_ini', 'Data inicial', { type: 'date', req: true, def: () => UI.today().slice(0, 8) + '01' }), T('data_fim', 'Data final', { type: 'date', req: true, def: () => UI.addDays(UI.addMonths(UI.today().slice(0, 8) + '01', 1), -1) }),
      T('categoria', 'Categoria da meta', { opts: ['Venda', 'Ordem de serviço'], def: 'Venda', req: true }), T('tipo', 'Tipo de meta', { opts: TIPOS_META, req: true, w: 2 }),
      R('vendedor_id', 'Vendedor', 'vendedores'), R('tecnico_id', 'Técnico', { col: 'pessoas', filter: r => r.tecnico }),
      T('tipo_produto', 'Tipo de produto', { opts: () => NEG.TIPOS_PRODUTO }), T('valor', 'Valor da meta', { type: 'money', req: true })],
    cols: [T('id', 'Cód.'), T('data_ini', 'Data inicial', { fmt: 'date' }), T('data_fim', 'Data final', { fmt: 'date' }), T('categoria', 'Categoria'), T('tipo', 'Tipo de meta'),
      T('valor', 'Valor', { fmt: 'money' }), T('vendedor_id', 'Vendedor'), T('tipo_produto', 'Tipo de produto')]
  });
  simple('maquinas', 'Maquininhas POS', 'Vendas', [T('serial', 'N° de série'), T('liberada', 'Liberada?', { type: 'bool', def: true }), T('vinculada', 'Vinculada a', { opts: ['PDV', 'OS', 'Ambos'] })],
    [T('serial', 'N° de série'), T('liberada', 'Liberada', { fmt: 'bool' }), T('vinculada', 'Vinculada')], { single: 'Maquininha' });
  reg('tefpagamentos', {
    col: 'tefpagamentos', title: 'Histórico de pagamentos - maquininhas', single: 'Pagamento POS', crumb: 'Vendas',
    fields: [R('maquina_id', 'Maquininha', 'maquinas'), T('origem', 'Origem', { opts: ['Venda', 'OS', 'Avulso'] }), T('origem_id', 'Id de origem', { type: 'number' }), T('data', 'Data', { type: 'datetime', def: () => UI.nowLocal() }),
      T('identificacao', 'Identificação'), T('autorizacao', 'Cód. autorização'), T('bandeira', 'Bandeira', { opts: ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'] }),
      R('forma_id', 'Forma de pagamento', 'formaspag'), T('valor', 'Valor', { type: 'money', req: true }), T('situacao', 'Situação', { opts: ['Aprovado', 'Negado', 'Estornado'], def: 'Aprovado' }), T('pago', 'Pago?', { type: 'bool', def: true })],
    cols: [T('id', 'Id'), T('maquina_id', 'Maquininha'), T('origem', 'Origem'), T('origem_id', 'Id origem'), T('data', 'Data', { fmt: 'datetime' }), T('autorizacao', 'Autorização'), T('bandeira', 'Bandeira'),
      T('forma_id', 'Forma'), T('valor', 'Valor', { fmt: 'money' }), T('situacao', 'Situação'), T('pago', 'Pago?', { fmt: 'bool' })]
  });
  reg('creditos', {
    col: 'creditos', title: 'Histórico de movimentação de crédito', single: 'Crédito', crumb: 'Vendas', newLabel: 'Lançar crédito',
    fields: [R('pessoa_id', 'Cliente', { col: 'pessoas', filter: r => r.cliente }, { req: true, w: 2 }), T('valor', 'Valor (R$) — negativo para debitar', { type: 'money', req: true }),
      T('motivo', 'Motivo', { opts: ['Pagamento antecipado', 'Devolução', 'Bonificação', 'Ajuste', 'Uso em venda', 'Outros'], req: true }), T('validade', 'Validade', { type: 'date' }),
      T('status', 'Status', { opts: ['Ativo', 'Cancelado'], def: 'Ativo' }),
      R('forma_receb_id', 'Dinheiro recebido por', { col: 'formaspag', filter: f => !['Crédito do cliente', 'Aparelho na troca', 'Crediário', 'Boleto'].includes(f.tipo) }, { help: 'Preencha quando o cliente pagou adiantado: gera a entrada no caixa e no financeiro. Deixe vazio para bonificação ou ajuste.', hidden: d => !!d.id }),
      T('obs', 'Observação', { type: 'textarea', w: 4 })],
    beforeSave: d => { d.tipo = d.valor >= 0 ? 'Entrada' : 'Saída'; d.origem = d.origem || 'manual'; d.data = d.data || new Date().toISOString(); },
    afterSave: (r, isNew) => {
      if (!isNew || !r.forma_receb_id || !(r.valor > 0)) return;
      const cat = NEG.categoria('adiantamento', 'Adiantamentos de clientes', 'Receita', 'Adiantamentos de clientes');
      const f = NEG.lancar({ tipo: 'R', titulo: `Adiantamento de cliente (crédito #${r.id})`, pessoa_id: r.pessoa_id, valor: r.valor, vencimento: UI.today(), categoria_id: cat, origem: 'Crédito', origem_id: r.id });
      NEG.baixar(f.id, { forma_id: r.forma_receb_id, valor: r.valor, data: UI.today(), taxa: NEG.taxa(r.forma_receb_id, 1, r.valor) });
    },
    cols: [T('id', 'Id'), T('pessoa_id', 'Cliente', { get: r => pessoaNome(r.pessoa_id) }), T('created_by', 'Alterado por'), T('origem', 'Origem'), T('origem_id', 'Id origem'), T('tipo', 'Tipo'),
      T('motivo', 'Motivo'), T('validade', 'Validade', { fmt: 'date' }), { label: 'Saldo do cliente', get: r => UI.money(NEG.saldoCredito(r.pessoa_id)) }, T('status', 'Status'), T('created_at', 'Data', { fmt: 'datetime' }),
      T('valor', 'Valor', { fmt: 'money', html: r => `<span class="${r.valor < 0 ? 'neg' : 'pos'}">${UI.money(r.valor)}</span>` })],
    filters: [{ k: 'pessoa_id', label: 'Cliente', ref: { col: 'pessoas', filter: r => r.cliente } }, { k: 'tipo', label: 'Tipo', opts: ['Entrada', 'Saída'] }]
  });
  reg('trocas', {
    col: 'trocas', title: 'Trocas e devoluções', single: 'Troca/devolução', crumb: 'Vendas', noNew: true, noEdit: true,
    intro: 'Para registrar uma troca ou devolução, abra a venda em Venda - PDV e use a ação "Devolução/Troca".',
    cols: [T('id', 'Id'), T('venda_id', 'Venda', { get: r => '#' + r.venda_id }), T('cliente_id', 'Cliente', { get: r => pessoaNome(r.cliente_id) }), T('created_by', 'Usuário'),
      T('devolvidos', 'Devolvidos'), T('valor_anterior', 'Vlr anterior', { fmt: 'money' }), T('valor_posterior', 'Vlr posterior', { fmt: 'money' }), T('diferenca', 'Diferença', { fmt: 'money' }),
      T('resultado', 'Resultado'), T('danificado', 'Danificado', { fmt: 'bool' }), T('created_at', 'Data', { fmt: 'datetime' })]
  });

  /* ---------------- ESTOQUE: cadastros ---------------- */
  simple('modelos', 'Modelos de produtos', 'Compras / Estoque > Configurações', [R('marca_id', 'Marca', 'marcas'), T('qtd_minima', 'Qtd. mínima', { type: 'number' })], [T('marca_id', 'Marca'), T('qtd_minima', 'Qtd. mínima')], { single: 'Modelo' });
  simple('gbs', 'GB (armazenamento)', 'Compras / Estoque > Configurações', [], [], { single: 'GB' });
  simple('estados', 'Estados do aparelho', 'Compras / Estoque > Configurações', [], [], { single: 'Estado' });
  simple('cores', 'Cores', 'Compras / Estoque > Configurações', [], [], { single: 'Cor' });
  simple('marcas', 'Marcas', 'Compras / Estoque > Configurações', [], [], { single: 'Marca' });
  simple('categorias', 'Categorias', 'Compras / Estoque > Configurações', [], [], { single: 'Categoria' });
  simple('subcategorias', 'Subcategorias', 'Compras / Estoque > Configurações', [R('categoria_id', 'Categoria', 'categorias')], [T('categoria_id', 'Categoria')], { single: 'Subcategoria' });
  simple('tagsproduto', 'Tags de produto', 'Compras / Estoque > Configurações', [T('cor', 'Cor', { type: 'color' })], [T('cor', 'Cor', { color: true })], { single: 'Tag' });
  simple('disponibilidades', 'Disponibilidade de produto', 'Compras / Estoque > Configurações',
    [T('exibir_venda', 'Exibir na venda?', { type: 'bool', def: true }), T('cor', 'Cor', { type: 'color' })], [T('exibir_venda', 'Exibir na venda?', { fmt: 'bool' }), T('cor', 'Cor', { color: true })], { single: 'Disponibilidade' });
  simple('tiposproduto', 'Tipos de produtos (fiscal)', 'Compras / Estoque > Configurações',
    [T('ncm', 'NCM'), T('cest', 'CEST'), T('cst', 'CST/CSOSN'), T('origem', 'Origem', { opts: ['0 - Nacional', '1 - Estrangeira (importação direta)', '2 - Estrangeira (mercado interno)'] }), T('cfop_est', 'CFOP estadual'), T('cfop_inter', 'CFOP interestadual')],
    [T('ncm', 'NCM'), T('cest', 'CEST'), T('cst', 'CST'), T('cfop_est', 'CFOP est.'), T('cfop_inter', 'CFOP inter.')], { single: 'Tipo de produto' });
  simple('modelosetiqueta', 'Modelos de etiquetas', 'Compras / Estoque > Configurações',
    [T('largura', 'Largura (mm)', { type: 'number', def: 50 }), T('altura', 'Altura (mm)', { type: 'number', def: 30 }), T('colunas', 'Etiquetas por linha', { type: 'number', def: 3 }),
      T('campos', 'Campos', { type: 'multi', opts: ['Descrição', 'Preço', 'Preço parcelado', 'IMEI', 'Código', 'Estado', 'Bateria', 'Loja'], w: 4 })],
    [T('largura', 'Largura'), T('altura', 'Altura')], { single: 'Modelo de etiqueta' });
  reg('camposextras', {
    col: 'camposextras', title: 'Campos extras', single: 'Campo extra', crumb: 'Configurações',
    fields: [T('nome', 'Nome', { req: true }), T('tela', 'Tela', { opts: ['Produto', 'Ordem de serviço', 'Cliente', 'Venda'], req: true }), T('tipo', 'Tipo', { opts: ['Texto', 'Número', 'Data', 'Sim/Não'], def: 'Texto' }),
      T('recibo', 'Mostrar no recibo?', { type: 'bool' }), T('obrigatorio', 'Obrigatório?', { type: 'bool' })],
    cols: [T('id', 'Id'), T('nome', 'Nome'), T('tela', 'Tela'), T('tipo', 'Tipo'), T('recibo', 'No recibo', { fmt: 'bool' }), T('obrigatorio', 'Obrigatório', { fmt: 'bool' })]
  });
  reg('imeiconsultas', {
    col: 'imeiconsultas', title: 'Certificado de procedência / consultas de IMEI', single: 'Consulta de IMEI', crumb: 'Compras / Estoque', newLabel: 'Registrar consulta',
    intro: 'Registre aqui as consultas de IMEI feitas (ex.: no site da Anatel, consultaserialaparelho.com.br) e gere o certificado de procedência para o cliente.',
    fields: [T('imei', 'IMEI', { req: true }), T('imei2', 'IMEI 2'), T('modelo', 'Modelo'), T('resultado', 'Resultado', { opts: ['Regular', 'Com restrição (roubo/furto)', 'Bloqueado', 'Não consultado'], def: 'Regular' }),
      T('fonte', 'Fonte da consulta'), T('obs', 'Observação', { type: 'textarea', w: 4 })],
    cols: [T('id', 'Id'), T('imei', 'IMEI'), T('imei2', 'IMEI 2'), T('modelo', 'Modelo'), T('resultado', 'Resultado', { badge: r => r.resultado === 'Regular' ? 'ok' : 'danger' }), T('created_at', 'Data', { fmt: 'datetime' })],
    actions: [{ label: 'Gerar certificado', fn: r => UI.print(UI.docHeader('Certificado de procedência', UI.date(r.created_at)) + `<p>Certificamos que o aparelho <b>${esc(r.modelo || '')}</b>, IMEI <b>${esc(r.imei)}</b>${r.imei2 ? ' / ' + esc(r.imei2) : ''}, foi consultado em ${UI.datetime(r.created_at)} com resultado <b>${esc(r.resultado)}</b>${r.fonte ? ' (fonte: ' + esc(r.fonte) + ')' : ''}.</p><p>${esc(r.obs || '')}</p><div class="sign">Responsável</div>`) }]
  });

  /* ---------------- OS: cadastros ---------------- */
  reg('servicos', {
    col: 'servicos', title: 'Serviços', single: 'Serviço', crumb: 'Ordem de Serviço > Configurações', saveNew: true,
    fields: [T('nome', 'Descrição', { req: true, w: 2 }), T('custo', 'Valor de custo (R$)', { type: 'money' }), T('valor', 'Valor de venda (R$)', { type: 'money' }), T('garantia_dias', 'Garantia (dias)', { type: 'number', def: 90 })],
    cols: [T('id', 'Id'), T('nome', 'Descrição'), T('custo', 'Custo', { fmt: 'money', perm: 'ver_custo' }), T('valor', 'Venda', { fmt: 'money' }), T('garantia_dias', 'Garantia (dias)')]
  });
  simple('tiposos', 'Tipos de ordem de serviço', 'Ordem de Serviço > Configurações', [], [], { single: 'Tipo de OS' });
  simple('prioridades', 'Prioridades de OS', 'Ordem de Serviço > Configurações', [T('dias', 'Dias de previsão', { type: 'number' }), T('cor', 'Cor', { type: 'color' })], [T('dias', 'Dias de previsão'), T('cor', 'Cor', { color: true })], { single: 'Prioridade' });
  simple('tagsos', 'Tags de OS', 'Ordem de Serviço > Configurações', [T('cor', 'Cor', { type: 'color' })], [T('cor', 'Cor', { color: true })], { single: 'Tag' });
  reg('situacoesos', {
    col: 'situacoesos', title: 'Situações da ordem de serviço', single: 'Situação', crumb: 'Ordem de Serviço > Configurações',
    fields: [T('nome', 'Descrição', { req: true, w: 2 }), T('cor', 'Cor', { type: 'color' }), T('ordem', 'Ordem no kanban', { type: 'number' }),
      T('finalidade', 'Finalidade', { opts: ['Em andamento', 'Aguardando', 'Finalizada', 'Cancelada'], req: true, help: 'Finalizada baixa as peças e gera o financeiro; Cancelada estorna.' }),
      R('whats_modelo_id', 'Modelo de WhatsApp ao entrar nesta situação', { col: 'whatsmodelos', label: 'titulo' }, { w: 2 })],
    cols: [T('id', 'Id'), T('nome', 'Descrição'), T('cor', 'Cor', { color: true }), T('finalidade', 'Finalidade'), T('ordem', 'Ordem'), T('whats_modelo_id', 'Modelo WhatsApp')],
    sort: (a, b) => (a.ordem || 0) - (b.ordem || 0)
  });
  reg('checklists', {
    col: 'checklists', title: 'Modelos de checklist', single: 'Modelo de checklist', crumb: 'Ordem de Serviço > Configurações',
    fields: [T('nome', 'Descrição', { req: true, w: 2 }), T('itens', 'Itens (um por linha)', { type: 'textarea', rows: 10, w: 4 })],
    cols: [T('id', 'Id'), T('nome', 'Descrição'), { label: 'Itens', get: r => String(r.itens || '').split('\n').filter(Boolean).length }]
  });

  /* ---------------- FINANCEIRO: cadastros ---------------- */
  reg('categoriasfin', {
    col: 'categoriasfin', title: 'Categorias financeiras', single: 'Categoria', crumb: 'Financeiro > Configurações', saveNew: true,
    fields: [T('nome', 'Nome', { req: true, w: 2 }), T('tipo', 'Tipo', { opts: ['Receita', 'Despesa'], req: true }), R('pai_id', 'Categoria pai', 'categoriasfin'),
      R('plano_id', 'Plano de contas', 'planocontas'), T('dre', 'Grupo no DRE', { opts: ['Receita de vendas', 'Receita de OS', 'Outras receitas', 'Custo de mercadoria (CMV)', 'Custo de OS', 'Taxas', 'Despesa operacional', 'Despesa com pessoal', 'Impostos', 'Perdas e ajustes', 'Investimentos', 'Devoluções', 'Adiantamentos de clientes', 'Não considerar'] })],
    cols: [T('id', 'Id'), { label: 'Nome', get: r => (r.pai_id ? ((DB.get('categoriasfin', r.pai_id) || {}).nome + ' › ') : '') + r.nome }, T('tipo', 'Tipo'), T('plano_id', 'Plano de contas'), T('dre', 'Grupo DRE')]
  });
  reg('planocontas', {
    col: 'planocontas', title: 'Plano de contas', single: 'Conta', crumb: 'Financeiro > Configurações',
    fields: [T('codigo', 'Código', { ph: '1.01' }), T('nome', 'Nome', { req: true, w: 2 }), T('tipo', 'Tipo', { opts: ['Receita', 'Despesa'] }), R('pai_id', 'Conta pai', 'planocontas')],
    cols: [T('codigo', 'Código'), T('nome', 'Nome'), T('tipo', 'Tipo'), T('pai_id', 'Conta pai'), { label: 'Qtd. categorias', get: r => DB.list('categoriasfin').filter(c => c.plano_id === r.id).length }],
    sort: (a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR', { numeric: true })
  });
  simple('tagsfin', 'Tags financeiras', 'Financeiro > Configurações', [T('cor', 'Cor', { type: 'color' })], [T('cor', 'Cor', { color: true })], { single: 'Tag' });
  reg('formaspag', {
    col: 'formaspag', title: 'Formas de pagamento', single: 'Forma de pagamento', crumb: 'Financeiro > Configurações',
    fields: [T('nome', 'Descrição', { req: true, w: 2 }), T('tipo', 'Comportamento', { req: true, opts: ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Crediário', 'Boleto', 'Crédito do cliente', 'Aparelho na troca', 'Outros'], help: 'Crediário e boleto geram parcelas a receber. Dinheiro entra na conferência do caixa.' }),
      T('dias', 'Dias para cair', { type: 'number', def: 0 }), R('banco_id', 'Banco de destino', 'bancos'), T('taxa', 'Taxa padrão (%)', { type: 'percent' }),
      T('taxas_parcelas', 'Taxa por parcela', { ph: '1:3,2:4.5,3:5.2', help: 'parcelas:% separados por vírgula', w: 2 }), T('max_parcelas', 'Máx. de parcelas', { type: 'number', def: 1 }),
      T('pdv', 'Mostrar no PDV?', { type: 'bool', def: true }), T('ativo', 'Ativo?', { type: 'bool', def: true })],
    cols: [T('id', 'Id'), T('nome', 'Descrição'), T('tipo', 'Comportamento'), T('dias', 'Dias para cair'), T('banco_id', 'Banco'), T('taxa', 'Taxa', { fmt: 'pct' }), T('ativo', 'Ativo?', { fmt: 'bool' }), T('pdv', 'No PDV?', { fmt: 'bool' })],
    actions: [{ label: 'Duplicar', fn: (r, re) => { const c = Object.assign({}, r); delete c.id; c.nome += ' (cópia)'; DB.insert('formaspag', c); re(); } }]
  });
  reg('fixos', {
    col: 'fixos', title: 'Despesas e receitas fixas', single: 'Lançamento fixo', crumb: 'Financeiro', perm: 'financeiro',
    intro: 'Lançamentos que se repetem (aluguel, internet, mensalidades). Use "Gerar lançamentos" para criar os próximos vencimentos.',
    fields: [T('titulo', 'Título', { req: true, w: 2 }), T('tipo', 'Tipo', { opts: [{ v: 'D', l: 'Despesa' }, { v: 'R', l: 'Receita' }], req: true, def: 'D' }), R('pessoa_id', 'Pessoa', 'pessoas'),
      T('valor', 'Valor padrão (R$)', { type: 'money', req: true }), T('frequencia', 'Frequência', { opts: ['Mensal', 'Semanal', 'Quinzenal', 'Anual'], def: 'Mensal' }),
      T('proximo', 'Próximo vencimento a gerar', { type: 'date', req: true, def: () => UI.today() }), T('futuros', 'Lançamentos futuros a manter', { type: 'number', def: 1 }),
      R('categoria_id', 'Categoria', 'categoriasfin'), T('tags', 'Tags', { type: 'multi', ref: 'tagsfin', w: 4 }), T('ativo', 'Ativo?', { type: 'bool', def: true })],
    cols: [T('id', 'Id'), T('titulo', 'Título'), T('tipo', 'Tipo', { get: r => r.tipo === 'R' ? 'Receita' : 'Despesa' }), T('pessoa_id', 'Pessoa'), T('valor', 'Valor padrão', { fmt: 'money' }),
      T('proximo', 'Próximo vencimento', { fmt: 'date' }), T('futuros', 'Lançamentos futuros'), T('frequencia', 'Frequência'), T('categoria_id', 'Categoria')],
    tools: [{ label: 'Gerar lançamentos', fn: re => { const n = FIN.gerarFixos(); UI.toast(n + ' lançamento(s) gerado(s)'); re(); } }]
  });

  /* ---------------- FISCAL: cadastros ---------------- */
  reg('unidades', {
    col: 'unidades', title: 'Empresas / lojas e dados fiscais', single: 'Empresa / loja', crumb: 'Configurações', perm: 'config',
    fields: [T('nome', 'Nome da empresa', { req: true, w: 2, tab: 'Informações gerais' }), T('apelido', 'Apelido', { tab: 'Informações gerais' }), T('logo', 'Logotipo (aparece nos recibos)', { type: 'image', w: 4, tab: 'Informações gerais' }), T('cnpj', 'CPF/CNPJ', { tab: 'Informações gerais' }),
      T('ie', 'Insc. estadual', { tab: 'Informações gerais' }), T('im', 'Insc. municipal', { tab: 'Informações gerais' }), T('email', 'E-mail', { tab: 'Contatos' }), T('telefone', 'Telefone / WhatsApp', { tab: 'Contatos' }),
      T('instagram', 'Instagram', { tab: 'Contatos' }), T('endereco', 'Endereço completo', { tab: 'Contatos', w: 3 }), T('cidade', 'Cidade', { tab: 'Contatos' }), T('uf', 'UF', { opts: ESTADOS_UF, tab: 'Contatos' }),
      T('regime', 'Regime tributário', { opts: ['Simples Nacional', 'Simples - excesso de sublimite', 'Regime normal', 'MEI'], tab: 'Fiscal' }), T('cert_validade', 'Validade do certificado', { type: 'date', tab: 'Fiscal' }),
      T('ambiente', 'Ambiente', { opts: ['Homologação (testes)', 'Produção'], def: 'Homologação (testes)', tab: 'Fiscal' }), T('nfe_serie', 'Série NF-e', { tab: 'Fiscal' }), T('nfe_ultima', 'Última NF-e emitida', { type: 'number', tab: 'Fiscal' }),
      T('nfce_serie', 'Série NFC-e', { tab: 'Fiscal' }), T('nfce_ultima', 'Último NFC-e', { type: 'number', tab: 'Fiscal' }), T('csc', 'CSC', { tab: 'Fiscal' }), T('csc_id', 'CSC ID', { tab: 'Fiscal' }),
      T('rps_ultimo', 'Último RPS (NFS-e)', { type: 'number', tab: 'Fiscal' }), T('trib_est', 'Tributos aprox. estadual (%)', { type: 'percent', tab: 'Fiscal' }), T('trib_fed', 'Tributos aprox. federal (%)', { type: 'percent', tab: 'Fiscal' }),
      T('xml_contador', 'Enviar XML ao contador?', { type: 'bool', tab: 'Fiscal' }), T('email_contador', 'E-mail do contador', { tab: 'Fiscal' }),
      T('cor', 'Cor da loja', { type: 'color', tab: 'Configurações' })],
    cols: [T('id', 'Id'), T('nome', 'Empresa'), T('cnpj', 'CNPJ'), T('email', 'E-mail'), T('cert_validade', 'Validade do certificado', { fmt: 'date' }), T('ambiente', 'Ambiente')],
    noDelete: true, afterSave: () => { App.needShell = true; }
  });
  simple('aliquotas', 'Alíquota de ICMS por estado', 'Fiscal > Configurações', [T('aliquota', 'Alíquota (%)', { type: 'percent' })], [T('aliquota', 'Alíquota', { fmt: 'pct' })], { single: 'Alíquota', fields: [T('nome', 'UF', { opts: ESTADOS_UF, req: true }), T('aliquota', 'Alíquota (%)', { type: 'percent', req: true })] });
  simple('tributacoes', 'Tributações', 'Fiscal > Configurações', [T('cst', 'CST/CSOSN'), T('icms', 'ICMS (%)', { type: 'percent' }), T('pis', 'PIS (%)', { type: 'percent' }), T('cofins', 'COFINS (%)', { type: 'percent' })], [T('cst', 'CST/CSOSN'), T('icms', 'ICMS', { fmt: 'pct' })], { single: 'Tributação' });
  reg('naturezas', {
    col: 'naturezas', title: 'Naturezas da operação', single: 'Natureza da operação', crumb: 'Fiscal > Configurações',
    fields: [T('nome', 'Descrição', { req: true, w: 2 }), T('tipo_op', 'Tipo de operação', { opts: ['Saída', 'Entrada'] }), T('finalidade', 'Finalidade', { opts: ['Normal', 'Complementar', 'Ajuste', 'Devolução'] }),
      T('consumidor_final', 'Consumidor final?', { type: 'bool', def: true }), T('presenca', 'Indicador de presença', { opts: ['Presencial', 'Internet', 'Telefone', 'Outros'] }),
      T('cfop_int', 'CFOP interno'), T('cfop_ext', 'CFOP externo'), T('cfop_st_int', 'CFOP ST interno'), T('cfop_st_ext', 'CFOP ST externo')],
    cols: [T('nome', 'Descrição'), T('tipo_op', 'Tipo'), T('finalidade', 'Finalidade'), T('consumidor_final', 'Cons. final', { fmt: 'bool' }), T('cfop_int', 'CFOP int.'), T('cfop_ext', 'CFOP ext.')]
  });
  reg('transportadores', {
    col: 'transportadores', title: 'Transportadores', single: 'Transportador', crumb: 'Fiscal > Configurações',
    fields: [T('nome', 'Nome', { req: true, w: 2 }), T('telefone', 'Telefone'), T('email', 'E-mail'), T('endereco', 'Endereço', { w: 2 }), T('obs', 'Observações', { type: 'textarea', w: 4 })],
    cols: [T('nome', 'Nome'), T('telefone', 'Telefone'), T('email', 'E-mail'), T('endereco', 'Endereço')]
  });

  /* ---------------- FERRAMENTAS ---------------- */
  reg('scores', {
    col: 'scores', title: 'Consulta de score', single: 'Consulta', crumb: 'Ferramentas', newLabel: 'Registrar consulta',
    intro: 'Registro das consultas de crédito feitas para cada cliente. A consulta automática depende de contratar um birô (Serasa, Boa Vista, SPC) e entra numa versão com servidor.',
    fields: [T('cpf', 'CPF do cliente', { req: true }), T('nome', 'Nome', { w: 2 }), T('score', 'Score', { type: 'number' }), T('risco', 'Nível de risco', { opts: ['Baixo', 'Médio', 'Alto', 'Muito alto'] }),
      T('fonte', 'Fonte'), T('motivos', 'Motivos / observações', { type: 'textarea', w: 4 })],
    cols: [T('cpf', 'CPF'), T('nome', 'Nome'), T('score', 'Score'), T('risco', 'Nível de risco', { badge: r => ({ Baixo: 'ok', Médio: 'warn' }[r.risco] || 'danger') }), T('created_by', 'Consultado por'), T('created_at', 'Data', { fmt: 'datetime' })]
  });
  reg('precosdia', {
    col: 'precosdia', title: 'Preços do dia - fornecedores', single: 'Preço', crumb: 'Ferramentas', saveNew: true,
    intro: 'Lista de preços dos fornecedores para comparar antes de comprar. Cadastre manualmente ou importe um CSV (produto;fornecedor;categoria;preço).',
    fields: [T('produto', 'Produto', { req: true, w: 2 }), R('fornecedor_id', 'Fornecedor', { col: 'pessoas', filter: r => r.fornecedor }), T('categoria', 'Categoria', { opts: ['iPhone', 'Android', 'Seminovo', 'iPad', 'MacBook', 'Watch', 'AirPods', 'Acessórios', 'Outros'] }),
      T('preco', 'Preço (R$)', { type: 'money', req: true }), T('data', 'Data', { type: 'date', def: () => UI.today() })],
    cols: [T('produto', 'Produto'), T('fornecedor_id', 'Fornecedor'), T('categoria', 'Categoria'), T('preco', 'Preço', { fmt: 'money' }), T('data', 'Data', { fmt: 'date' })],
    filters: [{ k: 'categoria', label: 'Categoria', opts: ['iPhone', 'Android', 'Seminovo', 'iPad', 'MacBook', 'Watch', 'AirPods', 'Acessórios', 'Outros'] }],
    sort: (a, b) => String(a.produto).localeCompare(String(b.produto)) || a.preco - b.preco,
    tools: [{ label: 'Importar CSV', fn: async re => { const f = await UI.pickFile('.csv,.txt'); if (!f) return; const t = await UI.readText(f); let n = 0; t.split(/\r?\n/).slice(1).forEach(l => { const [produto, forn, categoria, preco] = l.split(';'); if (!produto) return; const fo = DB.list('pessoas').find(p => p.nome === forn); DB.insert('precosdia', { produto, fornecedor_id: fo ? fo.id : null, categoria, preco: Number(String(preco).replace('.', '').replace(',', '.')), data: UI.today() }, { silent: true }); n++; }); UI.toast(n + ' preço(s) importado(s)'); re(); } }]
  });
  reg('nps', {
    col: 'nps', title: 'NPS - pesquisas de satisfação', single: 'Resposta', crumb: 'Relatórios > Clientes', newLabel: 'Registrar resposta',
    fields: [R('pessoa_id', 'Cliente', { col: 'pessoas', filter: r => r.cliente }), T('origem', 'Origem', { opts: ['Venda', 'Ordem de serviço', 'Atendimento'] }), T('origem_id', 'Id de origem', { type: 'number' }),
      T('nota', 'Nota (0 a 10)', { type: 'number', req: true }), T('obs', 'Observação', { type: 'textarea', w: 4 })],
    cols: [T('id', 'Id'), T('pessoa_id', 'Cliente'), T('origem', 'Origem'), T('nota', 'Nota', { badge: r => r.nota >= 9 ? 'ok' : r.nota >= 7 ? 'warn' : 'danger' }), T('obs', 'Observação'), T('created_at', 'Data', { fmt: 'date' })],
    indicators: rows => {
      const n = rows.length || 1; const pro = rows.filter(r => r.nota >= 9).length, det = rows.filter(r => r.nota <= 6).length;
      return [{ l: 'Respostas', v: rows.length }, { l: 'Promotores', v: pro }, { l: 'Detratores', v: det }, { l: 'NPS', v: Math.round((pro - det) / n * 100), cls: 'accent' }];
    },
    tools: [{ label: 'Copiar link de pesquisa (WhatsApp)', fn: () => { navigator.clipboard?.writeText('De 0 a 10, quanto você recomendaria nossa loja a um amigo? Responda só com o número 🙂'); UI.toast('Mensagem copiada'); } }]
  });

  /* ---------------- MARKETPLACE / INTEGRAÇÕES ---------------- */
  reg('apitokens', {
    col: 'apitokens', title: 'API - tokens de acesso', single: 'Token', crumb: 'Marketplace', newLabel: 'Gerar token', perm: 'config',
    intro: 'A API ficará disponível quando o sistema for para um servidor. Os tokens gerados aqui já ficam reservados para isso.',
    fields: [T('descricao', 'Descrição', { req: true, w: 2 }), T('tipo', 'Tipo', { opts: ['Leitura', 'Leitura e escrita'], def: 'Leitura' }), T('ativo', 'Ativo?', { type: 'bool', def: true })],
    beforeSave: (d, rec, isNew) => { if (isNew) d.token = 'tk_' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join(''); },
    cols: [T('descricao', 'Descrição'), T('token', 'Token', { get: r => String(r.token || '').slice(0, 10) + '…' }), T('tipo', 'Tipo'), T('ativo', 'Ativo?', { fmt: 'bool' }), T('created_at', 'Criado em', { fmt: 'date' })]
  });
  reg('webhooks', {
    col: 'webhooks', title: 'Webhooks', single: 'Webhook', crumb: 'Marketplace', perm: 'config',
    intro: 'Avisa outro sistema quando um evento acontece. O envio é feito pelo navegador no momento do evento.',
    fields: [T('nome', 'Nome', { req: true }), T('url', 'URL de destino', { req: true, w: 2 }), T('evento', 'Evento', { opts: ['Venda finalizada', 'OS finalizada', 'Cliente cadastrado', 'Produto alterado'], req: true }),
      T('ativo', 'Ativo?', { type: 'bool', def: true }), T('obs', 'Observações', { type: 'textarea', w: 4 })],
    cols: [T('nome', 'Nome'), T('evento', 'Evento'), T('url', 'URL'), T('ativo', 'Ativo?', { fmt: 'bool' }), T('created_at', 'Criado em', { fmt: 'date' })]
  });
  reg('integracaologs', {
    col: 'integracaologs', title: 'Logs de integração', crumb: 'Marketplace', noNew: true, noEdit: true, perm: 'config',
    cols: [T('created_at', 'Data', { fmt: 'datetime' }), T('integracao', 'Integração'), T('acao', 'Ação'), T('descricao', 'Descrição'), T('objeto_id', 'Objeto'), T('status', 'Status', { badge: r => r.status === 'OK' ? 'ok' : 'danger' })]
  });

  /* ---------------- CONFIGURAÇÕES ---------------- */
  const PERMS = [{ v: 'tudo', l: 'Acesso total' }, { v: 'vendas', l: 'Vendas' }, { v: 'estoque', l: 'Estoque' }, { v: 'os', l: 'Ordem de serviço' }, { v: 'financeiro', l: 'Financeiro' },
    { v: 'fiscal', l: 'Fiscal' }, { v: 'relatorios', l: 'Relatórios' }, { v: 'config', l: 'Configurações' }, { v: 'ver_custo', l: 'Ver custo e lucro' }, { v: 'excluir', l: 'Excluir registros' },
    { v: 'desconto_livre', l: 'Desconto sem limite' }, { v: 'caixa', l: 'Abrir/fechar caixa' }];
  window.PERMS = PERMS;
  reg('perfis', {
    col: 'perfis', title: 'Perfis de acesso', single: 'Perfil', crumb: 'Configurações > Gestão de acesso', perm: 'config',
    fields: [T('nome', 'Nome do perfil', { req: true, w: 2 }), T('desconto_max', 'Desconto máximo (%)', { type: 'percent' }), T('permissoes', 'Permissões', { type: 'multi', opts: PERMS, w: 4 })],
    cols: [T('id', 'Id'), T('nome', 'Perfil'), T('permissoes', 'Permissões'), T('desconto_max', 'Desconto máx.', { fmt: 'pct' })]
  });
  reg('usuarios', {
    col: 'usuarios', title: 'Gestão de acesso - usuários', single: 'Usuário', crumb: 'Configurações', perm: 'config',
    fields: [T('nome', 'Nome', { req: true, w: 2 }), T('login', 'Login', { req: true }), T('email', 'E-mail', { type: 'email' }), T('senha', 'Senha', { type: 'password', req: true }),
      R('perfil_id', 'Perfil de acesso', 'perfis', { req: true }), R('vendedor_id', 'Vendedor relacionado', 'vendedores'), T('ativo', 'Ativo?', { type: 'bool', def: true }),
      T('unidades', 'Lojas que pode acessar (vazio = todas)', { type: 'multi', ref: 'unidades', w: 4 })],
    cols: [T('id', 'Id'), T('nome', 'Nome'), T('login', 'Login'), T('email', 'E-mail'), T('perfil_id', 'Perfil'), T('vendedor_id', 'Vendedor'), T('ativo', 'Ativo?', { fmt: 'bool' })],
    canDelete: r => r.id !== (DB.user() || {}).id
  });
  reg('senhasmestre', {
    col: 'senhasmestre', title: 'Senhas mestras', single: 'Senha mestre', crumb: 'Configurações', perm: 'config',
    intro: 'Quando existe uma senha mestre ativa, usuários que não são gerentes precisam dela para as ações marcadas.',
    fields: [T('nome', 'Descrição', { req: true, w: 2 }), T('senha', 'Senha', { type: 'password', req: true }), T('ativa', 'Ativa?', { type: 'bool', def: true }),
      T('permissoes', 'Exigir para (vazio = todas)', { type: 'multi', opts: [{ v: 'excluir', l: 'Excluir registros' }, { v: 'desconto', l: 'Desconto acima do limite' }, { v: 'cancelar_venda', l: 'Cancelar venda' }, { v: 'editar_estoque', l: 'Editar estoque' }, { v: 'caixa', l: 'Editar caixa' }], w: 4 })],
    cols: [T('id', 'Id'), T('nome', 'Descrição'), T('permissoes', 'Permissões'), T('ativa', 'Ativa?', { fmt: 'bool' })]
  });
  reg('notificacoes', {
    col: 'notificacoes', title: 'Notificações', single: 'Notificação', crumb: 'Configurações', perm: 'config', noNew: true,
    intro: 'Lembretes que aparecem no sino do topo da tela.',
    fields: [T('nome', 'Descrição', { ro: true, w: 2 }), T('ativo', 'Ativo?', { type: 'bool' }), T('dias', 'Avisar com quantos dias de antecedência', { type: 'number' })],
    cols: [T('id', 'Cód'), T('nome', 'Descrição'), T('ativo', 'Ativo?', { fmt: 'bool' }), T('dias', 'Antecedência (dias)')]
  });
  reg('acessos', {
    col: 'acessos', title: 'Logs de acesso', crumb: 'Configurações', noNew: true, noEdit: true, noDelete: true, perm: 'config',
    cols: [T('login', 'Login'), T('acao', 'Ação'), { label: 'Data', get: r => UI.datetime(r.entrada || r.logout), sortv: r => r.entrada || r.logout }, T('navegador', 'Navegador', { optional: true })]
  });
  reg('solicitacoes', {
    col: 'solicitacoes', title: 'Central de ideias - melhorias e correções', single: 'Solicitação', crumb: 'Configurações',
    fields: [T('tipo', 'Tipo', { opts: ['Melhoria', 'Correção', 'Dúvida'], req: true }), T('descricao', 'Descrição', { type: 'textarea', req: true, w: 4 }),
      T('status', 'Status', { opts: ['Aberta', 'Em análise', 'Em desenvolvimento', 'Finalizada', 'Recusada'], def: 'Aberta' }), T('resposta', 'Resposta', { type: 'textarea', w: 4 })],
    cols: [T('id', 'Id'), T('tipo', 'Tipo'), T('descricao', 'Descrição'), T('status', 'Status', { badge: r => r.status === 'Finalizada' ? 'ok' : r.status === 'Recusada' ? 'danger' : 'warn' }), T('resposta', 'Resposta'), T('created_by', 'Por')],
    indicators: rows => [{ l: 'Solicitações', v: rows.length }, { l: 'Minhas', v: rows.filter(r => r.created_by === DB.userName()).length }, { l: 'Finalizadas', v: rows.filter(r => r.status === 'Finalizada').length }]
  });
})();
