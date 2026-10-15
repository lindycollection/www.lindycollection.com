(function() {
  const form = document.getElementById('suggestionForm') || document.getElementById('clipSuggestionForm');
  if (!form) return;

  const isClip = form.id === 'clipSuggestionForm';
  const siteEmail = form.dataset.siteEmail || (window.LINDY_CONFIG && window.LINDY_CONFIG.siteEmail) || "lindycollectionsite@gmail.com";
  const githubRepo = form.dataset.githubRepo || (window.LINDY_CONFIG && window.LINDY_CONFIG.githubRepo) || "lindycollection/www.lindycollection.com";

  // Pre-fill target page from URL search params or referrer
  function prefillTargetPage() {
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
      if (targetInput) {
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
  prefillTargetPage();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prefillTargetPage);
  }
  window.addEventListener('load', prefillTargetPage);

  // Tab switching (Email vs GitHub)
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

  // License agreement checkbox state
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

  // Alerts
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

  // Clip Mode Toggle & Helpers
  if (isClip) {
    const subSectionNew = document.getElementById('subSectionNewClip');
    const subSectionLink = document.getElementById('subSectionLinkExisting');
    const targetStar = document.getElementById('targetPageRequiredStar');
    const targetHint = document.getElementById('targetPageHint');

    document.querySelectorAll('input[name="clipMode"]').forEach(radio => {
      radio.onchange = function() {
        const isNew = this.value === 'new';
        if (subSectionNew) subSectionNew.style.display = isNew ? 'block' : 'none';
        if (subSectionLink) subSectionLink.style.display = isNew ? 'none' : 'block';
        if (targetStar) targetStar.style.display = isNew ? 'none' : 'inline';
        if (targetHint) {
          targetHint.textContent = isNew
            ? 'Page URL to associate this clip with. Pre-filled if linked from a page, or can be left blank for standalone clips.'
            : 'The routine, aerial, or jazz page URL where this clip should be displayed.';
        }
        hideAlert();
      };
    });

    const ytInput = document.getElementById('clipYoutubeUrl');
    const startInput = document.getElementById('clipStartTime');
    if (ytInput) {
      ytInput.onblur = function() {
        const raw = this.value.trim();
        const m = raw.match(/[?&]t=([0-9hms]+)/);
        if (m && startInput && !startInput.value.trim()) {
          const t = m[1];
          let sec = 0;
          if (/^\d+s?$/.test(t)) sec = parseInt(t, 10);
          else {
            const h = t.match(/(\d+)h/), min = t.match(/(\d+)m/), s = t.match(/(\d+)s/);
            if (h) sec += parseInt(h[1], 10) * 3600;
            if (min) sec += parseInt(min[1], 10) * 60;
            if (s) sec += parseInt(s[1], 10);
          }
          if (sec > 0) startInput.value = sec;
        }
      };
    }

    const titleInput = document.getElementById('clipTitle');
    const clipIdInput = document.getElementById('clipId');
    if (titleInput && clipIdInput) {
      titleInput.onblur = function() {
        if (!clipIdInput.value.trim() && this.value.trim()) {
          clipIdInput.value = this.value.trim().toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 35);
        }
      };
    }
  }

  // Validation
  function validate() {
    let valid = true;
    form.querySelectorAll('.submission-input, .submission-textarea, .submission-select').forEach(el => el.classList.remove('has-error'));
    form.querySelectorAll('.field-error-msg').forEach(el => el.style.display = 'none');

    function check(id, condition) {
      const el = document.getElementById(id);
      if (el && (condition ? condition(el.value.trim()) : !el.value.trim())) {
        el.classList.add('has-error');
        const err = document.getElementById('err-' + id);
        if (err) err.style.display = 'block';
        valid = false;
      }
    }

    check('contributorName');

    if (!isClip) {
      check('targetPage');
      check('summary');
      check('markdownContent');
    } else {
      const mode = (document.querySelector('input[name="clipMode"]:checked') || {}).value || 'new';
      if (mode === 'new') {
        check('clipYoutubeUrl');
        check('clipId', v => !v || !/^[a-z0-9_]+$/i.test(v));
        check('clipTitle');
      } else {
        check('existingClipName');
        check('targetPage');
      }
    }

    if (ccLicense && !ccLicense.checked) {
      if (licenseWarning) licenseWarning.style.display = 'block';
      valid = false;
    }

    if (!valid) {
      showAlert('Please fill in all required fields and accept the CC-BY-NC-SA 4.0 license agreement.', 'warning');
    } else {
      hideAlert();
    }
    return valid;
  }

  // Format Submission Data & Delimited Payload
  function formatSubmission() {
    const ts = new Date().toISOString();
    const contributor = (document.getElementById('contributorName') || {}).value?.trim() || '';
    const targetPage = (document.getElementById('targetPage') || {}).value?.trim() || '';

    let metaLines = [], content = '', summary = '', labels = '';

    if (!isClip) {
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
      if (mode === 'new') {
        const rawYt = (document.getElementById('clipYoutubeUrl') || {}).value?.trim() || '';
        const ytMatch = rawYt.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        const ytId = ytMatch ? ytMatch[1] : rawYt;
        const cid = (document.getElementById('clipId') || {}).value?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || '';
        const title = (document.getElementById('clipTitle') || {}).value?.trim() || '';
        const clipType = (document.getElementById('clipType') || {}).value || '';
        const start = (document.getElementById('clipStartTime') || {}).value?.trim() || '';
        const end = (document.getElementById('clipEndTime') || {}).value?.trim() || '';
        const eventName = (document.getElementById('clipEvent') || {}).value?.trim() || '';
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
          'Target-Page: ' + (targetPage || 'None'),
          'Summary: ' + summary
        ];
        if (clipType) metaLines.push('Clip-Type: ' + clipType);
        if (start) metaLines.push('Start-Time: ' + start);
        if (end) metaLines.push('End-Time: ' + end);
        if (eventName) metaLines.push('Event: ' + eventName);
        content = notes || 'No additional clip description provided.';
      } else {
        const existing = (document.getElementById('existingClipName') || {}).value?.trim() || '';
        const notes = (document.getElementById('linkNotes') || {}).value?.trim() || '';
        summary = `Link Clip ${existing} to ${targetPage}`;
        labels = 'content-suggestion,link-clip';
        metaLines = [
          'Submission-Type: clip',
          'Clip-Mode: link-existing',
          'Contributor-Name: ' + contributor,
          'Existing-Clip: ' + existing,
          'Target-Page: ' + targetPage,
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

  // Copy & instruction helpers
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
