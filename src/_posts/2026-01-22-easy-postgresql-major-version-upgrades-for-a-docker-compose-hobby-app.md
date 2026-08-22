---
title: Easy PostgreSQL major version upgrades for a Docker Compose hobby app
---

For a small hobby app, a logical dump and restore is a simple, low-risk way to upgrade PostgreSQL. The old database remains untouched until you delete its Docker volume, making rollback straightforward.

This is the runbook that I use for my Docker Compose app. I paste each command into an SSH session individually and check its output before continuing.

## Caveats

This approach requires downtime and assumes that the database is small enough to dump and restore quickly (mine is about 122 MB). For a large database or strict uptime requirements, consider `pg_upgrade` or a replication-based cutover instead.

The examples also assume that:

- PostgreSQL runs through Docker Compose.
- Its data lives in a named Docker volume.
- You can SSH into the server and run commands interactively.

Adapt the service, database, user, and volume names to your app.

## Before the upgrade

Confirm that your application supports the new PostgreSQL version. Review its release notes for relevant breaking changes and run your test suite against it.

Prepare a pull request that updates the PostgreSQL image, volume name, and, if necessary, volume mount path. During the upgrade, you will apply those changes temporarily, revert them, and then merge the pull request to make them permanent.

## Upgrade from PostgreSQL 17 to 18

### 1. Record the current state

```bash
git status
git show
```

```bash
docker compose exec postgres psql -U app_user app_production -c 'SELECT VERSION();'
```

```bash
docker compose exec postgres psql -U app_user app_production -c \
  'SELECT COUNT(*) FROM users; SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;'
```

The query results provide a baseline for verification after the restore.

### 2. Create an off-server backup

If you have a separate backup pipeline, run it now:

```bash
bin/backup-to-s3.sh
```

This backup provides another recovery path if the server itself fails during the upgrade.

### 3. Update the Docker configuration

Update `docker-compose.yml` so that:

- The image changes from `postgres:17.x` to `postgres:18.x`.
- The volume name changes from `postgres-data-v17` to `postgres-data-v18`.
- The volume mount path changes if required by the new image.

A new volume name gives the new PostgreSQL version an empty data directory and preserves the old database for rollback.

For example:

```bash
sed -i'' 's/postgres:17.6-alpine/postgres:18.0-alpine/g' docker-compose.yml
sed -i'' 's/postgres-data-v17:/postgres-data-v18:/g' docker-compose.yml
sed -i'' 's|/var/lib/postgresql/data|/var/lib/postgresql|g' docker-compose.yml
```

Then review the changes:

```bash
git status
git diff
```

Only the image tag, volume name, and mount path should have changed.

**PostgreSQL 18 image note (updated July 2026):** The official image now sets `PGDATA` to `/var/lib/postgresql/18/docker` and expects the volume to be mounted at `/var/lib/postgresql`. Earlier PostgreSQL images used `/var/lib/postgresql/data`. This change reached the PostgreSQL 18 image through several revisions, so my upgrades from 17 to 18.0 and 18.0 to 18.1 still worked with the old mount path, while 18.1 to 18.4 required another dump and restore. Check the [official image documentation](https://hub.docker.com/_/postgres) before any image update, including a minor-version update.

### 4. Pull the new image

Pull it before the downtime begins:

```bash
docker compose pull postgres
docker images postgres
```

### 5. Stop application services

```bash
docker compose stop web worker nginx
```

Nothing should write to PostgreSQL after this point.

### 6. Dump the old database cluster

`pg_dumpall` creates a portable SQL script containing all databases and global objects, including roles and permissions. A complete dump and restore generally require a database superuser. Check your app user:

```bash
docker compose exec postgres psql -U app_user -c \
  'SELECT rolsuper FROM pg_roles WHERE rolname = current_user;'
```

If the command returns `true` or `t`, create and inspect the dump:

```bash
docker compose exec postgres pg_dumpall -U app_user > backup.sql
head -5 backup.sql | grep -q "PostgreSQL" && echo "Backup format looks correct"
ls -lh backup.sql
```

Confirm that the file size is plausible before continuing.

### 7. Replace PostgreSQL

Stop and remove the old PostgreSQL container, then start the service with its new image and volume:

```bash
docker compose down postgres
docker compose up --detach postgres
```

Verify the new version:

```bash
docker compose exec postgres psql -U app_user -c 'SELECT VERSION();'
```

### 8. Restore and verify the data

```bash
docker compose exec --no-TTY postgres psql -U app_user < backup.sql
```

Because the new container's initialization may already have created the app role and database, the restore can report that they already exist. Review the complete output for any other errors.

Run the same verification query as before:

```bash
docker compose exec postgres psql -U app_user app_production -c \
  'SELECT COUNT(*) FROM users; SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;'
```

The results should match the baseline.

### 9. Restart and test the application

```bash
docker compose up -d web worker nginx
```

Confirm that the app loads and can write to the database, such as by submitting a form that creates a test record.

### 10. Deploy the permanent configuration

Revert the temporary edit:

```bash
git restore docker-compose.yml
```

Merge and deploy the prepared pull request. Then confirm that the app still uses the new PostgreSQL version and that its data remains intact:

```bash
docker compose exec postgres psql -U app_user app_production -c 'SELECT VERSION();'
docker compose exec postgres psql -U app_user app_production -c \
  'SELECT COUNT(*) FROM users; SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;'
```

### 11. Remove the rollback data

After you are confident that the deployment succeeded:

```bash
rm backup.sql
docker volume rm app_postgres-data-v17
```

## Rolling back

Until you remove the old volume, you can return to PostgreSQL 17:

```bash
docker compose down
git restore docker-compose.yml
docker compose up -d postgres
docker compose up -d web worker nginx
```

## Complete example

I use this process for the [davidrunger.com](https://davidrunger.com/) database. See the [complete playbook](https://github.com/davidrunger/david_runger/blob/main/docs/postgres-17-to-18-upgrade.sh) and its [`docker-compose.yml`](https://github.com/davidrunger/david_runger/blob/main/docker-compose.yml) for a concrete example with my service names, deployment flow, verification queries, and volume naming scheme.
