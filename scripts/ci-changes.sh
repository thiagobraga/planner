#!/usr/bin/env bash
# Prints "true" when a change list is a pure release bump, else "false".
#
# Input (stdin): GitHub files JSON ([{filename, patch}]), one or several arrays
# (`gh api --paginate` prints one per page). Judged on diff content only, never
# on branch name or author, so nothing but a real version bump can skip CI.
set -euo pipefail

jq -rs '
  def version_only:
    (.patch // "") | split("\n") | map(select(test("^[+-]")))
    | length > 0 and all(test("^[+-]\\s*\"version\": \"[0-9A-Za-z.+-]+\",?$"));

  map(if type == "array" then .[] else . end) as $files
  | ($files | length > 0) and all($files[];
      (.filename | IN(".release-manifest.json", "CHANGELOG.md"))
      or ((.filename | IN("package.json", "package-lock.json",
                          "api/package.json", "api/package-lock.json",
                          "app/package.json", "app/package-lock.json"))
          and version_only))
'
