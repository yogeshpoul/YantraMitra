# Operations

For the people running YantraMitra day to day.

## Administrators

Admins are ordinary accounts with an admin role that can only be granted from the server command line — never from the website or API.

```bash
pnpm --filter @yantramitra/api admin promote 98xxxxxxxx   # existing user becomes admin
pnpm --filter @yantramitra/api admin revoke 98xxxxxxxx
pnpm --filter @yantramitra/api admin list
# in a container: node dist/cli/admin.js <command>
```

Every admin action (suspensions, restorations, password resets, report decisions, catalogue changes) is written to the audit log in the same database transaction. The database itself rejects any update or deletion of audit entries (a trigger on the table), so the history cannot be quietly rewritten through the application.

## Password reset (no OTP)

YantraMitra has no SMS. When someone forgets their password:

1. **Confirm identity.** Call the person **back on the mobile number registered on the account** (never a number they give you). Ask what equipment they listed and roughly where. Do not reset if anything is doubtful.
2. In **Admin → Users**, search the number, choose **Temporary password**, and confirm.
3. Read the temporary password to them over that call. It is shown only once, expires in 24 hours, and all their existing sessions are signed out.
4. At their next login they must set a new password before doing anything else.

Admins never see or recover existing passwords; only a new temporary one can be issued. Administrator accounts cannot be reset from the panel — use the CLI on the server.

## Moderation

- **Reports**: Admin → Reports. Move a report to *reviewing*, then *resolve* or *dismiss* it with a note.
- **Listings**: suspend with a reason (the owner sees it and cannot reactivate the listing); restore when fixed.
- **Users**: suspension signs them out immediately and hides all their listings; reactivation restores them.

## Known risks to watch

- **Numbers are not verified.** Without OTP, someone could register another person's number. Watch for complaints; suspend and investigate. The UI never claims that numbers are verified.
- **Number scraping.** Each user can reveal at most `CONTACT_REVEALS_PER_DAY` numbers (default 50) and every reveal is recorded in `contact_events`. Look for unusual counts in the dashboard.

## Backups

`infrastructure/database/backup.sh` writes a compressed `pg_dump` archive, verifies it can be read, and keeps 14 days. Run it nightly from cron and copy the files to a different machine or object storage. **Test a restore every month:**

```bash
createdb yantramitra_restore_test
pg_restore --no-owner -d yantramitra_restore_test <file>.dump
psql -d yantramitra_restore_test -c "select count(*) from equipment_listings"
```

## Updating place data

GeoNames is updated continually. Re-run `places:import IN` every few months; it updates places in place, keeps their URL slugs, and refreshes the area names stored on listings.

## Health

- `GET /api/v1/health` — process is up.
- `GET /api/v1/health/ready` — database and PostGIS reachable (use for load-balancer checks).
