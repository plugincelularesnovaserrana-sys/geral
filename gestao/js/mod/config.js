/* =====================================================================
   CONFIGURAÇÕES: parâmetros, backup, auditoria, manual
   ===================================================================== */
(function () {
  const B = (k, label, help) => ({ k, label, type: 'bool', help });
  const pagina = (rota, titulo, crumb, fields) => App.route(rota, el => {
    if (!App.can('config')) { el.innerHTML = '<div class="card empty">Seu perfil não tem acesso a esta tela.</div>'; return; }
    const cfg = DB.cfg();
    el.innerHTML = App.pageHead(titulo, crumb) + `<form class="card form">${FORM.render(fields, cfg)}<div class="form-actions"><button class="btn primary">Salvar</button></div></form>`;
    const f = el.querySelector('form'); FORM.bindTabs(f);
    f.onsubmit = e => { e.preventDefault(); DB.setCfg(FORM.read(f, fields)); App.needShell = true; UI.toast('Parâmetros salvos'); App.render(); };
  });

  pagina('/config/vendas', 'Configurações da venda e PDV', 'Vendas > Configurações', [
    { label: 'Valores padrão', type: 'section' }, { k: 'garantia_padrao', label: 'Garantia padrão (dias)', type: 'number' }, { k: 'desconto_max', label: 'Desconto máximo padrão (%)', type: 'percent', help: 'Cada perfil pode ter o seu' },
    { k: 'recibo_formato', label: 'Formato do recibo', opts: [{ v: 'a4', l: 'A4' }, { v: '80mm', l: 'Bobina 80mm' }] }, { k: 'seguro_comissao_pct', label: 'Comissão sobre seguros (%)', type: 'percent' },
    { k: 'msg_recibo', label: 'Mensagem ao enviar recibo pelo WhatsApp', w: 4, help: 'Variáveis: {cliente} {loja} {venda} {total}' }, { k: 'recibo_rodape', label: 'Rodapé do recibo', w: 4 },
    { label: 'Automações', type: 'section' }, B('gerar_recibo', 'Abrir recibo ao finalizar a venda?'), B('whats_recibo', 'Abrir WhatsApp com o recibo ao finalizar?'),
    B('recibo_parcelas', 'Mostrar parcelas do crediário no recibo?'), { k: 'upgrade_comissao_pct', label: 'Comissão do upgrade (% do spread)', type: 'percent' },
    { label: 'Regras', type: 'section' }, B('venda_valor_exato', 'Não permitir finalizar com valor pago menor que o total'), B('venda_sem_estoque', 'Permitir vender produto sem estoque?'),
    B('pecas_sem_estoque', 'Permitir usar peças sem estoque?'), B('bloquear_lucro_vendedor', 'Esconder lucro dos vendedores no dashboard?')
  ]);
  pagina('/config/estoque', 'Configurações de estoque', 'Compras / Estoque > Configurações', [
    B('estoque_imei_unico', 'Bloquear IMEI repetido em estoque?'), B('estoque_senha_editar', 'Pedir senha mestre para ajustar estoque?'), B('pedir_motivo_exclusao', 'Pedir motivo ao excluir registros?'),
    B('precos_multiplos', 'Usar múltiplos preços de venda (venda 2 e 3)?'), B('atacado_ativo', 'Usar módulo de atacado (preço 2 como atacado)?')
  ]);
  pagina('/config/os', 'Configurações da ordem de serviço', 'Ordem de Serviço > Configurações', [
    { k: 'os_situacao_padrao', label: 'Situação padrão', ref: 'situacoesos' }, B('os_whats_criar', 'Enviar OS pelo WhatsApp ao criar?'), B('os_whats_finalizar', 'Enviar WhatsApp ao finalizar?'),
    B('os_whats_situacao', 'Abrir WhatsApp ao mudar de situação (usa o modelo da situação)?'), B('os_justificativa', 'Pedir justificativa ao trocar situação?'),
    B('os_bloquear_custo_vendedor', 'Esconder custo da OS para quem não é gerente?'), { k: 'comissao_tecnico_pct', label: 'Comissão padrão do técnico (% do lucro)', type: 'percent' }
  ]);
  pagina('/config/financeiro', 'Configurações financeiras', 'Financeiro > Configurações', [
    B('caixa_ativo', 'Usar módulo de caixa?'), B('fechamento_cego', 'Fechamento de caixa às cegas (vendedor não vê o total esperado)?'),
    { k: 'multa_pct', label: 'Multa por atraso (%)', type: 'percent', help: 'Sugerida ao receber parcela vencida' }, { k: 'juros_dia_pct', label: 'Juros por dia de atraso (%)', type: 'percent', help: 'Ex.: 0,033 = 1% ao mês' },
    { k: 'whats_gerente', label: 'WhatsApp do gerente (fechamento de caixa)' }
  ]);
  pagina('/config/geral', 'Parâmetros gerais', 'Configurações', [
    { k: 'sistema_nome', label: 'Nome do sistema', w: 2 }, { k: 'empresa_nome', label: 'Nome da empresa', w: 2 },
    B('credito_ativo', 'Usar crédito de clientes?'), B('indicacao_ativo', 'Usar programa de indicação?'), { k: 'cabecalho_docs', label: 'Cabeçalho extra dos documentos', w: 4 }
  ]);
  pagina('/config/catalogo', 'Configurar site / catálogo', 'Ferramentas > Catálogo', [
    { k: 'catalogo_titulo', label: 'Título do catálogo', w: 2 }, { k: 'catalogo_whats', label: 'WhatsApp para pedidos', help: 'Vazio = telefone da loja' }, B('catalogo_ativo', 'Catálogo ativo?')
  ]);
  pagina('/config/documentos', 'Modelos de documentos', 'Configurações', [
    { k: 'recibo_prefixo', label: 'Prefixo do número do recibo', ph: 'Ex.: GL', help: 'O número do recibo é o número da venda com 10 dígitos. Ex.: GL0000000123' },
    { k: 'recibo_rodape', label: 'Rodapé do recibo de venda', w: 4 }, { k: 'cabecalho_docs', label: 'Linha extra no cabeçalho', w: 4 },
    { type: 'html', w: 4, html: () => '<p class="small muted">O logotipo e os dados da empresa que saem no recibo ficam em <a href="#/c/unidades">Empresas / lojas</a>. Para locação, marque "É locação?" no <a href="#/c/tiposvenda">tipo de venda</a>.</p>' },
    { type: 'html', w: 4, html: () => '<p class="small muted">Os textos de garantia, termo de compra e termos de OS ficam em <a href="#/c/termos">Termos</a>. Mensagens de WhatsApp em <a href="#/c/whatsmodelos">Modelos de WhatsApp</a>.</p>' }
  ]);
  App.route('/config/dre', el => {
    el.innerHTML = App.pageHead('Configuração do DRE', 'Financeiro > Configurações') + `<div class="card"><p>O DRE monta as linhas a partir do <b>grupo no DRE</b> de cada categoria financeira:</p>
      <table class="tbl"><thead><tr><th>Categoria</th><th>Tipo</th><th>Grupo no DRE</th></tr></thead><tbody>${DB.list('categoriasfin').map(c => `<tr onclick="location.hash='#/c/categoriasfin/${c.id}'"><td>${esc(c.nome)}</td><td>${esc(c.tipo)}</td><td>${esc(c.dre || '—')}</td></tr>`).join('')}</tbody></table>
      <p class="small muted">Receita de vendas, CMV e taxas vêm direto das vendas; compras de mercadoria ficam como "Não considerar" para não contar o custo duas vezes.</p></div>`;
  });

  App.route('/config', el => {
    const g = [['Empresa', [['Dados da empresa / lojas', '#/c/unidades'], ['Parâmetros gerais', '#/config/geral'], ['Gestão de acesso', '#/c/usuarios'], ['Perfis de acesso', '#/c/perfis'], ['Senhas mestras', '#/c/senhasmestre'], ['Backup e restauração', '#/config/backup']]],
      ['Vendas', [['Parâmetros', '#/config/vendas'], ['Pessoas', '#/c/clientes'], ['Vendedores', '#/c/vendedores'], ['Funil (tipos de venda)', '#/c/tiposvenda'], ['Canais de venda', '#/c/canais'], ['Tipos de entrega', '#/c/tiposentrega'], ['Termos de garantia', '#/c/termos']]],
      ['Estoque', [['Parâmetros', '#/config/estoque'], ['Modelos de produtos', '#/c/modelos'], ['GB', '#/c/gbs'], ['Estado do aparelho', '#/c/estados'], ['Cor', '#/c/cores'], ['Tipo de produto', '#/c/tiposproduto'], ['Disponibilidade', '#/c/disponibilidades']]],
      ['Financeiro', [['Parâmetros', '#/config/financeiro'], ['Formas de pagamento', '#/c/formaspag'], ['Bancos', '#/c/bancos'], ['Categorias', '#/c/categoriasfin'], ['Plano de contas', '#/c/planocontas']]],
      ['Ordem de serviço', [['Parâmetros', '#/config/os'], ['Serviços', '#/c/servicos'], ['Peças', '#/estoque/pecas'], ['Modelos de checklist', '#/c/checklists'], ['Situações da OS', '#/c/situacoesos']]],
      ['Fiscal', [['Tributações', '#/c/tributacoes'], ['Alíquota por estado', '#/c/aliquotas'], ['Natureza da operação', '#/c/naturezas']]]];
    el.innerHTML = App.pageHead('Configurações disponíveis', 'Configurações') + `<div class="tiles">${g.map(([t, ls]) => `<div class="tile"><h3>${t}</h3>${ls.map(([l, h]) => `<a href="${h}">${l}</a>`).join('')}</div>`).join('')}</div>`;
  });

  /* ---------------- backup ---------------- */
  App.route('/config/backup', el => {
    const tam = Object.keys(localStorage).filter(k => k.startsWith('gc:')).reduce((s, k) => s + (localStorage.getItem(k) || '').length, 0);
    const ult = DB.meta().ultimo_backup;
    el.innerHTML = App.pageHead('Backup e restauração', 'Configurações') + `
      <div class="card"><p>Enquanto o sistema roda sem servidor, <b>os dados ficam guardados neste navegador, neste aparelho</b>. Outro computador ou celular não vê estes dados, e limpar o navegador apaga tudo. Faça backup todo dia.</p>
        <div class="kpis"><div class="kpi"><span>Espaço usado</span><b>${(tam / 1024 / 1024).toFixed(2)} MB</b><small>limite aproximado do navegador: 5 MB</small></div><div class="kpi ${ult && ult.slice(0, 10) === UI.today() ? 'ok' : 'warn'}"><span>Último backup</span><b>${ult ? UI.datetime(ult) : 'nunca'}</b></div></div>
        <div class="row-form"><button class="btn primary" data-exp>Baixar backup completo</button><button class="btn" data-imp>Restaurar de um arquivo</button><button class="btn ghost danger-t" data-reset>Apagar tudo e recomeçar</button></div>
        <p class="small muted">Para usar o mesmo sistema em outro aparelho por enquanto: baixe o backup aqui e restaure lá. Na versão com servidor isso passa a ser automático.</p></div>`;
    el.querySelector('[data-exp]').onclick = () => { UI.download(`backup-loja-${UI.today()}.json`, DB.exportAll(), 'application/json'); DB.setMeta({ ultimo_backup: new Date().toISOString() }); App.render(); };
    el.querySelector('[data-imp]').onclick = async () => {
      const f = await UI.pickFile('.json'); if (!f) return;
      if (!(await UI.confirm('Restaurar substitui TODOS os dados atuais deste navegador pelos do arquivo. Continuar?', { ok: 'Restaurar', danger: true }))) return;
      try { const user = DB.meta().user_id; DB.importAll(await UI.readText(f)); DB.setMeta({ user_id: user }); UI.toast('Backup restaurado'); App.needShell = true; App.go('#/inicio'); App.render(); }
      catch (e) { UI.toast('Arquivo inválido: ' + e.message, 'erro'); }
    };
    el.querySelector('[data-reset]').onclick = async () => {
      if (!(await UI.confirm('Apagar todos os dados deste navegador? Faça um backup antes.', { ok: 'Apagar tudo', danger: true }))) return;
      const t = await UI.prompt('Confirme digitando APAGAR'); if (t !== 'APAGAR') return;
      DB.reset(); location.hash = '#/inicio'; location.reload();
    };
  });

  /* ---------------- auditoria ---------------- */
  const auditoria = (el, origem) => {
    CRUD.register('auditoria', {
      title: origem ? 'Logs: ' + origem : 'Log e auditoria', crumb: 'Configurações', noNew: true, noEdit: true, noDelete: true,
      rows: () => DB.raw('auditoria').filter(a => !origem || a.origem === origem).slice().reverse(),
      cols: [{ k: 'origem', label: 'Origem' }, { k: 'registro', label: 'Id' }, { k: 'operacao', label: 'Operação', badge: r => ({ Criação: 'ok', Exclusão: 'danger' }[r.operacao] || 'accent') }, { k: 'usuario', label: 'Usuário' }, { k: 'data', label: 'Data da operação', fmt: 'datetime' }],
      filters: [{ k: 'origem', label: 'Origem', opts: () => [...new Set(DB.raw('auditoria').map(a => a.origem))].sort() }, { k: 'operacao', label: 'Operação', opts: ['Criação', 'Alteração', 'Exclusão', 'Restauração'] }, { k: 'usuario', label: 'Usuário', opts: () => [...new Set(DB.raw('auditoria').map(a => a.usuario))] }, { k: 'data', label: 'Período', type: 'daterange' }],
      onRowClick: r => UI.modal({ title: `${r.operacao} — ${r.origem} #${r.registro}`, size: 'md', body: `<p class="small muted">${esc(r.usuario)} em ${UI.datetime(r.data)}</p><pre class="small">${esc(JSON.stringify(JSON.parse(r.dados || '{}'), null, 2))}</pre>` }),
      sort: () => 0
    });
    CRUD.reset('auditoria');
    CRUD.list('auditoria', el);
  };
  App.route('/auditoria', el => auditoria(el));
  App.route('/auditoria/:origem', (el, p) => auditoria(el, p.origem));

  /* ---------------- manual ---------------- */
  App.route('/ajuda', el => {
    const S = [
      ['Primeiros passos', '1. Entre como Gerente (senha 1234) e troque as senhas em Configurações > Gestão de acesso.\n2. Preencha os dados da loja em Configurações > Empresas / lojas.\n3. Revise as formas de pagamento e as taxas do cartão em Financeiro > Configurações > Formas de pagamento.\n4. Cadastre seus produtos em Compras / Estoque > Estoque atual (ou importe por CSV).\n5. Faça backup todo dia em Configurações > Backup e restauração.'],
      ['Vender', 'Vendas > Nova venda. Busque o produto pelo nome, IMEI ou código de barras e tecle Enter. Adicione um ou mais pagamentos até o saldo zerar e clique em Finalizar venda. O estoque baixa, o financeiro e o caixa são lançados e o recibo abre.\nCrediário e boleto geram parcelas mensais em Financeiro > Receitas.\n"Aparelho na troca" cadastra o usado recebido e coloca no estoque com o custo igual ao valor abatido.'],
      ['Upgrade', 'Vendas > Simulador de upgrade. Cadastre antes as relações de valores (mínimo, máximo e desconto por defeito). A proposta calcula o valor avaliado, a diferença e as parcelas, e "Gerar venda" já abre o PDV preenchido.'],
      ['Ordem de serviço', 'Ordem de Serviço > Nova. Preencha cliente, aparelho, serviços e peças. Mude a situação pelo kanban ou pelo botão "Alterar situação". Quando a OS entra numa situação de finalidade "Finalizada", as peças saem do estoque e as receitas são criadas.'],
      ['Financeiro e caixa', 'Abra o caixa no início do dia (Financeiro > Caixas). Recebimentos em dinheiro entram na conferência do caixa. Use Receber/Pagar na lista de receitas e despesas para dar baixa. O DRE fica em Relatórios > Financeiro.'],
      ['Dados e backup', 'Os dados ficam no navegador deste aparelho. Para usar em outro aparelho, baixe o backup e restaure lá. Numa próxima versão, com servidor, tudo fica sincronizado automaticamente.']
    ];
    el.innerHTML = App.pageHead('Manual do usuário', 'Configurações') + S.map(([t, x]) => `<section class="card"><h2>${t}</h2><p style="white-space:pre-line;max-width:80ch">${esc(x)}</p></section>`).join('');
  });
})();
