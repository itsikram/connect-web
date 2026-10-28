# Deploying to GoDaddy Deluxe (cPanel) Node.js hosting

The site is served by `server.js` (Node built-ins only, so the host needs no
`npm install`) from the `build/` folder.

## First-time app setup

cPanel → **Setup Node.js App** → **Create Application**

- Node.js version: highest available
- Application mode: Production
- Application root: e.g. `connect-web`
- Application URL: your domain (e.g. `connect-bd.online`)
- Application startup file: `server.js`

Do not set `PORT`; Passenger assigns it.

## Automatic deploys from GitHub

`.github/workflows/deploy-godaddy.yml` runs on every push to `main`. It builds
the app with `npm run build` on GitHub, uploads `build/`, `server.js` and
`package.json` over SSH, swaps the new `build/` in with a rename (the old one
stays as `build.previous`) and restarts the app. Nothing else in the app root
(`.env`, logs, `tmp/`) is touched.

### One-time setup

1. GoDaddy → My Products → Web Hosting → **Manage** → Settings → **SSH Access**:
   turn it on. Note the host (server IP or domain) and the cPanel username.
2. On your computer, create a key without a passphrase:
   `ssh-keygen -t ed25519 -N "" -C github-deploy -f godaddy_deploy`
   (the server repo can use the same key).
3. cPanel → **SSH Access** → Manage SSH Keys → **Import Key**: paste
   `godaddy_deploy.pub`, then **Manage** → **Authorize** it.
4. Pin the host key: `ssh-keyscan -p 22 <host>` and keep the output.
5. GitHub → this repo → Settings → Secrets and variables → **Actions**:

   | Kind     | Name                        | Value                                                 |
   | -------- | --------------------------- | ----------------------------------------------------- |
   | Secret   | `GODADDY_SSH_HOST`          | server IP or domain                                   |
   | Secret   | `GODADDY_SSH_USER`          | cPanel username                                       |
   | Secret   | `GODADDY_SSH_KEY`           | contents of `godaddy_deploy` (the private key)        |
   | Secret   | `GODADDY_SSH_KNOWN_HOSTS`   | output of step 4 (recommended)                        |
   | Secret   | `GODADDY_SSH_PORT`          | only if not 22                                        |
   | Secret   | `WEB_ENV_PRODUCTION_LOCAL`  | full contents of your local `.env.production.local`   |
   | Variable | `GODADDY_APP_DIR`           | application root, relative to home, e.g. `connect-web` |
   | Variable | `GODADDY_HEALTHCHECK_URL`   | e.g. `https://connect-bd.online/` (optional, checked after each deploy) |

   `.env.production` (committed) and `WEB_ENV_PRODUCTION_LOCAL` together
   give the same build as `npm run build` on your computer. When you change
   `.env.production.local`, update the secret too.

6. Push to `main`, or run the workflow from the **Actions** tab.

### Rollback

- Quick: in cPanel **File Manager** (or Terminal) rename `build` →
  `build.bad` and `build.previous` → `build`, then **Restart** the app.
- From GitHub: open the run of the last good commit and click
  **Re-run all jobs**.
