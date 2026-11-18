#!/usr/bin/env python3
"""Find clips that define start_time without end_time and print live + GitHub edit links."""

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import quote

import yaml

FRONTMATTER_RE = re.compile(
    r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)",
    re.DOTALL,
)

DEFAULT_SITE_URL = "https://www.lindycollection.com"
DEFAULT_GITHUB_BASE = "https://github.com"
DEFAULT_GITHUB_REPO = "lindycollection/www.lindycollection.com"
DEFAULT_BRANCH = "add_end_times"


def load_site_config(repo_root: Path) -> tuple[str, str, str]:
    config_path = repo_root / "_config.yml"
    site_url = DEFAULT_SITE_URL
    github_base = DEFAULT_GITHUB_BASE
    github_repo = DEFAULT_GITHUB_REPO

    if config_path.is_file():
        try:
            config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
            if isinstance(config, dict):
                if config.get("url"):
                    site_url = str(config["url"]).rstrip("/")
                baseurl = str(config.get("baseurl") or "").strip("/")
                if baseurl:
                    site_url = f"{site_url}/{baseurl}"

                gh = config.get("github")
                if isinstance(gh, dict):
                    if gh.get("url_base"):
                        github_base = str(gh["url_base"]).rstrip("/")
                    if gh.get("repository"):
                        github_repo = str(gh["repository"]).strip("/")
        except yaml.YAMLError as exc:
            print(f"Warning: failed to parse {config_path}: {exc}", file=sys.stderr)

    return site_url, github_base, github_repo


def has_value(val: object) -> bool:
    return val is not None and str(val).strip() != ""


def parse_frontmatter(clip_path: Path) -> dict | None:
    content = clip_path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(content)
    if not match:
        return None
    data = yaml.safe_load(match.group(1))
    return data if isinstance(data, dict) else None


def find_clips_missing_end_time(
    clips_dir: Path, include_unpublished: bool = False
) -> list[tuple[Path, dict]]:
    results: list[tuple[Path, dict]] = []
    for clip_path in sorted(clips_dir.glob("*.md")):
        try:
            data = parse_frontmatter(clip_path)
        except yaml.YAMLError as exc:
            print(f"Warning: failed to parse {clip_path.name}: {exc}", file=sys.stderr)
            continue

        if not data:
            continue

        if not include_unpublished and data.get("published") is False:
            continue

        if has_value(data.get("start_time")) and not has_value(data.get("end_time")):
            results.append((clip_path, data))

    return results


def build_live_url(site_url: str, clip_path: Path, data: dict) -> str:
    permalink = data.get("permalink")
    if has_value(permalink):
        rel_path = "/" + str(permalink).lstrip("/")
        return f"{site_url}{rel_path}"
    return f"{site_url}/clips/{quote(clip_path.stem)}/"


def build_edit_url(
    github_base: str, github_repo: str, branch: str, clip_path: Path
) -> str:
    encoded_branch = quote(branch, safe="/")
    encoded_filename = quote(clip_path.name)
    return f"{github_base}/{github_repo}/edit/{encoded_branch}/_clips/{encoded_filename}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Iterate through _clips/*.md, find clips with start_time and no end_time, "
            "and print live page and GitHub web editor links."
        )
    )
    parser.add_argument(
        "-b",
        "--branch",
        default=DEFAULT_BRANCH,
        help=f"Target branch for GitHub edit links (default: {DEFAULT_BRANCH})",
    )
    parser.add_argument(
        "--markdown",
        action="store_true",
        help="Format output as a Markdown checklist",
    )
    parser.add_argument(
        "--include-unpublished",
        action="store_true",
        help="Include clips with published: false",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    clips_dir = repo_root / "_clips"
    if not clips_dir.is_dir():
        print(f"Error: clips directory not found at {clips_dir}", file=sys.stderr)
        return 1

    site_url, github_base, github_repo = load_site_config(repo_root)
    matches = find_clips_missing_end_time(
        clips_dir, include_unpublished=args.include_unpublished
    )

    print(f"Found {len(matches)} clip(s) with start_time and no end_time:\n")

    for idx, (clip_path, data) in enumerate(matches, start=1):
        title = data.get("title") or clip_path.stem
        start_time = data.get("start_time")
        live_url = build_live_url(site_url, clip_path, data)
        edit_url = build_edit_url(github_base, github_repo, args.branch, clip_path)

        if args.markdown:
            print(
                f"- [ ] **{title}** (`{clip_path.name}`, `start_time: {start_time}`) "
                f"— [Live Page]({live_url}) | [Edit on GitHub]({edit_url})"
            )
        else:
            print(f"{idx}. {title} ({clip_path.name}, start_time: {start_time})")
            print(f"   Live: {live_url}")
            print(f"   Edit: {edit_url}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
