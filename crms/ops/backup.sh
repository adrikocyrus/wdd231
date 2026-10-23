#!/usr/bin/env sh
set -eu
umask 077

CRMS_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKUP_DIR=${BACKUP_DIR:-"$CRMS_DIR/backups"}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
POSTGRES_ADMIN_USER=${POSTGRES_ADMIN_USER:-crms}
POSTGRES_DB=${POSTGRES_DB:-crms}
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="$BACKUP_DIR/crms-$TIMESTAMP.dump"
CHECKSUM_FILE="$BACKUP_FILE.sha256"
TEMP_FILE="$BACKUP_FILE.tmp"

case "$BACKUP_RETENTION_DAYS" in
  ''|0*|*[!0-9]*)
    echo "BACKUP_RETENTION_DAYS must be a positive decimal integer without leading zeroes" >&2
    exit 1
    ;;
esac

mkdir -p "$BACKUP_DIR"
trap 'rm -f "$TEMP_FILE"' EXIT HUP INT TERM

cd "$CRMS_DIR"
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_DB" --format=custom > "$TEMP_FILE"
test -s "$TEMP_FILE"
docker compose exec -T postgres pg_restore --list < "$TEMP_FILE" >/dev/null
mv "$TEMP_FILE" "$BACKUP_FILE"
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  command -v rclone >/dev/null 2>&1 || {
    echo "BACKUP_REMOTE is set but rclone is not installed" >&2
    exit 1
  }
  rclone copyto "$BACKUP_FILE" "$BACKUP_REMOTE/$(basename "$BACKUP_FILE")"
  rclone copyto "$CHECKSUM_FILE" "$BACKUP_REMOTE/$(basename "$CHECKSUM_FILE")"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'crms-*.dump' -o -name 'crms-*.dump.sha256' \) \
  -mtime +"$((BACKUP_RETENTION_DAYS - 1))" -delete

printf 'Database backup created: %s\n' "$BACKUP_FILE"
