#!/usr/bin/env bash
# Every <code class="lean">Namespace.decl</code> on the site must be declared, inside that
# namespace, on the published branch (origin/main) of one of the Lean repositories.
# Usage: tools/check_site_lean_names.sh [repo ...]
#   default repos: the nrs3-* and nava-robertson-schrodinger clones next to this one.
set -u
here=$(cd "$(dirname "$0")/.." && pwd)
repos=("$@")
if [ ${#repos[@]} -eq 0 ]; then
  repos=("$here"/../nrs3-* "$here"/../nava-robertson-schrodinger)
fi
ref=${REF:-origin/main}
kw='(theorem|lemma|def|abbrev|structure|class|instance|inductive)'

names=$(grep -rhoE '<code class="lean">[^<]+</code>' "$here/docs" | sed -E 's/<[^>]+>//g' | sort -u)
total=0; bad=0
for name in $names; do
  total=$((total + 1))
  ns=${name%.*}; decl=${name##*.}
  found=""
  for r in "${repos[@]}"; do
    git -C "$r" rev-parse -q --verify "$ref" >/dev/null 2>&1 || continue
    for f in $(git -C "$r" grep -lE "^[[:space:]]*(@\[[^]]*\][[:space:]]*)?((private|protected|noncomputable|nonrec)[[:space:]]+)*$kw[[:space:]]+$decl([[:space:]]|$)" "$ref" -- '*.lean' 2>/dev/null); do
      if git -C "$r" show "$f" | grep -qE "^namespace ([A-Za-z0-9_]+\.)*$ns([[:space:]]|$)"; then
        found="$(basename "$r"):${f#"$ref":}"; break 2
      fi
    done
  done
  if [ -n "$found" ]; then
    echo "ok    $name  ($found)"
  else
    echo "MISS  $name"; bad=$((bad + 1))
  fi
done
echo "$total names, $bad missing"
[ "$bad" -eq 0 ]
