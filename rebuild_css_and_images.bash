#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd "$SCRIPT_DIR"

if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y python3-pip python3-venv
    fi
fi

PIP_CMD="pip"
if ! command -v pip &> /dev/null && command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
fi

$PIP_CMD install -q -r scripts/requirements.txt
python3 scripts/build_assets.py
