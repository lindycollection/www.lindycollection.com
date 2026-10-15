#!/usr/bin/env python3
"""
parse_submission.py

Parses issue submissions for Lindy Collection, verifies CC-BY-NC-SA 4.0 license agreement,
sanitizes metadata (ensuring no raw emails are recorded), and generates:
1. Clip Submission:
   - Mode 'new': Creates _clips/<clip_id>.md and _submissions/...md, and optionally associates with target page.
   - Mode 'link-existing': Associates existing clip with target page and creates _submissions/...md.
2. Page Body Content:
   - Creates _submissions/<YYYY-MM-DD>-issue-<number>-<slug>.md with proposed markdown.
Sets GitHub Actions step outputs for branch, commit, and PR creation.
"""

import os
import re
import sys
import json
import glob
import urllib.request
from datetime import datetime, timezone


def post_issue_comment(repo: str, issue_number: str, token: str, body: str) -> bool:
    """Post a comment to a GitHub issue via the GitHub REST API."""
    if not (token and repo and issue_number):
        print("[WARN] Missing repo, issue_number, or token; skipping issue comment.", file=sys.stderr)
        return False

    url = f"https://api.github.com/repos/{repo}/issues/{issue_number}/comments"
    data = json.dumps({"body": body}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "LindyCollection-Submission-Parser",
            "X-GitHub-Api-Version": "2022-11-28"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 201):
                print(f"[INFO] Successfully posted comment to issue #{issue_number}.")
                return True
    except Exception as e:
        print(f"[WARN] Failed to post comment on issue #{issue_number}: {e}", file=sys.stderr)
    return False


def set_github_output(name: str, value: str):
    """Write output key-value pair to GITHUB_OUTPUT file supporting multiline values."""
    output_path = os.environ.get("GITHUB_OUTPUT")
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as f:
        if "\n" in value:
            delim = f"DELIM_{os.urandom(8).hex()}"
            f.write(f"{name}<<{delim}\n{value}\n{delim}\n")
        else:
            f.write(f"{name}={value}\n")


def sanitize_no_email(text: str) -> str:
    """Ensure no raw email addresses are present in text."""
    pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    return re.sub(pattern, lambda m: m.group(0).split('@')[0] or "contributor", text)


def slugify(text: str, max_length: int = 40) -> str:
    """Convert text into a URL/filename-safe slug."""
    text = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return (text or "content-suggestion")[:max_length].rstrip('-')


def parse_time_to_seconds(time_str: str):
    """Parse time string ('90', '1:30', '01:30') into seconds string."""
    s = (time_str or "").strip()
    if not s:
        return None
    if ':' in s:
        parts = s.split(':')
        try:
            if len(parts) == 2:
                return str(int(parts[0]) * 60 + int(parts[1]))
            elif len(parts) == 3:
                return str(int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2]))
        except ValueError:
            return s
    return s if s.isdigit() else s


def write_frontmatter_file(path: str, fm_dict: dict, body: str = ""):
    """Write a markdown file with YAML frontmatter."""
    lines = ["---"]
    for k, v in fm_dict.items():
        if v is not None and v != "":
            if isinstance(v, (int, float)):
                lines.append(f"{k}: {v}")
            elif isinstance(v, str) and (v.startswith("'") or v.startswith('"')):
                lines.append(f"{k}: {v}")
            else:
                escaped = str(v).replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')
                lines.append(f'{k}: "{escaped}"')
    lines.append("---")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n\n" + (body.strip() if body else "") + "\n")


def find_target_page_file(target_page: str):
    """Attempt to locate the local markdown file corresponding to target_page URL."""
    if not target_page:
        return None
    cleaned = target_page.strip()
    if '://' in cleaned:
        cleaned = cleaned.split('://', 1)[1].split('/', 1)[-1] if '/' in cleaned.split('://', 1)[1] else ''
    cleaned = cleaned.split('?')[0].split('#')[0].strip('/')
    if not cleaned or cleaned.lower() == 'none':
        return None

    collections = ['_routines', '_aerials', '_jazz', '_historical_clips', '_historical_figures', '_events']
    parts = cleaned.split('/')
    if len(parts) >= 2:
        candidate = os.path.join(f"_{parts[0]}", f"{parts[1]}.md")
        if os.path.exists(candidate):
            return candidate
    elif len(parts) == 1:
        stem = parts[0]
        for col in collections:
            candidate = os.path.join(col, f"{stem}.md")
            if os.path.exists(candidate):
                return candidate
        matches = glob.glob(os.path.join('_posts', f"*-{stem}.md"))
        if matches:
            return matches[0]
    return None


def associate_clip_with_file(file_path: str, clip_id: str) -> bool:
    """Add clip_id to clips list in a page markdown frontmatter."""
    if not (file_path and os.path.exists(file_path)):
        return False
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    parts = content.split('---', 2)
    if len(parts) < 3 or clip_id in parts[1]:
        return bool(clip_id in parts[1]) if len(parts) >= 3 else False

    fm_raw, body = parts[1], parts[2]
    bracket_match = re.search(r'clips:\s*\[(.*?)\]', fm_raw, re.DOTALL)
    if bracket_match:
        items = bracket_match.group(1).strip()
        new_items = f"{items},\n    {clip_id}" if items else f"{clip_id}"
        new_fm = fm_raw[:bracket_match.start(1)] + new_items + fm_raw[bracket_match.end(1):]
    else:
        dash_match = re.search(r'(clips:\s*\n(?:\s*-\s*[^\n]+\n)+)', fm_raw)
        if dash_match:
            new_fm = fm_raw[:dash_match.end(1)] + f"  - {clip_id}\n" + fm_raw[dash_match.end(1):]
        else:
            new_fm = fm_raw.rstrip() + f"\nclips:\n  - {clip_id}\n"

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"---{new_fm}---{body}")
    print(f"[INFO] Associated clip '{clip_id}' with '{file_path}'.")
    return True


def parse_submission_sections(body: str) -> dict:
    """Extract delimited submission sections."""
    sections = {}
    current_key = None
    buffer = []
    markers = {
        '---LICENSE AGREEMENT---': 'license',
        '---METADATA---': 'metadata',
        '---SUGGESTED CONTENT---': 'content',
        '---END SUBMISSION---': None
    }
    for line in body.split("\n"):
        stripped = line.strip()
        if stripped in markers:
            if current_key:
                sections[current_key] = "\n".join(buffer).strip()
                buffer = []
            current_key = markers[stripped]
        elif current_key:
            buffer.append(line)
    if current_key and current_key not in sections:
        sections[current_key] = "\n".join(buffer).strip()
    return sections


def main():
    issue_number = os.environ.get("ISSUE_NUMBER", "").strip() or "0"
    issue_title = os.environ.get("ISSUE_TITLE", "").strip()
    issue_body = os.environ.get("ISSUE_BODY", "").replace("\r\n", "\n").replace("\r", "\n")
    github_repo = os.environ.get("GITHUB_REPOSITORY", "lindycollection/www.lindycollection.com").strip()
    github_token = os.environ.get("GITHUB_TOKEN", "").strip()

    print(f"[INFO] Processing submission for Issue #{issue_number}: {issue_title}")
    sections = parse_submission_sections(issue_body)
    license_text = sections.get("license", "")

    # 1. Verify CC-BY-NC-SA 4.0 License Agreement
    has_id = bool(re.search(r'License-Identifier:\s*CC-BY-NC(?:-SA)?-4\.0', license_text, re.IGNORECASE))
    has_agreed = bool(re.search(r'Agreed:\s*YES\b', license_text, re.IGNORECASE))
    if not (has_id and has_agreed):
        print(f"[ERROR] License verification failed (has_id={has_id}, has_agreed={has_agreed})")
        abort_comment = (
            f"👋 Thank you for your contribution to Lindy Collection!\n\n"
            f"⚠️ **Automated Pull Request Aborted: Missing CC-BY-NC-SA 4.0 Sign-off**\n\n"
            f"All submissions require an intact Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC-BY-NC-SA 4.0) agreement:\n"
            f"- `License-Identifier: CC-BY-NC-SA-4.0` (required)\n"
            f"- `Agreed: YES` (required)\n\n"
            f"Please re-submit your suggestion using the [Content Suggestion Form](https://www.lindycollection.com/suggest-changes/) "
            f"or [New Clip Form](https://www.lindycollection.com/suggest-new-clip/) with the license agreement intact."
        )
        post_issue_comment(github_repo, issue_number, github_token, abort_comment)
        set_github_output("status", "aborted")
        set_github_output("abort_reason", "Missing or invalid CC-BY-NC-SA 4.0 license agreement")
        sys.exit(0)

    # 2. Parse Metadata
    meta = {}
    for line in sections.get("metadata", "").split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip()

    ts_match = re.search(r'Timestamp:\s*([^\r\n]+)', license_text, re.IGNORECASE)
    timestamp = ts_match.group(1).strip() if ts_match else meta.get("timestamp", datetime.now(timezone.utc).isoformat())
    date_str = timestamp[:10] if len(timestamp) >= 10 else datetime.now(timezone.utc).strftime("%Y-%m-%d")

    contributor = sanitize_no_email(meta.get("contributor-name") or meta.get("contributor") or "Anonymous Contributor")
    submission_type = meta.get("submission-type", "page-content").lower()
    email_trace_id = meta.get("email-trace-id", "").strip()
    suggested_content = sections.get("content", "")

    branch_name = f"suggestion/issue-{issue_number}"
    created_files = []
    associated_page_msg = ""

    # 3. Process Submission by Type
    if submission_type == "clip":
        clip_mode = meta.get("clip-mode", "new").lower()
        if clip_mode == "new":
            clip_id = (meta.get("clip-id", "").lower().replace(' ', '_')) or f"clip_issue_{issue_number}"
            clip_title = meta.get("title") or meta.get("clip-title") or f"Clip Submission #{issue_number}"
            youtube_id = meta.get("youtube-id", "")
            target_page = meta.get("target-page", "")

            # Create _clips/<clip_id>.md
            clip_file = os.path.join("_clips", f"{clip_id}.md")
            clip_fm = {
                "layout": "post",
                "title": clip_title,
                "youtube_id": youtube_id,
                "clip_id": f"'{clip_id}'"
            }
            if meta.get("clip-type"):
                clip_fm["clip_type"] = f"'{meta['clip-type']}'"
            if parse_time_to_seconds(meta.get("start-time")):
                clip_fm["start_time"] = f"'{parse_time_to_seconds(meta['start-time'])}'"
            if parse_time_to_seconds(meta.get("end-time")):
                clip_fm["end_time"] = f"'{parse_time_to_seconds(meta['end-time'])}'"
            if meta.get("event"):
                clip_fm["event"] = meta["event"]

            clip_body = suggested_content if "No additional clip description" not in suggested_content else ""
            write_frontmatter_file(clip_file, clip_fm, clip_body)
            created_files.append(clip_file)

            # Create _submissions entry
            sub_file = os.path.join("_submissions", f"{date_str}-issue-{issue_number}-clip-{clip_id}.md")
            sub_fm = {
                "submission_type": "clip", "clip_mode": "new", "clip_id": clip_id,
                "youtube_id": youtube_id, "title": clip_title, "contributor": contributor,
                "target_page": target_page, "timestamp": timestamp, "license": "CC-BY-NC-SA-4.0",
                "source_issue": issue_number
            }
            if email_trace_id:
                sub_fm["email_trace_id"] = email_trace_id
            write_frontmatter_file(sub_file, sub_fm, suggested_content)
            created_files.append(sub_file)

            page_file = find_target_page_file(target_page)
            if page_file and associate_clip_with_file(page_file, clip_id):
                created_files.append(page_file)
                associated_page_msg = f"- **Associated with Page:** `{page_file}`\n"

            summary = f"New Clip: {clip_title} ({clip_id})"
            pr_title = f"[New Clip] {clip_title} ({clip_id}) (Closes #{issue_number})"
            commit_msg = f"Add new clip: {clip_title} ({clip_id})\n\nContributor: {contributor}\nYouTube ID: {youtube_id}\n\nLicense: CC-BY-NC-SA-4.0"

        else: # link-existing
            existing_clip = meta.get("existing-clip", "").strip().strip('/')
            if existing_clip.startswith('clips/'):
                existing_clip = existing_clip.split('/')[-1]
            target_page = meta.get("target-page", "")

            sub_file = os.path.join("_submissions", f"{date_str}-issue-{issue_number}-link-{slugify(existing_clip)}.md")
            sub_fm = {
                "submission_type": "clip", "clip_mode": "link-existing", "existing_clip": existing_clip,
                "target_page": target_page, "contributor": contributor, "timestamp": timestamp,
                "license": "CC-BY-NC-SA-4.0", "source_issue": issue_number
            }
            if email_trace_id:
                sub_fm["email_trace_id"] = email_trace_id
            write_frontmatter_file(sub_file, sub_fm, suggested_content)
            created_files.append(sub_file)

            page_file = find_target_page_file(target_page)
            if page_file and associate_clip_with_file(page_file, existing_clip):
                created_files.append(page_file)
                associated_page_msg = f"- **Linked to Page:** `{page_file}`\n"

            summary = f"Link Clip {existing_clip} to {target_page}"
            pr_title = f"[Link Clip] {existing_clip} to {target_page} (Closes #{issue_number})"
            commit_msg = f"Link existing clip {existing_clip} to {target_page}\n\nContributor: {contributor}\n\nLicense: CC-BY-NC-SA-4.0"

    else: # page-content
        target_page = sanitize_no_email(meta.get("target-page", "") or "General")
        summary = meta.get("summary", "")
        if not summary:
            clean_title = re.sub(r'^\[Site Suggestion\]\s*', '', issue_title, flags=re.IGNORECASE).strip()
            summary = clean_title or "Page content suggestion"
        summary = sanitize_no_email(summary)

        sub_file = os.path.join("_submissions", f"{date_str}-issue-{issue_number}-{slugify(summary)}.md")
        sub_fm = {
            "submission_type": "page-content", "contributor": contributor, "target_page": target_page,
            "summary": summary, "timestamp": timestamp, "license": "CC-BY-NC-SA-4.0",
            "source_issue": issue_number
        }
        if email_trace_id:
            sub_fm["email_trace_id"] = email_trace_id
        write_frontmatter_file(sub_file, sub_fm, suggested_content)
        created_files.append(sub_file)

        pr_title = f"[Page Content] {summary} (Closes #{issue_number})"
        commit_msg = f"Add page content suggestion for {target_page}\n\nSummary: {summary}\nContributor: {contributor}\n\nLicense: CC-BY-NC-SA-4.0"

    # 4. Prepare PR Outputs
    email_trace_md = f"- **Email Trace ID:** `{email_trace_id}`\n" if email_trace_id else ""
    created_files_list = "\n".join([f"  - `{p}`" for p in created_files])
    pr_body = (
        f"Automated submission received via Issue #{issue_number}.\n\n"
        f"### Submission Details\n"
        f"- **Submission Type:** `{submission_type}`\n"
        f"- **Contributor:** {contributor}\n"
        f"- **Summary:** {summary}\n"
        f"- **License:** CC-BY-NC-SA-4.0 (Agreed)\n"
        f"{email_trace_md}"
        f"{associated_page_msg}"
        f"- **Files Created / Modified:**\n{created_files_list}\n\n"
        f"Closes #{issue_number}"
    )

    set_github_output("status", "success")
    set_github_output("branch_name", branch_name)
    set_github_output("commit_msg", commit_msg)
    set_github_output("pr_title", pr_title)
    set_github_output("pr_body", pr_body)
    set_github_output("issue_number", issue_number)
    print(f"[INFO] Successfully prepared PR for branch: {branch_name}")


if __name__ == "__main__":
    main()
