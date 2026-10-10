/**
 * ManiPay — website server (Railway, or any Node 18+ host; also used for local testing)
 *   npm start            → http://localhost:3000
 *
 * - Serves the website files, with clean URLs (/about → about.html) and the custom 404 page.
 * - Runs api/*.js:  /api/reviews (live Google reviews), /api/enquiries (contact form → WhatsApp).
 * - Adds the security headers, redirects and caching that vercel.json / .htaccess used to do.
 * - Keys come from Railway → your service → Variables (locally: the .env file). Never put them in the HTML/JS.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const CANONICAL_HOST = (process.env.CANONICAL_HOST || '').toLowerCase(); // e.g. manipay.in (optional)

// --- load .env (local only; on Railway set Variables instead) ---
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(function (line) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) return;
    const val = m[2].replace(/^['"]|['"]$/g, '');
    if (val && !process.env[m[1]]) process.env[m[1]] = val;
  });
} catch (e) { /* no .env — fine */ }

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.pdf': 'application/pdf'
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

// Old addresses → current pages (same as vercel.json)
const REDIRECTS = {
  '/faqs.html': '/FAQ.html',
  '/faqs': '/FAQ.html',
  '/service-details.html': '/services.html#credit-card-swipe',
  '/projects.html': '/services.html'
};
// Files that must never be served even though they sit in the folder
const PRIVATE = new Set(['server.js', 'dev-server.js', 'package.json', 'package-lock.json', 'vercel.json', 'railway.json']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000'
};

function apiShim(res) {
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (obj) {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
  };
  return res;
}

function send(req, res, status, type, body, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  if (cache) res.setHeader('Cache-Control', cache);
  const gzip = COMPRESSIBLE.test(type) && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gzip) { body = zlib.gzipSync(body); res.setHeader('Content-Encoding', 'gzip'); }
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('Content-Length', body.length);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function notFound(req, res) {
  fs.readFile(path.join(ROOT, '404.html'), function (e, page) {
    send(req, res, 404, 'text/html; charset=utf-8', e ? Buffer.from('Not found') : page, 'no-cache');
  });
}

function serverError(req, res) {
  fs.readFile(path.join(ROOT, '500.html'), function (e, page) {
    send(req, res, 500, 'text/html; charset=utf-8', e ? Buffer.from('Server error') : page, 'no-store');
  });
}

const server = http.createServer(async function (req, res) {
  Object.keys(SECURITY_HEADERS).forEach(function (k) { res.setHeader(k, SECURITY_HEADERS[k]); });

  const host = String(req.headers.host || '').toLowerCase();
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (e) { return notFound(req, res); }

  // www.manipay.in → manipay.in (only when CANONICAL_HOST is set)
  if (CANONICAL_HOST && host === 'www.' + CANONICAL_HOST) {
    res.writeHead(301, { Location: 'https://' + CANONICAL_HOST + req.url });
    return res.end();
  }

  // Redirects
  if (REDIRECTS[pathname]) {
    res.writeHead(301, { Location: REDIRECTS[pathname] });
    return res.end();
  }

  // API routes: /api/reviews → api/reviews.js
  if (pathname.startsWith('/api/')) {
    const name = path.basename(pathname.replace(/\/+$/, '')).replace(/\.js$/, '');
    const file = path.join(ROOT, 'api', name + '.js');
    if (!/^[a-z0-9-]+$/i.test(name) || !fs.existsSync(file)) {
      res.statusCode = 404; res.setHeader('Content-Type', 'application/json');
      return res.end('{"error":"No such API route"}');
    }
    try {
      await require(file)(req, apiShim(res));
    } catch (err) {
      console.error('API error in ' + name + ':', err);
      if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end('{"error":"Server error"}'); }
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  // Static files
  if (pathname.endsWith('/')) pathname += 'index.html';
  let filePath = path.normalize(path.join(ROOT, pathname));
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel) ||
      rel.split(path.sep).some(function (part) { return part.startsWith('.'); }) ||
      PRIVATE.has(rel) || rel.split(path.sep)[0] === 'api' || rel.split(path.sep)[0] === 'node_modules') {
    return notFound(req, res);
  }
  // Clean URLs: /about → about.html
  if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) filePath += '.html';

  fs.readFile(filePath, function (err, data) {
    if (err) return err.code === 'ENOENT' || err.code === 'EISDIR' || err.code === 'ENOTDIR' ? notFound(req, res) : serverError(req, res);
    const ext = path.extname(filePath).toLowerCase();
    const cache = rel.startsWith('assets' + path.sep) ? 'public, max-age=2592000' // 30 days
      : ext === '.html' ? 'no-cache' : 'public, max-age=3600';
    send(req, res, 200, TYPES[ext] || 'application/octet-stream', data, cache);
  });
});

server.listen(PORT, '0.0.0.0', function () {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const wa = process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY;
  console.log('\n  ManiPay running on port ' + PORT + '  →  http://localhost:' + PORT);
  console.log('  Live Google reviews: ' + (key ? 'ON' : 'OFF — set GOOGLE_PLACES_API_KEY (built-in reviews are shown)'));
  console.log('  WhatsApp enquiries:  ' + (wa ? 'ON' : 'OFF — set CALLMEBOT_PHONE and CALLMEBOT_APIKEY') + '\n');
});

// Railway stops the old version with SIGTERM on each deploy — close cleanly
process.on('SIGTERM', function () { server.close(function () { process.exit(0); }); });
