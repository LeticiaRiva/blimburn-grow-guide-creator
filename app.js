// BLIMBURN CONTENT CREATOR — Application Logic
// Pipeline: SerpAPI → Gemini (análisis + brief) → OpenAI (redacción) → Score
// ============================================================

(() => {
  'use strict';

  // ============================================================
  // CONFIG
  // ============================================================
  const SERP_API_KEY_DEFAULT = '1f816fbbd5dd23efe4f2418595421d843da984661d34734b4cff54b41f0c5014';
  const SERP_API_KEYS_POOL = [
    '1f816fbbd5dd23efe4f2418595421d843da984661d34734b4cff54b41f0c5014',
    '517fca3f672cdd21e86aba38b50f5084caf49a9b77de3bb7ad8897512782899d',
    '9b3b32ab6639b30bd470584b57ef2796805c4d34335ae2e599d57edaf5b9d050',
    '55a6419adebc5e3a083797e8436a41c882a5085c1e0228c63185195b0db6f9f6',
    '7a0e8d678706174ba5396163b074c99e7b3647268f5583758c8a51cfb7b0fa79',
    '48d8bdd6f5ddf96a09ed1f140e6daa51b4ca76b650708ed6d4e8796cadeff2e3'
  ];
  const OPENAI_API_KEY_DEFAULT = ''; // Insert API key manually or via UI settings
  const GEMINI_API_KEY_DEFAULT = ''; // Insert API key manually or via UI settings
  const GEMINI_MODEL = 'gemini-2.0-flash';
  const OPENAI_MODEL = 'gpt-4o';
  const TIMEOUT_MS = 120000;

  // ============================================================
  // MARKET CONFIGURATIONS
  // Cada mercado determina: SERP config + idioma de todos los prompts
  // ============================================================
  const MARKETS = {
    com: {
      gl: 'us', hl: 'en', google_domain: 'google.com', blimburn_domain: 'blimburnseeds.com',
      lang: 'en', langLabel: 'English',
      langFull: 'English (native speaker, United States)',
      contentLang: 'English',
      serpLang: 'en',
      regionName: 'U.S.',
      forbiddenWords: ["Understanding", "Introduction", "Conclusion", "In summary", "The role", "Comprehensive", "Unveiling", "Discover", "Explore", "Ultimate Guide", "In addition", "A Comprehensive Guide", "Study", "Research", "Recent studies", "Scientific evidence"],
    },
    es: {
      gl: 'es', hl: 'es', google_domain: 'google.es', blimburn_domain: 'blimburnseeds.es',
      lang: 'es', langLabel: 'Español',
      langFull: 'Spanish (native speaker, Spain)',
      contentLang: 'Spanish',
      serpLang: 'es',
      regionName: 'Spain and Latin American',
      forbiddenWords: ["Comprender", "Introducción", "Conclusión", "En resumen", "El papel", "Exhaustivo", "Revelando", "Descubre", "Explora", "Guía Definitiva", "Además", "Guía Completa", "Estudio", "Investigación", "Estudios recientes", "Evidencia científica"],
    },
    de: {
      gl: 'de', hl: 'de', google_domain: 'google.de', blimburn_domain: 'blimburnseeds.de',
      lang: 'de', langLabel: 'Deutsch',
      langFull: 'German (native speaker, Germany)',
      contentLang: 'German',
      serpLang: 'de',
      regionName: 'German',
      forbiddenWords: ["Verstehen", "Einleitung", "Schlussfolgerung", "Zusammenfassend", "Die Rolle", "Umfassend", "Enthüllung", "Entdecken", "Erforschen", "Ultimativer Leitfaden", "Zusätzlich", "Vollständiger Leitfaden", "Studie", "Forschung", "Neuere Studien", "Wissenschaftliche Belege"],
    },
    fr: {
      gl: 'fr', hl: 'fr', google_domain: 'google.fr', blimburn_domain: 'blimburnseeds.fr',
      lang: 'fr', langLabel: 'Français',
      langFull: 'French (native speaker, France)',
      contentLang: 'French',
      serpLang: 'fr',
      regionName: 'French',
      forbiddenWords: ["Comprendre", "Introduction", "Conclusion", "En résumé", "Le rôle", "Exhaustif", "Dévoiler", "Découvrir", "Explorer", "Guide Ultime", "En outre", "Guide Complet", "Étude", "Recherche", "Études récentes", "Preuve scientifique"],
    },
    cz: {
      gl: 'cz', hl: 'cs', google_domain: 'google.cz', blimburn_domain: 'blimburnseeds.com',
      lang: 'cs', langLabel: 'Čeština',
      langFull: 'Czech (native speaker, Czech Republic)',
      contentLang: 'Czech',
      serpLang: 'cs',
      regionName: 'Czech',
      forbiddenWords: ["Úvod", "Závěr", "Shrnutí", "Objevte", "Prozkoumejte", "Výzkum", "Studie", "Komplexní", "Ultimátní průvodce", "Navíc", "Nedávné studie", "Vědecké důkazy"],
    },
  };

  const LANG_LABELS = { en: 'English (US)', es: 'Español (España)', de: 'Deutsch (Deutschland)', fr: 'Français (France)', cs: 'Čeština (Česko)' };

  // ============================================================
  // STATE
  // ============================================================
  let selectedMarket = MARKETS.es;
  let isProcessing = false;
  let blimburnCatalog = [];
  let lastHtmlOutput = '';
  let serpData = null;
  let seoScore = null;
  let apiKeys = { gemini: '', openai: '', serp: SERP_API_KEY_DEFAULT };

  // ============================================================
  // DOM ELEMENTS
  // ============================================================
  const $marketTabs = document.querySelectorAll('.market-tab');
  const $marketGoogleLabel = document.getElementById('market-google-label');
  const $marketLangLabel = document.getElementById('market-lang-label');
  const $btnSettings = document.getElementById('btn-settings');
  const $settingsModal = document.getElementById('settings-modal');
  const $btnCloseModal = document.getElementById('btn-close-modal');
  const $btnSaveKeys = document.getElementById('btn-save-keys');
  const $keyGemini = document.getElementById('key-gemini');
  const $keyOpenai = document.getElementById('key-openai');
  const $keySerp = document.getElementById('key-serp');
  const $inputKeyword = document.getElementById('input-keyword');
  const $inputSecondaryKws = document.getElementById('input-secondary-kws');
  const $inputExpert = document.getElementById('input-expert');
  const $inputCultivarProfile = document.getElementById('input-cultivar-profile');
  const $wordCount = document.getElementById('word-count');
  const $contentWarning = document.getElementById('content-warning');
  const $keywordError = document.getElementById('keyword-error');
  const $btnBrief = document.getElementById('btn-brief');
  const $btnReset = document.getElementById('btn-reset');
  const $btnCopyHtml = document.getElementById('btn-copy-html');
  const $btnCopyGutenberg = document.getElementById('btn-copy-gutenberg');
  const $btnCopyText = document.getElementById('btn-copy-text');
  const $apiError = document.getElementById('api-error');
  const $outputTabs = document.querySelectorAll('.output-tab');
  const $outputPanels = { brief: document.getElementById('tab-brief'), content: document.getElementById('tab-content'), score: document.getElementById('tab-score'), serp: document.getElementById('tab-serp'), checklist: document.getElementById('tab-checklist'), history: document.getElementById('tab-history') };
  const $outputContent = document.getElementById('output-content');
  const $outputScore = document.getElementById('output-score');
  const $outputSerp = document.getElementById('output-serp');
  const $outputBrief = document.getElementById('output-brief');
  const $outputChecklist = document.getElementById('output-checklist');
  const $outputHistory = document.getElementById('output-history');
  const $outputMarketBadge = document.getElementById('output-market-badge');
  const $pipelineSteps = document.querySelectorAll('.pipeline__step');
  const $pipelineConnectors = document.querySelectorAll('.pipeline__connector');
  const $statusBar = document.getElementById('status-bar');
  const $statusProgress = document.getElementById('status-progress');
  const $statusText = document.getElementById('status-text');

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    loadKeys();
    $marketTabs.forEach(tab => tab.addEventListener('click', () => selectMarket(tab)));
    $btnSettings.addEventListener('click', openModal);
    $btnCloseModal.addEventListener('click', closeModal);
    document.querySelector('.modal__backdrop').addEventListener('click', closeModal);
    $btnSaveKeys.addEventListener('click', saveKeys);
    $btnBrief.addEventListener('click', handleOptimize);
    $btnReset.addEventListener('click', handleReset);
    $btnCopyHtml.addEventListener('click', () => copyToClipboard(lastHtmlOutput, $btnCopyHtml));
    $btnCopyGutenberg.addEventListener('click', copyForGutenberg);
    $btnCopyText.addEventListener('click', () => copyToClipboard(stripHtml(lastHtmlOutput), $btnCopyText));
    $outputTabs.forEach(tab => tab.addEventListener('click', () => {
      selectOutputTab(tab);
      if (tab.dataset.tab === 'history') renderHistory();
    }));
    updateMarketInfo();
  }

  // ============================================================
  // MARKET SELECTION
  // ============================================================
  function selectMarket(tab) {
    $marketTabs.forEach(t => { t.classList.remove('market-tab--active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('market-tab--active');
    tab.setAttribute('aria-selected', 'true');
    const key = tab.dataset.market;
    selectedMarket = MARKETS[key];
    $outputMarketBadge.textContent = tab.dataset.short;
    updateMarketInfo();
  }

  function updateMarketInfo() {
    const activeTab = document.querySelector('.market-tab--active');
    $marketGoogleLabel.textContent = selectedMarket.google_domain;
    $marketLangLabel.textContent = selectedMarket.langLabel;
  }

  // ============================================================
  // SETTINGS MODAL
  // ============================================================
  function openModal() {
    $keyGemini.value = apiKeys.gemini;
    $keyOpenai.value = apiKeys.openai;
    $keySerp.value = apiKeys.serp;
    $settingsModal.hidden = false;
  }

  function closeModal() { $settingsModal.hidden = true; }

  function saveKeys() {
    apiKeys.gemini = $keyGemini.value.trim();
    apiKeys.openai = $keyOpenai.value.trim();
    apiKeys.serp = $keySerp.value.trim() || SERP_API_KEY_DEFAULT;
    localStorage.setItem('bbo_gemini', apiKeys.gemini);
    localStorage.setItem('bbo_openai', apiKeys.openai);
    localStorage.setItem('bbo_serp', apiKeys.serp);
    closeModal();
  }

  function loadKeys() {
    apiKeys.gemini = localStorage.getItem('bbo_gemini') || GEMINI_API_KEY_DEFAULT;
    apiKeys.openai = localStorage.getItem('bbo_openai') || OPENAI_API_KEY_DEFAULT;
    apiKeys.serp = localStorage.getItem('bbo_serp') || SERP_API_KEY_DEFAULT;
  }

  // ============================================================
  // TAB NAVIGATION
  // ============================================================
  function selectOutputTab(tab) {
    $outputTabs.forEach(t => { t.classList.remove('output-tab--active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('output-tab--active');
    tab.setAttribute('aria-selected', 'true');
    Object.entries($outputPanels).forEach(([key, panel]) => {
      if (key === tab.dataset.tab) panel.classList.remove('output-panel--hidden');
      else panel.classList.add('output-panel--hidden');
    });
  }

  // ============================================================
  // INPUT HANDLING
  // ============================================================
  function updateWordCount() {
    // Removed since inputContent is removed
  }

  function validateInputs() {
    const kw = $inputKeyword.value.trim();
    if (!kw) {
      $keywordError.hidden = false;
      $inputKeyword.classList.add('is-error');
      return false;
    }
    $keywordError.hidden = true;
    $inputKeyword.classList.remove('is-error');
    return true;
  }

  // ============================================================
  // PIPELINE UI
  // ============================================================
  function setPipelineStep(step) {
    // step: 0-4 (active), -1 = all done
    $pipelineSteps.forEach((s, i) => {
      s.classList.remove('pipeline__step--active', 'pipeline__step--done');
      if (step === -1 || i < step) s.classList.add('pipeline__step--done');
      else if (i === step) s.classList.add('pipeline__step--active');
    });
    $pipelineConnectors.forEach((c, i) => {
      c.classList.toggle('pipeline__connector--done', step === -1 || i < step);
    });
  }

  function setStatus(text, pct) {
    $statusBar.hidden = false;
    $statusText.textContent = text;
    $statusProgress.style.width = `${pct}%`;
  }

  function hideStatus() {
    $statusBar.hidden = true;
    $statusProgress.style.width = '0%';
  }

  function showApiError(msg) {
    $apiError.textContent = msg;
    $apiError.hidden = false;
  }

  function hideApiError() { $apiError.hidden = true; }

  function setLoading($btn, on) {
    isProcessing = on;
    $btn.disabled = on;
    const $spinner = $btn.querySelector('.btn__spinner');
    if (on) { $btn.classList.add('btn--loading'); if ($spinner) $spinner.hidden = false; }
    else { $btn.classList.remove('btn--loading'); if ($spinner) $spinner.hidden = true; }
  }

  // ============================================================
  // SERP API — Fase 0
  // Extrae: posición, featured snippet, PAA, AI Overview, top 10
  // ============================================================
  async function runSerpAudit(keyword) {
    const keysToTry = [...SERP_API_KEYS_POOL];
    // Si el usuario configuró una key manual en Settings que no está en el pool, ponerla primero
    if (apiKeys.serp && !keysToTry.includes(apiKeys.serp)) {
      keysToTry.unshift(apiKeys.serp);
    }

    let lastError = null;

    for (const key of keysToTry) {
      const serpParams = {
        api_key: key,
        engine: 'google',
        q: keyword,
        gl: selectedMarket.gl,
        hl: selectedMarket.hl,
        google_domain: selectedMarket.google_domain,
        num: 10,
      };

      try {
        console.log(`[SerpAPI] Intentando con key: ${key.slice(0, 6)}...`);
        // Intentar primero a través del servidor local node (si existe)
        const localUrl = `/serp?${new URLSearchParams(serpParams).toString()}`;
        const response = await fetch(localUrl, { signal: AbortSignal.timeout(15000) }).catch(() => null);

        if (response && response.ok) {
          const data = await response.json();
          if (data.error) {
            console.warn(`[SerpAPI] Key ${key.slice(0, 6)} falló: ${data.error}`);
            lastError = new Error(data.error);
            continue; // Probar siguiente key
          }
          return parseSerpData(data, keyword);
        }

        // Fallback a proxies si el servidor local falla para esta key
        const serpUrl = `https://serpapi.com/search.json?${new URLSearchParams(serpParams).toString()}`;
        const proxies = [
          `https://corsproxy.io/?${encodeURIComponent(serpUrl)}`,
          `https://api.allorigins.win/get?url=${encodeURIComponent(serpUrl)}`,
        ];

        for (const proxyUrl of proxies) {
          try {
            const proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
            if (!proxyRes.ok) continue;

            const raw = await proxyRes.json();
            const data = raw.contents ? JSON.parse(raw.contents) : raw;

            if (data.error) {
              console.warn(`[SerpAPI] Key ${key.slice(0, 6)} en proxy falló: ${data.error}`);
              lastError = new Error(data.error);
              break; // Sale del loop de proxies para probar la SIGUIENTE KEY
            }
            return parseSerpData(data, keyword);
          } catch (e) {
            lastError = e;
          }
        }
      } catch (err) {
        lastError = err;
        console.warn(`[SerpAPI] Error general con key ${key.slice(0, 6)}:`, err.message);
      }
    }

    throw lastError || new Error('Todas las claves de SerpAPI han agotado sus créditos o fallado.');
  }

  function parseSerpData(data, keyword) {
    const result = {
      keyword,
      market: selectedMarket,
      position: null,
      featuredSnippet: null,
      paaQuestions: [],
      aiOverview: null,
      top10: [],
      relatedSearches: [],
    };

    // Posición del dominio (buscar Blimburn en organic)
    const organicResults = data.organic_results || [];
    organicResults.forEach((r, idx) => {
      if (r.link && (r.link.includes('blimburn') || r.link.includes('blimburn.com'))) {
        if (result.position === null) result.position = idx + 1;
      }
    });

    // Top 10
    result.top10 = organicResults.slice(0, 10).map(r => ({
      position: r.position || 0,
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
    }));

    // Featured Snippet
    const fs = data.answer_box || data.featured_snippet;
    if (fs) {
      result.featuredSnippet = {
        type: fs.type || 'paragraph',
        title: fs.title || '',
        snippet: fs.snippet || fs.answer || fs.result || '',
        link: fs.link || '',
      };
    }

    // PAA
    const paas = data.related_questions || [];
    result.paaQuestions = paas.map(q => ({
      question: q.question || '',
      snippet: q.snippet || '',
      source: q.source?.link || '',
    }));

    // AI Overview
    if (data.ai_overview) {
      result.aiOverview = {
        text: data.ai_overview.text_blocks?.map(b => b.snippet || b.text || '').join('\n') || data.ai_overview.text || '',
        sources: data.ai_overview.sources || [],
      };
    }

    // Related searches
    result.relatedSearches = (data.related_searches || []).map(r => r.query || r).filter(Boolean);

    return result;
  }

  // ============================================================
  // BLIMBURN CATALOG FETCHING (SITEMAPS)
  // ============================================================
  async function loadLocalCatalog() {
    if (blimburnCatalog.length > 0) return;
    try {
      const res = await fetch('catalog.json');
      if (res.ok) {
        blimburnCatalog = await res.json();
        console.log(`[Catálogo] Cargadas ${blimburnCatalog.length} variedades locales de catalog.json.`);
      } else {
        console.warn('catalog.json no encontrado, se usará el fallback básico.');
        blimburnCatalog = ['Gorilla Glue', 'Blue Dream', 'Purple Haze', 'Gelato', 'Wedding Cake', 'OG Kush'];
      }
    } catch (err) {
      console.warn('Error cargando catalog.json:', err.message);
      blimburnCatalog = ['Gorilla Glue', 'Blue Dream', 'Purple Haze', 'Gelato', 'Wedding Cake', 'OG Kush'];
    }
  }

  // ============================================================
  // ANALYSIS ENGINE — GPT-4o como motor principal de análisis
  // (Gemini free-tier agotado; OpenAI es la cuenta de pago activa)
  // ============================================================
  async function callAnalysisEngine(prompt) {
    // Solo intentar Gemini si se ha configurado una key propia (no la default agotada)
    if (apiKeys.gemini && apiKeys.gemini !== GEMINI_API_KEY_DEFAULT) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKeys.gemini}`;
        const body = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
          safetySettings: [
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          ],
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        });
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) return text;
        }
      } catch (_) { /* fallback a OpenAI */ }
    }
    // OpenAI GPT-4o como motor de análisis (cuenta de pago, siempre disponible)
    return callOpenAI(
      `You are an elite SEO consultant and cannabis cultivation expert for Blimburn Seeds, specializing in the ${selectedMarket.google_domain} market.`,
      prompt
    );
  }

  // ============================================================
  // OPENAI API — Redacción de contenido
  // ============================================================
  async function callOpenAI(systemPrompt, userPrompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeys.openai}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI ${response.status}: ${err.error?.message || 'error'}`);
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('OpenAI devolvió respuesta vacía');
    return text;
  }

  // ============================================================
  // TECHNICAL AUDIT — Revisión de precisión y extensión
  // ============================================================
  async function callTechnicalAudit(htmlDraft, keyword, secondaryKws) {
    const kbString = JSON.stringify(window.CULTIVATION_KB || {}, null, 2);
    const currentWordCount = htmlDraft.split(/\s+/).filter(word => word.length > 0).length;
    const wordsNeeded = Math.max(0, 1550 - currentWordCount);

    const systemPrompt = `You are a Technical Quality Auditor and Master Grower for Blimburn Seeds. 
Your job is to receive a draft article and fix these specific things using the following GROUND TRUTH DATA:

============================================================
BLIMBURN TECHNICAL KNOWLEDGE BASE:
${kbString}
============================================================

1. TECHNICAL ERRORS & CONTEXT: Correct factual, biological, or policy hallucinations.
   - For CULTIVATION topics: Ensure parameters (RH%, EC, pH, Yields) strictly match the Knowledge Base.
   - For CONSUMPTION / LIFESTYLE topics (like smoking, blunts, effects): IGNORE cultivation parameters (do NOT force RH%, EC, or VPD into the text contextually irrelevant tips).
   - For CONSUMPTION / LIFESTYLE topics (like smoking, blunts, effects): IGNORE cultivation parameters.
2. TABLE RELEVANCE: Ensure the Comparison Table follows the VERTICAL structure (4 columns: Labels + 3 Items/Concepts; 5 data rows of features). The table MUST be deeply relevant to the article's actual topic.
3. WORD COUNT (CRITICAL): The received draft has ~${currentWordCount} words. You MUST expand it by at least ${wordsNeeded} more words to exceed the 1500-word limit. 
   - EXPANSION METHOD: Identify sections that lack depth and add technical/physiological paragraphs to them.
   - PRESERVATION MANDATE (CRITICAL): NEVER delete, merge, or summarize existing H2/H3 sections that contain Strain lists, recommendations, products, or HTML links. You must PRESERVE all strains generated in the draft exactly as they are.
   - Detail the "Why" and "How": explain mechanisms, specific regulations, historical context, or biological changes.
4. EEAT & ANTI-FILLER RULES:
   - THE WORD "STUDY" (and translations like "Estudio", "Studie", "Étude") IS BANNED when used to validate facts. 
   - NEVER use phrases like "Studies show", "Recent research", "Scientific evidence", or "In a study conducted in..." (e.g., "En un estudio realizado en..."). 
   - REWRITE MANDATE: Attribute all technical facts to the grower community. Use: "Experienced growers report...", "Master growers have communicated...", "In professional cultivation circles...", or "Many cultivators have signaled that...".
   - ANTI-REPETITION: Audit the entire article for redundancy. If multiple sections repeat the same advice, rewrite them to focus on DIFFERENT nuances. Ensure high Information Gain in every paragraph.
5. QUANTITATIVE RULES:
   - QUICK SUMMARY BOX: MUST be exactly 60 to 100 words long.
   - FAQ ANSWERS: MUST be exactly 45 to 65 words long and start with a direct, definition-style answer.
6. CONVERSATIONAL STYLE & TONE: 
   - FORBIDDEN WORDS: NEVER use any of the following phrases anywhere in the text, including headings, titles, meta descriptions, or paragraphs:
     • "understanding" (in any capitalization)
${selectedMarket.forbiddenWords.map(w => `     • "${w}"`).join('\n')}
   - REMOVE any vacant intros, generic closers, or mechanical transitions.
   - DATA-FIRST REWRITE: Ensure paragraphs start with numbers/facts. 
   - PACING: Break long sentences into units of max 20 words.
   - IMPERATIVE: Ensure every instruction is direct (Second-person informal).
   - Target language: ${selectedMarket.contentLang}.

7. SECONDARY KEYWORDS ENFORCEMENT (MANDATORY):
   The user has requested the following Secondary Keywords:
   ${secondaryKws || 'None provided'}
   CRITICAL: You MUST ensure that EVERY SINGLE phrase from the list above is present in the final HTML. 

8. PRIMARY KEYWORD RULES (MANDATORY):
   - The TARGET KEYWORD ("${keyword}") MUST be present in at least one H2 and at least one H3 naturally. If they are missing, rewrite an H2 and an H3 to include it naturally.

9. COMPETITOR SEED BANK BAN (ABSOLUTE):
   - Blimburn Seeds is the ONLY seed bank/brand allowed in the text. SCAN the draft and REMOVE any mention of competitor seed banks or breeders (e.g., Dutch Passion, Royal Queen Seeds, Barney's Farm, Sensi Seeds, Fast Buds, Sweet Seeds, Dinafem, Humboldt Seeds, ILGM, Seedsman, Green House Seeds, Nirvana, or any other).
   - When you find one, rewrite the sentence to remove the brand name while keeping the genetic/technical info (e.g., replace "bred by Dutch Passion" with "a well-established cross"). Never attribute genetics to a named competitor.

Output ONLY the final corrected HTML. No preambles or explanations.`;

    const userPrompt = `KEYWORD: "${keyword}"\n\nCURRENT DRAFT (${currentWordCount} words):\n--- \n${htmlDraft}\n ---`;

    return await callOpenAI(systemPrompt, userPrompt);
  }

  // ============================================================
  // HELPERS — Procesamiento de salida
  // ============================================================
  function escapeHtml(unsafe) {
    return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function extractMetaFromHtml(html) {
    const titleMatch = html.match(/<!--\s*META-TITLE:\s*(.*?)\s*-->/);
    const descMatch = html.match(/<!--\s*META-DESC:\s*(.*?)\s*-->/);
    const slugMatch = html.match(/<!--\s*URL-SLUG:\s*(.*?)\s*-->/);
    
    // Extract JSON-LD script block
    const jsonLdMatch = html.match(/<script\s+type=["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/i);

    // Remove the comments and script blocks from the body text
    let cleanHtml = html
      .replace(/<!--\s*META-TITLE:.*?\s*-->/g, '')
      .replace(/<!--\s*META-DESC:.*?\s*-->/g, '')
      .replace(/<!--\s*URL-SLUG:.*?\s*-->/g, '')
      .replace(/<script\s+type=["']application\/ld\+json["']\s*>[\s\S]*?<\/script>/gi, '');

    return {
      metaTitle: titleMatch ? titleMatch[1].trim() : '',
      metaDesc: descMatch ? descMatch[1].trim() : '',
      urlSlug: slugMatch ? slugMatch[1].trim() : '',
      jsonLd: jsonLdMatch ? `<script type="application/ld+json">\n${jsonLdMatch[1].trim()}\n</script>` : '',
      cleanHtml: cleanHtml.trim()
    };
  }

  // ============================================================
  // PROMPTS — Construidos dinámicamente por mercado/idioma
  // ============================================================
  function buildAnalysisPrompt(originalContent, keyword, secondaryKws, expertNotes, serp) {
    const lang = selectedMarket.langFull;
    const market = selectedMarket.google_domain;
    const contentLang = selectedMarket.contentLang;

    const serpContext = serp ? `
SERP AUDIT DATA (${market} — real-time):
- Current position for "${keyword}": ${serp.position ? `#${serp.position}` : 'Not found in top 10'}
- Featured Snippet: ${serp.featuredSnippet ? `"${serp.featuredSnippet.snippet.slice(0, 200)}" (${serp.featuredSnippet.type})` : 'No featured snippet'}
- AI Overview present: ${serp.aiOverview ? 'YES — ' + serp.aiOverview.text.slice(0, 300) + '...' : 'NO'}
- People Also Ask questions:
${serp.paaQuestions.slice(0, 6).map((q, i) => `  ${i + 1}. ${q.question}`).join('\n') || '  (none)'}
- Top 10 titles (competitors): 
${serp.top10.slice(0, 5).map((r, i) => `  ${i + 1}. ${r.title}`).join('\n') || '  (none)'}
- Related searches: ${serp.relatedSearches.slice(0, 8).join(', ') || 'none'}
` : 'SerpAPI data: not available';

    return `You are an elite SEO consultant and cannabis industry expert with 10+ years of cultivation experience, specializing in the ${market} market (${contentLang}-speaking audience).

TASK: Produce a comprehensive Content Strategy Brief for an article that will be written in ${contentLang}.

TARGET MARKET: ${market} | ARTICLE LANGUAGE: ${contentLang} (${lang})
TARGET KEYWORD: "${keyword}"
${serpContext}

MANDATORY SECONDARY KEYWORDS:
${secondaryKws || '(None provided)'}
${serp?.relatedSearches ? `RELATED SEARCHES (Treat as secondary keywords): ${serp.relatedSearches.join(', ')}` : ''}

You MUST ensure that the structure and strategy you define in this brief incorporate both the secondary keywords and the related searches found in the SERP.

CRITICAL LANGUAGE RULE FOR THIS BRIEF:
- THIS BRIEF DOCUMENT must be written entirely in SPANISH (Español), regardless of the article's target language.
- The ARTICLE will be written in ${contentLang} — but YOUR brief analysis, explanations, recommendations, strategic commentary, and section labels must all be in Spanish.
- Exception: Actual content examples meant to be used verbatim in the article (H1, Meta Title, Meta Description, URL slug, heading proposals, opening paragraph draft, FAQ questions, image ALT texts) MUST be written in ${contentLang}, since they will be copied directly into the article.
- Do NOT write the analysis sections (Search Intent, Funnel Stage, Content Gaps, etc.) in ${contentLang}. Write them in Spanish.

MANDATORY NOMENCLATURE:
- "Gorilla Glue 4" MUST be written as "GG4".
- "Gorilla Glue #4" MUST be written as "GG4".
- "Gorilla Glue" MUST be written as "GG".
This applies to all languages and sections.

Produce your analysis in this exact format (do not use markdown code blocks for the whole output, just plain text with markdown headers):

## DIAGNÓSTICO SEO / SEO STRATEGY

### Intención de Búsqueda / Search Intent
[informational / transactional / navigational / mixed — explain briefly what the user wants based on SERP]

### Etapa del Funnel / Funnel Stage
[TOFU / MOFU / BOFU — explain briefly]

### Formato Recomendado / Recommended Format
[e.g. Guide, Listicles, Step-by-Step, vs Comparison]

### Gaps de Contenido & Information Gain / Content Gaps
[Specific topics missing from top competitors based on PAA and related searches. How can we make this 10x better?]

## ESTRUCTURA DEL ARTÍCULO / ARTICLE STRUCTURE



### Estructura de Encabezados (H2 y H3)
[CRÍTICO: Debes seguir EXACTAMENTE esta estructura de encabezados, sin añadir ni quitar ninguno. Reemplaza la variable para usar la keyword: "${keyword}"]
H1: How to Grow ${keyword}: A Step-by-Step Guide
H2: ${keyword} Strain Overview: Traits, Effects & Genetics
H2: Optimal Growing Environment
H2: Grow Room Setup and Configuration
  H3: Indoor Growing Tips
  H3: Outdoor Growing Tips
H2: How to Germinate & Propagate ${keyword}
H2: Vegetative Stage: Plant Care & Development
H2: Flowering Stage: What to Expect
H2: Fertilizers & Nutrient Schedule
H2: Pest and Disease Prevention for Healthy Cannabis Plants
H2: Harvesting & Drying ${keyword} the Right Way
H2: Expected Plant Height & Structure
H2: Best ${selectedMarket.regionName} Cities and Climates for This Strain
H2: How to Clone ${keyword}: Step-by-Step
H2: Plant Waste: Extraction & Repurposing
H2: Key Benefits for Cultivators
H2: Potential Challenges When Growing This Strain
H2: Is ${keyword} Worth Buying? Here’s What You Need to Know
H2: FAQs: Growing ${keyword}
[Integra las keywords secundarias de forma natural en el texto bajo estos encabezados]

### Mapa de Integración — Búsquedas Relacionadas
[Para cada búsqueda relacionada, indica en qué H2/H3 concreto aparecerá y cómo se integrará de forma natural en el texto del párrafo — no como anchor ni como elemento de lista, sino dentro de una frase]
${serp?.relatedSearches?.length ? serp.relatedSearches.slice(0, 10).map(rs => `- "${rs}" → [H2/H3 donde aparece + cómo se integra en el texto]`).join('\n') : '(sin búsquedas relacionadas disponibles)'}

### Párrafo de Apertura (Target: AI Overview)
[Draft the opening paragraph in ${contentLang} — max 120 words, must answer the main query in 3 sentences, include main keyword, include a specific verifiable data point. This will be used verbatim in the article.]

### PAA → FAQ Mapping
${serp?.paaQuestions.length ? serp.paaQuestions.slice(0, 6).map((q, i) => `${i + 1}. "${q.question}" → [suggested FAQ]`).join('\n') : '[Suggest 6 FAQ questions in ${contentLang} based on related searches]'}

## METADATA & ASSETS

### Meta Title (${contentLang})
[50-60 chars, main keyword first. CRITICAL: This title MUST be structurally different from the H1 above. Use a more technical/transactional angle for the Meta Title.]

### Meta Description (${contentLang})
[150-160 chars, keyword + CTA + differentiator]

### URL Slug
[short-slug-with-dashes]

### Enlaces Internos Sugeridos / Internal Linking Strategy
[Suggest 3 to 5 internal linking contexts (e.g. "Link to GG4 product page when discussing resin production"). Provide anchor text suggestions.]

### Ideas para Imágenes / Image Ideas
[Suggest 2-3 specific image types (e.g. Infographic showing terpene profile, Macro shot of trichomes) and the exact ALT text to use]`;
  }

  function buildBriefAndContentPrompt(analysisOutput, originalContent, keyword, secondaryKws, serp, expertNotes) {
    const lang = selectedMarket.langFull;
    const market = selectedMarket.google_domain;
    const contentLang = selectedMarket.contentLang;
    
    // Tabla header translation by language
    const tableHeaderTranslations = {
      'en': 'Feature',
      'es': 'Características',
      'de': 'Merkmal',
      'fr': 'Caractéristiques'
    };
    const tableHeaderLabel = tableHeaderTranslations[selectedMarket.lang] || 'Feature';

    const metricDirectives = market === 'google.com'
      ? `CRITICAL METRICS RULE (USA MARKET):
You MUST use the IMPERIAL system as the primary metric, followed by the metric system in parentheses.
- Temperatures: °F first, then °C. Example: 68°F - 77°F (20°C - 25°C). NEVER the other way around.
- Weights / Yields: Ounces (oz) first, then grams (g). Example: 1.5 - 2 oz/ft² (450 - 600 g/m²).
- Distances / Areas: Feet/Inches first, then meters/cm.`
      : `CRITICAL METRICS RULE (EU/UK MARKET):
You MUST use the METRIC system as the primary metric. You can optionally include imperial in parentheses, but it is not required.
- Temperatures: °C first. Example: 20°C - 25°C.
- Weights / Yields: Grams (g) first. Example: 450 - 600 g/m².
- Distances / Areas: Meters/Centimeters first.`;

    const expertDirectives = expertNotes
      ? `\n====================================================================\nRULE 0 — MASTER GROWER & EDITORIAL REQUIREMENTS (TOP PRIORITY)\n====================================================================\nThe Blimburn Master Grower has provided the following specific technical requirements. You MUST organically weave these points into your paragraphs or use them to select which strains to highlight and interlink:\n«${expertNotes}»\n`
      : '';

    const aiOverviewMirrorText = serp?.aiOverview?.text
      ? (() => {
        const t = serp.aiOverview.text;
        const end = t.indexOf('\n');
        return end > 0 ? t.slice(0, end).trim() : t.trim();
      })()
      : null;

    const aiOverviewInstruction = serp?.aiOverview
      ? `
AI OVERVIEW STRATEGY (SearchLogistics Mirror Method):
Google is showing an AI Overview for "${keyword}". Use the MIRROR STRATEGY for the QUICK SUMMARY BOX (the green box at the top):

EXISTING AI OVERVIEW FIRST PARAGRAPH (Google's current source):
«${aiOverviewMirrorText}»

YOUR TASK FOR THE QUICK SUMMARY BOX:
The goal is to keep the exact same core information, but make it unique for our site.
1. Make some minor edits to the original content in ${contentLang}.
2. Change the sentence structure slightly.
3. Swap out some words with different synonyms.
4. CRITICAL: NEVER hallucinate, alter, or invent new facts, percentages, or lineages. The core facts MUST remain identical to the original paragraph.
5. Density Requirement: The Quick Summary Box MUST be exactly 60 to 100 words long.
6. This Quick Summary Box must be self-contained and answer the full search intent in isolation.

CRITICAL DIVERSITY RULE FOR THE OPENING PARAGRAPH (Under the H1):
The Opening Paragraph is the actual start of the article. It MUST provide COMPLETELY DIFFERENT information and numbers than the Quick Summary Box above it. 
If the Summary Box talks about THCA % and Yield, the Opening Paragraph MUST talk about Terpenes and Flowering time, or vice-versa. DO NOT recycle the same stats or concepts.
`
      : `
No AI Overview detected. FEATURED SNIPPET STRATEGY:
The QUICK SUMMARY BOX (the green box at the top) must directly answer the query with high semantic density, exactly length: 65-90 words.
Start with the main answer. Use this pattern:
  Sentence 1: "[Keyword] is/are [direct answer with key differentiator]."
  Sentence 2: "[Specific numerical data: %, days, ratios, values]."
  Sentence 3: "[Practical takeaway: what the reader can do with this information]."

CRITICAL DIVERSITY RULE FOR THE OPENING PARAGRAPH:
The Opening Paragraph (under the H1) MUST contain a DIFFERENT key fact and angle. DO NOT duplicate numbers or concepts from the Quick Summary Box.
`;

    const paaSection = serp?.paaQuestions?.length > 0
      ? `MANDATORY FAQ SELECTION (Max 5 Questions):
Here are the "People Also Ask" questions from Google:
${serp.paaQuestions.slice(0, 8).map((q, i) => `  - ${q.question}`).join('\n')}

YOUR TASK FOR FAQs:
Select exactly 5 questions to answer as H3s.
CRITICAL: DO NOT select questions that overlap with the article's H2s or with each other (e.g., if you have a "Benefits" H2, do not include a "What are the benefits" FAQ or "Is it good for medical use").
If the PAA list lacks 5 completely distinct, highly specific questions, INVENT the remaining ones to reach exactly 5. Make invented questions highly technical or specific (e.g., "What makes [keyword] exotic?", "How to store [keyword]?", "Can I use [keyword] in edibles?").`
      : `Generate exactly 5 highly specific FAQ questions in ${contentLang}. Do not ask general/basic questions (like "What is it?" or "What are the benefits?") that are already covered in the main H2s. Focus on specific edge cases, storage, comparisons, or expert usage."`;

    // Select a random sample of 120 strains to pass to the prompt to save huge amounts of tokens
    // while keeping variety across different articles generated over time.
    let catalogSample = blimburnCatalog;
    if (blimburnCatalog.length > 120) {
      const shuffled = [...blimburnCatalog].sort(() => 0.5 - Math.random());
      catalogSample = shuffled.slice(0, 120);
    }

    return `You are a world-class SEO content writer and professional cannabis cultivation expert (10+ years experience) writing for Blimburn Seeds on the ${market} market.

====================================================================
CRITICAL LANGUAGE DIRECTIVE
====================================================================
ALL content MUST be in ${contentLang} (${lang}) — using NATIVE vocabulary of ${contentLang}-speaking growers and consumers. This is NOT translated content.
CRITICAL: The mandatory template headings MUST be translated to ${contentLang} while maintaining their exact sequence and meaning.
Strain names and "Blimburn Seeds" brand stay in English. ALL other text (headings, paragraphs, FAQs) is in ${contentLang}.

MANDATORY NOMENCLATURE:
- "Gorilla Glue 4" MUST be written as "GG4".
- "Gorilla Glue #4" MUST be written as "GG4".
- "Gorilla Glue" MUST be written as "GG".
This applies to all languages and sections.

TARGET KEYWORD: "${keyword}"
TARGET KEYWORD RULES:
- The TARGET KEYWORD ("${keyword}") MUST be present in at least one H2 and at least one H3 naturally.

SECONDARY KEYWORDS & RELATED SEARCHES TO INCLUDE:
- User Provided: ${secondaryKws || 'None provided'}
- Related Searches (SERP): ${serp?.relatedSearches?.join(', ') || 'None found'}

CRITICAL RULE — ORGANIC INTEGRATION OF RELATED SEARCHES (MANDATORY, NO EXCEPTIONS):
You MUST weave EVERY SINGLE phrase from the Related Searches (SERP) list into the body text as natural prose, following the integration map from the SEO Brief above:
- Each phrase MUST appear WITHIN a sentence as a grammatically natural part of the text. Inflect or conjugate the phrase if needed to fit the sentence structure.
- DO NOT add them as standalone lines, bold keyword anchors, list items, or section headings.
- Distribute them across DIFFERENT paragraphs and H3 sections — never cluster multiple related searches in the same sentence or paragraph.
- Correct example: "Muchos cultivadores se preguntan por [related search] cuando seleccionan semillas feminizadas..."
- Wrong example: "**[related search]** es un tema importante." or a bullet point with the phrase.
- Skipping any related search is a critical failure. Every phrase from the SERP list must be traceable in the final text.

====================================================================
STOP-WORD / FORBIDDEN PATTERNS (AVOID AT ALL COSTS)
====================================================================
To sound human and high-quality, you ARE PROHIBITED from using the following words anywhere in the text, including HEADERS (H1, H2, H3), TITLES, META DESCRIPTIONS and PARAGRAPHS:
- "understanding" (in any capitalization)
${selectedMarket.forbiddenWords.map(w => ` - "${w}"`).join('\n')}
Failing to follow this will result in a low-quality score. Use more specific, professional, and natural alternatives.

MARKET: ${market} | LANGUAGE: ${contentLang}
${expertDirectives}
SERP CONTEXT:
${aiOverviewInstruction}

SEO ARCHITECTURE (from analysis phase):
${analysisOutput}

ORIGINAL CONTENT TO IMPROVE:
---
${originalContent || '[No original content — generate from scratch based on keyword and architecture above]'}
---

====================================================================
QUALITY RULES — EVERY RULE IS MANDATORY, NO EXCEPTIONS
====================================================================

RULE 1 — PARAGRAPH DEPTH & STRUCTURE:
You MUST strictly follow the MANDATORY HTML OUTPUT STRUCTURE provided below.
Under EVERY H2 and H3 heading, you MUST write between 2 and 3 separate, DENSE AND LONG paragraphs (minimum 80 words per paragraph).
CRITICAL: NEVER write just 1 single paragraph per section. You must output 2 or 3 paragraphs per heading, varying the count naturally. Ensure each paragraph is wrapped in its own <p> tag.

ANTI-REPETITION MANDATE (CRITICAL):
Google detects thin content if you repeat the same information across different sections. You MUST ensure that every H2 and H3 provides UNIQUE value and facts. 
- If H2 A talks about "Light intensity", H2 B should talk about "Spectrum" or "Heat management", NOT repeat the same PPFD numbers.
- Do not recycle the same introductory filler or "why it matters" paragraphs. Move quickly to technical data.
- INFORMATION GAIN: Every paragraph must add a new dimension, a new technical metric, or a new practical nuance.

EEAT & SOURCING RULE (CRITICAL):
- BAN VAGUE CLAIMS: NEVER use "Studies show", "Experts say", "Research proves", "Scientific evidence has shown", or "In a study conducted in [Year]" (and their translations like "En un estudio...", "Según investigaciones..."). 
- THE WORD "STUDY" (and translations like "Estudio", "Studie", "Étude") IS BANNED when used to validate facts without a specific external URL.
- HONEST PHRASING: You MUST attribute all technical facts to the grower community. Use: "Experienced growers report...", "In artisanal cultivation circles...", "Master growers have pointed out...", "Many cultivators share that...", "The growing community has communicated...".
- CONSEQUENCE: Any mention of an anonymous or uncited study is an absolute failure and will result in the article being flagged as AI-generated spam. Use ONLY human-centric expertise phrasing.

The structure must adapt to the article's topic:
If Cultivation/Botany:
  a) **Botanical Framework**: Biological process involved (e.g., terpene synthesis).
  b) **Cultivation Impact**: How it affects yield, potency, etc.
  c) **Expert Execution**: Specific parameters (VPD, EC, pH) and common mistakes.
If Legislation/Market:
  a) **Legal Framework/Context**: The specific law, policy, or historical background.
  b) **Practical Impact**: How this affects consumers, businesses, or the industry.
  c) **Expert Navigation**: Specific limits, dates, penalties, or compliance requirements.
If Consumption/Effects:
  a) **Physiological Framework**: How it interacts with the body (e.g., ECS, receptors).
  b) **Sensory/Effect Profile**: Timelines, onset, and specific effects.
  c) **Expert Guidelines**: Dosages (mg), duration, and harm reduction tips.
DO NOT assume expert knowledge from the reader. Explain the EXACT mechanism or framework. To reach 1500 words, you must be extremely verbose in your explanations.

RULE 1B — KEYWORD DENSITY (ANTI-SPAM, MANDATORY):
The TARGET KEYWORD ("${keyword}") MUST appear in the final article with a density between 0.5% and 1.2% of the total word count.
- NEVER repeat the exact keyword phrase more than once per paragraph.
- NEVER force the keyword into a sentence where it sounds unnatural.
- In body paragraphs, prefer pronouns ("it", "this strain", "the plant", "these seeds") or partial references ("the strain", "this variety") over repeating the full keyword.
- The keyword is ONLY required verbatim in: the H1, the Quick Summary Box, 2-3 H2s maximum, and the first body paragraph. All other sections should reference the strain naturally.
- FORBIDDEN pattern: starting multiple consecutive sentences or paragraphs with the exact keyword.

RULE 2 — MANDATORY NUMERICAL DATA & METRIC SYSTEM:
Every section MUST contain at least 2 specific numerical values. Examples:
  - THC/THCA percentages: «25.4% THCA», «28-32% THCA», never «high THCA»
  - Terpene percentages: «Myrcene: 0.8-1.2%», «Caryophyllene: 0.4-0.7%»
  - ${market === 'google.com' ? 'Storage: «58-62% RH», «59-70°F (15-21°C)», «6-12 months in amber glass»' : 'Storage: «58-62% RH», «15-21°C», «6-12 months in amber glass»'}
  - Lighting: «800-1000 µmol/m²/s at peak flowering», «20/4 light schedule for autoflowers», «12/12 light schedule for photoperiodic flowering»
  - Nutrients: «N:P:K 3:1:2 vegetative», «N:P:K 1:3:2 flowering»
  - ${market === 'google.com' ? 'Yields: «1.5-1.8 oz/ft² (450-550 g/m²) indoor», «21-25 oz/plant (600-700 g/plant) outdoor»' : 'Yields: «450-550 g/m² indoor», «600-700 g/plant outdoor»'}
  - Flowering: «8-9 weeks from flip» or «70-80 days from seed to harvest» (autoflowers)
If you write a sentence with no number, it is REJECTED. Add the number.
${metricDirectives}

RULE 3 — TERPENE DEPTH (mandatory for every strain mention):
For each terpene mentioned:
  a) Give its percentage range in this strain
  b) Explain its specific sensory effect (aroma/flavor profile)
  c) Explain its physiological/entourage effect (e.g., Myrcene enhances THC uptake through blood-brain barrier, reduces inflammation via CB2 receptors)
  d) Never list terpenes without this context. NEVER say «rich in terpenes».

RULE 4 — COMPARISON TABLE (mandatory):
The table must compare EXACTLY 3 specific items deeply relevant to the article's true Search Intent and current topic. 
- If Cultivation: compare 3 specific named cannabis strains from Blimburn Seeds. 
- If Effects/Consumption: compare 3 consumption methods, strains, or cannabinoids.
- If Legislation/Market/News: compare 3 relevant states, legal limits, historical dates, or policy features.
The table MUST have EXACTLY 4 columns:
1. "${tableHeaderLabel}" - Fixed label column.
2. [Item/Strain/Concept Name 1]
3. [Item/Strain/Concept Name 2]
4. [Item/Strain/Concept Name 3]
The table MUST have EXACTLY 5 data rows (features). Select the 5 technical or factual metrics that best support the article's specific Search Intent.
- RELEVANCE RULE: Do not include cultivation metrics like "Yield" or "Flowering Time" if the article is NOT about cultivation (e.g., if it is about Virginia's new market laws, effects, etc.). Ensure the table metrics strictly align with the topic.
Vertical orientation: Features as rows, Items/Concepts as columns. Use actual expert knowledge or provided facts.

RULE 5 — PROFESSIONAL TIPS (mandatory level of specificity):
The tips MUST dynamically adapt to the article's ACTUAL core topic (e.g., Cultivation, Consumption, Legalization, Extraction, Business, etc.). DO NOT give cultivation advice if the article is about legislation, market news, or effects.
Each tip MUST:
  a) Start with a specific parameter, range, dosage, date, limit, or regulation (e.g., «Maintain 58-62% RH...», «Consume 10-15mg CBD...», or «Track the 2.5 ounce possession limit...»).
  b) Explain the WHY or HOW (mechanism, impact, or factual reason).
  c) Name a common mistake, misconception, or penalty.
BAD cultivation tip: «Use a hygrometer to monitor humidity»
GOOD cultivation tip: «Maintain 58-62% RH during cure. Below 55% arrests terpene development; above 65% promotes Botrytis within 48h. Check with a calibrated digital hygrometer, never analog.»
GOOD legislation tip: «Never exceed the 2.5-ounce public possession limit in Virginia. While retail sales begin in 2027, possessing more than the limit is considered a civil or criminal offense depending on the amount.»
Minimum 6 expert tips. No generic advice. ALWAYS strictly adapt to the article's specific context.

RULE 6 — QUICK SUMMARY BOX (AI OVERVIEW TARGET):
The Quick Summary Box is your primary target for winning the AI Overview. It must accurately reflect the facts provided in the SERP/AI Overview context without making up new statistics. It must be exactly 60 to 100 words long.
The Opening Paragraph (immediately below the H1) MUST provide COMPLETELY DIFFERENT information and numbers than this Quick Summary Box.
If the Summary Box talks about THCA % and Yield, the Opening Paragraph MUST talk about Terpenes and Flowering time, or vice-versa. DO NOT recycle the same stats or concepts.

RULE 7 — FAQ ANSWERS:
Each FAQ answer MUST be:
  a) Exactly 45 to 65 words long.
  b) Lead with a direct definition or answer to the query in the first sentence.
  b) Completely self-contained (understandable without reading the article)
  c) Contain at least 1 numerical value
  d) Add information NOT already stated in the body of the article
  e) No cross-references («as mentioned above», «see section X»)
${paaSection}

RULE 8 — BLIMBURN SEEDS MENTIONS & STRAIN CATALOG:
Blimburn Seeds is a cannabis SEED BANK. Only mention it in contexts where seed purchase is relevant:
  - «Blimburn Seeds offers feminized and autoflowering seeds of [strain]»
NEVER say «purchase cannabis flower from Blimburn Seeds». Maximum 2 natural mentions.

CRITICAL — COMPETITOR SEED BANK BAN (ABSOLUTE, NO EXCEPTIONS):
Blimburn Seeds is the ONLY seed bank/brand allowed to be named anywhere in the article.
You are STRICTLY FORBIDDEN from naming, referencing, comparing, or attributing genetics to ANY other seed bank, breeder, or cannabis brand. This includes (but is NOT limited to):
Dutch Passion, Royal Queen Seeds, Barney's Farm, Sensi Seeds, Fast Buds, Sweet Seeds, Dinafem, FastBuds, Humboldt Seeds, ILGM (I Love Growing Marijuana), Seedsman, Green House Seeds, Pyramid Seeds, Garden of Green, Zamnesia, Herbies, MSNL, Crop King Seeds, Nirvana, Ministry of Cannabis, 00 Seeds, or any other competitor.
- NEVER write phrases like "originally bred by [brand]", "available from [brand]", "[brand]'s version", or "according to [brand]".
- If a strain's genetics are historically tied to another breeder, describe the genetics WITHOUT naming the breeder (e.g., say "a classic indica-dominant cross" instead of naming the originator).
- Naming any competitor seed bank is an ABSOLUTE FAILURE and the article will be rejected.

CRITICAL CATALOG ENFORCEMENT:
Whenever you mention, recommend, or compare ANY cannabis strain in this article, you MUST ONLY use strains that exist in the official Blimburn Seeds catalog.
If you use a strain name that is NOT in the list below, the article will be rejected.
Here is a relevant selection of available strains you can choose from (use these for your tables/lessons):
[AVAILABLE CATALOG SELECTION]: ${catalogSample.join(', ')}

RULE 8B — STRAIN RECOMMENDATION SECTION (MANDATORY FOR CONSUMPTION & LIFESTYLE ARTICLES):
This rule applies whenever the article topic is NOT a pure cultivation/growing guide (e.g., "types of blunts", "how to smoke", "best strains for X", "rolling techniques", "weed accessories", "cannabis effects", etc.).

For these articles, you MUST include a dedicated H2 section with a title like "Best [Topic] Strains", "Top Strains for [Topic]", or equivalent in ${contentLang}.

This section is Blimburn's PRIMARY CONTENT DIFFERENTIATOR. Generic competitors writing about blunts, effects, or products will NOT have this. It is what makes a Blimburn article uniquely valuable.

MANDATORY STRUCTURE for each strain entry (minimum 5 strains, aim for 8):
  a) Strain name (from the AVAILABLE CATALOG SELECTION above)
  b) THC% range (e.g., «22-26% THC»)
  c) Dominant terpene + its specific sensory effect (e.g., «Myrcene: earthy, mango undertones»)
  d) 2-sentence flavor/effect profile relevant to THIS specific consumption context
  e) One natural hyperlink: <a href="https://${selectedMarket.google_domain}/[strain-url-slug]/">[Strain Name]</a>

CRITICAL: Do NOT include cultivation metrics (yield, PPFD, NPK, RH%, VPD) in this section.
Focus EXCLUSIVELY on: flavor, aroma, effect, THC%, and why it suits this specific context.

If the article IS a cultivation guide (grow tips, nutrients, lighting, phenotype selection), SKIP this rule and follow RULE 8 only.

RULE 9 — INTERNAL LINKS (mandatory, minimum 2):
Add 2-4 internal links within the body text using this format:
  <a href="https://${selectedMarket.google_domain}/[relevant-url-slug]/">[anchor text in ${contentLang}]</a>
Base the URL slugs on the content topic and the ${market} domain structure.
Example: for a flowering tips section, link to «/feminized-seeds/» or «/autoflowering-seeds/»
Links must feel natural in context, never forced. Place in body paragraphs, not in FAQ answers.

RULE 10 — COMPARISON TABLE HTML FORMAT (MANDATORY):
All tables MUST follow this exact VERTICAL HTML structure (4 columns: Labels + 3 Strains; 5 data rows).
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
        <tr style="background-color: #1b5e20; color: white;">
            <th style="padding: 12px; border: 1px solid #ddd;">${tableHeaderLabel}</th>
            <th style="padding: 12px; border: 1px solid #ddd;">[Item Name 1]</th>
            <th style="padding: 12px; border: 1px solid #ddd;">[Item Name 2]</th>
            <th style="padding: 12px; border: 1px solid #ddd;">[Item Name 3]</th>
        </tr>
    </thead>
    <tbody>
        <!-- Exactly 5 data rows corresponding to the 5 selected features: -->
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">[Technical Feature 1]</td>
            <td style="padding: 10px; border: 1px solid #ddd;">[Data Item 1]</td>
            <td style="padding: 10px; border: 1px solid #ddd;">[Data Item 2]</td>
            <td style="padding: 10px; border: 1px solid #ddd;">[Data Item 3]</td>
        </tr>
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">[Technical Feature 2]</td>
            <td style="padding: 10px; border: 1px solid #ddd;">[Data Item 1]</td>
            <td style="padding: 10px; border: 1px solid #ddd;">[Data Item 2]</td>
            <td style="padding: 10px; border: 1px solid #ddd;">[Data Item 3]</td>
        </tr>
        <!-- ... continue until 5 ROWS are complete ... -->
    </tbody>
</table>

RULE 11 — BAN ON GENERIC AI PHRASES & MECHANICAL TRANSITIONS:
NEVER use vacant introductions, generic conclusions, or mechanical transitions.
- FORBIDDEN WORDS (CRITICAL): NEVER use the words "Understanding" or "Discover" (or their translations: "Descubre", "Entendiendo", "Comprender"). These are banned AI patterns.
- FORBIDDEN INTROS: «In diesem Artikel werden wir», «In this article we will explore», «Dans cet article nous allons»
- FORBIDDEN CLOSINGS: «Dies ist entscheidend für den Erfolg», «This is key to achieving the best results», «C'est essentiel pour la qualité»
- FORBIDDEN TRANSITIONS: «Ein weiterer wichtiger Aspekt ist», «Another important factor is», «Un autre aspect important est», «Darüber hinaus», «Moreover», «De plus»
End paragraphs with hard data, a final technical point, or an actionable tip. Do not summarize.

RULE 12 — MINIMUM LENGTH ENFORCEMENT & DEPTH:
The final article MUST exceed 1500 words of actual body text.
DO NOT achieve this with fluff, repetition, or generic filler. 
To reach this length, expand exclusively on: 
  a) **Mechanisms & Context**: Detailed explanations of biological pathways, specific historical/legal context, or market data depending on the topic.
  b) **Expert Application/Navigation**: Break down specific metrics or boundaries (VPD/EC for cultivation; mg dosages for effects; specific possession limits, tax rates, or dates for legislation).
  c) **Granular Analysis**: Depth on specific phenotypic traits, or nuanced legal loopholes/market trends.
  d) **Interlinking Strategy**: Natural technical mentions of Blimburn seeds where relevant.

RULE 13 — TONE & VOICE (DIRECT INFORMAL):
Write ALWAYS in the second person informal (Tú / You / Du / Tu), addressing the user directly. 
NEVER use impersonal forms («se debe», «man kann») or third person. 
Forbid: «one should», «it is important», «growers should». 

RULE 14 — CONVERSATIONAL EXPERT VOICE & PACING:
The text must sound like an expert (e.g., Master Grower, Industry Analyst, or Cannabis Science Expert) sharing hard-earned experience.
- DATA FIRST: Start paragraphs with the numerical data or a hard fact.
- THE "WHY": Include the concrete reason (botanical, legal, or physiological) behind every recommendation.
- SENTENCE LENGTH: Use short, punchy sentences (MAXIMUM 20 WORDS).
- CLAIM VERIFICATION: Avoid «optimal conditions» or «strict limits» without specific ranges/numbers.
- DO NOT use vacant intros («In this article...») or mechanical transitions («Another factor is...»).
- DO NOT use generic closers («This is key to success»).

RULE 15 — GERMINATION METHOD (MANDATORY):
When the article discusses germination (e.g., in the "How to Germinate & Propagate" section), you MUST ONLY explain the "Paper Towel Method" as it is the only method officially endorsed and guaranteed by Blimburn. 
You MUST provide these exact steps in ${contentLang}:
1. Setup: Moisten two paper towels with room temperature water. Place one paper towel on a plate and spread the seeds on it, spacing them about 2 cm apart.
2. Cover: Place the second paper towel over the seeds. Ensure any excess water is drained from the plate. Cover with another opaque plate and store in a warm, dark place.
3. Monitoring: Check every 4-6 hours to ensure towels remain moist, spraying with room temperature water if needed. Germination typically occurs within 24 to 120 hours.
NEVER suggest direct soil planting, water glass method, or any other germination technique.

====================================================================
MANDATORY HTML OUTPUT STRUCTURE
====================================================================

<div style="background:#f4f4f4;border-left:4px solid #2e7d32;padding:20px;margin-bottom:24px;border-radius:0 6px 6px 0;">
<strong>[Most important stat/fact]:</strong> [AI Overview Mirror target. Exactly 60 to 100 words in ${contentLang}. Must contain at least 1 number.]
</div>

<h1>How to Grow ${keyword}: A Step-by-Step Guide</h1>

<p>[Opening Paragraph: 3 sentences. Must NOT repeat the numbers/facts used in the Summary Box above. Introduce a completely different angle. All in ${contentLang}.]</p>

<h2>${keyword} Strain Overview: Traits, Effects & Genetics</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]
<!-- INSERT THE COMPARISON TABLE HERE -->
[Insert the comparison table exactly following the HTML structure defined in RULE 10]

<h2>Optimal Growing Environment</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Grow Room Setup and Configuration</h2>
<h3>Indoor Growing Tips</h3>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]
<h3>Outdoor Growing Tips</h3>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>How to Germinate & Propagate ${keyword}</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Vegetative Stage: Plant Care & Development</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Flowering Stage: What to Expect</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Fertilizers & Nutrient Schedule</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Pest and Disease Prevention for Healthy Cannabis Plants</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Harvesting & Drying ${keyword} the Right Way</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Expected Plant Height & Structure</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Best ${selectedMarket.regionName} Cities and Climates for This Strain</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>How to Clone ${keyword}: Step-by-Step</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Plant Waste: Extraction & Repurposing</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Key Benefits for Cultivators</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Potential Challenges When Growing This Strain</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>Is ${keyword} Worth Buying? Here’s What You Need to Know</h2>
[Write 2 to 3 detailed technical paragraphs in ${contentLang} wrapped in <p> tags. Vary the paragraph count naturally.]

<h2>FAQs: Growing ${keyword}</h2>
[Exactly 5 FAQ items from the PAA as H3+P pairs — exactly 45 to 65 words per answer, with numbers, self-contained. The H3 FAQ question must be in ${contentLang}]

<!-- META-TITLE: [50-60 chars in ${contentLang}, keyword first. MUST be different from the H1 heading of the article] -->
<!-- META-DESC: [150-160 chars in ${contentLang}, includes CTA] -->
<!-- URL-SLUG: [short-slug-with-dashes] -->
<!-- JSON-LD: 
<script type="application/ld+json">
[Insert a valid JSON-LD array containing both "Article" schema and "FAQPage" schema based on the content above. Make sure it is properly formatted, escaped and valid JSON]
</script>
-->

====================================================================
OUTPUT RULES
====================================================================
- Output ONLY valid HTML — no markdown, no preamble, no explanations outside HTML
- CRITICAL: ALL H1, H2, and H3 headings shown in the template MUST be translated to ${contentLang}. You MUST keep the exact same sequence, hierarchy, and meaning of the template headings, but translate them to the selected language. 
- All body text, paragraphs, and the actual FAQ questions (inside FAQs section) MUST be in ${contentLang}.
- Strain names in English
- "Blimburn Seeds" stays in English
- No h4/h5/h6 — use <p><strong>Label:</strong> content</p> instead
- CRITICAL: Article MUST ABSOLUTELY exceed 1500 words through deep technical elaboration. If it is shorter, it is a FAILURE. Always expand on the biological "how" and "why".`;
  }

  // ============================================================
  // SEO SCORING
  // ============================================================
  function calculateSEOScore(htmlContent, keyword) {
    const text = stripHtml(htmlContent).toLowerCase();
    const kwLower = keyword.toLowerCase();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const checks = [
      {
        label: 'Keyword en H1',
        desc: 'La keyword principal aparece en el H1',
        pass: /<h1[^>]*>[^<]*keyword[^<]*<\/h1>/i.test(htmlContent.toLowerCase().replace(/keyword/gi, kwLower)) ||
          htmlContent.toLowerCase().includes(`<h1`) && text.includes(kwLower),
      },
      {
        label: 'Keyword primeras 100 palabras',
        desc: 'Keyword en el primer párrafo de apertura',
        pass: text.split(/\s+/).slice(0, 100).join(' ').includes(kwLower),
      },
      {
        label: 'Densidad keyword (0.5%-1.5%)',
        desc: 'Frecuencia de keyword dentro del rango óptimo',
        pass: (() => {
          const count = (text.match(new RegExp(kwLower.replace(/[-]/g, '[-]'), 'g')) || []).length;
          const density = wordCount > 0 ? (count / wordCount) * 100 : 0;
          return density >= 0.5 && density <= 1.5;
        })(),
      },
      {
        label: 'Estructura H1+H2 presente',
        desc: 'Jerarquía de encabezados correcta',
        pass: /<h1/i.test(htmlContent) && /<h2/i.test(htmlContent),
      },
      {
        label: 'Sección FAQ incluida',
        desc: 'Mínimo 5 preguntas con respuestas autónomas',
        pass: (htmlContent.match(/<h3/gi) || []).length >= 5 || /<h2[^>]*>[^<]*(FAQ|preguntas|fragen|questions)[^<]*<\/h2>/i.test(htmlContent),
      },
      {
        label: 'Párrafo de apertura (<120 palabras)',
        desc: 'Quick Summary Box o párrafo de apertura presente',
        pass: /border-left.*2e7d32|border-left.*#2e7d32/i.test(htmlContent) || /<div[^>]*style[^>]*border-left/i.test(htmlContent),
      },
      {
        label: 'Tabla comparativa incluida',
        desc: 'Al menos una tabla estructurada con ≥6 filas',
        pass: /<table/i.test(htmlContent),
      },
      {
        label: 'Longitud óptima (>1500 palabras)',
        desc: `${wordCount} palabras en el texto`,
        pass: wordCount >= 1450, // Pequeño margen
      },
      {
        label: 'Meta Title presente',
        desc: 'Meta title incluido en el output',
        pass: /<!-- META-TITLE:/i.test(htmlContent),
      },
      {
        label: 'Datos estructurados (JSON-LD)',
        desc: 'Script de Schema.org Article/FAQ incluido',
        pass: /<script[^>]*application\/ld\+json/i.test(htmlContent),
      },
      {
        label: 'Datos técnicos (PPFD / NPK / terpenos)',
        desc: 'Rigor técnico: valores numéricos o terpenos específicos',
        pass: /µmol|ppfd|dli|npk|n:p:k|myrcen|limonene|caryophyllene|linalool|terpene|terpeno|terpen/i.test(htmlContent),
      },
    ];

    const passed = checks.filter(c => c.pass).length;
    const score = Math.round((passed / checks.length) * 100);

    let aiProbability = 'BAJA';
    let aiClass = 'low';
    const aiScore = [checks[5].pass, checks[6].pass, checks[4].pass, checks[9].pass,
    /<h2[^>]*>[^<]+(\?|how|why|qué|cómo|was|warum|pourquoi|comment)/i.test(htmlContent)].filter(Boolean).length;
    if (aiScore >= 4) { aiProbability = 'ALTA'; aiClass = 'high'; }
    else if (aiScore >= 2) { aiProbability = 'MEDIA'; aiClass = 'medium'; }

    return { score, checks, aiProbability, aiClass, wordCount };
  }

  // ============================================================
  // RENDER OUTPUTS
  // ============================================================
  function renderSerpData(serp) {
    const pos = serp.position ? `#${serp.position}` : 'No top 10';
    const posColor = serp.position && serp.position <= 3 ? '#2e7d32' : serp.position && serp.position <= 10 ? '#e08c00' : '#CC3300';

    let html = `
      <div class="serp-section">
        <div class="serp-section__title">📊 Resumen SERP — ${serp.market.google_domain} — "${serp.keyword}"</div>
        <div class="serp-stat-grid">
          <div class="serp-stat">
            <div class="serp-stat__val" style="color:${posColor}">${pos}</div>
            <div class="serp-stat__label">Posición Blimburn</div>
          </div>
          <div class="serp-stat">
            <div class="serp-stat__val">${serp.paaQuestions.length}</div>
            <div class="serp-stat__label">PAA Questions</div>
          </div>
          <div class="serp-stat">
            <div class="serp-stat__val" style="color:${serp.aiOverview ? '#2e7d32' : '#888'}">${serp.aiOverview ? 'Sí' : 'No'}</div>
            <div class="serp-stat__label">AI Overview</div>
          </div>
        </div>
      </div>`;

    if (serp.featuredSnippet) {
      html += `
      <div class="serp-section">
        <div class="serp-section__title">⭐ Featured Snippet (${serp.featuredSnippet.type})</div>
        <div class="serp-snippet">
          <div class="serp-snippet__url">${serp.featuredSnippet.link}</div>
          ${serp.featuredSnippet.snippet || serp.featuredSnippet.title}
        </div>
      </div>`;
    }

    if (serp.aiOverview) {
      // Extraer el primer párrafo del AI Overview (el párrafo clave para la estrategia mirror)
      const fullText = serp.aiOverview.text;
      const firstParagraphEnd = fullText.indexOf('\n');
      const cutPoint = firstParagraphEnd > 0 ? firstParagraphEnd : fullText.length;
      const firstParagraph = fullText.slice(0, cutPoint).trim();
      const restText = fullText.slice(cutPoint).trim();

      html += `
      <div class="serp-section">
        <div class="serp-section__title">🤖 AI Overview Detectado — Estrategia Mirror</div>
        <div class="serp-ai-overview">
          <div class="serp-ai-overview__tag">✦ Primer párrafo (base para tu apertura optimizada)</div>
          <div style="background:#fff8e7;border:1px solid #f5c842;border-radius:6px;padding:12px 16px;margin:10px 0;font-size:0.85rem;line-height:1.6;color:#333;">
            <strong style="display:block;font-size:0.7rem;color:#e08c00;letter-spacing:0.05em;margin-bottom:6px;">📋 MIRROR ESTE PÁRRAFO — Adapta su estructura semántica (sinónimos + mejores datos)</strong>
            ${firstParagraph}
          </div>
          ${restText ? `<p style="font-size:0.8rem;color:#555;margin-top:8px;">${restText.slice(0, 400)}${restText.length > 400 ? '…' : ''}</p>` : ''}
          ${serp.aiOverview.sources.length ? `<p style="font-size:0.72rem;color:#888;margin-top:8px;">Fuentes citadas: ${serp.aiOverview.sources.map(s => s.title || s.link || '').slice(0, 3).join(', ')}</p>` : ''}
        </div>
      </div>`;
    }

    if (serp.paaQuestions.length) {
      html += `
      <div class="serp-section">
        <div class="serp-section__title">❓ People Also Ask (${serp.paaQuestions.length} preguntas)</div>
        <div class="serp-paa-list">
          ${serp.paaQuestions.map(q => `<div class="serp-paa-item">${q.question}</div>`).join('')}
        </div>
      </div>`;
    }

    if (serp.top10.length) {
      html += `
      <div class="serp-section">
        <div class="serp-section__title">🏆 Top 10 Orgánico</div>
        ${serp.top10.map(r => `
          <div style="padding:8px 0;border-bottom:1px solid #ebebeb;font-size:0.82rem;">
            <div style="font-weight:600;color:#395536;">#${r.position} — ${r.title}</div>
            <div style="color:#888;font-size:0.75rem;margin-top:2px;">${r.link}</div>
          </div>`).join('')}
      </div>`;
    }

    if (serp.relatedSearches.length) {
      html += `
      <div class="serp-section">
        <div class="serp-section__title">🔍 Búsquedas Relacionadas</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${serp.relatedSearches.slice(0, 10).map(q => `<span style="background:#ebf0e2;padding:4px 10px;border-radius:4px;font-size:0.75rem;color:#395536;font-weight:600;">${q}</span>`).join('')}
        </div>
      </div>`;
    }

    $outputSerp.innerHTML = `<div class="serp-container">${html}</div>`;
  }

  function renderScore(scoreData) {
    const scoreClass = scoreData.score >= 70 ? 'high' : scoreData.score >= 50 ? 'medium' : 'low';
    let html = `
      <div class="score-hero">
        <div class="score-dial ${scoreClass}">
          ${scoreData.score}
          <div class="score-dial__sub">/ 100</div>
        </div>
        <div class="score-hero__info">
          <div class="score-hero__title">Score SEO</div>
          <div style="font-size:0.82rem;color:#555;margin-bottom:10px;">${scoreData.wordCount} palabras · ${scoreData.checks.filter(c => c.pass).length}/${scoreData.checks.length} criterios cumplidos</div>
          <div class="score-hero__ai ${scoreData.aiClass}">
            ✦ Probabilidad AI Overview: ${scoreData.aiProbability}
          </div>
        </div>
      </div>
      <div class="score-criteria">
        <div class="score-criteria__title">Desglose de Criterios</div>
        ${scoreData.checks.map(c => `
          <div class="score-row">
            <div class="score-row__label">${c.label}</div>
            <div class="score-row__val ${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✗'}</div>
            <div class="score-row__bar-wrap">
              <div class="score-row__bar">
                <div class="score-row__fill ${c.pass ? '' : 'fail'}" style="width:${c.pass ? 100 : 0}%"></div>
              </div>
            </div>
          </div>
          <div style="font-size:0.72rem;color:#888;margin-bottom:4px;padding-left:0;">${c.desc}</div>`).join('')}
      </div>`;
    $outputScore.innerHTML = html;
  }

  function renderChecklist(htmlContent) {
    const seoItems = [
      { label: 'Quick Summary Box', detail: 'Primer elemento con respuesta directa en <50 palabras', pass: /border-left.*2e7d32/i.test(htmlContent) || /<div[^>]*style[^>]*border-left/i.test(htmlContent) },
      { label: 'H1 único con keyword principal', detail: 'Un solo H1 que contiene la keyword en forma natural', pass: (htmlContent.match(/<h1/gi) || []).length === 1 },
      { label: 'H2 temáticos presentes', detail: 'Al menos 3 H2 que cubren subtemas completos', pass: (htmlContent.match(/<h2/gi) || []).length >= 3 },
      { label: 'H3 para detalles y long-tails', detail: 'H3 para FAQ y subtemas específicos', pass: (htmlContent.match(/<h3/gi) || []).length >= 3 },
      { label: 'Tabla comparativa técnica', detail: 'Tabla con ≥3 columnas y ≥6 filas, con headers de fondo oscuro', pass: /<table/i.test(htmlContent) && /<th/i.test(htmlContent) },
      { label: 'Sección de Professional Tips', detail: 'Lista bullet con ≥5 tips de experto con datos concretos', pass: (htmlContent.match(/<li/gi) || []).length >= 5 },
      { label: 'FAQ con ≥5 preguntas', detail: 'Respuestas autónomas de 40-80 palabras, sin referencias internas', pass: (htmlContent.match(/<h3/gi) || []).length >= 5 },
      { label: 'Meta Title en output', detail: '50-60 caracteres con keyword al inicio', pass: /<!-- META-TITLE:/i.test(htmlContent) },
      { label: 'Meta Description en output', detail: '150-160 caracteres con CTA y diferenciador', pass: /<!-- META-DESC:/i.test(htmlContent) },
      { label: 'Datos PPFD/NPK/terpenos', detail: 'Información técnica con valores numéricos o compuestos específicos', pass: /µmol|ppfd|dli|n:p:k|npk|myrcen|limonene|linalool|caryophyllene|entourage/i.test(htmlContent) },
    ];

    const aiItems = [
      { label: 'Párrafo de apertura autónomo', detail: 'Responde la query principal en ≤3 frases sin contexto previo', pass: /border-left.*2e7d32/i.test(htmlContent) || htmlContent.indexOf('<p>') < 500 },
      { label: 'Definición explícita presente', detail: 'Patrón "X es / X se define como" detectable por IA', pass: /\bes\s+una?\s+variet|\bes\s+el\s+|is\s+a\s+|sind\s+|est\s+une?\s+/i.test(htmlContent) },
      { label: 'Lista numerada o bullets claros', detail: '≥4 elementos en lista que resumen información clave', pass: (htmlContent.match(/<li/gi) || []).length >= 4 },
      { label: 'Tabla con headers explícitos', detail: 'Headers (<th>) con etiquetas claras', pass: /<th/i.test(htmlContent) },
      { label: 'H2/H3 comprensibles sin contexto', detail: 'Encabezados formulados como mini-búsquedas independientes', pass: (htmlContent.match(/<h[23]/gi) || []).length >= 4 },
      { label: 'Sin referencias internas', detail: 'Sin "como vimos", "anteriormente", "como mencionamos"', pass: !/como vimos|anteriormente|como mencionamos|wie bereits|comme mentionné|as mentioned|as we saw/i.test(htmlContent) },
      { label: 'Datos numéricos verificables', detail: 'Porcentajes, días, estadísticas, valores PPFD/NPK presentes', pass: /\d+[-–]\d+\s*(µmol|días?|weeks?|weeks?|%|cm|g\/m²)|\d+:\d+:\d+/i.test(htmlContent) },
      { label: 'Contenido en idioma correcto del mercado', detail: `Todo el contenido en ${selectedMarket.contentLang}`, pass: true }, // validated by prompt
    ];

    const renderGroup = (title, items) => `
      <div class="checklist-section">
        <div class="checklist-section__title">${title}</div>
        <div class="checklist-items">
          ${items.map(item => `
            <div class="checklist-item">
              <div class="checklist-item__icon ${item.pass ? 'pass' : 'fail'}">${item.pass ? '✓' : '✗'}</div>
              <div class="checklist-item__text">
                <strong>${item.label}</strong>
                <span>${item.detail}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    const seoPass = seoItems.filter(i => i.pass).length;
    const aiPass = aiItems.filter(i => i.pass).length;

    $outputChecklist.innerHTML = `
      <div class="checklist-container">
        <div style="display:flex;gap:16px;margin-bottom:20px;">
          <div style="background:#ebf0e2;border-radius:8px;padding:12px 20px;flex:1;text-align:center;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:1.5rem;color:#1b5e20;">${seoPass}/${seoItems.length}</div>
            <div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#395536;">SEO On-Page</div>
          </div>
          <div style="background:#ebf0e2;border-radius:8px;padding:12px 20px;flex:1;text-align:center;">
            <div style="font-family:'Archivo Black',sans-serif;font-size:1.5rem;color:#1b5e20;">${aiPass}/${aiItems.length}</div>
            <div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#395536;">AI Overview</div>
          </div>
        </div>
        ${renderGroup('✅ Checklist SEO On-Page', seoItems)}
        ${renderGroup('🤖 Checklist AI Overview', aiItems)}
      </div>`;
  }

  // ============================================================
  // AUDITORÍA LOCAL CON LM STUDIO (Gemma 4) — Fase 5
  // ============================================================
  async function callLocalAuditor(htmlDraft, originalHtml, keyword) {
    try {
      const draftText = stripHtml(htmlDraft);
      const originalText = stripHtml(originalHtml || '');
      const userMsg = `Eres un estricto Auditor SEO experto en la industria del Cannabis. Tu análisis debe ser profesional y directo.
Compara el 'Texto Original' con el 'Texto Optimizado' para la keyword: "${keyword}".
Responde en MÁXIMO 50 palabras:
1. ¿El Texto Optimizado es cualitativamente superior y mejor estructurado para SEO que el original?
2. ¿Suena natural y mantiene la coherencia sin alucinar o inventar datos?
3. (Nota: Si se varió el orden de las palabras clave para que suenen orgánicas, considéralo un gran acierto).

--- TEXTO ORIGINAL ---
${originalText.substring(0, 800)}

--- TEXTO OPTIMIZADO ---
${draftText.substring(0, 1000)}`;

      const auditUrl = window.location.origin + '/audit';
      console.log(`[Auditor] Solicitando auditoría a: ${auditUrl}`);

      const response = await fetch(auditUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemma-4-31b',
          messages: [
            { role: 'user', content: userMsg }
          ],
          temperature: 0.3,
          max_tokens: 4096
        }),
        signal: AbortSignal.timeout(300000),
      });

      if (!response.ok) {
        let errorMsg = 'Error en el servidor de auditoría';
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (e) {
          errorMsg = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const msg = data.choices[0].message;
        const answer = msg.content ? msg.content.trim() : "";

        let outputHtml = "";
        if (answer) {
          outputHtml += `<div>${answer}</div>`;
        }

        return outputHtml === ""
          ? "⚠️ (Error: LM Studio generó un output vacío)."
          : outputHtml;
      } else {
        return "El modelo respondió algo inesperado: " + JSON.stringify(data).substring(0, 200);
      }

    } catch (err) {
      console.error("[Auditor Proxy Error]", err);
      // Retornamos el error real para diagnóstico
      return `⚠️ ERROR DE AUDITORÍA: ${err.message}. 
              (Asegúrate de haber reiniciado el servidor y que LM Studio tenga el modelo cargado).`;
    }
  }

  // (extractMetaFromHtml already defined above)

  // ============================================================
  // MAIN OPTIMIZE PIPELINE (UNIFIED)
  // ============================================================
  
  async function handleOptimize() {
    if (isProcessing) return;
    if (!validateInputs()) return;

    hideApiError();
    setLoading($btnBrief, true);
    serpData = null;
    seoScore = null;
    lastHtmlOutput = '';

    const keyword = $inputKeyword.value.trim();
    const secondaryKws = $inputSecondaryKws.value.trim();
    const expertNotes = $inputExpert.value.trim();
    const cultivarProfile = $inputCultivarProfile.value.trim();
    const combinedExpertNotes = expertNotes + (cultivarProfile ? `\n\nCULTIVAR PROFILE (MUST USE THESE EXACT DATA FOR THE GROW GUIDE):\n${cultivarProfile}` : '');

    setPipelineStep(0);

    try {
      await loadLocalCatalog();

      setStatus(`Auditando SERP en ${selectedMarket.google_domain}…`, 10);
      let serp = null;
      try {
        serp = await runSerpAudit(keyword);
        serpData = serp;
        renderSerpData(serp);
      } catch (e) {
        console.warn('SerpAPI error:', e.message);
        $outputSerp.innerHTML = `<div class="serp-placeholder">⚠ No se pudo obtener datos del SERP: ${e.message}</div>`;
      }

      setPipelineStep(1);
      setStatus('Generando Estrategia y Brief SEO…', 25);
      const analysisPrompt = buildAnalysisPrompt('', keyword, secondaryKws, combinedExpertNotes, serp);
      const analysisOutput = await callAnalysisEngine(analysisPrompt);

      $outputBrief.innerHTML = `
        <div style="margin-bottom: 10px; color: #555; font-size: 0.9rem;">
            📝 <strong>Brief SEO Generado.</strong> Se está procediendo con la redacción automática...
        </div>
        <textarea id="brief-editor" style="width:100%; height: 500px; padding: 15px; border-radius: 8px; border: 1px solid #ccc; font-family: monospace; font-size: 0.85rem; line-height: 1.5; resize: vertical;">${analysisOutput}</textarea>
      `;
      selectOutputTab(document.querySelector('[data-tab="brief"]'));

      setPipelineStep(2);
      setStatus(`Redactando contenido optimizado en ${selectedMarket.langLabel}…`, 50);
      const contentSystemPrompt = `You are a senior SEO content writer for Blimburn Seeds, specializing in the ${selectedMarket.google_domain} market. All your output must be exclusively in ${selectedMarket.contentLang}. You write with the expertise of an elite SEO consultant combined with 10+ years of professional cannabis cultivation experience.
CRITICAL INSTRUCTION: When creating internal links to seed strains, you MUST ALWAYS use the official Blimburn domain for this specific market: "https://${selectedMarket.blimburn_domain}/". NEVER use google.com or any other domain for internal links. Example: https://${selectedMarket.blimburn_domain}/strain-name/
QUALITY RULE: Strictly avoid typical AI patterns and forbidden buzzwords in headers and meta-data. BE SPECIFIC and avoid generic intro/conclusion words.`;
      
      const contentUserPrompt = buildBriefAndContentPrompt(analysisOutput, '', keyword, secondaryKws, serp, combinedExpertNotes);
      const optimizedHtml = await callOpenAI(contentSystemPrompt, contentUserPrompt);

      setPipelineStep(3);
      setStatus('Realizando Auditoría Técnica y expandiendo contenido…', 75);
      let finalHtml = await callTechnicalAudit(optimizedHtml, keyword, secondaryKws);

      // --- LOCAL AUDIT SKIPPED BY DEFAULT ---
      const aiJudgment = null;

      setPipelineStep(4);
      setStatus('Procesando y evaluando resultado…', 95);

      // Clean and post-process
      // Remove any trailing markdown fencing (e.g. ```html or ```)
      let cleanedHtml = finalHtml.replace(/^```[a-z]*\s*\n/gi, '').replace(/\n```\s*$/g, '').replace(/```[a-z]*/gi, '');
      // Remove h4/h5/h6 — convert to <p><strong>
      cleanedHtml = cleanedHtml.replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gi, '<p><strong>$1:</strong></p>');
      // Clean excessive blank lines
      cleanedHtml = cleanedHtml.replace(/\n{3,}/g, '\n\n');

      lastHtmlOutput = cleanedHtml;

      // Extract meta and JSON-LD
      const { metaTitle, metaDesc, urlSlug, cleanHtml, jsonLd } = extractMetaFromHtml(cleanedHtml);

      // Render content
      let displayHtml = cleanHtml;

      // ============================================================
      // ✅ VERIFICACIÓN NIVEL 1: Escudo Anti-Copia Ciega
      // ============================================================
      if (secondaryKws) {
        // Normalizamos las keywords (separamos por comas o saltos de línea)
        const kws = secondaryKws.split(/[\n,]+/).map(k => k.trim().toLowerCase()).filter(Boolean);
        // Extraemos solo el texto legible (sin código HTML) en minúsculas
        const textLower = stripHtml(cleanedHtml).toLowerCase();

        // Una keyword pasa orgánicamente si TODAS sus palabras individuales existen en el texto (sin forzar orden)
        const missingKws = kws.filter(kw => {
          const words = kw.split(/\s+/).filter(Boolean);
          // Si ALGUNA palabra de este keyword no está en todo el texto, el keyword se marca como faltante.
          return words.some(word => !textLower.includes(word));
        });

        // Si falta AL MENOS UNA, mostramos un banner gigante de error
        if (missingKws.length > 0) {
          const alertHtml = `
            <div style="background-color:#ffebee;border:2px solid #ef5350;border-radius:6px;padding:16px;margin-bottom:24px;">
              <div style="color:#c62828;display:flex;align-items:center;gap:8px;font-size:1.1rem;font-weight:bold;margin-bottom:12px;">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                ⚠️ ALERTA DE CALIDAD: Faltan Palabras Clave Secundarias
              </div>
              <div style="color:#b71c1c;font-size:0.95rem;margin-bottom:8px;">La IA (OpenAI) olvidó o no logró integrar las siguientes frases exactas que requieres. Aún puedes copiar el texto, pero se recomienda revisarlo manualmente o regenerar:</div>
              <ul style="color:#b71c1c;margin:0;padding-left:24px;font-weight:600;font-size:0.95rem;">
                ${missingKws.map(kw => `<li>"${kw}"</li>`).join('')}
              </ul>
            </div>
          `;
          // Lo añadimos por arriba del contenido.
          displayHtml = alertHtml + displayHtml;
        }
      }

      // ============================================================
      // ✅ VERIFICACIÓN NIVEL 1B: Detector de Bancos de Semillas Competidores
      // ============================================================
      const COMPETITOR_SEED_BANKS = [
        'Dutch Passion', 'Royal Queen Seeds', "Barney's Farm", 'Barneys Farm', 'Sensi Seeds',
        'Fast Buds', 'FastBuds', 'Sweet Seeds', 'Dinafem', 'Humboldt Seeds', 'ILGM',
        'I Love Growing Marijuana', 'Seedsman', 'Green House Seeds', 'Greenhouse Seeds',
        'Pyramid Seeds', 'Garden of Green', 'Zamnesia', 'Herbies', 'MSNL', 'Crop King Seeds',
        'Nirvana Seeds', 'Ministry of Cannabis', '00 Seeds', 'DNA Genetics', 'Exotic Seed',
        'Paradise Seeds', 'Serious Seeds', 'Mr. Nice', 'TH Seeds', 'Bomb Seeds'
      ];
      {
        const textLower = stripHtml(cleanedHtml).toLowerCase();
        const foundCompetitors = COMPETITOR_SEED_BANKS.filter(brand => textLower.includes(brand.toLowerCase()));
        // Quitar duplicados conceptuales (p.ej. Barney's Farm / Barneys Farm) por su forma normalizada
        const uniqueFound = [...new Set(foundCompetitors.map(b => b.replace(/['’]/g, '').toLowerCase()))]
          .map(norm => foundCompetitors.find(b => b.replace(/['’]/g, '').toLowerCase() === norm));

        if (uniqueFound.length > 0) {
          const alertHtml = `
            <div style="background-color:#fff3e0;border:2px solid #ff9800;border-radius:6px;padding:16px;margin-bottom:24px;">
              <div style="color:#e65100;display:flex;align-items:center;gap:8px;font-size:1.1rem;font-weight:bold;margin-bottom:12px;">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                ⚠️ ALERTA: Se detectaron Bancos de Semillas Competidores
              </div>
              <div style="color:#bf360c;font-size:0.95rem;margin-bottom:8px;">La IA mencionó marcas/bancos que NO son Blimburn Seeds. Revisa el texto y elimínalas o regenera el artículo:</div>
              <ul style="color:#bf360c;margin:0;padding-left:24px;font-weight:600;font-size:0.95rem;">
                ${uniqueFound.map(b => `<li>"${b}"</li>`).join('')}
              </ul>
            </div>
          `;
          displayHtml = alertHtml + displayHtml;
        }
      }

      // ✅ VERIFICACIÓN NIVEL 2: Veredicto del Auditor Local
      if (aiJudgment !== null && aiJudgment !== undefined) {
        // En caso de que Gemma devuelva literal texto vacío (suele pasar por bugs de prompt)
        const finalVerd = aiJudgment === "" ? "⚠️ (Error: LM Studio corrió exitosamente pero generó un output vacío. La configuración del modelo local puede estar corrompida o el prompt excedió el límite)." : aiJudgment;

        const auditorHtml = `
          <div style="background-color:#f0f8ff;border:2px solid #4fc3f7;border-radius:6px;padding:16px;margin-bottom:24px;">
            <div style="color:#1565c0;display:flex;align-items:center;gap:8px;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
              🤖 AUDITORÍA LOCAL (GEMMA)
            </div>
            <div style="color:#0d47a1;font-size:1rem;font-style:italic;">"${finalVerd}"</div>
            <div style="color:#1976d2;font-size:0.75rem;margin-top:8px;">(Revisión automática a costo $0 vía Ollama localhost)</div>
          </div>
        `;
        displayHtml = auditorHtml + displayHtml;
      }

      if (metaTitle || metaDesc || urlSlug) {
        displayHtml += `<hr style="border:none;border-top:1px solid #d4d4d4;margin:20px 0;">
          <p style="background:#f4f4f4;padding:12px;border-radius:6px;font-size:0.82rem;">
            <strong style="color:#395536;">URL Slug:</strong> /${urlSlug}<br>
            <strong style="color:#395536;">Meta Title:</strong> ${metaTitle}<br>
            <strong style="color:#395536;">Meta Description:</strong> ${metaDesc}
          </p>`;
      }
      
      if (jsonLd) {
          displayHtml += `
          <div style="background:#e8f5e9;padding:12px;border-radius:6px;margin-top:20px;">
            <h4 style="margin-top:0;color:#1b5e20;font-size:0.9rem;">JSON-LD (Datos Estructurados)</h4>
            <pre style="white-space:pre-wrap;font-size:0.75rem;color:#333;margin:0;">${escapeHtml(jsonLd)}</pre>
          </div>
          `;
          // Append to finalHtml so it gets copied
          finalHtml += `\n\n${jsonLd}`;
      }

      $outputContent.innerHTML = displayHtml;
      $outputContent.classList.add('has-content');
      $btnCopyHtml.disabled = false;
      $btnCopyGutenberg.disabled = false;
      $btnCopyText.disabled = false;

      // Score
      seoScore = calculateSEOScore(finalHtml, keyword);
      renderScore(seoScore);

      // Checklist
      renderChecklist(finalHtml);

      // Done
      setPipelineStep(-1);
      setStatus('✓ Optimización completada', 100);
      setTimeout(hideStatus, 3000);

      // Save to history
      saveToHistory(keyword, secondaryKws, seoScore, combinedExpertNotes);

      // Switch to content tab
      selectOutputTab(document.querySelector('[data-tab="content"]'));

    } catch (err) {
      console.error('Pipeline error:', err);
      setPipelineStep(-1);
      hideStatus();
      showApiError(`Error en el proceso: ${err.message}.`);
    } finally {
      setLoading($btnBrief, false);
    }
  }

  // ============================================================
  // RESET
  // ============================================================
  function handleReset() {
    $inputKeyword.value = '';
    $inputSecondaryKws.value = '';
    $inputExpert.value = '';
    $inputCultivarProfile.value = '';
    lastHtmlOutput = '';
    serpData = null;
    seoScore = null;
    $outputContent.innerHTML = `<div class="output-placeholder"><svg viewBox="0 0 48 48" fill="none" width="48" height="48"><path d="M8 40V8h16l8 8v24H8z" stroke="#D4D4D4" stroke-width="2" stroke-linejoin="round"/><path d="M24 8v8h8" stroke="#D4D4D4" stroke-width="2" stroke-linejoin="round"/><path d="M14 20h12M14 26h16M14 32h10" stroke="#D4D4D4" stroke-width="2" stroke-linecap="round"/></svg><p>El contenido optimizado aparecerá aquí.</p><p class="output-placeholder__sub">Configura tus API Keys (⚙) e introduce los datos del contenido para comenzar.</p></div>`;
    $outputScore.innerHTML = '<div class="score-placeholder"><p>El score SEO se calculará tras la optimización.</p></div>';
    $outputSerp.innerHTML = '<div class="serp-placeholder"><p>Los datos del SERP aparecerán aquí tras la auditoría SerpAPI.</p></div>';
    $outputBrief.innerHTML = '<div class="output-placeholder"><p>Genera el Brief SEO en el Paso 1. Luego podrás revisarlo antes de redactar el artículo final.</p></div>';
    $outputChecklist.innerHTML = '<div class="checklist-placeholder"><p>El checklist de calidad se generará tras la optimización.</p></div>';
    $btnBrief.disabled = false;
    $btnCopyHtml.disabled = true;
    $btnCopyGutenberg.disabled = true;
    $btnCopyText.disabled = true;
    $outputContent.classList.remove('has-content');
    hideApiError();
    hideStatus();
    setPipelineStep(-1);
    $pipelineSteps.forEach(s => { s.classList.remove('pipeline__step--active', 'pipeline__step--done'); });
    $pipelineConnectors.forEach(c => c.classList.remove('pipeline__connector--done'));
    updateWordCount();
    $inputKeyword.focus();
  }

  // ============================================================
  // CLIPBOARD
  // ============================================================

  // Gutenberg: envoltura en bloque HTML nativo de WordPress
  async function copyForGutenberg() {
    // Eliminar schema JSON-LD del output si existiera
    const htmlClean = lastHtmlOutput
      .replace(/<script\s+type="application\/ld\+json"[\s\S]*?<\/script>/gi, '')
      .replace(/<!--\s*META-TITLE:.*?-->/gi, '')
      .replace(/<!--\s*META-DESC:.*?-->/gi, '')
      .trim();

    // WordPress Gutenberg Custom HTML block format
    const gutenbergBlock = `<!-- wp:html -->\n${htmlClean}\n<!-- /wp:html -->`;

    try {
      await navigator.clipboard.writeText(gutenbergBlock);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = gutenbergBlock;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const origHtml = $btnCopyGutenberg.innerHTML;
    $btnCopyGutenberg.classList.add('btn--copied');
    $btnCopyGutenberg.innerHTML = $btnCopyGutenberg.innerHTML.replace(/GUTENBERG/i, '¡COPIADO!');
    setTimeout(() => { $btnCopyGutenberg.innerHTML = origHtml; $btnCopyGutenberg.classList.remove('btn--copied'); }, 1800);
  }

  async function copyToClipboard(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const origHtml = btn.innerHTML;
    btn.classList.add('btn--copied');
    btn.innerHTML = btn.innerHTML.replace(/COPIAR.*/i, '¡COPIADO!');
    setTimeout(() => { btn.innerHTML = origHtml; btn.classList.remove('btn--copied'); }, 1800);
  }

  // ============================================================
  // HISTORY — Guardado, renderizado y exportación
  // ============================================================
  const HISTORY_KEY = 'bbo_history';
  const MAX_HISTORY = 200;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
  }

  function saveToHistory(keyword, secondaryKws, scoreData, expertNotes) {
    const history = loadHistory();
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      keyword: keyword || '',
      market: selectedMarket.google_domain,
      lang: selectedMarket.lang,
      secondaryKws: secondaryKws || '',
      expertNotes: expertNotes || '',
      score: scoreData ? scoreData.score : null,
      wordCount: scoreData ? scoreData.wordCount : null,
      aiProbability: scoreData ? scoreData.aiProbability : null,
      serpPosition: serpData ? serpData.position : null,
      hasFeaturedSnippet: serpData ? !!serpData.featuredSnippet : false,
      hasAiOverview: serpData ? !!serpData.aiOverview : false,
      paaCount: serpData ? serpData.paaQuestions.length : 0,
    };
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  }

  function renderHistory() {
    const history = loadHistory();
    if (!history.length) {
      $outputHistory.innerHTML = `
        <div class="history-empty">
          <svg viewBox="0 0 48 48" fill="none" width="40" height="40"><path d="M8 40V8h16l8 8v24H8z" stroke="#D4D4D4" stroke-width="2" stroke-linejoin="round"/><path d="M24 8v8h8" stroke="#D4D4D4" stroke-width="2" stroke-linejoin="round"/></svg>
          <p>Ninguna optimización registrada aún.</p>
          <p class="history-empty__sub">Optimiza contenido para que aparezca aquí.</p>
        </div>`;
      return;
    }

    const tableRows = history.map((e, idx) => {
      const d = new Date(e.date);
      const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const scoreClass = e.score >= 70 ? 'history-score--high' : e.score >= 50 ? 'history-score--medium' : 'history-score--low';
      const posLabel = e.serpPosition ? `#${e.serpPosition}` : '—';
      const aiOv = e.hasAiOverview ? '✓' : '—';
      const fs = e.hasFeaturedSnippet ? '✓' : '—';
      const aiPr = e.aiProbability || '—';
      return `
        <tr class="history-row" data-id="${e.id}">
          <td class="history-cell history-cell--num">${history.length - idx}</td>
          <td class="history-cell">
            <div class="history-kw">${escapeHtml(e.keyword)}</div>
            ${e.secondaryKws ? `<div class="history-kw-secondary">${escapeHtml(e.secondaryKws.split(/[\n,]+/).slice(0,3).join(', '))}${e.secondaryKws.split(/[\n,]+/).length > 3 ? '…' : ''}</div>` : ''}
          </td>
          <td class="history-cell">
            <span class="history-market-badge">${e.market}</span>
          </td>
          <td class="history-cell">
            <span class="history-score ${scoreClass}">${e.score !== null ? e.score : '—'}</span>
          </td>
          <td class="history-cell">${e.wordCount ? e.wordCount.toLocaleString('es-ES') : '—'}</td>
          <td class="history-cell">${posLabel}</td>
          <td class="history-cell history-cell--center">${fs}</td>
          <td class="history-cell history-cell--center">${aiOv}</td>
          <td class="history-cell history-cell--center">${e.paaCount || '—'}</td>
          <td class="history-cell history-cell--center"><span class="history-ai-prob history-ai-prob--${(aiPr).toLowerCase()}">${aiPr}</span></td>
          <td class="history-cell history-cell--date">${dateStr}<br><span class="history-time">${timeStr}</span></td>
          <td class="history-cell">
            <button class="history-del-btn" data-id="${e.id}" title="Eliminar entrada">✕</button>
          </td>
        </tr>`;
    }).join('');

    $outputHistory.innerHTML = `
      <div class="history-toolbar">
        <div class="history-toolbar__info">
          <span class="history-count">${history.length} optimizacion${history.length !== 1 ? 'es' : ''}</span>
        </div>
        <div class="history-toolbar__actions">
          <button id="btn-export-csv" class="btn btn--history-export">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M13 8V2H7v6H4l6 6 6-6h-3zm-7 8v2h8v-2H6z"/></svg>
            EXPORTAR CSV (EXCEL)
          </button>
          <button id="btn-clear-history" class="btn btn--history-clear">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            LIMPIAR
          </button>
        </div>
      </div>
      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th class="history-th history-th--num">#</th>
              <th class="history-th">Keyword</th>
              <th class="history-th">Mercado</th>
              <th class="history-th">Score</th>
              <th class="history-th">Palabras</th>
              <th class="history-th">Pos. SERP</th>
              <th class="history-th history-th--center">F.Snippet</th>
              <th class="history-th history-th--center">AI Overv.</th>
              <th class="history-th history-th--center">PAA</th>
              <th class="history-th history-th--center">Prob. AI</th>
              <th class="history-th">Fecha</th>
              <th class="history-th"></th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>`;

    document.getElementById('btn-export-csv').addEventListener('click', exportHistoryToCSV);
    document.getElementById('btn-clear-history').addEventListener('click', () => {
      if (confirm('¿Borrar todo el historial? Esta acción no se puede deshacer.')) {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
      }
    });
    $outputHistory.querySelectorAll('.history-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const h = loadHistory().filter(e => e.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
        renderHistory();
      });
    });
  }

  function exportHistoryToCSV() {
    const history = loadHistory();
    if (!history.length) return;

    const headers = [
      'Nº', 'Fecha', 'Hora', 'Keyword', 'Mercado', 'Idioma',
      'Score SEO', 'Palabras', 'Posicion SERP', 'Featured Snippet',
      'AI Overview', 'PAA (Preguntas)', 'Prob. AI Overview',
      'Keywords Secundarias', 'Notas Experto'
    ];

    const rows = history.map((e, idx) => {
      const d = new Date(e.date);
      const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
      const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      return [
        history.length - idx,
        dateStr,
        timeStr,
        e.keyword,
        e.market,
        e.lang ? e.lang.toUpperCase() : '',
        e.score !== null ? e.score : '',
        e.wordCount || '',
        e.serpPosition || '',
        e.hasFeaturedSnippet ? 'Sí' : 'No',
        e.hasAiOverview ? 'Sí' : 'No',
        e.paaCount || 0,
        e.aiProbability || '',
        (e.secondaryKws || '').replace(/\n/g, ' | '),
        (e.expertNotes || '').replace(/\n/g, ' | '),
      ];
    });

    // BOM para que Excel reconozca UTF-8 correctamente
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers, ...rows]
      .map(row => row.map(cell => {
        const val = String(cell ?? '');
        // Escapar comillas dobles y envolver en comillas si contiene coma, salto de línea o comillas
        if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes(';')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `blimburn-seo-historial-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stripHtml(html) {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el.textContent || el.innerText || '';
  }

  // ============================================================
  // BOOT
  // ============================================================
  document.addEventListener('DOMContentLoaded', init);
})();
