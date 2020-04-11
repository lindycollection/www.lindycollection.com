#!/usr/bin/env python3


import em
import pathlib


title = input("Plese enter a title: ")

clip_id = input("Please enter the clip ID: ")
clip_shortname = input("Please enter the clip shortname, lowercase_underscored: ")
is_tutorial = input("Is this a tutorial [y/N]?").lower().startswith('y')

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

short_filename = '%s.md' % clip_shortname

clip_file = pathlib.Path(__file__).parents[1].joinpath('_clips').joinpath(short_filename).absolute()




print("Creating file: ", clip_file)

print("contents")

out = em.expand(TEMPLATE, locals())
print(out)

with open(clip_file, 'w') as fh:
    fh.write(out)

print('Please reference it with name %s' % clip_shortname)