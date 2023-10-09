#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

sudo apt-get update && sudo apt-get -y install npm
cd $SCRIPT_DIR
CXXFLAGS="--std=c++17" npm install .

node_modules/gulp-cli/bin/gulp.js sass
node_modules/gulp-cli/bin/gulp.js img
