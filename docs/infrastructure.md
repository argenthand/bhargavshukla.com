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
- **Test before merging, locally:** `pnpm build && pnpm exec wrangler dev` serves the production build in the Workers runtime at http://localhost:8787. Add `--ip 0.0.0.0` and open `http://<this machine's LAN IP>:8787` to check the layout on a phone. `pnpm exec wrangler deploy --dry-run` shows the bundle size.
- **Workers Builds** (dashboard → Workers & Pages → Create → Import a repository) deploys `main` to production:

  | Setting                                | Value                  |
  | -------------------------------------- | ---------------------- |
  | Worker name                            | `bs-blog` (must match) |
  | Branch control → Production branch     | `main`                 |
  | Build command                          | `pnpm build`           |
  | Deploy command                         | `npx wrangler deploy`  |
  | Branch control → Enable Preview Builds | unchecked              |

  There are no preview deploys: the site has one author, local `wrangler dev` covers the same checks, and `workers.dev` preview URLs sit outside the `bhargavshukla.com` zone so they can't show edge-cache behaviour anyway. If the Worker is ever renamed or recreated, disconnect and reconnect the repository under Settings → Build → Git repository; otherwise builds fail with "The name in your wrangler.jsonc file … must match the name of your Worker" even when the names match (the build trigger still points at the old Worker).

- **`www` → apex:** a proxied placeholder record `www` AAAA `100::`, plus a Redirect Rule (Rules → Redirect Rules → "Redirect from WWW to root" template): 301, keep the path and query string. The rule only matches `https://www…`; Always Use HTTPS upgrades `http://www…` first (two hops), otherwise it reaches the `100::` placeholder and fails with a 523.
- Free plan limits that matter: 100k requests/day, 3 MB compressed Worker size (watch the Shiki language count). The hello page is ~86 KiB gzipped.

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
- Deploy (manual for now): `ssh deploy@<vps> 'cd /opt/cms && docker compose pull && docker compose up -d'`.

## Media: Cloudflare R2

- Buckets: `media` (public, custom domain `media.bhargavshukla.com`) and `backups` (private).
- Strapi upload provider: `@strapi/provider-upload-aws-s3` pointed at the R2 S3 endpoint.
- Add `media.bhargavshukla.com` to `img-src` and `media-src` in Strapi's `config/middlewares.ts` CSP.
- Free tier: 10 GB storage, no egress fees.

## Backups

| What                                          | When                | Where                                 |
| --------------------------------------------- | ------------------- | ------------------------------------- |
| `sqlite3 data.db ".backup …"` + `rclone copy` | nightly (host cron) | R2 `backups` bucket, 30-day retention |
| `strapi export --no-encrypt`                  | weekly              | R2 `backups` bucket                   |
| Hetzner automated backups                     | daily (Hetzner)     | Hetzner                               |

**Restore drill:** at least once, restore a backup into a local Strapi and confirm it boots with content.

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
