/* =====================================================================
   Plataforma Plugin Celulares — REGISTRO DE FERRAMENTAS
   ---------------------------------------------------------------------
   Para incluir, renomear ou mover uma ferramenta, mexa só aqui.
   Campos:
     id      identificador único (vai no endereço: #/t/<id>)
     nome    texto do menu
     url     caminho relativo (abre dentro da plataforma) ou link http(s)
     externo true = abre numa aba nova (sites que não aceitam ser embutidos)
     icone   nome do ícone Lucide (https://lucide.dev/icons)
     desc    descrição curta (aparece no Início e na busca)
     tags    palavras extras para a busca
   ===================================================================== */
window.PLATAFORMA_REGISTRO = (function () {
  const MP = 'https://app.mercadophone.tech/index.php?class=LoginForm&previous_class=meudashboard';
  const CONSULT = 'https://sistema.consultcenter.com.br/users/login';

  // Ferramentas (cada uma existe uma vez; o menu pode repetir a mesma em seções diferentes)
  const F = {
    gestao:        { nome: 'Gestão da Loja', url: 'gestao/index.html', icone: 'store', desc: 'ERP: PDV, estoque com IMEI, OS, financeiro da loja, fiscal e relatórios', tags: 'erp pdv venda estoque imei os sistema gestor loja recibo locação', sistema: true },
    financeiro:    { nome: 'Controle Financeiro', url: 'financeiro/index.html', icone: 'landmark', desc: 'Carteira Sicoob/Euro: recebimentos, recompras, acordos, inadimplência', tags: 'sicoob euro boleto baixa parcela recompra acordo renegociação inadimplência firebase', sistema: true },
    vitrine:       { nome: 'Vitrine — catálogo completo', url: 'vitrine/index.html', icone: 'shopping-bag', desc: 'À vista, cartão e boleto', tags: 'catálogo vitrine aparelhos clientes' },
    vitrineBoleto: { nome: 'Vitrine — boleto', url: 'vitrine/boleto.html', icone: 'receipt', desc: 'Entrada mínima + parcelas (anúncio do boleto)', tags: 'catálogo boleto anúncio 15x' },
    vitrineCartao: { nome: 'Vitrine — à vista e cartão', url: 'vitrine/cartao.html', icone: 'credit-card', desc: 'Desconto no PIX + cartão em até 18x', tags: 'catálogo cartão pix 18x' },
    vitrineAdmin:  { nome: 'Admin da Vitrine', url: 'vitrine/admin.html', icone: 'package-plus', desc: 'Cadastro dos aparelhos e envio da lista para o GitHub', tags: 'vitrine admin produtos json fotos' },

    mercadophone:  { nome: 'Mercado Phone', url: MP, externo: true, icone: 'smartphone', desc: 'Sistema Mercado Phone', tags: 'mp pdv erp crm' },
    kommo:         { nome: 'Kommo CRM', url: 'https://pluginnovaserrana5.kommo.com/leads/pipeline/11444559/?skip_filter=Y', externo: true, icone: 'kanban', desc: 'Funil de leads (Kommo)', tags: 'crm leads funil' },
    consult:       { nome: 'Consult Center', url: CONSULT, externo: true, icone: 'user-search', desc: 'Consulta de crédito', tags: 'score cpf serasa crédito' },
    webfactoring:  { nome: 'Web Factoring', url: 'http://201.222.31.101:8081/webfactoring/', externo: true, icone: 'building-2', desc: 'Sistema Web Factoring', tags: 'factoring' },
    paymobi:       { nome: 'Paymobi', url: 'https://www.paymobi.com.br/views/modules/login_page.php', externo: true, icone: 'wallet', desc: 'Paymobi', tags: 'pagamento' },

    tabelas:       { nome: 'Tabelas de Preço', url: 'tabelas-preco/index.html', icone: 'table', desc: 'Preços de aparelhos e acessórios', tags: 'preço tabela android iphone acessórios' },
    servicos:      { nome: 'Tabelas de Serviços', url: 'tabelas-preco/tabela_precos.html', icone: 'list-checks', desc: 'Preços de serviços da loja', tags: 'serviço ativação chip transferência dados' },
    simBoletos:    { nome: 'Simulador de Boletos', url: 'simulador-boletos/index.html', icone: 'calculator', desc: 'Entrada e parcelas no boleto + calendário de vencimentos', tags: 'boleto simulação parcelas entrada vencimento calendário dia 10 20' },
    linkZap:       { nome: 'Gerador de Link WhatsApp', url: 'link/index.html', icone: 'message-circle', desc: 'Cria links wa.me com mensagem', tags: 'whatsapp link wa.me' },
    extenso:       { nome: 'Gerador de Parcelas', url: 'gerador-extenso/index.html', icone: 'list-ordered', desc: 'Parcelas com valor por extenso', tags: 'extenso parcelas' },
    promissoria:   { nome: 'Simulador Nota Promissória', url: 'simulador-promissorias/index.html', icone: 'file-signature', desc: 'Notas promissórias', tags: 'promissória nota' },
    capa:          { nome: 'Gerador Capa de Carnê', url: 'gerador-capa/index.html', icone: 'book-open', desc: 'Capa do carnê para impressão', tags: 'carnê capa' },
    reneg1:        { nome: 'Simulador Renegociação Total/Parcial', url: 'gerador1/index.html', icone: 'refresh-ccw', desc: 'Renegociação total ou parcial', tags: 'renegociação total parcial acordo' },
    reneg2:        { nome: 'Simulador Renegociação Remanejamento', url: 'gerador2/index.html', icone: 'arrow-right-left', desc: 'Manobra de parcelas vencidas para o final', tags: 'renegociação remanejamento manobra vencidas' },

    csLocFiador:   { nome: 'Locação com Fiador (Clicksign)', url: 'https://app.clicksign.com/fluxia/e7f7261f-7a37-4f71-8af4-94f02c9551fd', externo: true, icone: 'pen-line', tags: 'contrato clicksign locação fiador' },
    csLocSem:      { nome: 'Locação sem Fiador (Clicksign)', url: 'https://app.clicksign.com/fluxia/65f3eaee-bfad-4a68-adfd-0ad14badc264', externo: true, icone: 'pen-line', tags: 'contrato clicksign locação' },
    mLocFiador:    { nome: 'Contrato de Locação com Fiador', url: 'contratos-manuais/locacao-com-fiador.html', icone: 'file-text', tags: 'contrato manual locação fiador' },
    mLocSem:       { nome: 'Contrato de Locação sem Fiador', url: 'contratos-manuais/locacao-sem-fiador.html', icone: 'file-text', tags: 'contrato manual locação' },
    csRenNovoSem:  { nome: 'Renegociação Novo sem Fiador (Clicksign)', url: 'https://app.clicksign.com/fluxia/861114f2-7170-4c10-87e4-470235102e00', externo: true, icone: 'pen-line', tags: 'contrato clicksign renegociação' },
    csRenNovoCom:  { nome: 'Renegociação Novo com Fiador (Clicksign)', url: 'https://app.clicksign.com/fluxia/0ddb95f5-a964-4c33-b538-5222970c529f', externo: true, icone: 'pen-line', tags: 'contrato clicksign renegociação fiador' },
    csRenAntSem:   { nome: 'Renegociação Antigo sem Fiador (Clicksign)', url: 'https://app.clicksign.com/fluxia/d6802929-7de2-45df-8d70-b12d52021afa', externo: true, icone: 'pen-line', tags: 'contrato clicksign renegociação' },
    csRenAntCom:   { nome: 'Renegociação Antigo com Fiador (Clicksign)', url: 'https://app.clicksign.com/fluxia/788dc296-7301-48c5-bd1d-23bba499c572', externo: true, icone: 'pen-line', tags: 'contrato clicksign renegociação fiador' },
    mRenFinCom:    { nome: 'Renegociação Financiamento com Fiador', url: 'contratos-manuais/renegociacao-financiamento-com-fiador.html', icone: 'file-text', tags: 'contrato manual renegociação financiamento fiador' },
    mRenFinSem:    { nome: 'Renegociação Financiamento sem Fiador', url: 'contratos-manuais/renegociacao-financiamento-sem-fiador.html', icone: 'file-text', tags: 'contrato manual renegociação financiamento' },
    mRenLocCom:    { nome: 'Renegociação Locação com Fiador', url: 'contratos-manuais/renegociacao-locacao-com-fiador.html', icone: 'file-text', tags: 'contrato manual renegociação locação fiador' },
    mRenLocSem:    { nome: 'Renegociação Locação sem Fiador', url: 'contratos-manuais/renegociacao-locacao-sem-fiador.html', icone: 'file-text', tags: 'contrato manual renegociação locação' },
    mDevolucao:    { nome: 'Termo de devolução + checklist', url: 'contratos-manuais/contrato-devolucao.html', icone: 'clipboard-check', tags: 'devolução termo checklist contrato' },

    painelAdmin:   { nome: 'Painel Administrativo', url: 'admin/index.html', icone: 'shield', desc: 'Área administrativa original', tags: 'admin' },
    tabelasAdmin:  { nome: 'Atualizador de Tabelas', url: 'tabelas-preco/admin.html', icone: 'upload-cloud', desc: 'Atualiza as tabelas de preço no GitHub', tags: 'admin tabela preço github atualizar' },
    classico:      { nome: 'Menu clássico (antigo)', url: 'classico.html', icone: 'layout-list', desc: 'A central de ferramentas como era antes', tags: 'antigo hub menu' }
  };
  Object.keys(F).forEach(id => { F[id].id = id; });

  const UTIL = ['webfactoring', 'paymobi', 'promissoria', 'capa'];

  // Menu lateral — mesma organização da central antiga (Módulo de Vendas / Módulo Financeiro),
  // com os sistemas no topo. Itens repetidos entre módulos são intencionais.
  const MENU = [
    { titulo: 'Sistemas', icone: 'layers', aberto: true, itens: ['gestao', 'financeiro', 'mercadophone'] },
    { titulo: 'Módulo de Vendas', icone: 'shopping-cart', itens: [
      'kommo', 'tabelas', 'servicos', 'simBoletos', 'consult', 'linkZap', 'extenso',
      { titulo: 'Contratos', itens: [
        { titulo: 'Contratos Clicksign', itens: ['csLocFiador', 'csLocSem'] },
        { titulo: 'Contratos Manuais', itens: ['mLocFiador', 'mLocSem'] }
      ] },
      { titulo: 'Utilitários', itens: UTIL }
    ] },
    { titulo: 'Módulo Financeiro', icone: 'piggy-bank', itens: [
      'reneg1', 'reneg2', 'extenso', 'consult',
      { titulo: 'Contratos de Renegociação', itens: [
        { titulo: 'Contratos Clicksign', itens: ['csRenNovoSem', 'csRenNovoCom', 'csRenAntSem', 'csRenAntCom'] },
        { titulo: 'Contratos Manuais', itens: ['mRenFinCom', 'mRenFinSem', 'mRenLocCom', 'mRenLocSem', 'mDevolucao'] }
      ] },
      { titulo: 'Utilitários', itens: UTIL }
    ] },
    { titulo: 'Vitrine', icone: 'shopping-bag', itens: ['vitrine', 'vitrineBoleto', 'vitrineCartao', 'vitrineAdmin'] },
    { titulo: 'Administrativo', icone: 'shield', itens: ['tabelasAdmin', 'vitrineAdmin', 'painelAdmin', 'classico'] }
  ];

  // Atalhos diretos para telas internas dos sistemas (abrem a ferramenta já na tela certa)
  const FIN_TELAS = [
    ['Painel', '#/painel'], ['Clientes', '#/clientes'], ['Parcelas', '#/parcelas'], ['Pagamentos', '#/pagamentos'],
    ['Recompras', '#/recompras'], ['Acordos', '#/acordos'], ['Régua e críticos (cobrança)', '#/cobranca'],
    ['Inadimplência', '#/inadimplencia'], ['Antecipação', '#/antecipacao'], ['Relatórios', '#/relatorios'],
    ['Histórico de operações', '#/historico'], ['Usuários', '#/usuarios'], ['Parâmetros e bancos', '#/config'], ['Dados e planilha (importar/backup)', '#/dados']
  ].map(([nome, h]) => ({ ferramenta: 'financeiro', caminho: 'Controle Financeiro', nome, hash: h }));

  const GESTAO_TELAS = (window.PLATAFORMA_GESTAO_MENU || []).map(([caminho, nome, h]) => ({ ferramenta: 'gestao', caminho: 'Gestão da Loja › ' + caminho, nome, hash: h }));

  // Atalhos em destaque no Início
  const ATALHOS = [
    { ferramenta: 'gestao', nome: 'Nova venda', hash: '#/pdv', icone: 'shopping-cart' },
    { ferramenta: 'financeiro', nome: 'Parcelas', hash: '#/parcelas', icone: 'list' },
    { ferramenta: 'financeiro', nome: 'Cobrança', hash: '#/cobranca', icone: 'bell' },
    { ferramenta: 'financeiro', nome: 'Inadimplência', hash: '#/inadimplencia', icone: 'alert-triangle' },
    { ferramenta: 'gestao', nome: 'Estoque atual', hash: '#/c/produtos', icone: 'package' },
    { ferramenta: 'gestao', nome: 'Nova OS', hash: '#/os/novo', icone: 'wrench' },
    { ferramenta: 'gestao', nome: 'DRE regime de caixa', hash: '#/rel/drecaixa', icone: 'chart-column' },
    { ferramenta: 'simBoletos', nome: 'Simular boleto', icone: 'calculator' },
    { ferramenta: 'reneg2', nome: 'Remanejamento', icone: 'arrow-right-left' }
  ];

  return { F, MENU, FIN_TELAS, GESTAO_TELAS, ATALHOS, unidade: 'Unidade Nova Serrana/MG' };
})();
