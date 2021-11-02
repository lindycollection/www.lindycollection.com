#!/usr/bin/env python3

import os
import subprocess
import yaml

clips_path = os.path.join(os.path.dirname(__file__), '../_clips')
print(clips_path)


clips_files = [f.name for f in os.scandir(clips_path) if f.name.endswith('.md')]
clips_files = [os.path.join(clips_path, f) for f in clips_files]
# print(clips_files)

errors = {}

for f in clips_files:
    try:
        fy = yaml.safe_load_all(open(f,'r').read())
    except yaml.composer.ComposerError as ex:
        print(f'failed to load {f} due to {ex}')
    try:
        yaml_head = next(fy)
        if not 'youtube_id' in yaml_head:
            print(f'Skipping {f}, no youtube_id')
            continue
        youtube_id = yaml_head['youtube_id']

        if len(youtube_id) != 11:
            print(f'Skipping {f}, {youtube_id} not 11 characters')
            continue

        cmd = ['youtube-dl', '--id', '--', youtube_id]
        subprocess.check_call(cmd)
    except yaml.scanner.ScannerError as ex:
        print(f'Error in file {f}: {ex}')
    except subprocess.CalledProcessError as ex:
        message = f'Error processing {f}: {youtube_id   }: {ex}'
        print(message)
        errors[youtube_id] = message

print(errors)