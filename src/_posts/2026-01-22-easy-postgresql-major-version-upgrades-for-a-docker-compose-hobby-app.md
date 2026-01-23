---
title: Easy PostgreSQL major version upgrades for a Docker Compose hobby app
---

Upgrading PostgreSQL major versions in Docker doesn't have to be scary. For small hobby apps, a simple dump-and-restore process can be the safest and most understandable method.

Below is a step-by-step runbook that I use when upgrading PostgreSQL to a new major version for my hobby app, which is managed using Docker Compose. The runbook is a sequence of commands that I paste into an SSH session one at a time, checking results after every step.

This approach has worked well for my small app, and this post walks through the workflow and explains why each step exists.

---

## Caveats

This upgrade process works well for my **small hobby app**, but it does come with tradeoffs.

It requires some downtime (hopefully just a few minutes), involves manually running commands directly on the server (somewhat violating strict “infrastructure as code” practices), and assumes a relatively small database (mine is currently ~122 MB). For much larger databases or stricter uptime requirements, this approach is likely too slow and too manual.

But if you’re in a similar position — running a personal app and looking for a straightforward, low-risk way to do Postgres major upgrades — this process might be useful to you.

---

## Assumptions

This workflow assumes:

- Postgres runs via Docker Compose
- Your database data lives in a named Docker volume
- You’re OK with downtime during dump + restore
- You can SSH into the server and run commands interactively

You’ll need to adapt service names, database names, and volume names to your specific setup.

---

## High-level strategy

This upgrade process will:

1. Verify the current database state
2. Take a logical backup
3. Start a brand-new Postgres major version with a fresh data directory (new volume)
4. Restore the backup to the new Postgres database
5. Verify correctness
6. Delete the old data only after everything looks good

The old database remains untouched until the very end, which makes rollback trivial.

---

## Check application compatibility first

Before starting the upgrade process, verify that your application is compatible with the new Postgres major version. Review the Postgres release notes for breaking changes or deprecated features that might affect your app and run your test suite against the new version.

---

## Step-by-step upgrade runbook (Postgres 17 to 18 example)

Each step below is intended to be copy/pasted **individually**, with you verifying output before moving on.

---

### 0. Make sure your deployment config is ready

Before touching production, make sure that a PR to update your Postgres image and volume name (with the exact same changes seen in the `sed` commands below) is ready to merge. In the steps below, we will apply changes temporarily to upgrade, then revert to keep the repo clean, then merge a PR to make them permanent.

```bash
# Make sure that PR to update docker-compose.yml to Postgres 18 is ready to merge.
```

### 1. Check current state

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

This gives you a concrete baseline for later verification.

### 2. Create an off-server backup (optional, but recommended)

If you have an existing backup pipeline (e.g. S3 snapshots), now is the time to run it:

```bash
bin/backup-to-s3.sh
```

This gives you an escape hatch, even if the server melts down mid-upgrade.

### 3. Update Docker config to the new Postgres version and volume

Edit `docker-compose.yml` so that:

- The Postgres image moves from postgres:17.x to postgres:18.x
- The data volume moves from postgres-data-v17 to postgres-data-v18

Changing the volume name ensures the new Postgres version starts with a completely empty directory, avoiding errors like "The data directory was initialized by PostgreSQL version 17, which is not compatible with this version 18.0".

For example:

```bash
sed -i'' 's/postgres:17.6-alpine/postgres:18.0-alpine/g' docker-compose.yml
sed -i'' 's/postgres-data-v17:/postgres-data-v18:/g' docker-compose.yml
```

Then review:

```bash
git status
git diff
```

Nothing should be changed except the Postgres image tag and volume name in `docker-compose.yml`.

### 4. Pre-pull the new Postgres image

This reduces downtime later (since we won't waste time downloading the new Postgres Docker image while our app is down):

```bash
docker compose pull postgres
docker images postgres
```

### 5. Stop services that talk to the database or serve the web app

```bash
docker compose stop web worker nginx
```

At this point, nothing should be writing to Postgres.

### 6. Create a logical backup from the old database

We use `pg_dumpall` to capture everything, including global objects (such as roles and permissions). This creates a portable SQL script that works across Postgres major versions.

⚠️ **Permission note:** `pg_dumpall` requires superuser privileges for complete dumps. To check if your app user is a superuser, run this command (substituting your Postgres app user name for `app_user`):

```bash
docker compose exec postgres psql -U app_user -c \
  'SELECT rolsuper FROM pg_roles WHERE rolname = current_user;'
```

If this returns `true`/`t`, then you can proceed.

```bash
docker compose exec postgres pg_dumpall -U app_user > backup.sql
head -5 backup.sql | grep -q "PostgreSQL" && echo "✓ Backup format looks correct"
ls -lh backup.sql
```

Confirm the file size looks roughly correct before continuing.

### 7. Shut down the old Postgres container

```bash
docker compose down postgres
docker ps
```

You should no longer see the Postgres container running.

### 8. Start Postgres on the new major version

```bash
docker compose up --detach postgres
```

Then verify:

```bash
docker compose exec postgres psql -U app_user -c 'SELECT VERSION();'
```

You should now see PostgreSQL 18.x.

### 9. Restore the backup

```bash
docker compose exec --no-TTY postgres psql -U app_user < backup.sql
```

This puts the data into the new Postgres database.

### 10. Verify the data

```bash
docker compose exec postgres psql -U app_user app_production -c \
  'SELECT COUNT(*) FROM users; SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;'
```

You should see the same results as before the upgrade.

### 11. Restart application services

```bash
docker compose up -d web worker nginx
```

Now verify that your web app loads and that database writes succeed (e.g. fill out a form to create a test record).

### 12. Clean up

Once you’re fully confident:

```bash
rm backup.sql
git checkout docker-compose.yml
docker volume rm app_postgres-data-v17
```

### 13. Merge PR that commits the above changes

Merge and deploy the PR that you prepared in Step 0, committing to version control the same changes that you temporarily made above.

### 14. Post-deploy sanity check

After the PR has deployed to your server, make sure that the Postgres version is still the new major version and confirm that the data is still what you expect.

```bash
docker compose exec postgres psql -U app_user app_production -c 'SELECT VERSION();'
docker compose exec postgres psql -U app_user app_production -c \
  'SELECT COUNT(*) FROM users; SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;'
```

At this point, the upgrade is complete.

---

## Rolling back

Rollback is possible at any point before executing `docker volume rm app_postgres-data-v17` in Step 12.

If anything fails before deleting the old volume:

```bash
docker compose down
git checkout docker-compose.yml
docker compose up -d postgres
docker compose up -d web worker nginx
```

You’re instantly back to the original database.

---

## When this approach is a bad fit

You probably want to use `pg_upgrade` or do a replication-based cutover if your database is very large and/or absolutely minimizing downtime is important.

But, for a small hobby app, this approach is pretty safe, easy, and simple for an app whose Postgres database is managed with Docker Compose, which can make Postgres major version upgrades relatively complicated.

---

## Takeaways

If you want Postgres major upgrades that are:

- Low-risk
- Easy to roll back
- Easy to reason about
- Easy to repeat every few years

... then this pattern has worked well for me. It’s not the fastest possible approach, but it’s pretty safe and pretty easy.

I hope that this might be helpful to you!

---

## Appendix: a complete, real example script

I use this exact process to upgrade Postgres major versions in production for the [davidrunger.com](https://davidrunger.com/) database. You can see the [current version of the playbook here](https://github.com/davidrunger/david_runger/blob/main/docs/postgres-17-to-18-upgrade.sh) (and also my [`docker-compose.yml`](https://github.com/davidrunger/david_runger/blob/main/docker-compose.yml)).

The playbook includes:

- My service names
- My deployment flow
- My verification queries
- My volume naming scheme

Seeing that concrete example for my specific app might help you to understand how you might need to adjust the commands above to fit your own app.
