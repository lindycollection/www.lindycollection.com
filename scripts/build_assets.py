#!/usr/bin/env python3
import json
import os
import sys
import glob
import time
import hashlib
from pathlib import Path
from PIL import Image

try:
    import sass
except ImportError:
    print("Error: 'libsass' is not installed. Run 'pip install libsass Pillow'.", file=sys.stderr)
    sys.exit(1)

# Base directory setup
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent

SRC_SCSS = PROJECT_DIR / "_sass" / "main.scss"
INCLUDE_PATHS = [str(PROJECT_DIR / "_sass")]

CSS_DESTINATIONS = [
    PROJECT_DIR / "_includes" / "main.css",
    PROJECT_DIR / "assets" / "css" / "main.css",
    PROJECT_DIR / "_site" / "assets" / "css" / "main.css",
]

MAP_DESTINATIONS = [
    PROJECT_DIR / "assets" / "css" / "maps" / "main.css.map",
    PROJECT_DIR / "_site" / "assets" / "css" / "maps" / "main.css.map",
]

SRC_IMG_DIR = PROJECT_DIR / "_original_assets"
DEST_IMG_DIR = PROJECT_DIR / "assets" / "img" / "posts"
MANIFEST_FILE = DEST_IMG_DIR / ".build_manifest.json"

IMAGE_SPECS = [
    {"suffix": "_placehold", "width": 230},
    {"suffix": "_thumb", "width": 535},
    {"suffix": "_thumb@2x", "width": 1070},
    {"suffix": "_xs", "width": 575},
    {"suffix": "_sm", "width": 767},
    {"suffix": "_md", "width": 991},
    {"suffix": "_lg", "width": 1999},
    {"suffix": "", "width": 1920},
]


def compile_css():
    """Compiles SCSS into compressed CSS and generates sourcemaps."""
    if not SRC_SCSS.exists():
        print(f"Skipping SCSS compilation: {SRC_SCSS} not found.")
        return

    start = time.time()
    map_rel_path = "maps/main.css.map"
    
    compiled_css, sourcemap = sass.compile(
        filename=str(SRC_SCSS),
        output_style="compressed",
        include_paths=INCLUDE_PATHS,
        source_map_filename=map_rel_path,
        source_map_root="/assets/css/"
    )

    for dest_css in CSS_DESTINATIONS:
        dest_css.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_css, "w", encoding="utf-8") as f:
            f.write(compiled_css)

    for dest_map in MAP_DESTINATIONS:
        if dest_map.parent.parent.exists():  # Only write map if parent dir exists
            dest_map.parent.mkdir(parents=True, exist_ok=True)
            with open(dest_map, "w", encoding="utf-8") as f:
                f.write(sourcemap)

    print(f"[CSS] Compiled {SRC_SCSS.name} -> CSS in {time.time() - start:.3f}s")


def get_file_hash(filepath):
    """Returns SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def process_images():
    """Resizes original images into required variants with caching."""
    if not SRC_IMG_DIR.exists():
        print(f"Skipping image processing: {SRC_IMG_DIR} not found.")
        return

    DEST_IMG_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {}
    if MANIFEST_FILE.exists():
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            manifest = {}

    new_manifest = {}
    extensions = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")
    src_images = []
    for ext in extensions:
        src_images.extend(SRC_IMG_DIR.glob(ext))

    processed_count = 0
    skipped_count = 0
    start_time = time.time()

    for src_path in sorted(src_images):
        stem = src_path.stem
        mtime = src_path.stat().st_mtime
        file_hash = get_file_hash(src_path)
        cache_key = f"{src_path.name}:{file_hash}"

        # Check if all output files exist
        all_outputs_exist = True
        expected_outputs = []
        for spec in IMAGE_SPECS:
            out_name = f"{stem}{spec['suffix']}.jpg"
            out_path = DEST_IMG_DIR / out_name
            expected_outputs.append(out_path)
            if not out_path.exists():
                all_outputs_exist = False

        if all_outputs_exist and manifest.get(src_path.name) == cache_key:
            new_manifest[src_path.name] = cache_key
            skipped_count += 1
            continue

        # Process image
        try:
            with Image.open(src_path) as img:
                # Convert palette/RGBA images to RGB for JPEG export
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")
                
                orig_width, orig_height = img.size

                for spec, out_path in zip(IMAGE_SPECS, expected_outputs):
                    target_width = spec["width"]
                    # Calculate proportional height
                    target_height = int(round((target_width / float(orig_width)) * orig_height))
                    
                    resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                    resized_img.save(
                        out_path,
                        "JPEG",
                        quality=70,
                        progressive=True,
                        optimize=True
                    )
            
            new_manifest[src_path.name] = cache_key
            processed_count += 1
        except Exception as e:
            print(f"[IMG ERROR] Failed processing {src_path.name}: {e}", file=sys.stderr)

    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(new_manifest, f, indent=2)

    elapsed = time.time() - start_time
    print(f"[IMG] Resized {processed_count} image(s), skipped {skipped_count} up-to-date image(s) in {elapsed:.3f}s")


def main():
    compile_css()
    process_images()


if __name__ == "__main__":
    main()
