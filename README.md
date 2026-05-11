# 🌍 TERMINAL MACRO-NODE

🔴 **Status:** aguardando deploy

## Visão Geral
O **Terminal Macro-Node** é um painel de inteligência geoespacial em tempo real, projetado para agregar dados macroeconômicos fragmentados em uma única UI de alta densidade. Construído para análise quantitativa e acompanhamento de mercados globais, ele visualiza a interseção entre geopolítica, dívida soberana e desempenho de múltiplas classes de ativos diretamente sobre um globo 3D interativo.

Ferramentas financeiras tradicionais costumam esconder dados regionais atrás de navegações complexas. Este sistema contorna o problema com uma arquitetura de mapeamento dinâmico: clique em qualquer dos 9 países cobertos e o terminal sintetiza instantaneamente toda a sua telemetria financeira principal.

## ⚙️ Arquitetura e Funcionalidades

* **Globo 3D interativo:** WebGL via `Three.js` e `Globe.gl` a 60 fps, com rotação automática, atmosfera âmbar e heatmap dos países cobertos.
* **Mapeamento de Ativos por País:** 9 países cobertos (EUA, Reino Unido, Alemanha, França, Japão, China, Índia, Brasil, México). Cada um vinculado a um ETF MSCI US-listed para cotação em tempo real e um índice de benchmark local.
* **Engine de Portfólio Estratégico de 10 Pontos:** Modelo de alocação que combina renda variável (ETF, opção, futuro), câmbio, renda fixa soberana (10Y/2Y) e ESG (solar, eólica, títulos verdes).
* **Feed de Inteligência Algorítmica:** filtro multi-camada sobre a NewsAPI: o país precisa estar no título, a manchete precisa conter termo econômico, fontes irrelevantes (flight deals, esporte, entretenimento) são bloqueadas por *blocklist*, e manchetes sobre o mesmo tópico são deduplicadas via *stemming* de prefixo.
* **UX/UI "Aero-Glass":** Painel semitransparente (`backdrop-filter`) que desliza enquanto o globo se desloca lateralmente, mantendo a visualização 3D sempre visível.
* **Backend Serverless:** Implantado na Vercel com `Promise.all` para chamadas paralelas das APIs externas, garantindo latência ultrabaixa (~160 ms medidos localmente).

## 🛠️ Stack Tecnológica
* **Frontend:** JavaScript Vanilla (ES6+), HTML5, CSS3 (Glassmorphism, JetBrains Mono)
* **Visualização 3D:** Three.js, Globe.gl
* **Backend:** Node.js (Vercel Serverless Functions)
* **Pipelines de Dados:** Finnhub API (cotações de ETFs), NewsAPI (manchetes), FlagsAPI (bandeiras)

## 🚀 Desenvolvimento Local e Deploy

Para rodar este projeto localmente ou implantá-lo no seu próprio ambiente Vercel, você precisará de chaves de API ativas.

### Pré-requisitos
1. Obtenha uma chave gratuita em [Finnhub.io](https://finnhub.io/register)
2. Obtenha uma chave gratuita em [NewsAPI.org](https://newsapi.org/register)

### Configuração Local

1. Clone o repositório:
   ```bash
   git clone https://github.com/sanjeevjha21/greenyield-terminal.git
   cd greenyield-terminal
   ```

2. Copie o arquivo de exemplo de variáveis de ambiente e preencha com suas chaves:
   ```bash
   cp .env.local.example .env.local
   ```
   Edite `.env.local`:
   ```
   FINNHUB_API_KEY=sua_chave_finnhub
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
   Esta opção sobe um servidor HTTP simples que serve o `index.html` e roteia `/api/terminal-data` para a função serverless. Não exige conta Vercel.

4. Abra `http://localhost:3000` no navegador e clique em qualquer país do registry.

### Testes

Suite de validação executável (espera o servidor rodando em `localhost:3000`):
```bash
node test-suite.mjs
```
Cobre: schema da API para os 9 países, tratamento de erros (país inválido, parâmetro vazio, injection), headers do `index.html` e latência.

### Limitações conhecidas

* **NewsAPI free só funciona em `localhost`.** Em deploy público, o endpoint retorna HTTP 426. Alternativas para produção: GNews, MediaStack, TheNewsAPI (com tier gratuito que libera produção), ou plano pago.
* **Finnhub free cobre apenas tickers US-listed.** Por isso o registry usa ETFs MSCI (EWZ, EWG, INDA, etc.) em vez de ações locais.
* **Rate limits:** NewsAPI free = 100 req/dia, Finnhub free = 60 req/min.

### Países cobertos

| País | Bandeira | ETF | Benchmark | ISO-3 |
|---|---|---|---|---|
| Estados Unidos | US | SPY | S&P 500 | USA |
| Reino Unido | GB | EWU | FTSE 100 | GBR |
| Alemanha | DE | EWG | DAX 40 | DEU |
| França | FR | EWQ | CAC 40 | FRA |
| Japão | JP | EWJ | NIKKEI 225 | JPN |
| China | CN | FXI | HSCEI | CHN |
| Índia | IN | INDA | NIFTY 50 | IND |
| Brasil | BR | EWZ | IBOVESPA | BRA |
| México | MX | EWW | IPC MÉXICO | MEX |

### Estrutura do projeto

```
greenyield-terminal/
├── api/
│   └── terminal-data.js   # função serverless: agrega Finnhub + NewsAPI + FlagsAPI
├── index.html             # UI completa (globo + painel)
├── dev-server.js          # servidor de desenvolvimento Node puro
├── test-suite.mjs         # suite de testes da API
├── .env.local             # chaves (não commitado)
├── .env.local.example     # template de chaves
└── .gitignore
```
