#!/bin/bash

set -e

sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
export NODE_MAJOR=20
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt-get update && sudo apt-get -y install npm
CXXFLAGS="--std=c++17" npm install .

node_modules/gulp-cli/bin/gulp.js sass
node_modules/gulp-cli/bin/gulp.js img
