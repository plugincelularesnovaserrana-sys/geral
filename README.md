# Plataforma Plugin Celulares

Uma plataforma só, juntando os 4 repositórios:

| Antes (repositório) | Agora (pasta) | Observação |
|---|---|---|
| PLUGIN-NS-BETA (central de ferramentas) | raiz (`tabelas-preco/`, `simulador-boletos/`, `gerador1/`…) | Caminhos **iguais aos de antes**, então links e o Atualizador de Tabelas continuam funcionando |
| system (Gestor Loja) | `gestao/` | Sem alteração no código |
| financeiro (Controle Financeiro) | `financeiro/` | Sem alteração no código (mesmo Firebase) |
| Vitrine | `vitrine/` | Sem alteração no código (lê o `produtos.json` do repositório Vitrine) |

O `index.html` da raiz é a plataforma nova: menu lateral com tudo, abas, busca e Início.
A central antiga continua disponível em `classico.html` (Administrativo → Menu clássico).

## O que a plataforma faz

- **Menu único** com a mesma organização da central (Módulo de Vendas / Módulo Financeiro, Contratos, Utilitários) + Sistemas, Vitrine e Administrativo.
- **Abas**: cada ferramenta aberta fica numa aba no topo. Trocar de aba não recarrega nem perde o que foi digitado (dá para deixar a Gestão e o Financeiro logados lado a lado).
- **Busca (Ctrl + K)**: acha qualquer ferramenta e também as **telas internas** da Gestão (≈160) e do Financeiro (14). Ex.: “inadimplência” abre o Financeiro já na tela de inadimplência; “nova venda” abre o PDV da Gestão.
- **Início** com atalhos diretos, favoritos (estrela ☆ na barra da ferramenta), usadas recentemente e indicadores ao vivo: vendas de hoje/mês da Gestão, quantidade de aparelhos da Vitrine e data da última atualização das tabelas.
- Sites externos (Mercado Phone, Kommo, Clicksign, Consult Center, Web Factoring, Paymobi) abrem numa aba nova do navegador, porque não aceitam ficar dentro de outro site.
- Botões “Voltar ao painel” das ferramentas antigas fecham a aba e voltam ao Início.
- Funciona no celular (menu vira gaveta).

## Para incluir ou mudar uma ferramenta

Edite só `plataforma/registro.js` (lista de ferramentas, menu e atalhos).
Ao mudar arquivos da pasta `plataforma/`, troque o `?v=1` no `index.html` (v=2, v=3…) para os navegadores pegarem a versão nova.

## Publicar (GitHub Pages)

1. Envie o conteúdo desta pasta para o repositório da central (**PLUGIN-NS-BETA**) — ou para um repositório novo — mantendo as subpastas.
2. **Settings → Pages → Deploy from a branch → main / (root)**.
3. Se usar um repositório novo, no **Atualizador de Tabelas** informe o nome do repositório novo (o arquivo continua em `tabelas-preco/tabelas_atualizadas.json`).

### Pontos de atenção

- **Financeiro (Firebase):** o login funciona em qualquer repositório da conta `plugincelularesnovaserrana-sys`, porque o domínio autorizado é `plugincelularesnovaserrana-sys.github.io`. Se publicar em outra conta, adicione o domínio em Firebase → Authentication → Configurações → Domínios autorizados.
- **Backup diário do Financeiro:** continua rodando no repositório `financeiro` (GitHub Actions + segredo `FIREBASE_SA`). Deixe aquele repositório como está; a pasta `financeiro/scripts` aqui é só cópia. Não mova o backup para cá se este repositório for público (os backups têm nomes de clientes).
- **Gestão da Loja:** os dados ficam no navegador (localStorage) e valem para todo o endereço `plugincelularesnovaserrana-sys.github.io`, então quem já usava `/system/` continua vendo os mesmos dados em `/gestao/` do mesmo navegador. Mantenha o backup em Configurações → Backup e restauração.
- **Vitrine pública:** os anúncios apontam para `…github.io/Vitrine/boleto.html`. Mantenha o repositório **Vitrine** publicado: o Admin (daqui ou de lá) grava o `produtos.json` e as fotos nele, e as duas cópias das vitrines leem a mesma lista.
