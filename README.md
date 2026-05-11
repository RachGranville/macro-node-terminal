# 🌍 TERMINAL MACRO-NODE

🔴 **Status:** aguardando deploy

## Visão Geral
O **Terminal Macro-Node** é um painel de inteligência geoespacial em tempo real, projetado para agregar dados macroeconômicos fragmentados em uma única UI de alta densidade. Construído para análise quantitativa e acompanhamento de mercados globais, ele visualiza a interseção entre geopolítica, dívida soberana e desempenho de múltiplas classes de ativos diretamente sobre um globo 3D interativo.

Ferramentas financeiras tradicionais costumam esconder dados regionais atrás de navegações complexas. Este sistema contorna o problema com uma arquitetura de mapeamento dinâmico: clique em qualquer país do globo e o terminal sintetiza instantaneamente toda a sua telemetria financeira principal, em moeda local.

## ⚙️ Arquitetura e Funcionalidades

* **Globo 3D interativo:** WebGL via `Three.js` e `Globe.gl` a 60 fps, com rotação automática, atmosfera âmbar e heatmap dos países cobertos.
* **9 países cobertos com blue chips locais:** cada país aponta para uma ação representativa, cotada em sua bolsa nacional (Vale na B3, SAP na XETRA, Toyota no TSE, etc.). Preço, variação e nome da empresa são entregues em moeda local (BRL, EUR, JPY, INR, GBP, USD, EGP).
* **Modo parcial dinâmico:** ao clicar em qualquer outro país do globo (~170 a mais), o terminal monta um perfil macro a partir do GeoJSON do natural-earth (população, PIB estimado, faixa de renda, sub-região) e busca manchetes específicas do país. Sem dados fake nem fallback genérico.
* **Engine de Portfólio Estratégico de 10 Pontos:** modelo de alocação que combina renda variável (ação local, opção, futuro), câmbio, renda fixa soberana (10Y/2Y) e ESG (solar, eólica, títulos verdes).
* **Feed de Inteligência Algorítmica:** filtro multi-camada sobre a NewsAPI: o país precisa estar no título, a manchete precisa conter termo econômico, fontes irrelevantes (flight deals, esporte, entretenimento) são bloqueadas por *blocklist*, fontes financeiras tier-1 (Reuters, Bloomberg, FT, WSJ, etc.) recebem boost no ranking, e manchetes sobre o mesmo tópico são deduplicadas via *stemming* de prefixo.
* **Cache server-side de 60s:** reduz consumo da NewsAPI free (100 req/dia) e acelera cliques repetidos (HIT em ~3 ms).
* **UX/UI "Aero-Glass":** painel semitransparente (`backdrop-filter`) que desliza enquanto o globo se desloca lateralmente, mantendo a visualização 3D sempre visível.
* **Backend Serverless:** implantado na Vercel com `Promise.all` para chamadas paralelas das APIs externas, garantindo latência ultrabaixa.

## 🛠️ Stack Tecnológica
* **Frontend:** JavaScript Vanilla (ES6+), HTML5, CSS3 (Glassmorphism, JetBrains Mono)
* **Visualização 3D:** Three.js, Globe.gl
* **Backend:** Node.js (Vercel Serverless Functions)
* **Pipelines de Dados:** Yahoo Finance v8 (cotações globais), NewsAPI (manchetes), FlagsAPI (bandeiras), GeoJSON natural-earth (perfil macro)

## 🚀 Desenvolvimento Local e Deploy

### Pré-requisitos
* Obtenha uma chave gratuita em [NewsAPI.org](https://newsapi.org/register) (a Yahoo Finance não exige chave).

### Configuração Local

1. Clone o repositório:
   ```bash
   git clone https://github.com/RachGranville/macro-node-terminal.git
   cd macro-node-terminal
   ```

2. Copie o arquivo de exemplo e preencha sua chave:
   ```bash
   cp .env.local.example .env.local
   ```
   Edite `.env.local`:
   ```
   NEWS_API_KEY=sua_chave_newsapi
   ```

3. Inicie o servidor de desenvolvimento. Há duas opções:

   **Opção A — `vercel dev` (oficial):**
   ```bash
   npx vercel@latest dev
   ```

   **Opção B — `dev-server.js` (Node puro, sem login na Vercel):**
   ```bash
   node dev-server.js
   ```

4. Abra `http://localhost:3000` no navegador e clique em qualquer país do globo.

### Testes

Suite de validação executável (espera o servidor rodando em `localhost:3000`):
```bash
node test-suite.mjs
```
Cobre: schema da API para os 9 países do registry, caminho parcial para países sem registry, tratamento de erros, cache server-side e latência.

### Limitações conhecidas

* **NewsAPI free só funciona em `localhost`.** Em deploy público, o endpoint retorna HTTP 426. Alternativas para produção: GNews, MediaStack, TheNewsAPI (tier gratuito que libera produção) ou plano pago.
* **Yahoo Finance v8 é endpoint não-oficial.** Estável o suficiente para uso pessoal mas pode mudar sem aviso. Sem chave, sem rate limit declarado.

### Países do registry

Cada país aponta para uma blue chip representativa na bolsa nacional:

| País | Bandeira | Ticker | Empresa | Bolsa | Moeda |
|---|---|---|---|---|---|
| Estados Unidos | US | NVDA | NVIDIA Corp. | NASDAQ | USD |
| Reino Unido | GB | BP.L | BP plc | LSE | GBP |
| Alemanha | DE | SAP.DE | SAP SE | XETRA | EUR |
| França | FR | MC.PA | LVMH | Paris | EUR |
| Japão | JP | 7203.T | Toyota Motor Corp. | Tokyo | JPY |
| China | CN | BABA | Alibaba Group | NYSE | USD |
| Índia | IN | RELIANCE.NS | Reliance Industries | NSE | INR |
| Brasil | BR | VALE3.SA | Vale S.A. | São Paulo | BRL |
| Egito | EG | HRHO.CA | EFG Hermes Holding | EGX | EGP |

Para os demais ~170 países do globo, o modo parcial usa dados macro do natural-earth + manchetes da NewsAPI.

### Estrutura do projeto

```
macro-node-terminal/
├── api/
│   └── terminal-data.js   # função serverless: agrega Yahoo Finance + NewsAPI + FlagsAPI + GeoJSON
├── index.html             # UI completa (globo + painel + modo parcial)
├── dev-server.js          # servidor de desenvolvimento Node puro
├── test-suite.mjs         # suite de testes da API
├── .env.local             # chaves (não commitado)
├── .env.local.example     # template de chaves
└── .gitignore
```
