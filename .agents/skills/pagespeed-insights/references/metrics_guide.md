# Core Web Vitals & Optimization Guide for www.lindycollection.com

This reference document explains performance metrics reported by Google PageSpeed Insights and details optimization strategies for `www.lindycollection.com`.

---

## 🟢 Metric Thresholds & Targets

| Metric | Target (Good) | Needs Improvement | Poor | Primary Causes on Static Sites |
| :--- | :--- | :--- | :--- | :--- |
| **First Contentful Paint (FCP)** | ≤ 1.8s | 1.8s - 3.0s | > 3.0s | Render-blocking CSS/JS, slow font loading, server latency |
| **Largest Contentful Paint (LCP)** | ≤ 2.5s | 2.5s - 4.0s | > 4.0s | Unoptimized hero images, large CSS files blocking render |
| **Total Blocking Time (TBT)** | ≤ 200ms | 200ms - 600ms | > 600ms | Heavy JavaScript parsing & execution on main thread |
| **Cumulative Layout Shift (CLS)** | ≤ 0.1 | 0.1 - 0.25 | > 0.25 | Images without explicit `width`/`height` attributes, web fonts swapping |
| **Speed Index (SI)** | ≤ 3.4s | 3.4s - 5.8s | > 5.8s | Render delay of above-the-fold visual elements |

---

## 🛠️ Performance Optimization Playbook for LindyCollection

### 1. Image Optimization & Preventing Layout Shift (CLS)
- **Explicit Image Dimensions**: Always include `width="..."` and `height="..."` attributes on `<img>` tags in Jekyll layouts and markdown helpers.
- **Lazy Loading**: Add `loading="lazy"` to offscreen images, keeping `decoding="async"` for non-critical assets.
- **Modern Formats**: Convert large PNG/JPG hero images to WebP or AVIF using the site's Gulp asset pipeline (`rebuild_css_and_images.bash`).

### 2. SCSS & CSS Optimization (FCP / LCP)
- **Minification**: Ensure Gulp build pipeline outputs minified CSS in production.
- **SCSS Modularization**: Check `_sass/` modules to prune unused CSS classes and reduce critical stylesheet byte size.

### 3. JavaScript Optimization (TBT)
- **Non-blocking Scripts**: Ensure external scripts (e.g. video embed scripts or interactive widgets) load with `defer` or `async` attributes in `_includes/` templates.
- **Third-Party Script Isolation**: Defer execution of analytics or external widgets until after main content rendering.

---

## 🚫 Content Guidelines Reminder

> [!CAUTION]
> When applying performance improvements identified by PageSpeed Insights:
> - **DO**: Modify SCSS, HTML tags, layout wrappers, asset pipeline settings, and image attribute structures.
> - **DO NOT**: Alter or generate site copy, historical descriptions, routine summaries, or external links.
