# Connect WordPress with the Hiqain plugin

The installable archive is `hiqain-wordpress-plugin.zip` in the project root. It is **not** published to the WordPress plugin directory. The Hiqain dashboard serves this exact ZIP; keep it beside `backend/` when deploying the backend. The plugin code in the ZIP is not generated or changed by the dashboard.

## Deployment prerequisites

1. Back up the database, then run `cd backend` and `.\.venv\Scripts\alembic.exe upgrade head` (Windows) or `alembic upgrade head` (VPS). Revision `c9e2f6a718b4` restores the plugin handshake and callback tables after the earlier direct-REST migration. Do not downgrade the earlier migration to restore an old connection.
2. Keep a stable `WORDPRESS_CREDENTIALS_KEY` in `backend/.env`. The backend encrypts the plugin-created WordPress Application Password and the plugin's HMAC secret with it. Changing the key makes existing connections unreadable.
3. Configure a public HTTPS API origin that WordPress can reach. The ZIP defaults to `http://localhost:8000`, which points to the **WordPress server itself** when installed on a remote site. Before clicking Connect, put these lines in that site's `wp-config.php`, replacing the example domains:

   ```php
   define( 'SEOA_API_BASE', 'https://api.your-company.com' );
   define( 'SEOA_APP_URL', 'https://app.your-company.com' );
   ```

   `SEOA_API_BASE` is the public application origin. The plugin calls `/api/integrations/wordpress/*`, and that exact path must reach FastAPI because the plugin signs the request path. `SEOA_APP_URL` is the browser dashboard URL. Do not disable SSL verification in production.
4. WordPress Application Passwords must be enabled and the connecting WordPress administrator must be allowed to edit and publish posts. The backend must be able to reach that site's HTTPS REST API.

## User flow

1. Open the business's **Settings → Integrations** page in Hiqain and click **Download plugin and open WordPress**. The ZIP downloads and the WordPress plugin-upload page opens in a new tab. If the tab is blocked, use **Open WordPress upload**.
2. Sign in **on the WordPress site** with your normal WordPress credentials. Hiqain never asks for the normal login password.
3. In WordPress, choose the downloaded ZIP, click **Install Now**, then **Activate**. The plugin opens its Hiqain admin page.
4. Click **Connect** on that page. WordPress briefly redirects through the FastAPI connect URL, then returns to WordPress. The plugin creates a revocable Application Password for the current administrator and sends it to FastAPI over HTTPS. The backend verifies the password, associates the WordPress site with an existing matching business or creates a new business, and stores the credential encrypted. The one-time state expires after 10 minutes and cannot be reused.
5. The Hiqain integration page polls for the result and shows **Connected**. Articles can then be sent as drafts or published from the editor without reconnecting each time.

If the WordPress **Site Address** differs from the business URL entered in Hiqain (for example `www` versus non-`www`), the plugin may create a separate business. Use the same URL in both places. A WordPress installation whose admin or REST API uses another hostname is not supported by this handshake.

The plugin also sends signed disconnect, permalink/capability, and managed-post status updates. When publishing through a plugin connection, Hiqain includes managed-post markers and SEO metadata for the supported SEO plugin. Disconnect in WordPress or Hiqain, and revoke the Hiqain Application Password in WordPress when access is no longer needed.

## Security before exposing the platform

This project currently has no Hiqain user login or per-business authorization. Do **not** expose the whole FastAPI application to the public internet as-is: its other website, article, connect, publish, and delete endpoints are unauthenticated. Add authentication/ownership checks and route-level access controls first, or keep the dashboard and API behind a trusted private network that the WordPress server can reach. Always use HTTPS for production WordPress and API traffic.
