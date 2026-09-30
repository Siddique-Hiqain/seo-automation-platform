#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Running database migrations..."
    alembic upgrade head
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
