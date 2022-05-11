#!/bin/bash

set -e

sudo apt-get update && sudo apt-get -y install npm
npm install .

node_modules/gulp-cli/bin/gulp.js sass
node_modules/gulp-cli/bin/gulp.js img
