#!/bin/sh
# Run the API as the unprivileged "abusebox" user. Releases before 1.3.2 ran as
# root, so an existing data volume (database, JWT secret) is owned by root and
# is handed over first.
set -e
if [ "$(id -u)" = "0" ]; then
    mkdir -p /app/data
    chown -R abusebox:abusebox /app/data
    exec su-exec abusebox "$@"
fi
exec "$@"
