# Connect WordPress without a plugin

Hiqain publishes posts through the built-in WordPress REST API. No WordPress plugin is required. Each site is connected once with a WordPress **Application Password**, not the user's normal login password. Hiqain encrypts that credential and reuses it for later publishing until it is revoked or disconnected.

## Deploy the backend change

1. Back up the database. The new migration removes the old plugin callback tables and fields, and clears the old plugin-issued connections. Existing sites must reconnect.
2. Generate a persistent Fernet key if `WORDPRESS_CREDENTIALS_KEY` is not already set:

   ```powershell
   .\backend\.venv\Scripts\python.exe -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

   Put the result in `backend/.env` as `WORDPRESS_CREDENTIALS_KEY=...`. Keep this key secret and stable across deployments; changing it makes stored connections unreadable.
3. From `backend`, run `.\.venv\Scripts\alembic.exe upgrade head`.
4. Deploy/restart the backend and rebuild/redeploy the frontend (`npm.cmd run build` from `frontend`).

On a VPS, set `APP_ENV=production` and `APP_DEBUG=false` in the backend environment so the HTTPS and public-host checks are enforced. Apply the migration before starting the updated backend; the previous database schema is not compatible with new connections.

## Connect a site

1. Ensure the website already exists in Hiqain and runs WordPress. The backend must be able to reach its `/wp-json/` endpoint. Production sites need HTTPS.
2. In WordPress, sign in as an account that can edit and publish posts, open **Users → Profile → Application Passwords**, create one named `Hiqain`, and copy it.
3. In Hiqain, open that website's **Settings → Integrations**, enter the WordPress username and new Application Password, then click **Connect WordPress**. The password is verified and stored encrypted; the UI does not display it again.
4. Open an article and send it as a draft or publish it. Subsequent publishes reuse the saved credential and update the same WordPress post.

The REST API can create or update WordPress post fields such as title, content, slug, excerpt, and status. SEO-plugin-specific metadata and plugin callbacks are no longer sent or received. If a credential is revoked in WordPress, disconnect and connect again with a new Application Password.

Disconnecting in Hiqain removes its stored credential; for full revocation, also delete the Application Password in WordPress.

## Before exposing Hiqain to users

This platform currently has no login or per-website authorization. Keep the backend and dashboard private (for example behind company SSO/VPN) until authentication, website ownership checks, rate limiting, and CSRF protections are in place. Never expose the unauthenticated connect or publish endpoints to the public internet. Serve the dashboard and API over HTTPS, and protect database backups because they contain encrypted credentials.
