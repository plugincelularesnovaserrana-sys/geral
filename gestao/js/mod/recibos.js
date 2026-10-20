/* =====================================================================
   RECIBOS DE VENDA E LOCAÇÃO (A4 e bobina 80mm)
   Layout no padrão de recibo de loja de celular: canhoto, cabeçalho com
   logotipo, destinatário, produtos, pagamento, parcelas e termos.
   Quando o tipo de venda é "Locação", o mesmo pedido sai como
   "Pedido de locação", com prazo (da data da locação até a última
   parcela) e o termo de locação.
   ===================================================================== */
(function () {
  const REC = window.REC = {};
  const nome = (col, id) => (DB.get(col, id) || {}).nome || '';
  const up = s => String(s || '').toLocaleUpperCase('pt-BR');
  const n2 = v => UI.n2(Number(v) || 0);

  /* ---------- termo de locação padrão (editável em Vendas > Configurações > Termos) ---------- */
  REC.TERMO_LOCACAO = `# CONTRATO DE LOCAÇÃO DE APARELHO CELULAR COM AQUISIÇÃO AO FINAL
Contrato vinculado ao Recibo da Locação nº **{recibo}**, emitido em {data}.
## DAS PARTES
**LOCADORA:** {loja}, CNPJ {cnpj_loja}, com endereço em {endereco_loja}.
**LOCATÁRIO(A):** {cliente}, CPF/CNPJ {cpf}, residente em {endereco}.
## DO OBJETO
**Cláusula 1ª:** A LOCADORA entrega ao LOCATÁRIO, em locação, o aparelho **{produto}**, IMEI **{imei}**, em perfeito estado de funcionamento, conferido pelo LOCATÁRIO no ato da entrega.
## DO PRAZO
**Cláusula 2ª:** A locação vigora de **{inicio}** a **{fim}** ({prazo}), data de vencimento da última parcela.
## DO VALOR E DO PAGAMENTO
**Cláusula 3ª:** O valor total do contrato é de **{total}**, sendo **{entrada}** de entrada e **{parcelas} parcela(s)** de **{valor_parcela}**, com o primeiro vencimento em **{primeiro_venc}**, conforme o quadro de parcelas deste recibo.
**Cláusula 4ª:** O atraso no pagamento de qualquer parcela sujeita o LOCATÁRIO a multa de 2% e juros de mora de 1% ao mês sobre o valor em atraso, e autoriza a LOCADORA a adotar as medidas de cobrança cabíveis, inclusive o protesto do título.
## DA POSSE, USO E CONSERVAÇÃO
**Cláusula 5ª:** Durante a vigência deste contrato o aparelho permanece de propriedade da LOCADORA. O LOCATÁRIO compromete-se a usá-lo com zelo e não pode vendê-lo, emprestá-lo, sublocá-lo, dá-lo em garantia ou entregá-lo a terceiros.
**Cláusula 6ª:** Perda, roubo, furto ou dano ao aparelho não dispensam o LOCATÁRIO do pagamento das parcelas restantes. Em caso de roubo ou furto, o LOCATÁRIO deve registrar boletim de ocorrência e comunicar a LOCADORA em até 48 horas.
## DA AQUISIÇÃO AO FINAL DO CONTRATO
**Cláusula 7ª:** Quitadas todas as parcelas, a propriedade do aparelho passa definitivamente ao LOCATÁRIO, sem nenhum custo adicional, servindo o comprovante de quitação como documento de transferência.
## DA RESCISÃO
**Cláusula 8ª:** O não pagamento de 2 (duas) ou mais parcelas permite à LOCADORA rescindir este contrato e solicitar a devolução do aparelho, sem prejuízo da cobrança dos valores em aberto.
## DA GARANTIA
**Cláusula 9ª:** O aparelho possui a garantia descrita no termo de garantia que acompanha este recibo, válida enquanto este contrato estiver em dia.
## DISPOSIÇÕES GERAIS
**Cláusula 10ª:** O LOCATÁRIO declara ter lido e concordado com todas as cláusulas deste contrato e autoriza o uso de imagem (foto/vídeo) da entrega nas redes sociais da {loja}.
**Cláusula 11ª:** Fica eleito o foro da comarca de {cidade_loja} para resolver qualquer questão referente a este contrato.`;

  /* ---------- migração: tipo "Locação" e termo de locação em bases já existentes ---------- */
  (window.MIGRAR = window.MIGRAR || []).push(() => {
    let termo = DB.list('termos').find(t => t.tipo === 'Termo de locação');
    if (!termo) termo = DB.insert('termos', { tipo: 'Termo de locação', nome: 'Contrato de locação com aquisição ao final', dias: 0, texto: REC.TERMO_LOCACAO }, { silent: true });
    const tipos = DB.list('tiposvenda');
    const loc = tipos.find(t => /loca[cç][aã]o/i.test(t.nome || ''));
    if (!loc) DB.insert('tiposvenda', { nome: 'Locação', ordem: tipos.length + 1, locacao: true, termo_locacao_id: termo.id }, { silent: true });
    else if (loc.locacao === undefined) DB.update('tiposvenda', loc.id, { locacao: true, termo_locacao_id: loc.termo_locacao_id || termo.id }, { silent: true });
  });

  /* ---------- utilidades ---------- */
  REC.ehLocacao = v => { const t = DB.get('tiposvenda', v.tipovenda_id); return !!(t && t.locacao); };
  REC.numero = v => (DB.cfg().recibo_prefixo || '') + String(v.id || 0).padStart(10, '0');
  const endereco = p => [[p.endereco, p.numero].filter(Boolean).join(', '), p.complemento, p.bairro].filter(Boolean).join(' - ');
  const enderecoCompleto = p => [endereco(p), [p.cidade, p.uf].filter(Boolean).join(' - '), p.cep ? 'CEP: ' + p.cep : ''].filter(Boolean).join(' | ');
  const instagram = u => u.instagram ? ' ' + (String(u.instagram).startsWith('@') ? u.instagram : '@' + u.instagram) : '';

  /* duração por extenso entre duas datas (meses + dias) */
  REC.duracao = (de, ate) => {
    if (!de || !ate || ate < de) return '';
    let m = 0; while (UI.addMonths(de, m + 1) <= ate) m++;
    const d = UI.daysBetween(UI.addMonths(de, m), ate);
    const parts = [];
    if (m) parts.push(m + (m === 1 ? ' mês' : ' meses'));
    if (d) parts.push(d + (d === 1 ? ' dia' : ' dias'));
    return (parts.join(' e ') || '0 dia') + ` — ${UI.daysBetween(de, ate)} dias corridos`;
  };

  /* parcelas a prazo da venda: do financeiro (venda concluída) ou calculadas dos pagamentos (pré-venda) */
  REC.parcelas = v => {
    const fin = v.id ? DB.list('financeiro', { allUnits: true }).filter(f => f.origem === 'Venda' && f.origem_id === v.id && f.situacao !== 'Cancelado' && String(f.parcela || '').includes('/')) : [];
    if (fin.length) return fin.map(f => ({ parcela: f.parcela, vencimento: f.vencimento, valor: f.valor, forma: NEG.forma(f.forma_id).nome || '', situacao: NEG.statusVenc(f) }))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const out = [];
    (v.pagamentos || []).forEach(pg => {
      const f = NEG.forma(pg.forma_id);
      if (!(f.tipo === 'Crediário' || f.tipo === 'Boleto' || pg.a_prazo)) return;
      const n = Math.max(1, Number(pg.parcelas) || 1); const base = UI.round2(pg.valor / n);
      for (let i = 0; i < n; i++) out.push({ parcela: `${i + 1}/${n}`, vencimento: UI.addMonths(pg.primeiro_venc || UI.addMonths(UI.dia(v.data), 1), i), valor: i === n - 1 ? UI.round2(pg.valor - base * (n - 1)) : base, forma: f.nome, situacao: 'A vencer' });
    });
    return out.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  };

  /* texto do termo com marcação simples: # título, ## seção, - item, **negrito** */
  REC.termoHTML = texto => {
    const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const out = []; let lista = false;
    String(texto || '').split('\n').forEach(l => {
      const t = l.trim();
      if (/^- /.test(t)) { if (!lista) { out.push('<ul>'); lista = true; } out.push(`<li>${inl(t.slice(2))}</li>`); return; }
      if (lista) { out.push('</ul>'); lista = false; }
      if (!t) return;
      if (/^## /.test(t)) out.push(`<h4>${inl(t.slice(3))}</h4>`);
      else if (/^# /.test(t)) out.push(`<h3>${inl(t.slice(2))}</h3>`);
      else out.push(`<p>${inl(t)}</p>`);
    });
    if (lista) out.push('</ul>');
    return out.join('');
  };

  /* ---------- reúne todos os dados do recibo ---------- */
  REC.dados = (v, titulo) => {
    const cfg = DB.cfg();
    const emp = DB.get('unidades', v.unidade_id) || DB.get('unidades', DB.unitId()) || {};
    const cli = DB.get('pessoas', v.cliente_id) || {};
    const tipo = DB.get('tiposvenda', v.tipovenda_id) || {};
    const locacao = !!tipo.locacao && titulo !== 'Orçamento';
    const t = NEG.totaisVenda(v);
    const total = v.status === 'Concluída' && v.total != null ? v.total : t.total;
    const parcelas = REC.parcelas(v);
    const inicio = UI.dia(v.data) || UI.today();
    const fim = parcelas.length ? parcelas[parcelas.length - 1].vencimento : '';
    const prazoPgs = (v.pagamentos || []).filter(pg => { const f = NEG.forma(pg.forma_id); return f.tipo === 'Crediário' || f.tipo === 'Boleto' || pg.a_prazo; });
    const entrada = UI.round2((v.pagamentos || []).filter(pg => !prazoPgs.includes(pg)).reduce((s, pg) => s + (Number(pg.valor) || 0) - (Number(pg.troco) || 0), 0));
    const itens = (v.itens || []).map(i => {
      const p = DB.get('produtos', i.produto_id) || {};
      const linhas = [up(i.descricao)];
      if (i.imei && !String(i.descricao).includes(i.imei)) linhas.push('IMEI: ' + i.imei);
      if (i.garantia_dias) linhas.push('Garantia até: ' + UI.date(UI.addDays(inicio, Number(i.garantia_dias))));
      if (i.devolvido) linhas.push('(devolvido)');
      return { cod: p.codigo_barras || p.id || '', desc: linhas.join(' - '), qtd: i.qtd, unit: i.preco, desc_v: i.desconto || 0, total: i.preco * i.qtd - (i.desconto || 0) + (i.seguro_valor || 0), seguro: i.seguro_valor || 0 };
    });
    const pags = (v.pagamentos || []).map(pg => {
      const f = NEG.forma(pg.forma_id);
      const det = [];
      if (pg.aparelho) det.push(NEG.descProduto(Object.assign({ tipo: 'Aparelho' }, pg.aparelho)) + (pg.aparelho.imei ? ' - IMEI ' + pg.aparelho.imei : ''));
      if (pg.primeiro_venc) det.push('1º venc. ' + UI.date(pg.primeiro_venc));
      if (pg.troco) det.push('Troco ' + UI.money(pg.troco));
      if (pg.detalhe && !pg.aparelho) det.push(pg.detalhe);
      return { forma: up(f.nome), det: det.join(' · '), valor: pg.valor, parcelas: pg.parcelas || 1 };
    });
    const prodTermo = v.itens.find(i => i.imei) || v.itens[0] || {};
    const numero = REC.numero(v);
    const vars = {
      cliente: cli.nome || 'CONSUMIDOR FINAL', cpf: cli.cpf || '—', endereco: enderecoCompleto(cli) || '—', produto: prodTermo.descricao || '', imei: prodTermo.imei || '—',
      data: UI.date(inicio), loja: emp.nome || cfg.empresa_nome || 'Loja', cnpj_loja: emp.cnpj || '', endereco_loja: [emp.endereco, emp.cidade, emp.uf].filter(Boolean).join(', '), cidade_loja: [emp.cidade, emp.uf].filter(Boolean).join('/') || '—',
      recibo: numero, total: UI.money(total), inicio: UI.date(inicio), fim: fim ? UI.date(fim) : '___/___/______', prazo: fim ? REC.duracao(inicio, fim) : 'prazo a definir',
      parcelas: parcelas.length, valor_parcela: parcelas.length ? UI.money(parcelas[0].valor) : UI.money(0), entrada: UI.money(entrada), primeiro_venc: parcelas.length ? UI.date(parcelas[0].vencimento) : '—'
    };
    const termos = [];
    if (locacao) {
      const tl = DB.get('termos', tipo.termo_locacao_id) || DB.list('termos').find(x => x.tipo === 'Termo de locação');
      termos.push({ titulo: '', html: REC.termoHTML(UI.fillTemplate(tl ? tl.texto : REC.TERMO_LOCACAO, vars)), contrato: true });
    }
    const tg = DB.get('termos', v.termo_id);
    if (tg && titulo !== 'Orçamento') {
      const dias = tg.dias || prodTermo.garantia_dias || '';
      const txt = UI.fillTemplate(tg.texto, Object.assign({}, vars, { dias }));
      termos.push({ titulo: /^#\s/m.test(txt) ? '' : up(tg.nome), html: REC.termoHTML(txt) });
    }
    const tc = DB.list('termos').find(x => x.tipo === 'Termo de compra');
    if (tc && titulo !== 'Orçamento') (v.pagamentos || []).filter(pg => pg.aparelho).forEach(pg => termos.push({ titulo: up(tc.nome), html: REC.termoHTML(UI.fillTemplate(tc.texto, Object.assign({}, vars, { produto: NEG.descProduto(Object.assign({ tipo: 'Aparelho' }, pg.aparelho)), imei: pg.aparelho.imei || '—' }))) }));
    const modo = titulo === 'Orçamento' ? 'Orçamento' : locacao ? 'Locação' : 'Venda';
    return { v, cfg, emp, cli, tipo, locacao, modo, total, t, parcelas, inicio, fim, entrada, itens, pags, termos, numero, vars,
      vendedor: up(nome('vendedores', v.vendedor_id)), entrega: nome('tiposentrega', v.tipoentrega_id), cancelada: v.status === 'Cancelada', pre: v.status === 'Pré-venda' };
  };

  const logo = (emp, cls) => emp.logo ? `<img class="${cls}" src="${emp.logo}" alt="">` : `<div class="${cls} logo-txt">${esc(up((emp.apelido || emp.nome || 'Loja')).slice(0, 14))}</div>`;
  const assinaturas = d => d.locacao ? `<div class="assin">
      <div><span></span>${esc(up(d.emp.nome || 'LOCADORA'))}<small>LOCADORA${d.emp.cnpj ? ' · CNPJ ' + esc(d.emp.cnpj) : ''}</small></div>
      <div><span></span>${esc(up(d.cli.nome || 'LOCATÁRIO'))}<small>LOCATÁRIO(A)${d.cli.cpf ? ' · CPF ' + esc(d.cli.cpf) : ''}</small></div>
      <div><span></span>Testemunha 1<small>Nome / CPF</small></div><div><span></span>Testemunha 2<small>Nome / CPF</small></div></div>` : '';
  const carimbo = d => d.cancelada ? `<div class="carimbo">${d.modo === 'Locação' ? 'LOCAÇÃO' : 'VENDA'} CANCELADA</div>` : d.pre ? '<div class="carimbo aviso">PRÉ-VENDA — NÃO É RECIBO</div>' : '';

  /* ---------- A4 ---------- */
  REC.a4 = d => {
    const L = d.modo.toLowerCase(), da = d.modo === 'Venda' ? 'da venda' : d.modo === 'Locação' ? 'da locação' : 'do orçamento';
    const prazoBox = d.locacao ? `<div class="sec">PRAZO DA LOCAÇÃO</div><table class="g"><tr><th>Início</th><th>Término (última parcela)</th><th>Duração</th><th>Parcelas</th></tr>
      <tr><td class="c">${UI.date(d.inicio)}</td><td class="c">${d.fim ? UI.date(d.fim) : 'Sem parcelas a prazo'}</td><td class="c">${esc(d.fim ? REC.duracao(d.inicio, d.fim) : '—')}</td><td class="c">${d.parcelas.length}</td></tr></table>` : '';
    return `<div class="a4">
      ${d.modo !== 'Orçamento' ? `<table class="canhoto"><tr><th colspan="3">RECIBO DE ${esc(up(d.emp.nome))} OS PRODUTOS E/OU SERVIÇOS CONSTANTES NO PEDIDO${d.locacao ? ' DE LOCAÇÃO' : ''}</th></tr>
        <tr><td>Data de recebimento</td><td>Identificação e assinatura do recebedor</td><td class="nw">Recibo ${da}: ${esc(d.numero)}</td></tr></table><div class="corte"></div>` : ''}
      <table class="cab"><tr><td class="cab-logo">${logo(d.emp, 'logo')}</td>
        <td class="cab-emp">${esc(up(d.emp.nome))}<br>${esc(d.emp.endereco || '')}${d.emp.cidade ? ' ' + esc(d.emp.cidade) : ''}${d.emp.uf ? ' ' + esc(d.emp.uf) : ''}${d.emp.cep ? ' ' + esc(d.emp.cep) : ''}<br>
          ${d.emp.cnpj ? `<b>CNPJ:</b> ${esc(d.emp.cnpj)}<br>` : ''}${d.emp.telefone ? `<b>Telefone:</b> ${esc(d.emp.telefone)}` : ''}${esc(instagram(d.emp))}${d.cfg.cabecalho_docs ? '<br>' + esc(d.cfg.cabecalho_docs) : ''}</td>
        <td class="cab-dir"><b>${UI.date(d.inicio)}</b><br><b>VENDEDOR:</b> ${esc(d.vendedor || '—')}<br><b>${d.modo === 'Orçamento' ? 'ORÇAMENTO' : 'RECIBO ' + up(da)}:</b><br>${esc(d.numero)}</td></tr></table>
      ${d.locacao ? '<div class="titulo-doc">PEDIDO DE LOCAÇÃO</div>' : d.modo === 'Orçamento' ? '<div class="titulo-doc">ORÇAMENTO</div>' : ''}
      ${carimbo(d)}
      <div class="sec">${d.locacao ? 'LOCATÁRIO' : 'DESTINATÁRIO/REMETENTE'}</div>
      <table class="g"><tr><th style="width:43%">Nome/Razão social</th><th>Telefone</th><th>CPF/CNPJ</th><th>E-mail</th></tr>
        <tr><td>${esc(up(d.cli.nome || 'CONSUMIDOR FINAL'))}</td><td>${esc(d.cli.telefone || '')}</td><td>${esc(d.cli.cpf || '')}</td><td>${esc(d.cli.email || '')}</td></tr>
        <tr><th>Endereço</th><th>CEP</th><th>Cidade</th><th>Estado</th></tr>
        <tr><td>${esc(endereco(d.cli))}</td><td>${esc(d.cli.cep || '')}</td><td>${esc(d.cli.cidade || '')}</td><td>${esc(d.cli.uf || '')}</td></tr></table>
      <div class="sec">DADOS DO PRODUTO</div>
      <table class="g"><tr><th>Cód</th><th>Produto</th><th>Qtd</th><th>Valor Unitário</th><th>Desconto</th><th>Valor Total</th></tr>
        ${d.itens.map(i => `<tr><td>${esc(i.cod)}</td><td>${esc(i.desc)}${i.seguro ? `<br><small>Seguro: ${UI.money(i.seguro)}</small>` : ''}</td><td class="r">${i.qtd}</td><td class="r">${UI.money(i.unit)}</td><td class="r">${i.desc_v ? UI.money(i.desc_v) : 'R$'}</td><td class="r">${UI.money(i.total)}</td></tr>`).join('')}
        <tr class="tot"><td colspan="3" class="r">Total</td><td class="r">${UI.money(d.t.bruto)}</td><td class="r">${d.t.descontos ? UI.money(d.t.descontos) : 'R$'}</td><td class="r">${UI.money(d.total)}</td></tr></table>
      ${d.pags.length ? `<div class="sec">PAGAMENTO</div>
      <table class="g"><tr><th style="width:33%">Forma de Pagamento</th><th>Detalhes</th><th style="width:22%">Valor Pago</th><th style="width:9%">Parcelas</th></tr>
        ${d.pags.map(p => `<tr><td>${esc(p.forma)}</td><td>${esc(p.det)}</td><td class="r">${UI.money(p.valor)}</td><td class="c small">${p.parcelas}</td></tr>`).join('')}
        <tr class="tot"><td colspan="2" class="r">Total</td><td class="r">${UI.money(d.pags.reduce((s, p) => s + (Number(p.valor) || 0), 0))}</td><td></td></tr></table>` : ''}
      ${prazoBox}
      ${d.parcelas.length && (d.locacao || d.cfg.recibo_parcelas !== false) ? `<div class="sec">PARCELAS</div>
      <table class="g parc"><tr><th>Parcela</th><th>Vencimento</th><th>Forma</th><th>Valor</th></tr>${d.parcelas.map(p => `<tr><td class="c">${esc(p.parcela)}</td><td class="c">${UI.date(p.vencimento)}</td><td>${esc(up(p.forma))}</td><td class="r">${UI.money(p.valor)}</td></tr>`).join('')}</table>` : ''}
      <div class="sec">OBSERVAÇÃO</div>${d.v.obs ? `<p class="obs">${esc(d.v.obs)}</p>` : ''}
      <div class="sec">DADOS ADICIONAIS</div>${d.entrega ? `<p class="obs">Tipo de entrega: ${esc(d.entrega)}</p>` : ''}
      ${d.termos.map(tm => `<div class="termo">${tm.titulo ? `<h3>${esc(tm.titulo)}</h3>` : ''}${tm.html}</div>`).join('')}
      ${assinaturas(d)}
      ${d.cfg.recibo_rodape ? `<p class="rodape">${esc(d.cfg.recibo_rodape)}</p>` : ''}
    </div>`;
  };

  /* ---------- bobina 80mm ---------- */
  REC.c80 = d => {
    const da = d.modo === 'Venda' ? 'da venda' : d.modo === 'Locação' ? 'da locação' : 'do orçamento';
    return `<div class="b80">
      <div class="c"><b>Nº ${esc(d.numero)}</b></div>
      <div class="c">${logo(d.emp, 'logo80')}</div>
      <div class="c emp">${esc(up(d.emp.nome))}</div>
      ${d.locacao ? '<div class="c titulo80">PEDIDO DE LOCAÇÃO</div>' : d.modo === 'Orçamento' ? '<div class="c titulo80">ORÇAMENTO</div>' : ''}
      ${carimbo(d)}
      <p>${d.emp.cnpj ? `<b>CNPJ:</b> ${esc(d.emp.cnpj)}<br>` : ''}${d.emp.endereco || d.emp.cidade ? `<b>Endereço:</b> ${esc([d.emp.endereco, d.emp.cidade, d.emp.uf].filter(Boolean).join(', '))}<br>` : ''}${d.emp.telefone ? `<b>Fone:</b> ${esc(d.emp.telefone)}` : ''}${esc(instagram(d.emp))}</p>
      <p class="kv"><b>Vendedor(a):</b> ${esc(d.vendedor || '—')}<br><b>Data ${da}:</b> ${UI.date(d.inicio)}${d.entrega ? `<br><b>Tipo de Entrega:</b> ${esc(d.entrega)}` : ''}</p>
      <div class="sec80">${d.locacao ? 'DADOS DO LOCATÁRIO' : 'DADOS DO CLIENTE'}</div>
      <p class="kv"><b>Cliente:</b> ${esc(up(d.cli.nome || 'CONSUMIDOR FINAL'))}${d.cli.cpf ? `<br><b>CNPJ/CPF:</b> ${esc(d.cli.cpf)}` : ''}${d.cli.telefone ? `<br><b>Telefone:</b> ${esc(d.cli.telefone)}` : ''}${enderecoCompleto(d.cli) ? `<br><b>Endereço:</b> ${esc(enderecoCompleto(d.cli))}` : ''}</p>
      <div class="sec80">PRODUTOS</div>
      <table class="t80"><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Valor</th><th class="r">Desconto</th><th class="r">Total</th></tr>
        ${d.itens.map(i => `<tr><td colspan="5" class="d80">${esc(i.desc)}${i.seguro ? ` - Seguro ${n2(i.seguro)}` : ''}</td></tr><tr><td></td><td class="r">${i.qtd}</td><td class="r">${n2(i.unit)}</td><td class="r">${i.desc_v ? n2(i.desc_v) : ''}</td><td class="r">${n2(i.total)}</td></tr>`).join('')}
        <tr><td colspan="4" class="r">Total (R$):</td><td class="r">${n2(d.total)}</td></tr></table>
      ${d.pags.length ? `<div class="sec80">PAGAMENTO</div><table class="t80"><tr><th>Forma de pagamento</th><th class="r">Valor (R$)</th><th class="r">Parcela</th></tr>
        ${d.pags.map(p => `<tr><td>${esc(p.forma)}${p.det ? `<br><small>${esc(p.det)}</small>` : ''}</td><td class="r">${n2(p.valor)}</td><td class="r">${p.parcelas}</td></tr>`).join('')}</table>` : ''}
      ${d.locacao ? `<div class="sec80">PRAZO DA LOCAÇÃO</div><p class="kv"><b>Início:</b> ${UI.date(d.inicio)}<br><b>Término:</b> ${d.fim ? UI.date(d.fim) + ' (última parcela)' : 'sem parcelas a prazo'}${d.fim ? `<br><b>Duração:</b> ${esc(REC.duracao(d.inicio, d.fim))}` : ''}</p>` : ''}
      ${d.parcelas.length && (d.locacao || d.cfg.recibo_parcelas !== false) ? `<div class="sec80">PARCELAS</div><table class="t80"><tr><th>Parc.</th><th>Vencimento</th><th class="r">Valor</th></tr>${d.parcelas.map(p => `<tr><td>${esc(p.parcela)}</td><td>${UI.date(p.vencimento)}</td><td class="r">${n2(p.valor)}</td></tr>`).join('')}</table>` : ''}
      ${d.v.obs ? `<p><b>Obs.:</b> ${esc(d.v.obs)}</p>` : ''}
      ${d.termos.map(tm => `<div class="termo80">${tm.titulo ? `<h3>${esc(tm.titulo)}</h3>` : ''}${tm.html}</div>`).join('')}
      ${assinaturas(d)}
      ${d.cfg.recibo_rodape ? `<p class="c rodape">${esc(d.cfg.recibo_rodape)}</p>` : ''}
    </div>`;
  };

  REC.CSS = `
    *{box-sizing:border-box}body{margin:0;color:#111;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .r{text-align:right}.c{text-align:center}.nw{white-space:nowrap}small,.small{font-size:.86em}b{font-weight:700}
    .acoes{text-align:center;margin:14px 0}.acoes button{font:600 13px Arial;padding:8px 18px;border-radius:6px;border:1px solid #888;background:#fff;cursor:pointer}
    .carimbo{margin:8px 0;padding:6px;border:2px solid #c0352b;color:#c0352b;font-weight:700;text-align:center;letter-spacing:.06em}.carimbo.aviso{border-color:#b7791f;color:#b7791f}
    .logo-txt{display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:.04em;color:#1d4f73;border:2px solid #1d4f73;border-radius:6px}
    /* A4 */
    .a4{width:186mm;margin:8mm auto;font-size:11px}
    .a4 table{width:100%;border-collapse:collapse}
    .canhoto th,.canhoto td{border:1px solid #9a9a9a;padding:4px 3px;text-align:left;font-weight:700;font-size:11px}
    .canhoto td:first-child{width:30%}
    .corte{border-top:1.5px dashed #555;margin:8px 0 10px}
    .cab td{border:1px solid #9a9a9a;vertical-align:middle;padding:8px}
    .cab-logo{width:26%;text-align:center}.cab-logo .logo{max-width:150px;max-height:78px;object-fit:contain}.cab-logo .logo-txt{width:150px;height:60px;margin:auto;font-size:18px}
    .cab-emp{text-align:center;line-height:1.35;font-size:11.5px}
    .cab-dir{width:25%;text-align:center;line-height:1.4;font-size:11.5px}
    .titulo-doc{text-align:center;font-weight:700;font-size:15px;letter-spacing:.08em;margin:10px 0 0}
    .sec{font-weight:700;font-size:11.5px;margin:12px 0 3px}
    .g th,.g td{border:1px solid #9a9a9a;padding:4px 3px;vertical-align:middle}
    .g th{background:#eef0f2;font-weight:700;text-align:center}
    .g tr.tot td{font-weight:400}.g tr.tot td.r:first-child{font-weight:700}
    .obs{margin:2px 0 6px}
    .termo{margin-top:14px;font-size:11.5px;line-height:1.45}
    .termo h3{text-align:center;font-size:14px;margin:14px 0 10px}
    .termo h4{font-size:12px;margin:12px 0 4px;text-transform:uppercase}
    .termo p{margin:0 0 7px;text-align:justify}.termo ul{margin:4px 0 8px;padding-left:22px}.termo li{margin-bottom:3px}
    .assin{display:grid;grid-template-columns:1fr 1fr;gap:34px 40px;margin-top:38px;page-break-inside:avoid}
    .assin div{text-align:center;font-size:11px}.assin span{display:block;border-top:1px solid #000;margin-bottom:3px}.assin small{display:block;color:#444}
    .rodape{text-align:center;color:#444;margin-top:16px}
    /* 80mm */
    .b80{width:72mm;margin:0 auto;padding:3mm 0;font-size:11.5px;line-height:1.35}
    .b80 p{margin:6px 0}.b80 .emp{font-weight:700;font-size:12.5px;margin:4px 0 8px}
    .logo80{max-width:42mm;max-height:30mm;object-fit:contain;display:inline-block}.b80 .logo-txt{display:flex;width:42mm;height:14mm;margin:4px auto;font-size:15px}
    .titulo80{font-weight:700;font-size:13px;letter-spacing:.06em;margin:4px 0;padding:3px 0;border-top:1px solid #000;border-bottom:1px solid #000}
    .sec80{font-weight:700;margin:10px 0 2px;font-size:12px}
    .t80{width:100%;border-collapse:collapse}.t80 th{text-align:left;font-weight:700;padding:1px 0}.t80 td{padding:1px 0;vertical-align:top}.t80 .d80{padding-top:3px}
    .termo80{margin-top:12px;font-size:11px}.termo80 h3{font-size:13.5px;margin:12px 0 6px}.termo80 h4{font-size:12.5px;margin:12px 0 4px;text-transform:uppercase}.termo80 p{margin:0 0 6px}.termo80 ul{padding-left:16px;margin:4px 0}
    .b80 .assin{grid-template-columns:1fr;gap:26px;margin-top:28px}
    @media print{.acoes{display:none}.a4{margin:0 auto}}
  `;

  /* janela de impressão com o CSS próprio do recibo */
  REC.imprimir = (html, formato, titulo) => {
    const w = window.open('', '_blank');
    if (!w) { UI.toast('Libere pop-ups para imprimir', 'erro'); return null; }
    const page = formato === '80mm' ? '@page{size:80mm auto;margin:0}' : '@page{size:A4;margin:10mm}';
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${page}${REC.CSS}</style></head>
      <body>${html}<div class="acoes"><button onclick="print()">Imprimir</button></div></body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
    return w;
  };

  REC.html = (v, formato = 'a4', titulo) => { const d = REC.dados(v, titulo); return { d, html: formato === '80mm' ? REC.c80(d) : REC.a4(d) }; };
  REC.venda = (v, formato = 'a4', titulo) => {
    const { d, html } = REC.html(v, formato, titulo);
    const tit = d.modo === 'Orçamento' ? 'Orçamento ' + d.numero : (d.locacao ? 'Recibo da locação ' : 'Recibo da venda ') + d.numero;
    return REC.imprimir(html, formato, tit);
  };

  /* substitui o recibo antigo em todos os pontos do sistema (histórico, PDV, pré-venda, orçamentos) */
  if (window.VENDAS) VENDAS.recibo = (v, formato = 'a4', titulo) => REC.venda(v, formato, titulo);
})();
