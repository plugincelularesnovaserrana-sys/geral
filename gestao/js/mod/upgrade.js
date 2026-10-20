/* =====================================================================
   UPGRADE: proposta de troca, negociações, relações de valores
   ===================================================================== */
(function () {
  const r2 = UI.round2;
  const DEFEITOS = [['d_auricular', 'Auricular'], ['d_tampa', 'Tampa traseira'], ['d_altofalante', 'Alto-falante'], ['d_vibracal', 'Vibracal'], ['d_camtras', 'Câmera traseira'],
    ['d_camfront', 'Câmera frontal'], ['d_faceid', 'Face ID / biometria'], ['d_bateria', 'Bateria'], ['d_tela', 'Tela'], ['d_marcas', 'Marcas e detalhes']];
  const nomeModelo = id => (DB.get('modelos', id) || {}).nome || '';
  const nomeGb = id => (DB.get('gbs', id) || {}).nome || '';
  const relacao = (modelo_id, gb_id) => DB.list('upgrade_relacoes').find(r => r.modelo_id === Number(modelo_id) && (!r.gb_id || r.gb_id === Number(gb_id)));

  CRUD.register('upgrade_relacoes', {
    col: 'upgrade_relacoes', title: 'Configurações de upgrade', single: 'Relação de valores', crumb: 'Vendas > Upgrade', newLabel: 'Cadastrar relação',
    intro: 'Para cada modelo e armazenamento, defina quanto a loja paga no mínimo e no máximo pelo aparelho usado e quanto desconta por defeito.',
    fields: [{ k: 'modelo_id', label: 'Modelo', ref: 'modelos', req: true, w: 2 }, { k: 'gb_id', label: 'Armazenamento', ref: 'gbs' },
      { k: 'minimo', label: 'Valor mínimo de compra (R$)', type: 'money', req: true }, { k: 'maximo', label: 'Valor máximo de compra (R$)', type: 'money', req: true },
      { k: '', label: 'Desconto por defeito (R$)', type: 'section' }, ...DEFEITOS.map(([k, l]) => ({ k, label: l, type: 'money' }))],
    cols: [{ label: 'Aparelho', get: r => nomeModelo(r.modelo_id), sortv: r => nomeModelo(r.modelo_id) }, { label: 'GB', get: r => nomeGb(r.gb_id) },
      ...DEFEITOS.map(([k, l]) => ({ k, label: l, fmt: 'money', optional: !['d_tela', 'd_bateria', 'd_faceid'].includes(k) })),
      { k: 'minimo', label: 'Mínimo', fmt: 'money' }, { k: 'maximo', label: 'Máximo', fmt: 'money' }],
    tools: [{ label: 'Operações em massa', fn: async re => {
      const pct = await UI.prompt('Reajustar todos os valores', { type: 'number', label: 'Percentual (ex.: -5 para baixar 5%, 3 para subir 3%)' });
      if (pct == null || pct === '') return;
      const f = 1 + Number(pct) / 100;
      DB.list('upgrade_relacoes').forEach(r => { const p = { minimo: r2(r.minimo * f), maximo: r2(r.maximo * f) }; DB.update('upgrade_relacoes', r.id, p, { silent: true }); });
      UI.toast('Valores reajustados'); re();
    } }, { label: 'Calculadora', fn: () => App.go('#/upgrade/novo') }]
  });

  CRUD.register('upgrade_negociacoes', {
    col: 'upgrade_negociacoes', title: 'Negociações de upgrade', single: 'Negociação', crumb: 'Vendas > Upgrade', newLabel: 'Iniciar upgrade',
    onNew: () => App.go('#/upgrade/novo'), customForm: (el, id) => UPG.form(el, id === 'novo' ? null : id),
    cols: [{ label: 'Cliente / lead', get: r => (DB.get('pessoas', r.cliente_id) || {}).nome || r.lead || '' }, { k: 'venda_id', label: 'Venda', get: r => r.venda_id ? '#' + r.venda_id : '' },
      { label: 'Aparelho recebido', get: r => `${nomeModelo(r.troca_modelo_id)} ${nomeGb(r.troca_gb_id)}` }, { k: 'desejado', label: 'Aparelho desejado' },
      { k: 'minimo', label: 'Mínimo', fmt: 'money' }, { k: 'maximo', label: 'Máximo', fmt: 'money' }, { k: 'avaliado', label: 'Avaliado', fmt: 'money' },
      { k: 'valor_final', label: 'Venda realizada', fmt: 'money' }, { k: 'comissao_upgrade', label: 'Comissão do upgrade', fmt: 'money', perm: 'ver_custo' },
      { k: 'spread', label: 'Spread', fmt: 'money', perm: 'ver_custo' }, { k: 'situacao', label: 'Situação', badge: r => ({ Convertida: 'ok', Perdida: 'danger' }[r.situacao] || 'warn') },
      { k: 'created_at', label: 'Criado em', fmt: 'date' }],
    filters: [{ k: 'situacao', label: 'Situação', opts: ['Em aberto', 'Convertida', 'Perdida'] }, { k: 'created_at', label: 'Período', type: 'daterange' }],
    indicators: rows => [{ l: 'Propostas', v: rows.length }, { l: 'Convertidas', v: rows.filter(r => r.situacao === 'Convertida').length, cls: 'ok' },
      { l: 'Conversão', v: UI.pct(rows.length ? rows.filter(r => r.situacao === 'Convertida').length / rows.length * 100 : 0), cls: 'accent' }],
    actions: [{ label: 'Gerar venda', show: r => !r.venda_id, fn: r => UPG.gerarVenda(r) }, { label: 'Marcar como perdida', show: r => r.situacao === 'Em aberto', fn: (r, re) => { DB.update('upgrade_negociacoes', r.id, { situacao: 'Perdida' }); re(); } },
      { label: 'Enviar proposta por WhatsApp', fn: r => UPG.whats(r) }]
  });

  const UPG = window.UPG = {};

  App.route('/upgrade', el => {
    el.innerHTML = App.pageHead('Simulador de upgrade', 'Vendas > Upgrade') + `<p class="intro">O que você quer fazer agora?</p>
      <div class="tiles">
        <a class="tile" href="#/upgrade/novo"><h3>Iniciar upgrade</h3><p>Monte uma proposta de troca: aparelho desejado, avaliação do usado e parcelas da diferença.</p></a>
        <a class="tile" href="#/c/upgrade_negociacoes"><h3>Ver negociações</h3><p>Acompanhe propostas, conversões e comissões.</p></a>
        <a class="tile" href="#/c/upgrade_relacoes"><h3>Configurações de upgrade</h3><p>Valores mínimo e máximo por modelo e desconto por defeito.</p></a>
        <a class="tile" href="#/upgrade/quanto-vale"><h3>Quanto vale?</h3><p>Consulte rapidamente a faixa de valor de um aparelho usado.</p></a>
      </div>`;
  });
  App.route('/upgrade/novo', el => UPG.form(el, null));
  App.route('/upgrade/quanto-vale', el => {
    el.innerHTML = App.pageHead('Quanto vale?', 'Vendas > Upgrade') + `<div class="card"><div class="row-form">
      <label class="fld"><span>Modelo</span>${FORM.input({ k: 'm', ref: 'modelos' }, '')}</label><label class="fld"><span>Armazenamento</span>${FORM.input({ k: 'g', ref: 'gbs' }, '')}</label></div><div data-out style="margin-top:14px"></div></div>`;
    const out = el.querySelector('[data-out]');
    const calc = () => {
      const r = relacao(el.querySelector('[name=m]').value, el.querySelector('[name=g]').value);
      const vendidos = DB.list('vendas').filter(v => v.status === 'Concluída').flatMap(v => v.itens).filter(i => { const p = DB.get('produtos', i.produto_id); return p && p.modelo_id === Number(el.querySelector('[name=m]').value); });
      const media = vendidos.length ? vendidos.reduce((s, i) => s + i.preco, 0) / vendidos.length : 0;
      out.innerHTML = r ? `<div class="kpis"><div class="kpi"><span>Paga no mínimo</span><b>${UI.money(r.minimo)}</b></div><div class="kpi accent"><span>Paga no máximo</span><b>${UI.money(r.maximo)}</b></div>
        <div class="kpi"><span>Preço médio de venda na loja</span><b>${media ? UI.money(media) : '—'}</b><small>${vendidos.length} venda(s)</small></div></div>`
        : '<p class="muted">Sem relação cadastrada para este modelo. Cadastre em Configurações de upgrade.</p>';
    };
    el.addEventListener('change', calc);
  });

  UPG.form = function (el, id) {
    const n = id ? JSON.parse(JSON.stringify(DB.get('upgrade_negociacoes', id))) : { situacao: 'Em aberto', validade: UI.addDays(UI.today(), 3), defeitos: {}, outros: 0, desconto: 0, parcelas: 1 };
    const aparelhosEstoque = DB.list('produtos').filter(p => p.tipo === 'Aparelho' && p.quantidade > 0);
    const formas = DB.list('formaspag').filter(f => f.ativo !== false && !['Aparelho na troca', 'Crédito do cliente'].includes(f.tipo));
    el.innerHTML = App.pageHead(id ? 'Negociação #' + id : 'Simulador de upgrade', 'Vendas > Upgrade', `<a class="btn ghost" href="#/c/upgrade_negociacoes">Negociações</a>`) + `
      <div class="pdv"><div>
        <section class="card"><h2>Negociação</h2><div class="grid-form">
          <label class="fld w2"><span>Cliente (opcional)</span>${FORM.input({ k: 'cliente_id', ref: { col: 'pessoas', filter: r => r.cliente } }, n.cliente_id)}</label>
          <label class="fld"><span>Ou nome do lead</span><input name="lead" value="${esc(n.lead || '')}"></label>
          <label class="fld req"><span>Validade da proposta</span><input type="date" name="validade" value="${esc(n.validade || '')}"></label></div></section>
        <section class="card"><h2>Aparelho desejado</h2><p class="small muted">Escolha um aparelho do estoque ou descreva um modelo.</p><div class="grid-form">
          <label class="fld w2"><span>Do estoque</span><select name="produto_id"><option value="">— descrever manualmente —</option>${aparelhosEstoque.map(p => `<option value="${p.id}"${p.id === n.produto_id ? ' selected' : ''}>${esc(NEG.descProduto(p))} · ${UI.money(p.preco)}</option>`).join('')}</select></label>
          <label class="fld w2"><span>Descrição</span><input name="desejado" value="${esc(n.desejado || '')}"></label>
          <label class="fld"><span>Valor (R$)</span><input type="number" step="0.01" name="valor_desejado" value="${n.valor_desejado || ''}"></label>
          <label class="fld"><span>Desconto (R$)</span><input type="number" step="0.01" name="desconto" value="${n.desconto || 0}"></label>
          <div class="fld"><span>Valor final</span><output class="calc" data-o="final"></output></div></div></section>
        <section class="card"><h2>Aparelho de troca</h2><p class="small muted">A relação cadastrada traz o valor mínimo e máximo; cada defeito marcado desconta do máximo.</p><div class="grid-form">
          <label class="fld w2 req"><span>Modelo</span>${FORM.input({ k: 'troca_modelo_id', ref: 'modelos' }, n.troca_modelo_id)}</label>
          <label class="fld req"><span>Armazenamento</span>${FORM.input({ k: 'troca_gb_id', ref: 'gbs' }, n.troca_gb_id)}</label>
          <label class="fld"><span>IMEI</span><input name="troca_imei" value="${esc(n.troca_imei || '')}"></label>
          <div class="fld"><span>Valor mínimo</span><output class="calc" data-o="min"></output></div><div class="fld"><span>Valor máximo</span><output class="calc" data-o="max"></output></div></div>
          <h3 class="form-sec" style="margin-top:14px">Tem defeito em:</h3>
          <div class="check-grid">${DEFEITOS.map(([k, l]) => `<label class="chk"><input type="checkbox" data-def="${k}"${n.defeitos[k] ? ' checked' : ''}> ${l} <span class="small muted" data-dv="${k}"></span></label>`).join('')}</div>
          <div class="grid-form" style="margin-top:12px"><label class="fld"><span>Outros descontos (R$)</span><input type="number" step="0.01" name="outros" value="${n.outros || 0}"></label>
          <label class="fld"><span>Valor avaliado / negociado (R$)</span><input type="number" step="0.01" name="avaliado_manual" value="${n.avaliado_manual || ''}" placeholder="automático"></label></div></section>
        <section class="card"><h2>Pagamento da diferença</h2><div class="row-form">
          <label class="fld"><span>Forma de pagamento</span><select class="inp" name="forma_id">${formas.map(f => `<option value="${f.id}"${f.id === n.forma_id ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
          <label class="fld" style="max-width:120px"><span>Parcelas</span><select class="inp" name="parcelas"></select></label>
          <label class="fld"><span>Repassar taxa ao cliente?</span><select class="inp" name="repassar"><option value="1">Sim</option><option value="0"${n.repassar === false ? ' selected' : ''}>Não</option></select></label></div>
          <div class="table-wrap" style="margin-top:10px" data-tabpar></div></section>
      </div>
      <aside class="pdv-totals">
        <div class="line"><span>Final desejado</span><b data-s="final"></b></div><div class="line"><span>Valor mínimo</span><b data-s="min"></b></div>
        <div class="line"><span>Valor máximo</span><b data-s="max"></b></div><div class="line"><span>Descontos por defeito</span><b data-s="desc"></b></div>
        ${App.can('ver_custo') ? '<div class="line"><span>Spread (máximo − avaliado)</span><b data-s="spread"></b></div><div class="line"><span>Comissão do upgrade</span><b data-s="com"></b></div>' : ''}
        <div class="line"><span>Avaliado</span><b data-s="aval"></b></div>
        <div class="saldo"><span>Cliente paga a diferença</span><strong data-s="dif"></strong><span class="small" data-s="parc"></span></div>
        <button class="btn primary block" data-save>Salvar proposta</button><button class="btn ok block" data-venda>Gerar venda</button><button class="btn block" data-wa>Enviar por WhatsApp</button>
      </aside></div>`;
    const $ = s => el.querySelector(s);
    const val = k => { const x = el.querySelector(`[name=${k}]`); return x ? x.value : ''; };
    const syncParc = () => { const f = NEG.forma(Number(val('forma_id'))); const m = Math.max(1, f.max_parcelas || 1); $('[name=parcelas]').innerHTML = Array.from({ length: m }, (_, i) => `<option${i + 1 === Number(n.parcelas) ? ' selected' : ''}>${i + 1}</option>`).join(''); };
    syncParc();
    const read = () => {
      const p = DB.get('produtos', val('produto_id'));
      Object.assign(n, { cliente_id: Number(val('cliente_id')) || null, lead: val('lead'), validade: val('validade'), produto_id: p ? p.id : null,
        desejado: p ? NEG.descProduto(p) : val('desejado'), valor_desejado: p && !Number(val('valor_desejado')) ? p.preco : Number(val('valor_desejado')) || 0, desconto: Number(val('desconto')) || 0,
        troca_modelo_id: Number(val('troca_modelo_id')) || null, troca_gb_id: Number(val('troca_gb_id')) || null, troca_imei: val('troca_imei'), outros: Number(val('outros')) || 0,
        avaliado_manual: val('avaliado_manual') === '' ? null : Number(val('avaliado_manual')), forma_id: Number(val('forma_id')), parcelas: Number(val('parcelas')) || 1, repassar: val('repassar') === '1', defeitos: {} });
      el.querySelectorAll('[data-def]').forEach(c => { n.defeitos[c.dataset.def] = c.checked; });
      const r = relacao(n.troca_modelo_id, n.troca_gb_id) || {};
      n.minimo = r.minimo || 0; n.maximo = r.maximo || 0;
      n.desc_defeitos = r2(DEFEITOS.reduce((s, [k]) => s + (n.defeitos[k] ? Number(r[k]) || 0 : 0), 0));
      const auto = Math.max(n.minimo ? 0 : 0, r2(n.maximo - n.desc_defeitos - n.outros));
      n.avaliado = n.avaliado_manual != null ? n.avaliado_manual : auto;
      n.valor_final = r2(n.valor_desejado - n.desconto);
      n.diferenca = r2(Math.max(0, n.valor_final - n.avaliado));
      n.spread = r2(n.maximo - n.avaliado);
      n.comissao_upgrade = r2(Math.max(0, n.spread) * (Number(DB.cfg().upgrade_comissao_pct) || 0) / 100);
      el.querySelectorAll('[data-dv]').forEach(s => s.textContent = r[s.dataset.dv] ? '−' + UI.money(r[s.dataset.dv]) : '');
      return r;
    };
    const render = () => {
      const r = read();
      if (val('produto_id') && !el.querySelector('[name=valor_desejado]').value) el.querySelector('[name=valor_desejado]').value = n.valor_desejado;
      const set = (k, v) => el.querySelectorAll(`[data-o="${k}"],[data-s="${k}"]`).forEach(x => x.textContent = v);
      set('final', UI.money(n.valor_final)); set('min', UI.money(n.minimo)); set('max', UI.money(n.maximo)); set('desc', UI.money(n.desc_defeitos));
      set('spread', UI.money(n.spread)); set('com', UI.money(n.comissao_upgrade)); set('aval', UI.money(n.avaliado)); set('dif', UI.money(n.diferenca));
      const f = NEG.forma(n.forma_id); const tx = NEG.taxa(f.id, n.parcelas, 100);
      const cobrar = n.repassar && tx < 100 ? n.diferenca / (1 - tx / 100) : n.diferenca;
      n.valor_cobrado = r2(cobrar);
      set('parc', n.parcelas > 1 ? `${n.parcelas}x de ${UI.money(cobrar / n.parcelas)}${n.repassar && tx ? ' (com taxa)' : ''}` : (n.repassar && tx ? 'com taxa: ' + UI.money(cobrar) : ''));
      if (!r.id && n.troca_modelo_id) set('max', 'sem relação');
      if (n.avaliado < n.minimo && n.minimo) set('aval', UI.money(n.avaliado) + ' (abaixo do mínimo)');
      const mx = Math.max(1, f.max_parcelas || 1);
      $('[data-tabpar]').innerHTML = `<table class="tbl"><thead><tr><th>Parcelas</th><th class="r">Total</th><th class="r">Parcela</th></tr></thead><tbody>${Array.from({ length: Math.min(mx, 12) }, (_, i) => { const t = NEG.taxa(f.id, i + 1, 100); const c = n.repassar && t < 100 ? n.diferenca / (1 - t / 100) : n.diferenca; return `<tr${i + 1 === n.parcelas ? ' style="font-weight:700"' : ''}><td>${i + 1}x</td><td class="r">${UI.money(c)}</td><td class="r">${UI.money(c / (i + 1))}</td></tr>`; }).join('')}</tbody></table>`;
    };
    el.addEventListener('input', render); el.addEventListener('change', e => { if (e.target.name === 'forma_id') syncParc(); if (e.target.name === 'produto_id') el.querySelector('[name=valor_desejado]').value = ''; render(); });
    render();
    const save = () => {
      render();
      if (!n.troca_modelo_id || !n.validade) { UI.toast('Informe o modelo do aparelho de troca e a validade', 'erro'); return null; }
      if (n.id) DB.update('upgrade_negociacoes', n.id, n); else Object.assign(n, DB.insert('upgrade_negociacoes', n));
      return n;
    };
    $('[data-save]').onclick = () => { if (save()) { UI.toast('Proposta salva'); App.go('#/c/upgrade_negociacoes'); } };
    $('[data-venda]').onclick = () => { const s = save(); if (s) UPG.gerarVenda(s); };
    $('[data-wa]').onclick = () => { const s = save(); if (s) UPG.whats(s); };
  };

  UPG.whats = function (n) {
    const c = DB.get('pessoas', n.cliente_id) || {};
    UI.whats(c.telefone || '', `Olá ${c.nome || n.lead || ''}! Segue a proposta de upgrade:\n• Aparelho: ${n.desejado} — ${UI.money(n.valor_final)}\n• Seu ${nomeModelo(n.troca_modelo_id)} ${nomeGb(n.troca_gb_id)} avaliado em ${UI.money(n.avaliado)}\n• Diferença: ${UI.money(n.diferenca)}${n.parcelas > 1 ? ` ou ${n.parcelas}x de ${UI.money(n.valor_cobrado / n.parcelas)}` : ''}\nProposta válida até ${UI.date(n.validade)}.`);
  };
  UPG.gerarVenda = function (n) {
    const forma = DB.list('formaspag').find(f => f.tipo === 'Aparelho na troca');
    DB.setMeta({ pdv_preset: { cliente_id: n.cliente_id, produto_id: n.produto_id, desejado: n.produto_id ? null : { descricao: n.desejado, preco: n.valor_final }, desconto: n.desconto, negociacao_id: n.id,
      tipovenda: (DB.list('tiposvenda').find(t => t.nome === 'Upgrade') || {}).id,
      troca: forma && n.avaliado > 0 ? { forma_id: forma.id, valor: n.avaliado, parcelas: 1, taxa: 0, data: UI.today(), detalhe: 'IMEI ' + (n.troca_imei || ''),
        aparelho: { modelo_id: n.troca_modelo_id, gb_id: n.troca_gb_id, estado_id: (DB.list('estados').find(e => e.nome === 'Seminovo') || {}).id, imei: n.troca_imei || ('SEM-IMEI-' + n.id) } } : null,
      dif: { forma_id: n.forma_id, valor: n.repassar ? n.valor_cobrado : n.diferenca, parcelas: n.parcelas } } });
    App.go('#/pdv');
  };
})();
