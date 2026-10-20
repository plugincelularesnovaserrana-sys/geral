/* =====================================================================
   ORDEM DE SERVIÇO: formulário, kanban, dashboard, impressão
   ===================================================================== */
(function () {
  const r2 = UI.round2;
  const nome = (col, id) => (DB.get(col, id) || {}).nome || '';
  const sit = id => DB.get('situacoesos', id) || {};
  const OS = window.OS = {};
  const sitBadge = r => { const s = sit(r.situacao_id); return `<span class="badge" style="background:${esc(s.cor || '#888')}22;color:${esc(s.cor || '#555')};border-color:transparent">${esc(s.nome || '')}</span>`; };

  CRUD.register('os', {
    col: 'os', title: 'Ordens de serviço', single: 'OS', crumb: 'Ordem de serviço > Listagem', newLabel: 'Nova ordem de serviço', perm: 'os',
    onNew: () => App.go('#/os/novo'), customForm: (el, id) => OS.form(el, id === 'novo' ? null : id),
    cols: [{ k: 'id', label: 'Cód. OS' }, { label: 'Situação', html: sitBadge, get: r => sit(r.situacao_id).nome || '' }, { k: 'created_at', label: 'Criação', fmt: 'date' },
      { k: 'previsao', label: 'Previsão', fmt: 'date' }, { k: 'data_finalizacao', label: 'Finalização', fmt: 'date', optional: true }, { label: 'Cliente', get: r => nome('pessoas', r.cliente_id) },
      { label: 'Aparelho', get: r => (r.aparelhos || []).map(a => a.descricao).join(', ') }, { label: 'Serviços', get: r => (r.servicos || []).map(s => s.descricao).join(', '), optional: true },
      { label: 'Técnico', get: r => nome('pessoas', r.tecnico_id) }, { label: 'Prioridade', get: r => nome('prioridades', r.prioridade_id), optional: true },
      { label: 'Total', get: r => UI.money(NEG.totaisOS(r).total), sortv: r => NEG.totaisOS(r).total, align: 'r' }, { label: 'Lucro', get: r => UI.money(NEG.totaisOS(r).lucro), perm: 'ver_custo', optional: true, align: 'r' }],
    filters: [{ k: 'situacao_id', label: 'Situação', ref: 'situacoesos' }, { k: 'tecnico_id', label: 'Técnico', ref: { col: 'pessoas', filter: r => r.tecnico } },
      { k: 'prioridade_id', label: 'Prioridade', ref: 'prioridades' }, { k: 'created_at', label: 'Período', type: 'daterange' }],
    search: ['relato', 'laudo'],
    rowClass: r => { const s = sit(r.situacao_id); return s.finalidade !== 'Finalizada' && s.finalidade !== 'Cancelada' && r.previsao && r.previsao < UI.today() ? 'row-danger' : ''; },
    indicators: rows => {
      const ab = rows.filter(r => !['Finalizada', 'Cancelada'].includes(sit(r.situacao_id).finalidade));
      return [{ l: 'Em aberto', v: ab.length }, { l: 'Vencidas', v: ab.filter(r => r.previsao && r.previsao < UI.today()).length, cls: 'danger' }, { l: 'Para hoje', v: ab.filter(r => r.previsao === UI.today()).length, cls: 'warn' },
        { l: 'Finalizadas', v: rows.filter(r => sit(r.situacao_id).finalidade === 'Finalizada').length, cls: 'ok' }];
    },
    actions: [{ label: 'Alterar situação', fn: (r, re) => OS.mudarSituacao(r, re) }, { label: 'Imprimir A4', fn: r => OS.imprimir(r, 'a4') }, { label: 'Imprimir A4 (2 vias)', fn: r => OS.imprimir(r, 'a4', true) },
      { label: 'Imprimir 80mm', fn: r => OS.imprimir(r, '80mm') }, { label: 'Enviar por WhatsApp', fn: r => OS.whats(r) }, { label: 'Etiqueta do aparelho', fn: r => OS.etiqueta(r) }],
    tools: [{ label: 'Kanban', fn: () => App.go('#/os/kanban') }, { label: 'Dashboard', fn: () => App.go('#/os/dashboard') }]
  });
  App.route('/os/novo', el => OS.form(el, null));
  App.route('/os/kanban', el => OS.kanban(el));
  App.route('/os/dashboard', el => OS.dashboard(el));
  App.route('/os/:id', (el, p) => OS.form(el, p.id));

  OS.form = function (el, id) {
    const cfg = DB.cfg();
    const pr0 = DB.list('prioridades')[0] || {};
    const o = id ? JSON.parse(JSON.stringify(DB.get('os', id))) : {
      cliente_id: null, vendedor_id: (DB.user() || {}).vendedor_id, situacao_id: cfg.os_situacao_padrao || (DB.list('situacoesos').sort((a, b) => (a.ordem || 0) - (b.ordem || 0))[0] || {}).id,
      prioridade_id: pr0.id, previsao: UI.addDays(UI.today(), pr0.dias || 3), termo_entrada_id: (DB.list('termos').find(t => t.tipo === 'Entrada de OS') || {}).id,
      termo_saida_id: (DB.list('termos').find(t => t.tipo === 'Saída de OS') || {}).id, tipo_id: (DB.list('tiposos')[0] || {}).id, canal_id: (DB.list('canais')[0] || {}).id,
      aparelhos: [{}], servicos: [], pecas: [], pagamentos: [], checklist: {}, anexos: [], entregue: false, desconto: 0
    };
    if (!o.id) o.created_at_local = UI.nowLocal();
    const fin = sit(o.situacao_id).finalidade;
    const travado = !!o.financeiro_gerado;
    const showCost = App.can('ver_custo') && !cfg.os_bloquear_custo_vendedor || App.can('tudo');
    const extras = DB.list('camposextras').filter(c => c.tela === 'Ordem de serviço');
    const geral = [
      { k: 'cliente_id', label: 'Cliente', ref: { col: 'pessoas', filter: r => r.cliente }, req: true, w: 2 }, { k: 'vendedor_id', label: 'Vendedor', ref: 'vendedores' },
      { k: 'tecnico_id', label: 'Técnico', ref: { col: 'pessoas', filter: r => r.tecnico } }, { k: 'prioridade_id', label: 'Prioridade', ref: 'prioridades' },
      { k: 'situacao_id', label: 'Situação', ref: { col: 'situacoesos' }, req: true, ro: !!o.id, help: o.id ? 'Use "Alterar situação"' : '' }, { k: 'tipo_id', label: 'Tipo', ref: 'tiposos' }, { k: 'canal_id', label: 'Canal de venda', ref: 'canais' },
      { k: 'previsao', label: 'Previsão', type: 'date' }, { k: 'termo_entrada_id', label: 'Termo de entrada', ref: { col: 'termos', filter: t => t.tipo === 'Entrada de OS' } },
      { k: 'termo_saida_id', label: 'Termo de saída', ref: { col: 'termos', filter: t => t.tipo === 'Saída de OS' } }, { k: 'entregue', label: 'Aparelho entregue ao cliente?', type: 'bool' },
      { k: 'mostrar_senha', label: 'Mostrar senha no recibo?', type: 'bool' }, { k: 'tags', label: 'Tags', type: 'multi', ref: 'tagsos', w: 4 },
      { k: 'relato', label: 'Relato do cliente', type: 'textarea', w: 2 }, { k: 'laudo', label: 'Laudo técnico', type: 'textarea', w: 2 },
      { k: 'solucao', label: 'Solução', type: 'textarea', w: 2 }, { k: 'obs', label: 'Observação (aparece no recibo)', type: 'textarea', w: 2 },
      { k: 'obs_interna', label: 'Observação interna', type: 'textarea', w: 4 },
      ...extras.map(c => ({ k: 'x_' + c.id, label: c.nome, type: { Número: 'number', Data: 'date', 'Sim/Não': 'bool' }[c.tipo] || 'text', req: c.obrigatorio }))
    ];
    const tabs = ['Informações gerais', 'Aparelhos', 'Serviços', 'Peças / produtos', 'Checklist', 'Pagamento', 'Anexos', 'Assinatura'];
    el.innerHTML = App.pageHead(id ? `OS #${id}` : 'Nova ordem de serviço', 'Ordem de serviço', `
      ${id ? `<span class="badge" style="background:${esc(sit(o.situacao_id).cor || '#888')}22;color:${esc(sit(o.situacao_id).cor)}">${esc(sit(o.situacao_id).nome || '')}</span>
      <button class="btn ghost" data-a="sit">Alterar situação</button><button class="btn ghost" data-a="a4">Imprimir</button><button class="btn ghost" data-a="80">80mm</button><button class="btn ghost" data-a="wa">WhatsApp</button>` : ''}
      <a class="btn ghost" href="#/c/os">Voltar</a>`) + `
      ${travado ? '<p class="intro">OS finalizada: peças já baixadas e financeiro gerado. Itens e pagamentos ficam travados; para alterar, mude a situação para cancelada.</p>' : ''}
      <form class="card form" novalidate>
        <div class="tabs">${tabs.map((t, i) => `<button type="button" class="tab${i ? '' : ' on'}" data-tab="${i}">${t}</button>`).join('')}</div>
        <div class="tabpane on" data-pane="0"><div class="grid-form">${geral.map(f => FORM.field(f, o)).join('')}</div></div>
        <div class="tabpane" data-pane="1"><div data-aps></div><button type="button" class="btn ghost sm" data-add-ap>Adicionar aparelho</button></div>
        <div class="tabpane" data-pane="2"><div class="row-form"><label class="fld" style="flex:2"><span>Serviço</span>${FORM.input({ k: 'add_srv', ref: 'servicos' }, '')}</label><button type="button" class="btn" data-add-srv>Adicionar</button><button type="button" class="btn ghost" data-add-srv-livre>Serviço avulso</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Serviço</th>${showCost ? '<th class="r">Custo</th>' : ''}<th class="r">Cobrança</th><th class="r">Desconto</th><th class="r">Taxa</th><th class="r">Total</th><th></th></tr></thead><tbody data-srv></tbody></table></div></div>
        <div class="tabpane" data-pane="3"><div class="row-form"><label class="fld" style="flex:2"><span>Peça ou produto do estoque</span>${FORM.input({ k: 'add_peca', ref: { col: 'produtos', label: r => `${NEG.descProduto(r)} (estoque ${r.quantidade})`, filter: r => r.tipo !== 'Aparelho' && r.tipo !== 'Serviço' } }, '')}</label><button type="button" class="btn" data-add-peca>Adicionar</button></div>
          <p class="small muted">As peças são baixadas do estoque quando a OS entra numa situação de finalidade "Finalizada".</p>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Produto</th><th class="r">Qtd</th>${showCost ? '<th class="r">Custo</th>' : ''}<th class="r">Valor</th><th class="r">Total</th><th></th></tr></thead><tbody data-pc></tbody></table></div></div>
        <div class="tabpane" data-pane="4"><div class="row-form"><label class="fld"><span>Modelo de checklist</span>${FORM.input({ k: 'checklist_id', ref: 'checklists' }, o.checklist_id)}</label></div><div class="check-grid" data-ck style="margin-top:12px"></div></div>
        <div class="tabpane" data-pane="5"><div class="row-form"><label class="fld"><span>Forma</span>${FORM.input({ k: 'pg_forma', ref: { col: 'formaspag', filter: f => f.ativo !== false && f.tipo !== 'Aparelho na troca' } }, '')}</label>
          <label class="fld" style="max-width:140px"><span>Valor</span><input class="inp" type="number" step="0.01" data-pgv></label><label class="fld" style="max-width:100px"><span>Parcelas</span><input class="inp" type="number" min="1" value="1" data-pgp></label>
          <label class="fld" style="max-width:170px"><span>Data</span><input class="inp" type="date" data-pgd value="${UI.today()}"></label><button type="button" class="btn" data-add-pg>Adicionar pagamento</button></div>
          <label class="fld" style="max-width:200px;margin-top:10px"><span>Desconto geral (R$)</span><input class="inp" type="number" step="0.01" name="desconto" value="${o.desconto || 0}"></label>
          <p class="small muted">Os pagamentos viram receitas quando a OS for finalizada. Se faltar algo, o saldo fica a receber.</p>
          <table class="tbl"><thead><tr><th>Forma</th><th class="r">Valor</th><th class="r">Parcelas</th><th>Data</th><th></th></tr></thead><tbody data-pgs></tbody></table>
          <div class="kpis" style="margin-top:12px" data-tot></div></div>
        <div class="tabpane" data-pane="6"><button type="button" class="btn ghost" data-anexo>Anexar arquivo ou foto</button><div data-anexos style="margin-top:10px"></div></div>
        <div class="tabpane" data-pane="7"><div data-sign></div><button type="button" class="btn ghost" data-assinar>Coletar assinatura do cliente</button></div>
        <div class="form-actions"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn primary">Salvar</button></div>
      </form>`;
    const form = el.querySelector('form');
    FORM.bindTabs(form);
    const $ = s => el.querySelector(s);
    if (travado) form.querySelectorAll('[data-pane="2"] button,[data-pane="3"] button,[data-pane="5"] button').forEach(b => b.disabled = true);
    $('[name=prioridade_id]').addEventListener('change', e => { const p = DB.get('prioridades', e.target.value); if (p && p.dias != null) $('[name=previsao]').value = UI.addDays(UI.today(), p.dias); });

    /* aparelhos */
    const apF = [{ k: 'descricao', label: 'Descrição', req: true, w: 2 }, { k: 'modelo_id', label: 'Modelo', ref: 'modelos' }, { k: 'marca_id', label: 'Marca', ref: 'marcas' }, { k: 'imei', label: 'IMEI' },
      { k: 'gb_id', label: 'GB', ref: 'gbs' }, { k: 'cor_id', label: 'Cor', ref: 'cores' }, { k: 'serial', label: 'Número de série' }, { k: 'senha', label: 'Senha / padrão' }];
    const readAps = () => { o.aparelhos = [...el.querySelectorAll('[data-ap]')].map(box => { const d = FORM.read(box, apF); if (!d.descricao && d.modelo_id) d.descricao = nome('modelos', d.modelo_id); return d; }); };
    const renderAps = () => { $('[data-aps]').innerHTML = o.aparelhos.map((a, i) => `<div class="card" data-ap="${i}" style="background:var(--surface-2)"><div class="grid-form">${apF.map(f => FORM.field(f, a)).join('')}</div>${o.aparelhos.length > 1 ? `<button type="button" class="link" data-rm-ap="${i}">Remover aparelho</button>` : ''}</div>`).join(''); };
    renderAps();
    $('[data-aps]').addEventListener('change', e => { if (e.target.name === 'modelo_id') { const box = e.target.closest('[data-ap]'); const d = box.querySelector('[name=descricao]'); if (!d.value) d.value = nome('modelos', e.target.value); } });
    $('[data-add-ap]').onclick = () => { readAps(); o.aparelhos.push({}); renderAps(); };
    $('[data-aps]').addEventListener('click', e => { const b = e.target.closest('[data-rm-ap]'); if (b) { readAps(); o.aparelhos.splice(b.dataset.rmAp, 1); renderAps(); } });

    /* serviços */
    const renderSrv = () => {
      $('[data-srv]').innerHTML = o.servicos.map((s, i) => `<tr data-i="${i}"><td>${esc(s.descricao)}</td>${showCost ? `<td class="r"><input class="inline-inp" type="number" step="0.01" data-f="custo" value="${s.custo || 0}"${travado ? ' disabled' : ''}></td>` : ''}
        <td class="r"><input class="inline-inp" type="number" step="0.01" data-f="valor" value="${s.valor || 0}"${travado ? ' disabled' : ''}></td><td class="r"><input class="inline-inp" type="number" step="0.01" data-f="desconto" value="${s.desconto || 0}"${travado ? ' disabled' : ''}></td>
        <td class="r"><input class="inline-inp" type="number" step="0.01" data-f="taxa" value="${s.taxa || 0}"${travado ? ' disabled' : ''}></td><td class="r">${UI.money((s.valor || 0) - (s.desconto || 0))}</td><td>${travado ? '' : '<button type="button" class="icon-btn" data-rm>×</button>'}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Nenhum serviço</td></tr>';
      renderTot();
    };
    $('[data-srv]').addEventListener('change', e => { const f = e.target.dataset.f; if (!f) return; const tr = e.target.closest('tr'); const s = o.servicos[tr.dataset.i]; s[f] = Number(e.target.value) || 0; tr.querySelector('td:nth-last-child(2)').textContent = UI.money((s.valor || 0) - (s.desconto || 0)); renderTot(); });
    $('[data-srv]').addEventListener('click', e => { if (e.target.closest('[data-rm]')) { o.servicos.splice(e.target.closest('tr').dataset.i, 1); renderSrv(); } });
    $('[data-add-srv]').onclick = () => { const s = DB.get('servicos', $('[name=add_srv]').value); if (!s) return; o.servicos.push({ servico_id: s.id, descricao: s.nome, custo: s.custo || 0, valor: s.valor || 0, desconto: 0, taxa: 0, garantia_dias: s.garantia_dias }); renderSrv(); };
    $('[data-add-srv-livre]').onclick = async () => { const d = await UI.prompt('Serviço avulso', { label: 'Descrição' }); if (d) { o.servicos.push({ descricao: d, custo: 0, valor: 0, desconto: 0, taxa: 0 }); renderSrv(); } };

    /* peças */
    const renderPc = () => {
      $('[data-pc]').innerHTML = o.pecas.map((p, i) => `<tr data-i="${i}"><td>${esc(p.descricao)}</td><td class="r"><input class="inline-inp" style="width:60px" type="number" min="1" data-f="qtd" value="${p.qtd || 1}"${travado ? ' disabled' : ''}></td>
        ${showCost ? `<td class="r">${UI.money(p.custo)}</td>` : ''}<td class="r"><input class="inline-inp" type="number" step="0.01" data-f="valor" value="${p.valor || 0}"${travado ? ' disabled' : ''}></td><td class="r">${UI.money((p.valor || 0) * (p.qtd || 1))}</td><td>${travado ? '' : '<button type="button" class="icon-btn" data-rm>×</button>'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhuma peça</td></tr>';
      renderTot();
    };
    $('[data-pc]').addEventListener('change', e => { const f = e.target.dataset.f; if (!f) return; const tr = e.target.closest('tr'); const p = o.pecas[tr.dataset.i]; p[f] = Number(e.target.value) || 0; if (f === 'qtd' && p.qtd < 1) { p.qtd = 1; e.target.value = 1; } tr.querySelector('td:nth-last-child(2)').textContent = UI.money((p.valor || 0) * (p.qtd || 1)); renderTot(); });
    $('[data-pc]').addEventListener('click', e => { if (e.target.closest('[data-rm]')) { o.pecas.splice(e.target.closest('tr').dataset.i, 1); renderPc(); } });
    $('[data-add-peca]').onclick = () => {
      const p = DB.get('produtos', $('[name=add_peca]').value); if (!p) return;
      if (p.quantidade <= 0 && !cfg.pecas_sem_estoque) { UI.toast('Peça sem estoque', 'erro'); return; }
      o.pecas.push({ produto_id: p.id, descricao: NEG.descProduto(p), qtd: 1, custo: p.custo || 0, valor: p.preco || 0 }); renderPc();
    };

    /* checklist */
    const renderCk = () => {
      const m = DB.get('checklists', $('[name=checklist_id]').value);
      const itens = m ? String(m.itens || '').split('\n').map(s => s.trim()).filter(Boolean) : [];
      $('[data-ck]').innerHTML = itens.length ? itens.map(it => `<label class="chk"><select data-ck-i="${esc(it)}" class="inline-inp" style="width:auto"><option value="">—</option><option${o.checklist[it] === 'OK' ? ' selected' : ''}>OK</option><option${o.checklist[it] === 'Com defeito' ? ' selected' : ''}>Com defeito</option><option${o.checklist[it] === 'Não testado' ? ' selected' : ''}>Não testado</option></select> ${esc(it)}</label>`).join('') : '<p class="muted small">Escolha um modelo de checklist.</p>';
    };
    renderCk();
    $('[name=checklist_id]').addEventListener('change', renderCk);
    $('[data-ck]').addEventListener('change', e => { if (e.target.dataset.ckI) o.checklist[e.target.dataset.ckI] = e.target.value; });

    /* pagamentos */
    const renderPgs = () => {
      $('[data-pgs]').innerHTML = o.pagamentos.map((p, i) => `<tr data-i="${i}"><td>${esc(NEG.forma(p.forma_id).nome)}</td><td class="r">${UI.money(p.valor)}</td><td class="r">${p.parcelas || 1}x</td><td>${UI.date(p.data)}</td><td>${travado ? '' : '<button type="button" class="icon-btn" data-rm>×</button>'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhum pagamento</td></tr>';
      renderTot();
    };
    $('[data-pgs]').addEventListener('click', e => { if (e.target.closest('[data-rm]')) { o.pagamentos.splice(e.target.closest('tr').dataset.i, 1); renderPgs(); } });
    $('[data-add-pg]').onclick = () => {
      const f = Number($('[name=pg_forma]').value); const v = Number($('[data-pgv]').value); if (!f || !(v > 0)) { UI.toast('Escolha a forma e o valor', 'erro'); return; }
      const parc = Number($('[data-pgp]').value) || 1;
      o.pagamentos.push({ forma_id: f, valor: r2(v), parcelas: parc, data: $('[data-pgd]').value || UI.today(), taxa: NEG.taxa(f, parc, v) }); $('[data-pgv]').value = ''; renderPgs();
    };
    $('[name=desconto]').addEventListener('input', e => { o.desconto = Number(e.target.value) || 0; renderTot(); });
    function renderTot() {
      const t = NEG.totaisOS(o);
      $('[data-tot]').innerHTML = `<div class="kpi"><span>Serviços</span><b>${UI.money(t.servicos)}</b></div><div class="kpi"><span>Peças</span><b>${UI.money(t.pecas)}</b></div><div class="kpi accent"><span>Total</span><b>${UI.money(t.total)}</b></div>
        <div class="kpi"><span>Pago</span><b>${UI.money(t.pago)}</b></div><div class="kpi ${t.saldo > 0 ? 'warn' : 'ok'}"><span>Saldo</span><b>${UI.money(t.saldo)}</b></div>${showCost ? `<div class="kpi ok"><span>Lucro</span><b>${UI.money(t.lucro)}</b></div>` : ''}`;
      const pv = $('[data-pgv]'); if (pv && !pv.value && t.saldo > 0) pv.placeholder = UI.n2(t.saldo);
    }
    renderSrv(); renderPc(); renderPgs();

    /* anexos e assinatura */
    const renderAnexos = () => { $('[data-anexos]').innerHTML = o.anexos.length ? o.anexos.map((a, i) => `<div class="row-form" style="align-items:center;margin-bottom:6px">${a.tipo && a.tipo.startsWith('image') ? `<img src="${a.data}" alt="" style="height:56px;border-radius:4px">` : ''}<a href="${a.data}" download="${esc(a.nome)}">${esc(a.nome)}</a><span class="small muted">${Math.round(a.tamanho / 1024)} KB</span><button type="button" class="link danger-t" data-rm-anexo="${i}">remover</button></div>`).join('') : '<p class="muted small">Sem anexos. Fotos do aparelho na entrada ajudam em caso de reclamação.</p>'; };
    renderAnexos();
    $('[data-anexo]').onclick = async () => { const f = await UI.pickFile('image/*,.pdf'); if (!f) return; if (f.size > 800 * 1024) { UI.toast('Arquivo acima de 800 KB. Reduza a foto antes de anexar.', 'erro'); return; } o.anexos.push({ nome: f.name, tipo: f.type, tamanho: f.size, data: await UI.readDataURL(f) }); renderAnexos(); };
    $('[data-anexos]').addEventListener('click', e => { const b = e.target.closest('[data-rm-anexo]'); if (b) { o.anexos.splice(b.dataset.rmAnexo, 1); renderAnexos(); } });
    const renderSign = () => { $('[data-sign]').innerHTML = o.assinatura ? `<img src="${o.assinatura}" alt="Assinatura" style="max-width:320px;border:1px solid var(--line);border-radius:6px">` : '<p class="muted small">Sem assinatura.</p>'; };
    renderSign();
    $('[data-assinar]').onclick = () => FERR.assinar(sig => { o.assinatura = sig; renderSign(); });

    /* ações do topo */
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const cur = DB.get('os', id);
      ({ sit: () => OS.mudarSituacao(cur, () => App.render()), a4: () => OS.imprimir(cur, 'a4'), 80: () => OS.imprimir(cur, '80mm'), wa: () => OS.whats(cur) })[b.dataset.a]();
    });
    $('[data-cancel]').onclick = () => App.go('#/c/os');
    form.addEventListener('submit', e => {
      e.preventDefault();
      readAps();
      const d = FORM.read(form, geral);
      const err = FORM.validate(form, geral, d);
      if (err) { UI.toast(err, 'erro'); return; }
      if (!o.aparelhos.some(a => a.descricao)) { UI.toast('Informe ao menos um aparelho (aba Aparelhos)', 'erro'); form.querySelector('[data-tab="1"]').click(); return; }
      Object.assign(o, d, { checklist_id: Number($('[name=checklist_id]').value) || null });
      const t = NEG.totaisOS(o); o.total = t.total; o.lucro = t.lucro; o.custo = t.custo;
      if (t.pago > t.total + 0.004) { UI.toast(`Os pagamentos (${UI.money(t.pago)}) passam do total da OS (${UI.money(t.total)})`, 'erro'); form.querySelector('[data-tab="5"]').click(); return; }
      delete o.created_at_local;
      let rec;
      if (o.id) rec = DB.update('os', o.id, o);
      else {
        rec = DB.insert('os', o);
        if (cfg.os_whats_criar) OS.whats(rec);
      }
      UI.toast('OS #' + rec.id + ' salva');
      if (!id && sit(rec.situacao_id).finalidade === 'Finalizada') NEG.aplicarSituacaoOS(DB.get('os', rec.id), rec.situacao_id);
      App.go('#/os/' + rec.id);
    });
  };

  OS.mudarSituacao = function (o, cb) {
    const cfg = DB.cfg();
    UI.modal({
      title: 'Alterar situação — OS #' + o.id, size: 'sm',
      body: `<label class="fld"><span>Nova situação</span><select data-s>${DB.list('situacoesos').sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(s => `<option value="${s.id}"${s.id === o.situacao_id ? ' selected' : ''}>${esc(s.nome)} (${esc(s.finalidade || '')})</option>`).join('')}</select></label>
        ${cfg.os_justificativa ? '<label class="fld" style="margin-top:10px"><span>Justificativa</span><input data-j required></label>' : ''}
        <p class="small muted">Finalizada: baixa as peças, gera as receitas e inicia a garantia. Cancelada: estorna.</p>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Alterar', cls: 'primary', onClick: ({ body }) => {
        const nova = Number(body.querySelector('[data-s]').value);
        const j = body.querySelector('[data-j]');
        if (j && !j.value.trim()) { UI.toast('Informe a justificativa', 'erro'); return false; }
        try { NEG.aplicarSituacaoOS(DB.get('os', o.id), nova); } catch (e) { UI.toast(e.message, 'erro'); return false; }
        const hist = (DB.get('os', o.id).historico || []).concat([{ data: new Date().toISOString(), de: sit(o.situacao_id).nome, para: sit(nova).nome, usuario: DB.userName(), justificativa: j ? j.value : '' }]);
        DB.update('os', o.id, { historico: hist }, { silent: true });
        if (sit(nova).finalidade === 'Finalizada') { FERR.webhook && FERR.webhook('OS finalizada', DB.get('os', o.id)); if (cfg.os_whats_finalizar) OS.whats(DB.get('os', o.id)); }
        UI.toast('Situação alterada para ' + sit(nova).nome); cb && cb();
      } }]
    });
  };

  OS.imprimir = function (o, formato, duasVias) {
    const cli = DB.get('pessoas', o.cliente_id) || {};
    const t = NEG.totaisOS(o);
    const te = DB.get('termos', o.termo_entrada_id), ts = DB.get('termos', o.termo_saida_id);
    const final = sit(o.situacao_id).finalidade === 'Finalizada';
    const termo = final ? ts : te;
    const via = `${UI.docHeader('Ordem de serviço #' + o.id, sit(o.situacao_id).nome + ' · ' + UI.datetime(o.created_at))}
      <p><b>Cliente:</b> ${esc(cli.nome || '')} ${cli.cpf ? '· ' + esc(cli.cpf) : ''} · ${esc(cli.telefone || '')}<br><b>Técnico:</b> ${esc(nome('pessoas', o.tecnico_id))} · <b>Previsão:</b> ${UI.date(o.previsao)}</p>
      <table><tr><th>Aparelho</th><th>IMEI / série</th>${o.mostrar_senha ? '<th>Senha</th>' : ''}</tr>${(o.aparelhos || []).map(a => `<tr><td>${esc(a.descricao)} ${esc(nome('cores', a.cor_id))} ${esc(nome('gbs', a.gb_id))}</td><td>${esc(a.imei || a.serial || '')}</td>${o.mostrar_senha ? `<td>${esc(a.senha || '')}</td>` : ''}</tr>`).join('')}</table>
      ${o.relato ? `<p><b>Relato do cliente:</b> ${esc(o.relato)}</p>` : ''}${o.laudo ? `<p><b>Laudo:</b> ${esc(o.laudo)}</p>` : ''}${o.solucao ? `<p><b>Solução:</b> ${esc(o.solucao)}</p>` : ''}
      ${(o.servicos || []).length || (o.pecas || []).length ? `<table><tr><th>Serviço / peça</th><th class="r">Valor</th></tr>${(o.servicos || []).map(s => `<tr><td>${esc(s.descricao)}</td><td class="r">${UI.money((s.valor || 0) - (s.desconto || 0))}</td></tr>`).join('')}${(o.pecas || []).map(p => `<tr><td>${p.qtd}x ${esc(p.descricao)}</td><td class="r">${UI.money(p.valor * p.qtd)}</td></tr>`).join('')}</table><p class="r tot">Total ${UI.money(t.total)}${t.pago ? ` · Pago ${UI.money(t.pago)} · Saldo ${UI.money(t.saldo)}` : ''}</p>` : ''}
      ${Object.keys(o.checklist || {}).length ? `<p class="small"><b>Checklist:</b> ${Object.entries(o.checklist).filter(([, v]) => v).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ')}</p>` : ''}
      ${o.obs ? `<p><b>Obs.:</b> ${esc(o.obs)}</p>` : ''}
      ${termo ? `<div class="box small" style="white-space:pre-wrap">${esc(UI.fillTemplate(termo.texto, { cliente: cli.nome, dias: termo.dias, data: UI.date(UI.today()) }))}</div>` : ''}
      ${o.assinatura ? `<img src="${o.assinatura}" style="max-width:220px">` : '<div class="sign">Assinatura do cliente</div>'}`;
    UI.print(duasVias ? via + '<div style="border-top:2px dashed #999;margin:20px 0"></div>' + via : via, { formato, titulo: 'OS #' + o.id });
  };
  OS.whats = function (o) {
    const cli = DB.get('pessoas', o.cliente_id) || {};
    const s = sit(o.situacao_id);
    const m = DB.get('whatsmodelos', s.whats_modelo_id) || DB.list('whatsmodelos').find(x => x.tipo === 'Ordem de serviço' && x.padrao);
    const vars = { cliente: (cli.nome || '').split(' ')[0], os: o.id, situacao: s.nome, total: UI.money(NEG.totaisOS(o).total), loja: nome('unidades', DB.unitId()) };
    UI.whats(cli.telefone, m ? UI.fillTemplate(m.texto, vars) : `Olá ${vars.cliente}! Sua OS #${o.id} está: ${s.nome}.`);
  };
  OS.etiqueta = function (o) {
    const cli = DB.get('pessoas', o.cliente_id) || {};
    UI.print(`<div class="box"><h1>OS #${o.id}</h1><p>${esc(cli.nome || '')}<br>${esc(cli.telefone || '')}<br>${esc((o.aparelhos || []).map(a => a.descricao).join(', '))}<br>Previsão: ${UI.date(o.previsao)}</p>${EST.barcode('OS' + o.id, 30)}</div>`, { formato: '80mm', titulo: 'Etiqueta OS' });
  };

  OS.kanban = function (el) {
    const sits = DB.list('situacoesos').sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const lim = UI.addDays(UI.today(), -30);
    const oss = DB.list('os').filter(o => !['Finalizada', 'Cancelada'].includes(sit(o.situacao_id).finalidade) || String(o.updated_at || o.created_at) >= lim);
    el.innerHTML = App.pageHead('Kanban de OS', 'Ordem de serviço', '<a class="btn primary" href="#/os/novo">Nova OS</a>') + `<p class="intro">Arraste o cartão para mudar a situação. Finalizadas e canceladas aparecem por 30 dias.</p>
      <div class="kanban">${sits.map(s => { const lst = oss.filter(o => o.situacao_id === s.id); return `<div class="kcol" data-sit="${s.id}"><h3><span class="dot" style="background:${esc(s.cor)}"></span>${esc(s.nome)} (${lst.length})</h3>
        ${lst.map(o => `<div class="kcard" draggable="true" data-os="${o.id}" style="border-left-color:${esc((DB.get('prioridades', o.prioridade_id) || {}).cor || s.cor)}"><b>OS #${o.id} · ${esc(nome('pessoas', o.cliente_id))}</b>
          ${esc((o.aparelhos || []).map(a => a.descricao).join(', '))}<div class="small muted">Técnico: ${esc(nome('pessoas', o.tecnico_id) || '—')} · Previsão ${UI.date(o.previsao)}${o.previsao && o.previsao < UI.today() && !['Finalizada', 'Cancelada'].includes(s.finalidade) ? ' <span class="neg">vencida</span>' : ''}</div>
          <div class="small">${UI.money(NEG.totaisOS(o).total)}</div></div>`).join('')}</div>`; }).join('')}</div>`;
    let drag = null;
    el.querySelectorAll('.kcard').forEach(c => {
      c.addEventListener('dragstart', () => { drag = Number(c.dataset.os); });
      c.addEventListener('click', () => App.go('#/os/' + c.dataset.os));
    });
    el.querySelectorAll('.kcol').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop'));
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('drop');
        const o = DB.get('os', drag); const nova = Number(col.dataset.sit);
        if (!o || o.situacao_id === nova) return;
        if (DB.cfg().os_justificativa) { OS.mudarSituacao(o, () => OS.kanban(el)); return; }
        try { NEG.aplicarSituacaoOS(o, nova); UI.toast(`OS #${o.id}: ${sit(nova).nome}`); } catch (err) { UI.toast(err.message, 'erro'); }
        OS.kanban(el);
      });
    });
  };

  OS.dashboard = function (el) {
    const st = OS._dash = OS._dash || { de: UI.today().slice(0, 8) + '01', ate: UI.today() };
    const all = DB.list('os');
    const hoje = UI.today(), amanha = UI.addDays(hoje, 1);
    const abertas = all.filter(o => !['Finalizada', 'Cancelada'].includes(sit(o.situacao_id).finalidade));
    const per = all.filter(o => UI.dia(o.created_at) >= st.de && UI.dia(o.created_at) <= st.ate);
    const fin = all.filter(o => sit(o.situacao_id).finalidade === 'Finalizada' && UI.dia(o.data_finalizacao) >= st.de && UI.dia(o.data_finalizacao) <= st.ate);
    const tot = fin.reduce((a, o) => { const t = NEG.totaisOS(o); a.f += t.total; a.l += t.lucro; a.c += t.custo; return a; }, { f: 0, l: 0, c: 0 });
    const porSit = DB.list('situacoesos').map(s => ({ l: s.nome, v: all.filter(o => o.situacao_id === s.id && (abertas.includes(o) || per.includes(o))).length })).filter(x => x.v);
    const porTec = {}; fin.forEach(o => { const k = nome('pessoas', o.tecnico_id) || 'Sem técnico'; porTec[k] = (porTec[k] || 0) + NEG.totaisOS(o).total; });
    el.innerHTML = App.pageHead('Dashboard de OS', 'Ordem de serviço', `<label class="flt">De <input type="date" data-de value="${st.de}"> a <input type="date" data-ate value="${st.ate}"></label>`) + `
      <div class="kpis"><div class="kpi danger"><span>Vencidas</span><b>${abertas.filter(o => o.previsao && o.previsao < hoje).length}</b></div><div class="kpi warn"><span>Hoje</span><b>${abertas.filter(o => o.previsao === hoje).length}</b></div>
        <div class="kpi"><span>Amanhã</span><b>${abertas.filter(o => o.previsao === amanha).length}</b></div><div class="kpi"><span>Futuras</span><b>${abertas.filter(o => o.previsao > amanha).length}</b></div>
        <div class="kpi accent"><span>Em aberto</span><b>${abertas.length}</b></div><div class="kpi ok"><span>Finalizadas no período</span><b>${fin.length}</b></div></div>
      <div class="cols-2"><section class="card"><h2>Total por situação</h2>${UI.hbars(porSit, { fmt: UI.int })}</section>
        <section class="card"><h2>Resumo financeiro (finalizadas no período)</h2><div class="kpis"><div class="kpi accent"><span>Faturamento</span><b>${UI.money(tot.f)}</b></div>${App.can('ver_custo') ? `<div class="kpi"><span>Custo</span><b>${UI.money(tot.c)}</b></div><div class="kpi ok"><span>Lucro</span><b>${UI.money(tot.l)}</b></div>` : ''}<div class="kpi"><span>Ticket médio</span><b>${UI.money(fin.length ? tot.f / fin.length : 0)}</b></div></div>
          <h3 class="form-sec">Faturamento por técnico</h3>${UI.hbars(Object.entries(porTec).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v))}</section></div>
      <section class="card"><h2>OS em aberto</h2><table class="tbl"><thead><tr><th>N. OS</th><th>Data</th><th>Cliente</th><th>Técnico</th><th>Previsão</th><th class="r">Total</th><th>Situação</th></tr></thead><tbody>
        ${abertas.sort((a, b) => String(a.previsao).localeCompare(String(b.previsao))).map(o => `<tr onclick="location.hash='#/os/${o.id}'"><td>#${o.id}</td><td>${UI.date(o.created_at)}</td><td>${esc(nome('pessoas', o.cliente_id))}</td><td>${esc(nome('pessoas', o.tecnico_id))}</td><td class="${o.previsao < hoje ? 'neg' : ''}">${UI.date(o.previsao)}</td><td class="r">${UI.money(NEG.totaisOS(o).total)}</td><td>${sitBadge(o)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Nenhuma OS em aberto</td></tr>'}</tbody></table></section>`;
    el.querySelectorAll('[data-de],[data-ate]').forEach(i => i.onchange = () => { st.de = el.querySelector('[data-de]').value; st.ate = el.querySelector('[data-ate]').value; OS.dashboard(el); });
  };
})();
