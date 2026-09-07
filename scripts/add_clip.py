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


parser = argparse.ArgumentParser(description='Generate Clip Metadata')
parser.add_argument('clip_id', nargs='?', default=None)

args = parser.parse_args()

clip_info = {}
clip_info['layout'] = 'post'

if not args.clip_id:
    clip_info['youtube_id'] = input("Please enter a youtube id: ")
else:
    clip_info['youtube_id'] = args.clip_id

url = 'https://youtube.com/watch?v=%s' % clip_info['youtube_id']

page = requests.get(url)

tree = html.fromstring(page.content)


clip_info['title'] = tree.xpath('/html/head/title')[0].text

youtube_tag = ' - YouTube'
print("Title: %s" % clip_info['title'])

if clip_info['title'].endswith(youtube_tag):
    clip_info['title'] = clip_info['title'][0:-len(youtube_tag)]

clip_info['clip_id'] = input("Please enter the clip shortname, lowercase_underscored: ")
is_tutorial = input("Is this a tutorial [y/N]? ").lower().startswith('y')
if is_tutorial:
    clip_info['clip_type'] = 'tutorial'
if not is_tutorial:
    is_interview = input("Is this an interview [y/N]? ").lower().startswith('y')
    if is_interview:
        clip_info['clip_type'] = 'interview'

# Ask if there's a starting time in the video, default no.
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


TEMPLATE="""---
%s
---

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