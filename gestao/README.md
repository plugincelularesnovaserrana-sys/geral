# Gestor Loja — sistema de gestão para loja de celulares

Sistema web (ERP) com a mesma estrutura de menus e funções de um sistema de gestão para lojas de celular:
vendas/PDV, estoque com IMEI, ordem de serviço, financeiro, fiscal, relatórios, ferramentas e configurações.
Nomes e dados são genéricos: troque em **Configurações → Parâmetros gerais** e **Empresas / lojas**.

## Como usar

- **No computador, sem instalar nada:** abra o arquivo `index.html` no Chrome ou Edge.
- **Primeiro acesso:** usuário **Gerente**, senha **1234**. Também existem **Vendedor 1** (1111) e **Vendedor 2** (2222).
  Troque as senhas em Configurações → Gestão de acesso.

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `gestor-loja`) e envie todos os arquivos desta pasta, mantendo as subpastas.
2. No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
3. Em 1 ou 2 minutos o sistema fica em `https://SEU-USUARIO.github.io/gestor-loja/`.

## Visual e atalhos

- **Ctrl + K** (ou o campo "Buscar em tudo" no topo) abre a busca rápida: telas, clientes, produtos, IMEI, vendas e OS.
- O botão de lua/sol no topo alterna entre **tema claro e escuro**.
- O ícone ao lado do nome do sistema **recolhe o menu lateral** para ganhar espaço.
- Ícones (Lucide, licença ISC) e fontes (Figtree e Sora, licença OFL) ficam dentro da pasta `assets`, então o sistema funciona mesmo sem internet.

## Recibos e locação

- Recibos **A4** e **bobina 80mm** no padrão de loja de celular: canhoto de recebimento, cabeçalho com logotipo, destinatário, produtos, pagamento, parcelas e termos.
- **Logotipo e dados da empresa**: Configurações → Empresas / lojas. **Prefixo do número do recibo**: Configurações → Modelos de documentos.
- **Locação**: no PDV escolha o tipo de venda **Locação**. O pedido é o mesmo da venda (estoque e financeiro iguais), mas o recibo sai como **Pedido de locação**, com o **prazo da locação** (da data da locação até o vencimento da última parcela), o quadro de parcelas, o **contrato de locação** e as assinaturas (locadora, locatário e duas testemunhas).
- O texto do contrato fica em Vendas → Configurações → **Termos** (tipo "Termo de locação") e aceita variáveis como {cliente}, {imei}, {inicio}, {fim}, {prazo}, {parcelas}, {valor_parcela} e {recibo}. Revise o texto com seu advogado antes de usar.
- Qualquer tipo de venda pode virar locação marcando "É locação?" em Vendas → Configurações → Tipos de venda.

## Onde ficam os dados (importante)

Nesta versão **os dados ficam guardados no navegador de cada aparelho** (localStorage).
Isso significa que:

- outro computador ou celular **não vê** os mesmos dados;
- limpar os dados do navegador **apaga tudo**;
- o espaço é de cerca de 5 MB (fotos anexadas ocupam bastante).

Por isso existe **Configurações → Backup e restauração**: baixe o backup todo dia. Para levar os dados
para outro aparelho, restaure o arquivo lá.

## Preparado para servidor

Toda leitura e escrita passa por `js/core/db.js`. Para ligar num servidor no futuro, basta criar outro
"adapter" com as mesmas funções (`loadAll`, `save`, `saveMeta`, `clear`) que converse com uma API, e chamar
`DB.setAdapter(...)` antes de `App.start()`. As telas e regras de negócio não mudam.

O que depende de servidor e ficou como registro manual por enquanto:
emissão de NF-e/NFC-e na SEFAZ, consulta de score/CPF automática, API pública, envio automático de WhatsApp,
contagem de acessos do catálogo e sincronização entre aparelhos.

## Estrutura

```
index.html              página única
assets/app.css          visual
js/core/db.js           camada de dados (trocar aqui para usar servidor)
js/core/ui.js           formatação, modais, impressão, exportação
js/core/crud.js         motor de listagens e formulários
js/core/app.js          menu, rotas, login, permissões
js/core/negocio.js      regras: estoque, financeiro, caixa, crédito, taxas, venda, OS
js/data/schemas.js      definição dos cadastros
js/data/seed.js         dados iniciais genéricos
js/mod/*.js             módulos: início, vendas, upgrade, estoque, os, financeiro, fiscal,
                        relatórios, ferramentas, configurações
```

## Módulos

| Menu | Principais funções |
| --- | --- |
| Tela inicial | Faturamento, lucro, ticket, projeção do mês, entradas e saídas, últimas vendas |
| Vendas | Clientes, PDV com pagamentos múltiplos (dinheiro, PIX, cartão com taxa por parcela, crediário em parcelas, crédito do cliente, aparelho na troca), pré-venda, orçamentos, histórico, trocas e devoluções, crédito, garantias, delivery, seguros, metas, simulador de taxa e de upgrade |
| Compras / Estoque | Produtos por IMEI ou quantidade, consulta, ordens de compra (com XML), movimentações, inventário com leitor, histórico de IMEI, etiquetas com código de barras, transferência entre lojas, importação CSV |
| Ordem de serviço | OS com aparelhos, serviços, peças, checklist, pagamentos, anexos e assinatura; kanban; dashboard; impressão A4/80mm; WhatsApp por situação |
| Financeiro | Despesas e receitas com baixa, multa/juros, carnê, recibo, cobrança; fixos; caixas com sangria/suprimento e fechamento às cegas; bancos; conciliação OFX; calendário |
| Fiscal | Registro de NF-e/NFC-e, NF de entrada de upgrade, importação de XML de fornecedor para o estoque, cadastros fiscais |
| Relatórios | Mais de 60: **DRE regime de caixa** (pela data do pagamento/recebimento ou da compensação, com comparação, visão mês a mês, detalhamento e conferência automática), DRE gerencial por competência, financeiro mensal, formas de pagamento, produtos vendidos (agrupamento livre), estoque, vendedores e comissão, metas, OS, clientes, recap anual, legado |
| Ferramentas | Assinatura na tela, arquivos, consulta de score (registro), central de alertas, catálogo online com WhatsApp, preços de fornecedores, NPS |
| Marketplace | Loja de apps, webhooks, tokens de API, logs |
| Configurações | Parâmetros de cada módulo, empresas/lojas, usuários, perfis e permissões, senha mestre, auditoria, logs de acesso, backup, manual |
