// ====================================================================
// ACTUALIZADOR DEL CATÁLOGO DE BLIMBURN SEEDS
// ====================================================================
// Ejecuta este archivo (node update-catalog.js) una vez al mes 
// o cuando se añadan nuevas semillas al catálogo.
// Extrae los nombres de los sitemaps y crea un archivo 'catalog.json'
// local para ahorrar tokens y tiempo de carga en el optimizador.
// ====================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');

const SITEMAPS = [
    'https://blimburnseeds.com/product-sitemap.xml',
    'https://blimburnseeds.com/product-sitemap2.xml'
];

const OUTPUT_FILE = path.join(__dirname, 'catalog.json');

async function download(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'BlimburnSEO-Bot/1.0' } }, (res) => {
            let data = '';
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function updateCatalog() {
    console.log('🌱 Inicializando descarga del catálogo de Blimburn Seeds...');
    let catalogSlugs = new Set();

    for (const url of SITEMAPS) {
        console.log(`Descargando: ${url}`);
        try {
            const xmlData = await download(url);

            const regex = /<loc>https:\/\/blimburnseeds\.com\/([^\/]+)\/<\/loc>/g;
            let match;
            let count = 0;
            while ((match = regex.exec(xmlData)) !== null) {
                const slug = match[1];

                // Filtros de exclusión:
                // No categorías, no shop, no pre-rolls, no productos derivados de THCA puro (si se marca así en url)
                // no cepas que contengan HMC
                const isInvalid =
                    slug.includes('product-category') ||
                    slug.includes('shop') ||
                    slug.includes('pre-roll') ||
                    slug.includes('thca') ||
                    slug.includes('hmc') ||
                    slug.length <= 2;

                if (!isInvalid) {
                    // Normalizar: "gorilla-glue-auto" -> "Gorilla Glue Auto"
                    const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    catalogSlugs.add(name);
                    count++;
                }
            }
            console.log(`✓ Extraídas ${count} semillas de este sitemap.`);
        } catch (err) {
            console.error(`❌ Error al descargar ${url}:`, err.message);
        }
    }

    const finalArray = Array.from(catalogSlugs).sort();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalArray, null, 2), 'utf8');
    console.log('\n=================================================');
    console.log(`✅ ¡Catálogo actualizado con éxito!`);
    console.log(`📦 Variedades totales guardadas: ${finalArray.length}`);
    console.log(`📁 Archivo: catalog.json`);
    console.log('=================================================\n');
}

updateCatalog();
