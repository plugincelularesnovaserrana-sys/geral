/* =====================================================================
   Regras de negócio compartilhadas: estoque, financeiro, caixa,
   crédito do cliente, taxas, finalização de venda e de OS.
   ===================================================================== */
(function () {
  const r2 = UI.round2;

  const NEG = {
    TIPOS_PRODUTO: ['Aparelho', 'Acessório', 'Peça', 'Bike/Patinete', 'Serviço'],

    /* ---------------- estoque ---------------- */
    movEstoque(produto_id, qtd, tipo, origem, origem_id, obs) {
      const p = DB.get('produtos', produto_id);
      if (!p || p.tipo === 'Serviço') return;
      const nova = r2((Number(p.quantidade) || 0) + qtd);
      DB.update('produtos', p.id, { quantidade: nova }, { silent: true });
      DB.insert('movestoque', {
        produto_id: p.id, produto: NEG.descProduto(p), fornecedor_id: p.fornecedor_id || null, data: new Date().toISOString(),
        tipo, origem, origem_id, quantidade: qtd, saldo: nova, custo: p.custo, venda: p.preco, total_custo: r2(Math.abs(qtd) * (p.custo || 0)),
        total_venda: r2(Math.abs(qtd) * (p.preco || 0)), obs: obs || ''
      }, { silent: true });
      if (p.imei && qtd < 0 && nova <= 0) NEG.logImei(p.imei, `Saída: ${origem} #${origem_id}`);
      if (p.imei && qtd > 0) NEG.logImei(p.imei, `Entrada: ${origem} #${origem_id}`);
    },
    logImei(imei, evento) { DB.insert('imeihist', { imei, evento, data: new Date().toISOString() }, { silent: true }); },
    descProduto(p) {
      if (!p) return '';
      const parts = [p.tipo === 'Aparelho' ? (DB.get('modelos', p.modelo_id) || {}).nome : p.nome,
        p.gb_id ? (DB.get('gbs', p.gb_id) || {}).nome : '', p.cor_id ? (DB.get('cores', p.cor_id) || {}).nome : '',
        p.estado_id ? (DB.get('estados', p.estado_id) || {}).nome : ''];
      let d = parts.filter(Boolean).join(' ');
      if (!d) d = p.nome || ('Produto #' + p.id);
      return d;
    },
    estoqueDisponivel(p) { return p && p.tipo === 'Serviço' ? Infinity : Number(p.quantidade) || 0; },

    /* ---------------- formas de pagamento e taxas ---------------- */
    forma(id) { return DB.get('formaspag', id) || {}; },
    taxa(forma_id, parcelas, valor) {
      const f = NEG.forma(forma_id);
      if (!f.id) return 0;
      let pct = Number(f.taxa) || 0;
      const tab = String(f.taxas_parcelas || '').split(/[;,\s]+/).map(x => x.split(':')).filter(x => x.length === 2);
      const hit = tab.find(([n]) => Number(n) === Number(parcelas || 1));
      if (hit) pct = Number(String(hit[1]).replace(',', '.'));
      return r2(valor * pct / 100);
    },

    /* ---------------- caixa ---------------- */
    caixaAberto() { return DB.list('caixas').find(c => c.status === 'Aberto') || null; },
    caixaMov(tipo, valor, forma_id, desc, origem, origem_id) {
      const cx = NEG.caixaAberto();
      if (!cx) return null;
      const movs = (cx.movs || []).concat([{ data: new Date().toISOString(), tipo, valor: r2(valor), forma_id, desc, origem, origem_id, usuario: DB.userName() }]);
      DB.update('caixas', cx.id, { movs }, { silent: true });
      return cx.id;
    },
    resumoCaixa(cx) {
      const movs = cx.movs || [];
      const soma = t => r2(movs.filter(m => m.tipo === t).reduce((s, m) => s + m.valor, 0));
      const dinheiro = DB.list('formaspag').filter(f => f.tipo === 'Dinheiro').map(f => f.id);
      const entradasDinheiro = r2(movs.filter(m => m.tipo === 'Entrada' && dinheiro.includes(m.forma_id)).reduce((s, m) => s + m.valor, 0));
      const saidasDinheiro = r2(movs.filter(m => m.tipo === 'Saída' && dinheiro.includes(m.forma_id)).reduce((s, m) => s + m.valor, 0));
      const porForma = {};
      movs.filter(m => m.tipo === 'Entrada' || m.tipo === 'Saída').forEach(m => {
        const k = NEG.forma(m.forma_id).nome || 'Outros';
        porForma[k] = r2((porForma[k] || 0) + (m.tipo === 'Entrada' ? m.valor : -m.valor));
      });
      const sang = soma('Sangria'), sup = soma('Suprimento');
      const esperadoDinheiro = r2((cx.troco || 0) + sup - sang + entradasDinheiro - saidasDinheiro);
      return { entradas: soma('Entrada'), saidas: soma('Saída'), sangrias: sang, suprimentos: sup, porForma, esperadoDinheiro, saldo: r2((cx.troco || 0) + sup - sang + soma('Entrada') - soma('Saída')) };
    },

    /* ---------------- financeiro ---------------- */
    lancar(d) {
      const rec = Object.assign({ situacao: 'Em aberto', pagamentos: [], multa: 0, desconto: 0, competencia: d.vencimento, considerar: true }, d);
      rec.valor = r2(rec.valor); rec.total = r2(rec.valor + (rec.multa || 0) - (rec.desconto || 0));
      const pago = r2((rec.pagamentos || []).reduce((s, p) => s + p.valor, 0));
      rec.pago = pago; rec.situacao = NEG.situacaoFin(rec);
      return DB.insert('financeiro', rec);
    },
    situacaoFin(f) {
      if (f.situacao === 'Cancelado') return 'Cancelado';
      const pago = r2((f.pagamentos || []).reduce((s, p) => s + p.valor, 0));
      const tot = r2((f.valor || 0) + (f.multa || 0) - (f.desconto || 0));
      if (pago >= tot - 0.004 && tot > 0) return 'Pago';
      if (pago > 0) return 'Parcial';
      return 'Em aberto';
    },
    statusVenc(f) {
      if (f.situacao === 'Pago') return 'Pago';
      if (f.situacao === 'Cancelado') return 'Cancelado';
      const hoje = UI.today();
      if (f.vencimento < hoje) return 'Vencido';
      if (f.vencimento === hoje) return 'Vence hoje';
      return 'A vencer';
    },
    aPagar(f) { return r2(Math.max(0, (f.valor || 0) + (f.multa || 0) - (f.desconto || 0) - (f.pagamentos || []).reduce((s, p) => s + p.valor, 0))); },
    baixar(fin_id, pg) {
      const f = DB.get('financeiro', fin_id);
      const forma = NEG.forma(pg.forma_id);
      const p = Object.assign({ data: UI.today(), taxa: 0 }, pg);
      p.valor = r2(p.valor);
      p.compensacao = p.compensacao || UI.addDays(p.data, Number(forma.dias || 0));
      p.liquido = r2(p.valor - (p.taxa || 0));
      if (forma.tipo === 'Crédito do cliente' && f.tipo === 'R') {
        const saldo = NEG.saldoCredito(f.pessoa_id);
        if (saldo < p.valor - 0.004) throw new Error('Crédito do cliente insuficiente (' + UI.money(saldo) + ')');
        NEG.movCredito(f.pessoa_id, -p.valor, 'Uso em recebimento', 'financeiro', f.id);
      }
      if (DB.cfg().caixa_ativo !== false && forma.tipo !== 'Crédito do cliente' && forma.tipo !== 'Aparelho na troca') {
        p.caixa_id = NEG.caixaMov(f.tipo === 'R' ? 'Entrada' : 'Saída', p.valor, p.forma_id, f.titulo, f.origem || 'Financeiro', f.id);
      }
      const pagamentos = (f.pagamentos || []).concat([p]);
      const patch = { pagamentos, pago: r2(pagamentos.reduce((s, x) => s + x.valor, 0)) };
      patch.situacao = NEG.situacaoFin(Object.assign({}, f, patch));
      if (forma.banco_id) NEG.movBanco(forma.banco_id, f.tipo === 'R' ? p.liquido : -p.valor, f.titulo, p.compensacao);
      return DB.update('financeiro', f.id, patch);
    },
    movBanco(banco_id, valor, desc, data) {
      const b = DB.get('bancos', banco_id); if (!b) return;
      const movs = (b.movs || []).concat([{ data: data || UI.today(), valor: r2(valor), desc }]);
      DB.update('bancos', b.id, { movs, saldo: r2((b.saldo_inicial || 0) + movs.reduce((s, m) => s + m.valor, 0)) }, { silent: true });
    },

    /* ---------------- crédito do cliente ---------------- */
    saldoCredito(pessoa_id) {
      if (!pessoa_id) return 0;
      return r2(DB.list('creditos').filter(c => c.pessoa_id === pessoa_id && c.status !== 'Cancelado').reduce((s, c) => s + (c.valor || 0), 0));
    },
    movCredito(pessoa_id, valor, motivo, origem, origem_id, extra) {
      return DB.insert('creditos', Object.assign({ pessoa_id, valor: r2(valor), tipo: valor >= 0 ? 'Entrada' : 'Saída', motivo, origem, origem_id, status: 'Ativo', data: new Date().toISOString() }, extra || {}));
    },

    /* ---------------- vendas ---------------- */
    totaisVenda(v) {
      const itens = v.itens || [];
      const bruto = r2(itens.reduce((s, i) => s + i.preco * i.qtd, 0));
      const descItens = r2(itens.reduce((s, i) => s + (i.desconto || 0), 0));
      const seguros = r2(itens.reduce((s, i) => s + (i.seguro_valor || 0), 0));
      const total = r2(bruto - descItens + seguros);
      const custo = r2(itens.reduce((s, i) => s + (i.custo || 0) * i.qtd, 0));
      const pagos = r2((v.pagamentos || []).reduce((s, p) => s + p.valor, 0));
      const taxas = r2((v.pagamentos || []).reduce((s, p) => s + (p.taxa || 0), 0));
      return { bruto, descontos: descItens, seguros, total, custo, pagos, taxas, saldo: r2(total - pagos), lucro: r2(total - custo - taxas) };
    },
    finalizarVenda(v) {
      const t = NEG.totaisVenda(v);
      const cfg = DB.cfg();
      if (Math.abs(t.saldo) > 0.004 && cfg.venda_valor_exato !== false && t.saldo > 0) throw new Error('Falta receber ' + UI.money(t.saldo));
      // estoque
      for (const it of v.itens) {
        const p = DB.get('produtos', it.produto_id);
        if (p && p.tipo !== 'Serviço') {
          const permite = p.tipo === 'Peça' ? cfg.pecas_sem_estoque : cfg.venda_sem_estoque;
          if (!permite && NEG.estoqueDisponivel(p) < it.qtd) throw new Error('Sem estoque: ' + it.descricao);
        }
      }
      v.itens.forEach(it => NEG.movEstoque(it.produto_id, -it.qtd, 'Saída', 'Venda', v.id, 'Venda #' + v.id));
      // financeiro: um lançamento por pagamento (crediário vira parcelas)
      const cliente = DB.get('pessoas', v.cliente_id) || {};
      const catVenda = (DB.list('categoriasfin').find(c => c.sistema === 'venda') || {}).id;
      v.pagamentos.forEach(pg => {
        const f = NEG.forma(pg.forma_id);
        if (f.tipo === 'Aparelho na troca') {
          NEG.lancar({ tipo: 'R', titulo: `Venda #${v.id} - aparelho na troca`, pessoa_id: v.cliente_id, valor: pg.valor, vencimento: UI.dia(v.data), categoria_id: catVenda, origem: 'Venda', origem_id: v.id, forma_id: pg.forma_id,
            pagamentos: [{ forma_id: pg.forma_id, valor: pg.valor, data: UI.dia(v.data), taxa: 0, liquido: pg.valor }] });
          return;
        }
        if (f.tipo === 'Crediário' || f.tipo === 'Boleto' || pg.a_prazo) {
          const n = Math.max(1, Number(pg.parcelas) || 1);
          const base = r2(pg.valor / n);
          for (let i = 0; i < n; i++) {
            const valor = i === n - 1 ? r2(pg.valor - base * (n - 1)) : base;
            NEG.lancar({ tipo: 'R', titulo: `Venda #${v.id} - parcela ${i + 1}/${n}`, pessoa_id: v.cliente_id, valor, vencimento: UI.addMonths(pg.primeiro_venc || UI.addMonths(v.data, 1), i),
              categoria_id: catVenda, origem: 'Venda', origem_id: v.id, forma_id: pg.forma_id, parcela: `${i + 1}/${n}` });
          }
          return;
        }
        const rec = NEG.lancar({ tipo: 'R', titulo: `Venda #${v.id} - ${cliente.nome || 'Consumidor'}`, pessoa_id: v.cliente_id, valor: pg.valor, vencimento: UI.dia(v.data), categoria_id: catVenda, origem: 'Venda', origem_id: v.id, forma_id: pg.forma_id, parcela: pg.parcelas > 1 ? pg.parcelas + 'x' : '' });
        try { NEG.baixar(rec.id, { forma_id: pg.forma_id, valor: pg.valor, data: UI.dia(v.data), taxa: pg.taxa || 0 }); }
        catch (e) { DB.update('financeiro', rec.id, { situacao: 'Cancelado' }); throw e; }
      });
      // garantias
      const termo = DB.get('termos', v.termo_id);
      const dias = Math.max(0, ...v.itens.map(i => Number(i.garantia_dias) || 0), termo ? Number(termo.dias) || 0 : 0);
      const patch = Object.assign({ status: 'Concluída', finalizada_em: new Date().toISOString(), garantia_ate: dias ? UI.addDays(v.data, dias) : null }, {
        total: t.total, total_custo: t.custo, total_taxas: t.taxas, lucro: t.lucro, desconto_total: t.descontos
      });
      // seguros
      v.itens.filter(i => i.seguro_valor > 0).forEach(i => DB.insert('seguros', { venda_id: v.id, item: i.descricao, cliente_id: v.cliente_id, valor: i.seguro_valor, comissao: r2(i.seguro_valor * (Number(cfg.seguro_comissao_pct) || 0) / 100), status: 'Ativo', confirmacao: 'Pendente' }));
      return DB.update('vendas', v.id, patch);
    },
    /* categoria de sistema: encontra ou cria (para bases antigas) */
    categoria(sistema, nome, tipo, dre) {
      let c = DB.list('categoriasfin').find(x => x.sistema === sistema);
      if (!c) c = DB.insert('categoriasfin', { nome, tipo, dre, sistema }, { silent: true });
      return c.id;
    },
    /* desfaz todos os pagamentos de um lançamento: caixa, banco e crédito do cliente voltam ao que eram */
    estornarPagamentos(f, rotulo = 'Estorno') {
      (f.pagamentos || []).forEach(p => {
        const forma = NEG.forma(p.forma_id);
        if (forma.banco_id) NEG.movBanco(forma.banco_id, f.tipo === 'R' ? -(p.liquido != null ? p.liquido : p.valor) : p.valor, rotulo + ': ' + f.titulo);
        if (p.caixa_id) NEG.caixaMov(f.tipo === 'R' ? 'Saída' : 'Entrada', p.valor, p.forma_id, rotulo + ': ' + f.titulo, 'Financeiro', f.id);
        if (forma.tipo === 'Crédito do cliente' && f.tipo === 'R' && f.pessoa_id) NEG.movCredito(f.pessoa_id, p.valor, 'Estorno de recebimento', 'financeiro', f.id);
      });
      const atual = DB.get('financeiro', f.id);
      return DB.update('financeiro', f.id, { pagamentos: [], pago: 0, situacao: NEG.situacaoFin(Object.assign({}, atual, { pagamentos: [], pago: 0, situacao: atual.situacao === 'Cancelado' ? 'Cancelado' : 'Em aberto' })) });
    },
    naoFinanceira(forma_id) { const t = NEG.forma(forma_id).tipo; return t === 'Crédito do cliente' || t === 'Aparelho na troca'; },
    /* Desfaz os recebimentos de uma venda/OS cancelada.
       O que entrou em dinheiro/PIX/cartão vira um ESTORNO pago hoje (o recebimento original continua na data em que aconteceu);
       crédito do cliente volta como crédito; parcelas ainda não recebidas são canceladas. */
    estornarRecebimentos(origem, origem_id, rotulo, jaDevolvido = 0) {
      let abater = r2(jaDevolvido);
      const cat = NEG.categoria('devolucao', 'Devoluções e estornos', 'Despesa', 'Devoluções');
      DB.list('financeiro').filter(f => f.tipo === 'R' && f.origem === origem && f.origem_id === origem_id && f.situacao !== 'Cancelado').forEach(f => {
        const pags = f.pagamentos || [];
        if (!pags.length) { DB.update('financeiro', f.id, { situacao: 'Cancelado' }); return; }
        pags.forEach(p => {
          const t = NEG.forma(p.forma_id).tipo;
          if (t === 'Crédito do cliente') { const u = Math.min(abater, p.valor); abater = r2(abater - u); if (p.valor - u > 0.004) NEG.movCredito(f.pessoa_id, r2(p.valor - u), 'Estorno de ' + rotulo, origem.toLowerCase(), origem_id); return; }
          if (t === 'Aparelho na troca') return;
          const usado = Math.min(abater, p.valor); abater = r2(abater - usado);
          const valor = r2(p.valor - usado);
          if (valor <= 0.004) return;
          const d = NEG.lancar({ tipo: 'D', titulo: `Estorno ${rotulo} — ${f.titulo}`, pessoa_id: f.pessoa_id, valor, vencimento: UI.today(), categoria_id: cat, origem: 'Devolução', origem_id, estorno_de: f.id });
          NEG.baixar(d.id, { forma_id: p.forma_id, valor, data: UI.today(), taxa: 0 });
        });
        const resto = NEG.aPagar(f);
        if (resto > 0.004) DB.update('financeiro', f.id, { desconto: r2((f.desconto || 0) + resto), situacao: 'Pago', obs: ((f.obs || '') + ' Saldo cancelado (' + rotulo + ').').trim() });
      });
    },
    cancelarVenda(v, motivo) {
      if (v.status === 'Concluída') {
        v.itens.forEach(it => { const q = it.qtd - (it.qtd_devolvida || 0); if (q > 0) NEG.movEstoque(it.produto_id, q, 'Entrada', 'Cancelamento de venda', v.id); });
        NEG.estornarRecebimentos('Venda', v.id, 'venda #' + v.id + ' cancelada', v.devolvido_valor || 0);
      }
      return DB.update('vendas', v.id, { status: 'Cancelada', cancelada_em: new Date().toISOString(), motivo_cancelamento: motivo || '' });
    },
    comissao(vendedor_id, valor, lucro, tipo) {
      const v = DB.get('vendedores', vendedor_id) || {};
      const regra = (v.regras || []).find(r => r.tipo === tipo) || { modelo: v.modelo_comissao || 'Sobre venda', pct: v.comissao_pct || 0 };
      const base = regra.modelo === 'Sobre lucro' ? lucro : valor;
      return { modelo: regra.modelo, pct: Number(regra.pct) || 0, valor: r2(base * (Number(regra.pct) || 0) / 100) };
    },

    /* ---------------- OS ---------------- */
    totaisOS(o) {
      const sv = o.servicos || [], pc = o.pecas || [];
      const servicos = r2(sv.reduce((s, x) => s + (x.valor || 0) - (x.desconto || 0), 0));
      const pecas = r2(pc.reduce((s, x) => s + (x.valor || 0) * (x.qtd || 1), 0));
      const custo = r2(sv.reduce((s, x) => s + (x.custo || 0), 0) + pc.reduce((s, x) => s + (x.custo || 0) * (x.qtd || 1), 0));
      const taxas = r2(sv.reduce((s, x) => s + (x.taxa || 0), 0) + (o.pagamentos || []).reduce((s, p) => s + (p.taxa || 0), 0));
      const total = r2(servicos + pecas - (o.desconto || 0));
      const pago = r2((o.pagamentos || []).reduce((s, p) => s + p.valor, 0));
      return { servicos, pecas, custo, taxas, total, pago, saldo: r2(total - pago), lucro: r2(total - custo - taxas) };
    },
    situacao(id) { return DB.get('situacoesos', id) || {}; },
    aplicarSituacaoOS(o, novaId) {
      const nova = NEG.situacao(novaId);
      const patch = { situacao_id: novaId };
      const t = NEG.totaisOS(o);
      if (nova.finalidade === 'Finalizada' && !o.financeiro_gerado) {
        (o.pecas || []).forEach(pc => pc.produto_id && NEG.movEstoque(pc.produto_id, -(pc.qtd || 1), 'Saída', 'Ordem de serviço', o.id));
        const cat = (DB.list('categoriasfin').find(c => c.sistema === 'os') || {}).id;
        const pags = o.pagamentos || [];
        pags.forEach(pg => {
          const f = NEG.forma(pg.forma_id);
          const n = Math.max(1, Number(pg.parcelas) || 1);
          if (f.tipo === 'Crediário' || f.tipo === 'Boleto') {
            for (let i = 0; i < n; i++) NEG.lancar({ tipo: 'R', titulo: `OS #${o.id} - parcela ${i + 1}/${n}`, pessoa_id: o.cliente_id, valor: r2(pg.valor / n), vencimento: UI.addMonths(UI.today(), i + 1), categoria_id: cat, origem: 'OS', origem_id: o.id, forma_id: pg.forma_id, parcela: `${i + 1}/${n}` });
          } else {
            const rec = NEG.lancar({ tipo: 'R', titulo: `OS #${o.id}`, pessoa_id: o.cliente_id, valor: pg.valor, vencimento: pg.data || UI.today(), categoria_id: cat, origem: 'OS', origem_id: o.id, forma_id: pg.forma_id });
            NEG.baixar(rec.id, { forma_id: pg.forma_id, valor: pg.valor, data: pg.data || UI.today(), taxa: pg.taxa || 0 });
          }
        });
        const resto = r2(t.total - pags.reduce((s, p) => s + p.valor, 0));
        if (resto > 0.004) NEG.lancar({ tipo: 'R', titulo: `OS #${o.id} - saldo a receber`, pessoa_id: o.cliente_id, valor: resto, vencimento: UI.today(), categoria_id: cat, origem: 'OS', origem_id: o.id });
        Object.assign(patch, { financeiro_gerado: true, data_finalizacao: o.data_finalizacao || new Date().toISOString(), total: t.total, custo: t.custo, lucro: t.lucro });
        const termo = DB.get('termos', o.termo_saida_id);
        if (termo && termo.dias) patch.garantia_ate = UI.addDays(UI.today(), Number(termo.dias));
      }
      if (nova.finalidade === 'Cancelada' && o.financeiro_gerado) {
        (o.pecas || []).forEach(pc => pc.produto_id && NEG.movEstoque(pc.produto_id, pc.qtd || 1, 'Entrada', 'OS cancelada', o.id));
        NEG.estornarRecebimentos('OS', o.id, 'OS #' + o.id + ' cancelada');
        patch.financeiro_gerado = false;
      }
      DB.update('os', o.id, patch);
      const cfg = DB.cfg();
      if (cfg.os_whats_situacao && nova.whats_modelo_id) {
        const cli = DB.get('pessoas', o.cliente_id) || {};
        const m = DB.get('whatsmodelos', nova.whats_modelo_id);
        if (m && cli.telefone) UI.whats(cli.telefone, UI.fillTemplate(m.texto, { cliente: cli.nome, os: o.id, situacao: nova.nome, total: UI.money(t.total), loja: (DB.get('unidades', DB.unitId()) || {}).nome }));
      }
    }
  };
  window.NEG = NEG;
})();
