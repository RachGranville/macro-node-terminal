// Cache in-memory por país (TTL 60s) para reduzir consumo da NewsAPI free (100 req/dia).
// Armazenado em globalThis para sobreviver ao cache-busting do dev-server.
const cache = globalThis.__terminalCache || (globalThis.__terminalCache = new Map());
const TTL_MS = 60_000;

// Registro de ativos por país.
// NOTA: as chaves precisam permanecer em inglês porque vêm do GeoJSON externo (campo ADMIN).
// Tickers são ETFs MSCI US-listed por país (única opção compatível com o plano free da Finnhub).
const REGISTRY = {
  "United States of America": { iso: "US", iso3: "USA", ticker: "SPY",  bench: "S&P 500",    ptBr: "ESTADOS UNIDOS", searchTerms: ['"United States"', '"U.S."', '"USA"'] },
  "United Kingdom":           { iso: "GB", iso3: "GBR", ticker: "EWU",  bench: "FTSE 100",   ptBr: "REINO UNIDO",    searchTerms: ['"United Kingdom"', '"U.K."', '"Britain"'] },
  "Germany":                  { iso: "DE", iso3: "DEU", ticker: "EWG",  bench: "DAX 40",     ptBr: "ALEMANHA",       searchTerms: ['"Germany"', '"German"'] },
  "France":                   { iso: "FR", iso3: "FRA", ticker: "EWQ",  bench: "CAC 40",     ptBr: "FRANÇA",         searchTerms: ['"France"'] },
  "Japan":                    { iso: "JP", iso3: "JPN", ticker: "EWJ",  bench: "NIKKEI 225", ptBr: "JAPÃO",          searchTerms: ['"Japan"', '"Japanese"'] },
  "China":                    { iso: "CN", iso3: "CHN", ticker: "FXI",  bench: "HSCEI",      ptBr: "CHINA",          searchTerms: ['"China"', '"Beijing"'] },
  "India":                    { iso: "IN", iso3: "IND", ticker: "INDA", bench: "NIFTY 50",   ptBr: "ÍNDIA",          searchTerms: ['"India"', '"Indian"'] },
  "Brazil":                   { iso: "BR", iso3: "BRA", ticker: "EWZ",  bench: "IBOVESPA",   ptBr: "BRASIL",         searchTerms: ['"Brazil"', '"Brasília"'] },
  "Mexico":                   { iso: "MX", iso3: "MEX", ticker: "EWW",  bench: "IPC MÉXICO", ptBr: "MÉXICO",         searchTerms: ['"Mexico"', '"Mexican"'] }
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

async function montaRespostaCompleta(config, country, NEWS_KEY, FINNHUB_KEY) {
  const countryOr = config.searchTerms.join(" OR ");
  const econOr = '(economy OR market OR stocks OR inflation OR rates OR GDP OR monetary OR fiscal OR trade OR exports OR tariff OR "central bank" OR equities OR bonds OR yield OR debt OR recession OR growth)';
  const q = encodeURIComponent(`(${countryOr}) AND ${econOr}`);

  const [newsRes, stockRes] = await Promise.all([
    fetch(`https://newsapi.org/v2/everything?q=${q}&searchIn=title&sortBy=publishedAt&pageSize=60&language=en&apiKey=${NEWS_KEY}`),
    fetch(`https://finnhub.io/api/v1/quote?symbol=${config.ticker}&token=${FINNHUB_KEY}`)
  ]);

  const newsData = await newsRes.json();
  const stock = await stockRes.json();

  if (stock.error || !stock.c || stock.c === 0) {
    return { __error502: `Finnhub não retornou cotação para ${config.ticker}: ${stock.error || "preço zero"}` };
  }

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
    price: stock.c,
    change: stock.dp,
    bench: config.bench,
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
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

  if (!NEWS_KEY || !FINNHUB_KEY) {
    return res.status(500).json({
      error: true,
      message: "Chaves de API ausentes. Configure NEWS_API_KEY e FINNHUB_API_KEY."
    });
  }

  if (!country) {
    return res.status(400).json({ error: true, message: "Parâmetro 'country' ausente." });
  }

  const config = REGISTRY[country];
  const cacheKey = config ? country : `parcial:${country}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached.data);
  }

  try {
    let data;
    if (config) {
      data = await montaRespostaCompleta(config, country, NEWS_KEY, FINNHUB_KEY);
      if (data.__error502) {
        return res.status(502).json({ error: true, message: data.__error502 });
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

    cache.set(cacheKey, { data, expiresAt: Date.now() + TTL_MS });
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
}
