(function() {
  const form = document.getElementById('suggestionForm') || document.getElementById('clipSuggestionForm');
  if (!form) return;

  const isClip = form.id === 'clipSuggestionForm';
  const siteEmail = form.dataset.siteEmail || (window.LINDY_CONFIG && window.LINDY_CONFIG.siteEmail) || "lindycollectionsite@gmail.com";
  const githubRepo = form.dataset.githubRepo || (window.LINDY_CONFIG && window.LINDY_CONFIG.githubRepo) || "lindycollection/www.lindycollection.com";
  const CONTRIBUTOR_STORAGE_KEY = 'lindy_contributor_name';

  // ---------------------------------------------------------------------------
  // 1. Contributor Name Persistence (localStorage)
  // ---------------------------------------------------------------------------
  const contributorInput = document.getElementById('contributorName');
  if (contributorInput) {
    try {
      const savedName = window.localStorage.getItem(CONTRIBUTOR_STORAGE_KEY);
      if (savedName && !contributorInput.value.trim()) {
        contributorInput.value = savedName;
      }
      contributorInput.addEventListener('change', function() {
        const val = this.value.trim();
        if (val) window.localStorage.setItem(CONTRIBUTOR_STORAGE_KEY, val);
      });
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // 2. Parse Site Catalog Data (on /suggest-new-clip/)
  // ---------------------------------------------------------------------------
  const catalog = { collections: [], pages: [], events: [], clips: [] };
  const pagesByCollection = new Map();
  const pageByNormPath = new Map();
  const clipById = new Map();
  const clipByNormPath = new Map();
  const clipsByYoutubeId = new Map();
  const existingClipIdsSet = new Set();

  function normalizeLookupPath(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    try {
      if (s.includes('://')) {
        const u = new URL(s);
        s = u.pathname;
      }
    } catch (e) {}
    s = s.split('?')[0].split('#')[0].trim().replace(/^\/+|\/+$/g, '');
    if (s.endsWith('.html')) s = s.slice(0, -5);
    else if (s.endsWith('.md')) s = s.slice(0, -3);
    return s.replace(/^\/+|\/+$/g, '').toLowerCase();
  }

  if (isClip) {
    const catalogEl = document.getElementById('siteCatalogData');
    if (catalogEl) {
      try {
        const parsed = JSON.parse(catalogEl.textContent || '{}');
        const cmpTitle = (a, b) => String(a.t || '').localeCompare(String(b.t || ''), undefined, { sensitivity: 'base', numeric: true });
        if (Array.isArray(parsed.collections)) catalog.collections = parsed.collections;
        if (Array.isArray(parsed.pages)) catalog.pages = parsed.pages.slice().sort(cmpTitle);
        if (Array.isArray(parsed.events)) {
          catalog.events = parsed.events.slice().sort((a, b) => {
            const yrA = parseInt((String(a.id || '').match(/(19\d\d|20\d\d)/) || [])[1] || '0', 10);
            const yrB = parseInt((String(b.id || '').match(/(19\d\d|20\d\d)/) || [])[1] || '0', 10);
            if (yrB !== yrA) return yrB - yrA;
            return cmpTitle(a, b);
          });
        }
        if (Array.isArray(parsed.clips)) catalog.clips = parsed.clips.slice().sort(cmpTitle);
      } catch (err) {
        console.warn('Could not parse siteCatalogData:', err);
      }
    }

    catalog.collections.forEach(col => pagesByCollection.set(col.id, []));
    catalog.pages.forEach(p => {
      if (!pagesByCollection.has(p.c)) pagesByCollection.set(p.c, []);
      pagesByCollection.get(p.c).push(p);

      const norm = normalizeLookupPath(p.u);
      if (norm) pageByNormPath.set(norm, p);
      if (p.s) {
        const stemLower = String(p.s).toLowerCase();
        if (!pageByNormPath.has(stemLower)) pageByNormPath.set(stemLower, p);
        if (p.c === 'jazz') pageByNormPath.set('solo_jazz/' + stemLower, p);
        if (p.c === 'historical_figures') pageByNormPath.set('figures/' + stemLower, p);
      }
    });

    catalog.clips.forEach(c => {
      const idLower = String(c.id || '').toLowerCase();
      if (idLower) {
        existingClipIdsSet.add(idLower);
        clipById.set(idLower, c);
      }
      const norm = normalizeLookupPath(c.u);
      if (norm) clipByNormPath.set(norm, c);
      if (c.yt) {
        if (!clipsByYoutubeId.has(c.yt)) clipsByYoutubeId.set(c.yt, []);
        clipsByYoutubeId.get(c.yt).push(c);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Time & YouTube URL Parsing Helpers
  // ---------------------------------------------------------------------------
  function parseTimestampToken(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim().toLowerCase();
    if (!s) return null;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (/^\d+s$/.test(s)) return parseInt(s.slice(0, -1), 10);
    if (s.includes(':')) {
      const parts = s.split(':');
      if (parts.some(p => !/^\d+$/.test(p))) return NaN;
      if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
      return NaN;
    }
    const hms = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (hms && (hms[1] || hms[2] || hms[3])) {
      return (parseInt(hms[1] || '0', 10) * 3600) +
             (parseInt(hms[2] || '0', 10) * 60) +
             parseInt(hms[3] || '0', 10);
    }
    return NaN;
  }

  function formatSecondsFriendly(totalSec) {
    const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const rem = sec % 60;
    const pad2 = n => (n < 10 ? '0' + n : String(n));
    if (hrs > 0) return `${hrs}:${pad2(mins)}:${pad2(rem)}`;
    return `${mins}:${pad2(rem)}`;
  }

  function parseYoutubeInput(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return { videoId: null, startSec: null, endSec: null };

    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
      return { videoId: trimmed, startSec: null, endSec: null };
    }

    let videoId = null;
    let startSec = null;
    let endSec = null;

    const idPatterns = [
      /(?:youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/]|$)/,
      /(?:youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/)([A-Za-z0-9_-]{11})(?:[?&#/]|$)/,
      /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/
    ];
    for (const pat of idPatterns) {
      const m = trimmed.match(pat);
      if (m) {
        videoId = m[1];
        break;
      }
    }

    try {
      const urlCandidate = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
      const u = new URL(urlCandidate);
      const tVal = u.searchParams.get('t') || u.searchParams.get('start') || u.searchParams.get('time_continue');
      const endVal = u.searchParams.get('end');
      if (tVal) {
        const parsedT = parseTimestampToken(tVal);
        if (!Number.isNaN(parsedT) && parsedT > 0) startSec = parsedT;
      }
      if (endVal) {
        const parsedE = parseTimestampToken(endVal);
        if (!Number.isNaN(parsedE) && parsedE > 0) endSec = parsedE;
      }
      if (startSec === null && u.hash) {
        const hashMatch = u.hash.match(/(?:^|[?&#])t=([0-9hms:]+)/i);
        if (hashMatch) {
          const parsedH = parseTimestampToken(hashMatch[1]);
          if (!Number.isNaN(parsedH) && parsedH > 0) startSec = parsedH;
        }
      }
    } catch (e) {
      const fallbackT = trimmed.match(/[?&#](?:t|start)=([0-9hms:]+)/i);
      if (fallbackT) {
        const parsedT = parseTimestampToken(fallbackT[1]);
        if (!Number.isNaN(parsedT) && parsedT > 0) startSec = parsedT;
      }
    }

    return { videoId, startSec, endSec };
  }

  // ---------------------------------------------------------------------------
  // 4. Alerts, Tabs & License State
  // ---------------------------------------------------------------------------
  const tabEmailBtn = document.getElementById('tabEmailBtn');
  const tabGithubBtn = document.getElementById('tabGithubBtn');
  const panelEmail = document.getElementById('panelEmail');
  const panelGithub = document.getElementById('panelGithub');

  function setTab(isEmail) {
    if (!tabEmailBtn) return;
    tabEmailBtn.classList.toggle('active', isEmail);
    tabEmailBtn.setAttribute('aria-selected', isEmail);
    tabGithubBtn.classList.toggle('active', !isEmail);
    tabGithubBtn.setAttribute('aria-selected', !isEmail);
    panelEmail.classList.toggle('active', isEmail);
    panelGithub.classList.toggle('active', !isEmail);
  }
  if (tabEmailBtn && tabGithubBtn) {
    tabEmailBtn.onclick = () => setTab(true);
    tabGithubBtn.onclick = () => setTab(false);
  }

  const ccLicense = document.getElementById('ccLicense');
  const licenseBox = document.getElementById('licenseBox');
  const licenseWarning = document.getElementById('licenseWarning');
  const actionButtons = [
    document.getElementById('btnEmailClient'),
    document.getElementById('btnGmailWeb'),
    document.getElementById('btnCopyTemplate'),
    document.getElementById('btnGithubIssue')
  ].filter(Boolean);

  function updateLicense() {
    const agreed = !!(ccLicense && ccLicense.checked);
    if (licenseBox) licenseBox.classList.toggle('agreed', agreed);
    if (licenseWarning && agreed) licenseWarning.style.display = 'none';
    actionButtons.forEach(btn => btn.disabled = !agreed);
  }
  if (ccLicense) {
    ccLicense.onchange = updateLicense;
    updateLicense();
  }

  const statusAlert = document.getElementById('statusAlert');
  function showAlert(msg, type) {
    if (!statusAlert) return;
    statusAlert.className = 'submission-alert submission-alert-' + type;
    statusAlert.textContent = msg;
    statusAlert.style.display = 'block';
    statusAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function hideAlert() {
    if (statusAlert) statusAlert.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // 5. Auto-Fill State Helpers
  // ---------------------------------------------------------------------------
  function isEligibleForAutofill(el) {
    if (!el) return false;
    return !el.value.trim() || el.dataset.autofilled === 'true';
  }

  function setAutofilledValue(el, value, badgeEl) {
    if (!el) return;
    el.value = value;
    el.dataset.autofilled = value !== '' ? 'true' : 'false';
    el.classList.toggle('is-autofilled', value !== '');
    el.classList.remove('has-error');
    const err = document.getElementById('err-' + el.id);
    if (err) err.style.display = 'none';
    if (badgeEl) badgeEl.style.display = value !== '' ? 'inline-block' : 'none';
  }

  function markManualEdit(el, badgeEl) {
    if (!el) return;
    el.dataset.autofilled = 'false';
    el.classList.remove('is-autofilled');
    if (badgeEl) badgeEl.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // 6. Clip Form Logic: Dropdowns, YouTube Auto-Fetch & Preview Player
  // ---------------------------------------------------------------------------
  let currentUploadDate = '';
  let currentYoutubeId = '';
  let getSelectedTargetUrls = () => {
    const t = document.getElementById('targetPage');
    return t && t.value.trim() ? [t.value.trim()] : [];
  };
  let getPrimaryAssocSlug = () => '';

  if (isClip) {
    const subSectionNew = document.getElementById('subSectionNewClip');
    const subSectionNewMeta = document.getElementById('subSectionNewClipMeta');
    const subSectionLink = document.getElementById('subSectionLinkExisting');
    const subSectionLinkNotes = document.getElementById('subSectionLinkNotes');
    const targetStar = document.getElementById('targetPageRequiredStar');
    const targetHint = document.getElementById('targetPageHint');
    const targetInputHidden = document.getElementById('targetPage');

    const ytInput = document.getElementById('clipYoutubeUrl');
    const ytFetchStatus = document.getElementById('ytFetchStatus');
    const btnRefetchYt = document.getElementById('btnRefetchYt');
    const ytPreviewCard = document.getElementById('ytPreviewCard');
    const ytMetaInfo = document.getElementById('ytMetaInfo');
    const existingClipsNotice = document.getElementById('existingVideoClipsNotice');
    const existingClipsHeading = document.getElementById('existingVideoClipsHeading');
    const existingClipsList = document.getElementById('existingVideoClipsList');

    const titleInput = document.getElementById('clipTitle');
    const clipIdInput = document.getElementById('clipId');
    const clipIdHint = document.getElementById('clipIdHint');
    const startInput = document.getElementById('clipStartTime');
    const endInput = document.getElementById('clipEndTime');
    const clipTypeSelect = document.getElementById('clipType');
    const clipEventSelect = document.getElementById('clipEventSelect');
    const clipEventCustomWrap = document.getElementById('clipEventCustomWrap');
    const clipEventCustomInput = document.getElementById('clipEvent');

    const tagAutoTitle = document.getElementById('tagAutoTitle');
    const tagAutoId = document.getElementById('tagAutoId');
    const tagAutoStart = document.getElementById('tagAutoStart');
    const tagAutoEnd = document.getElementById('tagAutoEnd');
    const tagAutoType = document.getElementById('tagAutoType');
    const tagAutoEvent = document.getElementById('tagAutoEvent');

    const btnSetStart = document.getElementById('btnSetStartFromPlayer');
    const btnSetEnd = document.getElementById('btnSetEndFromPlayer');
    const btnInlineSetStart = document.getElementById('btnInlineSetStart');
    const btnInlineSetEnd = document.getElementById('btnInlineSetEnd');
    const btnPreviewRange = document.getElementById('btnPreviewRange');

    const existingClipFilter = document.getElementById('existingClipFilter');
    const existingClipSelect = document.getElementById('existingClipSelect');
    const existingClipCustomWrap = document.getElementById('existingClipCustomWrap');
    const existingClipNameInput = document.getElementById('existingClipName');

    const assocRowsContainer = document.getElementById('assocRowsContainer');
    const btnAddAssocRow = document.getElementById('btnAddAssocRow');
    const refClipBanner = document.getElementById('refClipBanner');

    function getCurrentMode() {
      return (document.querySelector('input[name="clipMode"]:checked') || {}).value || 'new';
    }

    // ---- 6A. Smart Slug / Clip ID Generator ----
    function toCleanSlug(text, maxLen) {
      let s = String(text || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (maxLen && s.length > maxLen) {
        const cut = s.slice(0, maxLen);
        const lastUnderscore = cut.lastIndexOf('_');
        s = (lastUnderscore >= Math.floor(maxLen * 0.55) ? cut.slice(0, lastUnderscore) : cut).replace(/_+$/g, '');
      }
      return s;
    }

    function generateUniqueClipId() {
      const rawTitle = (titleInput ? titleInput.value.trim() : '');
      if (!rawTitle) return '';

      const videoHasClips = !!(currentYoutubeId && clipsByYoutubeId.has(currentYoutubeId));
      const assocSlug = toCleanSlug(getPrimaryAssocSlug(), 20);
      let base = toCleanSlug(rawTitle, 36);
      if (!base) base = 'clip';

      let candidate = base;
      if ((videoHasClips || existingClipIdsSet.has(candidate)) && assocSlug && !candidate.includes(assocSlug)) {
        candidate = toCleanSlug(base, 26) + '_' + assocSlug;
      }

      if (existingClipIdsSet.has(candidate) && startInput && startInput.value.trim()) {
        const stSec = parseTimestampToken(startInput.value);
        if (!Number.isNaN(stSec) && stSec !== null && stSec > 0) {
          candidate = toCleanSlug(candidate, 32) + '_' + stSec + 's';
        }
      }

      let suffix = 2;
      const rootCandidate = candidate;
      while (existingClipIdsSet.has(candidate)) {
        candidate = toCleanSlug(rootCandidate, 35) + '_' + suffix;
        suffix++;
      }
      return candidate;
    }

    function updateClipIdCollisionHint() {
      if (!clipIdInput || !clipIdHint) return;
      const val = clipIdInput.value.trim().toLowerCase();
      if (val && existingClipIdsSet.has(val)) {
        const match = clipById.get(val);
        clipIdHint.textContent = `⚠️ A clip with ID "${val}" already exists (${match ? match.t : 'in archive'}). Choose a unique ID or use "Link an Existing Clip".`;
        clipIdHint.style.color = '#b45309';
      } else {
        clipIdHint.textContent = 'Lowercase alphanumeric and underscores only. Auto-generated from title.';
        clipIdHint.style.color = '';
      }
    }

    function maybeRefreshAutoClipId(force) {
      if (!clipIdInput) return;
      if (force || isEligibleForAutofill(clipIdInput)) {
        const generated = generateUniqueClipId();
        setAutofilledValue(clipIdInput, generated, tagAutoId);
      }
      updateClipIdCollisionHint();
    }

    // ---- 6B. Heuristic Suggestions for Categorization & Event ----
    function inferClipTypeFromTitle(title) {
      const t = String(title || '').toLowerCase();
      if (!t) return '';
      if (/\b(tutorial|how to|lesson|instruction|instructional|walkthrough|walk-through|breakdown|counts|teach|teaching)\b/.test(t)) {
        return 'tutorial';
      }
      if (/\b(class recap|workshop recap)\b/.test(t)) {
        return 'recap';
      }
      if (/\b(interview|oral history|conversation with|q\s*&\s*a)\b/.test(t)) {
        return 'interview';
      }
      if (/\b(finals?|prelims?|semi-?finals?|strictly|jack\s*(?:&|and|\+)\s*jill|contest|championships?|competition|invitational|open lindy)\b/.test(t)) {
        return 'competition';
      }
      return '';
    }

    function inferEventFromTitle(title) {
      const t = String(title || '').toLowerCase();
      if (!t) return '';
      for (const ev of catalog.events) {
        const evTitle = String(ev.t || '').toLowerCase();
        if (evTitle && t.includes(evTitle)) return ev.id;
        const yearMatch = ev.id.match(/(19\d\d|20\d\d)/);
        if (yearMatch) {
          const yr = yearMatch[1];
          if (ev.id.startsWith('camp_hollywood_') && (t.includes('camp hollywood ' + yr) || new RegExp('\\bch\\s*' + yr + '\\b').test(t))) {
            return ev.id;
          }
          if (ev.id.startsWith('ilhc_') && (t.includes('ilhc ' + yr) || t.includes('international lindy hop championships ' + yr))) {
            return ev.id;
          }
        }
      }
      return '';
    }

    // ---- 6C. Association Rows (Collection + Page Dropdowns) ----
    const assocRows = [];

    function populatePageOptions(pageSelect, colId, selectedUrl) {
      const isLinkMode = getCurrentMode() === 'link-existing';
      pageSelect.innerHTML = '';

      const placeholderOpt = document.createElement('option');
      placeholderOpt.value = '';
      placeholderOpt.textContent = isLinkMode
        ? '-- Select Target Page --'
        : '-- Optional: Standalone Clip (No Page) --';
      pageSelect.appendChild(placeholderOpt);

      if (!colId) {
        catalog.collections.forEach(col => {
          const pages = pagesByCollection.get(col.id) || [];
          if (!pages.length) return;
          const group = document.createElement('optgroup');
          group.label = col.label;
          pages.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.u;
            opt.textContent = p.t;
            opt.dataset.col = p.c;
            opt.dataset.slug = p.s || '';
            if (p.eid) opt.dataset.eid = p.eid;
            group.appendChild(opt);
          });
          pageSelect.appendChild(group);
        });
      } else if (colId !== '__custom__') {
        const pages = pagesByCollection.get(colId) || [];
        pages.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.u;
          opt.textContent = p.t;
          opt.dataset.col = p.c;
          opt.dataset.slug = p.s || '';
          if (p.eid) opt.dataset.eid = p.eid;
          pageSelect.appendChild(opt);
        });
      }

      const customOpt = document.createElement('option');
      customOpt.value = '__custom__';
      customOpt.textContent = '🔗 Other / Custom page URL…';
      pageSelect.appendChild(customOpt);

      if (selectedUrl) {
        pageSelect.value = selectedUrl;
      }
    }

    function syncAssocState() {
      const urls = [];
      let primarySlug = '';

      assocRows.forEach(row => {
        let val = '';
        if (row.colSelect.value === '__custom__' || row.pageSelect.value === '__custom__') {
          val = row.customInput.value.trim();
          if (val && !primarySlug) {
            const parts = normalizeLookupPath(val).split('/').filter(Boolean);
            primarySlug = parts[parts.length - 1] || '';
          }
        } else {
          val = row.pageSelect.value.trim();
          const selOpt = row.pageSelect.options[row.pageSelect.selectedIndex];
          if (selOpt && val) {
            if (!primarySlug && selOpt.dataset.slug) primarySlug = selOpt.dataset.slug;
            if (selOpt.dataset.eid && getCurrentMode() === 'new' && clipEventSelect && isEligibleForAutofill(clipEventSelect)) {
              setAutofilledValue(clipEventSelect, selOpt.dataset.eid, tagAutoEvent);
            }
          }
        }
        if (val && !urls.includes(val)) urls.push(val);
      });

      getSelectedTargetUrls = () => urls.slice();
      getPrimaryAssocSlug = () => primarySlug;

      if (targetInputHidden) {
        targetInputHidden.value = urls.join(', ');
      }
      if (urls.length > 0) {
        assocRows.forEach(r => {
          r.pageSelect.classList.remove('has-error');
          r.customInput.classList.remove('has-error');
        });
        const err = document.getElementById('err-targetPage');
        if (err) err.style.display = 'none';
      }

      assocRows.forEach((r, idx) => {
        if (idx === 0) r.pageSelect.id = 'assocPagePrimary';
        else r.pageSelect.removeAttribute('id');
        r.removeBtn.style.display = assocRows.length > 1 ? 'inline-flex' : 'none';
      });

      if (urls.length > 0) {
        const switchLink = document.getElementById('linkSwitchToChange');
        if (switchLink) {
          const base = switchLink.getAttribute('href').split('?')[0];
          switchLink.setAttribute('href', base + '?page=' + encodeURIComponent(urls[0]));
        }
      }

      maybeRefreshAutoClipId(false);
    }

    function createAssocRow(initialPageUrl) {
      if (!assocRowsContainer) return null;

      const rowEl = document.createElement('div');
      rowEl.className = 'assoc-row';

      const colSelect = document.createElement('select');
      colSelect.className = 'submission-select assoc-collection-select';
      colSelect.setAttribute('aria-label', 'Page Category');

      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = '-- All Categories --';
      colSelect.appendChild(allOpt);

      catalog.collections.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.id;
        opt.textContent = col.label;
        colSelect.appendChild(opt);
      });

      const customColOpt = document.createElement('option');
      customColOpt.value = '__custom__';
      customColOpt.textContent = '🔗 Custom Page URL…';
      colSelect.appendChild(customColOpt);

      const pageSelect = document.createElement('select');
      pageSelect.className = 'submission-select assoc-page-select';
      pageSelect.setAttribute('aria-label', 'Target Page');

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'assoc-remove-btn';
      removeBtn.title = 'Remove page association';
      removeBtn.setAttribute('aria-label', 'Remove page association');
      removeBtn.textContent = '✕';

      const customWrap = document.createElement('div');
      customWrap.className = 'assoc-custom-wrap';
      customWrap.style.display = 'none';

      const customInput = document.createElement('input');
      customInput.type = 'text';
      customInput.className = 'submission-input assoc-custom-input';
      customInput.placeholder = 'Enter page URL or path — e.g., /routines/big_apple/';
      customWrap.appendChild(customInput);

      rowEl.appendChild(colSelect);
      rowEl.appendChild(pageSelect);
      rowEl.appendChild(removeBtn);
      rowEl.appendChild(customWrap);
      assocRowsContainer.appendChild(rowEl);

      const rowObj = { rowEl, colSelect, pageSelect, removeBtn, customWrap, customInput };
      assocRows.push(rowObj);

      function updateCustomVisibility() {
        const isCustom = colSelect.value === '__custom__' || pageSelect.value === '__custom__';
        customWrap.style.display = isCustom ? 'block' : 'none';
        pageSelect.style.display = colSelect.value === '__custom__' ? 'none' : '';
      }

      populatePageOptions(pageSelect, '', '');

      if (initialPageUrl) {
        const norm = normalizeLookupPath(initialPageUrl);
        const matchedPage = pageByNormPath.get(norm);
        if (matchedPage) {
          colSelect.value = matchedPage.c;
          populatePageOptions(pageSelect, matchedPage.c, matchedPage.u);
        } else {
          colSelect.value = '__custom__';
          customInput.value = initialPageUrl;
          updateCustomVisibility();
        }
      }

      colSelect.addEventListener('change', function() {
        if (this.value === '__custom__') {
          updateCustomVisibility();
        } else {
          const prevUrl = pageSelect.value;
          populatePageOptions(pageSelect, this.value, '');
          const stillExists = Array.from(pageSelect.options).some(o => o.value === prevUrl && prevUrl !== '');
          if (stillExists) pageSelect.value = prevUrl;
          updateCustomVisibility();
        }
        syncAssocState();
      });

      pageSelect.addEventListener('change', function() {
        if (this.value === '__custom__') {
          updateCustomVisibility();
        } else {
          const selOpt = this.options[this.selectedIndex];
          if (selOpt && selOpt.dataset.col && !colSelect.value) {
            colSelect.value = selOpt.dataset.col;
            populatePageOptions(pageSelect, selOpt.dataset.col, this.value);
          }
          updateCustomVisibility();
        }
        syncAssocState();
      });

      customInput.addEventListener('input', syncAssocState);

      removeBtn.addEventListener('click', function() {
        const idx = assocRows.indexOf(rowObj);
        if (idx !== -1 && assocRows.length > 1) {
          assocRows.splice(idx, 1);
          rowEl.remove();
          syncAssocState();
        }
      });

      syncAssocState();
      return rowObj;
    }

    if (btnAddAssocRow) {
      btnAddAssocRow.addEventListener('click', function() {
        createAssocRow('');
      });
    }

    // ---- 6D. Existing Clip Selector & Search Filter (Mode B) ----
    function renderExistingClipOptions(filterText, preserveVal) {
      if (!existingClipSelect) return;
      const q = String(filterText || '').trim().toLowerCase();
      const currentVal = preserveVal !== undefined ? preserveVal : existingClipSelect.value;

      existingClipSelect.innerHTML = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = q
        ? `-- Matching Clips (${catalog.clips.length} total) --`
        : `-- Select an Existing Clip (${catalog.clips.length} in archive) --`;
      existingClipSelect.appendChild(defaultOpt);

      let matchCount = 0;
      let singleMatchId = '';
      catalog.clips.forEach(c => {
        if (q) {
          const hay = `${c.t || ''} ${c.id || ''} ${c.yt || ''}`.toLowerCase();
          if (!hay.includes(q)) return;
        }
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.t} (${c.id})`;
        existingClipSelect.appendChild(opt);
        matchCount++;
        singleMatchId = c.id;
      });

      const customOpt = document.createElement('option');
      customOpt.value = '__custom__';
      customOpt.textContent = 'Other / Enter clip ID manually…';
      existingClipSelect.appendChild(customOpt);

      if (q) {
        defaultOpt.textContent = matchCount === 0
          ? '-- No matching clips found (use manual entry below) --'
          : `-- Select from ${matchCount} matching clip${matchCount === 1 ? '' : 's'} --`;
      }

      if (currentVal && Array.from(existingClipSelect.options).some(o => o.value === currentVal)) {
        existingClipSelect.value = currentVal;
      } else if (q && matchCount === 1) {
        existingClipSelect.value = singleMatchId;
      }
      if (existingClipCustomWrap) {
        existingClipCustomWrap.style.display = existingClipSelect.value === '__custom__' ? 'block' : 'none';
      }
    }

    renderExistingClipOptions('', '');
    if (existingClipFilter) {
      existingClipFilter.addEventListener('input', function() {
        renderExistingClipOptions(this.value);
      });
    }
    if (existingClipSelect) {
      existingClipSelect.addEventListener('change', function() {
        if (existingClipCustomWrap) {
          existingClipCustomWrap.style.display = this.value === '__custom__' ? 'block' : 'none';
        }
        this.classList.remove('has-error');
        const err = document.getElementById('err-existingClipName');
        if (err) err.style.display = 'none';
      });
    }

    function switchToMode(modeVal) {
      const radio = document.querySelector(`input[name="clipMode"][value="${modeVal}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }
    }

    // ---- 6E. Mode Toggle Handler ----
    document.querySelectorAll('input[name="clipMode"]').forEach(radio => {
      radio.addEventListener('change', function() {
        const isNew = this.value === 'new';
        if (subSectionNew) subSectionNew.style.display = isNew ? 'block' : 'none';
        if (subSectionNewMeta) subSectionNewMeta.style.display = isNew ? 'block' : 'none';
        if (subSectionLink) subSectionLink.style.display = isNew ? 'none' : 'block';
        if (subSectionLinkNotes) subSectionLinkNotes.style.display = isNew ? 'none' : 'block';
        if (targetStar) targetStar.style.display = isNew ? 'none' : 'inline';
        if (targetHint) {
          targetHint.textContent = isNew
            ? 'Select a category and page to display this clip on (pre-selected when coming from a page), or leave blank for a standalone clip.'
            : 'Select the routine, solo jazz, aerial, or historical figure page where this existing clip should be added.';
        }
        assocRows.forEach(r => {
          const firstOpt = r.pageSelect.options[0];
          if (firstOpt && firstOpt.value === '') {
            firstOpt.textContent = isNew
              ? '-- Optional: Standalone Clip (No Page) --'
              : '-- Select Target Page --';
          }
        });
        hideAlert();
      });
    });

    // Event Custom Select Toggle & Manual Tracking
    if (clipEventSelect) {
      clipEventSelect.addEventListener('change', function() {
        markManualEdit(this, tagAutoEvent);
        if (clipEventCustomWrap) {
          clipEventCustomWrap.style.display = this.value === '__custom__' ? 'block' : 'none';
        }
      });
    }
    if (clipTypeSelect) {
      clipTypeSelect.addEventListener('change', function() {
        markManualEdit(this, tagAutoType);
      });
    }
    if (titleInput) {
      titleInput.addEventListener('input', function() {
        markManualEdit(this, tagAutoTitle);
        maybeRefreshAutoClipId(false);
      });
    }
    if (clipIdInput) {
      clipIdInput.addEventListener('input', function() {
        markManualEdit(this, tagAutoId);
        updateClipIdCollisionHint();
      });
    }
    if (startInput) {
      startInput.addEventListener('input', function() {
        markManualEdit(this, tagAutoStart);
        maybeRefreshAutoClipId(false);
      });
    }
    if (endInput) {
      endInput.addEventListener('input', function() {
        markManualEdit(this, tagAutoEnd);
      });
    }

    // ---- 6F. Embedded YouTube IFrame Player & Range Preview ----
    let ytPlayer = null;
    let ytPlayerReady = false;
    let ytApiRequested = false;
    let pendingPlayerVideo = null;
    let previewRangeInterval = null;
    let previewStopAtSec = null;
    let fetchedAuthorName = '';
    let fetchedDurationSec = 0;

    function updateMetaInfoDisplay() {
      if (!ytMetaInfo) return;
      const parts = [];
      const curTitle = titleInput && titleInput.value.trim();
      if (curTitle) parts.push(`<strong>${escapeHtml(curTitle)}</strong>`);
      const subParts = [];
      if (fetchedAuthorName) subParts.push(`Channel: ${escapeHtml(fetchedAuthorName)}`);
      if (fetchedDurationSec > 0) subParts.push(`Duration: ${formatSecondsFriendly(fetchedDurationSec)}`);
      if (currentYoutubeId) subParts.push(`ID: <code>${escapeHtml(currentYoutubeId)}</code>`);
      if (subParts.length) parts.push(`<span>${subParts.join(' · ')}</span>`);
      ytMetaInfo.innerHTML = parts.length ? parts.join('<br>') : 'Video preview ready.';
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function setPlayerButtonsEnabled(enabled) {
      [btnSetStart, btnSetEnd, btnInlineSetStart, btnInlineSetEnd, btnPreviewRange].forEach(b => {
        if (b) b.disabled = !enabled;
      });
    }

    function clearRangeMonitor() {
      if (previewRangeInterval) {
        clearInterval(previewRangeInterval);
        previewRangeInterval = null;
      }
      previewStopAtSec = null;
    }

    function applyFallbackDataFromPlayer() {
      if (!ytPlayer || typeof ytPlayer.getVideoData !== 'function') return;
      const data = ytPlayer.getVideoData() || {};
      if (data.author && !fetchedAuthorName) {
        fetchedAuthorName = data.author;
      }
      if (typeof ytPlayer.getDuration === 'function') {
        const dur = ytPlayer.getDuration();
        if (dur && dur > 0) fetchedDurationSec = dur;
      }
      if (data.title && titleInput && isEligibleForAutofill(titleInput) && !titleInput.value.trim()) {
        const cleaned = cleanYoutubeTitle(data.title);
        if (cleaned) {
          applyFetchedVideoTitle(cleaned, false);
          setYtStatus(`✓ Auto-filled from YouTube player${fetchedAuthorName ? ' · ' + fetchedAuthorName : ''}`, 'success');
        }
      }
      updateMetaInfoDisplay();
    }

    function initOrCuePlayer(videoId, startSec) {
      if (!ytPreviewCard) return;
      ytPreviewCard.style.display = 'block';
      pendingPlayerVideo = { videoId, startSec: startSec || 0 };

      if (ytPlayer && ytPlayerReady && typeof ytPlayer.cueVideoById === 'function') {
        clearRangeMonitor();
        ytPlayer.cueVideoById({ videoId, startSeconds: startSec || 0 });
        setTimeout(applyFallbackDataFromPlayer, 600);
        return;
      }

      if (window.YT && window.YT.Player && !ytPlayer) {
        createYtPlayerInstance(videoId, startSec || 0);
        return;
      }

      if (!ytApiRequested) {
        ytApiRequested = true;
        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function() {
          if (typeof prevReady === 'function') prevReady();
          if (pendingPlayerVideo && !ytPlayer) {
            createYtPlayerInstance(pendingPlayerVideo.videoId, pendingPlayerVideo.startSec);
          }
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    function createYtPlayerInstance(videoId, startSec) {
      ytPlayer = new window.YT.Player('ytPreviewPlayer', {
        videoId: videoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          start: startSec || 0
        },
        events: {
          onReady: function() {
            ytPlayerReady = true;
            setPlayerButtonsEnabled(true);
            applyFallbackDataFromPlayer();
          },
          onStateChange: function(ev) {
            applyFallbackDataFromPlayer();
            if (window.YT && ev.data === window.YT.PlayerState.PLAYING && previewStopAtSec !== null) {
              if (previewRangeInterval) clearInterval(previewRangeInterval);
              previewRangeInterval = setInterval(function() {
                if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                  if (ytPlayer.getCurrentTime() >= previewStopAtSec) {
                    ytPlayer.pauseVideo();
                    clearRangeMonitor();
                  }
                }
              }, 200);
            } else if (window.YT && ev.data !== window.YT.PlayerState.PLAYING && previewRangeInterval) {
              clearInterval(previewRangeInterval);
              previewRangeInterval = null;
            }
          }
        }
      });
    }

    function capturePlayerTimeInto(inputEl, badgeEl) {
      if (!ytPlayer || !ytPlayerReady || typeof ytPlayer.getCurrentTime !== 'function' || !inputEl) return;
      const cur = Math.max(0, Math.floor(ytPlayer.getCurrentTime() || 0));
      inputEl.value = formatSecondsFriendly(cur);
      markManualEdit(inputEl, badgeEl);
      inputEl.classList.remove('has-error');
      const err = document.getElementById('err-' + inputEl.id);
      if (err) err.style.display = 'none';
      if (inputEl === startInput) maybeRefreshAutoClipId(false);
    }

    if (btnSetStart) btnSetStart.addEventListener('click', () => capturePlayerTimeInto(startInput, tagAutoStart));
    if (btnInlineSetStart) btnInlineSetStart.addEventListener('click', () => capturePlayerTimeInto(startInput, tagAutoStart));
    if (btnSetEnd) btnSetEnd.addEventListener('click', () => capturePlayerTimeInto(endInput, tagAutoEnd));
    if (btnInlineSetEnd) btnInlineSetEnd.addEventListener('click', () => capturePlayerTimeInto(endInput, tagAutoEnd));

    if (btnPreviewRange) {
      btnPreviewRange.addEventListener('click', function() {
        if (!ytPlayer || !ytPlayerReady) return;
        const stRaw = startInput ? parseTimestampToken(startInput.value) : null;
        const etRaw = endInput ? parseTimestampToken(endInput.value) : null;
        const st = (!Number.isNaN(stRaw) && stRaw !== null) ? stRaw : 0;
        const et = (!Number.isNaN(etRaw) && etRaw !== null && etRaw > st) ? etRaw : null;
        clearRangeMonitor();
        previewStopAtSec = et;
        if (typeof ytPlayer.seekTo === 'function') ytPlayer.seekTo(st, true);
        if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
      });
    }

    // ---- 6G. Fetch YouTube Metadata & Populate Fields ----
    let fetchReqCounter = 0;
    let lastProcessedSignature = '';

    function setYtStatus(text, state) {
      if (!ytFetchStatus) return;
      ytFetchStatus.className = 'yt-fetch-status' + (state ? ' yt-fetch-status--' + state : '');
      if (state === 'loading') {
        ytFetchStatus.innerHTML = `<span class="yt-spinner" aria-hidden="true"></span><span>${escapeHtml(text)}</span>`;
      } else {
        ytFetchStatus.textContent = text;
      }
    }

    function cleanYoutubeTitle(rawTitle) {
      let t = String(rawTitle || '').trim();
      if (t.endsWith(' - YouTube')) t = t.slice(0, -10).trim();
      return t;
    }

    function renderExistingClipsForVideo(videoId) {
      if (!existingClipsNotice || !existingClipsList || !existingClipsHeading) return;
      const matches = clipsByYoutubeId.get(videoId) || [];
      if (!matches.length) {
        existingClipsNotice.style.display = 'none';
        existingClipsList.innerHTML = '';
        return;
      }

      existingClipsHeading.textContent = `ℹ️ This YouTube video already has ${matches.length} clip${matches.length === 1 ? '' : 's'} in the Lindy Collection archive:`;
      existingClipsList.innerHTML = '';

      matches.forEach(c => {
        const chip = document.createElement('span');
        chip.className = 'yt-existing-chip';

        const link = document.createElement('a');
        link.href = c.u;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = c.t || c.id;
        chip.appendChild(link);

        if (c.st !== undefined || c.et !== undefined) {
          const timeSpan = document.createElement('span');
          timeSpan.className = 'yt-existing-chip-time';
          const stFmt = c.st !== undefined && c.st !== '' ? formatSecondsFriendly(c.st) : '0:00';
          const etFmt = c.et !== undefined && c.et !== '' ? formatSecondsFriendly(c.et) : 'End';
          timeSpan.textContent = `(${stFmt}–${etFmt})`;
          chip.appendChild(timeSpan);
        }

        const linkExistingBtn = document.createElement('button');
        linkExistingBtn.type = 'button';
        linkExistingBtn.className = 'yt-existing-link-btn';
        linkExistingBtn.textContent = 'Link to page →';
        linkExistingBtn.title = `Switch to "Link an Existing Clip" for ${c.id}`;
        linkExistingBtn.addEventListener('click', function() {
          renderExistingClipOptions('', c.id);
          if (existingClipFilter) existingClipFilter.value = '';
          switchToMode('link-existing');
        });
        chip.appendChild(linkExistingBtn);

        existingClipsList.appendChild(chip);
      });

      existingClipsNotice.style.display = 'block';
    }

    function applyFetchedVideoTitle(cleanedTitle, forceReset) {
      if (!cleanedTitle) return;
      if (titleInput && (forceReset || isEligibleForAutofill(titleInput))) {
        setAutofilledValue(titleInput, cleanedTitle, tagAutoTitle);
      }
      maybeRefreshAutoClipId(forceReset);

      if (clipTypeSelect && (forceReset || isEligibleForAutofill(clipTypeSelect))) {
        const inferredType = inferClipTypeFromTitle(cleanedTitle);
        if (inferredType) setAutofilledValue(clipTypeSelect, inferredType, tagAutoType);
        else if (forceReset) setAutofilledValue(clipTypeSelect, '', tagAutoType);
      }

      if (clipEventSelect && (forceReset || isEligibleForAutofill(clipEventSelect))) {
        const existingMatches = clipsByYoutubeId.get(currentYoutubeId) || [];
        const archiveEvent = (existingMatches.find(c => c.ev) || {}).ev || '';
        const inferredEvent = archiveEvent || inferEventFromTitle(cleanedTitle);
        if (inferredEvent && Array.from(clipEventSelect.options).some(o => o.value === inferredEvent)) {
          setAutofilledValue(clipEventSelect, inferredEvent, tagAutoEvent);
          if (clipEventCustomWrap) clipEventCustomWrap.style.display = 'none';
        } else if (forceReset) {
          setAutofilledValue(clipEventSelect, '', tagAutoEvent);
        }
      }
    }

    async function fetchYoutubeOembed(videoId) {
      const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      const endpoints = [
        `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
        `https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`
      ];
      for (const ep of endpoints) {
        try {
          const resp = await fetch(ep, { method: 'GET', mode: 'cors' });
          if (!resp.ok) continue;
          const data = await resp.json();
          if (data && data.title && !data.error) {
            return {
              title: cleanYoutubeTitle(data.title),
              author: String(data.author_name || '').trim()
            };
          }
        } catch (err) {
          // Try next endpoint or fall back to IFrame API
        }
      }
      return null;
    }

    async function handleYoutubeUrlChange(forceReset) {
      if (!ytInput) return;
      const raw = ytInput.value.trim();
      if (!raw) {
        currentYoutubeId = '';
        currentUploadDate = '';
        lastProcessedSignature = '';
        if (btnRefetchYt) btnRefetchYt.style.display = 'none';
        if (ytPreviewCard) ytPreviewCard.style.display = 'none';
        setYtStatus('Paste a YouTube link to automatically fetch the title, clip ID, timestamps, and preview.', '');
        return;
      }

      const { videoId, startSec, endSec } = parseYoutubeInput(raw);
      if (!videoId) {
        setYtStatus('Enter a full YouTube URL (youtube.com/watch?v=…, youtu.be/…, shorts/…) or 11-character video ID.', 'warn');
        return;
      }

      const signature = `${videoId}|${startSec || ''}|${endSec || ''}`;
      if (!forceReset && signature === lastProcessedSignature) return;
      lastProcessedSignature = signature;

      const isNewVideo = videoId !== currentYoutubeId;
      currentYoutubeId = videoId;
      if (btnRefetchYt) btnRefetchYt.style.display = 'inline-block';

      ytInput.classList.remove('has-error');
      const errYt = document.getElementById('err-clipYoutubeUrl');
      if (errYt) errYt.style.display = 'none';

      // 1. Auto-fill Start / End timestamps from URL params
      if (startSec !== null && startInput && (forceReset || isNewVideo && isEligibleForAutofill(startInput) || isEligibleForAutofill(startInput))) {
        setAutofilledValue(startInput, formatSecondsFriendly(startSec), tagAutoStart);
      } else if (forceReset && startInput && isEligibleForAutofill(startInput)) {
        setAutofilledValue(startInput, '', tagAutoStart);
      }

      if (endSec !== null && endInput && (forceReset || isEligibleForAutofill(endInput))) {
        setAutofilledValue(endInput, formatSecondsFriendly(endSec), tagAutoEnd);
      } else if (forceReset && endInput && isEligibleForAutofill(endInput)) {
        setAutofilledValue(endInput, '', tagAutoEnd);
      }

      // 2. Check existing archive clips for this YouTube video (upload_date, event, duplicates)
      const archiveClips = clipsByYoutubeId.get(videoId) || [];
      renderExistingClipsForVideo(videoId);
      const clipWithUploadDate = archiveClips.find(c => c.ud);
      currentUploadDate = clipWithUploadDate ? clipWithUploadDate.ud : '';
      const clipWithEvent = archiveClips.find(c => c.ev);
      if (clipWithEvent && clipEventSelect && (forceReset || isEligibleForAutofill(clipEventSelect))) {
        if (Array.from(clipEventSelect.options).some(o => o.value === clipWithEvent.ev)) {
          setAutofilledValue(clipEventSelect, clipWithEvent.ev, tagAutoEvent);
        }
      }

      // 3. Cue Embedded YouTube Player Preview
      fetchedAuthorName = '';
      fetchedDurationSec = 0;
      initOrCuePlayer(videoId, startSec || 0);

      // 4. Fetch YouTube oEmbed Metadata
      const reqId = ++fetchReqCounter;
      setYtStatus('Fetching video details from YouTube…', 'loading');

      const meta = await fetchYoutubeOembed(videoId);
      if (reqId !== fetchReqCounter) return;

      if (meta && meta.title) {
        fetchedAuthorName = meta.author || fetchedAuthorName;
        applyFetchedVideoTitle(meta.title, forceReset);
        updateMetaInfoDisplay();
        setYtStatus(`✓ Auto-filled from YouTube${fetchedAuthorName ? ' · ' + fetchedAuthorName : ''}`, 'success');
      } else if (archiveClips.length > 0 && archiveClips[0].t) {
        applyFetchedVideoTitle(archiveClips[0].t, forceReset);
        updateMetaInfoDisplay();
        setYtStatus('✓ Auto-filled from existing archive metadata for this video.', 'success');
      } else {
        updateMetaInfoDisplay();
        setYtStatus('Preview loaded. Could not reach YouTube oEmbed — enter or verify the title below.', 'warn');
      }
    }

    let ytDebounceTimer = null;
    if (ytInput) {
      ytInput.addEventListener('paste', function() {
        if (ytDebounceTimer) clearTimeout(ytDebounceTimer);
        ytDebounceTimer = setTimeout(() => handleYoutubeUrlChange(false), 120);
      });
      ytInput.addEventListener('input', function() {
        if (ytDebounceTimer) clearTimeout(ytDebounceTimer);
        ytDebounceTimer = setTimeout(() => handleYoutubeUrlChange(false), 380);
      });
      ytInput.addEventListener('change', function() {
        if (ytDebounceTimer) clearTimeout(ytDebounceTimer);
        handleYoutubeUrlChange(false);
      });
    }
    if (btnRefetchYt) {
      btnRefetchYt.addEventListener('click', function() {
        handleYoutubeUrlChange(true);
      });
    }

    // ---- 6H. Initial Pre-fill from Query Params (?page=, ?url=, ?youtube=) or Referrer ----
    let initializedClipPrefill = false;
    function initClipPrefill() {
      if (initializedClipPrefill) return;
      initializedClipPrefill = true;

      const params = new URLSearchParams(window.location.search);
      let rawPage = params.get('page') || params.get('targetPage') || params.get('target_page') || params.get('ref') || '';
      if (!rawPage && document.referrer) {
        try {
          const ref = new URL(document.referrer);
          if (ref.origin === window.location.origin && !ref.pathname.includes('/suggest-')) {
            rawPage = ref.searchParams.get('page') || ref.pathname;
          }
        } catch (e) {}
      }

      const rawYtParam = params.get('url') || params.get('youtube') || params.get('v') || '';
      let initialAssocUrl = '';

      if (rawPage) {
        const decodedPage = decodeURIComponent(rawPage).trim();
        const norm = normalizeLookupPath(decodedPage);
        const refClip = clipByNormPath.get(norm) || (norm.startsWith('clips/') ? clipById.get(norm.slice(6)) : null);
        const refPage = pageByNormPath.get(norm);

        if (refClip) {
          // User clicked "Suggest a Clip" while viewing an existing clip page
          renderExistingClipOptions('', refClip.id);
          if (refClipBanner) {
            refClipBanner.innerHTML = '';
            const icon = document.createElement('span');
            icon.textContent = '🎬';
            const textWrap = document.createElement('span');
            textWrap.appendChild(document.createTextNode(`Came from clip "${refClip.t}": `));

            const btnLinkThis = document.createElement('button');
            btnLinkThis.type = 'button';
            btnLinkThis.className = 'inline-action-btn';
            btnLinkThis.style.marginRight = '6px';
            btnLinkThis.textContent = 'Link this clip to a page';
            btnLinkThis.addEventListener('click', () => switchToMode('link-existing'));
            textWrap.appendChild(btnLinkThis);

            if (refClip.yt) {
              const btnSameVid = document.createElement('button');
              btnSameVid.type = 'button';
              btnSameVid.className = 'inline-action-btn';
              btnSameVid.textContent = 'Add another clip from same YouTube video';
              btnSameVid.addEventListener('click', () => {
                switchToMode('new');
                if (ytInput) {
                  ytInput.value = `https://www.youtube.com/watch?v=${refClip.yt}`;
                  handleYoutubeUrlChange(true);
                }
              });
              textWrap.appendChild(btnSameVid);
            }

            refClipBanner.appendChild(icon);
            refClipBanner.appendChild(textWrap);
            refClipBanner.style.display = 'flex';
          }
        } else if (refPage && refPage.c === 'events' && refPage.eid) {
          // Came from an Event page: pre-select Event dropdown in New Clip mode
          if (clipEventSelect && Array.from(clipEventSelect.options).some(o => o.value === refPage.eid)) {
            setAutofilledValue(clipEventSelect, refPage.eid, tagAutoEvent);
          }
          const switchLink = document.getElementById('linkSwitchToChange');
          if (switchLink) {
            const base = switchLink.getAttribute('href').split('?')[0];
            switchLink.setAttribute('href', base + '?page=' + encodeURIComponent(refPage.u));
          }
        } else if (norm && norm !== '' && norm !== 'index') {
          initialAssocUrl = decodedPage;
        }
      }

      createAssocRow(initialAssocUrl);

      const modeParam = params.get('mode');
      if (modeParam === 'link-existing') {
        switchToMode('link-existing');
      }

      if (rawYtParam && ytInput && !ytInput.value.trim()) {
        ytInput.value = rawYtParam.trim();
        handleYoutubeUrlChange(false);
      } else if (ytInput && ytInput.value.trim()) {
        handleYoutubeUrlChange(false);
      }
    }

    initClipPrefill();
  } else {
    // -------------------------------------------------------------------------
    // 7. Page Content Suggestion Form (/suggest-changes/) Target Page Prefill
    // -------------------------------------------------------------------------
    function prefillChangeTargetPage() {
      const params = new URLSearchParams(window.location.search);
      let page = params.get('page') || params.get('targetPage') || params.get('target_page') || params.get('ref');
      if (!page && document.referrer) {
        try {
          const ref = new URL(document.referrer);
          if (ref.origin === window.location.origin) {
            page = ref.searchParams.get('page') || (!ref.pathname.includes('/suggest-') ? ref.pathname : '');
          }
        } catch (e) {}
      }
      if (page) {
        const decoded = decodeURIComponent(page).trim();
        const targetInput = document.getElementById('targetPage');
        if (targetInput && !targetInput.value.trim()) {
          targetInput.value = decoded;
          targetInput.classList.remove('has-error');
          const err = document.getElementById('err-targetPage');
          if (err) err.style.display = 'none';
        }
        const switchLink = document.getElementById('linkSwitchToClip') || document.getElementById('linkSwitchToChange');
        if (switchLink) {
          const base = switchLink.getAttribute('href').split('?')[0];
          switchLink.setAttribute('href', base + '?page=' + encodeURIComponent(decoded));
        }
      }
    }
    prefillChangeTargetPage();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', prefillChangeTargetPage);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Validation
  // ---------------------------------------------------------------------------
  function getResolvedExistingClip() {
    const sel = document.getElementById('existingClipSelect');
    const custom = document.getElementById('existingClipName');
    if (sel && sel.value && sel.value !== '__custom__') return sel.value.trim();
    return custom ? custom.value.trim() : '';
  }

  function getResolvedEventName() {
    const sel = document.getElementById('clipEventSelect');
    const custom = document.getElementById('clipEvent');
    if (sel) {
      if (sel.value === '__custom__') return custom ? custom.value.trim() : '';
      return sel.value.trim();
    }
    return custom ? custom.value.trim() : '';
  }

  function validate() {
    let valid = true;
    form.querySelectorAll('.submission-input, .submission-textarea, .submission-select').forEach(el => el.classList.remove('has-error'));
    form.querySelectorAll('.field-error-msg').forEach(el => el.style.display = 'none');

    function failField(el, errId, customMsg) {
      if (el) el.classList.add('has-error');
      const err = document.getElementById(errId);
      if (err) {
        if (customMsg) err.textContent = customMsg;
        err.style.display = 'block';
      }
      valid = false;
    }

    function checkRequired(id) {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) failField(el, 'err-' + id);
    }

    checkRequired('contributorName');

    if (!isClip) {
      checkRequired('targetPage');
      checkRequired('summary');
      checkRequired('markdownContent');
    } else {
      const mode = (document.querySelector('input[name="clipMode"]:checked') || {}).value || 'new';
      if (mode === 'new') {
        const ytEl = document.getElementById('clipYoutubeUrl');
        const { videoId } = parseYoutubeInput(ytEl ? ytEl.value : '');
        if (!videoId) {
          failField(ytEl, 'err-clipYoutubeUrl', 'Please provide a valid YouTube URL or 11-character video ID.');
        }

        const cidEl = document.getElementById('clipId');
        const cidVal = cidEl ? cidEl.value.trim() : '';
        if (!cidVal || !/^[a-z0-9_]+$/i.test(cidVal)) {
          failField(cidEl, 'err-clipId', 'Please enter a valid clip identifier using letters, numbers, and underscores.');
        } else if (existingClipIdsSet.has(cidVal.toLowerCase())) {
          failField(cidEl, 'err-clipId', `Clip ID "${cidVal.toLowerCase()}" already exists in the archive. Pick a unique ID or switch to "Link an Existing Clip".`);
        }

        checkRequired('clipTitle');

        const stEl = document.getElementById('clipStartTime');
        const etEl = document.getElementById('clipEndTime');
        const stSec = stEl && stEl.value.trim() ? parseTimestampToken(stEl.value) : null;
        const etSec = etEl && etEl.value.trim() ? parseTimestampToken(etEl.value) : null;

        if (stSec !== null && Number.isNaN(stSec)) {
          failField(stEl, 'err-clipStartTime', 'Invalid start time. Use seconds (e.g. 90) or mm:ss (e.g. 1:30).');
        }
        if (etSec !== null && Number.isNaN(etSec)) {
          failField(etEl, 'err-clipEndTime', 'Invalid end time. Use seconds (e.g. 120) or mm:ss (e.g. 2:00).');
        } else if (stSec !== null && etSec !== null && !Number.isNaN(stSec) && etSec <= stSec) {
          failField(etEl, 'err-clipEndTime', 'End Time must be greater than Start Time.');
        }
      } else {
        const existingVal = getResolvedExistingClip();
        if (!existingVal) {
          const sel = document.getElementById('existingClipSelect');
          const targetEl = sel && sel.value === '__custom__' ? document.getElementById('existingClipName') : sel;
          failField(targetEl, 'err-existingClipName');
        }
        const targetUrls = getSelectedTargetUrls();
        if (!targetUrls.length) {
          const primaryPageSel = document.getElementById('assocPagePrimary');
          failField(primaryPageSel, 'err-targetPage');
        }
      }
    }

    if (ccLicense && !ccLicense.checked) {
      if (licenseWarning) licenseWarning.style.display = 'block';
      valid = false;
    }

    if (!valid) {
      showAlert('Please check the highlighted fields above and accept the CC-BY-NC-SA 4.0 license agreement.', 'warning');
    } else {
      hideAlert();
    }
    return valid;
  }

  // ---------------------------------------------------------------------------
  // 9. Format Submission Data & Delimited Payload
  // ---------------------------------------------------------------------------
  function formatSubmission() {
    const ts = new Date().toISOString();
    const contributor = (document.getElementById('contributorName') || {}).value?.trim() || '';
    if (contributor) {
      try { window.localStorage.setItem(CONTRIBUTOR_STORAGE_KEY, contributor); } catch (e) {}
    }

    let metaLines = [], content = '', summary = '', labels = '';

    if (!isClip) {
      const targetPage = (document.getElementById('targetPage') || {}).value?.trim() || '';
      summary = (document.getElementById('summary') || {}).value?.trim() || '';
      content = (document.getElementById('markdownContent') || {}).value?.trim() || '';
      labels = 'content-suggestion,page-content';
      metaLines = [
        'Submission-Type: page-content',
        'Contributor-Name: ' + contributor,
        'Target-Page: ' + targetPage,
        'Summary: ' + summary
      ];
    } else {
      const mode = (document.querySelector('input[name="clipMode"]:checked') || {}).value || 'new';
      const targetUrls = getSelectedTargetUrls();
      const targetPageJoined = targetUrls.join(', ');

      if (mode === 'new') {
        const rawYt = (document.getElementById('clipYoutubeUrl') || {}).value?.trim() || '';
        const { videoId } = parseYoutubeInput(rawYt);
        const ytId = videoId || rawYt;
        const cid = (document.getElementById('clipId') || {}).value?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || '';
        const title = (document.getElementById('clipTitle') || {}).value?.trim() || '';
        const clipType = (document.getElementById('clipType') || {}).value || '';
        const rawStart = (document.getElementById('clipStartTime') || {}).value?.trim() || '';
        const rawEnd = (document.getElementById('clipEndTime') || {}).value?.trim() || '';
        const startSec = rawStart ? parseTimestampToken(rawStart) : null;
        const endSec = rawEnd ? parseTimestampToken(rawEnd) : null;
        const startFormatted = (startSec !== null && !Number.isNaN(startSec)) ? String(startSec) : rawStart;
        const endFormatted = (endSec !== null && !Number.isNaN(endSec)) ? String(endSec) : rawEnd;
        const eventName = getResolvedEventName();
        const notes = (document.getElementById('clipNotes') || {}).value?.trim() || '';

        summary = `New Clip: ${title} (${cid})`;
        labels = 'content-suggestion,new-clip';
        metaLines = [
          'Submission-Type: clip',
          'Clip-Mode: new',
          'Contributor-Name: ' + contributor,
          'Clip-ID: ' + cid,
          'YouTube-ID: ' + ytId,
          'Title: ' + title,
          'Target-Page: ' + (targetPageJoined || 'None'),
          'Summary: ' + summary
        ];
        if (clipType) metaLines.push('Clip-Type: ' + clipType);
        if (startFormatted) metaLines.push('Start-Time: ' + startFormatted);
        if (endFormatted) metaLines.push('End-Time: ' + endFormatted);
        if (eventName) metaLines.push('Event: ' + eventName);
        if (currentUploadDate) metaLines.push('Upload-Date: ' + currentUploadDate);
        content = notes || 'No additional clip description provided.';
      } else {
        const existing = getResolvedExistingClip();
        const notes = (document.getElementById('linkNotes') || {}).value?.trim() || '';
        summary = `Link Clip ${existing} to ${targetPageJoined}`;
        labels = 'content-suggestion,link-clip';
        metaLines = [
          'Submission-Type: clip',
          'Clip-Mode: link-existing',
          'Contributor-Name: ' + contributor,
          'Existing-Clip: ' + existing,
          'Target-Page: ' + targetPageJoined,
          'Summary: ' + summary
        ];
        content = notes || 'Propose associating this existing clip with the specified page.';
      }
    }

    const payload = [
      "Please send this message as-is. Do not alter the section markers below.",
      "",
      "---LICENSE AGREEMENT---",
      "I hereby license my submission under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC-BY-NC-SA 4.0) license and confirm I have the legal right to submit this content.",
      "License-Identifier: CC-BY-NC-SA-4.0",
      "Agreed: YES",
      "Timestamp: " + ts,
      "",
      "---METADATA---",
      metaLines.join("\n"),
      "",
      "---SUGGESTED CONTENT---",
      content,
      "---END SUBMISSION---"
    ].join("\n");

    return { summary, payload, labels };
  }

  // ---------------------------------------------------------------------------
  // 10. Copy & Submission Action Handlers
  // ---------------------------------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  function showManual(subject, payload) {
    const subEl = document.getElementById('manualSubject');
    const prevEl = document.getElementById('payloadPreview');
    const instEl = document.getElementById('manualInstructions');
    if (subEl) subEl.textContent = subject;
    if (prevEl) prevEl.textContent = payload;
    if (instEl) {
      instEl.style.display = 'block';
      instEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function handleAction(callback) {
    return function(e) {
      e.preventDefault();
      if (!validate()) return;
      const data = formatSubmission();
      callback(data, `[Site Suggestion] ${data.summary}`);
    };
  }

  const btnEmail = document.getElementById('btnEmailClient');
  if (btnEmail) {
    btnEmail.onclick = handleAction(({ payload }, subject) => {
      const mailto = `mailto:${encodeURIComponent(siteEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(payload)}`;
      if (mailto.length > 1950) {
        copyText(payload).then(() => {
          showAlert("Your submission exceeds email link limits (1,950 characters). The template has been copied to your clipboard!\n\nWhen your email app opens, paste (Ctrl+V / Cmd+V) into the message body.", "warning");
        });
        showManual(subject, payload);
        window.location.href = `mailto:${encodeURIComponent(siteEmail)}?subject=${encodeURIComponent(subject)}`;
      } else {
        window.location.href = mailto;
      }
    });
  }

  const btnGmail = document.getElementById('btnGmailWeb');
  if (btnGmail) {
    btnGmail.onclick = handleAction(({ payload }, subject) => {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(siteEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(payload)}`, '_blank', 'noopener,noreferrer');
    });
  }

  const btnCopy = document.getElementById('btnCopyTemplate');
  if (btnCopy) {
    btnCopy.onclick = handleAction(({ payload }, subject) => {
      copyText(payload).then(() => {
        showAlert("Submission template successfully copied to your clipboard!", "success");
        showManual(subject, payload);
      });
    });
  }

  const btnGithub = document.getElementById('btnGithubIssue');
  if (btnGithub) {
    btnGithub.onclick = handleAction(({ payload, labels }, subject) => {
      window.open(`https://github.com/${githubRepo}/issues/new?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(payload)}&labels=${encodeURIComponent(labels)}`, '_blank', 'noopener,noreferrer');
    });
  }

  // Clear errors on typing
  form.querySelectorAll('.submission-input, .submission-textarea, .submission-select').forEach(input => {
    input.addEventListener('input', function() {
      if (this.value.trim()) {
        this.classList.remove('has-error');
        const err = document.getElementById('err-' + this.id);
        if (err) err.style.display = 'none';
      }
    });
  });
})();
