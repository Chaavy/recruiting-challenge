#!/bin/sh
# Points git at the versioned hooks in .githooks/ (JS-006). Run by `npm install`
# through the `prepare` script, or by hand with `npm run prepare`.
# core.hooksPath is a per-clone setting, so every fresh clone needs this once.

set -u

if ! command -v git >/dev/null 2>&1; then
  echo "install-hooks: git not found, hooks not installed"
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "install-hooks: not inside a git work tree, hooks not installed"
  exit 0
fi

# A failure here is a real error and must be visible: no `|| true`.
git config core.hooksPath .githooks
echo "install-hooks: core.hooksPath = $(git config core.hooksPath)"
