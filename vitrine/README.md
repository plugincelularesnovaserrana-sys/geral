# Vitrine · Plugin Celulares

Catálogo virtual publicado no GitHub Pages. Todas as páginas leem a mesma lista (`produtos.json`), que é atualizada pelo `admin.html`.

## Páginas

| Página | Link | O que mostra |
|---|---|---|
| `boleto.html` | `.../Vitrine/boleto.html` | Só **entrada mínima + parcelas** do boleto, com filtro "Parcela até R$ X". Use no anúncio do boleto. |
| `cartao.html` | `.../Vitrine/cartao.html` | **À vista com desconto** (PIX/dinheiro) + **cartão em até 18x**. |
| `index.html` | `.../Vitrine/` | Catálogo completo (à vista, cartão e boleto). |
| `admin.html` | `.../Vitrine/admin.html` | Cadastro dos aparelhos e envio da lista para o GitHub. |

No catálogo do boleto só aparecem aparelhos que têm boleto preenchido no admin.

## Arquivos

- `catalogo.js` – configuração (WhatsApp, selos, listaUrl), textos de cada vitrine e todo o funcionamento.
- `catalogo.css` – visual das três vitrines.
- `produtos.json` – lista de aparelhos (gerada pelo admin).
- `assets/` – fotos e logo.

## Preços no admin

- **À vista** – preço com desconto (PIX ou dinheiro).
- **Cartão** – não é preenchido por aparelho. No admin você coloca só o **% de acréscimo para 10x e para 18x** (vale para todos). O site soma o % ao preço à vista e divide pelas parcelas.
- **Boleto** – entrada mínima + parcelas + valor da parcela (padrão 15x para iPhone, 11x para Android).

Formato gravado no JSON:

```json
"cartao": {"taxa10": 8, "taxa18": 15},   // no topo do arquivo, vale para todos
"preco": 2700,
"boleto": {"entrada": 799.9, "parcelas": 15, "parcela": 299.9}
```

## Ao alterar catalogo.js ou catalogo.css

As páginas carregam `catalogo.js?v=6` e `catalogo.css?v=6`. Ao publicar mudanças nesses arquivos, troque o número (`v=7`, `v=8`...) nas três páginas HTML para os celulares dos clientes pegarem a versão nova.
