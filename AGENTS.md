# Agent Guide for www.lindycollection.com

This document provides instructions and boundaries for AI agents working in this repository.

---

## 🚫 CRITICAL DIRECTIVE: NO AI-GENERATED CONTENT

> [!CAUTION]
> **Agents MUST NEVER create or generate site content.**
>
> - **Allowed Tasks**: Agents are permitted to make **structural changes**, refactor scripts, update build automations, modify layouts, refine SCSS/CSS styling, fix Gulp pipeline tasks, and update CI/CD workflows.
> - **Prohibited Tasks**: Agents must **NOT** author, generate, or hallucinate content (such as blog posts, historical clips, routine descriptions, dancer biographies, event listings, or external links/URLs).
> - **Rationale**: Generative AI models are prone to hallucinating historical facts, inaccurate community attribution, and broken or fabricated links. Content must be authored directly by human contributors.

---

## ⚠️ CRITICAL REQUIREMENT: Docker & File Permission Management

### The Problem: Naive Docker Invocations Contaminate File Permissions
When executing Jekyll or build tools inside Docker containers using naive commands (e.g. `docker run -v $(pwd):/site jekyll/jekyll jekyll build` or standard `docker-compose`), Docker defaults to running as `root:root`. 

This causes Docker to write build artifacts into `.jekyll-cache/`, `_site/`, and `node_modules/` owned by `root:root` (UID 0, GID 0). Once this occurs:
- Host user operations (and subsequent container builds running as non-root users) lose write access to `.jekyll-cache/` and `_site/`.
- Future builds fail with errors such as `Permission denied @ dir_s_mkdir - /tmp/jekyll/.jekyll-cache` or `Permission denied` when generating pages.

---

## 🛠️ The Solution: Always Use `ghrocker` with `--develop` (or `rocker --user`)

`ghrocker` (a Docker wrapper built on `rocker`) automatically injects the `--user` extension, mounting the host user's UID and GID and running containerized tasks as that user.

> [!IMPORTANT]
> **Always include the `--develop` flag** when invoking `ghrocker`.
> `--develop` builds the container image locally to guarantee that installed Ruby gems and dependencies match the repository's `Gemfile.lock`. If `--develop` is omitted, `ghrocker` will attempt to use a prebuilt image which may have mismatched gem versions and cause build failures.

### 1. Python Environment Setup
Before invoking `ghrocker`, activate the virtual environment containing `ghrocker`:

```bash
# Activate workspace virtual environment (relative to repository):
source ../lcvenv/bin/activate

# Or if creating a fresh environment:
python3 -m venv lcvenv
source lcvenv/bin/activate
pip install ghrocker
```

### 2. Standard `ghrocker` Usage Commands

- **Build / Test Site (Non-Interactive / CI Mode)**:
  ```bash
  ghrocker . --develop --build-only --mode non-interactive
  ```

- **Serve Site Locally (Interactive Mode)**:
  ```bash
  ghrocker . --develop
  ```
  *(Serves website preview at http://localhost:4000)*

- **Debug / Interactive Shell**:
  ```bash
  ghrocker . --develop --debug-inside
  ```

- **Running Maintenance Scripts (Gulp / Image & CSS Rebuilding)**:
  Always pass `--user` when using `rocker` directly:
  ```bash
  rocker --user --volume=$(pwd):/tmp/jekyll ubuntu:jammy /tmp/jekyll/rebuild_css_and_images.bash
  ```

---

## 🧹 Permission Contamination Remediation

If a naive `docker` invocation was accidentally executed and contaminated permissions:

1. **Fix Ownership**:
   Restore ownership of `.jekyll-cache`, `_site`, and `node_modules` back to the host user:
   ```bash
   sudo chown -R $(id -u):$(id -g) .jekyll-cache _site node_modules
   ```

2. **Clean Cache**:
   Alternatively, remove the root-owned build output directories:
   ```bash
   sudo rm -rf .jekyll-cache _site
   ```

---

## 📋 General Repository Workflows

- **Jekyll Pages**: Site posts, clips, events, and pages are written in Markdown with YAML frontmatter.
- **Styles & Assets**: SCSS styles reside in `_sass/`. Compiled CSS and image variants are generated using Gulp via `rebuild_css_and_images.bash`.
- **Pre-Commit Check**: Before committing changes, run `ghrocker . --develop --build-only --mode non-interactive` to verify that Jekyll processes all files without permission or syntax errors.
