// Test suite executável: roda contra http://localhost:3000
const BASE = "http://localhost:3000";

const VALIDOS = [
  "United States of America", "United Kingdom", "Germany", "France",
  "Japan", "China", "India", "Brazil", "Mexico"
];

const ESPERADO = {
  "United States of America": { iso: "US", iso3: "USA", ticker: "SPY",  bench: "S&P 500",     ptBr: "ESTADOS UNIDOS" },
  "United Kingdom":           { iso: "GB", iso3: "GBR", ticker: "EWU",  bench: "FTSE 100",    ptBr: "REINO UNIDO" },
  "Germany":                  { iso: "DE", iso3: "DEU", ticker: "EWG",  bench: "DAX 40",      ptBr: "ALEMANHA" },
  "France":                   { iso: "FR", iso3: "FRA", ticker: "EWQ",  bench: "CAC 40",      ptBr: "FRANÇA" },
  "Japan":                    { iso: "JP", iso3: "JPN", ticker: "EWJ",  bench: "NIKKEI 225",  ptBr: "JAPÃO" },
  "China":                    { iso: "CN", iso3: "CHN", ticker: "FXI",  bench: "HSCEI",       ptBr: "CHINA" },
  "India":                    { iso: "IN", iso3: "IND", ticker: "INDA", bench: "NIFTY 50",    ptBr: "ÍNDIA" },
  "Brazil":                   { iso: "BR", iso3: "BRA", ticker: "EWZ",  bench: "IBOVESPA",    ptBr: "BRASIL" },
  "Mexico":                   { iso: "MX", iso3: "MEX", ticker: "EWW",  bench: "IPC MÉXICO",  ptBr: "MÉXICO" }
};

const PORTFOLIO_CATS = ["AÇÕES","DERIVATIVO","FUTURO","CÂMBIO","AÇÕES","RENDA FIXA","RENDA FIXA","ESG","ESG","ESG"];

let pass = 0, fail = 0;
const ok = (cond, msg) => { (cond ? pass++ : (fail++, console.log("  ✗", msg))); };

console.log("\n[1] 9 países válidos — schema, status, valores");
for (const c of VALIDOS) {
  const url = `${BASE}/api/terminal-data?country=${encodeURIComponent(c)}`;
  const r = await fetch(url);
  const d = await r.json();
  const exp = ESPERADO[c];
  const errors = [];

  if (r.status !== 200) errors.push(`HTTP ${r.status}`);
  if (d.iso !== exp.iso) errors.push(`iso ${d.iso}≠${exp.iso}`);
  if (d.iso3 !== exp.iso3) errors.push(`iso3 ${d.iso3}≠${exp.iso3}`);
  if (d.ticker !== exp.ticker) errors.push(`ticker ${d.ticker}≠${exp.ticker}`);
  if (d.bench !== exp.bench) errors.push(`bench ${d.bench}≠${exp.bench}`);
  if (d.countryDisplay !== exp.ptBr) errors.push(`ptBr ${d.countryDisplay}≠${exp.ptBr}`);
  if (typeof d.price !== "number" || d.price <= 0) errors.push(`price inválido: ${d.price}`);
  if (typeof d.change !== "number") errors.push(`change inválido: ${d.change}`);
  if (!d.flag || !d.flag.includes(exp.iso)) errors.push(`flag URL: ${d.flag}`);
  if (!Array.isArray(d.news) || d.news.length === 0) errors.push(`news vazio`);
  if (d.news.length > 5) errors.push(`news > 5: ${d.news.length}`);
  if (!Array.isArray(d.portfolio) || d.portfolio.length !== 10) errors.push(`portfolio ≠ 10`);
  if (d.portfolio.map(p => p.cat).join(",") !== PORTFOLIO_CATS.join(",")) errors.push(`portfolio cats wrong`);
  if (d.portfolio[5].asset !== `${exp.iso3} 10Y`) errors.push(`bond 10Y: ${d.portfolio[5].asset}`);
  if (d.portfolio[6].asset !== `${exp.iso3} 2Y`) errors.push(`bond 2Y: ${d.portfolio[6].asset}`);

  if (errors.length === 0) {
    console.log(`  ✓ ${c.padEnd(26)} | ${exp.iso3} | ${d.ticker} $${d.price.toFixed(2)} ${d.change >= 0 ? '+' : ''}${d.change.toFixed(2)}% | ${d.news.length} news`);
    pass++;
  } else {
    fail++;
    console.log(`  ✗ ${c}: ${errors.join(", ")}`);
  }
}

console.log("\n[2] País sem registro — espera 404");
{
  const r = await fetch(`${BASE}/api/terminal-data?country=Russia`);
  const d = await r.json();
  ok(r.status === 404, `HTTP ${r.status} ≠ 404`);
  ok(d.error === true, `error flag`);
  ok(typeof d.message === "string" && d.message.includes("Russia"), `mensagem do erro`);
  console.log(`  ✓ HTTP ${r.status} | "${d.message}"`);
}

console.log("\n[3] Parâmetro vazio — espera 404");
{
  const r = await fetch(`${BASE}/api/terminal-data`);
  const d = await r.json();
  ok(r.status === 404, `HTTP ${r.status} ≠ 404`);
  console.log(`  ✓ HTTP ${r.status} | "${d.message}"`);
}

console.log("\n[4] Caracteres especiais no parâmetro");
{
  const r = await fetch(`${BASE}/api/terminal-data?country=${encodeURIComponent("'; DROP TABLE--")}`);
  const d = await r.json();
  ok(r.status === 404, `HTTP ${r.status} (injection rejeitada)`);
  console.log(`  ✓ injection rejeitada com HTTP ${r.status}`);
}

console.log("\n[5] index.html serve com headers corretos");
{
  const r = await fetch(BASE);
  const ct = r.headers.get("content-type") || "";
  const body = await r.text();
  ok(r.status === 200, `HTTP ${r.status}`);
  ok(ct.includes("text/html"), `Content-Type: ${ct}`);
  ok(body.includes('lang="pt-BR"'), `lang pt-BR`);
  ok(body.includes("TERMINAL MACRO-NODE"), `título`);
  ok(body.includes("JetBrains+Mono"), `font carregada`);
  console.log(`  ✓ index.html servido (${body.length} bytes, ${ct})`);
}

console.log("\n[6] Latência (3 calls sequenciais)");
{
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    await fetch(`${BASE}/api/terminal-data?country=Brazil`);
    samples.push(Date.now() - t);
  }
  const avg = samples.reduce((a,b) => a+b, 0) / samples.length;
  ok(avg < 2000, `latência média ${avg}ms < 2000ms`);
  console.log(`  ✓ latência média ${avg.toFixed(0)}ms (${samples.join("ms, ")}ms)`);
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Total: ${pass} passou, ${fail} falhou`);
process.exit(fail > 0 ? 1 : 0);
