/* =====================================================================
   VENDAS: PDV, listagem, orçamentos, histórico, trocas, garantias,
   recibos e simulador de taxa.
   ===================================================================== */
(function () {
  const r2 = UI.round2;
  const pnome = id => (DB.get('pessoas', id) || {}).nome || '';
  const vnome = id => (DB.get('vendedores', id) || {}).nome || '';
  const STATUS_BADGE = { 'Concluída': 'ok', 'Pré-venda': 'warn', 'Cancelada': 'danger' };

  const VENDAS = {};
  window.VENDAS = VENDAS;

  /* ---------------- listagem de vendas ---------------- */
  CRUD.register('vendas', {
    col: 'vendas', title: 'Vendas', single: 'Venda', crumb: 'Vendas > Listagem', newLabel: 'Nova venda', perm: 'vendas',
    onNew: () => App.go('#/pdv'), customForm: (el, id) => VENDAS.abrir(el, id),
    cols: [{ k: 'id', label: 'Cód.' }, { k: 'cliente_id', label: 'Cliente', get: r => pnome(r.cliente_id) }, { k: 'vendedor_id', label: 'Vendedor', get: r => vnome(r.vendedor_id) },
      { k: 'data', label: 'Data da venda', fmt: 'datetime' }, { k: 'tipovenda_id', label: 'Tipo de venda', get: r => (DB.get('tiposvenda', r.tipovenda_id) || {}).nome || '' },
      { k: 'canal_id', label: 'Canal', get: r => (DB.get('canais', r.canal_id) || {}).nome || '', optional: true },
      { k: 'total', label: 'Valor', fmt: 'money' }, { k: 'lucro', label: 'Lucro', fmt: 'money', perm: 'ver_custo' },
      { k: 'status', label: 'Status', badge: r => STATUS_BADGE[r.status] || '' }],
    filters: [{ k: 'status', label: 'Status', opts: ['Concluída', 'Pré-venda', 'Cancelada'] }, { k: 'vendedor_id', label: 'Vendedor', ref: 'vendedores' },
      { k: 'tipovenda_id', label: 'Tipo', ref: 'tiposvenda' }, { k: 'data', label: 'Período', type: 'daterange' }],
    indicators: rows => {
      const ok = rows.filter(r => r.status === 'Concluída'); const fat = ok.reduce((s, r) => s + (r.total || 0), 0);
      const out = [{ l: 'Vendas concluídas', v: UI.int(ok.length) }, { l: 'Faturamento', v: UI.money(fat), cls: 'accent' }, { l: 'Ticket médio', v: UI.money(ok.length ? fat / ok.length : 0) }];
      if (App.can('ver_custo')) out.push({ l: 'Lucro', v: UI.money(ok.reduce((s, r) => s + (r.lucro || 0), 0)), cls: 'ok' });
      return out;
    },
    noDelete: true,
    actions: [
      { label: 'Recibo A4', show: r => r.status !== 'Pré-venda', fn: r => VENDAS.recibo(r, 'a4') },
      { label: 'Recibo 80mm', show: r => r.status !== 'Pré-venda', fn: r => VENDAS.recibo(r, '80mm') },
      { label: 'Enviar recibo por WhatsApp', show: r => r.status === 'Concluída', fn: r => VENDAS.whatsRecibo(r) },
      { label: 'Devolução / troca', show: r => r.status === 'Concluída', fn: (r, re) => VENDAS.troca(r, re) },
      { label: 'Cancelar a venda', show: r => r.status !== 'Cancelada', fn: (r, re) => VENDAS.cancelar(r, re) }
    ]
  });
  App.route('/vendas', el => CRUD.list('vendas', el));
  App.route('/pdv', (el, p, qs) => VENDAS.pdv(el, null, { cliente: qs.get('cliente'), produto: qs.get('produto'), credito: qs.get('credito'), orcamento: qs.get('orcamento') }));

  /* ---------------- orçamentos ---------------- */
  CRUD.register('orcamentos', {
    col: 'orcamentos', title: 'Orçamentos', single: 'Orçamento', crumb: 'Vendas > Orçamentos', newLabel: 'Novo orçamento', perm: 'vendas',
    onNew: () => App.go('#/c/orcamentos/novo'), customForm: (el, id) => VENDAS.pdv(el, id === 'novo' ? null : Number(id), { modo: 'orcamento' }),
    cols: [{ k: 'id', label: 'Cód.' }, { k: 'cliente_id', label: 'Cliente', get: r => pnome(r.cliente_id) }, { k: 'vendedor_id', label: 'Vendedor', get: r => vnome(r.vendedor_id) },
      { k: 'data', label: 'Data do orçamento', fmt: 'datetime' }, { k: 'previsao', label: 'Previsão de entrega', fmt: 'date' }, { k: 'total', label: 'Valor', fmt: 'money' },
      { k: 'validade', label: 'Validade', fmt: 'date' }, { k: 'venda_id', label: 'Venda gerada', get: r => r.venda_id ? '#' + r.venda_id : '' }],
    actions: [
      { label: 'Gerar venda', show: r => !r.venda_id, fn: r => App.go('#/pdv?orcamento=' + r.id) },
      { label: 'Imprimir', fn: r => VENDAS.recibo(r, 'a4', 'Orçamento') },
      { label: 'Imprimir cupom', fn: r => VENDAS.recibo(r, '80mm', 'Orçamento') },
      { label: 'Enviar por WhatsApp', fn: r => { const c = DB.get('pessoas', r.cliente_id) || {}; UI.whats(c.telefone, `Olá ${c.nome || ''}! Segue o orçamento #${r.id}:\n${(r.itens || []).map(i => `• ${i.qtd}x ${i.descricao} - ${UI.money(i.preco * i.qtd - (i.desconto || 0))}`).join('\n')}\nTotal: ${UI.money(r.total)}${r.validade ? '\nVálido até ' + UI.date(r.validade) : ''}`); } }
    ]
  });

  /* ---------------- histórico de vendas (por item) ---------------- */
  CRUD.register('historicovendas', {
    title: 'Histórico de vendas', crumb: 'Vendas > Histórico', noNew: true, noEdit: true, noDelete: true,
    rows: () => {
      const out = [];
      DB.list('vendas').filter(v => v.status !== 'Pré-venda').forEach(v => (v.itens || []).forEach((it, i) => {
        const p = DB.get('produtos', it.produto_id) || {};
        out.push({ id: v.id + '-' + i, venda_id: v.id, cliente_id: v.cliente_id, data: v.data, tipovenda_id: v.tipovenda_id, status: v.status, tipo: it.tipo, descricao: it.descricao,
          imei: it.imei || p.imei || '', estado: (DB.get('estados', p.estado_id) || {}).nome || '', canal_id: v.canal_id, valor: r2(it.preco * it.qtd - (it.desconto || 0)), desconto: it.desconto || 0,
          vendedor_id: v.vendedor_id, data_entrada: p.data_entrada, obs: v.obs, bateria: p.bateria, login: v.created_by, custo: r2((it.custo || 0) * it.qtd) });
      }));
      return out;
    },
    cols: [{ k: 'venda_id', label: 'Cód. venda' }, { label: 'Cliente', get: r => pnome(r.cliente_id) }, { k: 'data', label: 'Data venda', fmt: 'datetime' },
      { label: 'Tipo venda', get: r => (DB.get('tiposvenda', r.tipovenda_id) || {}).nome || '' }, { k: 'status', label: 'Status', badge: r => STATUS_BADGE[r.status] || '' },
      { k: 'tipo', label: 'Tipo produto' }, { k: 'descricao', label: 'Produto' }, { k: 'imei', label: 'IMEI' }, { k: 'estado', label: 'Estado', optional: true },
      { label: 'Canal', get: r => (DB.get('canais', r.canal_id) || {}).nome || '', optional: true }, { k: 'valor', label: 'Valor', fmt: 'money' },
      { k: 'desconto', label: 'Desconto', fmt: 'money', optional: true }, { k: 'custo', label: 'Custo', fmt: 'money', perm: 'ver_custo', optional: true },
      { label: 'Vendedor', get: r => vnome(r.vendedor_id) }, { k: 'data_entrada', label: 'Data entrada', fmt: 'date', optional: true },
      { k: 'bateria', label: 'Saúde bateria', optional: true }, { k: 'login', label: 'Login', optional: true }],
    filters: [{ k: 'cliente_id', label: 'Cliente', ref: { col: 'pessoas', filter: r => r.cliente } }, { k: 'vendedor_id', label: 'Vendedor', ref: 'vendedores' },
      { k: 'tipo', label: 'Tipo produto', opts: () => NEG.TIPOS_PRODUTO }, { k: 'data', label: 'Período', type: 'daterange' }],
    footer: (c, rows) => c.k === 'valor' ? UI.money(rows.reduce((s, r) => s + r.valor, 0)) : '',
    onRowClick: r => App.go('#/c/vendas/' + r.venda_id),
    actions: [{ label: 'Ver venda', fn: r => App.go('#/c/vendas/' + r.venda_id) }]
  });
  App.route('/vendas/historico', (el, p, qs) => {
    if (qs.get('cliente')) CRUD.setFilter('historicovendas', { cliente_id: qs.get('cliente') });
    CRUD.list('historicovendas', el);
  });

  /* =====================================================================
     PDV
     ===================================================================== */
  VENDAS.pdv = function (el, id, opt = {}) {
    const modo = opt.modo || 'venda';
    const col = modo === 'orcamento' ? 'orcamentos' : 'vendas';
    const u = DB.user();
    const cfg = DB.cfg();
    let v;
    if (id) {
      v = JSON.parse(JSON.stringify(DB.get(col, id)));
      if (modo === 'venda' && v.status !== 'Pré-venda') { VENDAS.abrir(el, id); return; }
    } else {
      const consumidor = DB.list('pessoas').find(p => p.nome === 'Consumidor final');
      v = { data: UI.nowLocal(), cliente_id: opt.cliente ? Number(opt.cliente) : (consumidor ? consumidor.id : null), vendedor_id: u.vendedor_id || null,
        tipovenda_id: (DB.list('tiposvenda')[0] || {}).id, canal_id: (DB.list('canais')[0] || {}).id, tipoentrega_id: (DB.list('tiposentrega')[0] || {}).id,
        termo_id: (DB.list('termos').find(t => t.tipo === 'Garantia de venda') || {}).id, itens: [], pagamentos: [], obs: '' };
      if (modo === 'orcamento') { v.validade = UI.addDays(UI.today(), 7); v.previsao = UI.today(); }
      if (opt.orcamento) {
        const o = DB.get('orcamentos', opt.orcamento);
        if (o) { Object.assign(v, { cliente_id: o.cliente_id, vendedor_id: o.vendedor_id, itens: JSON.parse(JSON.stringify(o.itens || [])), obs: o.obs || '', orcamento_id: o.id }); }
      }
    }
    if (opt.produto) setTimeout(() => addProduto(DB.get('produtos', opt.produto)), 0);
    const preset = !id && DB.meta().pdv_preset;
    if (preset) {
      DB.setMeta({ pdv_preset: null });
      if (preset.cliente_id) v.cliente_id = preset.cliente_id;
      if (preset.tipovenda) v.tipovenda_id = preset.tipovenda;
      v.negociacao_id = preset.negociacao_id;
      const p = DB.get('produtos', preset.produto_id);
      if (p) v.itens.push({ produto_id: p.id, descricao: NEG.descProduto(p), tipo: p.tipo, imei: p.imei || '', qtd: 1, preco: p.preco || 0, desconto: preset.desconto || 0, custo: p.custo || 0, seguro_valor: 0, garantia_dias: p.garantia_dias != null ? p.garantia_dias : (cfg.garantia_padrao || 0) });
      else if (preset.desejado) v.itens.push({ produto_id: null, descricao: preset.desejado.descricao || 'Aparelho', tipo: 'Aparelho', qtd: 1, preco: preset.desejado.preco || 0, desconto: 0, custo: 0, seguro_valor: 0, garantia_dias: cfg.garantia_padrao || 0 });
      if (preset.troca) v.pagamentos.push(preset.troca);
      if (preset.dif && preset.dif.valor > 0) {
        const tot = NEG.totaisVenda(v).total; const pago = v.pagamentos.reduce((s, x) => s + x.valor, 0);
        const acrescimo = UI.round2(pago + preset.dif.valor - tot);
        if (acrescimo > 0.009) v.itens.push({ produto_id: null, descricao: 'Acréscimo de taxa do parcelamento', tipo: 'Serviço', qtd: 1, preco: acrescimo, desconto: 0, custo: 0, seguro_valor: 0, garantia_dias: 0 });
        const f = NEG.forma(preset.dif.forma_id);
        const pg = { forma_id: f.id, valor: UI.round2(preset.dif.valor), parcelas: preset.dif.parcelas || 1, data: UI.today() };
        pg.taxa = NEG.taxa(f.id, pg.parcelas, pg.valor);
        if (f.tipo === 'Crediário' || f.tipo === 'Boleto') pg.primeiro_venc = UI.addMonths(UI.today(), 1);
        v.pagamentos.push(pg);
      }
    }

    const formas = DB.list('formaspag').filter(f => f.ativo !== false && f.pdv !== false);
    const showCost = App.can('ver_custo');

    el.innerHTML = `${App.pageHead(modo === 'orcamento' ? (id ? 'Orçamento #' + id : 'Novo orçamento') : (id ? 'Pré-venda #' + id : 'Nova venda'), modo === 'orcamento' ? 'Vendas > Orçamentos' : 'Vendas > PDV',
      `<button class="btn ghost" data-sim>Simular taxas</button><button class="btn ghost" data-limpar>Limpar</button>`)}
      <div class="pdv">
        <div>
          <section class="card"><h2>${FX.ic('user-round')}Dados da ${modo === 'orcamento' ? 'proposta' : 'venda'}</h2>
            <div class="grid-form">
              <label class="fld w2"><span>Cliente</span><div class="row-form" style="flex-wrap:nowrap"><select name="cliente_id" class="inp"></select><button type="button" class="btn ghost" data-novocli title="Cadastrar cliente">+</button></div></label>
              <label class="fld"><span>Vendedor</span>${FORM.input({ k: 'vendedor_id', ref: 'vendedores' }, v.vendedor_id)}</label>
              <label class="fld"><span>Data</span><input type="datetime-local" name="data" value="${esc(String(v.data).slice(0, 16))}"></label>
              <label class="fld"><span>Tipo de venda</span>${FORM.input({ k: 'tipovenda_id', ref: 'tiposvenda' }, v.tipovenda_id)}</label>
              <label class="fld"><span>Canal de venda</span>${FORM.input({ k: 'canal_id', ref: 'canais' }, v.canal_id)}</label>
              <label class="fld"><span>Tipo de entrega</span>${FORM.input({ k: 'tipoentrega_id', ref: 'tiposentrega' }, v.tipoentrega_id)}</label>
              <label class="fld"><span>Termo de garantia</span>${FORM.input({ k: 'termo_id', ref: { col: 'termos', filter: t => t.tipo === 'Garantia de venda' } }, v.termo_id)}</label>
              ${modo === 'orcamento' ? `<label class="fld"><span>Validade</span><input type="date" name="validade" value="${esc(v.validade || '')}"></label><label class="fld"><span>Previsão de entrega</span><input type="date" name="previsao" value="${esc(v.previsao || '')}"></label>` : ''}
              <label class="fld w4"><span>Observação</span><input name="obs" value="${esc(v.obs || '')}"></label>
            </div>
            <p class="small muted" data-cli-info></p>
          </section>
          <section class="card"><h2>${FX.ic('package')}Itens</h2>
            <div class="row-form">
              <div class="prod-search fld" style="flex:3"><span class="small muted">Produto (nome, IMEI, código de barras ou código)</span>
                <input class="inp" data-busca placeholder="Digite ou leia o código de barras e tecle Enter" autocomplete="off"><div class="prod-results" hidden></div></div>
              <button class="btn ghost" data-avulso>Item avulso / serviço</button>
            </div>
            <div class="table-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Valor unit.</th><th class="r">Desconto</th><th class="r">Seguro</th><th class="r">Garantia (dias)</th><th class="r">Total</th><th></th></tr></thead><tbody data-itens></tbody></table></div>
            <div class="row-form" style="margin-top:10px"><button class="btn ghost sm" data-desc="R$">Desconto em R$</button><button class="btn ghost sm" data-desc="%">Desconto em %</button><button class="btn ghost sm" data-desc="0">Limpar descontos</button></div>
          </section>
          ${modo === 'orcamento' ? '' : `<section class="card"><h2>${FX.ic('credit-card')}Pagamento</h2>
            <div class="row-form">
              <label class="fld"><span>Forma de pagamento</span><select class="inp" data-pg-forma>${formas.map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select></label>
              <label class="fld" style="max-width:150px"><span>Valor (R$)</span><input class="inp" type="number" step="0.01" data-pg-valor></label>
              <label class="fld" style="max-width:110px"><span>Parcelas</span><select class="inp" data-pg-parc></select></label>
              <label class="fld" style="max-width:170px" data-pg-venc-w hidden><span>1º vencimento</span><input class="inp" type="date" data-pg-venc></label>
              <button class="btn" data-pg-add>Adicionar pagamento</button>
            </div>
            <p class="small muted" data-pg-info></p>
            <div class="table-wrap"><table class="tbl"><thead><tr><th>Forma</th><th class="r">Valor</th><th class="r">Parcelas</th><th>Detalhes</th>${showCost ? '<th class="r">Taxa</th>' : ''}<th></th></tr></thead><tbody data-pags></tbody></table></div>
          </section>`}
        </div>
        <aside class="pdv-totals" aria-live="polite">
          <div class="line"><span>Produtos</span><b data-t="bruto"></b></div>
          <div class="line"><span>Descontos</span><b data-t="descontos"></b></div>
          <div class="line"><span>Seguros</span><b data-t="seguros"></b></div>
          <div class="line"><span>Total</span><b data-t="total"></b></div>
          ${modo === 'orcamento' ? '' : `<div class="line"><span>Pagamentos</span><b data-t="pagos"></b></div>${showCost ? '<div class="line"><span>Taxas de cartão</span><b data-t="taxas"></b></div><div class="line"><span>Lucro estimado</span><b data-t="lucro"></b></div>' : ''}
          <div class="saldo" data-saldo><span data-saldo-l>Falta receber</span><strong data-t="saldo"></strong></div>`}
          ${modo === 'orcamento' ? `<button class="btn primary block" data-salvar-orc>Salvar orçamento</button>${id ? '<button class="btn ok block" data-orc-venda>Gerar venda</button>' : ''}`
            : `<button class="btn ok block" data-finalizar>${FX.ic('circle-check')}Finalizar venda</button><button class="btn block" data-prevenda>Salvar como pré-venda</button>`}
          <a class="btn ghost block" href="${modo === 'orcamento' ? '#/c/orcamentos' : '#/vendas'}" style="color:#fff;border-color:var(--side-line)">Voltar</a>
        </aside>
      </div>`;

    const $ = s => el.querySelector(s);
    const cliSel = $('[name=cliente_id]');
    const fillClientes = () => {
      cliSel.innerHTML = DB.list('pessoas').filter(p => p.cliente).sort((a, b) => a.nome.localeCompare(b.nome)).map(p => `<option value="${p.id}"${p.id === v.cliente_id ? ' selected' : ''}>${esc(p.nome)}${p.cpf ? ' — ' + esc(p.cpf) : ''}</option>`).join('');
      cliInfo();
    };
    const cliInfo = () => {
      const c = DB.get('pessoas', Number(cliSel.value));
      const sc = c ? NEG.saldoCredito(c.id) : 0;
      $('[data-cli-info]').textContent = c ? [c.telefone, c.cidade, sc ? 'Crédito disponível: ' + UI.money(sc) : '', c.limite_crediario ? 'Limite de crediário: ' + UI.money(c.limite_crediario) : ''].filter(Boolean).join(' · ') : '';
    };
    fillClientes();
    cliSel.addEventListener('change', () => { v.cliente_id = Number(cliSel.value); cliInfo(); });
    $('[data-novocli]').onclick = () => CRUD.quickForm('clientes', { cliente: true }, rec => { v.cliente_id = rec.id; fillClientes(); });

    const readHead = () => {
      ['vendedor_id', 'tipovenda_id', 'canal_id', 'tipoentrega_id', 'termo_id'].forEach(k => { const x = el.querySelector(`[name=${k}]`); v[k] = x.value ? Number(x.value) : null; });
      v.cliente_id = Number(cliSel.value) || null; v.data = $('[name=data]').value; v.obs = $('[name=obs]').value;
      if (modo === 'orcamento') { v.validade = $('[name=validade]').value; v.previsao = $('[name=previsao]').value; }
    };

    /* ---- itens ---- */
    function addProduto(p) {
      if (!p) return;
      const disp = DB.get('disponibilidades', p.disponibilidade_id);
      if (disp && disp.exibir_venda === false) { UI.toast(`Produto está como "${disp.nome}"`, 'aviso'); }
      const ja = v.itens.find(i => i.produto_id === p.id);
      if (ja && !p.imei) { ja.qtd += 1; renderItens(); return; }
      if (ja && p.imei) { UI.toast('Este aparelho já está na venda', 'aviso'); return; }
      if (p.tipo !== 'Serviço' && NEG.estoqueDisponivel(p) <= 0 && modo !== 'orcamento') UI.toast('Atenção: produto sem estoque', 'aviso');
      v.itens.push({ produto_id: p.id, descricao: NEG.descProduto(p), tipo: p.tipo, imei: p.imei || '', qtd: 1, preco: p.preco || 0, desconto: 0, custo: p.custo || 0, seguro_valor: 0, garantia_dias: p.garantia_dias != null ? p.garantia_dias : (cfg.garantia_padrao || 0) });
      renderItens();
      const tr = tbItens.querySelector(`tr[data-i="${v.itens.length - 1}"]`); if (tr) tr.classList.add('flash');
    }
    const busca = $('[data-busca]'); const res = $('.prod-results');
    let hits = [], hl = 0;
    const buscar = () => {
      const q = busca.value.trim().toLowerCase();
      if (!q) { res.hidden = true; return; }
      hits = DB.list('produtos').filter(p => {
        const s = [NEG.descProduto(p), p.imei, p.imei2, p.codigo_barras, p.sku, String(p.id), p.serial].join(' ').toLowerCase();
        return s.includes(q);
      }).sort((a, b) => (b.quantidade > 0) - (a.quantidade > 0)).slice(0, 12);
      hl = 0;
      res.innerHTML = hits.length ? hits.map((p, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'hl' : ''}"><span>${esc(NEG.descProduto(p))}${p.imei ? ' <span class="muted small">IMEI ' + esc(p.imei) + '</span>' : ''}</span><span class="small">${p.tipo === 'Serviço' ? '' : 'Estoque: ' + UI.int(p.quantidade) + ' · '}<b>${UI.money(p.preco)}</b></span></button>`).join('') : '<div class="empty small">Nenhum produto encontrado</div>';
      res.hidden = false;
    };
    busca.addEventListener('input', buscar);
    busca.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(0, Math.min(hits.length - 1, hl + (e.key === 'ArrowDown' ? 1 : -1))); res.querySelectorAll('button').forEach((b, i) => b.classList.toggle('hl', i === hl)); }
      if (e.key === 'Enter') { e.preventDefault(); buscar(); if (hits[hl]) { addProduto(hits[hl]); busca.value = ''; res.hidden = true; } }
      if (e.key === 'Escape') res.hidden = true;
    });
    res.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { addProduto(hits[b.dataset.i]); busca.value = ''; res.hidden = true; busca.focus(); } });
    busca.addEventListener('blur', () => setTimeout(() => res.hidden = true, 200));

    $('[data-avulso]').onclick = () => {
      UI.modal({
        title: 'Item avulso / serviço', size: 'sm',
        body: `<div class="grid-form" style="grid-template-columns:1fr 1fr">${FORM.render([{ k: 'descricao', label: 'Descrição', req: true, w: 2 }, { k: 'preco', label: 'Valor (R$)', type: 'money', req: true }, { k: 'qtd', label: 'Quantidade', type: 'number', def: 1 }, { k: 'servico_id', label: 'Ou escolha um serviço', ref: 'servicos', w: 2 }], {})}</div>`,
        onOpen: ({ body }) => body.querySelector('[name=servico_id]').addEventListener('change', e => { const s = DB.get('servicos', e.target.value); if (s) { body.querySelector('[name=descricao]').value = s.nome; body.querySelector('[name=preco]').value = s.valor; } }),
        buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Adicionar', cls: 'primary', onClick: ({ body }) => {
          const d = FORM.read(body, [{ k: 'descricao' }, { k: 'preco', type: 'money' }, { k: 'qtd', type: 'number' }, { k: 'servico_id', ref: 'servicos' }]);
          if (!d.descricao || d.preco == null) { UI.toast('Preencha descrição e valor', 'erro'); return false; }
          const s = DB.get('servicos', d.servico_id);
          v.itens.push({ produto_id: null, descricao: d.descricao, tipo: 'Serviço', qtd: d.qtd || 1, preco: d.preco, desconto: 0, custo: s ? s.custo || 0 : 0, seguro_valor: 0, garantia_dias: s ? s.garantia_dias || 0 : 0 });
          renderItens();
        } }]
      });
    };

    const tbItens = $('[data-itens]');
    function renderItens() {
      tbItens.innerHTML = v.itens.length ? v.itens.map((it, i) => `<tr data-i="${i}">
        <td>${esc(it.descricao)}${it.imei ? `<div class="small muted">IMEI ${esc(it.imei)}</div>` : ''}</td>
        <td class="r"><input class="inline-inp" style="width:60px" type="number" min="1" step="1" data-f="qtd" value="${it.qtd}"${it.imei ? ' disabled' : ''}></td>
        <td class="r"><input class="inline-inp" type="number" step="0.01" data-f="preco" value="${it.preco}"></td>
        <td class="r"><input class="inline-inp" type="number" step="0.01" data-f="desconto" value="${it.desconto || 0}"></td>
        <td class="r"><input class="inline-inp" type="number" step="0.01" data-f="seguro_valor" value="${it.seguro_valor || 0}"></td>
        <td class="r"><input class="inline-inp" style="width:70px" type="number" step="1" data-f="garantia_dias" value="${it.garantia_dias || 0}"></td>
        <td class="r"><b>${UI.money(it.preco * it.qtd - (it.desconto || 0) + (it.seguro_valor || 0))}</b></td>
        <td><button class="icon-btn" data-rm aria-label="Remover item">${FX.ic('trash-2')}</button></td></tr>`).join('') : `<tr><td colspan="8" class="empty">Nenhum item. Busque um produto acima.</td></tr>`;
      renderTotais();
    }
    tbItens.addEventListener('change', e => {
      const inp = e.target.closest('[data-f]'); if (!inp) return;
      const it = v.itens[inp.closest('tr').dataset.i];
      it[inp.dataset.f] = Number(inp.value) || 0;
      if (inp.dataset.f === 'qtd' && it.qtd < 1) { it.qtd = 1; inp.value = 1; }
      // atualiza só o subtotal da linha e os totais: recriar a tabela aqui fazia o clique na lixeira se perder
      const sub = inp.closest('tr').querySelector('td:nth-last-child(2) b');
      if (sub) sub.textContent = UI.money(it.preco * it.qtd - (it.desconto || 0) + (it.seguro_valor || 0));
      renderTotais();
    });
    tbItens.addEventListener('click', e => { if (e.target.closest('[data-rm]')) { v.itens.splice(e.target.closest('tr').dataset.i, 1); renderItens(); } });

    el.querySelectorAll('[data-desc]').forEach(b => b.onclick = async () => {
      if (!v.itens.length) return;
      if (b.dataset.desc === '0') { v.itens.forEach(i => i.desconto = 0); renderItens(); return; }
      const val = await UI.prompt(b.dataset.desc === '%' ? 'Desconto em %' : 'Desconto em R$', { type: 'number', label: 'Será distribuído entre os itens' });
      if (val == null) return;
      const bruto = v.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
      const totalDesc = b.dataset.desc === '%' ? bruto * Number(val) / 100 : Number(val);
      let acc = 0;
      v.itens.forEach((it, i) => { const d = i === v.itens.length - 1 ? r2(totalDesc - acc) : r2(totalDesc * (it.preco * it.qtd) / bruto); it.desconto = d; acc += d; });
      renderItens();
    });

    /* ---- pagamentos ---- */
    const fSel = $('[data-pg-forma]'), fVal = $('[data-pg-valor]'), fPar = $('[data-pg-parc]'), fVenc = $('[data-pg-venc]');
    const tbPags = $('[data-pags]');
    function syncForma() {
      if (!fSel) return;
      const f = NEG.forma(Number(fSel.value));
      const max = Math.max(1, Number(f.max_parcelas) || 1);
      fPar.innerHTML = Array.from({ length: max }, (_, i) => `<option>${i + 1}</option>`).join('');
      const prazo = f.tipo === 'Crediário' || f.tipo === 'Boleto';
      $('[data-pg-venc-w]').hidden = !prazo;
      if (prazo && !fVenc.value) fVenc.value = UI.addMonths(UI.today(), 1);
      const t = NEG.totaisVenda(v);
      if (!fVal.value || Number(fVal.value) === 0) fVal.value = t.saldo > 0 ? t.saldo : '';
      let info = '';
      if (f.tipo === 'Crédito do cliente') info = 'Crédito disponível do cliente: ' + UI.money(NEG.saldoCredito(Number(cliSel.value)));
      if (f.tipo === 'Aparelho na troca') info = 'Ao adicionar, você vai cadastrar o aparelho recebido. Ele entra no estoque com custo igual a este valor.';
      if (prazo) info = 'Gera parcelas a receber no financeiro, uma por mês a partir do 1º vencimento.';
      $('[data-pg-info]').textContent = info;
      updParcInfo();
    }
    function updParcInfo() {
      if (!fSel || !App.can('ver_custo')) return;
      const f = NEG.forma(Number(fSel.value));
      if (f.tipo === 'Crédito') { const tx = NEG.taxa(f.id, Number(fPar.value), Number(fVal.value) || 0); $('[data-pg-info]').textContent = `Taxa estimada: ${UI.money(tx)} · você recebe ${UI.money((Number(fVal.value) || 0) - tx)}`; }
    }
    if (fSel) {
      fSel.addEventListener('change', () => { fVal.value = ''; syncForma(); });
      fPar.addEventListener('change', updParcInfo); fVal.addEventListener('input', updParcInfo);
      $('[data-pg-add]').onclick = () => {
        const f = NEG.forma(Number(fSel.value));
        const valor = r2(Number(fVal.value));
        if (!(valor > 0)) { UI.toast('Informe o valor', 'erro'); return; }
        const parcelas = Number(fPar.value) || 1;
        const pg = { forma_id: f.id, valor, parcelas, taxa: NEG.taxa(f.id, parcelas, valor), data: UI.today() };
        if (f.tipo === 'Crediário' || f.tipo === 'Boleto') pg.primeiro_venc = fVenc.value || UI.addMonths(UI.today(), 1);
        if (f.tipo === 'Crédito do cliente') {
          const saldo = NEG.saldoCredito(Number(cliSel.value)) - v.pagamentos.filter(p => NEG.forma(p.forma_id).tipo === 'Crédito do cliente').reduce((s, p) => s + p.valor, 0);
          if (valor > saldo + 0.004) { UI.toast('Crédito insuficiente: ' + UI.money(saldo), 'erro'); return; }
        }
        if (f.tipo === 'Aparelho na troca') { cadastrarAparelhoTroca(pg); return; }
        v.pagamentos.push(pg); fVal.value = ''; renderPags(); syncForma();
      };
    }
    function cadastrarAparelhoTroca(pg) {
      const flds = [{ k: 'modelo_id', label: 'Modelo', ref: 'modelos', req: true, w: 2 }, { k: 'gb_id', label: 'GB', ref: 'gbs' }, { k: 'cor_id', label: 'Cor', ref: 'cores' },
        { k: 'estado_id', label: 'Estado', ref: 'estados', def: 2 }, { k: 'imei', label: 'IMEI', req: true }, { k: 'bateria', label: 'Saúde da bateria (%)', type: 'number' },
        { k: 'preco', label: 'Preço de venda previsto (R$)', type: 'money' }, { k: 'obs', label: 'Observação', w: 4 }];
      UI.modal({
        title: 'Aparelho recebido na troca — ' + UI.money(pg.valor), size: 'md',
        body: `<p class="small muted">O aparelho entra no estoque como seminovo com custo ${UI.money(pg.valor)} e o termo de compra fica disponível no recibo.</p><div class="grid-form" style="grid-template-columns:1fr 1fr">${FORM.render(flds, { estado_id: (DB.list('estados').find(e => e.nome === 'Seminovo') || {}).id })}</div>`,
        buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Adicionar pagamento', cls: 'primary', onClick: ({ body }) => {
          const d = FORM.read(body, flds); const err = FORM.validate(body, flds, d); if (err) { UI.toast(err, 'erro'); return false; }
          if (DB.list('produtos').some(p => p.imei === d.imei && p.quantidade > 0)) { UI.toast('Já existe aparelho com este IMEI em estoque', 'erro'); return false; }
          pg.aparelho = d; pg.detalhe = 'IMEI ' + d.imei;
          v.pagamentos.push(pg); fVal.value = ''; renderPags(); syncForma();
        } }]
      });
    }
    function renderPags() {
      if (!tbPags) return;
      tbPags.innerHTML = v.pagamentos.length ? v.pagamentos.map((p, i) => `<tr data-i="${i}"><td>${esc(NEG.forma(p.forma_id).nome)}</td><td class="r">${UI.money(p.valor)}</td><td class="r">${p.parcelas || 1}x</td>
        <td class="small">${p.primeiro_venc ? '1º venc. ' + UI.date(p.primeiro_venc) : ''}${p.aparelho ? esc(NEG.descProduto(Object.assign({ tipo: 'Aparelho' }, p.aparelho))) + ' · ' + esc(p.detalhe) : ''}</td>
        ${App.can('ver_custo') ? `<td class="r muted">${UI.money(p.taxa || 0)}</td>` : ''}<td><button class="icon-btn" data-rm aria-label="Remover pagamento">${FX.ic('trash-2')}</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty small">Nenhum pagamento adicionado.</td></tr>';
      renderTotais();
    }
    tbPags?.addEventListener('click', e => { if (e.target.closest('[data-rm]')) { v.pagamentos.splice(e.target.closest('tr').dataset.i, 1); renderPags(); syncForma(); } });

    function renderTotais() {
      const t = NEG.totaisVenda(v);
      Object.keys(t).forEach(k => { const x = el.querySelector(`[data-t="${k}"]`); if (x) x.textContent = UI.money(k === 'saldo' ? Math.abs(t.saldo) : t[k]); });
      const s = $('[data-saldo]');
      if (s) {
        s.className = 'saldo ' + (Math.abs(t.saldo) < 0.005 ? 'zero' : t.saldo > 0 ? 'falta' : 'sobra');
        $('[data-saldo-l]').textContent = Math.abs(t.saldo) < 0.005 ? 'Pagamento completo' : t.saldo > 0 ? 'Falta receber' : 'Troco';
      }
    }

    /* ---- ações ---- */
    const checaDesconto = async () => {
      const t = NEG.totaisVenda(v);
      const pf = App.perfil() || {};
      const max = pf.desconto_max != null ? pf.desconto_max : (cfg.desconto_max || 100);
      if (!App.can('desconto_livre') && t.bruto > 0 && t.descontos / t.bruto * 100 > max + 0.001) {
        UI.toast(`Desconto acima do limite do seu perfil (${max}%)`, 'aviso');
        return await UI.master('desconto');
      }
      return true;
    };
    const salvar = (status) => {
      readHead();
      const t = NEG.totaisVenda(v);
      const data = Object.assign({}, v, { status, total: t.total, total_custo: t.custo, lucro: t.lucro, data: new Date(v.data).toISOString() });
      if (v.id) { DB.update(col, v.id, data); return DB.get(col, v.id); }
      const rec = DB.insert(col, data); v.id = rec.id; return rec;
    };
    $('[data-limpar]').onclick = async () => { if (await UI.confirm('Limpar itens e pagamentos?')) { v.itens = []; v.pagamentos = []; renderItens(); renderPags(); } };
    $('[data-sim]').onclick = () => VENDAS.simuladorTaxa(NEG.totaisVenda(v).total);
    $('[data-prevenda]')?.addEventListener('click', async () => {
      if (!v.itens.length) { UI.toast('Adicione ao menos um item', 'erro'); return; }
      if (!(await checaDesconto())) return;
      const rec = salvar('Pré-venda'); UI.toast('Pré-venda #' + rec.id + ' salva'); App.go('#/vendas');
    });
    $('[data-salvar-orc]')?.addEventListener('click', () => {
      if (!v.itens.length) { UI.toast('Adicione ao menos um item', 'erro'); return; }
      const rec = salvar('Orçamento'); UI.toast('Orçamento #' + rec.id + ' salvo'); App.go('#/c/orcamentos');
    });
    $('[data-orc-venda]')?.addEventListener('click', () => { salvar('Orçamento'); App.go('#/pdv?orcamento=' + v.id); });
    $('[data-finalizar]')?.addEventListener('click', async () => {
      readHead();
      if (!v.itens.length) { UI.toast('Adicione ao menos um item', 'erro'); return; }
      const t = NEG.totaisVenda(v);
      if (t.saldo > 0.004) { UI.toast('Falta receber ' + UI.money(t.saldo), 'erro'); return; }
      const temTroco = t.saldo < -0.004;
      if (temTroco) {
        const din = v.pagamentos.find(p => NEG.forma(p.forma_id).tipo === 'Dinheiro');
        if (!din) { UI.toast('O valor pago passou do total. Ajuste os pagamentos.', 'erro'); return; }
        din.troco = r2(-t.saldo); din.valor = r2(din.valor + t.saldo);
      }
      const prazo = v.pagamentos.filter(p => ['Crediário', 'Boleto'].includes(NEG.forma(p.forma_id).tipo));
      const cli = DB.get('pessoas', v.cliente_id) || {};
      if (prazo.length && (!cli.id || cli.nome === 'Consumidor final')) { UI.toast('Venda a prazo precisa de um cliente identificado', 'erro'); return; }
      if (prazo.length && cli.limite_crediario > 0) {
        const aberto = DB.list('financeiro', { allUnits: true }).filter(f => f.tipo === 'R' && f.pessoa_id === cli.id && ['Em aberto', 'Parcial'].includes(f.situacao)).reduce((s, f) => s + NEG.aPagar(f), 0);
        const novo = prazo.reduce((s, p) => s + p.valor, 0);
        if (aberto + novo > cli.limite_crediario + 0.004) {
          UI.toast(`Limite de crediário excedido: em aberto ${UI.money(aberto)} + novo ${UI.money(novo)} > limite ${UI.money(cli.limite_crediario)}`, 'erro');
          if (!(await UI.master('desconto'))) return;
        }
      }
      if (!(await checaDesconto())) return;
      if (cfg.caixa_ativo !== false && !NEG.caixaAberto() && v.pagamentos.some(p => !['Crediário', 'Boleto', 'Crédito do cliente', 'Aparelho na troca'].includes(NEG.forma(p.forma_id).tipo))) {
        const ok = await UI.confirm('Não há caixa aberto. Abrir um caixa agora com troco R$ 0,00?', { ok: 'Abrir caixa' });
        if (!ok) return;
        DB.insert('caixas', { descricao: 'Caixa ' + UI.date(UI.today()), abertura: new Date().toISOString(), troco: 0, status: 'Aberto', movs: [], usuario: DB.userName() });
      }
      try {
        const rec = salvar('Pré-venda');
        // aparelhos recebidos na troca entram no estoque
        v.pagamentos.filter(p => p.aparelho && !p.produto_id).forEach(p => {
          const prod = DB.insert('produtos', Object.assign({ tipo: 'Aparelho', quantidade: 0, custo: p.valor, preco: p.aparelho.preco || 0, disponibilidade_id: 1, data_entrada: UI.today(), fornecedor_cliente_id: v.cliente_id, origem: 'Troca na venda #' + rec.id, garantia_dias: cfg.garantia_padrao }, p.aparelho));
          NEG.movEstoque(prod.id, 1, 'Entrada', 'Aparelho na troca', rec.id, 'Recebido na venda #' + rec.id);
          p.produto_id = prod.id;
          DB.insert('nfeentrada', { pessoa_id: v.cliente_id, venda_id: rec.id, produto_id: prod.id, produtos: NEG.descProduto(prod), valor: p.valor, status: 'Pendente', data: UI.today() }, { silent: true });
        });
        DB.update('vendas', rec.id, { pagamentos: v.pagamentos }, { silent: true });
        const fin = NEG.finalizarVenda(DB.get('vendas', rec.id));
        if (v.orcamento_id) DB.update('orcamentos', v.orcamento_id, { venda_id: fin.id });
        if (v.negociacao_id) DB.update('upgrade_negociacoes', v.negociacao_id, { venda_id: fin.id, situacao: 'Convertida', valor_final: fin.total });
        FERR && FERR.webhook && FERR.webhook('Venda finalizada', fin);
        VENDAS.posVenda(fin);
      } catch (err) { console.error(err); UI.toast(err.message || String(err), 'erro'); }
    });

    renderItens(); renderPags(); syncForma();
    setTimeout(() => busca.focus(), 50);
  };

  VENDAS.posVenda = function (v) {
    const cfg = DB.cfg();
    FX.confete();
    const cli = DB.get('pessoas', v.cliente_id) || {};
    const troco = (v.pagamentos || []).reduce((s, p) => s + (p.troco || 0), 0);
    UI.modal({
      title: 'Venda #' + v.id + ' finalizada', size: 'sm',
      body: `<p>Total <b>${UI.money(v.total)}</b>${troco ? ` · troco <b>${UI.money(troco)}</b>` : ''}</p><p class="muted small">Estoque, financeiro e caixa já foram atualizados.</p>`,
      buttons: [
        { label: 'Recibo A4', cls: 'ghost', close: false, onClick: () => VENDAS.recibo(v, 'a4') },
        { label: 'Recibo 80mm', cls: 'ghost', close: false, onClick: () => VENDAS.recibo(v, '80mm') },
        ...(cli.telefone ? [{ label: 'WhatsApp', cls: 'ghost', close: false, onClick: () => VENDAS.whatsRecibo(v) }] : []),
        { label: 'Nova venda', cls: 'primary', onClick: () => { App.go('#/pdv'); App.render(); } }
      ]
    });
    if (cfg.gerar_recibo) VENDAS.recibo(v, cfg.recibo_formato || 'a4');
    if (cfg.whats_recibo && cli.telefone) VENDAS.whatsRecibo(v);
    App.go('#/c/vendas/' + v.id);
  };

  /* ---------------- visualizar venda concluída ---------------- */
  VENDAS.abrir = function (el, id) {
    const v = DB.get('vendas', id);
    if (!v) { el.innerHTML = '<div class="card empty">Venda não encontrada.</div>'; return; }
    if (v.status === 'Pré-venda') { VENDAS.pdv(el, v.id); return; }
    const cli = DB.get('pessoas', v.cliente_id) || {};
    const fins = DB.list('financeiro').filter(f => f.origem === 'Venda' && f.origem_id === v.id);
    const showCost = App.can('ver_custo');
    const com = NEG.comissao(v.vendedor_id, v.total, v.lucro, (v.itens[0] || {}).tipo);
    el.innerHTML = `${App.pageHead('Venda #' + v.id, 'Vendas > Detalhes', `
      <button class="btn ghost" data-a="a4">Recibo A4</button><button class="btn ghost" data-a="80">Recibo 80mm</button>
      ${cli.telefone ? '<button class="btn ghost" data-a="wa">WhatsApp</button>' : ''}
      ${v.status === 'Concluída' ? '<button class="btn ghost" data-a="assinar">Assinatura</button><button class="btn ghost" data-a="nf">Registrar NF</button><button class="btn ghost" data-a="troca">Devolução / troca</button><button class="btn ghost" data-a="delivery">Criar delivery</button><button class="btn danger" data-a="cancelar">Cancelar venda</button>' : ''}`)}
      <div class="kpis">
        <div class="kpi"><span>Status</span><b><span class="badge ${STATUS_BADGE[v.status] || ''}">${esc(v.status)}</span></b></div>
        <div class="kpi accent"><span>Total</span><b>${UI.money(v.total)}</b></div>
        ${showCost ? `<div class="kpi"><span>Custo</span><b>${UI.money(v.total_custo)}</b></div><div class="kpi ok"><span>Lucro</span><b>${UI.money(v.lucro)}</b><small>${UI.pct(v.total ? v.lucro / v.total * 100 : 0)} de margem</small></div><div class="kpi"><span>Comissão do vendedor</span><b>${UI.money(com.valor)}</b><small>${esc(com.modelo)} ${UI.pct(com.pct)}</small></div>` : ''}
        <div class="kpi"><span>Garantia até</span><b>${v.garantia_ate ? UI.date(v.garantia_ate) : '—'}</b></div>
      </div>
      <div class="cols-2">
        <section class="card"><h2>Dados</h2><table class="tbl"><tbody>
          <tr><td class="muted">Cliente</td><td><a href="#/c/clientes/${cli.id}">${esc(cli.nome || '')}</a> ${esc(cli.telefone || '')}</td></tr>
          <tr><td class="muted">Vendedor</td><td>${esc(vnome(v.vendedor_id))}</td></tr>
          <tr><td class="muted">Data</td><td>${UI.datetime(v.data)}</td></tr>
          <tr><td class="muted">Tipo / canal</td><td>${esc((DB.get('tiposvenda', v.tipovenda_id) || {}).nome || '')} · ${esc((DB.get('canais', v.canal_id) || {}).nome || '')}</td></tr>
          <tr><td class="muted">Entrega</td><td>${esc((DB.get('tiposentrega', v.tipoentrega_id) || {}).nome || '')}</td></tr>
          <tr><td class="muted">Observação</td><td>${esc(v.obs || '')}</td></tr>
          ${v.motivo_cancelamento ? `<tr><td class="muted">Motivo do cancelamento</td><td>${esc(v.motivo_cancelamento)}</td></tr>` : ''}
          <tr><td class="muted">Registrado por</td><td>${esc(v.created_by)} em ${UI.datetime(v.created_at)}</td></tr>
        </tbody></table>${v.assinatura ? `<p class="small muted">Assinatura do cliente:</p><img src="${v.assinatura}" alt="Assinatura" style="max-width:280px;border:1px solid var(--line)">` : ''}</section>
        <section class="card"><h2>Pagamentos e financeiro</h2><table class="tbl"><thead><tr><th>Lançamento</th><th>Vencimento</th><th class="r">Valor</th><th>Situação</th></tr></thead><tbody>
          ${fins.map(f => `<tr onclick="location.hash='#/c/receitas/${f.id}'"><td>${esc(f.titulo)}<div class="small muted">${esc(NEG.forma(f.forma_id).nome || '')}</div></td><td>${UI.date(f.vencimento)}</td><td class="r">${UI.money(f.valor)}</td><td><span class="badge ${f.situacao === 'Pago' ? 'ok' : f.situacao === 'Cancelado' ? 'danger' : 'warn'}">${esc(f.situacao)}</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sem lançamentos</td></tr>'}
        </tbody></table></section>
      </div>
      <section class="card"><h2>${FX.ic('package')}Itens</h2><table class="tbl"><thead><tr><th>Produto</th><th>Tipo</th><th class="r">Qtd</th><th class="r">Valor unit.</th><th class="r">Desconto</th><th class="r">Seguro</th><th class="r">Total</th>${showCost ? '<th class="r">Custo</th>' : ''}<th>Garantia</th></tr></thead><tbody>
        ${v.itens.map(i => `<tr${i.produto_id ? ` onclick="location.hash='#/c/produtos/${i.produto_id}'"` : ''}><td>${esc(i.descricao)}${i.imei ? `<div class="small muted">IMEI ${esc(i.imei)}</div>` : ''}${i.devolvido ? ' <span class="badge danger">devolvido</span>' : ''}</td><td>${esc(i.tipo || '')}</td><td class="r">${i.qtd}</td><td class="r">${UI.money(i.preco)}</td><td class="r">${UI.money(i.desconto)}</td><td class="r">${UI.money(i.seguro_valor)}</td><td class="r">${UI.money(i.preco * i.qtd - (i.desconto || 0) + (i.seguro_valor || 0))}</td>${showCost ? `<td class="r muted">${UI.money(i.custo * i.qtd)}</td>` : ''}<td>${i.garantia_dias ? i.garantia_dias + ' dias' : '—'}</td></tr>`).join('')}
      </tbody></table></section>`;
    const act = {
      a4: () => VENDAS.recibo(v, 'a4'), 80: () => VENDAS.recibo(v, '80mm'), wa: () => VENDAS.whatsRecibo(v),
      troca: () => VENDAS.troca(v, () => App.render()), cancelar: () => VENDAS.cancelar(v, () => App.render()),
      assinar: () => FERR.assinar(sig => { DB.update('vendas', v.id, { assinatura: sig }); App.render(); }),
      nf: () => FISCAL.registrarNF(v), delivery: () => { DB.insert('deliveries', { venda_id: v.id, rota: [cli.rua, cli.numero, cli.bairro, cli.cidade].filter(Boolean).join(', ') || 'Informar endereço', status: 'Pendente', inicio: UI.nowLocal(), cobrado: (DB.get('tiposentrega', v.tipoentrega_id) || {}).valor || 0 }); UI.toast('Delivery criado'); App.go('#/c/deliveries'); }
    };
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act[b.dataset.a]());
  };

  /* ---------------- recibo ---------------- */
  VENDAS.recibo = function (v, formato = 'a4', titulo) {
    const cfg = DB.cfg();
    const cli = DB.get('pessoas', v.cliente_id) || {};
    const termo = DB.get('termos', v.termo_id);
    const tit = titulo || (v.status === 'Cancelada' ? 'Venda CANCELADA' : 'Recibo de venda');
    const itens = v.itens.map(i => `<tr><td>${esc(i.descricao)}${i.imei ? '<br><span class="muted">IMEI ' + esc(i.imei) + '</span>' : ''}${i.garantia_dias ? '<br><span class="muted">Garantia: ' + i.garantia_dias + ' dias</span>' : ''}</td><td class="r">${i.qtd}</td><td class="r">${UI.n2(i.preco)}</td><td class="r">${UI.n2(i.preco * i.qtd - (i.desconto || 0) + (i.seguro_valor || 0))}</td></tr>`).join('');
    const pags = (v.pagamentos || []).map(p => `<tr><td>${esc(NEG.forma(p.forma_id).nome)}${p.parcelas > 1 ? ' ' + p.parcelas + 'x' : ''}${p.troco ? ' (troco ' + UI.money(p.troco) + ')' : ''}</td><td class="r">${UI.money(p.valor)}</td></tr>`).join('');
    const parcelas = DB.list('financeiro').filter(f => f.origem === 'Venda' && f.origem_id === v.id && f.parcela && f.parcela.includes('/'));
    const t = NEG.totaisVenda(v);
    const prodTermo = v.itens.find(i => i.imei) || v.itens[0] || {};
    const texto = termo ? UI.fillTemplate(termo.texto, { cliente: cli.nome || '', cpf: cli.cpf || '', produto: prodTermo.descricao || '', imei: prodTermo.imei || '', dias: termo.dias || prodTermo.garantia_dias || '', data: UI.date(v.data), loja: (DB.get('unidades', DB.unitId()) || {}).nome || '' }) : '';
    const trocas = (v.pagamentos || []).filter(p => p.aparelho);
    const termoCompra = DB.list('termos').find(x => x.tipo === 'Termo de compra');
    UI.print(`${UI.docHeader(tit + (v.id ? ' #' + v.id : ''), UI.datetime(v.data))}
      <p><b>Cliente:</b> ${esc(cli.nome || '')} ${cli.cpf ? '· CPF/CNPJ ' + esc(cli.cpf) : ''} ${cli.telefone ? '· ' + esc(cli.telefone) : ''}<br><b>Vendedor:</b> ${esc(vnome(v.vendedor_id))}</p>
      <table><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Total</th></tr>${itens}</table>
      <p class="r">${t.descontos ? 'Descontos: ' + UI.money(t.descontos) + '<br>' : ''}<span class="tot">Total: ${UI.money(v.total != null ? v.total : t.total)}</span></p>
      ${pags ? `<h2>Pagamento</h2><table>${pags}</table>` : ''}
      ${parcelas.length && cfg.recibo_parcelas !== false ? `<h2>Parcelas</h2><table><tr><th>Parcela</th><th>Vencimento</th><th class="r">Valor</th></tr>${parcelas.map(f => `<tr><td>${esc(f.parcela)}</td><td>${UI.date(f.vencimento)}</td><td class="r">${UI.money(f.valor)}</td></tr>`).join('')}</table>` : ''}
      ${v.obs ? `<p><b>Obs.:</b> ${esc(v.obs)}</p>` : ''}
      ${texto ? `<h2>${esc(termo.nome)}</h2><div class="box" style="white-space:pre-wrap">${esc(texto)}</div>` : ''}
      ${trocas.map(p => termoCompra ? `<h2>${esc(termoCompra.nome)}</h2><div class="box" style="white-space:pre-wrap">${esc(UI.fillTemplate(termoCompra.texto, { cliente: cli.nome || '', cpf: cli.cpf || '', produto: NEG.descProduto(Object.assign({ tipo: 'Aparelho' }, p.aparelho)), imei: p.aparelho.imei, data: UI.date(v.data), loja: (DB.get('unidades', DB.unitId()) || {}).nome || '' }))}</div>` : '').join('')}
      ${v.assinatura ? `<img src="${v.assinatura}" style="max-width:240px">` : `<div class="sign">${esc(cli.nome || 'Assinatura do cliente')}</div>`}
      <p class="c muted">${esc(cfg.recibo_rodape || '')}</p>`, { formato, titulo: tit });
  };
  VENDAS.whatsRecibo = function (v) {
    const cli = DB.get('pessoas', v.cliente_id) || {};
    const m = DB.list('whatsmodelos').find(x => x.tipo === 'Recibo de venda' && x.padrao);
    const txt = UI.fillTemplate(m ? m.texto : DB.cfg().msg_recibo, { cliente: (cli.nome || '').split(' ')[0], loja: (DB.get('unidades', DB.unitId()) || {}).nome, venda: v.id, total: UI.money(v.total) })
      + '\n\n' + v.itens.map(i => `• ${i.qtd}x ${i.descricao}${i.imei ? ' (IMEI ' + i.imei + ')' : ''}`).join('\n');
    UI.whats(cli.telefone, txt);
  };

  /* ---------------- cancelar ---------------- */
  VENDAS.cancelar = async function (v, cb) {
    if (!(await UI.master('cancelar_venda'))) return;
    const motivo = await UI.prompt('Cancelar venda #' + v.id, { label: 'Motivo do cancelamento (estoque e financeiro serão estornados)' });
    if (motivo == null) return;
    NEG.cancelarVenda(DB.get('vendas', v.id), motivo);
    UI.toast('Venda cancelada e estornada'); cb && cb();
  };

  /* ---------------- troca / devolução ---------------- */
  VENDAS.troca = function (v, cb) {
    v = DB.get('vendas', v.id);
    const formas = DB.list('formaspag').filter(f => ['Dinheiro', 'PIX'].includes(f.tipo));
    UI.modal({
      title: 'Devolução / troca — venda #' + v.id, size: 'md',
      body: `<p class="small muted">Marque os itens que voltaram. Itens danificados entram no estoque como "Em manutenção".</p>
        <table class="tbl"><thead><tr><th></th><th>Item</th><th class="r">Qtd</th><th class="r">Valor</th></tr></thead><tbody>
        ${v.itens.map((i, k) => `<tr><td><input type="checkbox" data-k="${k}"${i.devolvido ? ' disabled' : ''}></td><td>${esc(i.descricao)}${i.devolvido ? ' <span class="badge danger">já devolvido</span>' : ''}</td><td class="r"><input class="inline-inp" style="width:56px" type="number" min="1" max="${i.qtd}" value="${i.qtd}" data-q="${k}"></td><td class="r">${UI.money((i.preco * i.qtd - (i.desconto || 0)))}</td></tr>`).join('')}
        </tbody></table>
        <div class="grid-form" style="grid-template-columns:1fr 1fr;margin-top:12px">
          <label class="fld"><span>Produto danificado?</span><select data-dan><option value="0">Não</option><option value="1">Sim</option></select></label>
          <label class="fld"><span>O que fazer com o valor</span><select data-res><option value="credito">Gerar crédito para o cliente</option><option value="troca">Crédito e abrir nova venda (troca)</option><option value="dinheiro">Devolver o dinheiro</option></select></label>
          <label class="fld" data-fw hidden><span>Devolver por</span><select data-forma>${formas.map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select></label>
          <label class="fld w2"><span>Motivo</span><input data-motivo></label>
        </div><p class="tot" data-tot></p>`,
      onOpen: ({ body }) => {
        const upd = () => {
          let tot = 0;
          body.querySelectorAll('[data-k]:checked').forEach(c => { const i = v.itens[c.dataset.k]; const q = Math.min(i.qtd, Number(body.querySelector(`[data-q="${c.dataset.k}"]`).value) || 1); tot += (i.preco - (i.desconto || 0) / i.qtd) * q; });
          body.querySelector('[data-tot]').textContent = 'Valor da devolução: ' + UI.money(tot);
          body.querySelector('[data-fw]').hidden = body.querySelector('[data-res]').value !== 'dinheiro';
          return r2(tot);
        };
        body.addEventListener('change', upd); body.addEventListener('input', upd); upd();
        body._upd = upd;
      },
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Confirmar devolução', cls: 'primary', onClick: ({ body }) => {
        const sel = [...body.querySelectorAll('[data-k]:checked')];
        if (!sel.length) { UI.toast('Marque ao menos um item', 'erro'); return false; }
        const valor = body._upd();
        const dan = body.querySelector('[data-dan]').value === '1';
        const res = body.querySelector('[data-res]').value;
        const motivo = body.querySelector('[data-motivo]').value;
        const manut = DB.list('disponibilidades').find(d => d.nome === 'Em manutenção');
        const itens = v.itens.map(x => Object.assign({}, x));
        const nomes = []; let custoDev = 0;
        sel.forEach(c => {
          const i = itens[c.dataset.k]; const q = Math.min(i.qtd, Number(body.querySelector(`[data-q="${c.dataset.k}"]`).value) || 1); custoDev += (i.custo || 0) * q;
          if (i.produto_id) { NEG.movEstoque(i.produto_id, q, 'Entrada', 'Devolução', v.id, motivo); if (dan && manut) DB.update('produtos', i.produto_id, { disponibilidade_id: manut.id }); }
          i.devolvido = true; i.qtd_devolvida = q; nomes.push(q + 'x ' + i.descricao);
        });
        DB.update('vendas', v.id, { itens, total: r2(v.total - valor), total_custo: r2((v.total_custo || 0) - custoDev), lucro: r2((v.lucro || 0) - (valor - custoDev)), devolvido_valor: r2((v.devolvido_valor || 0) + valor) });
        let resultado = '';
        if (res === 'dinheiro') {
          const fid = Number(body.querySelector('[data-forma]').value);
          const cat = NEG.categoria('devolucao', 'Devoluções e estornos', 'Despesa', 'Devoluções');
          const d = NEG.lancar({ tipo: 'D', titulo: `Devolução venda #${v.id}`, pessoa_id: v.cliente_id, valor, vencimento: UI.today(), categoria_id: cat, origem: 'Devolução', origem_id: v.id });
          NEG.baixar(d.id, { forma_id: fid, valor, data: UI.today() });
          resultado = 'Dinheiro devolvido';
        } else {
          NEG.movCredito(v.cliente_id, valor, 'Devolução', 'venda', v.id);
          resultado = 'Crédito gerado';
        }
        DB.insert('trocas', { venda_id: v.id, cliente_id: v.cliente_id, devolvidos: nomes.join(', '), valor_anterior: v.total, valor_posterior: r2(v.total - valor), diferenca: -valor, resultado, danificado: dan, motivo });
        UI.toast(resultado + ': ' + UI.money(valor));
        if (res === 'troca') App.go('#/pdv?cliente=' + v.cliente_id); else cb && cb();
      } }]
    });
  };

  VENDAS.lancarCredito = function (pessoa_id, cb) { CRUD.quickForm('creditos', { pessoa_id, motivo: 'Pagamento antecipado', status: 'Ativo' }, () => cb && cb()); };

  /* ---------------- garantias ---------------- */
  App.route('/garantias', el => {
    const hoje = UI.today();
    const vendas = DB.list('vendas').filter(v => v.status === 'Concluída' && v.garantia_ate);
    const os = DB.list('os').filter(o => o.garantia_ate);
    const prods = [];
    vendas.forEach(v => v.itens.forEach(i => { if (i.garantia_dias) prods.push({ v, i, ate: UI.addDays(v.data, i.garantia_dias) }); }));
    const tab = (lst, kind) => `<table class="tbl"><thead><tr><th>Id</th><th>Cliente</th><th>Finalização</th><th>Produto(s)</th><th>Vencimento</th><th class="r">Dias restantes</th></tr></thead><tbody>
      ${lst.length ? lst.map(x => `<tr onclick="location.hash='${kind === 'os' ? '#/os/' : '#/c/vendas/'}${x.id}'"><td>#${x.id}</td><td>${esc(pnome(x.cliente_id))}</td><td>${UI.date(x.fim)}</td><td>${esc(x.prod)}</td><td>${UI.date(x.ate)}</td><td class="r ${UI.daysBetween(hoje, x.ate) < 0 ? 'neg' : ''}">${UI.daysBetween(hoje, x.ate)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Nada aqui.</td></tr>'}</tbody></table>`;
    const V = vendas.map(v => ({ id: v.id, cliente_id: v.cliente_id, fim: v.data, ate: v.garantia_ate, prod: v.itens.map(i => i.descricao).join(', ') }));
    const O = os.map(o => ({ id: o.id, cliente_id: o.cliente_id, fim: o.data_finalizacao, ate: o.garantia_ate, prod: (o.aparelhos || []).map(a => a.descricao).join(', ') }));
    const P = prods.map(x => ({ id: x.v.id, cliente_id: x.v.cliente_id, fim: x.v.data, ate: x.ate, prod: x.i.descricao }));
    const on = l => l.filter(x => x.ate >= hoje), off = l => l.filter(x => x.ate < hoje);
    const panes = [['Vendas em garantia', on(V), 'v'], ['OS em garantia', on(O), 'os'], ['Vendas expiradas', off(V), 'v'], ['OS expiradas', off(O), 'os'], ['Produtos em garantia', on(P), 'v'], ['Produtos expirados', off(P), 'v']];
    el.innerHTML = App.pageHead('Monitoramento de garantias', 'Vendas') + `<div class="card"><div class="tabs">${panes.map((p, i) => `<button class="tab${i ? '' : ' on'}" data-tab="${i}">${p[0]} (${p[1].length})</button>`).join('')}</div>
      ${panes.map((p, i) => `<div class="tabpane${i ? '' : ' on'}" data-pane="${i}"><div class="table-wrap">${tab(p[1].sort((a, b) => a.ate.localeCompare(b.ate)), p[2])}</div></div>`).join('')}</div>`;
    FORM.bindTabs(el);
  });

  /* ---------------- simulador de taxa ---------------- */
  VENDAS.simuladorTaxa = function (valorIni) {
    const formas = DB.list('formaspag').filter(f => ['Crédito', 'Débito', 'Boleto', 'PIX'].includes(f.tipo));
    UI.modal({
      title: 'Simulador de taxas de cartão', size: 'md',
      body: `<div class="row-form"><label class="fld"><span>Valor (R$)</span><input class="inp" type="number" step="0.01" data-v value="${valorIni || ''}"></label>
        <label class="fld"><span>Forma de pagamento</span><select class="inp" data-f>${formas.map(f => `<option value="${f.id}"${f.tipo === 'Crédito' ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label></div>
        <div class="table-wrap" style="margin-top:12px" data-out></div><p class="small muted">"Cobrar do cliente" é o valor que repassa a taxa para você receber o valor cheio.</p>`,
      onOpen: ({ body }) => {
        const calc = () => {
          const val = Number(body.querySelector('[data-v]').value) || 0; const f = NEG.forma(Number(body.querySelector('[data-f]').value));
          const n = Math.max(1, Number(f.max_parcelas) || 1);
          body.querySelector('[data-out]').innerHTML = `<table class="tbl"><thead><tr><th>Parcelas</th><th class="r">Taxa</th><th class="r">Você recebe</th><th class="r">Cobrar do cliente</th><th class="r">Parcela</th></tr></thead><tbody>
            ${Array.from({ length: n }, (_, i) => { const tx = NEG.taxa(f.id, i + 1, 100); const rec = val * (1 - tx / 100); const cob = tx < 100 ? val / (1 - tx / 100) : val; return `<tr><td>${i + 1}x</td><td class="r">${UI.pct(tx)}</td><td class="r">${UI.money(rec)}</td><td class="r"><b>${UI.money(cob)}</b></td><td class="r">${UI.money(cob / (i + 1))}</td></tr>`; }).join('')}</tbody></table>`;
        };
        body.addEventListener('input', calc); body.addEventListener('change', calc); calc();
      }
    });
  };
  App.route('/simulador-taxa', el => { el.innerHTML = App.pageHead('Simulador de taxa de cartão', 'Vendas') + '<div class="card empty">O simulador abriu em uma janela.</div>'; VENDAS.simuladorTaxa(); });
})();
