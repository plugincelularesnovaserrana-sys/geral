/* Catálogo Plugin Celulares
   Um único script para as três vitrines. Cada página escolhe o modo em <body data-modo="...">:
     completo -> index.html  (à vista + cartão + boleto)
     boleto   -> boleto.html (só entrada mínima + parcelas do boleto)
     cartao   -> cartao.html (à vista com desconto + cartão em até 18x)
   Todas leem a mesma lista (produtos.json) que o admin.html grava. */

/* ============ CONFIGURAÇÃO ============ */
const CONFIG = {
  loja: "Plugin Celulares",
  slogan: "Aparelhos com garantia",
  instagram: "",                  // ex.: "@minhaloja" (opcional)
  cidade: "",                     // ex.: "Nova Serrana - MG" (opcional)
  selos: ["Pronta entrega"],      // etiquetas abaixo do nome (valem para todas as vitrines)
  logo: "LOGO.png",               // arquivo dentro de assets/ (se não existir, usa a inicial da loja)
  whatsapp: "5537991385331",      // DDI + DDD + número, só dígitos
  pastaMidias: "assets/",
  listaUrl: "https://raw.githubusercontent.com/plugincelularesnovaserrana-sys/Vitrine/main/produtos.json", // vazio = demonstração
  token: "",                      // use um token só de leitura
  tokenModo: "query",             // "query" (?token=) ou "header" (Authorization: Bearer)
  sistemaUrl: "",                 // sistema a embutir (vazio = seção oculta)
  sistemaTitulo: "Nosso sistema",
  boletoMax: 15,                  // maior número de parcelas no boleto (etiqueta do cabeçalho)
  cartaoMax: 18,                  // máximo de parcelas no cartão (etiqueta do cabeçalho)
  faixasBoleto: [200, 250, 300, 350, 400, 500]   // filtro "Parcela até" do catálogo do boleto
};

/* Textos de cada vitrine */
const MODOS = {
  completo: {
    titulo: "Aparelhos disponíveis",
    selos: () => [`Boleto até ${CONFIG.boletoMax}x`, `Cartão em até ${CONFIG.cartaoMax}x`],
    rodape: "Valores e disponibilidade sujeitos a confirmação no atendimento.",
    zap: "Olá! Vim pela vitrine e quero tirar uma dúvida.",
    botao: "Quero este"
  },
  boleto: {
    titulo: "Celular no boleto",
    selos: () => [`Boleto em até ${CONFIG.boletoMax}x`, "Seu usado vale como entrada"],
    rodape: "Entrada e parcelas sujeitas à análise de crédito. Disponibilidade confirmada no atendimento.",
    zap: "Olá! Vim pelo catálogo do boleto e quero entender como funciona.",
    botao: "Quero no boleto"
  },
  cartao: {
    titulo: "À vista e no cartão",
    selos: () => [`Cartão em até ${CONFIG.cartaoMax}x`, "Desconto no PIX"],
    rodape: "Valores e disponibilidade sujeitos a confirmação no atendimento.",
    zap: "Olá! Vim pelo catálogo e quero tirar uma dúvida.",
    botao: "Quero este"
  }
};
const MODO = MODOS[document.body.dataset.modo] ? document.body.dataset.modo : "completo";
const M = MODOS[MODO];

/* ============ DEMONSTRAÇÃO ============ */
const DEMO = [
  {modelo:"iPhone 13", detalhes:"128GB", condicao:"Seminovo", preco:2890, cores:"Meia-noite", bateria:89, observacao:"Pequeno risco na lateral", boleto:{entrada:600, parcelas:15, parcela:215}},
  {modelo:"iPhone 14 Pro", detalhes:"256GB", condicao:"Seminovo", preco:4290, cores:"Preto", bateria:92, boleto:{entrada:900, parcelas:15, parcela:320}},
  {modelo:"Galaxy A55", detalhes:"256GB", condicao:"Novo", preco:1990, fotos:"a55.jpg", cores:"Azul", boleto:{entrada:450, parcelas:11, parcela:199}},
  {modelo:"Redmi Note 14", detalhes:"256GB", condicao:"Novo", preco:1390, fotos:"note14.jpg", cores:"Preto", observacao:"Lacrado com nota fiscal"}
];

/* ============ UTILITÁRIOS ============ */
const $ = id => document.getElementById(id);
const brl = n => n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const semFoto = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="38" y="14" width="44" height="92" rx="8" fill="none" stroke="#9aa0ad" stroke-width="3"/><circle cx="60" cy="94" r="3" fill="#9aa0ad"/></svg>');
const ICONE_ZAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.4-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2 1.3 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z"/></svg>';
const ICONE_BAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/></svg>';

const MAPA_CORES = {
  "preto":"#1c1c1e","branco":"#f5f5f0","azul":"#3b6fd8","rosa":"#f4b8c8","verde":"#4f7a5a","amarelo":"#f2d86b",
  "vermelho":"#c8332f","roxo":"#8b6bc9","dourado":"#d9bf94","prata":"#d5d7db","cinza":"#8e9096","laranja":"#e8873a",
  "meia-noite":"#232a35","estelar":"#e6e0d4","ultramarino":"#6a6bf0","titânio natural":"#b9ad9d","titânio azul":"#4b5468",
  "titânio preto":"#3a3a3c","titânio branco":"#e4e2dc","titanio natural":"#b9ad9d","titanio azul":"#4b5468",
  "titanio preto":"#3a3a3c","titanio branco":"#e4e2dc","lilás":"#c4a1ff","lilas":"#c4a1ff","azul-claro":"#7dd3fc",
  "bege":"#e8d8b8","marrom":"#7a4a2a"
};

function paraNumero(v){
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[^\d,.-]/g,"");
  if (s.includes(",")) s = s.replace(/\./g,"").replace(",",".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
const lista = v => Array.isArray(v) ? v.map(String) : String(v ?? "").split(",").map(x => x.trim()).filter(Boolean);

const rotuloCond = c => {
  const k = String(c || "").trim().toLowerCase();
  if (["novo","novos","lacrado","lacrados"].includes(k)) return "Novo";
  if (["seminovo","seminovos","usado"].includes(k)) return "Seminovo";
  return String(c || "").trim();
};
const plural = c => c === "Novo" ? "Novos" : c === "Seminovo" ? "Seminovos" : c;

// Fotos: se o aparelho não trouxer fotos, usa assets/<modelo em minúsculas>.png
const arquivoDoModelo = m => m.toLowerCase().replace(/\s+/g, " ").trim() + ".png";
function fotosDe(valor, modelo){
  const l = lista(valor).map(f => /\.[a-z0-9]{3,4}$/i.test(f) || /^(https?:|data:|\/)/.test(f) ? f : f + ".png");
  return l.length ? l : (modelo ? [arquivoDoModelo(modelo)] : []);
}

// boleto já calculado no admin: {entrada, parcelas, parcela}
function lerBoleto(b){
  if (!b || typeof b !== "object") return null;
  const parcela = paraNumero(b.parcela), parcelas = parseInt(b.parcelas, 10), entrada = paraNumero(b.entrada);
  return parcela > 0 && parcelas > 0 ? {entrada: entrada > 0 ? entrada : 0, parcelas, parcela} : null;
}
// Cartão: calculado sozinho a partir do preço à vista e das taxas (%) definidas no admin
// produtos.json -> "cartao": {"taxa10": 8, "taxa18": 15}  (acréscimo em % sobre o preço à vista)
let TAXAS = {};
function definirTaxas(c){
  TAXAS = {};
  if (!c || typeof c !== "object") return;
  [10, 18].forEach(n => {
    const v = c["taxa" + n];
    if (v === "" || v == null) return;
    const t = paraNumero(v);
    if (t >= 0) TAXAS[n] = t;
  });
}
function calcCartao(preco){
  if (!(preco > 0)) return [];
  return Object.keys(TAXAS).map(Number).sort((a, b) => a - b).map(n => {
    const total = Math.round(preco * (1 + TAXAS[n] / 100) * 100) / 100;
    return {parcelas: n, parcela: Math.ceil(+(total / n * 100).toFixed(6)) / 100, total};
  });
}
const textoCartao = c => c.map(o => `${o.parcelas}x de ${brl(o.parcela)}`).join(" ou ");

function normalizar(p){
  const nd = String(p.disponivel ?? "").toLowerCase();
  const modelo = String(p.modelo ?? p.nome ?? "").trim();
  const cond = rotuloCond(p.condicao ?? p.condição);
  const familia = String(p.familia ?? "").trim() || (/^iphone/i.test(modelo) || p.plataforma === "Apple" ? "iPhone" : "Android");
  const bat = Math.round(paraNumero(p.bateria));
  return {
    familia,
    grupo: (familia + " " + plural(cond)).trim(),
    modelo,
    marca: familia === "iPhone" ? "" : String(p.marca ?? "").trim(),
    detalhes: String(p.detalhes ?? p.descricao ?? "").trim(),
    condicao: cond,
    preco: paraNumero(p.preco ?? p.avista),
    bateria: bat >= 1 && bat <= 100 ? bat : null,
    observacao: String(p.observacao ?? p.obs ?? "").trim(),
    cartao: calcCartao(paraNumero(p.preco ?? p.avista)),
    boleto: lerBoleto(p.boleto),
    fotos: fotosDe(p.fotos ?? p.foto, modelo),
    cores: lista(p.cores),
    disponivel: !(p.disponivel === false || nd === "nao" || nd === "não")
  };
}

// JSON (lista ou {produtos:[...]}) ou texto, uma linha por aparelho:
// modelo | detalhes | condição | preço | foto1,foto2 | cor1,cor2 | bateria | observação
function lerLista(texto){
  const t = texto.trim();
  if (t.startsWith("[") || t.startsWith("{")){
    const j = JSON.parse(t);
    definirTaxas(Array.isArray(j) ? null : j.cartao);
    return (Array.isArray(j) ? j : (j.produtos || j.items || [])).map(normalizar);
  }
  return t.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
    const c = l.split("|").map(x => x.trim());
    return normalizar({modelo:c[0], detalhes:c[1], condicao:c[2], preco:c[3], fotos:c[4], cores:c[5], bateria:c[6], observacao:c[7]});
  });
}

async function carregar(){
  if (!CONFIG.listaUrl){
    $("aviso").hidden = false;
    $("aviso").textContent = "Modo demonstração: defina CONFIG.listaUrl para carregar a lista real.";
    definirTaxas({taxa10: 8, taxa18: 15});
    return DEMO.map(normalizar);
  }
  const headers = {};
  let url = CONFIG.listaUrl;
  if (CONFIG.token){
    if (CONFIG.tokenModo === "header") headers.Authorization = "Bearer " + CONFIG.token;
    else url += (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(CONFIG.token);
  }
  const r = await fetch(url, {headers, cache:"no-store"});
  if (!r.ok) throw new Error("HTTP " + r.status);
  return lerLista(await r.text());
}

/* ============ RENDERIZAÇÃO ============ */
let produtos = [], abaAtiva = "Todos os produtos", faixaAtiva = 0;

const urlFoto = f => !f ? semFoto : (/^(https?:|data:|\/)/.test(f) ? f : CONFIG.pastaMidias + (f.includes("%") ? f : encodeURI(f)));
// Endereço das fotos no GitHub (mesma pasta da lista): usado se a foto não existir ao lado da página
const urlRemota = f => {
  if (!f || !CONFIG.listaUrl || /^(https?:|data:|\/)/.test(f)) return "";
  return CONFIG.listaUrl.replace(/[^\/?#]*(\?.*)?$/, "") + CONFIG.pastaMidias + (f.includes("%") ? f : encodeURI(f));
};

function linkZap(texto){ return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`; }
const nomeCompleto = p => p.marca && !p.modelo.toLowerCase().startsWith(p.marca.toLowerCase()) ? p.marca + " " + p.modelo : p.modelo;

// Mensagem que já chega pronta no WhatsApp. No boleto não usamos a palavra "compra".
function msgProduto(p){
  const extra = [p.detalhes, p.condicao, p.bateria ? `bateria ${p.bateria}%` : ""].filter(Boolean).join(", ");
  const nome = `*${nomeCompleto(p)}*${extra ? " (" + extra + ")" : ""}`;
  if (MODO === "boleto" && p.boleto){
    // Catálogo é enviado no meio da conversa: a mensagem só informa o aparelho escolhido, para o vendedor seguir daí.
    const b = p.boleto;
    const cor = p.cores.length === 1 ? p.cores[0] : (p.cores.length > 1 ? "cor a escolher" : "");
    const ficha = [p.detalhes, cor, p.condicao, p.bateria ? `bateria ${p.bateria}%` : ""].filter(Boolean).join(" · ");
    const cond = (b.entrada > 0 ? `Entrada a partir de ${brl(b.entrada)} + ` : "") + `${b.parcelas}x de ${brl(b.parcela)} no boleto`;
    return `Escolhi este no catálogo do boleto 👇\n\n📱 *${nomeCompleto(p)}*${ficha ? "\n" + ficha : ""}\n💰 ${cond}`;
  }
  if (MODO === "cartao"){
    // Mesmo formato do boleto: só informa o aparelho escolhido para o vendedor seguir daí.
    const cor = p.cores.length === 1 ? p.cores[0] : (p.cores.length > 1 ? "cor a escolher" : "");
    const ficha = [p.detalhes, cor, p.condicao, p.bateria ? `bateria ${p.bateria}%` : ""].filter(Boolean).join(" · ");
    const valores = `${brl(p.preco)} à vista` + (p.cartao.length ? ` ou ${textoCartao(p.cartao)} no cartão` : "");
    return `Escolhi este no catálogo 👇\n\n📱 *${nomeCompleto(p)}*${ficha ? "\n" + ficha : ""}\n💰 ${valores}`;
  }
  return `Olá! Tenho interesse no ${nome} por ${brl(p.preco)} à vista. Ainda está disponível?`;
}

// Acha onde o aparelho está dentro da foto (ignora o fundo branco/transparente) e
// ajusta o zoom e a posição para todos os aparelhos ocuparem o mesmo espaço do quadrado.
function ajustarFoto(img){
  try {
    if (img.src.startsWith("data:")) return;
    const w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) return;
    const s = 200 / Math.max(w, h), cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    const ctx = c.getContext("2d", {willReadFrequently: true});
    ctx.drawImage(img, 0, 0, cw, ch);
    const d = ctx.getImageData(0, 0, cw, ch).data;
    const col = new Uint16Array(cw), lin = new Uint16Array(ch);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++){
      const k = (j * cw + i) * 4;
      if (d[k + 3] > 20 && (d[k] < 238 || d[k + 1] < 238 || d[k + 2] < 238)){ col[i]++; lin[j]++; }
    }
    const primeiro = a => a.findIndex(v => v >= 2);
    const ultimo = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] >= 2) return i; return -1; };
    const x0 = primeiro(col), x1 = ultimo(col), y0 = primeiro(lin), y1 = ultimo(lin);
    if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) return;
    const bx = x0 / cw, by = y0 / ch, bw = (x1 + 1 - x0) / cw, bh = (y1 + 1 - y0) / ch;
    if (bw < 0.1 || bh < 0.1) return;
    const a = w / h, T = 0.88;                                    // aparelho ocupa 88% do quadrado
    const W = T / Math.max(bw, bh / a), H = W / a;
    img.style.width = (W * 100) + "%"; img.style.height = (H * 100) + "%";
    img.style.left = ((0.5 - (bx + bw / 2) * W) * 100) + "%";
    img.style.top = ((0.5 - (by + bh / 2) * H) * 100) + "%";
    img.classList.add("ajustada");
  } catch (e) { /* foto local (file://) ou sem permissão: fica como está */ }
}

function carrossel(p){
  const wrap = document.createElement("div"); wrap.className = "foto";
  const trilho = document.createElement("div"); trilho.className = "trilho";
  const fotos = p.fotos.length ? p.fotos : [""];
  fotos.forEach(f => {
    const slide = document.createElement("div"); slide.className = "slide";
    const img = document.createElement("img");
    img.loading = "lazy"; img.alt = nomeCompleto(p);
    // tenta: foto local (com e sem permissão de medir) e depois a foto no GitHub
    const tent = [[urlFoto(f), true], [urlFoto(f), false]];
    const rem = urlRemota(f);
    if (rem && rem !== urlFoto(f)) tent.push([rem, true], [rem, false]);
    let k = 0;
    const tentar = () => {
      if (k >= tent.length){ img.onerror = null; img.src = semFoto; return; }
      const [src, cors] = tent[k++];
      if (cors) img.crossOrigin = "anonymous"; else img.removeAttribute("crossorigin");
      img.src = src;
    };
    img.onload = () => ajustarFoto(img);
    img.onerror = tentar;
    tentar();
    slide.append(img); trilho.append(slide);
  });
  wrap.append(trilho);
  if (fotos.length > 1){
    const mk = (cls, txt, rotulo, dir) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "seta " + cls; b.textContent = txt; b.setAttribute("aria-label", rotulo);
      b.onclick = () => trilho.scrollBy({left: dir * trilho.clientWidth, behavior:"smooth"});
      return b;
    };
    const pontos = document.createElement("div"); pontos.className = "pontos";
    fotos.forEach(() => pontos.append(document.createElement("i")));
    const marcar = () => {
      const i = Math.round(trilho.scrollLeft / trilho.clientWidth);
      [...pontos.children].forEach((d, k) => d.classList.toggle("on", k === i));
    };
    trilho.addEventListener("scroll", marcar, {passive:true}); marcar();
    wrap.append(mk("ant","‹","Foto anterior",-1), mk("prox","›","Próxima foto",1), pontos);
  }
  return wrap;
}

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

/* --- blocos de preço de cada vitrine --- */
function liBoleto(p){
  const b = p.boleto; if (!b) return null;
  const li = el("li"); li.append("Boleto: ");
  if (b.entrada > 0) li.append(el("b", null, "entrada " + brl(b.entrada)), " + ");
  li.append(el("b", null, `${b.parcelas}x de ${brl(b.parcela)}`));
  li.title = `Total a prazo: ${brl(b.entrada + b.parcela * b.parcelas)}`;
  return li;
}
function liCartao(p){
  const c = p.cartao; if (!c.length) return null;
  const li = el("li"); li.append("Cartão: ", el("b", null, textoCartao(c)));
  return li;
}

function precoCompleto(p, pr){
  pr.append(el("div", "avista", "À vista"), el("div", "valor", brl(p.preco)));
  const ul = el("ul", "parcelas");
  [liCartao(p), liBoleto(p)].filter(Boolean).forEach(li => ul.append(li));
  if (ul.children.length) pr.append(ul);
}
function precoCartao(p, pr){
  pr.append(el("div", "avista", "À vista no PIX ou dinheiro"), el("div", "valor", brl(p.preco)));
  p.cartao.forEach(o => {
    const l = el("p", "linha-forte");
    l.append("ou ", el("b", null, `${o.parcelas}x de ${brl(o.parcela)}`), " no cartão");
    pr.append(l);
  });
}
function precoBoleto(p, pr){
  const b = p.boleto;
  if (b.entrada > 0){
    pr.append(el("div", "rotulo", "Entrada a partir de"), el("div", "valor", brl(b.entrada)));
    const l = el("p", "linha-forte"); l.append("+ ", el("b", null, `${b.parcelas}x de ${brl(b.parcela)}`), " no boleto");
    pr.append(l);
  } else {
    pr.append(el("div", "rotulo", `${b.parcelas}x no boleto de`), el("div", "valor", brl(b.parcela)));
  }
  pr.append(el("p", "nota", "Sujeito à análise de crédito"));
}

function cartao(p){
  const art = el("article", "item");
  const c = el("div", "topo");
  const pr = el("div", "preco");

  if (p.marca) c.append(el("p", "marca", p.marca));
  c.append(el("h2", "modelo", p.modelo));
  if (p.detalhes) c.append(el("p", "detalhes", p.detalhes));
  const tags = el("div", "tags");
  if (p.condicao) tags.append(el("span", "tag", p.condicao));
  if (p.bateria){
    const b = el("span", "tag bat" + (p.bateria < 80 ? " baixa" : ""));
    b.innerHTML = ICONE_BAT; b.append(`Bateria ${p.bateria}%`); tags.append(b);
  }
  if (tags.children.length) c.append(tags);
  if (p.observacao){ const o = el("p", "obs", "Obs: " + p.observacao); o.title = p.observacao; c.append(o); }

  if (MODO === "boleto") precoBoleto(p, pr);
  else if (MODO === "cartao") precoCartao(p, pr);
  else precoCompleto(p, pr);

  if (p.cores.length){
    const cs = el("div", "cores");
    p.cores.forEach(nome => {
      const i = el("i"); i.title = nome; i.style.background = MAPA_CORES[nome.toLowerCase()] || "#b8bcc6";
      cs.append(i);
    });
    pr.append(cs);
  }

  const q = el("div", "quero");
  const a = el("a");
  a.href = linkZap(msgProduto(p)); a.target = "_blank"; a.rel = "noopener";
  a.innerHTML = ICONE_ZAP; a.append(M.botao);
  q.append(a);

  art.append(carrossel(p), c, pr, q);
  return art;
}

/* No catálogo do boleto só entram aparelhos com boleto cadastrado */
const entraNaVitrine = p => p.disponivel && (MODO !== "boleto" || !!p.boleto);

function desenhar(){
  const termo = $("busca").value.trim().toLowerCase();
  const grade = $("grade"); grade.replaceChildren();
  const itens = produtos.filter(p =>
    entraNaVitrine(p) &&
    (abaAtiva === "Todos os produtos" || p.grupo === abaAtiva) &&
    (!faixaAtiva || (p.boleto && p.boleto.parcela <= faixaAtiva)) &&
    (!termo || (nomeCompleto(p) + " " + p.detalhes).toLowerCase().includes(termo)));
  if (!itens.length){
    const e = el("div", "vazio", produtos.length ? "Nenhum aparelho encontrado. Tente outra busca ou outro filtro." : "Lista indisponível no momento. Chame a gente no WhatsApp.");
    grade.append(e); return;
  }
  itens.forEach(p => grade.append(cartao(p)));
}

function desenharAbas(){
  const ordem = ["iPhone Seminovos","iPhone Novos","Android Novos","Android Seminovos"];
  const grupos = [...new Set(produtos.filter(entraNaVitrine).map(p => p.grupo).filter(Boolean))]
    .sort((a,b) => (ordem.indexOf(a) + 1 || 99) - (ordem.indexOf(b) + 1 || 99));
  const nav = $("abas"); nav.replaceChildren();
  ["Todos os produtos", ...grupos].forEach(m => {
    const b = el("button", null, m);
    b.type = "button"; b.setAttribute("aria-pressed", m === abaAtiva);
    b.onclick = () => { abaAtiva = m; desenharAbas(); desenhar(); };
    nav.append(b);
  });
}

/* Filtro "Parcela até R$ X" (só no boleto). Mostra só as faixas que mudam o resultado. */
function desenharFaixas(){
  const nav = $("faixas"); if (!nav) return;
  if (MODO !== "boleto"){ nav.hidden = true; return; }
  const parcelas = produtos.filter(entraNaVitrine).map(p => p.boleto.parcela);
  const uteis = CONFIG.faixasBoleto.filter(v => { const n = parcelas.filter(x => x <= v).length; return n > 0 && n < parcelas.length; });
  nav.replaceChildren();
  if (!uteis.length){ nav.hidden = true; return; }
  nav.hidden = false;
  nav.append(el("span", "filtro-tit", "Parcela até:"));
  [0, ...uteis].forEach(v => {
    const b = el("button", null, v ? brl(v).replace(",00", "") : "Todas");
    b.type = "button"; b.setAttribute("aria-pressed", v === faixaAtiva);
    b.onclick = () => { faixaAtiva = v; desenharFaixas(); desenhar(); };
    nav.append(b);
  });
}

function montarCabecalho(){
  $("nomeLoja").textContent = CONFIG.loja;
  document.title = CONFIG.loja + " · " + M.titulo;
  $("slogan").textContent = CONFIG.slogan;
  $("contato").textContent = [CONFIG.instagram, CONFIG.cidade].filter(Boolean).join(" · ");
  $("contato").hidden = !$("contato").textContent;

  const logo = $("logo"); logo.textContent = (CONFIG.loja[0] || "L").toUpperCase();
  if (CONFIG.logo){
    const img = new Image(); img.alt = CONFIG.loja;
    img.onload = () => logo.replaceChildren(img);
    img.src = urlFoto(CONFIG.logo);
  }
  const selos = $("selos");
  [...CONFIG.selos, ...M.selos()].forEach(t => selos.append(el("span", null, t)));

  $("rodape").textContent = M.rodape;
  const z = $("zapFlutuante");
  z.innerHTML = ICONE_ZAP;
  z.href = linkZap(M.zap);
}

/* ============ INICIAR ============ */
(async function(){
  montarCabecalho();
  $("busca").addEventListener("input", desenhar);
  if (CONFIG.sistemaUrl){
    $("sistemaTitulo").textContent = CONFIG.sistemaTitulo;
    $("sistemaFrame").src = CONFIG.sistemaUrl;
    $("sistemaBox").hidden = false;
  }
  try { produtos = await carregar(); }
  catch (e) { console.error("Falha ao carregar a lista:", e); produtos = []; }
  desenharAbas(); desenharFaixas(); desenhar();
})();
