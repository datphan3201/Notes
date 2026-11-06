# Local development and hot reload

[Operations](README.md)

## Normal start

Reuse the existing database/dependencies/environment. From backend:

```bash
php bin/console migrate:check
php -d opcache.enable=0 -S 127.0.0.1:8000 -t public dev-router.php
```

In a second terminal from frontend:

```bash
npm run dev
```

For live collaboration on shared Notes, a third terminal from backend runs the WebSocket server. Without a proxy, set `REALTIME_PUBLIC_URL=ws://localhost:8090` in the ignored backend environment so browsers connect to it directly (the CSP allows that origin):

```bash
php bin/realtime.php
```

Without it, shared Notes still autosave; only live updates are missing. The service worker registers only for production builds (not under `npm run dev`); to test offline mode, build the frontend and use the built assets.

Set VITE_DEV_URL=http://127.0.0.1:5173 in the ignored backend environment first; APP_ENV must be local. Open **http://localhost:8000**, matching APP_URL, not the Vite asset server. PHP reads source on each request with opcode caching disabled. Vite updates CSS/JS and emits full reloads for PHP views/backend source/bootstrap/routes. Save unfinished forms before editing files that trigger a reload. Schema changes still need an explicit migration.

[The Vite config](../../frontend/vite.config.js) fixes port 5173 with strictPort and server.origin. [AssetManifest](../../backend/src/Http/View/AssetManifest.php) emits development entries. [The local CSP](../../backend/src/Http/Security/ContentSecurityPolicy.php) allows the validated dev origin; production keeps its same-origin policy. In VS Code Remote, forward both 8000 and 5173 to the same local port numbers.

## Background start

Start only one PHP and one Vite process per port. From the repository root:

```bash
nohup php -d opcache.enable=0 -S 127.0.0.1:8000 -t backend/public backend/dev-router.php > /tmp/planner-php-dev.log 2>&1 < /dev/null &
(cd frontend && nohup npm run dev > /tmp/planner-vite-dev.log 2>&1 < /dev/null &)
```

Use the exact PIDs you started when stopping services. Do not kill every PHP/Node/MySQL process on the machine. The development server has no production supervision or TLS.

## Verify

```bash
curl -fsS http://localhost:8000/up
curl -I http://localhost:8000/login
curl -I http://localhost:8000/register
```

Health returns data.status=ok; login/register render 200. A protected page redirects a guest to login. Authenticate to verify actual data; shell 200 alone does not prove that a Goal/Task ID is owned or exists.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| CSS/JS absent | Vite is running; VITE_DEV_URL and server.origin match; port 5173 is forwarded; browser CSP/network errors |
| Font/image 404 on port 8000 | Vite server.origin must be 127.0.0.1:5173 so injected CSS URLs point to Vite |
| 419 after submitting a form | APP_URL/browser Origin match, valid cookie/CSRF token; do not disable CSRF |
| Built manifest missing | With dev mode disabled, run frontend npm run build |
| Connection refused / database error | Correct persistent MySQL instance, TCP port, DB credentials and database name |
| Migration checksum mismatch | Stop; inspect applied DDL/ledger and make a forward repair or restore; never rewrite history |
| Generic 500 | Inspect private server logs/request ID, platform extensions and configuration; do not expose secrets |
| AI unavailable | AI_ENABLED/provider/key/model; do not substitute untested live-provider claims |
| Email not in inbox | In local/testing without SMTP it is a private .eml outbox file; see jobs/mail |

After a pull, install dependencies only when lockfiles changed, migrate when new migrations exist, and rebuild when using production assets. Existing user data is not automatically reseeded.

## Share the local app through Cloudflare quick tunnels

From the repository root, `bash tools/dev/tunnel.sh` (or `planner tunnel`, below) serves this checkout publicly in one step: it starts a user-level database that is down, checks migrations (asking before applying pending ones, after a `mysqldump` backup into private storage), builds the frontend when it changed, opens one quick tunnel for the site and one for live collaboration, and starts `php -S` and `bin/realtime.php` with the public URLs as environment overrides. backend/.env is not edited and nothing is installed. Options: `--port`, `--realtime-port`, `--build`, `--no-build`, `--no-realtime`, `--yes`. Ctrl+C stops every process; logs are in backend/storage/logs/tunnel. URLs change on every run (use funnel.sh below for a fixed one), and all visitors share one client address for rate limits, so use [the server setup](deployment.md) for real hosting.

## Share the local app at a fixed address with Tailscale Funnel

Short form: run `bash tools/dev/install-command.sh` once; afterwards `planner` runs funnel.sh and `planner tunnel` runs tunnel.sh from any folder. Both scripts start a user-level MySQL by themselves when the database is down and `~/.local/share/planner/mysql/my.cnf` (or `PLANNER_MYSQL_CNF`) exists, and build the frontend only when its sources or lockfile changed since the last build (`--build` forces a build, `--no-build` skips it).

`bash tools/dev/funnel.sh` does the same as tunnel.sh but publishes the app at this machine's fixed Tailscale name, `https://<machine>.<tailnet>.ts.net`, so the address and links in emails survive restarts. One Funnel serves the site and forwards `/realtime` to the live collaboration server on the same name; Ctrl+C stops the app and turns off only the Funnel handlers the script added. Options are the same as tunnel.sh. The shared steps (database check and backup before migrations, frontend build, starting PHP and realtime) live in [tools/dev/lib.sh](../../tools/dev/lib.sh).

One-time setup on the machine (needs sudo and the owner's Tailscale account):

1. Install and sign in: `curl -fsSL https://tailscale.com/install.sh | sh`, then `sudo tailscale up`.
2. In the Tailscale admin console turn on MagicDNS and HTTPS certificates. Funnel itself is approved on first use: funnel.sh shows the link Tailscale prints and continues once it is opened and confirmed. Public DNS for the new name can then take a few minutes (a browser shows NXDOMAIN meanwhile).
3. `sudo tailscale set --operator=$USER`, so the script can configure Funnel without sudo.

The machine must stay on; behind Funnel every visitor reaches PHP from loopback, so rate limits are shared as with quick tunnels. A Vercel or other HTTP-only proxy in front of the `.ts.net` name would break live collaboration (no WebSocket forwarding) and can cut long AI requests and large uploads, so link to the `.ts.net` name directly or use a domain with [the server setup](deployment.md).

## Existing Cloudflare Tunnel session

When the owner is already serving this checkout through a Cloudflare Tunnel, reuse that running origin for browser checks instead of starting another host/port. Keep the server, tunnel, database and startup overrides intact. The PHP process may explicitly override APP_URL, VITE_DEV_URL and SESSION_SECURE_COOKIE from backend/.env; inspect only the needed non-secret keys, never dump the entire environment. Read a quick tunnel's active hostname from its configured loopback metrics /quicktunnel endpoint. Use the public HTTPS origin for login/CSRF checks; a local HTTP check does not establish public-origin correctness.

Use the [existing-runtime CD mode](deployment.md#reuse-an-already-running-php-server-and-cloudflare-tunnel) to connect this checkout to green main CI without provisioning another host. Feature branches and dirty files are preserved, so a development checkout must return to clean main before automatic fast-forward deployment can occur. Test databases remain isolated even when browser checks use the existing app.
