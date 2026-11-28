#!/usr/bin/env python3

import argparse
import pathlib
import yaml


from lxml import html
import requests


def parse_time_to_seconds(time_str):
    time_str = time_str.strip()
    if not time_str:
        return None
    if ':' in time_str:
        parts = time_str.split(':')
        if len(parts) == 2:
            minutes = int(parts[0])
            seconds = int(parts[1])
            return minutes * 60 + seconds
        elif len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = int(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        else:
            raise ValueError("Invalid time format.")
    else:
        return int(time_str)


def associate_clip_with_pages(clip_id, root_dir):
    collections_map = {
        'aerials': '_aerials',
        'events': '_events',
        'historical_clips': '_historical_clips',
        'historical_figures': '_historical_figures',
        'jazz': '_jazz',
        'routines': '_routines',
    }
    
    while True:
        add_to_existing = input("Do you want to associate this clip with an existing page [y/N]? ").lower().startswith('y')
        if not add_to_existing:
            break
            
        print("\nAvailable collections:")
        collections_list = sorted(list(collections_map.keys()))
        for idx, col in enumerate(collections_list, 1):
            print(f"  {idx}. {col}")
            
        collection_choice = None
        while True:
            choice = input("Select collection by number or name: ").strip()
            if not choice:
                continue
            if choice.isdigit():
                idx = int(choice)
                if 1 <= idx <= len(collections_list):
                    collection_choice = collections_list[idx - 1]
                    break
                else:
                    print(f"Invalid index. Choose between 1 and {len(collections_list)}.")
            else:
                if choice.lower() in collections_map:
                    collection_choice = choice.lower()
                    break
                print("Collection not found. Please try again.")
                
        # Find all markdown files in this collection
        col_dir = root_dir.joinpath(collections_map[collection_choice])
        pages = sorted(list(col_dir.glob('*.md')))
        if not pages:
            print(f"No pages found in collection '{collection_choice}'.")
            continue
            
        print(f"\nPages in collection '{collection_choice}':")
        for idx, page in enumerate(pages, 1):
            title = page.stem
            try:
                with open(page, 'r', encoding='utf-8') as f:
                    content = f.read()
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    fm = yaml.safe_load(parts[1])
                    if fm and 'title' in fm:
                        title = fm['title']
            except Exception:
                pass
            print(f"  {idx}. {title} ({page.name})")
            
        selected_page = None
        while True:
            choice = input("Select page by number or filename: ").strip()
            if not choice:
                continue
            if choice.isdigit():
                idx = int(choice)
                if 1 <= idx <= len(pages):
                    selected_page = pages[idx - 1]
                    break
                else:
                    print(f"Invalid index. Choose between 1 and {len(pages)}.")
            else:
                for page in pages:
                    if choice.lower() in [page.name.lower(), page.stem.lower()]:
                        selected_page = page
                        break
                if selected_page:
                    break
                print("Page not found. Please try again.")
                
        # Update the selected page to include the clip_id
        with open(selected_page, 'r', encoding='utf-8') as f:
            content = f.read()
            
        parts = content.split('---', 2)
        if len(parts) >= 3:
            fm_content = parts[1]
            body = parts[2]
            
            try:
                fm = yaml.safe_load(fm_content)
            except Exception as e:
                print(f"Error parsing YAML front matter in {selected_page.name}: {e}")
                continue
                
            if not fm:
                fm = {}
                
            if 'clips' not in fm:
                fm['clips'] = []
            elif not isinstance(fm['clips'], list):
                fm['clips'] = [fm['clips']]
                
            if clip_id not in fm['clips']:
                fm['clips'].append(clip_id)
                print(f"Adding '{clip_id}' to 'clips' list in {selected_page.name}.")
            else:
                print(f"'{clip_id}' is already in {selected_page.name}.")
                
            new_fm_content = yaml.safe_dump(fm, default_flow_style=False)
            new_content = f"---\n{new_fm_content}---{body}"
            
            with open(selected_page, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Successfully updated {selected_page.name}.\n")
        else:
            print(f"Could not find front matter format (---) in {selected_page.name}.\n")


def parse_media_source(raw_input):
    import re
    s = (raw_input or "").strip()
    ig_match = re.search(
        r'(?:instagram\.com|instagr\.am)/(?:(?!p/|reel/|reels/|tv/|stories/|share/|explore/)[A-Za-z0-9._]+/)?(p|reel|reels|tv)/([A-Za-z0-9_-]+)',
        s,
        re.IGNORECASE,
    )
    if ig_match:
        ig_type = ig_match.group(1).lower()
        if ig_type == 'reels':
            ig_type = 'reel'
        return {'platform': 'instagram', 'instagram_id': ig_match.group(2), 'instagram_type': ig_type}

    yt_match = re.search(
        r'(?:youtu\.be/|youtube(?:-nocookie)?\.com/(?:embed|shorts|live|v)/|[?&]v=)([A-Za-z0-9_-]{11})(?:[?&#/]|$)',
        s,
    )
    if yt_match:
        return {'platform': 'youtube', 'youtube_id': yt_match.group(1)}

    return {'platform': 'youtube', 'youtube_id': s}


parser = argparse.ArgumentParser(description='Generate Clip Metadata (YouTube or Instagram)')
parser.add_argument('clip_id', nargs='?', default=None, help='YouTube ID/URL or Instagram Post/Reel URL')

args = parser.parse_args()

clip_info = {}
clip_info['layout'] = 'post'

raw_source = args.clip_id
if not raw_source:
    raw_source = input("Please enter a YouTube ID/URL or Instagram Post/Reel URL: ").strip()

media = parse_media_source(raw_source)

import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
}

if media['platform'] == 'instagram':
    clip_info['instagram_id'] = media['instagram_id']
    clip_info['instagram_type'] = media['instagram_type']
    url = 'https://www.instagram.com/%s/%s/' % (clip_info['instagram_type'], clip_info['instagram_id'])
    fetched_title = ''
    try:
        page = requests.get(url, headers=headers, timeout=8)
        html_str = page.text
        tree = html.fromstring(page.content)
        og_titles = tree.xpath('//meta[@property="og:title"]/@content')
        raw_title = og_titles[0].strip() if og_titles else ''
        if not raw_title:
            titles = tree.xpath('/html/head/title')
            if titles and titles[0].text:
                raw_title = titles[0].text.strip()
        if raw_title and raw_title.lower() not in ('instagram', 'login • instagram'):
            cleaned = re.sub(r'\s*\|\s*Instagram\s*$', '', raw_title, flags=re.IGNORECASE).strip()
            if cleaned.lower() != 'instagram':
                fetched_title = cleaned
        upload_date_match = (re.search(r'"uploadDate":"([^"]+)"', html_str) or
                             re.search(r'"datePublished":"([^"]+)"', html_str))
        if upload_date_match:
            clip_info['upload_date'] = upload_date_match.group(1)
            print("Upload Date: %s" % clip_info['upload_date'])
    except Exception as exc:
        print("Could not auto-fetch metadata from Instagram (%s)." % exc)

    if fetched_title:
        print("Fetched Instagram Title/Caption: %s" % fetched_title)
        override_title = input("Enter clip title (press Enter to use fetched title): ").strip()
        clip_info['title'] = override_title if override_title else fetched_title
    else:
        while True:
            manual_title = input("Please enter the clip title: ").strip()
            if manual_title:
                clip_info['title'] = manual_title
                break
            print("Title cannot be empty.")
else:
    clip_info['youtube_id'] = media['youtube_id']
    url = 'https://youtube.com/watch?v=%s' % clip_info['youtube_id']

    page = requests.get(url, headers=headers)
    html_str = page.text

    tree = html.fromstring(page.content)

    clip_info['title'] = tree.xpath('/html/head/title')[0].text

    youtube_tag = ' - YouTube'
    print("Title: %s" % clip_info['title'])

    if clip_info['title'].endswith(youtube_tag):
        clip_info['title'] = clip_info['title'][0:-len(youtube_tag)]

    upload_date_match = (re.search(r'\"uploadDate\":\"([^\"]+)\"', html_str) or
                         re.search(r'itemprop=\"uploadDate\" content=\"([^\"]+)\"', html_str) or
                         re.search(r'\"datePublished\":\"([^\"]+)\"', html_str))

    if upload_date_match:
        clip_info['upload_date'] = upload_date_match.group(1)
        print("Upload Date: %s" % clip_info['upload_date'])

clip_info['clip_id'] = input("Please enter the clip shortname, lowercase_underscored: ")
is_tutorial = input("Is this a tutorial [y/N]? ").lower().startswith('y')
if is_tutorial:
    clip_info['clip_type'] = 'tutorial'
if not is_tutorial:
    is_interview = input("Is this an interview [y/N]? ").lower().startswith('y')
    if is_interview:
        clip_info['clip_type'] = 'interview'

# Ask if there's a starting time in the video (YouTube clips only), default no.
if 'youtube_id' in clip_info:
    has_start = input("Is there a starting time in the video [y/N]? ").lower().startswith('y')
    if has_start:
        while True:
            start_input = input("Enter start time (e.g. 90 or 1:30): ").strip()
            try:
                start_seconds = parse_time_to_seconds(start_input)
                if start_seconds is not None:
                    clip_info['start_time'] = start_seconds
                    
                    # If there is a start_time ask if there's an end_time, default no.
                    has_end = input("Is there an end time in the video [y/N]? ").lower().startswith('y')
                    if has_end:
                        while True:
                            end_input = input("Enter end time (e.g. 120 or 2:00): ").strip()
                            try:
                                end_seconds = parse_time_to_seconds(end_input)
                                if end_seconds is not None:
                                    clip_info['end_time'] = end_seconds
                                    break
                            except ValueError:
                                print("Invalid format. Please enter an integer or time format (MM:SS or HH:MM:SS).")
                break
            except ValueError:
                print("Invalid format. Please enter an integer or time format (MM:SS or HH:MM:SS).")

if 'upload_date' not in clip_info or not clip_info['upload_date']:
    manual_date = input("Could not automatically fetch upload_date. Enter upload date (YYYY-MM-DD or ISO 8601, press Enter to skip): ").strip()
    if manual_date:
        clip_info['upload_date'] = manual_date

TEMPLATE="""---
%s---

"""

short_filename = '%s.md' % clip_info['clip_id']

root_dir = pathlib.Path(__file__).parents[1]
clip_file = root_dir.joinpath('_clips').joinpath(short_filename).absolute()

print("Creating file: ", clip_file)

print("contents")

yaml_content = yaml.safe_dump(clip_info, default_flow_style=False)

out = TEMPLATE % yaml_content
print(out)

with open(clip_file, 'w') as fh:
    fh.write(out)

print('Please reference it with name %s' % clip_info['clip_id'])

associate_clip_with_pages(clip_info['clip_id'], root_dir)