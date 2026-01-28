import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.FRONTEND_HOST ?? '0.0.0.0';
const PORT = Number(process.env.FRONTEND_PORT ?? '4173');
const ROOT = process.env.FRONTEND_DIST ?? path.resolve(__dirname, '../frontend-dist');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
]);

function isHtmlRequest(req) {
  const accept = req.headers.accept ?? '';
  return typeof accept === 'string' && accept.includes('text/html');
}

function safeJoin(root, urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const normalized = decoded.replaceAll('\\', '/');
  const cleaned = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const resolved = path.resolve(root, cleaned);
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

async function readFileIfExists(p) {
  try {
    const s = await stat(p);
    if (!s.isFile()) return null;
    return await readFile(p);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const u = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const pathname = u.pathname === '/' ? '/index.html' : u.pathname;

    const requestedPath = safeJoin(ROOT, pathname);
    if (!requestedPath) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    let servedPath = requestedPath;
    let body = await readFileIfExists(servedPath);
    let status = 200;

    // SPA fallback: if route not found and browser expects HTML, serve index.html
    if (!body && isHtmlRequest(req)) {
      const indexPath = path.resolve(ROOT, 'index.html');
      body = await readFileIfExists(indexPath);
      if (body) {
        servedPath = indexPath;
      }
      status = body ? 200 : 404;
    }

    if (!body) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(servedPath);
    const contentType = contentTypes.get(ext) ?? 'application/octet-stream';
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Frontend server listening on http://${HOST}:${PORT} (root: ${ROOT})`);
});

