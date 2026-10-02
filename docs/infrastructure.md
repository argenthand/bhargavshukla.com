# Infrastructure

## Domain and DNS

The domain stays registered at **Porkbun**; DNS moves to **Cloudflare** (required for the Worker custom domain, Cache API, tag purge and Tunnel).

1. Add `bhargavshukla.com` as a zone in Cloudflare (Free plan).
2. **Before switching nameservers**, check the imported records include every mail record below, all **DNS only** (grey cloud), or mail to hello@bhargavshukla.com stops arriving. `scripts/check-dns.sh <name>.ns.cloudflare.com` checks them against Cloudflare directly.
3. Make sure DNSSEC is off at Porkbun. (It was never enabled there: whois said "unsigned" before the move.)
4. Set Cloudflare's two nameservers at Porkbun. Wait for the zone to go active (up to 24 h).
5. Check again with `scripts/check-dns.sh` (public resolver) and send a test email from an outside account.
6. Re-enable DNSSEC through Cloudflare (add the DS record it gives you at Porkbun).
7. SSL/TLS mode: **Full (strict)**, and **Always Use HTTPS** on (SSL/TLS → Edge Certificates) so every `http://` request gets a 301 to `https://`.

Rollback: set Porkbun's nameservers back. Porkbun's own copy of the records stays in place until the move is done.

### Mail records (Proton Mail)

These must survive the move. `scripts/check-dns.sh` holds the same list.

| Name                                                                        | Type  | Value                                                                                          |
| --------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| `@`                                                                         | MX    | `10 mail.protonmail.ch`, `20 mailsec.protonmail.ch`                                            |
| `@`                                                                         | TXT   | `v=spf1 include:_spf.protonmail.ch ~all`                                                       |
| `@`                                                                         | TXT   | `protonmail-verification=…` (domain ownership for Proton)                                      |
| `_dmarc`                                                                    | TXT   | `v=DMARC1; p=quarantine`                                                                       |
| `protonmail._domainkey`, `protonmail2._domainkey`, `protonmail3._domainkey` | CNAME | `<selector>.domainkey.d4lcctuitj4vncts3htjpiqi2y3obpk4ah22jxwrnjskwwavp7iwq.domains.proton.ch` |

### Hostnames

| Hostname                  | Points to                  | Added in |
| ------------------------- | -------------------------- | -------- |
| `bhargavshukla.com`       | Worker custom domain       | #3       |
| `www.bhargavshukla.com`   | Redirect Rule → apex       | #3       |
| `cms.bhargavshukla.com`   | Cloudflare Tunnel → Strapi | #12      |
| `media.bhargavshukla.com` | R2 public bucket           | #13      |

## Frontend: Cloudflare Workers

- `@sveltejs/adapter-cloudflare` is set in `vite.config.ts` (this scaffold configures the adapter there — there is no `svelte.config.js`). `wrangler` is a dev dependency; `pnpm-workspace.yaml` allows `workerd`'s install script.
- [`wrangler.jsonc`](../wrangler.jsonc) names the Worker `bs-blog`, points `main` and the `ASSETS` binding at the adapter output in `.svelte-kit/cloudflare`, and claims `bhargavshukla.com` as a custom domain (Cloudflare creates its DNS record and certificate on deploy). `vars` are added by the tickets that need them: `STRAPI_URL` in #9/#15, `CF_ZONE_ID` in #17.
- Node and pnpm versions for the build come from `.node-version` and `packageManager` in `package.json`.
- **Test before merging, locally:** `pnpm build && pnpm exec wrangler dev --env-file .env` serves the production build in the Workers runtime at http://localhost:8787. Add `--ip 0.0.0.0` and open `http://<this machine's LAN IP>:8787` to check the layout on a phone. `pnpm exec wrangler deploy --dry-run` shows the bundle size.
- **Workers Builds** (dashboard → Workers & Pages → Create → Import a repository) deploys `main` to production:

  | Setting                                | Value                  |
  | -------------------------------------- | ---------------------- |
  | Worker name                            | `bs-blog` (must match) |
  | Branch control → Production branch     | `main`                 |
  | Build command                          | `pnpm build`           |
  | Deploy command                         | `npx wrangler deploy`  |
  | Branch control → Enable Preview Builds | unchecked              |

  There are no preview deploys: the site has one author, local `wrangler dev` covers the same checks, and `workers.dev` preview URLs sit outside the `bhargavshukla.com` zone so they can't show edge-cache behaviour anyway. If the Worker is ever renamed or recreated, disconnect and reconnect the repository under Settings → Build → Git repository; otherwise builds fail with "The name in your wrangler.jsonc file … must match the name of your Worker" even when the names match (the build trigger still points at the old Worker).

- **A merge that never builds:** each build shows up as a "Workers Builds: bs-blog" check on the merge commit, about a minute after the merge. If there's no check after a few minutes and no build in the dashboard, Cloudflare missed the push (seen once, on #44). Any new commit on `main` triggers a fresh build of the whole branch.

- **`www` → apex:** a proxied placeholder record `www` AAAA `100::`, plus a Redirect Rule (Rules → Redirect Rules → "Redirect from WWW to root" template): 301, keep the path and query string. The rule only matches `https://www…`; Always Use HTTPS upgrades `http://www…` first (two hops), otherwise it reaches the `100::` placeholder and fails with a 523.
- **Workers Paid** ($5/month) since #62: share cards take ~20–70 ms of CPU to render, over the Free plan's 10 ms per request. Paid allows 30 s by default and a 10 MB compressed Worker. With satori, resvg-wasm and three Newsreader weights the Worker is ~1.6 MB compressed (`pnpm exec wrangler deploy --dry-run`); before #62 it was ~0.4 MB.
- **WebAssembly on Workers:** Workers can't compile WebAssembly from bytes at runtime, so `vite.config.ts` leaves `.wasm` imports external and wrangler bundles them as modules; `src/lib/server/og.ts` imports them lazily (SvelteKit's build analysis runs in Node, which can't load them). satori stays on **0.32**: 0.33 added harfbuzzjs, which loads its WebAssembly in a way Workers refuse.

## Analytics: Cloudflare Web Analytics (#58)

- **Where:** dashboard → Analytics & Logs → Web Analytics → `bhargavshukla.com`. Page views, page paths, referrers, countries, browsers and devices, plus Core Web Vitals (LCP, INP, CLS) per page.
- **Setup: automatic, no code.** Cloudflare injects the beacon (`static.cloudflareinsights.com/beacon.min.js`) into HTML responses as they leave the zone, after the Worker, so it is not in the repo, never in `vite dev` or `wrangler dev`, and never stored in our edge cache (pages are stored before injection; each response gets it once). SPA tracking is on (`"spa"` in `data-cf-beacon`), so client-side navigations count. The beacon reports to `bhargavshukla.com/cdn-cgi/rum`, which Cloudflare answers before the Worker.
- **Privacy:** no cookies and no localStorage (checked on a fresh visit), so no consent banner. RUM is set to **exclude visitors in the EU**: their visits are not counted.
- **Checking it:** requests without a browser `Accept: text/html` header get no beacon. Ad blockers and DNS blocklists (Pi-hole and the like) block `static.cloudflareinsights.com`, so those visits don't show up; on such a network, test with another resolver (for example Chromium's `--host-resolver-rules`).

## Read counts: Cloudflare D1 (#87)

- **What:** D1 database `bs-reads` (binding `READS`), the `views`, `seen` and `salts` tables from [`migrations/`](../migrations). Design and numbers: [view-counts.md](view-counts.md).
- **Privacy:** read counts are anonymous: no cookies, and nothing that identifies you is stored. Only the page path and its count are kept; a salted hash of each day's readers is deleted the next day with its salt. The IP and User-Agent are used in memory to make the hash and never written.
- **Cost:** within Workers Paid's included D1 usage (about 3 row writes per counted read).
- **Locally:** `vite dev` uses a local copy in `.wrangler/state`, created by `pnpm exec wrangler d1 migrations apply bs-reads --local`.
- **A new migration:** add `migrations/000N_*.sql`, apply it locally, and run `pnpm exec wrangler d1 migrations apply bs-reads --remote` **before** merging the code that needs it.

## VPS: Hetzner Cloud CX23 (EU)

Prices checked 2026-09-28 (Hetzner raised prices on 2026-06-15).

| Option                                                | Spec                               | ~Monthly                                                 | Verdict                                                           |
| ----------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| **Hetzner CX23** (Falkenstein, Nuremberg or Helsinki) | 2 vCPU, 4 GB, 40 GB, 20 TB traffic | €5.49 + IPv4 (~€0.50) + backups (20%, ~€1.10) ≈ **€7.1** | **Pick**                                                          |
| Hetzner CAX11 (ARM)                                   | 2 vCPU, 4 GB                       | €5.99 + extras                                           | Fallback if CX shows "not available"; build a `linux/arm64` image |
| Vultr 2 GB                                            | 1 vCPU, 2 GB                       | ~$10                                                     | Fallback for a US datacenter                                      |
| DigitalOcean / Akamai 2 GB                            | 1 vCPU, 2 GB                       | $12                                                      | Poor value                                                        |
| Hetzner US (CPX11)                                    | 2 vCPU, 2 GB                       | ~$20.49                                                  | Not competitive since June 2026                                   |
| Oracle Always Free                                    | ARM                                | $0                                                       | Rejected: idle reclamation and account-termination risk           |

- **EU is fine** for the origin: readers are served from Cloudflare's edge; the origin only sees cache misses (~100 ms extra) and admin sessions.
- **4 GB** because Strapi runs in ~300–600 MB but its admin build needs ~2 GB+. The image is built in CI; the headroom allows an emergency on-box build.
- **Keep IPv4**: GHCR doesn't support IPv6-only hosts.

### Box setup (Ubuntu 26.04)

1. Create the server with your SSH key, IPv4, and automated backups on.
2. Create a non-root `deploy` user with sudo and Docker group; disable password auth and root login.
3. Enable `unattended-upgrades`.
4. Hetzner firewall: inbound **22 only**.
5. Install Docker Engine and the compose plugin.

### Services (`/opt/cms/docker-compose.yml`)

| Service       | Details                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strapi`      | `ghcr.io/argenthand/bhargavshukla-cms:<sha>`; volume `./data` → `/opt/app/data`; `DATABASE_FILENAME=/opt/app/data/data.db`; secrets from `/opt/cms/.env` |
| `cloudflared` | Tunnel token from `.env`; public hostname `cms.bhargavshukla.com` → `http://strapi:1337`                                                                 |

No reverse proxy, no certificates, no inbound 80/443.

Production secrets in `/opt/cms/.env`: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`, the R2 credentials, and `TUNNEL_TOKEN`.

### Access control

- **Cloudflare Access** (free) on `cms.bhargavshukla.com/admin*`, email one-time PIN to hello@bhargavshukla.com.
- `/api/*` stays reachable but the Public role has no permissions; reads need the token.
- Don't turn on Bot Fight Mode for the `cms` host — it can challenge the Worker's requests.

### Deploying CMS changes

- [`.github/workflows/cms-image.yml`](../.github/workflows/cms-image.yml): on changes under `cms/**` on `main`, buildx pushes `ghcr.io/argenthand/bhargavshukla-cms:{sha,latest}`. Pull requests only build.
- Deploy is automatic (#48): after the image is pushed, the `deploy` job SSHes to the VPS and runs [`cms/deploy/deploy.sh`](../cms/deploy/deploy.sh) for that commit. See Runbook → Automated CMS deploys.

## Media: Cloudflare R2

- Buckets: `cms-media` (public, custom domain `media.bhargavshukla.com`) and `cms-backups` (private).
- Strapi upload provider: `@strapi/provider-upload-aws-s3` pointed at the R2 S3 endpoint ([`cms/config/plugins.ts`](../cms/config/plugins.ts)). It's only used when `R2_ACCESS_KEY_ID` is set, so local development keeps uploads in `cms/public/uploads`.
- `media.bhargavshukla.com` is in `img-src` and `media-src` of Strapi's CSP ([`cms/config/middlewares.ts`](../cms/config/middlewares.ts)), so the admin can preview uploads.
- One API token per job: Strapi's can only touch `cms-media`, and the backup job (#14) gets its own for `cms-backups`.
- Free tier: 10 GB storage, no egress fees.

## Backups

| What                                                  | When                          | Where                                   |
| ----------------------------------------------------- | ----------------------------- | --------------------------------------- |
| `sqlite3 data.db ".backup …"`, gzipped, `rclone`      | nightly 03:15 UTC (host cron) | R2 `cms-backups/nightly/`, kept 30 days |
| `strapi export --no-encrypt` (content, config, media) | Sundays 03:45 UTC (host cron) | R2 `cms-backups/weekly/`, kept 90 days  |
| Hetzner automated backups (whole server)              | daily (Hetzner)               | Hetzner, last 7                         |

- [`cms/deploy/backup.sh`](../cms/deploy/backup.sh) does both, run by [`cms/deploy/cms-backup.cron`](../cms/deploy/cms-backup.cron) as `deploy`. Output goes to syslog (`journalctl -t cms-backup`).
- The nightly copy is the whole database, so it restores everything, including admin users and API tokens. The weekly export can be imported into a fresh Strapi running the same schema.
- It uses its own R2 token, scoped to `cms-backups` only, in `/opt/cms/backup.env`. Retention is an R2 lifecycle rule on each prefix.
- Uploaded media lives in R2 `cms-media`. The nightly copy has only the database records; the weekly export also downloads the files from R2. So a file deleted in the admin can be recovered from an export taken before the delete, for 90 days.

**Restore drill:** at least once, restore a backup into a local Strapi and confirm it boots with content. Steps are in the runbook below. Done on 2026-09-30 with the nightly copy: a draft post, its category and its image all came back, and the production admin login worked.

## Monitoring (#64)

| What                                                                                | Watched by                   | Alert                                                     |
| ----------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| `https://bhargavshukla.com/`                                                        | UptimeRobot, every 5 minutes | email when it's down, and again when it's back            |
| `https://cms.bhargavshukla.com/_health` (204, public; Access covers only `/admin*`) | UptimeRobot, every 5 minutes | email when it's down, and again when it's back            |
| Nightly backup                                                                      | Healthchecks.io heartbeat    | email if no ping by 04:15 UTC, or right away on a failure |

- **UptimeRobot** (free): two **HTTP(s)** monitors, 5-minute interval, alert contact hello@bhargavshukla.com. A monitor counts any 2xx/3xx as up; the CMS one also proves the tunnel and Strapi are healthy.
- **Backup heartbeat:** `backup.sh nightly` pings `BACKUP_PING_URL` (in `/opt/cms/backup.env`) after the copy is uploaded, and `<url>/fail` if a step fails (an integrity-check or upload failure alerts at once). Unset, nothing is pinged. A failed ping is logged (`journalctl -t cms-backup`) but never fails the backup. `deploy.sh` also runs a nightly backup before every CMS deploy, so deploy days ping twice; that's fine.
- **Healthchecks.io** check: schedule **Cron** `15 3 * * *`, time zone UTC, grace **1 hour**. Its ping URL is private: anyone with it could fake a good night, so it lives only in `backup.env`.

## Runbook

Step-by-step ops notes (exact commands, IPs, gotchas) are added here as tickets #10–#15 are done.

### Provision the VPS (#10)

First-boot setup lives in [`cms/deploy/cloud-init.yaml`](../cms/deploy/cloud-init.yaml): `deploy` user (sudo, docker), Docker Engine + compose plugin, `unattended-upgrades`, and SSH hardening (no root, no passwords). The hardening only applies once `deploy` has a key.

1. **SSH key** (once, on your Mac): `ssh-keygen -t ed25519 -C hello@bhargavshukla.com`, then add `~/.ssh/id_ed25519.pub` in Hetzner Console → Security → SSH keys.
2. **Firewall:** Hetzner Console → Firewalls → create `cms-fw`. Keep the default inbound rules (TCP 22 and ICMP, from any IPv4/IPv6) and add nothing else. Leave outbound empty: any outbound rule blocks all other outbound traffic.
3. **Server:** Add Server with:
   - Location: Falkenstein, Nuremberg or Helsinki
   - Image: Ubuntu 26.04 (Docker publishes packages for it)
   - Type: CX23 (shared vCPU, x86). If it shows "not available", use CAX11 (ARM); #11 then builds `linux/arm64`.
   - Networking: public IPv4 **and** IPv6
   - SSH key: the one from step 1
   - Firewall: `cms-fw`
   - Backups: on. No volume: Hetzner backups skip volumes, and media goes to R2 (#13)
   - Cloud config: paste the whole `cms/deploy/cloud-init.yaml`
   - Name: `cms-instance`
4. **Check:** `scripts/check-vps.sh <ipv4>` waits for first boot, then checks `deploy` + Docker Compose, root refused, password auth off, unattended-upgrades, and that only port 22 is reachable.

Gotchas:

- First boot takes a few minutes (full upgrade, including a new kernel, then Docker). Until it finishes, root can still log in and `deploy` has no key. That's expected, and the check script waits for it.
- If `deploy` has no key (step 1 skipped), SSH stays unhardened and root still works. Log in as root, fix `/home/deploy/.ssh/authorized_keys`, then run the last `runcmd` block of the cloud-init file by hand.
- Hetzner reuses IPs. If `ssh` warns about a changed host key, remove the old entry with `ssh-keygen -R <ipv4>`.

### CMS image and compose file (#11)

The image is built by [`cms-image.yml`](../.github/workflows/cms-image.yml). The compose file is [`cms/deploy/docker-compose.yml`](../cms/deploy/docker-compose.yml), copied by hand to `/opt/cms/` on the VPS.

1. **Package visibility** (once, after the first push from `main`): GitHub → your profile → Packages → `bhargavshukla-cms` → Package settings → Change visibility → Public. The image has no secrets in it, and a public image means the VPS pulls without a token.
2. **Set up `/opt/cms`** (once):

   ```sh
   ssh deploy@<vps> 'sudo install -d -o deploy -g deploy /opt/cms /opt/cms/data && touch /opt/cms/.env && chmod 600 /opt/cms/.env'
   scp cms/deploy/docker-compose.yml deploy@<vps>:/opt/cms/
   ```

   `data/` must be owned by uid 1000. That's `deploy` on the host and `node` in the image, so the `install -o deploy` above covers it. If Docker creates `data/` itself, it's owned by root and Strapi can't write the database.

3. **Deploy:** `ssh deploy@<vps> 'cd /opt/cms && docker compose pull && docker compose up -d'`. To roll back, set `CMS_TAG=<sha>` in `/opt/cms/.env` and run the same command again. Re-copy `docker-compose.yml` whenever it changes in the repo.

Until #12 fills in `/opt/cms/.env`, only `docker compose pull` is useful. Strapi needs its secrets, and `cloudflared` needs `TUNNEL_TOKEN`.

### Tunnel, Access and first boot (#12)

The order matters: Access must protect `/admin` **before** Strapi is reachable. The first visitor to a fresh admin registers the super admin.

1. **Access** (Cloudflare → Zero Trust; the first visit asks for a team name and the Free plan):
   - Integrations → Identity providers: make sure **One-time PIN** is enabled.
   - Access → Applications → Add → **Self-hosted**. Name `cms-admin`; domain `cms.bhargavshukla.com`, path `admin*`; session 24h.
   - Policy `owner`: action **Allow**, include **Emails** `hello@bhargavshukla.com`.
2. **Tunnel:** Networks → Tunnels → Create → **Cloudflared**, name `cms`, environment **Docker**. Copy the token: the long string after `--token`.
   - Public hostname: subdomain `cms`, domain `bhargavshukla.com`, service **HTTP** `strapi:1337`. This also creates the DNS record.
3. **Token to the VPS.** Paste it into the prompt; it isn't echoed or saved in shell history:

   ```sh
   ssh -t deploy@<vps> 'read -rsp "Tunnel token: " t && echo && echo "TUNNEL_TOKEN=$t" >> /opt/cms/.env'
   ```

   The command appends. If you run it again, for example after rotating the token, delete the old `TUNNEL_TOKEN` line so only one is left: `grep -c '^TUNNEL_TOKEN=' /opt/cms/.env` should print `1`. Never paste the token into an editor or chat first. If it leaks, rotate it in the tunnel's settings.

4. **Bot Fight Mode:** must be **off** for `bhargavshukla.com`. It's under Security → Settings → Bot traffic (Security → Bots in the older dashboard). On the Free plan it's zone-wide and can challenge the Worker's requests to `/api`.
5. **Strapi secrets:** generated on the VPS into `/opt/cms/.env` with `openssl rand -base64 32` (`APP_KEYS` takes four, comma-separated). Never copy them off the box. Losing `ENCRYPTION_KEY` makes stored API tokens unreadable, but they still work.
6. **Start:** re-copy `docker-compose.yml`, then `docker compose pull && docker compose up -d`. `cloudflared` starts once Strapi is healthy.
7. **Admin user:** open `https://cms.bhargavshukla.com/admin`, pass the Access PIN, then register the Strapi super admin.

Checks:

- `/admin` (and `POST /admin/register-admin`) redirect to the Access login first.
- An email outside the policy gets no PIN, and the allowed email gets one right away. The login page looks the same for both, so it doesn't reveal which emails are allowed.
- `curl https://cms.bhargavshukla.com/api/posts` → 403.
- `scripts/check-vps.sh <vps>` still shows only port 22 open.

Strapi runs with `PUBLIC_URL=https://cms.bhargavshukla.com` and `IS_PROXIED=true` (set in the compose file). Without trusting the proxy, Koa sees plain HTTP and the admin login fails with "Cannot send secure cookie over unencrypted connection".

### R2 media storage (#13)

1. **Buckets** (Cloudflare → R2 Object Storage → Create bucket; location Automatic, Standard storage): `cms-media` and `cms-backups`.
2. **Custom domain:** `cms-media` → Settings → Custom Domains → Connect Domain → `media.bhargavshukla.com`. This creates the DNS record. Leave the `r2.dev` public URL disabled, so the custom domain is the only public way in. `cms-backups` stays private.
3. **API token:** R2 → Manage API tokens → Create **Account API token**. Name `strapi-media`, permission **Object Read & Write**, applied to the `cms-media` bucket only, no expiry. The page shows the Access Key ID and Secret Access Key once; the account ID is in the S3 endpoint (`https://<account-id>.r2.cloudflarestorage.com`).
4. **Keys to the VPS.** Paste each into the prompt, the same way as the tunnel token:

   ```sh
   ssh -t deploy@<vps> 'for k in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do read -rsp "$k: " v && echo && echo "$k=$v" >> /opt/cms/.env; done'
   ```

   `R2_BUCKET` and `R2_PUBLIC_URL` are in the compose file.

5. **Deploy:** re-copy `docker-compose.yml`, then `docker compose pull && docker compose up -d`.

Checks:

- Upload an image in the production admin (Media Library). It previews in the admin, and its URL is `https://media.bhargavshukla.com/<file>`.
- The object is in the `cms-media` bucket, including the generated `thumbnail_`, `small_` and other format files.
- Deleting it in the admin removes the objects from the bucket.

If uploads fail with `AccessDenied` in the Strapi logs, check that `R2_BUCKET` in the compose file matches the bucket's name exactly. A token scoped to one bucket gets `AccessDenied`, not `NoSuchBucket`, for any other name.

The provider sends no ACL (`params.ACL` is explicitly `undefined`): R2 has no object ACLs, and by default the provider adds `public-read`.

### Backups and restore (#14)

1. **Packages:** `sudo apt-get install -y sqlite3 rclone` (new servers get them from `cloud-init.yaml`).
2. **Token:** R2 → Manage API tokens → Create **Account API token**. Name `vps-backups`, permission **Object Read & Write**, applied to `cms-backups` only, no expiry.
3. **Keys to the VPS**, into their own file:

   ```sh
   ssh -t deploy@<vps> 'umask 077; for k in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do read -rsp "$k: " v && echo && echo "$k=$v" >> /opt/cms/backup.env; done'
   ```

   This writes `backup.env`, not `.env`. Afterwards `grep -c '^R2_' /opt/cms/.env /opt/cms/backup.env` should print 3 for each. If the backup keys land in `.env` too, the later lines win when Strapi restarts, and uploads fail with `AccessDenied`.

4. **Retention:** R2 → `cms-backups` → Settings → Object lifecycle rules. Add `nightly-30d` (prefix `nightly/`, delete objects after 30 days) and `weekly-90d` (prefix `weekly/`, 90 days).
5. **Script and schedule:**

   ```sh
   scp cms/deploy/backup.sh deploy@<vps>:/opt/cms/backup.sh
   scp cms/deploy/cms-backup.cron deploy@<vps>:/tmp/cms-backup
   ssh deploy@<vps> 'sudo install -m 644 -o root -g root /tmp/cms-backup /etc/cron.d/cms-backup && rm /tmp/cms-backup'
   ```

6. **First run by hand:** `ssh deploy@<vps> '/opt/cms/backup.sh nightly && /opt/cms/backup.sh weekly && /opt/cms/backup.sh list'`.

Checks:

- `backup.sh list` shows new `nightly/` objects every day and a `weekly/` one every Sunday. `journalctl -t cms-backup` shows `… backup uploaded`.
- Hetzner console → `cms-instance` → Backups is enabled.

**Restore drill (local).** Keep the restored copy out of the repo. It holds the production admin users, so delete it afterwards.

```sh
ssh deploy@<vps> '/opt/cms/backup.sh fetch nightly/data-<stamp>.db.gz'
scp deploy@<vps>:/opt/cms/restore/data-<stamp>.db.gz cms/.tmp/
gunzip -c cms/.tmp/data-<stamp>.db.gz > cms/.tmp/restore.db
cd cms && DATABASE_FILENAME=.tmp/restore.db npm run develop
```

Sign in with the production admin account and check posts, categories and media. Then delete `cms/.tmp/restore.db` and the `.gz`, and `/opt/cms/restore/` on the VPS.

**Restore production** from a nightly copy:

```sh
cd /opt/cms
./backup.sh fetch nightly/data-<stamp>.db.gz
docker compose stop strapi
mv data/data.db data/data.db.before-restore   # also move any data.db-wal / data.db-shm
gunzip -c restore/data-<stamp>.db.gz > data/data.db
docker compose start strapi
```

If the whole VPS is gone: provision a new one (#10), set up the compose file and `.env` (#11, #12) with the **same** `ENCRYPTION_KEY` if you still have it, then restore as above. Hetzner's server backups are the faster route when the project still exists.

### Production frontend ↔ CMS (#15)

1. **Token:** production admin → Settings → API Tokens → Create new API Token. Name `frontend-read`, duration **Unlimited**, type **Custom**, permissions: Post `find` + `findOne`, Category `find` + `findOne` (nothing else). Strapi shows the token once.
2. **Secret on the Worker:** Cloudflare → Workers & Pages → `bs-blog` → Settings → Variables and Secrets → Add → type **Secret**, name `STRAPI_TOKEN`, paste the token. Don't put it anywhere else. Secrets survive Workers Builds deploys; `STRAPI_URL` is a plain var in [`wrangler.jsonc`](../wrangler.jsonc).
3. **Merge** the PR that sets `STRAPI_URL` and turns on Writing (`live: true` in `src/lib/site.ts`). The secret must exist first, or `/blog` returns 500.

Checks:

- `curl -s -o /dev/null -w '%{http_code}' https://bhargavshukla.com/blog` → 200.
- A published post renders at `https://bhargavshukla.com/blog/<slug>`; a draft doesn't (404).
- Workers & Pages → `bs-blog` → Observability (logs) shows no errors for those requests.

If the token leaks: delete it in Strapi (Settings → API Tokens), create a new one and replace the secret.

### Profile single type (#42)

Merging ships a new content type (CMS image) and a home page that reads it (Worker) at the same time. Until the steps below are done, the home page shows the name without the bio or links.

1. **Deploy the CMS** once the `CMS image` workflow for the merge commit has finished, run `docker compose pull && docker compose up -d` on the VPS. The compose file doesn't change.
2. **Token:** production admin → Settings → API Tokens → `frontend-read` → add **Profile `find`** → Save. The token value doesn't change.
3. **Content:** Content Manager → Single Types → Profile. Fill in name, tagline, bio (Markdown, blank line between paragraphs), email, LinkedIn and GitHub URLs → Save.

Check: the home page shows the bio and links again, and `https://cms.bhargavshukla.com/api/profile` without a token → 403.

### Resume single type (#5)

1. **Deploy the CMS** once the `CMS image` workflow for the merge commit has finished: `docker compose pull && docker compose up -d` on the VPS.
2. **Token:** production admin → Settings → API Tokens → `frontend-read` → add **Resume `find`** → Save.
3. **Content, in your own time:** Content Manager → Single Types → Resume. Save drafts as often as you like; nothing shows until **Publish**. Until then `/resume` is a 404 and the Resume nav link stays hidden.
4. **Show it:** once published, set `live: true` for Resume in `src/lib/site.ts` (a one-line PR). That adds it to the nav, the phone tab bar and the home intro's links.

### Credited images (#40)

The post `cover` changes from a media field to the `shared.image` component, so **existing covers are dropped** when the new CMS image starts.

1. Deploy the CMS once the `CMS image` workflow for the merge commit has finished: `docker compose pull && docker compose up -d`.
2. Re-add any covers you want to keep: Content Manager → the post → Cover → add an entry with either the uploaded file or the photo URL plus credit → Save and Publish. Files already uploaded stay in the Media Library.

### Asides (#18)

1. Deploy the CMS once the `CMS image` workflow for the merge commit has finished: `docker compose pull && docker compose up -d`.
2. **Token:** production admin → Settings → API Tokens → `frontend-read` → add **Aside `find` + `findOne`** and **Tag `find` + `findOne`** → Save.
3. **Content:** Content Manager → Tag (a few to start), then Aside → write and **Publish** at least one.
4. **Show it:** set `live: true` for Asides in `src/lib/site.ts` (a one-line PR). Until then `/asides` works but isn't linked.

### Home headshot (#59)

Merging deploys both halves on their own: the Worker in about a minute, the CMS (new `photo` field on Profile) a few minutes later through the automated deploy (#48). In between, Strapi rejects the home page's request for `photo`, so the home page shows only the name, uncached, until the CMS deploy finishes.

1. Wait for the `CMS image` workflow's `deploy` job to go green.
2. **Content:** Content Manager → Single Types → Profile → Photo → upload a roughly square photo with your face centred (it's cropped to a circle) → Save. Saving purges the home page (#17). No token change: the photo comes with the Profile.
3. To remove it, clear the field and Save; the intro falls back to the name and tagline alone.

### Edge cache and purge (#16, #17)

Pages are cached at the edge for up to 10 minutes and purged by content type when Strapi changes them ([caching.md](caching.md)). Set up the purge in this order:

1. **Cloudflare API token:** My Profile → API Tokens → Create Token → Custom token. Name `bs-blog-purge`; Permissions **Zone → Cache Purge → Purge**; Zone Resources **Include → Specific zone → bhargavshukla.com**; no expiry. Copy the token.
2. **Worker secrets:** Workers & Pages → `bs-blog` → Settings → Variables and Secrets → Add, type **Secret**:
   - `CF_PURGE_TOKEN`: the token from step 1.
   - `PURGE_SECRET`: a fresh random value, made on your machine with `openssl rand -base64 32 | tr -d '\n' | pbcopy` and pasted straight in. Keep it in the clipboard for step 4 only.
3. **Merge** the #17 PR. `CF_ZONE_ID` is already a plain var in [`wrangler.jsonc`](../wrangler.jsonc) (the zone's Overview page → API → Zone ID; not a secret). The secrets must exist first, or every purge answers 500.
4. **Strapi webhook:** production admin → Settings → Webhooks → Create new webhook. Name `purge edge cache`; URL `https://bhargavshukla.com/api/purge`; header `Authorization` = `Bearer <PURGE_SECRET>`; events **Entry**: create, update, delete, publish, unpublish (leave Media off) → Save. **Trigger** must answer 200: a test event purges nothing, but proves the secret matches (a 401 means it doesn't).

Checks:

- `curl -s -D - -o /dev/null https://bhargavshukla.com/blog` twice → `x-edge-cache: MISS`, then `HIT`.
- Edit and publish a post: Workers & Pages → `bs-blog` → Observability (or `pnpm exec wrangler tail`) shows `Purge: purged type:post`; the next `curl` is a `MISS` with the new content.
- `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -H 'authorization: Bearer nope' -d '{}' https://bhargavshukla.com/api/purge` → 401.

**Purge everything by hand:** the same request with the real secret and `-d '{"all":true}'` (or dashboard → Caching → Configuration → Purge Everything).

**If a purge fails** (`Purge: failed …` in the logs; Strapi doesn't retry), pages stay stale for at most 10 minutes. A 403 from Cloudflare means the API token is wrong or expired: replace `CF_PURGE_TOKEN`. To rotate `PURGE_SECRET`, change it on the Worker and in the webhook header together.

### Draft preview (#57)

Strapi's **Open preview** opens drafts on the real site ([caching.md → Draft preview](caching.md#draft-preview-57--srclibserverpreviewts)). The CMS and the Worker share one secret. Set it up before merging:

1. **Make the secret** on your machine: `openssl rand -hex 32 | tr -d '\n' | pbcopy`. Keep it in the clipboard for steps 2 and 3 only.
2. **Worker:** Workers & Pages → `bs-blog` → Settings → Variables and Secrets → Add, type **Secret**, name `PREVIEW_SECRET`, paste.
3. **VPS:** add `PREVIEW_SECRET=<paste>` to `/opt/cms/.env` (edit it in place; don't echo it into a shell where history keeps it). `CLIENT_URL` comes from the compose file.
4. **Merge.** The CMS deploy restarts Strapi with both values, which turns preview on. Without them, Strapi shows no Preview button, and `/api/preview` answers 401.
5. **Check:** create a post, save it without publishing, and click **Open preview**. The draft opens with the "Preview mode" banner. **Exit** goes back to the published view (a 404 for a post that was never published).

To rotate the secret, change it on the Worker and in `/opt/cms/.env` together, then restart Strapi (`docker compose up -d` in `/opt/cms`). Changing it also ends every open preview session.

### Local dev against production content (#98)

Test content and code on your machine before either goes live: `pnpm dev:cms` runs the local site against `cms.bhargavshukla.com` and can show drafts. Only `/admin*` sits behind Access; the REST API takes an API token.

1. **Token (once):** in the production admin, Settings → API Tokens → Create. Name `local-dev-read`, type **Custom**, duration **30 days**. Permissions: `find` and `findOne` on Post, Category, Aside and Tag, and `find` on Profile and Resume (the same as frontend-read; it also reads drafts). Never reuse the Worker's `STRAPI_TOKEN`: this one can expire or be revoked on its own.
2. **Env file (once):** copy [`.env.cms.example`](../.env.cms.example) to `.env.cms` (gitignored) and paste the token. Vite reads `.env` first and `.env.cms` on top of it, so only `STRAPI_URL` and `STRAPI_TOKEN` change.
3. **Run:** `pnpm dev:cms`. Published content shows as on the live site; images come from R2.
4. **Drafts:** `pnpm preview-link /resume` (any site path; add a port if it isn't 5173) prints a link that works for 5 minutes. Open it: the Preview mode banner shows, and every page shows drafts for 2 hours. **Exit** goes back to published content.

The link is signed with the **local** `PREVIEW_SECRET` from `.env`, so the production secret never leaves the Worker and the VPS. Strapi's own **Open preview** button still opens the live site. Read counts come from the local D1 copy, not production. When the token expires, make a new one and replace it in `.env.cms`.

### Monitoring (#64)

1. **UptimeRobot:** sign up (free) → **Add New Monitor** → type **HTTP(s)**, name `bhargavshukla.com`, URL `https://bhargavshukla.com/`, interval 5 minutes, alert contact your email. Again for `cms.bhargavshukla.com` with URL `https://cms.bhargavshukla.com/_health`.
2. **Healthchecks.io:** sign up (free) → **Add Check** → name `cms nightly backup`, schedule **Cron** `15 3 * * *`, time zone UTC, grace 1 hour. Copy its ping URL (`https://hc-ping.com/<uuid>`).
3. **VPS:** add `BACKUP_PING_URL=<that URL>` to `/opt/cms/backup.env` (edit the file; it's read by `backup.sh` at each run, no restart needed). The `backup.sh` with the ping arrives with the next CMS deploy.
4. **Test the heartbeat:** `sudo -u deploy /opt/cms/backup.sh nightly` on the VPS; Healthchecks shows a ping within seconds.
5. **Test the uptime alert** (planned, a minute of CMS downtime): `cd /opt/cms && docker compose stop strapi`; the CMS monitor goes down and emails within ~5 minutes; `docker compose start strapi` clears it. The site keeps serving cached pages meanwhile; uncached ones fail until Strapi is back.

### Read counts (#87)

Before merging #87 (the Worker refuses to deploy with a binding to a database that doesn't exist):

1. `pnpm exec wrangler d1 create bs-reads`: creates the database and prints its `database_id`; that goes in `wrangler.jsonc` (not secret).
2. `pnpm exec wrangler d1 migrations apply bs-reads --remote`: creates the tables.
3. **Merge.** Counting starts with the deploy.
4. **Check:** read a post for 10 seconds, then `pnpm exec wrangler d1 execute bs-reads --remote --command "SELECT * FROM views"` shows it with a count of 1. The page shows no number until 5.

### Automated CMS deploys (#48)

Every push to `main` that touches `cms/**` (or the workflow) builds the image, then the `deploy` job in [`cms-image.yml`](../.github/workflows/cms-image.yml) runs [`cms/deploy/deploy.sh`](../cms/deploy/deploy.sh) on the VPS for that exact commit:

1. Backup (`backup.sh nightly`), a restore point before any schema change.
2. Copies `docker-compose.yml`, `backup.sh`, the cron file and `deploy.sh` itself from the repo at that commit (files that don't exist there are kept).
3. Pins `CMS_TAG=<sha>` in `/opt/cms/.env`, pulls and restarts.
4. Waits up to 4 minutes for Strapi to be healthy **on that revision**. If it isn't, it rolls back to the revision that was running and the job fails.

Deploys run one at a time (`concurrency: cms-deploy`) and show up under the repo's **Environments → production**; an approval rule can be added there.

**Access.** A dedicated ed25519 key, stored only as the GitHub secret `CMS_DEPLOY_KEY`. On the VPS its `~deploy/.ssh/authorized_keys` line starts with `restrict,command="/opt/cms/deploy.sh"`: it can't open a shell, forward ports or run anything else; the SHA reaches the script as `SSH_ORIGINAL_COMMAND`. `CMS_KNOWN_HOSTS` pins the VPS host key; `CMS_HOST` holds the address (kept out of the repo).

**Roll back by hand** (with your own key): `ssh deploy@<vps> '/opt/cms/deploy.sh <previous sha>'`. Any commit with a pushed image works; `docker compose ps` and the image's `org.opencontainers.image.revision` label show what's running.

**Rotate the deploy key:** generate a new key pair, replace the `restrict,command=…` line in `~deploy/.ssh/authorized_keys` with the new public key, `gh secret set CMS_DEPLOY_KEY < <private key>`, delete the local private key. Never test the key with a command that prints files: a mistyped `-i` falls back to your own unrestricted key (it happened once and leaked `.env`). Use `ssh -v -i <key> -o IdentitiesOnly=yes -o IdentityAgent=none deploy@<vps> 'echo probe'`: it must print the `deploy.sh` usage line.

**Content-model changes still need manual steps** after the deploy: API token permissions for new types (Settings → API Tokens), and content.
