---
name: update-clip-end-times
description: >-
  Use this skill when reviewing, calculating, or updating missing end_time values
  for video clip files in _clips/. Guides the agent step-by-step through inspecting
  clips that have a start_time but no end_time, prompting the user for extra clip duration,
  computing end_time = start_time + extra_seconds, and updating the YAML frontmatter.
---

# Update Clip End Times Skill

This skill provides an interactive workflow for reviewing clips in `_clips/` that have a `start_time` set but are missing an `end_time`.

## Workflow Overview

1. Run the helper script to list all remaining clip files missing an `end_time`:
   ```bash
   python3 .agents/skills/update-clip-end-times/scripts/find_remaining_clips.py
   ```

2. Process clip files one at a time in order.

3. For each clip, present the following details to the user:
   - **Title**: Clip title from YAML frontmatter
   - **File**: Link to local markdown file using `file://` scheme (e.g., `[Filename.md](file:///absolute/path/to/_clips/Filename.md)`)
   - **Start Time**: `start_time` value in seconds
   - **Live Link**: `https://www.lindycollection.com/clips/<slug>/`

4. Ask the user for the number of extra seconds (duration of the clip segment).

5. When the user responds with an integer $X$:
   - Calculate `end_time = start_time + X`
   - Update the clip's markdown file frontmatter by inserting `end_time: "<calculated_value>"` directly after `start_time`.

6. Present the next clip in the list until all remaining clips are updated.

7. Once all clips are updated, verify the site build by running:
   ```bash
   source ../lcvenv/bin/activate
   ghrocker . --develop --build-only --mode non-interactive
   ```
