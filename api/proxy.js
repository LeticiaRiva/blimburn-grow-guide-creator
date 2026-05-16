const https = require('https');

module.exports = async (req, res) => {
    // Manejar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const { url } = req.query;
    if (!url) {
        return res.status(400).send('Missing url parameter');
    }

    https.get(url, (proxyRes) => {
        res.status(proxyRes.statusCode);
        // Forward relevant headers
        if (proxyRes.headers['content-type']) {
            res.setHeader('Content-Type', proxyRes.headers['content-type']);
        }
        proxyRes.pipe(res);
    }).on('error', (err) => {
        res.status(500).send(err.message);
    });
};
