/**
 * Google Apps Script: gmail-to-github.gs
 * 
 * Automatically converts structured content suggestions received via Gmail into
 * GitHub Issues on the Lindy Collection repository.
 * 
 * Requirements:
 * - Checks incoming emails labeled "Pending-PR"
 * - Verifies SPF or DKIM passing headers (Authentication-Results: dkim=pass or spf=pass)
 * - Extracts RFC 2822 Message-ID for permanent identity traceability
 * - Sanitizes body to isolate delimited markers and injects Email-Trace-ID into ---METADATA---
 * - Creates GitHub Issue with labels ["content-suggestion", "via-email"]
 * - Transitions Gmail label from "Pending-PR" to "PR-Created"
 */

// Configuration Defaults (can be overridden in Script Properties)
const DEFAULT_REPO_OWNER = 'lindycollection';
const DEFAULT_REPO_NAME = 'www.lindycollection.com';
const LABEL_PENDING = 'Pending-PR';
const LABEL_CREATED = 'PR-Created';
const LABEL_REJECTED = 'PR-Rejected';

/**
 * Main scheduled trigger handler.
 * Run every 5 minutes via Google Apps Script time-driven trigger.
 */
function processPendingSuggestions() {
  const props = PropertiesService.getScriptProperties();
  const githubToken = props.getProperty('GITHUB_TOKEN');
  const repoOwner = props.getProperty('REPO_OWNER') || DEFAULT_REPO_OWNER;
  const repoName = props.getProperty('REPO_NAME') || DEFAULT_REPO_NAME;

  if (!githubToken) {
    Logger.log('[ERROR] GITHUB_TOKEN not configured in Script Properties.');
    return;
  }

  // Ensure labels exist
  const pendingLabel = getOrCreateLabel(LABEL_PENDING);
  const createdLabel = getOrCreateLabel(LABEL_CREATED);
  const rejectedLabel = getOrCreateLabel(LABEL_REJECTED);

  // Search for threads with the Pending-PR label
  const threads = GmailApp.search('label:' + LABEL_PENDING);
  Logger.log('[INFO] Found ' + threads.length + ' thread(s) with label ' + LABEL_PENDING);

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    if (!messages || messages.length === 0) continue;

    // Process the latest incoming message in the thread
    const message = messages[messages.length - 1];
    const rawContent = message.getRawContent();

    Logger.log('[INFO] Processing message subject: "' + message.getSubject() + '"');

    // 1. Verify SPF / DKIM Authentication
    const isAuthentic = verifyEmailAuthentication(rawContent);
    if (!isAuthentic) {
      Logger.log('[WARN] Message failed DKIM/SPF authentication check. Marking as rejected.');
      thread.removeLabel(pendingLabel);
      thread.addLabel(rejectedLabel);
      continue;
    }

    // 2. Extract RFC 2822 Message-ID
    const messageId = extractMessageId(rawContent);
    if (!messageId) {
      Logger.log('[WARN] Could not extract Message-ID. Proceeding with fallback ID.');
    }
    const traceId = messageId || ('<gmail-msg-' + message.getId() + '@mail.gmail.com>');

    // 3. Validate Delimited Markers & Sanitize Body
    const rawBody = message.getPlainBody();
    const sanitizedBody = sanitizeAndInjectTraceId(rawBody, traceId);

    if (!sanitizedBody) {
      Logger.log('[WARN] Message body does not contain required section markers. Rejecting.');
      thread.removeLabel(pendingLabel);
      thread.addLabel(rejectedLabel);
      continue;
    }

    // 4. Prepare Issue Title
    let title = message.getSubject() ? message.getSubject().trim() : '[Site Suggestion] Content Submission';
    if (!title.toLowerCase().startsWith('[site suggestion]')) {
      title = '[Site Suggestion] ' + title;
    }

    // 5. Create GitHub Issue
    const issueCreated = createGitHubIssue(repoOwner, repoName, githubToken, title, sanitizedBody);
    if (issueCreated) {
      thread.removeLabel(pendingLabel);
      thread.addLabel(createdLabel);
      Logger.log('[SUCCESS] Created GitHub issue for thread: ' + title);
    } else {
      Logger.log('[ERROR] Failed to create GitHub issue. Thread remains ' + LABEL_PENDING + ' for retry.');
    }
  }
}

/**
 * Verify SPF or DKIM passing headers in Authentication-Results.
 */
function verifyEmailAuthentication(rawContent) {
  // Regex to extract all Authentication-Results headers (handles multi-line unfolding)
  const authResultsRegex = /^Authentication-Results:[^]+?(?=\r?\n[^\t ]|\r?\n\r?\n|$)/gim;
  const matches = rawContent.match(authResultsRegex);

  if (matches) {
    for (let i = 0; i < matches.length; i++) {
      const header = matches[i];
      if (/dkim\s*=\s*pass/i.test(header) || /spf\s*=\s*pass/i.test(header)) {
        return true;
      }
    }
  }

  // Secondary check: Received-SPF header
  const receivedSpfRegex = /^Received-SPF:\s*pass/im;
  if (receivedSpfRegex.test(rawContent)) {
    return true;
  }

  return false;
}

/**
 * Extract RFC 2822 Message-ID from raw email headers.
 */
function extractMessageId(rawContent) {
  const match = rawContent.match(/^Message-ID:\s*(<[^>\r\n]+>|[^\s\r\n]+)/im);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Validate markers, strip external content/signatures, and inject Email-Trace-ID.
 */
function sanitizeAndInjectTraceId(body, messageId) {
  const startMarker = '---LICENSE AGREEMENT---';
  const endMarker = '---END SUBMISSION---';

  const startIndex = body.indexOf(startMarker);
  const endIndex = body.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  // Extract only the structured block between start and end markers
  let payload = body.substring(startIndex, endIndex + endMarker.length).trim();

  // Prepend standardized instructional header
  const standardHeader = 'Please send this message as-is. Do not alter the section markers below.\n\n';
  payload = standardHeader + payload;

  // Inject Email-Trace-ID into ---METADATA--- section
  if (payload.indexOf('---METADATA---') !== -1) {
    payload = payload.replace(
      '---METADATA---',
      '---METADATA---\nEmail-Trace-ID: ' + messageId
    );
  }

  return payload;
}

/**
 * Call GitHub REST API to create a new Issue.
 */
function createGitHubIssue(owner, repo, token, title, body) {
  const url = 'https://api.github.com/repos/' + owner + '/' + repo + '/issues';

  const payload = {
    title: title,
    body: body,
    labels: ['content-suggestion', 'via-email']
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'LindyCollection-Gmail-Submission',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const content = response.getContentText();

    if (code === 201) {
      const data = JSON.parse(content);
      Logger.log('[INFO] GitHub Issue #' + data.number + ' created: ' + data.html_url);
      return true;
    } else {
      Logger.log('[ERROR] GitHub API returned status ' + code + ': ' + content);
      return false;
    }
  } catch (err) {
    Logger.log('[ERROR] Network error contacting GitHub API: ' + err);
    return false;
  }
}

/**
 * Helper to get or create a Gmail label.
 */
function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}
