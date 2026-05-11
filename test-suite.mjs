// Test suite executável: roda contra http://localhost:3000
const BASE = "http://localhost:3000";

const VALIDOS = [
  "United States of America", "United Kingdom", "Germany", "France",
  "Japan", "China", "India", "Brazil", "Egypt"
];

const ESPERADO = {
  "United States of America": { iso: "US", iso3: "USA", ticker: "NVDA",        bench: "S&P 500",    ptBr: "ESTADOS UNIDOS", currency: "USD" },
  "United Kingdom":           { iso: "GB", iso3: "GBR", ticker: "BP.L",        bench: "FTSE 100",   ptBr: "REINO UNIDO",    currency: "GBP" },
  "Germany":                  { iso: "DE", iso3: "DEU", ticker: "SAP.DE",      bench: "DAX 40",     ptBr: "ALEMANHA",       currency: "EUR" },
  "France":                   { iso: "FR", iso3: "FRA", ticker: "MC.PA",       bench: "CAC 40",     ptBr: "FRANÇA",         currency: "EUR" },
  "Japan":                    { iso: "JP", iso3: "JPN", ticker: "7203.T",      bench: "NIKKEI 225", ptBr: "JAPÃO",          currency: "JPY" },
  "China":                    { iso: "CN", iso3: "CHN", ticker: "BABA",        bench: "HSCEI",      ptBr: "CHINA",          currency: "USD" },
  "India":                    { iso: "IN", iso3: "IND", ticker: "RELIANCE.NS", bench: "NIFTY 50",   ptBr: "ÍNDIA",          currency: "INR" },
  "Brazil":                   { iso: "BR", iso3: "BRA", ticker: "VALE3.SA",    bench: "IBOVESPA",   ptBr: "BRASIL",         currency: "BRL" },
  "Egypt":                    { iso: "EG", iso3: "EGY", ticker: "HRHO.CA",     bench: "EGX 30",     ptBr: "EGITO",          currency: "EGP" }
};

const PORTFOLIO_CATS = ["AÇÕES","DERIVATIVO","FUTURO","CÂMBIO","AÇÕES","RENDA FIXA","RENDA FIXA","ESG","ESG","ESG"];
const PORTFOLIO_PARCIAL_CATS = ["RENDA FIXA","RENDA FIXA","ESG","ESG","ESG"];

let pass = 0, fail = 0;
const ok = (cond, msg) => { (cond ? pass++ : (fail++, console.log("  ✗", msg))); };

console.log("\n[1] 9 países do registry — schema completo");
for (const c of VALIDOS) {
  const url = `${BASE}/api/terminal-data?country=${encodeURIComponent(c)}`;
  const r = await fetch(url);
  const d = await r.json();
  const exp = ESPERADO[c];
  const errors = [];

  if (r.status !== 200) errors.push(`HTTP ${r.status}`);
  if (d.parcial !== false) errors.push(`parcial flag deveria ser false: ${d.parcial}`);
  if (d.iso !== exp.iso) errors.push(`iso ${d.iso}≠${exp.iso}`);
  if (d.iso3 !== exp.iso3) errors.push(`iso3 ${d.iso3}≠${exp.iso3}`);
  if (d.ticker !== exp.ticker) errors.push(`ticker ${d.ticker}≠${exp.ticker}`);
  if (d.bench !== exp.bench) errors.push(`bench ${d.bench}≠${exp.bench}`);
  if (d.countryDisplay !== exp.ptBr) errors.push(`ptBr ${d.countryDisplay}≠${exp.ptBr}`);
  if (d.currency !== exp.currency) errors.push(`currency ${d.currency}≠${exp.currency}`);
  if (typeof d.price !== "number" || d.price <= 0) errors.push(`price inválido: ${d.price}`);
  if (typeof d.change !== "number") errors.push(`change inválido: ${d.change}`);
  if (!d.companyName) errors.push(`companyName ausente`);
  if (!d.exchange) errors.push(`exchange ausente`);
  if (typeof d.benchPrice !== "number" || d.benchPrice <= 0) errors.push(`benchPrice inválido: ${d.benchPrice}`);
  if (typeof d.benchChange !== "number") errors.push(`benchChange inválido: ${d.benchChange}`);
  if (!d.benchTicker) errors.push(`benchTicker ausente`);
  if (!d.flag || !d.flag.includes(exp.iso)) errors.push(`flag URL: ${d.flag}`);
  if (!Array.isArray(d.news)) errors.push(`news não é array`);
  if (d.news.length > 5) errors.push(`news > 5: ${d.news.length}`);
  // Nota: news pode vir vazio se a NewsAPI free atingiu o rate limit diário (100 req/24h).
  if (!Array.isArray(d.portfolio) || d.portfolio.length !== 10) errors.push(`portfolio ≠ 10`);
  if (d.portfolio.map(p => p.cat).join(",") !== PORTFOLIO_CATS.join(",")) errors.push(`portfolio cats wrong`);
  if (d.portfolio[5].asset !== `${exp.iso3} 10Y`) errors.push(`bond 10Y: ${d.portfolio[5].asset}`);

  if (errors.length === 0) {
    const benchVal = d.benchPrice.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    console.log(`  ✓ ${c.padEnd(26)} | ${d.ticker.padEnd(13)} ${d.currency} ${d.price.toFixed(2).padStart(9)} ${d.change >= 0 ? '+' : ''}${d.change.toFixed(2)}% | ${d.bench.padEnd(11)} ${benchVal.padStart(8)} pts ${d.benchChange >= 0 ? '+' : ''}${d.benchChange.toFixed(2)}%`);
    pass++;
  } else {
    fail++;
    console.log(`  ✗ ${c}: ${errors.join(", ")}`);
  }
}

console.log("\n[2] Caminho parcial — países sem ETF mas com ISO válido");
const PARCIAIS = [
  { country: "Mali",      iso: "ML", iso3: "MLI", pop: 17885245, gdp: 38090,  incomeGrp: "5. Low income",        region: "Western Africa" },
  { country: "Argentina", iso: "AR", iso3: "ARG", pop: 44293293, gdp: 879400, incomeGrp: "3. Upper middle income", region: "South America" },
  { country: "Norway",    iso: "NO", iso3: "NOR", pop: 5320045,  gdp: 364700, incomeGrp: "1. High income: OECD", region: "Northern Europe" },
  { country: "Kosovo",    iso: "XK", iso3: "XKX", pop: 1907592,  gdp: 18490,  incomeGrp: "3. Upper middle income", region: "Southern Europe" }
];

for (const t of PARCIAIS) {
  const qs = new URLSearchParams(t);
  const r = await fetch(`${BASE}/api/terminal-data?${qs}`);
  const d = await r.json();
  const errors = [];

  if (r.status !== 200) errors.push(`HTTP ${r.status}`);
  if (d.parcial !== true) errors.push(`parcial flag deveria ser true: ${d.parcial}`);
  if (d.iso !== t.iso) errors.push(`iso ${d.iso}≠${t.iso}`);
  if (d.iso3 !== t.iso3) errors.push(`iso3 ${d.iso3}≠${t.iso3}`);
  if (d.price !== null) errors.push(`price deveria ser null: ${d.price}`);
  if (d.change !== null) errors.push(`change deveria ser null: ${d.change}`);
  if (d.ticker !== null) errors.push(`ticker deveria ser null: ${d.ticker}`);
  if (d.bench !== null) errors.push(`bench deveria ser null: ${d.bench}`);
  if (!d.flag || !d.flag.includes(t.iso)) errors.push(`flag URL: ${d.flag}`);
  if (!d.macro) errors.push(`macro ausente`);
  if (d.macro?.pop !== t.pop) errors.push(`macro.pop ${d.macro?.pop}≠${t.pop}`);
  if (d.macro?.gdp !== t.gdp) errors.push(`macro.gdp ${d.macro?.gdp}≠${t.gdp}`);
  if (d.macro?.region !== t.region) errors.push(`macro.region`);
  if (!Array.isArray(d.portfolio) || d.portfolio.length !== 5) errors.push(`portfolio ≠ 5`);
  if (d.portfolio?.map(p => p.cat).join(",") !== PORTFOLIO_PARCIAL_CATS.join(",")) errors.push(`portfolio parcial cats wrong`);
  if (d.portfolio?.[0].asset !== `${t.iso3} 10Y`) errors.push(`bond parcial 10Y: ${d.portfolio?.[0].asset}`);

  if (errors.length === 0) {
    console.log(`  ✓ ${t.country.padEnd(20)} | ${t.iso3} | pop ${(t.pop/1e6).toFixed(1)}mi · gdp $${(t.gdp/1e3).toFixed(1)}bi | ${d.news.length} news`);
    pass++;
  } else {
    fail++;
    console.log(`  ✗ ${t.country}: ${errors.join(", ")}`);
  }
}

console.log("\n[3] Erros esperados");
{
  // 3a) País fora do registry sem ISO → 404
  const r = await fetch(`${BASE}/api/terminal-data?country=Atlantis`);
  const d = await r.json();
  ok(r.status === 404, `Atlantis sem ISO HTTP ${r.status} ≠ 404`);
  ok(d.error === true, `Atlantis error flag`);
  console.log(`  ✓ Atlantis sem ISO → HTTP ${r.status} ("${d.message}")`);
}
{
  // 3b) ISO -99 → 404
  const r = await fetch(`${BASE}/api/terminal-data?country=Outroland&iso=-99&iso3=-99`);
  ok(r.status === 404, `ISO -99 HTTP ${r.status} ≠ 404`);
  console.log(`  ✓ ISO -99 → HTTP ${r.status}`);
}
{
  // 3c) Parâmetro country vazio
  const r = await fetch(`${BASE}/api/terminal-data`);
  ok(r.status === 400, `country vazio HTTP ${r.status} ≠ 400`);
  console.log(`  ✓ country vazio → HTTP ${r.status}`);
}
{
  // 3d) Injection
  const r = await fetch(`${BASE}/api/terminal-data?country=${encodeURIComponent("'; DROP TABLE--")}`);
  ok(r.status === 404, `injection HTTP ${r.status}`);
  console.log(`  ✓ injection → HTTP ${r.status}`);
}

console.log("\n[4] Cache server-side (X-Cache header)");
{
  // País + ISO únicos por execução pra garantir MISS na 1ª call
  const country = `TestNation${Date.now()}`;
  const params = `country=${encodeURIComponent(country)}&iso=ZZ&iso3=ZZZ&pop=1000000&gdp=10000&incomeGrp=Test&region=Test`;

  const r1 = await fetch(`${BASE}/api/terminal-data?${params}`);
  const cache1 = r1.headers.get("X-Cache");
  const r2 = await fetch(`${BASE}/api/terminal-data?${params}`);
  const cache2 = r2.headers.get("X-Cache");

  // Vietnam não está no registry, então é parcial. Primeira call MISS, segunda HIT
  ok(cache1 === "MISS", `1ª call ${country}: ${cache1} ≠ MISS`);
  ok(cache2 === "HIT", `2ª call ${country}: ${cache2} ≠ HIT`);
  console.log(`  ✓ Cache parcial Vietnam: ${cache1} → ${cache2}`);
}
{
  // País do registry: cache key sem prefixo "parcial:"
  await fetch(`${BASE}/api/terminal-data?country=Brazil`); // garante populado
  const r = await fetch(`${BASE}/api/terminal-data?country=Brazil`);
  ok(r.headers.get("X-Cache") === "HIT", `Brazil completo deve estar em HIT`);
  console.log(`  ✓ Cache completo Brazil: HIT`);
}

console.log("\n[5] index.html");
{
  const r = await fetch(BASE);
  const body = await r.text();
  ok(r.status === 200, `HTTP ${r.status}`);
  ok(body.includes('lang="pt-BR"'), `lang pt-BR`);
  ok(body.includes("TERMINAL MACRO-NODE"), `título`);
  ok(body.includes("isoOverrides"), `isoOverrides presente`);
  ok(body.includes("macro-block"), `bloco macro presente`);
  ok(body.includes('aria-live="polite"'), `aria-live presente`);
  ok(body.includes('autoRotate'), `autorotate configurado`);
  console.log(`  ✓ index.html: ${body.length} bytes, todos os marcadores presentes`);
}

console.log("\n[6] Latência");
{
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    await fetch(`${BASE}/api/terminal-data?country=Brazil`);
    samples.push(Date.now() - t);
  }
  const avg = samples.reduce((a,b) => a+b, 0) / samples.length;
  ok(avg < 50, `cache HIT médio ${avg}ms < 50ms`);
  console.log(`  ✓ latência ${samples.join("ms, ")}ms (avg ${avg.toFixed(0)}ms)`);
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Total: ${pass} passou, ${fail} falhou`);
process.exit(fail > 0 ? 1 : 0);
