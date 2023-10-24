#!/bin/bash

# Docker container and Redis data path
DOCKER_CONTAINER_NAME="redis"
REDIS_DATA_PATH="/data"

# Local backup directory
BACKUP_DIR="/root/redis_backups"

# Create a backup with the current date and time
BACKUP_FILE="${BACKUP_DIR}/redis_backup_$(date '+%Y%m%d_%H%M%S').rdb"

# Run the Redis backup command in the Docker container
docker compose exec ${DOCKER_CONTAINER_NAME} redis-cli SAVE && \
docker compose cp ${DOCKER_CONTAINER_NAME}:${REDIS_DATA_PATH}/dump.rdb ${BACKUP_FILE}

echo "Saved backup to ${BACKUP_FILE}"

echo "Backup listing:"
ls $BACKUP_DIR

# Remove backups older than 14 days
find ${BACKUP_DIR} -type f -name 'redis_backup_*' -mtime +14 -exec rm {} \;

echo "Removed old backups"
ls $BACKUP_DIR
