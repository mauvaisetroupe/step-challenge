#!/usr/bin/env bash
#
# Uploads the built site (site/public/) to the OVH web hosting over SFTP
# (ADR 0005). Used by .github/workflows/deploy-site.yml; can also be run
# by hand from site/ after `hugo --minify`.
#
# Environment:
#   SFTP_HOST      SFTP server, e.g. ssh.clusterXXX.hosting.ovh.net
#   SFTP_USER      SFTP user
#   LFTP_PASSWORD  its password (read by lftp, never on the command line)
#   SFTP_KNOWN_HOSTS  host key line(s) of the server, as printed by
#                  ssh-keyscan: the server is authenticated, not trusted
#                  on first use
#   REMOTE_DIR     remote folder of the site, e.g. step
#   SFTP_PORT      optional, 22 by default
#   LOCAL_DIR      optional, public by default
#
# The remote folder is made identical to the local one: files that are
# no longer in the site are deleted. As a safety, the script refuses to
# upload into a folder that is neither empty nor marked as ours (marker
# file below), so that a wrong REMOTE_DIR cannot wipe another site.
#
# Requires lftp and ssh.

set -euo pipefail

: "${SFTP_HOST:?SFTP_HOST is not set}"
: "${SFTP_USER:?SFTP_USER is not set}"
: "${LFTP_PASSWORD:?LFTP_PASSWORD is not set}"
: "${SFTP_KNOWN_HOSTS:?SFTP_KNOWN_HOSTS is not set}"
: "${REMOTE_DIR:?REMOTE_DIR is not set}"

PORT=${SFTP_PORT:-22}
LOCAL_DIR=${LOCAL_DIR:-public}
MARKER=.step-challenge-site

export LFTP_PASSWORD

if [ ! -f "$LOCAL_DIR/$MARKER" ]; then
  echo "error: $LOCAL_DIR/$MARKER missing; build the site first (hugo --minify)" >&2
  exit 1
fi

known_hosts=$(mktemp)
trap 'rm -f "$known_hosts"' EXIT
printf '%s\n' "$SFTP_KNOWN_HOSTS" > "$known_hosts"

# Password authentication only, and the host key must match.
ssh_command="ssh -a -x -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$known_hosts -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive"

run_lftp() {
  lftp -c "
    set cmd:fail-exit yes
    set net:max-retries 2
    set net:timeout 30
    set sftp:connect-program '$ssh_command'
    open --env-password -u '$SFTP_USER' -p $PORT sftp://$SFTP_HOST
    $1
  "
}

# Safety check on the remote folder. A failed listing stops the upload:
# it must not be mistaken for an empty folder.
if ! raw_listing=$(run_lftp "mkdir -p -f '$REMOTE_DIR'; cls -1a '$REMOTE_DIR/'"); then
  echo "error: cannot list remote folder '$REMOTE_DIR'; nothing uploaded." >&2
  exit 1
fi

listing=$(printf '%s\n' "$raw_listing" | xargs -r -n1 basename | grep -v -x -e '\.' -e '\.\.' || true)

if [ -n "$listing" ] && ! printf '%s\n' "$listing" | grep -q -x -F "$MARKER"; then
  echo "error: remote folder '$REMOTE_DIR' is not empty and has no $MARKER file." >&2
  echo "Refusing to upload: check REMOTE_DIR (the upload deletes files that are not in the site)." >&2
  exit 1
fi

# Every file is uploaded each time (a few hundred kilobytes): Hugo
# rewrites all files at each build, so dates cannot tell what changed.
run_lftp "mirror --reverse --delete --no-perms --no-umask --parallel=4 --verbose '$LOCAL_DIR/' '$REMOTE_DIR/'"

echo "Uploaded $LOCAL_DIR/ to $SFTP_HOST:$REMOTE_DIR/"
