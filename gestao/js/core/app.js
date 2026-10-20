/* =====================================================================
   App: menu, rotas, login, permissões e troca de loja
   ===================================================================== */
(function () {
  const routes = [];

  /* Menu lateral — mesma estrutura de 10 menus */
  const MENU = [
    { id: 'inicio', label: 'Tela inicial', icon: 'layout-dashboard', href: '#/inicio' },
    { id: 'vendas', label: 'Vendas', icon: 'shopping-cart', items: [
      ['Nova venda', '#/pdv'], ['Vendas', '#/vendas'], ['Clientes', '#/c/clientes'], ['Orçamentos', '#/c/orcamentos'], ['Consulta de estoque', '#/estoque/consulta'],
      { sub: 'Upgrade e simuladores', icon: 'repeat', items: [['Simulador de upgrade', '#/upgrade'], ['Negociações de upgrade', '#/c/upgrade_negociacoes'], ['Simulador de taxa de cartão', '#/simulador-taxa']] },
      { sub: 'Pós-venda', icon: 'shield-check', items: [['Histórico de vendas', '#/vendas/historico'], ['Trocas e devoluções', '#/c/trocas'], ['Crédito de clientes', '#/c/creditos'], ['Garantias', '#/garantias'], ['Seguros', '#/c/seguros']] },
      { sub: 'Entregas e metas', icon: 'target', items: [['Delivery', '#/c/deliveries'], ['Metas', '#/c/metas']] },
      { sub: 'Maquininhas', icon: 'credit-card', items: [['Maquininhas POS', '#/c/maquinas'], ['Pagamentos nas maquininhas', '#/c/tefpagamentos']] },
      { sub: 'Configurações de vendas', icon: 'settings-2', items: [['Parâmetros', '#/config/vendas'], ['Vendedores', '#/c/vendedores'], ['Tipos de venda (funil)', '#/c/tiposvenda'],
        ['Canais de venda', '#/c/canais'], ['Tipos de entrega', '#/c/tiposentrega'], ['Termos de garantia/compra', '#/c/termos'], ['Modelos de WhatsApp', '#/c/whatsmodelos'], ['Tags de clientes', '#/c/tagspessoa'], ['Motoboys', '#/c/motoboys']] }
    ] },
    { id: 'estoque', label: 'Compras / Estoque', icon: 'package', items: [
      ['Estoque atual', '#/c/produtos'], ['Ordem de compra', '#/c/ordenscompra'], ['Movimentações', '#/c/movestoque'], ['Etiquetas', '#/estoque/etiquetas'],
      { sub: 'Controle', icon: 'clipboard-check', items: [['Inventário', '#/c/inventarios'], ['Produtos vendidos / sem estoque', '#/estoque/vendidos'], ['Estoque de todas as lojas', '#/estoque/multi'], ['Transferências', '#/c/transferencias']] },
      { sub: 'IMEI e procedência', icon: 'scan-barcode', items: [['Histórico de IMEI', '#/estoque/imei'], ['Certificado de procedência', '#/c/imeiconsultas']] },
      { sub: 'Cadastros do produto', icon: 'tags', items: [['Modelos de produtos', '#/c/modelos'], ['Marcas', '#/c/marcas'], ['GB', '#/c/gbs'], ['Cores', '#/c/cores'], ['Estado do aparelho', '#/c/estados'],
        ['Categorias', '#/c/categorias'], ['Subcategorias', '#/c/subcategorias'], ['Tipos de produto (fiscal)', '#/c/tiposproduto'], ['Disponibilidade', '#/c/disponibilidades'], ['Tags de produto', '#/c/tagsproduto']] },
      { sub: 'Configurações de estoque', icon: 'settings-2', items: [['Parâmetros', '#/config/estoque'], ['Fornecedores', '#/c/fornecedores'], ['Campos extras', '#/c/camposextras'], ['Modelos de etiquetas', '#/c/modelosetiqueta'], ['Logs dos produtos', '#/auditoria/produtos']] }
    ] },
    { id: 'os', label: 'Ordem de Serviço', icon: 'wrench', items: [
      ['Nova OS', '#/os/novo'], ['Ordens de serviço', '#/c/os'], ['Kanban', '#/os/kanban'], ['Dashboard', '#/os/dashboard'],
      { sub: 'Peças e serviços', icon: 'cpu', items: [['Estoque de peças', '#/estoque/pecas'], ['Serviços', '#/c/servicos'], ['Técnicos', '#/c/tecnicos']] },
      { sub: 'Configurações de OS', icon: 'settings-2', items: [['Parâmetros', '#/config/os'], ['Situações', '#/c/situacoesos'], ['Tipos', '#/c/tiposos'], ['Prioridades', '#/c/prioridades'],
        ['Modelos de checklist', '#/c/checklists'], ['Tags', '#/c/tagsos'], ['Termos de entrada/saída', '#/c/termos']] }
    ] },
    { id: 'financeiro', label: 'Financeiro', icon: 'wallet', perm: 'financeiro', items: [
      ['Receitas', '#/c/receitas'], ['Despesas', '#/c/despesas'], ['Caixas', '#/c/caixas'], ['DRE regime de caixa', '#/rel/drecaixa'], ['Calendário', '#/fin/calendario'],
      { sub: 'Bancos', icon: 'landmark', items: [['Saldo bancário', '#/c/bancos'], ['Conciliação bancária (OFX)', '#/c/conciliacoes'], ['Movimentações financeiras', '#/rel/movfin']] },
      { sub: 'Lançamentos fixos', icon: 'repeat-2', items: [['Despesas e receitas fixas', '#/c/fixos']] },
      { sub: 'Configurações financeiras', icon: 'settings-2', items: [['Parâmetros', '#/config/financeiro'], ['Formas de pagamento', '#/c/formaspag'], ['Categorias', '#/c/categoriasfin'],
        ['Plano de contas', '#/c/planocontas'], ['Configuração do DRE', '#/config/dre'], ['Tags', '#/c/tagsfin']] }
    ] },
    { id: 'fiscal', label: 'Fiscal', icon: 'receipt-text', perm: 'fiscal', items: [
      ['NF-e / NFC-e', '#/c/nfe'], ['NF de entrada (upgrade)', '#/c/nfeentrada'], ['XML de fornecedores', '#/c/dfe'], ['Vendas com nota', '#/fiscal/vendasnf'],
      { sub: 'Consultas', icon: 'file-search', items: [['Relatório de NF', '#/rel/nfe'], ['TEF', '#/c/tefpagamentos']] },
      { sub: 'Configurações fiscais', icon: 'settings-2', items: [['Dados fiscais da empresa', '#/c/unidades'], ['Tributações', '#/c/tributacoes'], ['Natureza da operação', '#/c/naturezas'], ['Alíquota por estado', '#/c/aliquotas'], ['Transportadores', '#/c/transportadores']] }
    ] },
    { id: 'relatorios', label: 'Relatórios', icon: 'chart-column', perm: 'relatorios', items: () => window.REPORT_MENU ? window.REPORT_MENU() : [] },
    { id: 'ferramentas', label: 'Ferramentas', icon: 'sparkles', items: [
      ['Central de alertas', '#/alertas'], ['Catálogo online', '#/catalogo'], ['Assinatura digital', '#/c/assinaturas'], ['Meus arquivos', '#/c/arquivos'],
      { sub: 'Clientes e crédito', icon: 'user-search', items: [['Consulta de score', '#/c/scores'], ['NPS — pesquisas', '#/c/nps'], ['Programa de indicação', '#/rel/indicacoes'], ['Cashback (em breve)', '#/embreve/Cashback']] },
      { sub: 'Compras', icon: 'tag', items: [['Preços do dia (fornecedores)', '#/c/precosdia']] },
      { sub: 'Configurações', icon: 'settings-2', items: [['Configurar catálogo', '#/config/catalogo']] }
    ] },
    { id: 'marketplace', label: 'Marketplace', icon: 'store', perm: 'config', items: [
      ['Loja de apps', '#/apps'], ['Carteira', '#/carteira'],
      { sub: 'Integrações', icon: 'plug', items: [['API', '#/c/apitokens'], ['Webhooks', '#/c/webhooks'], ['Logs de integração', '#/c/integracaologs']] }
    ] },
    { id: 'config', label: 'Configurações', icon: 'settings', perm: 'config', items: [
      ['Visão geral', '#/config'], ['Parâmetros gerais', '#/config/geral'], ['Empresas / lojas', '#/c/unidades'], ['Backup e restauração', '#/config/backup'],
      { sub: 'Acesso e segurança', icon: 'lock-keyhole', items: [['Usuários', '#/c/usuarios'], ['Perfis de acesso', '#/c/perfis'], ['Senhas mestras', '#/c/senhasmestre']] },
      { sub: 'Documentos e avisos', icon: 'file-text', items: [['Modelos de documentos', '#/config/documentos'], ['Notificações', '#/c/notificacoes']] },
      { sub: 'Auditoria', icon: 'history', items: [['Log e auditoria', '#/auditoria'], ['Logs de acesso', '#/c/acessos']] },
      { sub: 'Ajuda', icon: 'life-buoy', items: [['Manual do usuário', '#/ajuda'], ['Central de ideias', '#/c/solicitacoes']] }
    ] }
  ];

  const App = {
    MENU,
    route(pattern, fn) {
      const keys = [];
      const rx = new RegExp('^' + pattern.replace(/:(\w+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      routes.push({ rx, keys, fn });
    },
    go(h) { location.hash = h; },

    /* Permissões vêm do perfil do usuário logado */
    perfil() {
      const u = DB.user(); if (!u) return null;
      return DB.list('perfis').find(p => p.id === u.perfil_id) || { nome: 'Gerente', permissoes: ['tudo'] };
    },
    can(p) {
      const pf = App.perfil(); if (!pf) return false;
      const ps = pf.permissoes || [];
      return ps.includes('tudo') || ps.includes(p);
    },
    hideCost() { return !App.can('ver_custo'); },

    pageHead(title, crumb, actions) {
      return `<header class="page-head"><div><nav class="crumb" aria-label="Caminho">${esc(crumb || '')}</nav><h1>${esc(title)}</h1></div><div class="head-actions">${actions || ''}</div></header>`;
    },

    start() {
      DB.load();
      if (DB.isEmpty()) { SEED.run(); DB.markSeeded(); }
      (window.MIGRAR || []).forEach(fn => { try { fn(); } catch (e) { console.error('migração', e); } });
      document.addEventListener('click', () => document.querySelectorAll('.dropdown').forEach(d => { if (!d.closest('.open-keep')) d.hidden = true; }));
      window.addEventListener('hashchange', App.render);
      App.render();
    },

    renderShell() {
      const u = DB.user();
      const units = DB.list('unidades');
      const c = DB.cfg();
      const mini = DB.meta().side_mini;
      const ini = (u.nome || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
      document.getElementById('app').innerHTML = `
        <aside class="side${mini ? ' mini' : ''}" id="side">
          <div class="brand"><span class="brand-mark">${esc((c.sistema_nome || 'Gestor Loja').slice(0, 1))}</span><span class="brand-name">${esc(c.sistema_nome || 'Gestor Loja')}</span>
            <button class="icon-btn side-collapse" data-mini aria-label="Recolher menu" title="Recolher menu">${FX.ic(mini ? 'panel-left-open' : 'panel-left-close')}</button></div>
          <input class="menu-search" placeholder="Buscar no menu" aria-label="Buscar no menu">
          <nav class="menu" aria-label="Menu principal">${App.menuHTML()}</nav>
          <div class="side-user"><span class="avatar">${esc(ini)}</span><span class="who"><b>${esc(u.nome)}</b><span>${esc((App.perfil() || {}).nome || '')}</span></span>
            <button class="icon-btn" data-logout aria-label="Sair" title="Sair">${FX.ic('log-out')}</button></div>
        </aside>
        <div class="main">
          <div class="topbar">
            <button class="icon-btn burger" data-burger aria-label="Abrir menu">${FX.ic('menu')}</button>
            <label class="unit-sel">${FX.ic('building-2')}<span>Loja</span><select data-unit>${units.map(x => `<option value="${x.id}"${x.id === DB.unitId() ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
            <button class="cmdk-btn" data-cmdk>${FX.ic('search')}<span>Buscar em tudo</span><kbd>Ctrl K</kbd></button>
            <span class="grow"></span>
            <a class="btn primary sm" href="#/pdv">${FX.ic('plus')}<span class="hide-m">Nova venda</span></a>
            <a class="btn ghost sm hide-m" href="#/os/novo">${FX.ic('wrench')}Nova OS</a>
            <button class="icon-btn" data-tema aria-label="Alternar tema claro/escuro" title="Tema claro/escuro">${FX.ic(FX.tema() === 'dark' ? 'sun' : 'moon')}</button>
            <button class="icon-btn bell" data-bell aria-label="Alertas" title="Central de alertas">${FX.ic('bell')}<i data-bell-n></i></button>
          </div>
          <main id="content" tabindex="-1"></main>
        </div>`;
      const side = document.getElementById('side');
      side.querySelector('[data-logout]').onclick = () => { DB.raw('acessos').push({ id: DB.nextId('acessos'), login: u.login, logout: new Date().toISOString(), acao: 'Saída' }); DB.persist('acessos'); DB.setMeta({ user_id: null }); App.render(); };
      side.querySelector('[data-mini]').onclick = () => { DB.setMeta({ side_mini: !DB.meta().side_mini }); App.needShell = true; App.render(); };
      document.querySelector('[data-unit]').onchange = e => { DB.setUnit(e.target.value); UI.toast('Loja alterada'); App.render(); };
      document.querySelector('[data-burger]').onclick = e => { e.stopPropagation(); side.classList.toggle('open'); };
      document.querySelector('[data-bell]').onclick = () => App.go('#/alertas');
      document.querySelector('[data-cmdk]').onclick = () => FX.cmdk();
      document.querySelector('[data-tema]').onclick = () => FX.alternarTema();
      side.addEventListener('click', e => {
        const g = e.target.closest('[data-group]');
        if (g) {
          if (side.classList.contains('mini')) { DB.setMeta({ side_mini: false }); const open = DB.meta().menuopen || {}; open[g.dataset.group] = true; DB.setMeta({ menuopen: open }); App.needShell = true; App.render(); return; }
          g.parentElement.classList.toggle('open'); const open = DB.meta().menuopen || {}; open[g.dataset.group] = g.parentElement.classList.contains('open'); DB.setMeta({ menuopen: open });
        }
        const sb = e.target.closest('[data-sub]');
        if (sb) { const li = sb.parentElement; li.classList.toggle('open'); sb.setAttribute('aria-expanded', li.classList.contains('open')); const open = DB.meta().menuopen || {}; open[sb.dataset.sub] = li.classList.contains('open'); DB.setMeta({ menuopen: open }); }
        if (e.target.closest('a')) side.classList.remove('open');
      });
      side.querySelector('.menu-search').addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        side.querySelectorAll('.menu li > a').forEach(a => { a.parentElement.hidden = q && !a.textContent.toLowerCase().includes(q); });
        side.querySelectorAll('.menu > a.menu-top').forEach(a => { a.hidden = q && !a.textContent.toLowerCase().includes(q); });
        side.querySelectorAll('.menu-group').forEach(g => { g.classList.toggle('searching', !!q); g.hidden = q && !g.querySelector('li:not([hidden]) > a'); });
        side.querySelectorAll('.menu-sub').forEach(g => { g.hidden = q && !g.querySelector('li:not([hidden]) > a'); g.classList.toggle('searching', !!q); });
      });
      App.shellUser = u.id; App.shellUnit = DB.unitId();
      App.updateBell();
    },
    updateBell() {
      const n = window.ALERTAS ? ALERTAS.count() : 0;
      const b = document.querySelector('[data-bell-n]'); if (b) { b.textContent = n || ''; b.hidden = !n; }
    },
    menuHTML() {
      const open = DB.meta().menuopen || {};
      const link = ([l, h]) => `<li><a href="${h}">${esc(l)}</a></li>`;
      return MENU.filter(m => !m.perm || App.can(m.perm)).map(m => {
        if (m.href) return `<a class="menu-top" href="${m.href}" data-tip="${esc(m.label)}"><span class="mi">${FX.ic(m.icon)}</span><span class="lbl">${esc(m.label)}</span></a>`;
        const items = typeof m.items === 'function' ? m.items() : m.items;
        return `<div class="menu-group${open[m.id] ? ' open' : ''}"><button class="menu-top" data-group="${m.id}" data-tip="${esc(m.label)}" aria-expanded="${!!open[m.id]}"><span class="mi">${FX.ic(m.icon)}</span><span class="lbl">${esc(m.label)}</span><span class="caret">${FX.ic('chevron-right')}</span></button>
          <ul>${items.map(it => {
            if (!it.sub) return link(it);
            const k = m.id + ':' + it.sub;
            return `<li class="menu-sub${open[k] ? ' open' : ''}"><button class="sub-top" data-sub="${esc(k)}" aria-expanded="${!!open[k]}">${FX.ic(it.icon || 'folder')}<span>${esc(it.sub)}</span><span class="sub-n">${it.items.length}</span>${FX.ic('chevron-down')}</button><ul>${it.items.map(link).join('')}</ul></li>`;
          }).join('')}</ul></div>`;
      }).join('');
    },
    markActive() {
      const h = location.hash.split('?')[0];
      document.querySelectorAll('.menu a').forEach(a => {
        const on = a.getAttribute('href') === h;
        a.classList.toggle('on', on);
        if (on && !document.querySelector('.side.mini')) { a.closest('.menu-group')?.classList.add('open'); a.closest('.menu-sub')?.classList.add('open'); }
      });
    },

    renderLogin() {
      const users = DB.list('usuarios').filter(u => u.ativo !== false);
      const c = DB.cfg();
      const vendasMes = DB.list('vendas', { allUnits: true }).filter(v => v.status === 'Concluída' && String(v.data).slice(0, 7) === UI.today().slice(0, 7)).length;
      const estoque = DB.list('produtos', { allUnits: true }).filter(p => p.tipo === 'Aparelho' && p.quantidade > 0).length;
      const os = DB.list('os', { allUnits: true }).filter(o => !['Finalizada', 'Cancelada'].includes((DB.get('situacoesos', o.situacao_id) || {}).finalidade)).length;
      const h = new Date().getHours();
      document.getElementById('app').innerHTML = `
        <div class="login">
          <section class="login-art" aria-hidden="true">
            <div class="brand"><span class="brand-mark">${esc((c.sistema_nome || 'G').slice(0, 1))}</span><span class="brand-name">${esc(c.sistema_nome || 'Gestor Loja')}</span></div>
            <div><h1>Sua loja inteira em uma tela.</h1><p style="margin-top:14px">Vendas, estoque por IMEI, ordens de serviço, upgrade e financeiro, conversando entre si.</p></div>
            <div class="login-stats"><div><b data-count>${vendasMes}</b><span>vendas no mês</span></div><div><b data-count>${estoque}</b><span>aparelhos em estoque</span></div><div><b data-count>${os}</b><span>OS em aberto</span></div></div>
            <div class="phones"><div class="phone p1"></div><div class="phone p2"></div></div>
          </section>
          <section class="login-side"><form class="login-card">
            <div><h2>${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}!</h2><p class="muted" style="margin:6px 0 0">Entre para começar o dia na loja.</p></div>
            <label class="fld"><span>Usuário</span><select name="u">${users.map(u => `<option value="${u.id}">${esc(u.nome)}</option>`).join('')}</select></label>
            <label class="fld"><span>Senha</span><input name="p" type="password" autocomplete="current-password" required></label>
            <button class="btn primary block">${FX.ic('log-in')}Entrar</button>
            <p class="muted small">Primeiro acesso: usuário Gerente, senha 1234. Troque em Configurações → Gestão de acesso.</p>
          </form></section>
        </div>`;
      const f = document.querySelector('.login-card');
      f.p.focus();
      f.onsubmit = e => {
        e.preventDefault();
        const u = DB.get('usuarios', f.u.value);
        if (!u || String(u.senha) !== f.p.value) { UI.toast('Senha incorreta', 'erro'); f.p.closest('.fld').classList.add('err'); setTimeout(() => f.p.closest('.fld').classList.remove('err'), 600); f.p.select(); return; }
        DB.setMeta({ user_id: u.id });
        if (u.unidades && u.unidades.length && !u.unidades.includes(DB.unitId())) DB.setUnit(u.unidades[0]);
        DB.raw('acessos').push({ id: DB.nextId('acessos'), login: u.login || u.nome, entrada: new Date().toISOString(), acao: 'Entrada', navegador: navigator.userAgent.slice(0, 80) });
        DB.persist('acessos');
        App.render();
      };
    },

    render() {
      const u = DB.user();
      if (!u) { App.shellUser = null; App.renderLogin(); return; }
      if (!document.getElementById('content') || App.shellUser !== u.id || App.shellUnit !== DB.unitId() || App.needShell) { App.needShell = false; App.renderShell(); }
      const h = (location.hash || '#/inicio').slice(1).split('?')[0];
      const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
      // área de conteúdo nova a cada tela: descarta ouvintes de eventos da tela anterior
      const old = document.getElementById('content');
      const el = old.cloneNode(false);
      old.replaceWith(el);
      for (const r of routes) {
        const m = h.match(r.rx);
        if (m) {
          const p = {}; r.keys.forEach((k, i) => p[k] = decodeURIComponent(m[i + 1]));
          el.classList.add('enter');
          try { r.fn(el, p, qs); }
          catch (err) { console.error(err); el.innerHTML = `<div class="card"><h2>Erro ao abrir a tela</h2><pre class="small">${esc(err.stack || err)}</pre></div>`; }
          App.markActive(); App.updateBell(); el.focus({ preventScroll: true }); window.scrollTo(0, 0);
          return;
        }
      }
      el.innerHTML = `<div class="card empty">Tela não encontrada. <a href="#/inicio">Voltar ao início</a></div>`;
    }
  };

  /* Rotas genéricas de cadastro */
  App.route('/c/:key', (el, p) => {
    if (!CRUD.S[p.key]) { el.innerHTML = '<div class="card empty">Cadastro não encontrado.</div>'; return; }
    const sc = CRUD.S[p.key];
    if (sc.perm && !App.can(sc.perm)) { el.innerHTML = '<div class="card empty">Seu perfil não tem acesso a esta tela.</div>'; return; }
    CRUD.list(p.key, el);
  });
  App.route('/c/:key/:id', (el, p) => {
    const sc = CRUD.S[p.key];
    if (!sc) { el.innerHTML = '<div class="card empty">Cadastro não encontrado.</div>'; return; }
    if (sc.customForm) { sc.customForm(el, p.id); return; }
    CRUD.form(p.key, p.id, el);
  });
  App.route('/embreve/:nome', (el, p) => {
    el.innerHTML = App.pageHead(p.nome, 'Ferramentas') + `<div class="card empty">Esta função está prevista para uma próxima versão.</div>`;
  });

  window.App = App;
})();
