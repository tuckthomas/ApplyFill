#!/usr/bin/env bash
set -euo pipefail

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
CREATE ROLE applyfill_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE applyfill TO applyfill_app;
GRANT USAGE ON SCHEMA public TO applyfill_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO applyfill_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO applyfill_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO applyfill_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO applyfill_app;
SQL
