---
name: pagespeed-insights
description: >-
  Use this skill when analyzing page performance, Core Web Vitals (LCP, FCP, CLS, TBT),
  or Google PageSpeed Insights reports for pages on www.lindycollection.com, or when optimizing layout
  structure, asset delivery, and SCSS for better Lighthouse scores.
---

# PageSpeed Insights Skill for www.lindycollection.com

This skill provides step-by-step procedures for fetching and analyzing Google PageSpeed Insights performance reports for pages on `www.lindycollection.com` and translating audit findings into structural code improvements.

---

## 🚀 Step-by-Step Procedure

### Step 1: Execute Performance Analysis

To analyze a specific page or route on the site (e.g. `/routines/california-routine/`, `/events/`, `/about/`, or `/`), run the helper script:

```bash
# Analyze mobile performance (default)
python3 .agents/skills/pagespeed-insights/scripts/fetch_pagespeed.py --url /routines/california-routine/ --strategy mobile

# Analyze desktop performance
python3 .agents/skills/pagespeed-insights/scripts/fetch_pagespeed.py --url /routines/california-routine/ --strategy desktop
```

> [!TIP]
> If a Google PageSpeed API key is available, pass `--api-key <KEY>` or set the `PAGESPEED_API_KEY` environment variable to prevent rate limiting (HTTP 429).

### Step 2: Extract & Present Report Summary

Present the audit summary to the user including:
1. **Direct Web Report Link**: e.g., `https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.lindycollection.com%2Froutines%2Fcalifornia-routine%2F&form_factor=mobile`
2. **Overview Scores**: Performance, Accessibility, Best Practices, SEO.
3. **Core Web Vitals**: FCP, LCP, TBT, CLS, Speed Index.
4. **Top Opportunities & Diagnostics**: Specific audits with potential byte or render time savings.

### Step 3: Consult Technical Reference

Refer to the metrics guide for deeper context on thresholds and technical optimization targets:
- [`references/metrics_guide.md`](./references/metrics_guide.md)

### Step 4: Formulate Structural Improvements

Identify concrete, non-content changes to optimize page structure on `www.lindycollection.com`:
- **Image Attributes**: Add explicit `width` and `height` to prevent Cumulative Layout Shift (CLS), and enable `loading="lazy"`.
- **Render-Blocking CSS/JS**: Update layout includes (`_includes/`, `_layouts/`) to defer non-critical scripts.
- **SCSS Optimization**: Refactor SCSS files under `_sass/` to prune unnecessary declarations.
- **Asset Pipeline**: Verify build tasks in `rebuild_css_and_images.bash` or `gulpfile.js`.

> [!CAUTION]
> **Strict Content Boundary**: In compliance with `AGENTS.md`, never modify or generate site text content, dancer bio information, routine summaries, or historical links. All changes must be strictly technical/structural.
