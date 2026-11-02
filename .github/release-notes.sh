#!/usr/bin/env bash
# Notes of an API version for its GitHub Release (ADR 0011), written from git, nothing to write by hand: what the
# operator must read before deploying (commits marked « ! » or « BREAKING CHANGE: », Conventional Commits), the new
# migrations, then the commits since the previous version. Only commits touching backend/ count: the images are built
# from it, the app and the site are released on their own. Fails if a migration of the previous version was changed or
# removed: Flyway would refuse to migrate.
#   .github/release-notes.sh api-v1.3.0 > notes.md          (run by the CI on a tag; needs the whole history and the tags)
set -euo pipefail

tag=${1:?usage: release-notes.sh <tag api-vX.Y.Z>}
# The previous version, release candidates (api-v1.3.0-rc.1) excluded
previous=$(git describe --tags --abbrev=0 --match 'api-v*' --exclude 'api-v*-*' "$tag^" 2>/dev/null || true)
range=${previous:+$previous..}$tag
BACKEND=backend
MIGRATIONS=backend/migrations

if [ -n "$previous" ]; then
  changed=$(git diff --name-only --diff-filter=DMR "$previous" "$tag" -- "$MIGRATIONS/V*.sql" "$MIGRATIONS/B*.sql")
  if [ -n "$changed" ]; then
    echo "Migrations of $previous changed or removed (Flyway would refuse to migrate):" >&2
    echo "$changed" >&2
    exit 1
  fi
  added=$(git diff --name-only --diff-filter=A "$previous" "$tag" -- "$MIGRATIONS/V*.sql" "$MIGRATIONS/B*.sql")
else
  added=$(git ls-tree --name-only "$tag" "$MIGRATIONS/" | grep -E '/[VB][0-9]+__.+\.sql$' || true)
fi

# Commits marked breaking: « type!: » or « type(scope)!: » in the subject, or a « BREAKING CHANGE: » line
breaking=$(git log --no-merges --format='%H' "$range" -- "$BACKEND" | while read -r commit; do
  subject=$(git log -1 --format='%s' "$commit")
  footer=$(git log -1 --format='%b' "$commit" | sed -n 's/^BREAKING[ -]CHANGE: *//p')
  if [[ $subject =~ ^[a-z]+(\([^\)]*\))?!: ]] || [ -n "$footer" ]; then
    printf -- '- %s\n' "$subject"
    [ -z "$footer" ] || printf -- '  %s\n' "$footer"
  fi
done)

echo '## À lire avant de déployer'
echo
if [ -n "$breaking" ]; then
  echo "$breaking"
else
  echo 'Rien : aucune variable, aucune version de PostgreSQL, aucune action à faire à la main.'
fi
echo
echo '## Migrations'
echo
if [ -n "$added" ]; then
  # shellcheck disable=SC2001,SC2016  # one path per line; backquotes of Markdown
  sed 's|.*/|- `|; s|$|`|' <<<"$added"
  echo
  echo "Appliquées par l'image de migration de la même version, avant l'API ; sauvegarder la base d'abord."
else
  echo "Aucune : le schéma ne change pas, retour à ${previous:-la version précédente} possible sans restauration."
fi
echo
echo '## Changements'
echo
if [ -n "$previous" ]; then
  changes=$(git log --no-merges --format='- %s' "$range" -- "$BACKEND")
  echo "${changes:-Aucun changement du backend.}"
  echo
  echo "Depuis $previous : https://github.com/mauvaisetroupe/step-challenge/compare/$previous...$tag"
else
  echo "Première version publiée sous forme d'images ([documentation de l'exploitant](https://github.com/mauvaisetroupe/step-challenge/blob/$tag/docs/exploitation.md))."
fi
