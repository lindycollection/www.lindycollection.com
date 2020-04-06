# Lindy Collection

Thank you for visiting the source of https://www.lindycollection.com .
You are in the right place if you are hoping to contribute.
This site is designed to be a place to aggregate resources from the Lindy Hop community and help people find jumping off points to dig deeper.

It's being developed in an open model.
Please feel free to make suggestions I will do my best to accept things but contribtions need to fit with my best vision for the site.



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
# install rocker 
pip install git+git@github.com:osrf/rocker.git@ghjekyll
# Close the website
git clone https://github.com/lindycollection/www.lindycollection.com
ghrocker ~/lindycollection/www.lindycollection.com
```

To run it again go to
```
. ~/lindycollection/lc_venv/bin/activate
ghrocker ~/lindycollection/www.lindycollection.com

```

## Gulp Environment

There are a few site maintenace items that need to use gulp.
Most contributors won't need to use this.

```
. ~/lindycollection/lc_venv/bin/activate
ghrocker ~/lindycollection/www.lindycollection.com --debug
sudo apt-get update && sudo apt-get install npm
npm install .
npm install gulp-cli
```

Note: if you're using this environment the node_modules may cause jekyll's inode watcher to fail. You can manually trigger jekyll with `--no-watch` if you use `ghrocker ~/lindycollection/www.lindycollection.com --debug` then call `jekyll serve --no-watch` inside and manually retrigger it when changes have been made.

### Update Formatting

To update the css from the scss.

With the above gulp environment

```
node_modules/gulp-cli/bin/gulp.js sass
```

Commit the results.


### Updating Images

If you want to add an image drop the file in the directory: 
`assets/img/posts/` with an extension `.jpg` and then run this script to generate all the appropriate scaled copies.

```
node_modules/gulp-cli/bin/gulp.js img
```

The commit the resultant files.

## License

The theme is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

The content for this site is available under the CC-BY-NC-SA 4.0