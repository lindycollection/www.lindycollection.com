#!/usr/bin/env python3
import os
import glob
import yaml

# Resolve path to _clips
script_dir = os.path.dirname(os.path.abspath(__file__))
# script is in .agents/skills/update-clip-end-times/scripts
repo_dir = os.path.abspath(os.path.join(script_dir, "..", "..", "..", ".."))
clips_dir = os.path.join(repo_dir, "_clips")

files = sorted(glob.glob(os.path.join(clips_dir, "*.md")))

remaining = []
for f in files:
    with open(f, "r", encoding="utf-8") as file:
        content = file.read()
    parts = content.split("---", 2)
    if len(parts) >= 3:
        try:
            data = yaml.safe_load(parts[1])
            if isinstance(data, dict):
                start = data.get("start_time")
                end = data.get("end_time")
                if start is not None and end is None:
                    remaining.append({
                        "file": f,
                        "filename": os.path.basename(f),
                        "slug": os.path.basename(f)[:-3],
                        "title": data.get("title", ""),
                        "start_time": int(start)
                    })
        except Exception:
            pass

print(f"Found {len(remaining)} clips needing end_time:")
for i, item in enumerate(remaining, 1):
    print(f"{i}. {item['filename']} | start_time: {item['start_time']} | title: {item['title']}")
