#!/usr/bin/env python3

import argparse
import pathlib
import yaml


from lxml import html
import requests


parser = argparse.ArgumentParser(description='Generate Clip Metadata')
parser.add_argument('clip_id', nargs='?', default=None)

args = parser.parse_args()

clip_info = {}
clip_info['layout'] = 'post'

if not args.clip_id:
    clip_info['youtube_id'] = input("Plese enter a youtube id: ")
else:
    clip_info['youtube_id'] = args.clip_id

url = 'https://youtube.com/watch?v=%s' % args.clip_id

page = requests.get(url)

tree = html.fromstring(page.content)



clip_info['title'] = tree.xpath('/html/head/title')[0].text

youtube_tag = ' - YouTube'

if clip_info['title'].endswith(youtube_tag):
    clip_info['title'] = clip_info['title'][:-len(youtube_tag)]

clip_info['clip_id'] = input("Please enter the clip shortname, lowercase_underscored: ")
is_tutorial = input("Is this a tutorial [y/N]?").lower().startswith('y')
if is_tutorial:
    clip_info['clip_type'] = 'tutorial'


TEMPLATE="""---
%s
---

"""

short_filename = '%s.md' % clip_info['clip_id']

clip_file = pathlib.Path(__file__).parents[1].joinpath('_clips').joinpath(short_filename).absolute()




print("Creating file: ", clip_file)

print("contents")

yaml = yaml.safe_dump(clip_info)

out = TEMPLATE % yaml
print(out)

with open(clip_file, 'w') as fh:
    fh.write(out)

print('Please reference it with name %s' % clip_info['clip_id'])