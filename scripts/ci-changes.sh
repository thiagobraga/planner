#!/usr/bin/env bash
# Prints "true" when a change list is a pure release bump or touches only docs
# and editor files, else "false".
#
# Input (stdin): GitHub files JSON ([{filename, patch}]), one or several arrays
# (`gh api --paginate` prints one per page). Judged on paths and diff content
# only, never on branch name or author. The docs set mirrors the `paths-ignore`
# list in ci.yml, so a docs-only PR still gets a passing "CI gate".
set -euo pipefail

jq -rs '
  def version_only:
    (.patch // "") | split("\n") | map(select(test("^[+-]")))
    | length > 0 and all(test("^[+-]\\s*\"version\": \"[0-9A-Za-z.+-]+\",?$"));

  def docs_only:
    test("\\.md$") or test("^\\.(specs|claude|vscode)/")
    or IN(".claudeignore", ".gitignore");

  map(if type == "array" then .[] else . end) as $files
  | ($files | length > 0) and all($files[];
      (.filename | IN(".release-manifest.json", "CHANGELOG.md"))
      or (.filename | docs_only)
      or ((.filename | IN("package.json", "package-lock.json",
                          "api/package.json", "api/package-lock.json",
                          "app/package.json", "app/package-lock.json",
                          "site/package.json", "site/package-lock.json"))
          and version_only))
'
