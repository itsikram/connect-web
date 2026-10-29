# Deploying to GoDaddy Node.js hosting

The site is served by `server.js` (Node built-ins only) from the `build/` folder.

## Automatic deploys from GitHub

This app runs on GoDaddy's managed Node.js hosting (host.godaddy.com → My Apps →
**connect-web**, app ID `nzt7quc6de`), with **Settings → Integrations → GitHub Sync** pointed at
this repo's `main` branch.

`.github/workflows/deploy-godaddy.yml` runs on every push to `main` and calls
the GoDaddy Hosting API: it imports the branch through GitHub Sync (what
**Update Preview** does), waits for the preview build, then publishes it (what
**Publish to Live** does). GoDaddy builds and runs the app itself, so build and
runtime environment values belong in the app's **Settings → Secrets** on
GoDaddy, not in GitHub.

### One-time setup

1. developer.godaddy.com → **Personal Access Tokens**: create a token with the
   scopes `hosting.application:read`, `hosting.source:write` and
   `hosting.deployment:execute`. One token can serve all your apps.
2. GitHub → this repo → Settings → Secrets and variables → **Actions** → New
   repository secret: name `GODADDY_PAT`, value the token.
3. Push to `main`, or run the workflow from the **Actions** tab.

### Rollback

GitHub Sync always imports the head of `main`, so re-running an old workflow
run publishes the current code. To roll back, `git revert` the bad commit and
push.
