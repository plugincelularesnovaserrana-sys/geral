/* =====================================================================
   FERRAMENTAS e MARKETPLACE: assinatura, arquivos, alertas, catálogo,
   loja de apps, carteira, webhooks
   ===================================================================== */
(function () {
  const nome = (col, id) => (DB.get(col, id) || {}).nome || '';
  const FERR = window.FERR = {};

  /* ---------------- assinatura (pad de desenho) ---------------- */
  FERR.assinar = function (cb, titulo) {
    UI.modal({
      title: titulo || 'Assinatura do cliente', size: 'md',
      body: '<p class="small muted">Peça para o cliente assinar com o dedo (celular/tablet) ou com o mouse.</p><canvas class="sign-pad" width="600" height="180"></canvas>',
      onOpen: ({ body }) => {
        const c = body.querySelector('canvas'); const ctx = c.getContext('2d'); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
        let draw = false, vazio = true;
        const pos = e => { const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * c.width / r.width, (t.clientY - r.top) * c.height / r.height]; };
        const down = e => { draw = true; vazio = false; ctx.beginPath(); ctx.moveTo(...pos(e)); e.preventDefault(); };
        const move = e => { if (!draw) return; ctx.lineTo(...pos(e)); ctx.stroke(); e.preventDefault(); };
        const up = () => { draw = false; };
        c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
        body._get = () => vazio ? null : c.toDataURL('image/png');
        body._clear = () => { ctx.clearRect(0, 0, c.width, c.height); vazio = true; };
      },
      buttons: [{ label: 'Limpar', cls: 'ghost', close: false, onClick: ({ body }) => body._clear() }, { label: 'Cancelar', cls: 'ghost' },
        { label: 'Salvar assinatura', cls: 'primary', onClick: ({ body }) => { const s = body._get(); if (!s) { UI.toast('Assine antes de salvar', 'erro'); return false; } cb(s); } }]
    });
  };
  CRUD.register('assinaturas', {
    col: 'assinaturas', title: 'Documentos assinados', single: 'Documento para assinatura', crumb: 'Ferramentas', newLabel: 'Assinar novo documento',
    intro: 'Documento com assinatura desenhada na tela (celular ou tablet). Para assinatura com validade de certificado digital, use um serviço especializado.',
    fields: [{ k: 'descricao', label: 'Descrição', req: true, w: 2 }, { k: 'tipo', label: 'Tipo', opts: ['Contrato', 'Termo de compra', 'Termo de garantia', 'Autorização', 'Outros'] }, { k: 'pessoa_id', label: 'Signatário', ref: 'pessoas' },
      { k: 'expira', label: 'Data de expiração', type: 'date' }, { k: 'texto', label: 'Texto do documento', type: 'textarea', rows: 10, w: 4 },
      { k: 'sig', type: 'html', w: 4, html: d => d.assinatura ? `<p class="small muted">Assinado em ${UI.datetime(d.assinado_em)}</p><img src="${d.assinatura}" style="max-width:300px;border:1px solid var(--line)">` : '<p class="small muted">Ainda não assinado. Salve e use a ação "Coletar assinatura".</p>' }],
    cols: [{ k: 'id', label: 'Id' }, { k: 'descricao', label: 'Descrição' }, { label: 'Status', get: r => r.assinatura ? 'Assinado' : 'Pendente', badge: r => r.assinatura ? 'ok' : 'warn' }, { label: 'Signatário', get: r => nome('pessoas', r.pessoa_id) }, { k: 'tipo', label: 'Tipo' }, { k: 'expira', label: 'Expira', fmt: 'date' }, { k: 'created_at', label: 'Criação', fmt: 'date' }],
    actions: [{ label: 'Coletar assinatura', show: r => !r.assinatura, fn: (r, re) => FERR.assinar(s => { DB.update('assinaturas', r.id, { assinatura: s, assinado_em: new Date().toISOString() }); re(); }) },
      { label: 'Imprimir', fn: r => { const p = DB.get('pessoas', r.pessoa_id) || {}; UI.print(UI.docHeader(r.descricao, UI.date(r.created_at)) + `<div style="white-space:pre-wrap">${esc(r.texto || '')}</div>${r.assinatura ? `<img src="${r.assinatura}" style="max-width:260px">` : ''}<div class="sign">${esc(p.nome || 'Assinatura')}${p.cpf ? ' — ' + esc(p.cpf) : ''}</div>`); } }]
  });
  CRUD.register('arquivos', {
    col: 'arquivos', title: 'Meus arquivos', single: 'Arquivo', crumb: 'Ferramentas', newLabel: 'Carregar arquivo', noEdit: true,
    onNew: async () => {
      const f = await UI.pickFile(); if (!f) return;
      if (f.size > 900 * 1024) { UI.toast('Arquivo acima de 900 KB. Enquanto os dados ficam no navegador, o limite é pequeno.', 'erro'); return; }
      const desc = await UI.prompt('Descrição do arquivo', { value: f.name }); if (desc == null) return;
      DB.insert('arquivos', { nome: f.name, descricao: desc, tipo: f.type, tamanho: f.size, data: await UI.readDataURL(f), origem: 'Manual' }); UI.toast('Arquivo salvo'); App.render();
    },
    cols: [{ k: 'nome', label: 'Nome' }, { k: 'descricao', label: 'Descrição' }, { k: 'tipo', label: 'Tipo' }, { label: 'Tamanho (KB)', get: r => Math.round((r.tamanho || 0) / 1024), align: 'r' }, { k: 'origem', label: 'Origem' }, { k: 'created_at', label: 'Data', fmt: 'date' }],
    indicators: rows => [{ l: 'Total de arquivos', v: rows.length }, { l: 'Espaço usado', v: Math.round(rows.reduce((s, r) => s + (r.tamanho || 0), 0) / 1024) + ' KB' }],
    actions: [{ label: 'Abrir / baixar', fn: r => { const a = document.createElement('a'); a.href = r.data; a.download = r.nome; a.click(); } }],
    onRowClick: r => { const a = document.createElement('a'); a.href = r.data; a.download = r.nome; a.click(); }
  });

  /* ---------------- central de alertas ---------------- */
  const TIPOS_ALERTA = [
    ['estoque_minimo', 'Estoque', 'Produto abaixo da quantidade mínima'], ['custo_zero', 'Estoque', 'Produto cadastrado com custo zero'], ['venda_menor_custo', 'Estoque', 'Preço de venda menor ou igual ao custo'],
    ['estoque_negativo', 'Estoque', 'Estoque negativo'], ['estoque_parado', 'Estoque', 'Aparelho parado há mais de 60 dias'],
    ['venda_prejuizo', 'Vendas', 'Venda com prejuízo'], ['recebido_menor', 'Vendas', 'Valor recebido menor que a venda'], ['venda_cancelada', 'Vendas', 'Venda cancelada nos últimos 7 dias'], ['sem_termo', 'Vendas', 'Venda de aparelho sem termo de garantia'],
    ['os_vencida', 'OS', 'OS com previsão vencida'], ['os_retirada', 'OS', 'Aparelho aguardando retirada há mais de 30 dias'],
    ['fin_vencido', 'Financeiro', 'Conta a receber vencida'], ['fin_pagar', 'Financeiro', 'Conta a pagar vencendo em 2 dias'], ['aniversario', 'Clientes', 'Cliente fazendo aniversário hoje'],
    ['nf_rejeitada', 'Fiscal', 'Nota fiscal rejeitada'], ['cert_vencendo', 'Fiscal', 'Certificado digital vencendo em 30 dias']
  ];
  const ALERTAS = window.ALERTAS = {
    cfg() { const c = DB.meta().alertas_cfg || {}; return k => c[k] !== false; },
    list() {
      const on = ALERTAS.cfg(); const hoje = UI.today(); const out = [];
      const ign = DB.meta().alertas_ign || {};
      const push = (k, mod, txt, link, id) => { const key = k + ':' + id; if (on(k)) out.push({ k, mod, txt, link, key, ignorado: !!ign[key] }); };
      const prods = DB.list('produtos');
      prods.forEach(p => {
        if (p.tipo === 'Serviço') return;
        const minimo = p.qtd_minima || (DB.get('modelos', p.modelo_id) || {}).qtd_minima;
        if (minimo && p.quantidade < minimo && p.tipo !== 'Aparelho') push('estoque_minimo', 'Estoque', `${NEG.descProduto(p)}: ${p.quantidade} em estoque (mínimo ${minimo})`, '#/c/produtos/' + p.id, p.id);
        if (p.quantidade > 0 && !p.custo) push('custo_zero', 'Estoque', `${NEG.descProduto(p)} está com custo zero`, '#/c/produtos/' + p.id, p.id);
        if (p.quantidade > 0 && p.preco && p.custo && p.preco <= p.custo) push('venda_menor_custo', 'Estoque', `${NEG.descProduto(p)}: venda ${UI.money(p.preco)} ≤ custo ${UI.money(p.custo)}`, '#/c/produtos/' + p.id, p.id);
        if (p.quantidade < 0) push('estoque_negativo', 'Estoque', `${NEG.descProduto(p)} com estoque ${p.quantidade}`, '#/c/produtos/' + p.id, p.id);
        if (p.tipo === 'Aparelho' && p.quantidade > 0 && p.data_entrada && UI.daysBetween(p.data_entrada, hoje) > 60) push('estoque_parado', 'Estoque', `${NEG.descProduto(p)} parado há ${UI.daysBetween(p.data_entrada, hoje)} dias`, '#/c/produtos/' + p.id, p.id);
      });
      DB.list('vendas').forEach(v => {
        if (v.status === 'Concluída' && v.lucro < 0) push('venda_prejuizo', 'Vendas', `Venda #${v.id} com prejuízo de ${UI.money(v.lucro)}`, '#/c/vendas/' + v.id, v.id);
        if (v.status === 'Concluída' && (v.pagamentos || []).reduce((s, p) => s + p.valor, 0) < v.total - 0.01) push('recebido_menor', 'Vendas', `Venda #${v.id}: recebido menor que o total`, '#/c/vendas/' + v.id, v.id);
        if (v.status === 'Cancelada' && String(v.cancelada_em) >= UI.addDays(hoje, -7)) push('venda_cancelada', 'Vendas', `Venda #${v.id} cancelada: ${v.motivo_cancelamento || ''}`, '#/c/vendas/' + v.id, v.id);
        if (v.status === 'Concluída' && !v.termo_id && v.itens.some(i => i.tipo === 'Aparelho')) push('sem_termo', 'Vendas', `Venda #${v.id} de aparelho sem termo de garantia`, '#/c/vendas/' + v.id, v.id);
      });
      DB.list('os').forEach(o => {
        const s = DB.get('situacoesos', o.situacao_id) || {};
        if (!['Finalizada', 'Cancelada'].includes(s.finalidade) && o.previsao && o.previsao < hoje) push('os_vencida', 'OS', `OS #${o.id} (${nome('pessoas', o.cliente_id)}) com previsão ${UI.date(o.previsao)}`, '#/os/' + o.id, o.id);
        if (/retirada/i.test(s.nome || '') && UI.daysBetween(String(o.updated_at || o.created_at), hoje) > 30) push('os_retirada', 'OS', `OS #${o.id} aguardando retirada há mais de 30 dias`, '#/os/' + o.id, o.id);
      });
      DB.list('financeiro').filter(f => ['Em aberto', 'Parcial'].includes(f.situacao)).forEach(f => {
        if (f.tipo === 'R' && f.vencimento < hoje) push('fin_vencido', 'Financeiro', `${f.titulo} — ${nome('pessoas', f.pessoa_id)} venceu em ${UI.date(f.vencimento)} (${UI.money(NEG.aPagar(f))})`, '#/c/receitas/' + f.id, f.id);
        if (f.tipo === 'D' && f.vencimento >= hoje && f.vencimento <= UI.addDays(hoje, 2)) push('fin_pagar', 'Financeiro', `Pagar ${f.titulo} até ${UI.date(f.vencimento)} (${UI.money(NEG.aPagar(f))})`, '#/c/despesas/' + f.id, f.id);
      });
      DB.list('pessoas').filter(p => p.cliente && p.nascimento && p.nascimento.slice(5) === hoje.slice(5)).forEach(p => push('aniversario', 'Clientes', `${p.nome} faz aniversário hoje`, '#/c/clientes/' + p.id, p.id + hoje));
      DB.list('nfe').filter(n => n.status === 'Rejeitada').forEach(n => push('nf_rejeitada', 'Fiscal', `NF ${n.numero} rejeitada: ${n.motivo || ''}`, '#/c/nfe/' + n.id, n.id));
      DB.list('unidades').filter(u => u.cert_validade && u.cert_validade <= UI.addDays(hoje, 30)).forEach(u => push('cert_vencendo', 'Fiscal', `Certificado de ${u.nome} vence em ${UI.date(u.cert_validade)}`, '#/c/unidades/' + u.id, u.id));
      return out;
    },
    count() { try { return ALERTAS.list().filter(a => !a.ignorado).length; } catch (e) { return 0; } }
  };
  App.route('/alertas', (el, p, qs) => {
    const filtro = qs.get('m') || ''; const ver = qs.get('v') || 'ativos';
    const todos = ALERTAS.list();
    const lst = todos.filter(a => (!filtro || a.mod === filtro) && (ver === 'todos' || (ver === 'ignorados' ? a.ignorado : !a.ignorado)));
    const mods = [...new Set(TIPOS_ALERTA.map(t => t[1]))];
    el.innerHTML = App.pageHead('Central de alertas', 'Ferramentas', '<button class="btn ghost" data-cfg>Configurar alertas</button>') + `
      <div class="kpis">${mods.map(m => `<a class="kpi ${filtro === m ? 'accent' : ''}" href="#/alertas?m=${m}&v=${ver}" style="text-decoration:none;color:inherit"><span>Alertas de ${m}</span><b>${todos.filter(a => a.mod === m && !a.ignorado).length}</b></a>`).join('')}</div>
      <div class="card"><div class="list-bar">${['ativos', 'ignorados', 'todos'].map(v => `<a class="btn sm ${v === ver ? 'primary' : 'ghost'}" href="#/alertas?m=${filtro}&v=${v}">${v[0].toUpperCase() + v.slice(1)}</a>`).join('')}${filtro ? `<a class="btn sm ghost" href="#/alertas?v=${ver}">Todos os módulos</a>` : ''}</div>
      <table class="tbl"><tbody>${lst.map(a => `<tr><td><span class="badge ${a.mod === 'Financeiro' || a.mod === 'Fiscal' ? 'danger' : 'warn'}">${a.mod}</span></td><td><a href="${a.link}">${esc(a.txt)}</a></td><td class="r"><button class="btn sm ghost" data-ign="${esc(a.key)}">${a.ignorado ? 'Reativar' : 'Ignorar'}</button></td></tr>`).join('') || '<tr><td class="empty">Nenhum alerta. Tudo em ordem.</td></tr>'}</tbody></table></div>`;
    el.querySelectorAll('[data-ign]').forEach(b => b.onclick = () => { const ig = DB.meta().alertas_ign || {}; if (ig[b.dataset.ign]) delete ig[b.dataset.ign]; else ig[b.dataset.ign] = true; DB.setMeta({ alertas_ign: ig }); App.render(); });
    el.querySelector('[data-cfg]').onclick = () => {
      const c = ALERTAS.cfg();
      UI.modal({ title: 'Alertas exibidos na central', size: 'md', body: mods.map(m => `<h3 class="form-sec">${m}</h3>${TIPOS_ALERTA.filter(t => t[1] === m).map(t => `<label class="chk"><input type="checkbox" data-k="${t[0]}"${c(t[0]) ? ' checked' : ''}> ${t[2]}</label>`).join('')}`).join(''),
        buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Salvar', cls: 'primary', onClick: ({ body }) => { const n = {}; body.querySelectorAll('[data-k]').forEach(i => n[i.dataset.k] = i.checked); DB.setMeta({ alertas_cfg: n }); App.render(); } }] });
    };
  });

  /* ---------------- catálogo online ---------------- */
  App.route('/catalogo', el => {
    const ps = DB.list('produtos').filter(p => p.quantidade > 0 && p.tipo !== 'Serviço' && p.tipo !== 'Peça');
    el.innerHTML = App.pageHead('Catálogo online — produtos', 'Ferramentas > Catálogo', '<a class="btn ghost" href="#/config/catalogo">Configurar</a><button class="btn ghost" data-ver>Ver catálogo</button><button class="btn primary" data-baixar>Baixar catálogo (HTML)</button>') + `
      <p class="intro">Marque o que aparece no catálogo. "Baixar catálogo" gera uma página pronta para publicar (por exemplo no GitHub Pages), com botão de WhatsApp em cada produto.</p>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Exibir</th><th>Produto</th><th>Estado</th><th>Bateria</th><th class="r">Preço</th><th>Ordem</th></tr></thead><tbody>
      ${ps.map(p => `<tr><td><input type="checkbox" data-c="${p.id}"${p.catalogo ? ' checked' : ''} aria-label="Exibir no catálogo"></td><td>${esc(NEG.descProduto(p))}</td><td>${esc(nome('estados', p.estado_id))}</td><td>${p.bateria ? p.bateria + '%' : ''}</td><td class="r">${UI.money(p.preco)}</td><td><input class="inline-inp" style="width:60px" type="number" data-o="${p.id}" value="${p.catalogo_ordem || ''}"></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum produto com estoque.</td></tr>'}</tbody></table></div></div>`;
    el.querySelectorAll('[data-c]').forEach(c => c.onchange = () => DB.update('produtos', c.dataset.c, { catalogo: c.checked }, { silent: true }));
    el.querySelectorAll('[data-o]').forEach(c => c.onchange = () => DB.update('produtos', c.dataset.o, { catalogo_ordem: Number(c.value) || null }, { silent: true }));
    el.querySelector('[data-ver]').onclick = () => { const w = window.open(); if (w) { w.document.write(FERR.catalogoHTML()); w.document.close(); } };
    el.querySelector('[data-baixar]').onclick = () => UI.download('catalogo.html', FERR.catalogoHTML(), 'text/html');
  });
  FERR.catalogoHTML = function () {
    const c = DB.cfg(); const u = DB.get('unidades', DB.unitId()) || {};
    const whats = UI.onlyDigits(c.catalogo_whats || u.telefone);
    const ps = DB.list('produtos').filter(p => p.catalogo && p.quantidade > 0).sort((a, b) => (a.catalogo_ordem || 999) - (b.catalogo_ordem || 999));
    const credito = DB.list('formaspag').find(f => f.tipo === 'Crédito');
    const n = credito ? Math.min(12, credito.max_parcelas || 12) : 0;
    const itens = ps.map(p => ({ nome: NEG.descProduto(p), estado: nome('estados', p.estado_id), bateria: p.bateria, preco: p.preco, parc: n ? `${n}x ${UI.money(p.preco * (1 + (NEG.taxa(credito.id, n, 100) / 100)) / n)}` : '', foto: p.foto || '', tipo: p.tipo }));
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.catalogo_titulo || u.nome)}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f1f3f7;color:#1b2230}header{background:#1c2534;color:#fff;padding:20px 16px}header h1{margin:0;font-size:22px}header p{margin:4px 0 0;color:#c4cde0}
main{max-width:1100px;margin:0 auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.p{background:#fff;border:1px solid #e1e5ee;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px}
.p img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:#f7f8fb}.p h2{font-size:15px;margin:0}.p .m{color:#5f6b80;font-size:13px}.p .v{font-size:20px;font-weight:700}.p a{margin-top:auto;background:#17784c;color:#fff;text-align:center;padding:9px;border-radius:6px;text-decoration:none;font-weight:600}
.f{max-width:1100px;margin:0 auto;padding:0 16px 8px}.f input{width:100%;padding:10px;border:1px solid #cfd5e2;border-radius:8px;font:inherit}</style></head><body>
<header><h1>${esc(c.catalogo_titulo || 'Nossos produtos')}</h1><p>${esc(u.nome || '')} · ${esc(u.endereco || '')}</p></header><div class="f" style="margin-top:14px"><input placeholder="Buscar modelo..." oninput="f(this.value)"></div><main id="m"></main>
<script>const I=${JSON.stringify(itens)};const W=${JSON.stringify(whats)};const $=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const e=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function f(q){q=(q||'').toLowerCase();document.getElementById('m').innerHTML=I.filter(p=>p.nome.toLowerCase().includes(q)).map(p=>'<div class="p">'+(p.foto?'<img src="'+e(p.foto)+'" alt="">':'')+'<h2>'+e(p.nome)+'</h2><div class="m">'+e(p.estado||p.tipo)+(p.bateria?' · bateria '+p.bateria+'%':'')+'</div><div class="v">'+$(p.preco)+'</div>'+(p.parc?'<div class="m">ou '+e(p.parc)+'</div>':'')+'<a target="_blank" href="https://wa.me/'+(W.length<=11?'55'+W:W)+'?text='+encodeURIComponent('Olá! Tenho interesse no '+p.nome+' de '+$(p.preco))+'">Quero este</a></div>').join('')||'<p>Nenhum produto disponível no momento.</p>'}f('');</script></body></html>`;
  };

  /* ---------------- loja de apps ---------------- */
  const APPS = [
    ['api', 'API', 'Integrações e IA lendo os dados da loja', 'Disponível quando o sistema estiver num servidor', '#/c/apitokens'],
    ['webhooks', 'Webhooks', 'Avisar outro sistema quando uma venda ou OS é finalizada', 'Funcionando', '#/c/webhooks'],
    ['whatsapp', 'WhatsApp', 'Envio de recibos, OS e cobranças', 'Funcionando via link (wa.me). Envio automático pede uma API paga', '#/c/whatsmodelos'],
    ['catalogo', 'Catálogo online', 'Página com produtos e botão de WhatsApp', 'Funcionando', '#/catalogo'],
    ['ofx', 'Conciliação bancária (OFX)', 'Importa extrato do banco e concilia com o financeiro', 'Funcionando', '#/c/conciliacoes'],
    ['xml', 'Captura de XML de NF-e', 'Importa notas de fornecedor direto no estoque', 'Funcionando', '#/c/dfe'],
    ['nfe', 'Emissão de NF-e / NFC-e', 'Emissão automática na SEFAZ', 'Precisa de servidor e certificado — próxima versão', '#/c/nfe'],
    ['score', 'Consulta de score / CPF', 'Análise de crédito antes de vender a prazo', 'Precisa contratar birô de crédito — registro manual disponível', '#/c/scores'],
    ['ia', 'Assistente de IA', 'Atendimento e consultas por IA', 'Próxima versão (depende da API)', ''],
    ['tef', 'TEF / maquininha integrada', 'Cobrança direto na maquininha', 'Registro manual disponível; integração na versão com servidor', '#/c/tefpagamentos']
  ];
  App.route('/apps', el => {
    el.innerHTML = App.pageHead('Loja de apps', 'Marketplace', '<a class="btn ghost" href="#/c/integracaologs">Ver logs</a>') + `<p class="intro">Conecte o sistema às ferramentas que a loja já usa.</p><div class="tiles">${APPS.map(([k, t, d, s, h]) => `<div class="tile"><h3>${t}</h3><p>${d}</p><span class="badge ${/^Funcionando/.test(s) ? 'ok' : 'warn'}">${esc(s)}</span>${h ? `<a class="btn ghost sm" href="${h}">Configurar</a>` : ''}</div>`).join('')}</div>`;
  });
  App.route('/carteira', el => { el.innerHTML = App.pageHead('Carteira', 'Marketplace') + '<div class="card empty">A carteira pré-paga para serviços por uso (consulta de IMEI, CPF, score, assinatura certificada) entra junto com as integrações pagas, na versão com servidor.</div>'; });

  /* ---------------- webhooks ---------------- */
  FERR.webhook = function (evento, obj) {
    DB.list('webhooks').filter(w => w.ativo !== false && w.evento === evento && w.url).forEach(w => {
      const log = s => DB.insert('integracaologs', { integracao: 'Webhook: ' + w.nome, acao: evento, descricao: w.url, objeto_id: obj.id, status: s }, { silent: true });
      try {
        fetch(w.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evento, loja: (DB.get('unidades', DB.unitId()) || {}).nome, dados: obj }) })
          .then(r => log(r.ok ? 'OK' : 'Erro ' + r.status)).catch(() => log('Falhou'));
      } catch (e) { log('Falhou'); }
    });
  };

  /* ---------------- importar pessoas ---------------- */
  FERR.importarPessoas = function (cb) {
    UI.modal({ title: 'Importar clientes (CSV)', size: 'md', body: `<pre class="small">nome;cpf;telefone;email;cidade;nascimento
Maria Souza;123.456.789-00;(37) 99999-0000;maria@email.com;Cidade;1990-05-20</pre>`,
      buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Escolher arquivo', cls: 'primary', onClick: async () => {
        const f = await UI.pickFile('.csv,.txt'); if (!f) return;
        const ls = (await UI.readText(f)).split(/\r?\n/).filter(Boolean); const h = ls.shift().split(';').map(x => x.trim().toLowerCase()); let n = 0, dup = 0;
        ls.forEach(l => { const c = l.split(';'); const o = { cliente: true, tipo_pessoa: 'Física' }; h.forEach((k, i) => o[k] = (c[i] || '').trim()); if (!o.nome) return;
          if (o.cpf && DB.list('pessoas').some(p => UI.onlyDigits(p.cpf) === UI.onlyDigits(o.cpf))) { dup++; return; }
          if (o.nascimento && o.nascimento.includes('/')) o.nascimento = o.nascimento.split('/').reverse().join('-');
          DB.insert('pessoas', o, { silent: true }); n++; });
        UI.toast(`${n} cliente(s) importado(s)${dup ? `, ${dup} já existiam` : ''}`); cb && cb();
      } }] });
  };
})();
