const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
    // Manejar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const { api_key, q, gl, hl, google_domain, num } = req.query;

    if (!q || !api_key) {
        return res.status(400).json({ error: 'Parámetros requeridos: q, api_key' });
    }

    const params = {
        api_key,
        engine: 'google',
        q,
        gl: gl || 'us',
        hl: hl || 'en',
        google_domain: google_domain || 'google.com',
        num: num || 10
    };

    const query = new URLSearchParams(params).toString();
    const serpUrl = `https://serpapi.com/search.json?${query}`;

    https.get(serpUrl, (serpRes) => {
        let data = '';
        serpRes.on('data', chunk => data += chunk);
        serpRes.on('end', () => {
            try {
                res.status(200).json(JSON.parse(data));
            } catch (e) {
                res.status(500).json({ error: 'Error parsing SerpAPI response' });
            }
        });
    }).on('error', (err) => {
        res.status(500).json({ error: err.message });
    });
};
