import http from 'http';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

try {
  const env = fs.readFileSync('.env.local', 'utf8');
  env.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq > 0) {
      process.env[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
    }
  });
  console.log('[env] .env.local carregado');
} catch {
  console.warn('[env] .env.local nao encontrado');
}

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`${new Date().toISOString()} ${req.method} ${url.pathname}${url.search}`);

  if (url.pathname.startsWith('/api/terminal-data')) {
    const fakeReq = { query: Object.fromEntries(url.searchParams) };
    const headers = {};
    const fakeRes = {
      setHeader: (k, v) => { headers[k] = v; },
      status: (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
          res.end(JSON.stringify(data));
        }
      })
    };
    try {
      const moduleUrl = pathToFileURL(path.resolve('./api/terminal-data.js')).href + `?v=${Date.now()}`;
      const { default: handler } = await import(moduleUrl);
      await handler(fakeReq, fakeRes);
    } catch (err) {
      console.error('[api] erro:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const html = fs.readFileSync('./index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500);
      res.end('Erro lendo index.html');
    }
    return;
  }

  res.writeHead(404);
  res.end('Nao encontrado');
});

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
});
