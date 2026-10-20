#!/bin/sh
set -eu
umask 077
for name in db-password jwt-key sandbox-password bootstrap-password; do
  if [ ! -s "/secrets/$name" ]; then
    od -An -N48 -tx1 /dev/urandom | tr -d ' \n' > "/secrets/$name"
  fi
  chown 1654:1654 "/secrets/$name"
  chmod 444 "/secrets/$name"
done
chown 1654:1654 /keys
chmod 700 /keys
