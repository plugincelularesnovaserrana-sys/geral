/* =====================================================================
   Plataforma Plugin Celulares — funcionamento do shell
   - Cada ferramenta abre num quadro próprio e continua aberta em "abas"
     (trocar de aba não recarrega nem perde o que foi digitado).
   - Sites externos (Mercado Phone, Kommo, Clicksign...) abrem numa aba nova.
   - Endereços: #/  (início)   #/t/<id>   #/t/<id>/<tela interna codificada>
   ===================================================================== */
(function () {
  'use strict';
  const R = window.PLATAFORMA_REGISTRO;
  const F = R.F;
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const MAX_ABAS = 10;

  /* ---------- armazenamento local (só conveniências deste navegador) ---------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('plataforma:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('plataforma:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  let favoritos = LS.get('favoritos', []).filter((id) => F[id]);
  let recentes = LS.get('recentes', []).filter((id) => F[id]);
  let gruposAbertos = LS.get('grupos', { 'Sistemas': true });

  /* ---------- utilitários ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ic = (nome, cls) => `<i data-lucide="${esc(nome || 'circle')}"${cls ? ` class="${cls}"` : ''}></i>`;
  const icones = (raiz) => { try { window.lucide && window.lucide.createIcons({ root: raiz || document }); } catch (e) {} };
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let tAviso;
  function aviso(msg) { const a = $('avisoFlutuante'); a.textContent = msg; a.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => (a.hidden = true), 2600); }

  /* ---------- abas / quadros ---------- */
  const abas = []; // {id, frame}
  let ativa = null; // id da aba ativa ou null (início)

  function abrir(id, hashInterno, opts) {
    const f = F[id];
    if (!f) return irInicio();
    marcarRecente(id);
    if (f.externo) { window.open(f.url, '_blank', 'noopener'); aviso(`${f.nome} aberto em nova aba do navegador`); return; }
    let aba = abas.find((a) => a.id === id);
    if (!aba) {
      if (abas.length >= MAX_ABAS) fecharAba(abas.find((a) => a.id !== ativa).id, true);
      aba = { id, frame: null };
      abas.push(aba);
    }
    if (!aba.frame) {
      const fr = document.createElement('iframe');
      fr.title = f.nome;
      fr.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
      fr.src = f.url + (hashInterno || '');
      $('area').classList.add('carregando');
      fr.addEventListener('load', () => {
        if (ativa === id) $('area').classList.remove('carregando');
        // atalhos da plataforma também funcionam com o foco dentro da ferramenta
        // (a Gestão tem o próprio Ctrl+K; nela o atalho continua sendo o dela)
        try {
          fr.contentWindow.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.defaultPrevented) { e.preventDefault(); abrirPaleta(); }
            else if (e.key === 'Escape' && app.classList.contains('tela-cheia')) telaCheia(false);
          });
        } catch (e) {}
      });
      $('quadros').appendChild(fr);
      aba.frame = fr;
    } else if (hashInterno) {
      try { aba.frame.contentWindow.location.hash = hashInterno; } catch (e) { aba.frame.src = f.url + hashInterno; }
    }
    ativar(id, opts && opts.semHash);
  }

  function ativar(id, semHash) {
    ativa = id;
    // tira o foco de um quadro que vai ficar escondido (senão o teclado continua indo para ele)
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') document.activeElement.blur();
    abas.forEach((a) => a.frame && a.frame.classList.toggle('visivel', a.id === id));
    $('inicio').hidden = !!id;
    $('barraFerramenta').hidden = !id;
    if (!id) $('area').classList.remove('carregando');
    if (id) {
      const f = F[id];
      $('trilha').innerHTML = `${esc(caminhoDe(id))} <b>${esc(f.nome)}</b>`;
      $('btFav').classList.toggle('on', favoritos.includes(id));
      document.title = f.nome + ' — Plugin Celulares';
      const hAlvo = '#/t/' + id;
      if (!semHash && !location.hash.startsWith(hAlvo)) history.replaceState(null, '', hAlvo);
    } else {
      document.title = 'Plugin Celulares — Plataforma';
      renderInicio();
    }
    renderAbas(); marcarMenu(); salvarAbas();
    fecharMenuMobile();
  }

  function fecharAba(id, silencioso) {
    const i = abas.findIndex((a) => a.id === id); if (i < 0) return;
    const [a] = abas.splice(i, 1);
    if (a.frame) a.frame.remove();
    if (ativa === id && !silencioso) {
      const prox = abas[i] || abas[i - 1];
      if (prox) { location.hash = '#/t/' + prox.id; } else irInicio();
    }
    renderAbas(); salvarAbas();
  }

  function irInicio() { if (location.hash !== '#/') location.hash = '#/'; else ativar(null); }

  function renderAbas() {
    $('abas').innerHTML = abas.map((a) => {
      const f = F[a.id];
      return `<div class="aba${a.id === ativa ? ' ativa' : ''}" role="tab" aria-selected="${a.id === ativa}" data-aba="${a.id}" title="${esc(f.nome)}">${ic(f.icone)}<span>${esc(f.nome)}</span><button class="fechar" data-fechar="${a.id}" aria-label="Fechar ${esc(f.nome)}">${ic('x')}</button></div>`;
    }).join('');
    icones($('abas'));
  }
  $('abas').addEventListener('click', (e) => {
    const x = e.target.closest('[data-fechar]'); if (x) { e.stopPropagation(); return fecharAba(x.dataset.fechar); }
    const a = e.target.closest('[data-aba]'); if (a) location.hash = '#/t/' + a.dataset.aba;
  });
  $('abas').addEventListener('auxclick', (e) => { const a = e.target.closest('[data-aba]'); if (a && e.button === 1) fecharAba(a.dataset.aba); });

  function salvarAbas() { LS.set('abas', { lista: abas.map((a) => a.id), ativa }); }

  /* ---------- rotas ---------- */
  function rota() {
    const h = location.hash.replace(/^#\/?/, '');
    const m = /^t\/([^/]+)(?:\/(.*))?$/.exec(h);
    if (m && F[m[1]]) {
      const interno = m[2] ? decodeURIComponent(m[2]) : '';
      if (F[m[1]].externo) { abrir(m[1]); history.replaceState(null, '', ativa ? '#/t/' + ativa : '#/'); if (!ativa) ativar(null, true); return; }
      const ja = abas.find((a) => a.id === m[1] && a.frame);
      if (ja && !interno) return ativar(m[1], true);
      abrir(m[1], interno, { semHash: true });
      if (interno) history.replaceState(null, '', '#/t/' + m[1]);
    } else ativar(null, true);
  }
  window.addEventListener('hashchange', rota);

  const hrefDe = (id, hash) => '#/t/' + id + (hash ? '/' + encodeURIComponent(hash) : '');

  /* ---------- menu lateral ---------- */
  const caminhos = {}; // id -> "Grupo › Sub ›"
  function renderMenu() {
    const item = (id, trilha) => {
      const f = F[id]; if (!f) return '';
      if (!caminhos[id]) caminhos[id] = trilha.join(' › ') + ' ›';
      return `<a class="item" data-id="${id}" href="${hrefDe(id)}" ${f.externo ? 'target="_blank" rel="noopener"' : ''} title="${esc(f.desc || f.nome)}">${ic(f.icone)}<span>${esc(f.nome)}</span>${f.externo ? ic('external-link', 'ext') : ''}</a>`;
    };
    const lista = (itens, trilha) => itens.map((it) => typeof it === 'string' ? item(it, trilha)
      : `<details class="sub"${gruposAbertos[trilha.concat(it.titulo).join('/')] ? ' open' : ''} data-chave="${esc(trilha.concat(it.titulo).join('/'))}"><summary>${esc(it.titulo)}<i class="seta"></i></summary><div class="grupo-itens">${lista(it.itens, trilha.concat(it.titulo))}</div></details>`).join('');
    $('menu').innerHTML = R.MENU.map((g) => `<details class="grupo"${gruposAbertos[g.titulo] ? ' open' : ''} data-chave="${esc(g.titulo)}"><summary title="${esc(g.titulo)}">${ic(g.icone)}<span>${esc(g.titulo)}</span><i class="seta"></i></summary><div class="grupo-itens">${lista(g.itens, [g.titulo])}</div></details>`).join('');
    icones($('menu'));
    $('menu').addEventListener('toggle', (e) => {
      const d = e.target; if (!d.dataset || !d.dataset.chave) return;
      gruposAbertos[d.dataset.chave] = d.open; LS.set('grupos', gruposAbertos);
    }, true);
    $('menu').addEventListener('click', (e) => {
      const a = e.target.closest('a.item'); if (!a) return;
      const f = F[a.dataset.id];
      if (f.externo) { marcarRecente(f.id); fecharMenuMobile(); return; } // o próprio link abre a aba nova
      if (app.classList.contains('menu-recolhido')) return;
    });
    // menu recolhido: clicar no ícone do grupo expande o menu
    $('menu').addEventListener('click', (e) => {
      if (!app.classList.contains('menu-recolhido')) return;
      const s = e.target.closest('.grupo>summary'); if (!s) return;
      e.preventDefault(); app.classList.remove('menu-recolhido'); LS.set('recolhido', false);
      s.parentElement.open = true;
    });
  }
  const caminhoDe = (id) => caminhos[id] || '';
  function marcarMenu() { document.querySelectorAll('.item').forEach((a) => a.classList.toggle('ativo', a.dataset.id === ativa)); }

  /* ---------- favoritos / recentes ---------- */
  function marcarRecente(id) { recentes = [id].concat(recentes.filter((x) => x !== id)).slice(0, 8); LS.set('recentes', recentes); }
  $('btFav').addEventListener('click', () => {
    if (!ativa) return;
    const on = favoritos.includes(ativa);
    favoritos = on ? favoritos.filter((x) => x !== ativa) : favoritos.concat(ativa);
    LS.set('favoritos', favoritos); $('btFav').classList.toggle('on', !on);
    aviso(on ? 'Removido dos favoritos' : 'Adicionado aos favoritos (aparece no Início)');
  });
  $('btRecarregar').addEventListener('click', () => {
    const a = abas.find((x) => x.id === ativa); if (!a || !a.frame) return;
    $('area').classList.add('carregando');
    try { a.frame.contentWindow.location.reload(); } catch (e) { a.frame.src = a.frame.src; }
  });
  $('btNovaAba').addEventListener('click', () => {
    const a = abas.find((x) => x.id === ativa); if (!a) return;
    let url = F[a.id].url; try { url = a.frame.contentWindow.location.href; } catch (e) {}
    window.open(url, '_blank', 'noopener');
  });

  /* ---------- tela cheia ---------- */
  let btSair = null;
  function telaCheia(on) {
    app.classList.toggle('tela-cheia', on);
    if (on && !btSair) {
      btSair = document.createElement('button');
      btSair.className = 'icone-btn sair-tela'; btSair.title = 'Sair da tela cheia';
      btSair.style.cssText = 'background:#13203a;border:1px solid rgba(69,243,255,.25);width:40px;height:40px;border-radius:50%';
      btSair.innerHTML = ic('minimize-2'); document.body.appendChild(btSair); icones(btSair);
      btSair.onclick = () => telaCheia(false);
    } else if (!on && btSair) { btSair.remove(); btSair = null; }
  }
  $('btTela').addEventListener('click', () => telaCheia(true));

  /* ---------- menu: recolher / celular ---------- */
  if (LS.get('recolhido', false)) app.classList.add('menu-recolhido');
  $('recolher').addEventListener('click', () => { const on = !app.classList.contains('menu-recolhido'); app.classList.toggle('menu-recolhido', on); LS.set('recolhido', on); });
  $('abrirMenu').addEventListener('click', () => app.classList.add('menu-aberto'));
  $('fecharMenu').addEventListener('click', fecharMenuMobile);
  $('veu').addEventListener('click', fecharMenuMobile);
  function fecharMenuMobile() { app.classList.remove('menu-aberto'); }

  /* ---------- busca (Ctrl+K) ---------- */
  const indice = [];
  (function montarIndice() {
    const vistos = new Set();
    R.MENU.forEach(function andar(g) {
      (g.itens || []).forEach((it) => {
        if (typeof it !== 'string') return andar(it);
        if (vistos.has(it) || !F[it]) return; vistos.add(it);
        const f = F[it];
        indice.push({ tipo: 'Ferramentas', id: it, nome: f.nome, sub: (caminhoDe(it) || '').replace(/ ›$/, '') + (f.desc ? ' — ' + f.desc : ''), icone: f.icone, externo: f.externo, txt: norm([f.nome, f.desc, f.tags, caminhoDe(it)].join(' ')) });
      });
    });
    R.FIN_TELAS.forEach((t) => indice.push({ tipo: 'Controle Financeiro — telas', id: t.ferramenta, hash: t.hash, nome: t.nome, sub: t.caminho, icone: 'landmark', txt: norm(t.nome + ' ' + t.caminho + ' financeiro') }));
    R.GESTAO_TELAS.forEach((t) => indice.push({ tipo: 'Gestão da Loja — telas', id: t.ferramenta, hash: t.hash, nome: t.nome, sub: t.caminho, icone: 'store', txt: norm(t.nome + ' ' + t.caminho) }));
  })();

  let resultados = [], sel = 0;
  function abrirPaleta() { $('paleta').hidden = false; $('paletaInput').value = ''; $('paletaInput').focus(); buscar(''); }
  function fecharPaleta() { $('paleta').hidden = true; }
  function realce(txt, termos) {
    let h = esc(txt); if (!termos.length) return h;
    const n = norm(txt); const marcas = [];
    termos.forEach((t) => { const i = n.indexOf(t); if (i >= 0) marcas.push([i, i + t.length]); });
    if (!marcas.length) return h;
    marcas.sort((a, b) => a[0] - b[0]); let out = '', p = 0;
    marcas.forEach(([a, b]) => { if (a < p) return; out += esc(txt.slice(p, a)) + '<mark>' + esc(txt.slice(a, b)) + '</mark>'; p = b; });
    return out + esc(txt.slice(p));
  }
  function buscar(q) {
    const termos = norm(q).split(/\s+/).filter(Boolean);
    if (!termos.length) {
      const pegar = (ids, tipo) => ids.map((id) => indice.find((x) => x.id === id && !x.hash)).filter(Boolean).map((x) => Object.assign({}, x, { tipo }));
      resultados = pegar(favoritos, 'Favoritos').concat(pegar(recentes.filter((id) => !favoritos.includes(id)), 'Recentes'))
        .concat(R.ATALHOS.map((a) => ({ tipo: 'Atalhos', id: a.ferramenta, hash: a.hash, nome: a.nome, sub: F[a.ferramenta].nome, icone: a.icone })));
    } else {
      resultados = indice.map((x) => {
        if (!termos.every((t) => x.txt.includes(t))) return null;
        const n = norm(x.nome); let s = 0;
        termos.forEach((t) => { if (n.startsWith(t)) s += 6; else if (n.includes(t)) s += 3; else s += 1; });
        if (x.tipo === 'Ferramentas') s += 2;
        return Object.assign({ s }, x);
      }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 60);
      // agrupa por tipo; o grupo com o melhor resultado vem primeiro
      const melhor = {}; resultados.forEach((r) => { melhor[r.tipo] = Math.max(melhor[r.tipo] || 0, r.s); });
      resultados.sort((a, b) => (melhor[b.tipo] - melhor[a.tipo]) || (a.tipo < b.tipo ? -1 : a.tipo > b.tipo ? 1 : 0) || b.s - a.s);
    }
    sel = 0;
    let grupo = '';
    $('paletaLista').innerHTML = resultados.length ? resultados.map((r, i) => {
      const cab = r.tipo !== grupo ? `<div class="p-grupo">${esc(grupo = r.tipo)}</div>` : '';
      return cab + `<div class="p-item${i === 0 ? ' sel' : ''}" role="option" data-i="${i}">${ic(r.icone)}<span><b>${realce(r.nome, termos)}</b><small>${esc(r.sub || '')}</small></span>${r.externo ? ic('external-link', 'ext') : ''}</div>`;
    }).join('') : `<div class="p-vazio">Nada encontrado para “${esc(q)}”.</div>`;
    icones($('paletaLista'));
  }
  function moverSel(d) {
    if (!resultados.length) return;
    sel = (sel + d + resultados.length) % resultados.length;
    document.querySelectorAll('.p-item').forEach((el) => el.classList.toggle('sel', +el.dataset.i === sel));
    const el = document.querySelector('.p-item.sel'); el && el.scrollIntoView({ block: 'nearest' });
  }
  function escolher(i) {
    const r = resultados[i]; if (!r) return; fecharPaleta();
    if (F[r.id].externo) return abrir(r.id);
    location.hash = hrefDe(r.id, r.hash);
  }
  $('buscaGatilho').addEventListener('click', abrirPaleta);
  $('paletaInput').addEventListener('input', (e) => buscar(e.target.value));
  $('paletaInput').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moverSel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moverSel(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(sel); }
    else if (e.key === 'Escape') fecharPaleta();
  });
  $('paletaLista').addEventListener('click', (e) => { const it = e.target.closest('.p-item'); if (it) escolher(+it.dataset.i); });
  $('paleta').addEventListener('mousedown', (e) => { if (e.target === $('paleta')) fecharPaleta(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('paleta').hidden ? abrirPaleta() : fecharPaleta(); }
    else if (e.key === 'Escape') { if (!$('paleta').hidden) fecharPaleta(); else if (app.classList.contains('tela-cheia')) telaCheia(false); }
  });

  /* ---------- início ---------- */
  function cardFerr(id, extra) {
    const f = F[id];
    return `<a class="ferr" href="${hrefDe(id)}" data-id="${id}" ${f.externo ? 'target="_blank" rel="noopener"' : ''}>${ic(f.icone)}<span><b>${esc(f.nome)}</b>${(extra || f.desc) ? `<small>${esc(extra || f.desc)}</small>` : ''}</span>${f.externo ? ic('external-link', 'ext') : ''}</a>`;
  }
  function renderInicio() {
    const hoje = new Date();
    const data = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const h = hoje.getHours(); const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const sis = [
      ['gestao', 'vGestao'], ['financeiro', 'vFin'], ['vitrine', 'vVitrine'], ['tabelas', 'vTabelas']
    ].map(([id, vid]) => { const f = F[id]; return `<a class="card-sis" href="${hrefDe(id)}"><div class="ic">${ic(f.icone)}</div><div><h3>${esc(f.nome.replace(' — catálogo completo', ''))}</h3><p>${esc(f.desc)}</p></div><div class="vivo" id="${vid}"><span class="ponto"></span>…</div></a>`; }).join('');
    const chips = R.ATALHOS.map((a) => `<a class="chip" href="${hrefDe(a.ferramenta, a.hash)}">${ic(a.icone)}${esc(a.nome)}${a.hash ? `<small>· ${esc(F[a.ferramenta].nome.split(' ')[0] === 'Gestão' ? 'Gestão' : 'Financeiro')}</small>` : ''}</a>`).join('');
    const fav = favoritos.length ? `<div class="grade">${favoritos.map((id) => cardFerr(id)).join('')}</div>` : `<p class="vazio">Abra uma ferramenta e clique na estrela ☆ para fixá-la aqui.</p>`;
    const rec = recentes.length ? `<div class="grade">${recentes.map((id) => cardFerr(id)).join('')}</div>` : `<p class="vazio">As ferramentas que você usar vão aparecer aqui.</p>`;
    const todas = R.MENU.filter((g) => g.titulo !== 'Sistemas').map((g) => {
      const ids = []; const sub = {};
      (function andar(itens, nome) { itens.forEach((it) => { if (typeof it === 'string') { if (!ids.includes(it)) { ids.push(it); sub[it] = nome; } } else andar(it.itens, it.titulo); }); })(g.itens, '');
      return `<div class="secao"><h2>${ic(g.icone)} ${esc(g.titulo)}</h2><div class="grade">${ids.map((id) => cardFerr(id, sub[id] ? sub[id] + (F[id].desc ? ' — ' + F[id].desc : '') : '')).join('')}</div></div>`;
    }).join('');
    $('inicio').innerHTML = `
      <div class="ini-cab"><div><h1>${saud}!</h1><p>${esc(data.charAt(0).toUpperCase() + data.slice(1))} · ${esc(R.unidade)}</p></div></div>
      <div class="secao" style="margin-top:0"><h2>Sistemas</h2><div class="sistemas">${sis}</div></div>
      <div class="secao"><h2>Atalhos <small>abrem direto na tela certa</small></h2><div class="atalhos">${chips}</div></div>
      <div class="secao"><h2>${ic('star')} Favoritos</h2>${fav}</div>
      <div class="secao"><h2>${ic('clock')} Usadas recentemente</h2>${rec}</div>
      ${todas}
      <div class="dica"><b>Dicas:</b> <b>Ctrl + K</b> busca qualquer ferramenta e também as telas internas da Gestão e do Financeiro (ex.: “inadimplência”, “nova venda”, “DRE”). As ferramentas abertas ficam em abas no topo — trocar de aba não perde o que foi digitado. Sites externos abrem numa aba nova do navegador.</div>`;
    icones($('inicio'));
    vivos();
  }
  $('inicio').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]'); if (a && F[a.dataset.id].externo) marcarRecente(a.dataset.id);
  });

  /* indicadores ao vivo (somente leitura) */
  function setVivo(id, html, ok) { const el = $(id); if (el) el.innerHTML = `<span class="ponto${ok ? ' ok' : ''}"></span>${html}`; }
  function vivos() {
    // Gestão da Loja: os dados ficam neste navegador (gc:c:vendas)
    try {
      const vendas = JSON.parse(localStorage.getItem('gc:c:vendas') || 'null');
      if (Array.isArray(vendas)) {
        const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
        const hojeS = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; const mesS = hojeS.slice(0, 7);
        const ok = vendas.filter((v) => v && v.status === 'Concluída');
        const hojeV = ok.filter((v) => String(v.data || '').slice(0, 10) === hojeS);
        const mesT = ok.filter((v) => String(v.data || '').slice(0, 7) === mesS).reduce((s, v) => s + (Number(v.total) || 0), 0);
        setVivo('vGestao', `Hoje: <b>${hojeV.length}</b> venda${hojeV.length === 1 ? '' : 's'} · mês <b>${brl(mesT)}</b>`, true);
      } else setVivo('vGestao', 'Dados guardados neste navegador');
    } catch (e) { setVivo('vGestao', 'Dados guardados neste navegador'); }
    setVivo('vFin', 'Login próprio · tempo real (Firebase)', true);
    fetch('https://raw.githubusercontent.com/plugincelularesnovaserrana-sys/Vitrine/main/produtos.json?t=' + Date.now())
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j) => { const p = (j.produtos || []).filter((x) => x.disponivel !== false); const b = p.filter((x) => x.boleto && x.boleto.parcela).length; setVivo('vVitrine', `<b>${p.length}</b> aparelhos · <b>${b}</b> no boleto`, true); })
      .catch(() => setVivo('vVitrine', 'Catálogo público (boleto, cartão, completo)'));
    fetch('tabelas-preco/tabelas_atualizadas.json?t=' + Date.now())
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j) => { const d = j.ultima_atualizacao ? new Date(j.ultima_atualizacao) : null; setVivo('vTabelas', d ? `Atualizada em <b>${d.toLocaleDateString('pt-BR')}</b> às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Tabelas de aparelhos e acessórios', !!d); })
      .catch(() => setVivo('vTabelas', 'Tabelas de aparelhos e acessórios'));
  }

  /* ---------- API usada pelas páginas antigas ---------- */
  window.PLATAFORMA = {
    // chamado quando uma ferramenta antiga clica em "voltar" (carrega index.html dentro do quadro)
    voltarDe(win) {
      const a = abas.find((x) => x.frame && x.frame.contentWindow === win);
      setTimeout(() => { if (a) fecharAba(a.id, true); irInicio(); }, 0);
    },
    abrir: (id, hash) => { location.hash = hrefDe(id, hash); },
    inicio: irInicio
  };

  /* ---------- partida ---------- */
  $('unidade').textContent = R.unidade;
  renderMenu();
  const salvo = LS.get('abas', null);
  if (salvo && Array.isArray(salvo.lista)) salvo.lista.filter((id) => F[id] && !F[id].externo).slice(0, MAX_ABAS).forEach((id) => abas.push({ id, frame: null }));
  if ((!location.hash || location.hash === '#') && salvo && salvo.ativa && F[salvo.ativa] && abas.some((a) => a.id === salvo.ativa)) {
    history.replaceState(null, '', '#/t/' + salvo.ativa);
  }
  icones();
  rota();
})();
