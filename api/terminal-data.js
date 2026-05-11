// Cache in-memory por país. Cada entrada expira na próxima virada das 12:00 BRT.
// Em prática: cada país consome 1 par de chamadas (Yahoo + NewsAPI) por dia.
// Armazenado em globalThis para sobreviver ao cache-busting do dev-server.
const cache = globalThis.__terminalCache || (globalThis.__terminalCache = new Map());

// Retorna o timestamp UTC da próxima 12:00 BRT (UTC-3).
// 12:00 BRT == 15:00 UTC.
function proximaAtualizacao12hBRT() {
  const HORA_BRT = 12;
  const OFFSET_BRT = -3 * 60 * 60 * 1000;
  const agora = Date.now();
  const agoraEmBRT = new Date(agora + OFFSET_BRT);
  let proximoUTC = Date.UTC(
    agoraEmBRT.getUTCFullYear(),
    agoraEmBRT.getUTCMonth(),
    agoraEmBRT.getUTCDate(),
    HORA_BRT - (OFFSET_BRT / 3600000), // 12 - (-3) = 15 UTC
    0, 0, 0
  );
  if (agora >= proximoUTC) {
    proximoUTC += 24 * 60 * 60 * 1000;
  }
  return proximoUTC;
}

// Registro de ativos por país.
// NOTA: as chaves precisam permanecer em inglês porque vêm do GeoJSON externo (campo ADMIN).
// Cada país aponta para uma "blue chip" representativa + o índice principal local (via Yahoo Finance).
const REGISTRY = {
  "United States of America": { iso: "US", iso3: "USA", ticker: "NVDA",        bench: "S&P 500",    benchTicker: "^GSPC",   ptBr: "ESTADOS UNIDOS", searchTerms: ['"United States"', '"U.S."', '"USA"'] },
  "United Kingdom":           { iso: "GB", iso3: "GBR", ticker: "BP.L",        bench: "FTSE 100",   benchTicker: "^FTSE",   ptBr: "REINO UNIDO",    searchTerms: ['"United Kingdom"', '"U.K."', '"Britain"'] },
  "Germany":                  { iso: "DE", iso3: "DEU", ticker: "SAP.DE",      bench: "DAX 40",     benchTicker: "^GDAXI",  ptBr: "ALEMANHA",       searchTerms: ['"Germany"', '"German"'] },
  "France":                   { iso: "FR", iso3: "FRA", ticker: "MC.PA",       bench: "CAC 40",     benchTicker: "^FCHI",   ptBr: "FRANÇA",         searchTerms: ['"France"'] },
  "Japan":                    { iso: "JP", iso3: "JPN", ticker: "7203.T",      bench: "NIKKEI 225", benchTicker: "^N225",   ptBr: "JAPÃO",          searchTerms: ['"Japan"', '"Japanese"'] },
  "China":                    { iso: "CN", iso3: "CHN", ticker: "BABA",        bench: "HSCEI",      benchTicker: "^HSCE",   ptBr: "CHINA",          searchTerms: ['"China"', '"Beijing"'] },
  "India":                    { iso: "IN", iso3: "IND", ticker: "RELIANCE.NS", bench: "NIFTY 50",   benchTicker: "^NSEI",   ptBr: "ÍNDIA",          searchTerms: ['"India"', '"Indian"'] },
  "Brazil":                   { iso: "BR", iso3: "BRA", ticker: "VALE3.SA",    bench: "IBOVESPA",   benchTicker: "^BVSP",   ptBr: "BRASIL",         searchTerms: ['"Brazil"', '"Brasília"'] },
  "Egypt":                    { iso: "EG", iso3: "EGY", ticker: "HRHO.CA",     bench: "EGX 30",     benchTicker: "^CASE30", ptBr: "EGITO",          searchTerms: ['"Egypt"', '"Egyptian"', '"Cairo"'] }
};

const TIER_1 = new Set([
  "reuters", "bloomberg", "financial times", "the wall street journal",
  "wsj.com", "nikkei.com", "cnbc", "ap news", "associated press",
  "bbc news", "al jazeera english", "the economist", "marketwatch",
  "yahoo finance", "business insider", "forbes", "fortune", "barron's",
  "cnbc.com", "ft.com"
]);
const TIER_2 = new Set([
  "the guardian", "the new york times", "nytimes.com", "washington post",
  "cnn", "time", "sky news", "euronews", "euronews.com",
  "dw (english)", "deutsche welle", "france 24", "the times of india",
  "yahoo entertainment"
]);
const SOURCE_BLOCKLIST = new Set([
  "theflightdeal.com", "slickdeals.net", "couponraja.in",
  "onefootball.com", "worldsoccertalk.com", "sporting news", "sportingnews.com",
  "espn.com", "soccerway.com", "goal.com",
  "deadline.com", "variety.com", "soranews24.com", "whatjapanthinks.com",
  "sundaicity.com", "prnewswire", "globenewswire", "pr newswire",
  "wwd", "the hollywood reporter"
]);
const SPAM_PATTERNS = [
  "basic economy", "regular economy", "premium economy",
  "roundtrip", "round trip", "airfare", "airfares",
  "flight deal", "cheap flight",
  "world cup", "fifa", "u-17", "u17", "asian cup", "olympic",
  "champions", "neymar", "messi", "soccer", "football",
  "tennis", "basketball", "f1 ", "formula 1",
  "box office", "premiere", "tv series", "movie",
  "robber", "robbery", "hostage", "kidnap", "shooting",
  "murder", "stabbing", "assault", "stolen dollars",
  "hotter than", "warmest day", "coldest", "27c", "hawaii",
  "market size to reach", "cagr", "forecast period",
  "buy now", "shop now", "coupon", "% off", "promo code",
  "discount code", "limited time"
];
const STOP = new Set([
  "about", "after", "again", "ahead", "amid", "and", "are", "before",
  "but", "could", "during", "from", "has", "have", "his", "how", "into",
  "just", "more", "much", "new", "not", "now", "one", "only", "other",
  "over", "said", "says", "she", "should", "still", "than", "that", "the",
  "their", "them", "they", "this", "those", "two", "was", "were", "what",
  "when", "where", "which", "who", "why", "will", "with", "year", "you",
  "your", "would", "many", "such", "may"
]);

const scoreSource = (name) => {
  const n = (name || "").toLowerCase();
  if (TIER_1.has(n)) return 20;
  if (TIER_2.has(n)) return 10;
  return 0;
};

const significantStems = (title, noiseTerms) => {
  let cleaned = title.toLowerCase();
  for (const c of noiseTerms) cleaned = cleaned.replace(new RegExp(c, "gi"), " ");
  return new Set(
    cleaned
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 4 && !STOP.has(w))
      .map(w => w.substring(0, 5))
  );
};

const filtraEManchetes = (articles, noiseTerms) => {
  const candidates = (Array.isArray(articles) ? articles : [])
    .filter(a => {
      if (!a.title) return false;
      if (SOURCE_BLOCKLIST.has((a.source?.name || "").toLowerCase())) return false;
      const lower = a.title.toLowerCase();
      return !SPAM_PATTERNS.some(p => lower.includes(p));
    })
    .map(a => ({ title: a.title, publishedAt: a.publishedAt, score: scoreSource(a.source?.name) }))
    .sort((a, b) => b.score !== a.score ? b.score - a.score : new Date(b.publishedAt) - new Date(a.publishedAt));

  const headlines = [];
  const seen = [];
  for (const c of candidates) {
    const stems = significantStems(c.title, noiseTerms);
    const dup = seen.some(prev => {
      let overlap = 0;
      for (const w of stems) if (prev.has(w)) overlap++;
      return overlap >= 2;
    });
    if (dup) continue;
    seen.push(stems);
    headlines.push(c.title);
    if (headlines.length >= 5) break;
  }
  return headlines;
};

// Nomes amigáveis quando o Yahoo devolve identificadores técnicos.
const COMPANY_OVERRIDES = {
  "VALE3.SA":    "Vale S.A.",
  "SAP.DE":      "SAP SE",
  "BP.L":        "BP plc",
  "HRHO.CA":     "EFG Hermes Holding",
  "7203.T":      "Toyota Motor Corp.",
  "MC.PA":       "LVMH",
  "RELIANCE.NS": "Reliance Industries",
  "NVDA":        "NVIDIA Corp.",
  "BABA":        "Alibaba Group"
};

// Yahoo Finance v8 chart endpoint — não exige chave, cobre todas as bolsas globais.
async function buscaCotacaoYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status} para ${ticker}`);
  const j = await r.json();
  const meta = j.chart?.result?.[0]?.meta;
  if (!meta || !meta.regularMarketPrice) {
    throw new Error(`Yahoo sem cotação para ${ticker}: ${j.chart?.error?.description || "meta vazia"}`);
  }

  let price = meta.regularMarketPrice;
  let prevClose = meta.chartPreviousClose || meta.previousClose;
  let currency = meta.currency;

  // GBp (pence) → GBP (libras): Yahoo cota LSE em pence; normalizamos para libras.
  if (currency === "GBp") {
    price = price / 100;
    if (prevClose) prevClose = prevClose / 100;
    currency = "GBP";
  }

  const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

  const rawName = (meta.shortName || meta.longName || ticker).replace(/\s+/g, " ").trim();
  const companyName = COMPANY_OVERRIDES[ticker] || rawName;

  return {
    price,
    change,
    currency,
    companyName,
    exchange: meta.fullExchangeName || meta.exchangeName
  };
}

async function montaRespostaCompleta(config, country, NEWS_KEY) {
  const countryOr = config.searchTerms.join(" OR ");
  const econOr = '(economy OR market OR stocks OR inflation OR rates OR GDP OR monetary OR fiscal OR trade OR exports OR tariff OR "central bank" OR equities OR bonds OR yield OR debt OR recession OR growth)';
  const q = encodeURIComponent(`(${countryOr}) AND ${econOr}`);

  const [newsRes, stock, index] = await Promise.all([
    fetch(`https://newsapi.org/v2/everything?q=${q}&searchIn=title&sortBy=publishedAt&pageSize=60&language=en&apiKey=${NEWS_KEY}`),
    buscaCotacaoYahoo(config.ticker),
    config.benchTicker
      ? buscaCotacaoYahoo(config.benchTicker).catch(() => null)
      : Promise.resolve(null)
  ]);

  const newsData = await newsRes.json();
  const noise = config.searchTerms.map(t => t.replace(/"/g, "").toLowerCase());
  const news = filtraEManchetes(newsData.articles, noise);

  const portfolio = [
    { cat: "AÇÕES",      asset: config.ticker,            inst: "À Vista",   risk: "MOD" },
    { cat: "DERIVATIVO", asset: `${config.ticker} CALL`,  inst: "Opção",     risk: "ALTO" },
    { cat: "FUTURO",     asset: `${config.bench} FUT`,    inst: "Hedge",     risk: "ALTO" },
    { cat: "CÂMBIO",     asset: `USD / Moeda Local`,      inst: "Moeda",     risk: "ALTO" },
    { cat: "AÇÕES",      asset: "MAIORES DIVIDENDOS",     inst: "Renda",     risk: "BAIXO" },
    { cat: "RENDA FIXA", asset: `${config.iso3} 10Y`,     inst: "Tít. Sob.", risk: "BAIXO" },
    { cat: "RENDA FIXA", asset: `${config.iso3} 2Y`,      inst: "Tít. Sob.", risk: "BAIXO" },
    { cat: "ESG",        asset: "INFRA SOLAR",            inst: "Renov.",    risk: "MED" },
    { cat: "ESG",        asset: "PROJETO EÓLICO",         inst: "Transição", risk: "MED" },
    { cat: "ESG",        asset: "TÍTULO VERDE",           inst: "Sustent.",  risk: "BAIXO" }
  ];

  return {
    parcial: false,
    flag: `https://flagsapi.com/${config.iso}/flat/64.png`,
    iso: config.iso,
    iso3: config.iso3,
    countryDisplay: config.ptBr,
    news,
    price: stock.price,
    change: stock.change,
    currency: stock.currency,
    companyName: stock.companyName,
    exchange: stock.exchange,
    bench: config.bench,
    benchTicker: config.benchTicker,
    benchPrice: index?.price ?? null,
    benchChange: index?.change ?? null,
    benchCurrency: index?.currency ?? null,
    ticker: config.ticker,
    portfolio
  };
}

async function montaRespostaParcial({ country, iso, iso3, pop, gdp, incomeGrp, region, NEWS_KEY }) {
  // Sem ETF mapeado — busca só notícias usando o nome do país como query
  const q = encodeURIComponent(`"${country}"`);
  const newsRes = await fetch(`https://newsapi.org/v2/everything?q=${q}&searchIn=title&sortBy=publishedAt&pageSize=60&language=en&apiKey=${NEWS_KEY}`);
  const newsData = await newsRes.json();
  const news = filtraEManchetes(newsData.articles, [country.toLowerCase()]);

  // Portfólio reduzido: sem ticker/futuro/câmbio (que dependem de ETF mapeado)
  const portfolio = [
    { cat: "RENDA FIXA", asset: `${iso3} 10Y`,     inst: "Tít. Sob.", risk: "MOD" },
    { cat: "RENDA FIXA", asset: `${iso3} 2Y`,      inst: "Tít. Sob.", risk: "MOD" },
    { cat: "ESG",        asset: "INFRA SOLAR",    inst: "Renov.",    risk: "MED" },
    { cat: "ESG",        asset: "PROJETO EÓLICO", inst: "Transição", risk: "MED" },
    { cat: "ESG",        asset: "TÍTULO VERDE",   inst: "Sustent.",  risk: "BAIXO" }
  ];

  // Perfil macro a partir dos campos do GeoJSON
  const macro = {
    pop: pop && pop !== "-99" ? Number(pop) : null,
    gdp: gdp && gdp !== "-99" ? Number(gdp) : null, // em US$ milhões
    incomeGrp: incomeGrp || null,
    region: region || null
  };

  return {
    parcial: true,
    flag: `https://flagsapi.com/${iso}/flat/64.png`,
    iso,
    iso3,
    countryDisplay: country.toUpperCase(),
    news,
    price: null,
    change: null,
    bench: null,
    ticker: null,
    portfolio,
    macro
  };
}

export default async function handler(req, res) {
  const { country, iso, iso3, pop, gdp, incomeGrp, region } = req.query;
  const NEWS_KEY = process.env.NEWS_API_KEY;

  if (!NEWS_KEY) {
    return res.status(500).json({
      error: true,
      message: "Chave NEWS_API_KEY ausente."
    });
  }

  if (!country) {
    return res.status(400).json({ error: true, message: "Parâmetro 'country' ausente." });
  }

  const config = REGISTRY[country];
  const cacheKey = config ? country : `parcial:${country}`;
  const cached = cache.get(cacheKey);
  // Entries antigas sem cachedAt são consideradas inválidas (formato pré-feature).
  const cacheValido = cached && typeof cached.cachedAt === "number" && typeof cached.expiresAt === "number" && cached.expiresAt > Date.now();
  if (cacheValido) {
    res.setHeader("X-Cache", "HIT");
    res.setHeader("X-Cached-At", new Date(cached.cachedAt).toISOString());
    res.setHeader("X-Next-Refresh", new Date(cached.expiresAt).toISOString());
    return res.status(200).json({ ...cached.data, cachedAt: cached.cachedAt, nextRefresh: cached.expiresAt });
  }

  try {
    let data;
    if (config) {
      try {
        data = await montaRespostaCompleta(config, country, NEWS_KEY);
      } catch (e) {
        return res.status(502).json({ error: true, message: e.message });
      }
    } else {
      if (!iso || !iso3 || iso === "-99" || iso3 === "-99") {
        return res.status(404).json({
          error: true,
          message: `País sem dados disponíveis: ${country}`
        });
      }
      data = await montaRespostaParcial({ country, iso, iso3, pop, gdp, incomeGrp, region, NEWS_KEY });
    }

    const cachedAt = Date.now();
    const expiresAt = proximaAtualizacao12hBRT();
    cache.set(cacheKey, { data, cachedAt, expiresAt });
    res.setHeader("X-Cache", "MISS");
    res.setHeader("X-Cached-At", new Date(cachedAt).toISOString());
    res.setHeader("X-Next-Refresh", new Date(expiresAt).toISOString());
    res.status(200).json({ ...data, cachedAt, nextRefresh: expiresAt });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
}
