#!/usr/bin/env python3
"""
Fetch and analyze Google PageSpeed Insights report for pages on www.lindycollection.com.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import argparse

DEFAULT_BASE_URL = "https://www.lindycollection.com"

def normalize_url(path_or_url: str) -> str:
    return urllib.parse.urljoin(DEFAULT_BASE_URL + "/", path_or_url.strip())

def build_web_report_url(target_url: str, strategy: str = "mobile") -> str:
    params = urllib.parse.urlencode({"url": target_url, "form_factor": strategy})
    return f"https://pagespeed.web.dev/analysis?{params}"

def fetch_psi_data(target_url: str, strategy: str = "mobile", api_key: str = None) -> tuple[dict, str]:
    categories = ["performance", "accessibility", "best-practices", "seo"]
    query_items = [("url", target_url), ("strategy", strategy)]
    query_items.extend(("category", c) for c in categories)
    if api_key:
        query_items.append(("key", api_key))
        
    api_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?{urllib.parse.urlencode(query_items)}"
    req = urllib.request.Request(api_url, headers={"User-Agent": "LindyCollection-PSI-Agent/1.0"})
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data, None
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return None, (
                "HTTP 429 (Too Many Requests): Rate limit reached for public PageSpeed Insights API.\n"
                "To resolve, set the PAGESPEED_API_KEY environment variable or pass --api-key <KEY>.\n"
                f"You can also view the live report directly in your browser: {build_web_report_url(target_url, strategy)}"
            )
        return None, f"HTTP Error {e.code}: {e.reason}"
    except Exception as e:
        return None, f"Network or request error: {str(e)}"

def format_score(score: float) -> str:
    if score is None:
        return "N/A"
    status = "🟢" if score >= 0.9 else "🟠" if score >= 0.5 else "🔴"
    return f"{status} {score * 100:.0f}/100"

def parse_lighthouse_report(data: dict, target_url: str, strategy: str) -> str:
    lh = data.get("lighthouseResult", {})
    categories = lh.get("categories", {})
    audits = lh.get("audits", {})
    
    perf_score = categories.get("performance", {}).get("score")
    a11y_score = categories.get("accessibility", {}).get("score")
    bp_score = categories.get("best-practices", {}).get("score")
    seo_score = categories.get("seo", {}).get("score")
    
    web_report_url = build_web_report_url(target_url, strategy)
    
    output = []
    output.append(f"# PageSpeed Insights Analysis Report")
    output.append(f"- **Target Page**: `{target_url}`")
    output.append(f"- **Strategy**: `{strategy}`")
    output.append(f"- **Full PSI Report Link**: [View on PageSpeed Insights]({web_report_url})")
    output.append("")
    
    output.append("## 📊 Overview Scores")
    output.append(f"| Category | Score |")
    output.append(f"| :--- | :--- |")
    output.append(f"| **Performance** | {format_score(perf_score)} |")
    output.append(f"| **Accessibility** | {format_score(a11y_score)} |")
    output.append(f"| **Best Practices** | {format_score(bp_score)} |")
    output.append(f"| **SEO** | {format_score(seo_score)} |")
    output.append("")
    
    output.append("## ⚡ Core Web Vitals & Metrics")
    metrics_list = [
        ("first-contentful-paint", "First Contentful Paint (FCP)"),
        ("largest-contentful-paint", "Largest Contentful Paint (LCP)"),
        ("total-blocking-time", "Total Blocking Time (TBT)"),
        ("cumulative-layout-shift", "Cumulative Layout Shift (CLS)"),
        ("speed-index", "Speed Index (SI)"),
        ("interactive", "Time to Interactive (TTI)"),
    ]
    
    output.append("| Metric | Value | Score |")
    output.append("| :--- | :--- | :--- |")
    for audit_key, label in metrics_list:
        if audit_key in audits:
            item = audits[audit_key]
            disp = item.get("displayValue", "N/A")
            s = item.get("score")
            s_str = format_score(s) if s is not None else "N/A"
            output.append(f"| **{label}** | {disp} | {s_str} |")
    output.append("")
    
    output.append("## 🎯 Top Optimization Opportunities")
    opp_found = False
    for audit_key, audit in audits.items():
        details = audit.get("details", {})
        if details.get("type") == "opportunity" and audit.get("score") is not None and audit.get("score") < 0.9:
            title = audit.get("title")
            disp = audit.get("displayValue") or f"Score: {audit.get('score') * 100:.0f}"
            desc = audit.get("description", "").split(". ")[0] + "."
            output.append(f"- **{title}** (`{disp}`)")
            output.append(f"  - *Context*: {desc}")
            opp_found = True
    if not opp_found:
        output.append("No critical opportunity audit failures found (>90% scores across opportunity audits).")
    output.append("")
    
    output.append("## 🔍 Key Diagnostics")
    diag_keys = ["dom-size", "mainthread-work-breakdown", "render-blocking-resources", "uses-responsive-images", "offscreen-images"]
    diag_found = False
    for d_key in diag_keys:
        if d_key in audits:
            item = audits[d_key]
            if item.get("score") is not None and item.get("score") < 0.9:
                title = item.get("title")
                disp = item.get("displayValue", "")
                output.append(f"- **{title}** ({disp})")
                diag_found = True
    if not diag_found:
        output.append("No diagnostic warnings found.")
    output.append("")
    
    output.append("## 🛠️ Actionable Structural Recommendations for www.lindycollection.com")
    output.append("1. **Asset Pipeline**: Verify that CSS files generated in `_sass/` and Gulp build scripts are minified.")
    output.append("2. **Images**: Ensure images in `assets/` or post layouts specify explicit `width` and `height` attributes to prevent CLS, and use responsive `srcset` or WebP formats.")
    output.append("3. **Scripts**: Confirm JS resources in layout templates use `defer` or `async` loading.")
    
    return "\n".join(output)

def main():
    parser = argparse.ArgumentParser(description="Fetch PageSpeed Insights report for www.lindycollection.com")
    parser.add_argument("--url", "-u", default="/routines/california-routine/", help="Target URL or site relative path (e.g. /routines/california-routine/)")
    parser.add_argument("--strategy", "-s", choices=["mobile", "desktop"], default="mobile", help="Analysis strategy (default: mobile)")
    parser.add_argument("--api-key", "-k", default=os.environ.get("PAGESPEED_API_KEY"), help="Google PageSpeed Insights API Key")
    parser.add_argument("--format", "-f", choices=["markdown", "json"], default="markdown", help="Output format")
    
    args = parser.parse_args()
    
    target_url = normalize_url(args.url)
    print(f"Analyzing {target_url} (Strategy: {args.strategy})...", file=sys.stderr)
    
    data, error = fetch_psi_data(target_url, strategy=args.strategy, api_key=args.api_key)
    
    if error:
        web_url = build_web_report_url(target_url, args.strategy)
        if args.format == "json":
            print(json.dumps({"error": error, "target_url": target_url, "web_report_url": web_url}, indent=2))
        else:
            print(f"⚠️ PageSpeed Insights API Notice:\n{error}\n\nLive Analysis Link: {web_url}")
        sys.exit(1)
        
    if args.format == "json":
        print(json.dumps(data, indent=2))
    else:
        report_md = parse_lighthouse_report(data, target_url, args.strategy)
        print(report_md)

if __name__ == "__main__":
    main()
