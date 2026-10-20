/* Dados iniciais genéricos: criados só na primeira vez que o sistema abre */
(function () {
  const ins = (col, rows) => rows.map(r => DB.insert(col, r, { silent: true }));
  const nm = arr => arr.map(nome => ({ nome }));

  window.SEED = {
    run() {
      DB.setCfg({
        sistema_nome: 'Gestor Loja', empresa_nome: 'Minha Loja de Celulares',
        caixa_ativo: true, credito_ativo: true, indicacao_ativo: true, venda_valor_exato: true, venda_sem_estoque: false, pecas_sem_estoque: true,
        gerar_recibo: true, whats_recibo: false, recibo_parcelas: true, os_bloquear_custo_vendedor: false, desconto_max: 10, garantia_padrao: 90, os_whats_situacao: false, os_whats_criar: false,
        os_status_publico: false, os_justificativa: false, fechamento_cego: false, pedir_motivo_exclusao: true, seguro_comissao_pct: 30,
        bloquear_lucro_vendedor: true, estoque_imei_unico: true, estoque_transfer_aceite: false, estoque_senha_editar: false,
        precos_multiplos: true, atacado_ativo: false,
        msg_recibo: 'Olá {cliente}! Obrigado pela compra na {loja}. Venda #{venda}, total {total}.',
        recibo_rodape: 'Obrigado pela preferência! Trocas somente com este recibo.',
        catalogo_ativo: true, catalogo_whats: '', catalogo_titulo: 'Nossos aparelhos'
      });
      ins('unidades', [
        { nome: 'Loja Matriz', apelido: 'Matriz', cnpj: '00.000.000/0001-00', telefone: '(00) 00000-0000', endereco: 'Rua Principal, 100 - Centro', cidade: 'Cidade', uf: 'MG', regime: 'Simples Nacional', ambiente: 'Homologação (testes)', nfe_serie: '1', nfe_ultima: 0, cor: '#2f5bea' },
        { nome: 'Loja Filial', apelido: 'Filial', cnpj: '00.000.000/0002-00', telefone: '(00) 00000-0001', endereco: 'Avenida Secundária, 200', cidade: 'Cidade', uf: 'MG', regime: 'Simples Nacional', ambiente: 'Homologação (testes)', cor: '#17784c' }
      ]);
      DB.setUnit(1);
      const [pG, pV, pT] = ins('perfis', [
        { nome: 'Gerente', permissoes: ['tudo'], desconto_max: 100 },
        { nome: 'Vendedor', permissoes: ['vendas', 'estoque', 'os', 'caixa'], desconto_max: 10 },
        { nome: 'Técnico', permissoes: ['os', 'estoque'], desconto_max: 0 }
      ]);
      const vend = ins('vendedores', [
        { nome: 'Gerente', ativo: true, modelo_comissao: 'Sobre lucro', comissao_pct: 0 },
        { nome: 'Vendedor 1', ativo: true, modelo_comissao: 'Sobre lucro', comissao_pct: 10 },
        { nome: 'Vendedor 2', ativo: true, modelo_comissao: 'Sobre lucro', comissao_pct: 10 }
      ]);
      ins('usuarios', [
        { nome: 'Gerente', login: 'gerente', senha: '1234', perfil_id: pG.id, vendedor_id: vend[0].id, ativo: true, unidades: [] },
        { nome: 'Vendedor 1', login: 'vendedor1', senha: '1111', perfil_id: pV.id, vendedor_id: vend[1].id, ativo: true, unidades: [] },
        { nome: 'Vendedor 2', login: 'vendedor2', senha: '2222', perfil_id: pV.id, vendedor_id: vend[2].id, ativo: true, unidades: [] }
      ]);

      /* financeiro */
      const plano = ins('planocontas', [
        { codigo: '1', nome: 'Receitas', tipo: 'Receita' }, { codigo: '2', nome: 'Custos', tipo: 'Despesa' }, { codigo: '3', nome: 'Despesas operacionais', tipo: 'Despesa' }
      ]);
      ins('categoriasfin', [
        { nome: 'Vendas', tipo: 'Receita', plano_id: plano[0].id, dre: 'Receita de vendas', sistema: 'venda' },
        { nome: 'Ordens de serviço', tipo: 'Receita', plano_id: plano[0].id, dre: 'Receita de OS', sistema: 'os' },
        { nome: 'Outras receitas', tipo: 'Receita', plano_id: plano[0].id, dre: 'Outras receitas' },
        { nome: 'Compra de mercadoria', tipo: 'Despesa', plano_id: plano[1].id, dre: 'Não considerar', sistema: 'compra' },
        { nome: 'Compra de aparelho do cliente (upgrade)', tipo: 'Despesa', plano_id: plano[1].id, dre: 'Não considerar', sistema: 'downgrade' },
        { nome: 'Aluguel', tipo: 'Despesa', plano_id: plano[2].id, dre: 'Despesa operacional' },
        { nome: 'Energia e internet', tipo: 'Despesa', plano_id: plano[2].id, dre: 'Despesa operacional' },
        { nome: 'Salários e comissões', tipo: 'Despesa', plano_id: plano[2].id, dre: 'Despesa com pessoal' },
        { nome: 'Impostos', tipo: 'Despesa', plano_id: plano[2].id, dre: 'Impostos' },
        { nome: 'Marketing', tipo: 'Despesa', plano_id: plano[2].id, dre: 'Despesa operacional' },
        { nome: 'Outras despesas', tipo: 'Despesa', plano_id: plano[2].id, dre: 'Despesa operacional' },
        { nome: 'Devoluções e estornos', tipo: 'Despesa', plano_id: plano[0].id, dre: 'Devoluções', sistema: 'devolucao' },
        { nome: 'Adiantamentos de clientes', tipo: 'Receita', plano_id: plano[0].id, dre: 'Adiantamentos de clientes', sistema: 'adiantamento' },
        { nome: 'Pró-labore', tipo: 'Despesa', plano_id: plano[2].id, dre: 'Despesa com pessoal' },
        { nome: 'Investimentos e equipamentos', tipo: 'Despesa', plano_id: plano[2].id, dre: 'Investimentos' }
      ]);
      const bancos = ins('bancos', [{ nome: 'Conta principal', saldo_inicial: 0, data_inicial: UI.today(), ativo: true, saldo: 0, movs: [] }]);
      ins('formaspag', [
        { nome: 'Dinheiro', tipo: 'Dinheiro', dias: 0, taxa: 0, max_parcelas: 1, pdv: true, ativo: true },
        { nome: 'PIX', tipo: 'PIX', dias: 0, taxa: 0, max_parcelas: 1, banco_id: bancos[0].id, pdv: true, ativo: true },
        { nome: 'Cartão de débito', tipo: 'Débito', dias: 1, taxa: 1.2, max_parcelas: 1, banco_id: bancos[0].id, pdv: true, ativo: true },
        { nome: 'Cartão de crédito', tipo: 'Crédito', dias: 30, taxa: 3.2, taxas_parcelas: '1:3.2,2:4.6,3:5.3,4:6,5:6.7,6:7.4,7:8.1,8:8.8,9:9.5,10:10.2,11:10.9,12:11.6', max_parcelas: 12, banco_id: bancos[0].id, pdv: true, ativo: true },
        { nome: 'Crediário da loja', tipo: 'Crediário', dias: 0, taxa: 0, max_parcelas: 36, pdv: true, ativo: true },
        { nome: 'Boleto', tipo: 'Boleto', dias: 2, taxa: 0, max_parcelas: 12, banco_id: bancos[0].id, pdv: true, ativo: true },
        { nome: 'Crédito do cliente', tipo: 'Crédito do cliente', dias: 0, taxa: 0, max_parcelas: 1, pdv: true, ativo: true },
        { nome: 'Aparelho na troca', tipo: 'Aparelho na troca', dias: 0, taxa: 0, max_parcelas: 1, pdv: true, ativo: true }
      ]);

      /* vendas */
      ins('tiposvenda', [{ nome: 'Venda normal', ordem: 1 }, { nome: 'Upgrade', ordem: 2 }, { nome: 'Downgrade', ordem: 3 }, { nome: 'Atacado', ordem: 4 }, { nome: 'Locação', ordem: 5 }]);
      ins('canais', nm(['Loja física', 'WhatsApp', 'Instagram', 'Site / catálogo', 'Indicação']));
      ins('tiposentrega', [{ nome: 'Retirada na loja', valor: 0 }, { nome: 'Motoboy', valor: 10 }, { nome: 'Correios', valor: 0 }]);
      ins('tagspessoa', [{ nome: 'VIP', cor: '#b8860b' }, { nome: 'Atacado', cor: '#2f5bea' }, { nome: 'Inadimplente', cor: '#c0352b' }]);
      ins('termos', [
        { tipo: 'Garantia de venda', nome: 'Garantia padrão - aparelhos seminovos', dias: 90, texto: 'O aparelho {produto}, IMEI {imei}, possui garantia de {dias} dias contra defeitos de funcionamento a partir de {data}.\nA garantia não cobre: quedas, contato com líquidos, tela quebrada, mau uso ou violação do aparelho.\nCliente: {cliente} - CPF {cpf}' },
        { tipo: 'Garantia de venda', nome: 'Garantia - acessórios', dias: 30, texto: 'Acessórios possuem garantia de {dias} dias contra defeito de fabricação.' },
        { tipo: 'Termo de compra', nome: 'Termo de compra de aparelho usado', dias: 0, texto: 'Eu, {cliente}, CPF {cpf}, declaro ser o legítimo proprietário do aparelho {produto}, IMEI {imei}, e que o vendo à {loja} nesta data ({data}), livre de qualquer restrição, responsabilizando-me civil e criminalmente pela procedência.' },
        { tipo: 'Entrada de OS', nome: 'Termo de entrada', dias: 0, texto: 'O aparelho foi recebido para análise. Orçamentos não aprovados em 30 dias e aparelhos não retirados em 90 dias após o aviso poderão ser descartados conforme a lei.' },
        { tipo: 'Saída de OS', nome: 'Garantia de serviço', dias: 90, texto: 'O serviço realizado tem garantia de {dias} dias, válida somente para o defeito reparado e peças trocadas.' }
      ]);
      ins('whatsmodelos', [
        { titulo: 'Recibo de venda', tipo: 'Recibo de venda', padrao: true, texto: 'Olá {cliente}! Obrigado pela compra na {loja}. Venda #{venda}, total {total}.' },
        { titulo: 'OS - aparelho pronto', tipo: 'Ordem de serviço', padrao: true, texto: 'Olá {cliente}! Seu aparelho da OS #{os} está pronto para retirada. Total: {total}. {loja}' },
        { titulo: 'OS - aguardando peça', tipo: 'Ordem de serviço', texto: 'Olá {cliente}! A OS #{os} está aguardando a chegada da peça. Avisaremos assim que chegar.' },
        { titulo: 'Cobrança de parcela', tipo: 'Cobrança', padrao: true, texto: 'Olá {cliente}! Lembramos que a parcela de {valor} vence em {vencimento}. Qualquer dúvida estamos à disposição. {loja}' },
        { titulo: 'Feliz aniversário', tipo: 'Aniversário', padrao: true, texto: 'Feliz aniversário, {cliente}! 🎉 A equipe da {loja} deseja um ótimo dia.' }
      ]);

      /* estoque */
      const marcas = ins('marcas', nm(['Apple', 'Samsung', 'Motorola', 'Xiaomi', 'Genérica']));
      ins('gbs', nm(['64GB', '128GB', '256GB', '512GB', '1TB']));
      ins('cores', nm(['Preto', 'Branco', 'Azul', 'Verde', 'Rosa', 'Roxo', 'Vermelho', 'Dourado', 'Prata', 'Grafite', 'Titânio natural']));
      ins('estados', nm(['Novo', 'Seminovo', 'Vitrine', 'Recondicionado', 'Com defeito']));
      const cats = ins('categorias', nm(['Smartphones', 'Capas e películas', 'Carregadores e cabos', 'Fones', 'Peças de reposição', 'Outros']));
      ins('subcategorias', [{ nome: 'iPhone', categoria_id: cats[0].id }, { nome: 'Android', categoria_id: cats[0].id }, { nome: 'Capas', categoria_id: cats[1].id }, { nome: 'Películas', categoria_id: cats[1].id }, { nome: 'Telas', categoria_id: cats[4].id }, { nome: 'Baterias', categoria_id: cats[4].id }]);
      ins('disponibilidades', [{ nome: 'Disponível para venda', exibir_venda: true, cor: '#17784c' }, { nome: 'Reservado', exibir_venda: false, cor: '#9a5b00' }, { nome: 'Em manutenção', exibir_venda: false, cor: '#c0352b' }, { nome: 'Uso interno / imobilizado', exibir_venda: false, cor: '#5f6b80' }]);
      ins('tiposproduto', [
        { nome: 'Aparelho celular', ncm: '85171300', cst: '102', origem: '0 - Nacional', cfop_est: '5102', cfop_inter: '6102' },
        { nome: 'Acessório', ncm: '85176299', cst: '102', origem: '2 - Estrangeira (mercado interno)', cfop_est: '5102', cfop_inter: '6102' },
        { nome: 'Peça', ncm: '85177900', cst: '102', origem: '2 - Estrangeira (mercado interno)', cfop_est: '5102', cfop_inter: '6102' }
      ]);
      const mods = ins('modelos', [
        { nome: 'iPhone 11', marca_id: marcas[0].id, qtd_minima: 1 }, { nome: 'iPhone 12', marca_id: marcas[0].id, qtd_minima: 1 }, { nome: 'iPhone 13', marca_id: marcas[0].id, qtd_minima: 2 },
        { nome: 'iPhone 14', marca_id: marcas[0].id, qtd_minima: 1 }, { nome: 'iPhone 15', marca_id: marcas[0].id, qtd_minima: 1 }, { nome: 'iPhone 16', marca_id: marcas[0].id },
        { nome: 'Galaxy A15', marca_id: marcas[1].id }, { nome: 'Galaxy S23', marca_id: marcas[1].id }, { nome: 'Moto G54', marca_id: marcas[2].id }, { nome: 'Redmi Note 13', marca_id: marcas[3].id }
      ]);
      ins('modelosetiqueta', [{ nome: 'Etiqueta 50x30', largura: 50, altura: 30, colunas: 3, campos: ['Descrição', 'Preço', 'IMEI', 'Código'] }]);
      ins('checklists', [{ nome: 'Checklist de entrada - smartphone', itens: 'Liga\nTela sem riscos\nTouch funcionando\nFace ID / biometria\nCâmera traseira\nCâmera frontal\nAlto-falante\nMicrofone\nCarregamento\nWi-Fi e Bluetooth\nBotões\nVibração\nSinal de operadora' }]);

      /* OS */
      ins('situacoesos', [
        { nome: 'Em andamento', cor: '#2f5bea', finalidade: 'Em andamento', ordem: 1 },
        { nome: 'Aguardando aprovação', cor: '#9a5b00', finalidade: 'Aguardando', ordem: 2 },
        { nome: 'Aguardando peça', cor: '#b8860b', finalidade: 'Aguardando', ordem: 3, whats_modelo_id: 3 },
        { nome: 'Aprovado', cor: '#6a4fc9', finalidade: 'Em andamento', ordem: 4 },
        { nome: 'Aguardando retirada', cor: '#0f8a8a', finalidade: 'Aguardando', ordem: 5, whats_modelo_id: 2 },
        { nome: 'Finalizado', cor: '#17784c', finalidade: 'Finalizada', ordem: 6 },
        { nome: 'Cancelado', cor: '#c0352b', finalidade: 'Cancelada', ordem: 7 }
      ]);
      ins('prioridades', [{ nome: 'Normal', dias: 3, cor: '#5f6b80' }, { nome: 'Urgente', dias: 1, cor: '#c0352b' }, { nome: 'Baixa', dias: 7, cor: '#17784c' }]);
      ins('tiposos', nm(['Reparo', 'Garantia', 'Orçamento', 'Configuração']));
      ins('servicos', [
        { nome: 'Troca de tela', custo: 0, valor: 350, garantia_dias: 90 }, { nome: 'Troca de bateria', custo: 0, valor: 180, garantia_dias: 90 },
        { nome: 'Troca de conector de carga', custo: 0, valor: 150, garantia_dias: 90 }, { nome: 'Troca de tampa traseira', custo: 0, valor: 200, garantia_dias: 90 },
        { nome: 'Limpeza / oxidação', custo: 0, valor: 120, garantia_dias: 0 }, { nome: 'Transferência de dados', custo: 0, valor: 50, garantia_dias: 0 },
        { nome: 'Ativação de chip e configuração', custo: 0, valor: 30, garantia_dias: 0 }, { nome: 'Diagnóstico', custo: 0, valor: 0, garantia_dias: 0 }
      ]);

      /* pessoas */
      ins('pessoas', [
        { nome: 'Consumidor final', cliente: true, tipo_pessoa: 'Física' },
        { nome: 'Cliente Exemplo', cliente: true, tipo_pessoa: 'Física', cpf: '111.111.111-11', telefone: '(00) 90000-0001', cidade: 'Cidade', uf: 'MG', origem: 'Loja física', nascimento: '1990-' + UI.today().slice(5, 10), genero: 'Não informado' },
        { nome: 'Fornecedor Exemplo Ltda', fornecedor: true, cliente: false, tipo_pessoa: 'Jurídica', cpf: '22.222.222/0001-22', telefone: '(00) 3000-0000', cidade: 'São Paulo', uf: 'SP' },
        { nome: 'Técnico Exemplo', tecnico: true, cliente: false, tipo_pessoa: 'Física', telefone: '(00) 90000-0003' },
        { nome: 'Motoboy Exemplo', motoboy: true, cliente: false, tipo_pessoa: 'Física', telefone: '(00) 90000-0004' }
      ]);

      /* produtos de exemplo, com entrada no estoque */
      const prods = [
        { tipo: 'Aparelho', modelo_id: mods[2].id, gb_id: 2, cor_id: 1, estado_id: 2, imei: '350000000000011', bateria: 88, custo: 2100, preco: 2799, quantidade: 1, garantia_dias: 90 },
        { tipo: 'Aparelho', modelo_id: mods[3].id, gb_id: 2, cor_id: 3, estado_id: 2, imei: '350000000000029', bateria: 91, custo: 2900, preco: 3699, quantidade: 1, garantia_dias: 90 },
        { tipo: 'Aparelho', modelo_id: mods[6].id, gb_id: 2, cor_id: 1, estado_id: 1, imei: '350000000000037', custo: 780, preco: 1099, quantidade: 1, garantia_dias: 365 },
        { tipo: 'Acessório', nome: 'Capa silicone iPhone 13', categoria_id: cats[1].id, custo: 12, preco: 49.9, quantidade: 10, codigo_barras: '7890000000011', garantia_dias: 30 },
        { tipo: 'Acessório', nome: 'Película de vidro 3D', categoria_id: cats[1].id, custo: 5, preco: 29.9, quantidade: 25, codigo_barras: '7890000000028', garantia_dias: 0 },
        { tipo: 'Acessório', nome: 'Carregador USB-C 20W', categoria_id: cats[2].id, custo: 28, preco: 89.9, quantidade: 8, codigo_barras: '7890000000035', garantia_dias: 90 },
        { tipo: 'Peça', nome: 'Tela iPhone 11 (incell)', categoria_id: cats[4].id, custo: 160, preco: 0, quantidade: 3, qtd_minima: 2 },
        { tipo: 'Peça', nome: 'Bateria iPhone 12', categoria_id: cats[4].id, custo: 70, preco: 0, quantidade: 4, qtd_minima: 2 }
      ];
      prods.forEach(p => {
        const q = p.quantidade; p.quantidade = 0; p.disponibilidade_id = 1; p.fornecedor_id = 3; p.data_entrada = UI.today();
        const rec = DB.insert('produtos', p, { silent: true });
        NEG.movEstoque(rec.id, q, 'Entrada', 'Cadastro inicial', rec.id, 'Estoque inicial');
      });

      /* upgrade: relações (desconto por defeito + mín/máx de compra) */
      ins('upgrade_relacoes', [
        { modelo_id: mods[0].id, gb_id: 2, minimo: 900, maximo: 1300, d_auricular: 60, d_tampa: 150, d_altofalante: 60, d_vibracal: 40, d_camtras: 200, d_camfront: 120, d_faceid: 300, d_bateria: 150, d_tela: 350, d_marcas: 100 },
        { modelo_id: mods[1].id, gb_id: 2, minimo: 1200, maximo: 1700, d_auricular: 60, d_tampa: 180, d_altofalante: 60, d_vibracal: 40, d_camtras: 250, d_camfront: 150, d_faceid: 350, d_bateria: 180, d_tela: 450, d_marcas: 120 },
        { modelo_id: mods[2].id, gb_id: 2, minimo: 1600, maximo: 2200, d_auricular: 80, d_tampa: 200, d_altofalante: 80, d_vibracal: 50, d_camtras: 300, d_camfront: 180, d_faceid: 400, d_bateria: 200, d_tela: 550, d_marcas: 150 },
        { modelo_id: mods[3].id, gb_id: 2, minimo: 2200, maximo: 2900, d_auricular: 80, d_tampa: 250, d_altofalante: 80, d_vibracal: 50, d_camtras: 350, d_camfront: 200, d_faceid: 450, d_bateria: 220, d_tela: 650, d_marcas: 180 }
      ]);

      ins('notificacoes', [
        { nome: 'Contas a pagar vencendo', ativo: true, dias: 2 }, { nome: 'Contas a receber vencidas', ativo: true, dias: 0 },
        { nome: 'Aniversariantes do dia', ativo: true, dias: 0 }, { nome: 'Estoque abaixo do mínimo', ativo: true, dias: 0 },
        { nome: 'OS com previsão vencida', ativo: true, dias: 0 }, { nome: 'Certificado digital vencendo', ativo: true, dias: 30 }
      ]);
      ins('apps', []);
      DB.setMeta({ alertas_cfg: { estoque_abaixo_media: true, custo_zero: true, venda_menor_custo: true, estoque_negativo: true, venda_prejuizo: true, recebido_menor: true, venda_cancelada: true, sem_termo: true, nf_rejeitada: true, estoque_minimo: true } });
    }
  };
})();
