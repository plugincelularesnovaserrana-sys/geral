/* =====================================================================
   DRE REGIME DE CAIXA
   Considera somente o dinheiro que efetivamente entrou ou saiu, na data
   do pagamento/recebimento (ou da compensação), e não na data da venda,
   do vencimento ou da competência do lançamento.
   Todos os cálculos são feitos em centavos (inteiros) para não haver
   diferença de arredondamento.
   ===================================================================== */
(function () {
  const C = v => Math.round((Number(v) || 0) * 100);   // reais -> centavos
  const M = c => UI.money(c / 100);
  const nome = (col, id) => (DB.get(col, id) || {}).nome || '';
  const COMPRAS_DRE = ['Custo de mercadoria (CMV)', 'Custo de OS'];
  const COMPRAS_SIS = ['compra', 'downgrade'];
  const COMPRAS_ORIG = ['Ordem de compra', 'Produto', 'XML de NF-e'];
  const OP_ORDEM = ['Despesa com pessoal', 'Despesa operacional', 'Perdas e ajustes'];
  const NAO_FIN = ['Crédito do cliente', 'Aparelho na troca'];

  /* ---------- classificação de um lançamento ---------- */
  function classificar(f) {
    const c = DB.get('categoriasfin', f.categoria_id) || {};
    const dre = c.dre || '', sis = c.sistema || '', cat = c.nome || 'Sem categoria';
    if (f.considerar === false) return 'excl';
    const devol = f.origem === 'Devolução' || sis === 'devolucao' || dre === 'Devoluções';
    const compra = COMPRAS_ORIG.includes(f.origem) || COMPRAS_SIS.includes(sis) || COMPRAS_DRE.includes(dre);
    if (f.tipo === 'R') {
      if (f.origem === 'Venda') return (String(f.parcela || '').includes('/') || ['Crediário', 'Boleto'].includes(NEG.forma(f.forma_id).tipo)) ? 'rec.parcelas' : 'rec.vendas';
      if (f.origem === 'OS') return 'rec.os';
      if (f.origem === 'Crédito' || sis === 'adiantamento' || dre === 'Adiantamentos de clientes') return 'rec.adiant';
      if (devol) return 'ded.devol';          // estorno recebido de volta reduz as devoluções
      if (compra) return 'compras';           // reembolso de fornecedor reduz as compras
      if (dre === 'Não considerar') return 'excl';
      if (dre === 'Taxas') return 'ded.taxas';
      return 'rec.outras|' + cat;
    }
    if (devol) return 'ded.devol';
    if (compra) return 'compras';
    if (dre === 'Não considerar') return 'excl';
    if (dre === 'Taxas') return 'ded.taxas';
    if (dre === 'Impostos') return 'imp';
    if (dre === 'Investimentos') return 'inv';
    const grp = OP_ORDEM.includes(dre) ? dre : 'Despesa operacional';
    return 'op|' + grp + '|' + cat;
  }

  const dataMov = (p, st) => UI.dia(st.base === 'compensacao' ? (p.compensacao || p.data) : p.data);
  const lancamentos = st => DB.list('financeiro', { allUnits: st.loja === 'todas' }).filter(f => f.situacao !== 'Cancelado');

  /* ---------- apuração de um período ---------- */
  function apurar(de, ate, st) {
    const ap = { de, ate, v: {}, movs: [], memo: { aparelho: 0, credito: 0, excl: 0 }, memoMovs: { aparelho: [], credito: [], excl: [] } };
    const put = (key, cents, mov) => { if (!cents) return; ap.v[key] = (ap.v[key] || 0) + cents; ap.movs.push(Object.assign({}, mov, { key, valor: cents })); };
    lancamentos(st).forEach(f => {
      let classe = null;
      (f.pagamentos || []).forEach(p => {
        const d = dataMov(p, st);
        if (!d || d < de || d > ate) return;
        const forma = NEG.forma(p.forma_id) || {};
        const sinal = f.tipo === 'R' ? 1 : -1;
        const valor = C(p.valor) * sinal;
        const mov = { data: d, f, forma: forma.nome || '—', titulo: f.titulo || '', pessoa: nome('pessoas', f.pessoa_id), categoria: nome('categoriasfin', f.categoria_id) };
        if (NAO_FIN.includes(forma.tipo)) {
          const k = forma.tipo === 'Aparelho na troca' ? 'aparelho' : 'credito';
          ap.memo[k] += C(p.valor); ap.memoMovs[k].push(Object.assign({}, mov, { valor }));
          return;
        }
        classe = classe || classificar(f);
        const taxa = f.tipo === 'R' ? C(p.taxa) : 0;
        if (classe === 'excl') { ap.memo.excl += valor - taxa; ap.memoMovs.excl.push(Object.assign({}, mov, { valor: valor - taxa })); return; }
        put(classe, valor, mov);
        if (taxa) put('ded.taxas', -taxa, Object.assign({}, mov, { titulo: 'Taxa — ' + mov.titulo }));
      });
    });
    return ap;
  }

  /* conferência independente: movimento financeiro bruto do período, sem classificar */
  function conferir(de, ate, st) {
    let liquido = 0;
    lancamentos(st).forEach(f => (f.pagamentos || []).forEach(p => {
      const d = dataMov(p, st);
      if (!d || d < de || d > ate || NAO_FIN.includes((NEG.forma(p.forma_id) || {}).tipo)) return;
      liquido += f.tipo === 'R' ? C(p.valor) - C(p.taxa) : -C(p.valor);
    }));
    return liquido;
  }

  /* ---------- estrutura do demonstrativo ---------- */
  const S = (ap, pred) => Object.keys(ap.v).filter(pred).reduce((s, k) => s + ap.v[k], 0);
  const is = k => x => x === k;
  const pre = k => x => x.startsWith(k);
  const P = {
    recBruta: pre('rec.'), deducoes: pre('ded.'), compras: is('compras'), op: pre('op|'), imp: is('imp'), inv: is('inv')
  };
  const totais = ap => {
    const rb = S(ap, P.recBruta), dd = S(ap, P.deducoes), cp = S(ap, P.compras), op = S(ap, P.op), im = S(ap, P.imp), iv = S(ap, P.inv);
    const rl = rb + dd, bruto = rl + cp, oper = bruto + op, final = oper + im + iv;
    return { rb, dd, cp, op, im, iv, rl, bruto, oper, final };
  };

  function linhas(aps) {
    const keys = new Set(); aps.forEach(a => Object.keys(a.v).forEach(k => keys.add(k)));
    const dyn = prefix => [...keys].filter(k => k.startsWith(prefix)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const L = [];
    const linha = (label, tipo, pred, extra = {}) => L.push(Object.assign({ label, tipo, pred, calc: ap => S(ap, pred) }, extra));
    const total = (label, fn, extra = {}) => L.push(Object.assign({ label, tipo: 'res', calc: ap => totais(ap)[fn] }, extra));

    linha('Receita bruta recebida', 'head', P.recBruta);
    linha('Vendas à vista (dinheiro, PIX e cartões)', 'item', is('rec.vendas'));
    linha('Recebimento de parcelas (crediário e boleto)', 'item', is('rec.parcelas'));
    linha('Ordens de serviço recebidas', 'item', is('rec.os'));
    linha('Adiantamentos de clientes (crédito)', 'item', is('rec.adiant'));
    linha('Outras receitas recebidas', 'item', pre('rec.outras|'));
    dyn('rec.outras|').forEach(k => linha(k.split('|')[1], 'sub', is(k)));
    linha('(−) Deduções da receita', 'head', P.deducoes);
    linha('Devoluções e estornos pagos', 'item', is('ded.devol'));
    linha('Taxas de cartão e bancárias', 'item', is('ded.taxas'));
    total('(=) Receita líquida recebida', 'rl');
    linha('(−) Compras de mercadorias e peças pagas', 'head', P.compras);
    total('(=) Resultado bruto de caixa', 'bruto');
    linha('(−) Despesas operacionais pagas', 'head', P.op);
    const grupos = [...new Set(dyn('op|').map(k => k.split('|')[1]))].sort((a, b) => (OP_ORDEM.indexOf(a) + 1 || 99) - (OP_ORDEM.indexOf(b) + 1 || 99) || a.localeCompare(b));
    grupos.forEach(g => {
      linha(g, 'item', pre('op|' + g + '|'));
      dyn('op|' + g + '|').forEach(k => linha(k.split('|')[2], 'sub', is(k)));
    });
    total('(=) Resultado operacional de caixa', 'oper');
    linha('(−) Impostos pagos', 'head', P.imp);
    linha('(−) Investimentos e equipamentos pagos', 'head', P.inv);
    total('(=) Geração de caixa do período', 'final', { final: true });
    return L;
  }

  /* ---------- gráfico cascata (SVG) ---------- */
  function cascata(ap) {
    const t = totais(ap);
    const passos = [['Receita bruta', t.rb, 'base'], ['Deduções', t.dd], ['Compras', t.cp], ['Despesas', t.op], ['Impostos', t.im], ['Investim.', t.iv], ['Geração de caixa', t.final, 'total']];
    let acc = 0; const barras = passos.map(([l, v, tipo]) => {
      let ini, fim;
      if (tipo === 'base' || tipo === 'total') { ini = 0; fim = v; acc = v; } else { ini = acc; fim = acc + v; acc = fim; }
      return { l, v, ini, fim, tipo };
    });
    const vals = barras.flatMap(b => [b.ini, b.fim]).concat(0);
    const max = Math.max(...vals), min = Math.min(...vals);
    if (max === min) return '';
    const W = 760, H = 260, top = 28, bot = 44, bw = W / barras.length;
    const y = v => top + (max - v) / (max - min) * (H - top - bot);
    const cor = b => b.tipo === 'base' ? 'var(--c1)' : b.tipo === 'total' ? (b.v >= 0 ? 'var(--ok)' : 'var(--danger)') : (b.v >= 0 ? 'var(--ok)' : 'var(--danger)');
    const curto = c => { const r = Math.abs(c / 100); const s = r >= 1e6 ? (r / 1e6).toFixed(1).replace('.', ',') + ' mi' : r >= 1e4 ? Math.round(r / 1e3) + ' mil' : UI.n2(r); return (c < 0 ? '−' : '') + s; };
    return `<svg class="dc-wf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico cascata da geração de caixa">
      <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="dc-zero"/>
      ${barras.map((b, i) => {
        const y1 = y(Math.max(b.ini, b.fim)), y2 = y(Math.min(b.ini, b.fim)), h = Math.max(2, y2 - y1), x = i * bw + bw * 0.18, w = bw * 0.64;
        const lig = i < barras.length - 1 ? `<line class="dc-lig" x1="${x + w}" x2="${(i + 1) * bw + bw * 0.18}" y1="${y(b.fim)}" y2="${y(b.fim)}"/>` : '';
        return `<g style="--i:${i}"><rect class="dc-bar" x="${x}" y="${y1}" width="${w}" height="${h}" rx="5" fill="${cor(b)}"><title>${esc(b.l)}: ${M(b.v)}</title></rect>${lig}
          <text class="dc-val" x="${x + w / 2}" y="${y1 - 7}">${curto(b.v)}</text><text class="dc-lab" x="${x + w / 2}" y="${H - 18}">${esc(b.l)}</text></g>`;
      }).join('')}</svg>`;
  }

  /* ---------- utilidades de período ---------- */
  const diasEntre = (a, b) => UI.daysBetween(a, b) + 1;
  const anterior = (de, ate) => { const n = diasEntre(de, ate); const fim = UI.addDays(de, -1); return [UI.addDays(fim, -(n - 1)), fim]; };
  const meses = (de, ate) => { const out = []; let m = de.slice(0, 7) + '-01'; while (m <= ate && out.length < 37) { const fimM = UI.addDays(UI.addMonths(m, 1), -1); out.push([m.slice(0, 7), m < de ? de : m, fimM > ate ? ate : fimM]); m = UI.addMonths(m, 1); } return out; };
  const pctTxt = (v, base) => base ? UI.pct(v / base * 100) : '—';
  const variacao = (cur, prev) => {
    if (!prev) return cur ? '<span class="muted">novo</span>' : '<span class="muted">—</span>';
    const d = (cur - prev) / Math.abs(prev) * 100;
    return `<span class="${cur - prev >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : ''}${UI.pct(d)}</span>`;
  };
  const cel = c => `<span class="${c < 0 ? 'neg' : ''}">${M(c)}</span>`;

  /* ---------- detalhamento ---------- */
  function detalhar(titulo, movs, periodo) {
    const tot = movs.reduce((s, m) => s + m.valor, 0);
    const rows = movs.slice().sort((a, b) => a.data.localeCompare(b.data) || a.f.id - b.f.id);
    UI.modal({
      title: titulo, size: 'lg',
      body: `<p class="small muted">${esc(periodo)} · ${rows.length} movimento(s) · total <b class="${tot < 0 ? 'neg' : 'pos'}">${M(tot)}</b></p>
        ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Descrição</th><th>Pessoa</th><th>Forma</th><th>Categoria</th><th class="r">Valor</th></tr></thead><tbody>
        ${rows.map(m => `<tr data-go="#/c/${m.f.tipo === 'R' ? 'receitas' : 'despesas'}/${m.f.id}"><td>${UI.date(m.data)}</td><td>${esc(m.titulo)}</td><td>${esc(m.pessoa || '—')}</td><td>${esc(m.forma)}</td><td>${esc(m.categoria || '—')}</td><td class="r">${cel(m.valor)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="5">Total</td><td class="r">${cel(tot)}</td></tr></tfoot></table></div>` : '<p class="empty">Nenhum movimento.</p>'}
        <p class="small muted">Clique em um movimento para abrir o lançamento.</p>`,
      onOpen: ({ body, close }) => body.querySelectorAll('[data-go]').forEach(tr => tr.onclick = () => { close(); location.hash = tr.dataset.go; })
    });
  }

  /* ---------- tela ---------- */
  function render(el, st) {
    if (!st.de || !st.ate || st.de > st.ate) { el.innerHTML = '<div class="card empty">Informe um período válido (data inicial menor ou igual à final).</div>'; REL._last = null; return; }
    const atual = apurar(st.de, st.ate, st);
    const t = totais(atual);
    const conf = conferir(st.de, st.ate, st) - atual.memo.excl;
    const confOk = conf === t.final;
    const periodoTxt = `${UI.date(st.de)} a ${UI.date(st.ate)}`;
    const entradas = Object.keys(atual.v).filter(k => atual.v[k] > 0).reduce((s, k) => s + atual.v[k], 0);
    const saidas = Object.keys(atual.v).filter(k => atual.v[k] < 0).reduce((s, k) => s + atual.v[k], 0);

    const kpis = `<div class="kpis dc-kpis">
      <div class="kpi accent"><span>Receita recebida</span><b>${M(t.rb)}</b><small>${atual.movs.filter(m => m.key.startsWith('rec.')).length} recebimento(s)</small></div>
      <div class="kpi danger"><span>Saídas pagas</span><b>${M(-saidas)}</b><small>deduções, compras, despesas, impostos e investimentos</small></div>
      <div class="kpi ${t.final >= 0 ? 'ok' : 'danger'}"><span>Geração de caixa</span><b>${M(t.final)}</b><small>entradas ${M(entradas)} − saídas ${M(-saidas)}</small></div>
      <div class="kpi"><span>Margem de caixa</span><b>${t.rb ? UI.pct(t.final / t.rb * 100) : '—'}</b><small>geração de caixa ÷ receita bruta</small></div></div>`;

    let tabela, cols, csvRows;
    if (st.modo === 'mensal') {
      const ms = meses(st.de, st.ate);
      const aps = ms.map(([k, a, b]) => apurar(a, b, st));
      const L = linhas([atual]);
      tabela = `<div class="table-wrap"><table class="tbl dc-tbl"><thead><tr><th>Descrição</th>${ms.map(([k]) => `<th class="r">${UI.monthLabel(k)}</th>`).join('')}<th class="r">Total</th><th class="r">% rec. bruta</th></tr></thead><tbody>
        ${L.map((l, i) => { const tot = l.calc(atual); return `<tr class="dc-${l.tipo}${l.final ? ' dc-final' : ''}${l.pred ? ' dc-click' : ''}" ${l.pred ? `data-dl="${i}"` : ''}><td>${esc(l.label)}</td>${aps.map(a => `<td class="r">${cel(l.calc(a))}</td>`).join('')}<td class="r"><b>${cel(tot)}</b></td><td class="r muted">${pctTxt(tot, t.rb)}</td></tr>`; }).join('')}
        </tbody></table></div>`;
      cols = [{ label: 'Descrição', k: 'label' }, ...ms.map(([k], i) => ({ label: UI.monthLabel(k), raw: r => r.vals[i] / 100, fmt: UI.n2 })), { label: 'Total', raw: r => r.tot / 100, fmt: UI.n2 }];
      csvRows = L.map(l => ({ label: l.label, vals: aps.map(a => l.calc(a)), tot: l.calc(atual) }));
      if (ms.length > 36) tabela = '<p class="small muted">Mostrando os primeiros 36 meses.</p>' + tabela;
      el._drill = L;
    } else {
      const [pa, pb] = anterior(st.de, st.ate);
      const prev = apurar(pa, pb, st);
      const L = linhas([atual, prev]);
      tabela = `<div class="table-wrap"><table class="tbl dc-tbl"><thead><tr><th>Descrição</th><th class="r">Valor</th><th class="r">% rec. bruta</th><th class="r" title="${UI.date(pa)} a ${UI.date(pb)}">Período anterior</th><th class="r">Variação</th></tr></thead><tbody>
        ${L.map((l, i) => { const v = l.calc(atual), p = l.calc(prev); return `<tr class="dc-${l.tipo}${l.final ? ' dc-final' : ''}${l.pred ? ' dc-click' : ''}" ${l.pred ? `data-dl="${i}"` : ''}><td>${esc(l.label)}</td><td class="r">${cel(v)}</td><td class="r muted">${pctTxt(v, t.rb)}</td><td class="r muted">${M(p)}</td><td class="r">${variacao(v, p)}</td></tr>`; }).join('')}
        </tbody></table></div><p class="small muted">Período anterior: ${UI.date(pa)} a ${UI.date(pb)} (mesmo número de dias).</p>`;
      cols = [{ label: 'Descrição', k: 'label' }, { label: 'Valor', raw: r => r.v / 100, fmt: UI.n2 }, { label: '% receita bruta', raw: r => t.rb ? r.v / t.rb * 100 : 0, fmt: UI.n2 }, { label: 'Período anterior', raw: r => r.p / 100, fmt: UI.n2 }];
      csvRows = L.map(l => ({ label: l.label, v: l.calc(atual), p: l.calc(prev) }));
      el._drill = L;
    }

    // memorando: o que NÃO é caixa, para conferência do gestor
    const hoje = UI.today();
    const abertosR = lancamentos(st).filter(f => f.tipo === 'R' && ['Venda', 'OS'].includes(f.origem) && ['Em aberto', 'Parcial'].includes(f.situacao));
    const aReceber = abertosR.reduce((s, f) => s + C(NEG.aPagar(f)), 0);
    const pagarVenc = lancamentos(st).filter(f => f.tipo === 'D' && ['Em aberto', 'Parcial'].includes(f.situacao) && f.vencimento >= st.de && f.vencimento <= st.ate);
    const aPagarPer = pagarVenc.reduce((s, f) => s + C(NEG.aPagar(f)), 0);
    const memo = [
      ['aparelho', 'Aparelhos recebidos na troca (pagamento em produto)', atual.memo.aparelho],
      ['credito', 'Uso de crédito do cliente (já contado quando o dinheiro entrou)', atual.memo.credito],
      ['excl', 'Lançamentos marcados para não considerar no DRE (efeito líquido)', atual.memo.excl]
    ];

    el.innerHTML = kpis +
      `<section class="card"><div class="dc-top"><h2>Geração de caixa — ${esc(periodoTxt)}</h2><span class="badge ${st.base === 'compensacao' ? 'warn' : ''}">${st.base === 'compensacao' ? 'Pela data de compensação' : 'Pela data do pagamento'}</span></div>${cascata(atual) || '<p class="empty">Nenhum pagamento ou recebimento no período.</p>'}</section>
      <section class="card dc-card"><div class="dc-top"><h2>Demonstrativo de resultado — regime de caixa</h2><span class="small muted">Clique em uma linha para ver os movimentos</span></div>${tabela}</section>
      <div class="cols-2">
        <section class="card"><h2>Conferência</h2>
          <table class="tbl dc-conf"><tbody>
            <tr><td>Movimento financeiro líquido do período (entradas − taxas − saídas)</td><td class="r">${M(conf + atual.memo.excl)}</td></tr>
            <tr><td>(−) Lançamentos fora do DRE</td><td class="r">${M(-atual.memo.excl)}</td></tr>
            <tr class="dc-res"><td>(=) Deve ser igual à geração de caixa</td><td class="r">${M(conf)}</td></tr>
          </tbody></table>
          <p class="dc-ok ${confOk ? 'ok' : 'bad'}">${FX.ic(confOk ? 'circle-check' : 'triangle-alert')} ${confOk ? 'Conferido: todos os pagamentos e recebimentos do período estão classificados no demonstrativo.' : 'Diferença de ' + M(conf - t.final) + ' entre o movimento financeiro e o demonstrativo.'}</p>
        </section>
        <section class="card"><h2>Fora do caixa (informativo)</h2>
          <table class="tbl dc-conf"><tbody>
            ${memo.map(([k, l, v]) => `<tr class="${atual.memoMovs[k].length ? 'dc-click' : ''}" data-memo="${k}"><td>${esc(l)}</td><td class="r">${M(v)}</td></tr>`).join('')}
            <tr><td>Saldo de vendas e OS a receber (em aberto hoje, ${UI.date(hoje)})</td><td class="r">${M(aReceber)}</td></tr>
            <tr><td>Contas a pagar com vencimento no período ainda não pagas</td><td class="r">${M(aPagarPer)}</td></tr>
          </tbody></table>
          <p class="small muted">Esses valores não entram no resultado porque não houve entrada ou saída de dinheiro no período.</p>
        </section>
      </div>
      <section class="card dc-nota"><h2>Como este DRE é calculado</h2><ul>
        <li><b>Regime de caixa:</b> cada valor entra no mês em que foi efetivamente pago ou recebido — não na data da venda, do vencimento ou da competência.</li>
        <li><b>Base de data:</b> "data do pagamento" usa o dia da baixa; "data de compensação" usa o dia em que o dinheiro cai na conta (prazo configurado em cada forma de pagamento, ex.: cartão de crédito).</li>
        <li><b>Vendas a prazo</b> (crediário e boleto) entram somente quando cada parcela é recebida. Vendas no cartão entram pelo valor bruto, e a taxa da operadora aparece em "Taxas".</li>
        <li><b>Compras de mercadoria</b> entram quando a conta do fornecedor é paga (não há CMV no regime de caixa).</li>
        <li><b>Aparelho na troca</b> e <b>uso de crédito do cliente</b> não movimentam dinheiro e ficam só no quadro informativo. O crédito comprado antecipadamente entra como "Adiantamentos de clientes" no dia em que o dinheiro foi recebido.</li>
        <li><b>Cancelamentos e devoluções</b> não apagam o recebimento original: o dinheiro devolvido aparece em "Devoluções e estornos" na data da devolução.</li>
        <li>Grupos de despesa seguem o campo "Grupo no DRE" de cada categoria (Financeiro › Configurações › Categorias). Para o DRE por competência, use o relatório "DRE gerencial (competência)".</li>
      </ul></section>`;

    REL._last = { cols, rows: csvRows };
    el.querySelectorAll('[data-dl]').forEach(tr => tr.onclick = () => { const l = el._drill[Number(tr.dataset.dl)]; detalhar(l.label.replace(/^\([−=]\)\s*/, ''), atual.movs.filter(m => l.pred(m.key)), periodoTxt); });
    el.querySelectorAll('[data-memo]').forEach(tr => tr.onclick = () => { const k = tr.dataset.memo; if (!atual.memoMovs[k].length) return; detalhar(memo.find(x => x[0] === k)[1], atual.memoMovs[k], periodoTxt); });
  }

  const opt = (key, label, opts, st) => `<label class="flt">${esc(label)} <select data-st="${key}" aria-label="${esc(label)}">${opts.map(([v, l]) => `<option value="${v}"${st[key] === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  REL.add('drecaixa', 'Financeiro', 'DRE regime de caixa', render, {
    desc: 'Resultado pelo dinheiro que efetivamente entrou e saiu: receitas e despesas pela data do pagamento ou recebimento, não pela data da venda ou da competência.',
    st: { base: 'pagamento', modo: 'periodo', loja: 'atual' },
    filtros: st => opt('base', 'Data', [['pagamento', 'Do pagamento'], ['compensacao', 'Da compensação']], st) +
      opt('modo', 'Visão', [['periodo', 'Período x anterior'], ['mensal', 'Mês a mês']], st) +
      (DB.list('unidades').length > 1 ? opt('loja', 'Lojas', [['atual', 'Loja atual'], ['todas', 'Todas as lojas']], st) : '')
  });
  REL.apurarCaixa = (de, ate, st = {}) => { const ap = apurar(de, ate, Object.assign({ base: 'pagamento', loja: 'atual' }, st)); return { valores: ap.v, totais: totais(ap), memo: ap.memo, conferencia: conferir(de, ate, Object.assign({ base: 'pagamento', loja: 'atual' }, st)) - ap.memo.excl }; };
})();
