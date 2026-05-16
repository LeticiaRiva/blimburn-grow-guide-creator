// ============================================================
// BLIMBURN GROW GUIDE CREATOR — Servidor Local
// Proxy para SerpAPI (sin dependencias externas, solo Node.js built-in)
// Puerto: 3015
// Arrancar: node server.js  (o doble clic en iniciar.bat)
// ============================================================

const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = 3015;
const PROJECT_DIR = __dirname;

// MIME types para servir archivos estáticos
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
};

// ----- CORS headers para todas las respuestas -----
function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ----- Llamada a SerpAPI -----
function callSerpAPI(params) {
    return new Promise((resolve, reject) => {
        const query = new URLSearchParams(params).toString();
        const options = {
            hostname: 'serpapi.com',
            path: `/search.json?${query}`,
            method: 'GET',
            headers: { 'User-Agent': 'BlimburnSEOOptimizer/1.0' },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('SerpAPI returned invalid JSON'));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('SerpAPI timeout')); });
        req.end();
    });
}

// ----- Servidor HTTP -----
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    // Normalizar el pathname: quitar barra final
    const pathname = parsedUrl.pathname.replace(/\/$/, '') || '/';

    console.log(`[Incoming] ${req.method} ${pathname}`);

    // Handle preflight
    if (req.method === 'OPTIONS') {
        setCORS(res);
        res.writeHead(204);
        res.end();
        return;
    }

    setCORS(res);

    // ── RUTA: /serp  → Proxy SerpAPI ──────────────────────────────
    if (pathname === '/serp') {
        const { api_key, engine, q, gl, hl, google_domain, num } = parsedUrl.query;

        if (!q || !api_key) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Parámetros requeridos: q, api_key' }));
            return;
        }

        try {
            console.log(`[SerpAPI] Buscando: "${q}" en ${google_domain || 'google.com'} (${gl}/${hl})`);
            const data = await callSerpAPI({ api_key, engine: engine || 'google', q, gl, hl, google_domain, num: num || 10 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            console.log(`[SerpAPI] OK — ${data.organic_results?.length || 0} resultados orgánicos`);
        } catch (err) {
            console.error(`[SerpAPI] Error: ${err.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ── RUTA: /audit → Proxy para LM Studio (Gemma) ────────────────
    if (pathname === '/audit' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 10 * 1024 * 1024) { // 10MB limit
                console.error('[Auditor Proxy] Petición demasiado grande!');
                res.writeHead(413);
                res.end('Payload too large');
                req.destroy();
            }
        });
        
        req.on('end', () => {
            console.log(`[Auditor Proxy] 📥 Recibida petición de auditoría (${(body.length/1024).toFixed(1)} KB)`);
            
            const options = {
                hostname: '127.0.0.1',
                port: 1234,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const proxyReq = http.request(options, (proxyRes) => {
                console.log(`[Auditor Proxy] 🤖 LM Studio respondió: ${proxyRes.statusCode}`);
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                console.error(`[Auditor Proxy] ❌ Error conectando a LM Studio: ${e.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: `No se pudo conectar con LM Studio: ${e.message}. Asegúrate de que el servidor local en puerto 1234 esté activo y con el modelo cargado.` 
                }));
            });

            proxyReq.write(body);
            proxyReq.end();
            console.log(`[Auditor Proxy] 📤 Petición reenviada a 127.0.0.1:1234`);
        });
        return;
    }

    // ── RUTA: /proxy → Proxy Genérico CORS (Sitemaps) ───────────────
    if (pathname === '/proxy') {
        const targetUrl = parsedUrl.query.url;
        if (!targetUrl) {
            res.writeHead(400);
            res.end('Missing url parameter');
            return;
        }
        console.log(`[Proxy] Descargando: ${targetUrl}`);
        https.get(targetUrl, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        }).on('error', (e) => {
            console.error(`[Proxy] Error: ${e.message}`);
            res.writeHead(500);
            res.end(e.message);
        });
        return;
    }

    // ── RUTA: Archivos estáticos (sirve index.html, CSS, JS, logo) ──
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(PROJECT_DIR, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   BLIMBURN GROW GUIDE CREATOR — Servidor OK    ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  Acceso LOCAL:   http://localhost:${PORT}        ║`);
    console.log(`║  Acceso RED:     http://[TU_IP_LOCAL]:${PORT}    ║`);
    console.log('║                                                ║');
    console.log('║  (Usa ipconfig en terminal para ver tu IP)     ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n⚠ Puerto ${PORT} en uso. Cierra la otra instancia y vuelve a intentarlo.\n`);
    } else {
        console.error('Error del servidor:', err.message);
    }
    process.exit(1);
});
