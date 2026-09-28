# Lindy Collection

Thank you for visiting the source of https://www.lindycollection.com .
You are in the right place if you are hoping to contribute.
This site is designed to be a place to aggregate resources from the Lindy Hop community and help people find jumping off points to dig deeper.

It's being developed in an open model.
Please feel free to make suggestions I will do my best to accept things but contribtions need to fit with my best vision for the site.



## AI Agents & Automation

If you are an AI agent working in this repository, please consult [`AGENTS.md`](AGENTS.md) for critical rules on using `ghrocker` to prevent file access permission contamination when running Jekyll.

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/lindycollection/www.lindycollection.com . This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](http://contributor-covenant.org) code of conduct.

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg)](CODE_OF_CONDUCT.md)


## Development

This site is hosted on github pages using Jekyll but you can test it out yourself locally.

To test this site locally on linux:

Prerequisites will be to have [docker installed](https://docs.docker.com/install/) as well as python3 with the venv module.


```bash
# create a workspace
mkdir -p ~/lindycollection/lc_venv
cd ~/lindycollection
# Create a virtual env and activate it
python3 -m venv lc_venv
. ~/lindycollection/lc_venv/bin/activate
# install ghrocker 
pip install ghrocker
# Close the website
git clone https://github.com/lindycollection/www.lindycollection.com
ghrocker ~/lindycollection/www.lindycollection.com
```

The first run will take a little while to setup the environment. After it's built you can then browse to http://localhost:4000 to view the preview of the site.

To run it again go to
```
. ~/lindycollection/lc_venv/bin/activate
ghrocker ~/lindycollection/www.lindycollection.com

```

## Build Assets (CSS & Images)

CSS compilation and image resizing are managed by a fast Python script with incremental caching.

To rebuild CSS and generate image thumbnails:

```bash
./rebuild_css_and_images.bash
```

Or directly via Python:

```bash
python3 scripts/build_assets.py
```

### Adding New Images

To add a new original image, place the file in `_original_assets/` and run `./rebuild_css_and_images.bash`. The script will generate all required responsive size variants in `assets/img/posts/`. On subsequent runs, unchanged images will be skipped automatically in under a second.

## Creating a New Collection

To add a new content collection to the site:

1. **Register the Collection**: Edit `_config.yml` and add the collection under `collections:` with `output: true`:
   ```yaml
   collections:
     <collection_name>:
       output: true
   ```
2. **Create Collection Directory**: Create a folder named `_<collection_name>/` in the repository root (e.g., `_historical_figures/`).
3. **Create Landing Page**: Create `<collection_name>.md` at the repository root with front matter using the `category_home` layout:
   ```markdown
   ---
   layout: category_home
   title: Collection Title
   collection: <collection_name>
   ---
   ```
4. **Update Navigation Menu**: Add a link to the new collection page in `_includes/header.html`.
5. **Set Collection Emoji**: Update `_includes/collection_emoji.html` to map `<collection_name>` to a representative emoji for cross-reference chips:
   ```liquid
   {% when '<collection_name>' %}emoji 
   ```
6. **Update Scripts**: Add `'<collection_name>': '_<collection_name>'` to `collections_map` in `scripts/add_clip.py`.

## License

The theme is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

The content for this site is available under the CC-BY-NC-SA 4.0
