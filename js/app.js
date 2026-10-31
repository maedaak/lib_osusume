/**
 * libオススメ - Modern Static Web Application
 * CiNii Research API & NDL Search Integration
 */

(function () {
  'use strict';

  // Constants & Storage Keys
  const STORAGE_KEY_CINII_PROXY = 'lib_osusume_cinii_proxy';
  const STORAGE_KEY_NDL_PROXY = 'lib_osusume_ndl_proxy';
  const DEFAULT_CINII_PROXY = 'https://github.com/maedaak/lib_osusume';
  const MAX_INPUT_CHARS = 1000;

  // Sample ISBN list
  const SAMPLE_ISBNS = [
    '978-4-480-06618-3',
    '978-4-15-209236-6',
    '978-4-7980-3085-2',
    '978-4-06-257736-6',
    '978-4-8204-1104-8',
    '978-4-12-004294-2',
    '978-4-8169-2343-2',
    '978-4-309-02067-9',
    '978-4-08-771424-1',
    '978-4-00-431336-6'
  ];

  // DOM Elements
  const isbnInput = document.getElementById('isbnInput');
  const charCounter = document.getElementById('charCounter');
  const btnNext = document.getElementById('btnNext');
  const btnClear = document.getElementById('btnClear');
  const btnLoadSample = document.getElementById('btnLoadSample');
  const currentIsbnBadge = document.getElementById('currentIsbnBadge');
  const processingBanner = document.getElementById('processingBanner');
  const ciniiLimitSelect = document.getElementById('ciniiLimitSelect');
  const pubLimitSelect = document.getElementById('pubLimitSelect');
  const ciniiProxyInput = document.getElementById('ciniiProxyInput');
  const ndlProxyInput = document.getElementById('ndlProxyInput');
  const btnResetProxy = document.getElementById('btnResetProxy');
  const resultsContainer = document.getElementById('resultsContainer');
  const sampleChipsContainer = document.getElementById('sampleChipsContainer');

  // ==========================================================
  // 1. JavaScript Injection Prevention & Sanitization
  // ==========================================================

  /**
   * Input Sanitization for JavaScript Injection prevention
   * Targets specified characters: \, ', ", //, \n/, \r, \t
   * Also ensures input length is bounded by MAX_INPUT_CHARS.
   */
  function sanitizeInput(raw) {
    if (typeof raw !== 'string') return '';
    let val = raw;

    // Enforce 1000 characters limit
    if (val.length > MAX_INPUT_CHARS) {
      val = val.substring(0, MAX_INPUT_CHARS);
    }

    // Escape and clean special injection characters:
    // 1. \r (carriage return) -> remove
    // 2. \t (tab) -> convert to space
    // 3. \n/ -> \n\/
    // 4. // -> \/\/
    // 5. \ -> \\
    // 6. ' -> \'
    // 7. " -> \"
    return val
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\/\//g, '\\/\\/')
      .replace(/\n\//g, '\\n\\/');
  }

  /**
   * Comprehensive HTML entity escape for safe DOM rendering
   */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\\/g, '&#92;')
      .replace(/\/\//g, '&#47;&#47;')
      .replace(/\n\//g, '&#10;&#47;')
      .replace(/\r/g, '')
      .replace(/\t/g, '&#9;');
  }

  /**
   * Escape for JavaScript context / attributes
   */
  function escapeJS(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\/\//g, '\\/\\/')
      .replace(/\//g, '\\/');
  }

  // ==========================================================
  // 2. ISBN Normalization & Validation
  // ==========================================================

  /**
   * Normalize an ISBN string: full-width to half-width, strip hyphens/spaces
   */
  function normalizeIsbn(raw) {
    if (!raw) return '';
    return raw
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[\s\-\―ー]/g, '')
      .trim();
  }

  /**
   * Check if ISBN has valid check digit (ISBN-10 or ISBN-13)
   */
  function isValidISBN(isbn) {
    if (!/^(?:\d{9}[\dX]|\d{13})$/i.test(isbn)) {
      return false;
    }
    if (isbn.length === 10) {
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(isbn[i], 10) * (10 - i);
      }
      const lastChar = isbn[9].toUpperCase();
      const check = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
      sum += check;
      return sum % 11 === 0;
    } else if (isbn.length === 13) {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(isbn[i], 10) * (i % 2 === 0 ? 1 : 3);
      }
      const check = (10 - (sum % 10)) % 10;
      return check === parseInt(isbn[12], 10);
    }
    return false;
  }

  // ==========================================================
  // 3. API Integrations
  // ==========================================================

  /**
   * Fetch book information from CiNii Research via Proxy
   * Proxy URL: http://127.0.0.1:8787/?isbn=... (allowed param is only isbn=)
   */
  async function fetchCiNiiResearch(isbn, proxyUrl) {
    const cleanIsbn = normalizeIsbn(isbn);
    const baseUrl = (proxyUrl || DEFAULT_CINII_PROXY).replace(/\/+$/, '');
    const requestUrl = `${baseUrl}/?isbn=${encodeURIComponent(cleanIsbn)}`;
    let res;
    try {
      res = await fetch(requestUrl);
    } catch (netErr) {
      if (netErr.name === 'TypeError' && netErr.message.includes('fetch')) {
        throw new Error(
          `プロキシサーバー (${baseUrl}) に接続できませんでした。\n` +
          `【考えられる原因と対策】\n` +
          `1. プロキシのCORS設定: 現在のOrigin (${window.location.origin}) がプロキシの Access-Control-Allow-Origin で許可されていない可能性があります。\n` +
          `2. プロキシ未起動: ポート 8787 で wrangler dev が起動しているかご確認ください。`
        );
      }
      throw netErr;
    }

    if (!res.ok) {
      throw new Error(`CiNii Research API プロキシ通信エラー (HTTPステータス: ${res.status})`);
    }

    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    const title = item.title || 'タイトル情報なし';
    const authors = Array.isArray(item['dc:creator'])
      ? item['dc:creator'].join(', ')
      : (item['dc:creator'] || '著者情報なし');
    const publisher = item['dc:publisher'] || '出版者情報なし';
    const pubDate = item['prism:publicationDate'] || '';
    const cirLink = item.link?.['@id'] || item['@id'] || `https://cir.nii.ac.jp/all?q=${encodeURIComponent(cleanIsbn)}`;

    // NCID search
    let ncid = null;
    if (Array.isArray(item['dc:identifier'])) {
      const ncidItem = item['dc:identifier'].find(id => id['@type'] === 'cir:NCID');
      if (ncidItem) {
        ncid = ncidItem['@value'];
      }
    }

    // Try fetching ownerCount from ci.nii.ac.jp NCID JSON (CORS allowed: *)
    let ownerCount = null;
    let ciniiBooksUrl = null;
    if (ncid) {
      ciniiBooksUrl = `https://ci.nii.ac.jp/ncid/${ncid}`;
      try {
        const ncidRes = await fetch(`https://ci.nii.ac.jp/ncid/${ncid}.json`);
        if (ncidRes.ok) {
          const ncidData = await ncidRes.json();
          const graph = ncidData['@graph'] || [];
          for (const node of graph) {
            if (node['cinii:ownerCount'] !== undefined) {
              ownerCount = parseInt(node['cinii:ownerCount'], 10);
              break;
            }
          }
        }
      } catch (err) {
        console.warn('NCIDからの所蔵館数取得に失敗しました (スキップ):', err);
      }
    }

    return {
      isbn: cleanIsbn,
      title,
      authors,
      publisher,
      pubDate,
      cirLink,
      ncid,
      ciniiBooksUrl,
      ownerCount
    };
  }

  /**
   * Fetch public library holdings from NDL Search API
   */
  async function fetchNDLSearch(isbn, ndlProxyUrl) {
    const cleanIsbn = normalizeIsbn(isbn);
    const sruTarget = `https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&dpid=R100000001&maximumRecords=5&mediatype=1&query=isbn=${cleanIsbn}`;
    const requestUrl = ndlProxyUrl
      ? `${ndlProxyUrl.replace(/\/+$/, '')}?url=${encodeURIComponent(sruTarget)}`
      : sruTarget;

    try {
      const res = await fetch(requestUrl);
      if (!res.ok) {
        return {
          success: false,
          error: `国会図書館サーチ通信エラー (HTTP ${res.status})`
        };
      }
      const xmlText = await res.text();

      // Extract libraries using regex pattern matching the original MARC module logic
      const libraries = [];
      const lines = xmlText.split('\n');
      let inLibrarySection = false;

      for (const line of lines) {
        if (line.includes('lst name=&quot;LIBRARY&quot;') || line.includes('lst name="LIBRARY"')) {
          inLibrarySection = true;
        }
        if (inLibrarySection) {
          const match = line.match(/(?:&lt;|<)int name=(?:&quot;|")([^"&]+)(?:&quot;|")(?:&gt;|>)\d+/);
          if (match && match[1]) {
            libraries.push(match[1]);
          }
          if (line.includes('</lst>') || line.includes('&lt;/lst&gt;')) {
            inLibrarySection = false;
          }
        }
      }

      return {
        success: true,
        count: libraries.length,
        libraries: libraries
      };
    } catch (err) {
      return {
        success: false,
        error: 'CORS制限またはネットワークエラーのため、ブラウザから直接取得できませんでした。',
        isCors: true
      };
    }
  }

  // ==========================================================
  // 4. Evaluation Matrix Logic
  // ==========================================================

  /**
   * Determine matrix category
   * 1: 判定不可 (CiNii少 & 公共図少)
   * 2: 公共図書館オススメ (CiNii少 & 公共図多)
   * 3: 大学図書館オススメ (CiNii多 & 公共図少)
   * 4: 一般教養本 (CiNii多 & 公共図多)
   */
  function evaluateMatrix(ciniiCount, pubCount, ciniiLimit, pubLimit) {
    if (ciniiCount === null || pubCount === null) {
      return null;
    }
    const ciniiIsMany = ciniiCount >= ciniiLimit;
    const pubIsMany = pubCount >= pubLimit;

    if (!ciniiIsMany && !pubIsMany) return 1;
    if (!ciniiIsMany && pubIsMany) return 2;
    if (ciniiIsMany && !pubIsMany) return 3;
    if (ciniiIsMany && pubIsMany) return 4;
    return null;
  }

  // ==========================================================
  // 5. UI Rendering
  // ==========================================================

  function renderLoading(isbn) {
    const safeIsbn = escapeHTML(isbn);
    resultsContainer.innerHTML = `
      <div class="card">
        <div class="loading-box">
          <div class="spinner"></div>
          <div class="loading-text">ISBN: ${safeIsbn} を評価中...</div>
          <div class="loading-subtext">CiNii Research API および 国立国会図書館サーチへ問い合わせています</div>
        </div>
      </div>
    `;
  }

  function renderError(message, title = 'エラーが発生しました') {
    resultsContainer.innerHTML = `
      <div class="card">
        <div class="alert alert-danger">
          <div>
            <strong>${escapeHTML(title)}</strong>
            <p style="margin-top: 0.35rem; white-space: pre-wrap; line-height: 1.5;">${escapeHTML(message)}</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderResults(ciniiData, ndlData, ciniiLimit, pubLimit) {
    const hasCinii = !!ciniiData;
    const title = hasCinii ? ciniiData.title : 'タイトル不明';
    const authors = hasCinii ? ciniiData.authors : '著者不明';
    const publisher = hasCinii ? ciniiData.publisher : '出版者不明';
    const pubDate = hasCinii ? ciniiData.pubDate : '';
    const cirLink = hasCinii ? ciniiData.cirLink : '#';
    const ciniiOwnerCount = hasCinii ? ciniiData.ownerCount : null;

    const hasNdlCount = ndlData.success && typeof ndlData.count === 'number';
    const ndlCount = hasNdlCount ? ndlData.count : null;

    // Ratio
    let ratioText = 'ー';
    if (ciniiOwnerCount !== null && ndlCount !== null && ndlCount > 0) {
      ratioText = (ciniiOwnerCount / ndlCount).toFixed(2);
    }

    // Evaluation Matrix
    const matrixResult = evaluateMatrix(ciniiOwnerCount, ndlCount, ciniiLimit, pubLimit);

    let matrixHtml = '';
    if (ciniiOwnerCount !== null && ndlCount !== null) {
      matrixHtml = `
        <div class="matrix-container">
          <div class="matrix-title">所蔵数による2×2評価マトリクス</div>
          <table class="matrix-table" id="evaluationMatrixTable">
            <thead>
              <tr>
                <th class="matrix-header-cell">CiNii ＼ 公共図</th>
                <th>公共図所蔵 少 (&lt; ${escapeHTML(pubLimit)})</th>
                <th>公共図所蔵 多 (&ge; ${escapeHTML(pubLimit)})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="matrix-header-cell">CiNii所蔵 少 (&lt; ${escapeHTML(ciniiLimit)})</td>
                <td class="matrix-cell ${matrixResult === 1 ? 'highlight' : ''}" id="cell-1">判定不可</td>
                <td class="matrix-cell ${matrixResult === 2 ? 'highlight' : ''}" id="cell-2">公共図書館オススメ</td>
              </tr>
              <tr>
                <td class="matrix-header-cell">CiNii所蔵 多 (&ge; ${escapeHTML(ciniiLimit)})</td>
                <td class="matrix-cell ${matrixResult === 3 ? 'highlight' : ''}" id="cell-3">大学図書館オススメ</td>
                <td class="matrix-cell ${matrixResult === 4 ? 'highlight' : ''}" id="cell-4">一般教養本</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else if (ciniiOwnerCount !== null && ndlCount === null) {
      // Partial evaluation when NDL is blocked by CORS
      const ciniiMany = ciniiOwnerCount >= ciniiLimit;
      matrixHtml = `
        <div class="card" style="margin-top: 1rem; background: #fffbeb; border-color: #fde68a;">
          <div style="font-weight: 700; color: #92400e; margin-bottom: 0.5rem;">大学図書館(CiNii)所蔵数に基づく評価</div>
          <p style="color: #78350f; font-size: 0.9rem;">
            大学図書館所蔵館数: <strong>${escapeHTML(ciniiOwnerCount)}館</strong> (基準値: ${escapeHTML(ciniiLimit)}館)<br />
            判定: <strong>${ciniiMany ? '大学図書館所蔵 多（研究・専門図書または一般教養の可能性高）' : '大学図書館所蔵 少（特定領域または専門外の可能性）'}</strong>
          </p>
          <p style="font-size: 0.8rem; color: #b45309; margin-top: 0.5rem;">
            ※公共図書館所蔵数がブラウザ直接通信ではCORS制限により取得できなかったため、比率評価はスキップしました。
          </p>
        </div>
      `;
    }

    // Libraries list
    let librariesHtml = '';
    if (ndlData.success && ndlData.libraries && ndlData.libraries.length > 0) {
      const items = ndlData.libraries
        .map(lib => `<li>${escapeHTML(lib)}</li>`)
        .join('');
      librariesHtml = `
        <div class="libraries-section">
          <details class="libraries-details" id="librariesDetails">
            <summary class="libraries-summary">所蔵公共図書館一覧 (${ndlData.libraries.length}館)</summary>
            <ul class="libraries-list">
              ${items}
            </ul>
          </details>
        </div>
      `;
    } else if (!ndlData.success) {
      librariesHtml = `
        <div class="alert alert-warning" style="margin-top: 1rem;">
          <div>
            <strong>公共図書館所蔵情報:</strong>
            <p style="margin-top: 0.25rem;">
              ${escapeHTML(ndlData.error)}
              <br />
              <a href="https://ndlsearch.ndl.go.jp/search?cs=bib&display=100&f-isbn=${encodeURIComponent(ciniiData.isbn)}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; font-weight: 600;">
                国会図書館サーチで直接確認する &raquo;
              </a>
            </p>
          </div>
        </div>
      `;
    }

    resultsContainer.innerHTML = `
      <div class="card">
        <!-- Book Header -->
        <div class="book-header">
          <h2 class="book-title">${escapeHTML(title)}</h2>
          <div class="book-meta-grid">
            <div class="book-meta-item">
              <span class="book-meta-label">著者:</span>
              <span>${escapeHTML(authors)}</span>
            </div>
            <div class="book-meta-item">
              <span class="book-meta-label">出版者:</span>
              <span>${escapeHTML(publisher)}</span>
            </div>
            ${pubDate ? `
            <div class="book-meta-item">
              <span class="book-meta-label">出版年:</span>
              <span>${escapeHTML(pubDate)}</span>
            </div>` : ''}
            <div class="book-meta-item">
              <span class="book-meta-label">ISBN:</span>
              <span style="font-family: var(--font-mono); font-weight: 600;">${escapeHTML(ciniiData.isbn)}</span>
            </div>
          </div>
        </div>

        <!-- Statistics Grid -->
        <div class="stats-grid">
          <!-- CiNii Holdings -->
          <div class="stat-card stat-card-cinii">
            <div class="stat-label">大学図書館 (CiNii) 所蔵</div>
            <div class="stat-value">
              ${ciniiOwnerCount !== null ? escapeHTML(ciniiOwnerCount) : 'ー'}
              <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">館</span>
            </div>
            <a class="stat-link" href="${escapeHTML(cirLink)}" target="_blank" rel="noopener noreferrer">
              CiNii Research 詳細 &raquo;
            </a>
          </div>

          <!-- NDL Public Library Holdings -->
          <div class="stat-card stat-card-ndl">
            <div class="stat-label">公共図書館 (NDL Search) 所蔵</div>
            <div class="stat-value">
              ${ndlCount !== null ? escapeHTML(ndlCount) : 'ー'}
              <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">館</span>
            </div>
            <a class="stat-link" href="https://ndlsearch.ndl.go.jp/search?cs=bib&display=100&f-isbn=${encodeURIComponent(ciniiData.isbn)}" target="_blank" rel="noopener noreferrer">
              国会図書館サーチ 詳細 &raquo;
            </a>
          </div>

          <!-- Ratio -->
          <div class="stat-card stat-card-ratio">
            <div class="stat-label">所蔵比率 (大学 / 公共)</div>
            <div class="stat-value">
              ${escapeHTML(ratioText)}
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
              大学図書館所蔵数 &divide; 公共図書館所蔵数
            </span>
          </div>
        </div>

        <!-- 2x2 Evaluation Matrix -->
        ${matrixHtml}

        <!-- Libraries List -->
        ${librariesHtml}
      </div>
    `;
  }

  // ==========================================================
  // 6. Main Evaluation Action
  // ==========================================================

  async function evaluateNextIsbn() {
    // 1. Sanitize input text first
    let text = isbnInput.value;
    text = sanitizeInput(text);

    const lines = text.split('\n');
    let currentRawIsbn = '';
    let remainingLines = [];

    // Find the first non-empty line
    let foundFirst = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!foundFirst && line !== '') {
        currentRawIsbn = line;
        foundFirst = true;
      } else if (foundFirst) {
        remainingLines.push(lines[i]);
      }
    }

    if (!foundFirst) {
      alert('ISBNまたはISBNリストを入力してください。');
      isbnInput.focus();
      return;
    }

    // Update textarea with the remaining lines
    isbnInput.value = remainingLines.join('\n');
    updateCharCounter();

    // Clean and validate current ISBN
    const cleanIsbn = normalizeIsbn(currentRawIsbn);
    currentIsbnBadge.textContent = cleanIsbn;
    processingBanner.classList.add('active');

    // Validation
    if (!isValidISBN(cleanIsbn)) {
      renderError(
        `入力されたISBN [ ${cleanIsbn} ] はチェックディジットが不正か、有効なISBN-10 / ISBN-13ではありません。`,
        'ISBNチェックエラー'
      );
      return;
    }

    // Japanese ISBN check note (original Perl check: /^4.../ or /^97[89]4.../)
    const isJapaneseIsbn = /^4\d{9}$/i.test(cleanIsbn) || /^97[89]4\d{9}$/i.test(cleanIsbn);
    if (!isJapaneseIsbn) {
      console.info('注意: 日本刊行書籍以外のISBNです。');
    }

    // Render loading state
    renderLoading(cleanIsbn);
    btnNext.disabled = true;

    try {
      const ciniiProxyUrl = ciniiProxyInput.value.trim() || DEFAULT_CINII_PROXY;
      const ndlProxyUrl = ndlProxyInput.value.trim();
      const ciniiLimit = parseInt(ciniiLimitSelect.value, 10);
      const pubLimit = parseInt(pubLimitSelect.value, 10);

      // Concurrently fetch CiNii Research and NDL Search
      const [ciniiResult, ndlResult] = await Promise.all([
        fetchCiNiiResearch(cleanIsbn, ciniiProxyUrl).catch(err => {
          console.error('CiNii Fetch Error:', err);
          return { error: err.message };
        }),
        fetchNDLSearch(cleanIsbn, ndlProxyUrl)
      ]);

      if (ciniiResult && ciniiResult.error) {
        renderError(ciniiResult.error, 'CiNii Research API 取得エラー');
        return;
      }

      if (!ciniiResult) {
        renderError(
          `CiNii Research API で該当する書籍情報が見つかりませんでした (ISBN: ${cleanIsbn})。`,
          '書籍が見つかりませんでした'
        );
        return;
      }

      // Render the complete results
      renderResults(ciniiResult, ndlResult, ciniiLimit, pubLimit);
    } catch (err) {
      console.error(err);
      renderError(err.message || '予期せぬエラーが発生しました。');
    } finally {
      btnNext.disabled = false;
      if (isbnInput.value.trim() === '') {
        currentIsbnBadge.textContent = `${cleanIsbn} (すべての処理完了)`;
      }
    }
  }

  // ==========================================================
  // 7. Event Handlers & Utility Functions
  // ==========================================================

  function updateCharCounter() {
    const len = isbnInput.value.length;
    charCounter.textContent = `${len} / ${MAX_INPUT_CHARS} 文字`;

    charCounter.classList.remove('warning', 'limit');
    if (len >= MAX_INPUT_CHARS) {
      charCounter.classList.add('limit');
    } else if (len >= MAX_INPUT_CHARS * 0.9) {
      charCounter.classList.add('warning');
    }
  }

  function handleInputTextarea() {
    // Enforce 1000 characters limit
    if (isbnInput.value.length > MAX_INPUT_CHARS) {
      isbnInput.value = isbnInput.value.substring(0, MAX_INPUT_CHARS);
    }
    updateCharCounter();
  }

  function clearAll() {
    isbnInput.value = '';
    updateCharCounter();
    resultsContainer.innerHTML = '';
    currentIsbnBadge.textContent = '未処理';
    processingBanner.classList.remove('active');
  }

  function loadSampleList() {
    isbnInput.value = SAMPLE_ISBNS.join('\n');
    updateCharCounter();
    isbnInput.focus();
  }

  function insertSingleSample(isbn) {
    const current = isbnInput.value.trim();
    if (current === '') {
      isbnInput.value = isbn;
    } else {
      isbnInput.value = `${current}\n${isbn}`;
    }
    updateCharCounter();
    isbnInput.focus();
  }

  function renderSampleChips() {
    sampleChipsContainer.innerHTML = '';
    SAMPLE_ISBNS.forEach(isbn => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sample-chip';
      chip.textContent = isbn;
      chip.title = 'クリックして追加';
      chip.addEventListener('click', () => insertSingleSample(isbn));
      sampleChipsContainer.appendChild(chip);
    });
  }

  function loadSettings() {
    const savedCinii = localStorage.getItem(STORAGE_KEY_CINII_PROXY);
    if (savedCinii) {
      ciniiProxyInput.value = savedCinii;
    } else {
      ciniiProxyInput.value = DEFAULT_CINII_PROXY;
    }

    const savedNdl = localStorage.getItem(STORAGE_KEY_NDL_PROXY);
    if (savedNdl) {
      ndlProxyInput.value = savedNdl;
    }
  }

  function saveSettings() {
    const ciniiVal = ciniiProxyInput.value.trim();
    const ndlVal = ndlProxyInput.value.trim();

    if (ciniiVal) {
      localStorage.setItem(STORAGE_KEY_CINII_PROXY, ciniiVal);
    } else {
      localStorage.removeItem(STORAGE_KEY_CINII_PROXY);
    }

    if (ndlVal) {
      localStorage.setItem(STORAGE_KEY_NDL_PROXY, ndlVal);
    } else {
      localStorage.removeItem(STORAGE_KEY_NDL_PROXY);
    }
  }

  function resetSettings() {
    ciniiProxyInput.value = DEFAULT_CINII_PROXY;
    ndlProxyInput.value = '';
    localStorage.removeItem(STORAGE_KEY_CINII_PROXY);
    localStorage.removeItem(STORAGE_KEY_NDL_PROXY);
    alert('プロキシ設定を初期状態にリセットしました。');
  }

  // ==========================================================
  // 8. Initialization
  // ==========================================================

  function init() {
    loadSettings();
    renderSampleChips();
    updateCharCounter();

    // Event Listeners
    isbnInput.addEventListener('input', handleInputTextarea);
    btnNext.addEventListener('click', evaluateNextIsbn);
    btnClear.addEventListener('click', clearAll);
    btnLoadSample.addEventListener('click', loadSampleList);
    btnResetProxy.addEventListener('click', resetSettings);

    ciniiProxyInput.addEventListener('change', saveSettings);
    ndlProxyInput.addEventListener('change', saveSettings);

    // Enter shortcut (Ctrl+Enter or Cmd+Enter) to evaluate
    isbnInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        evaluateNextIsbn();
      }
    });
  }

  // Start app on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
