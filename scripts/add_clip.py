#!/usr/bin/env python3

import argparse
import em
import pathlib


from lxml import html
import requests


parser = argparse.ArgumentParser(description='Generate Clip Metadata')
parser.add_argument('clip_id', nargs='?', default=None)

args = parser.parse_args()

clip_info = {}

if not args.clip_id:
    clip_info['clip_id'] = input("Plese enter a youtube id: ")
else:
    clip_info['clip_id'] = args.clip_id

url = 'https://youtube.com/watch?v=%s' % args.clip_id

page = requests.get(url)

tree = html.fromstring(page.content)



clip_info['title'] = tree.xpath('/html/head/title')[0].text

clip_info['clip_shortname'] = input("Please enter the clip shortname, lowercase_underscored: ")
clip_info['is_tutorial'] = input("Is this a tutorial [y/N]?").lower().startswith('y')

TEMPLATE="""---
layout: post
title: '@(title)'
youtube_id: '@(clip_id)'
clip_id: '@(clip_shortname)'
@[if is_tutorial]@
@('clip_type: tutorial')
@[end if]@
---

"""

short_filename = '%s.md' % clip_info['clip_shortname']

clip_file = pathlib.Path(__file__).parents[1].joinpath('_clips').joinpath(short_filename).absolute()




print("Creating file: ", clip_file)

print("contents")

out = em.expand(TEMPLATE, clip_info)
print(out)

with open(clip_file, 'w') as fh:
    fh.write(out)

print('Please reference it with name %s' % clip_info['clip_shortname'])