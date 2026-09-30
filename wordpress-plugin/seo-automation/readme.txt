=== Hiqain ===
Contributors: hiqain
Tags: ai, seo, content, writing, automation
Requires at least: 5.6
Tested up to: 6.9
Requires PHP: 7.3
Stable tag: 1.0.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect WordPress to Hiqain to research topics and publish AI-written, SEO-optimized articles.

== Description ==

Hiqain crawls your website, builds a business profile, researches and scores topics and keywords, and writes long-form SEO articles with meta titles, meta descriptions and FAQs.

This plugin securely links your WordPress site to the platform so articles can be published directly into WordPress.

**Features include:**

* One-click connection from WordPress
* Secure integration using WordPress Application Passwords + HMAC-signed requests
* Sets meta title, meta description and focus keyword in Yoast SEO, Rank Math or All in One SEO
* Keeps article status in sync (publish / draft / trash)
* Protects platform-managed posts from unattended trashing by other plugins or cron
* Lightweight — no editor modifications inside WordPress

== Installation ==

1. Upload the `seo-automation` folder to `/wp-content/plugins/` (or zip it and use Plugins → Add New → Upload).
2. Activate the plugin through the “Plugins” screen in WordPress.
3. Go to **Hiqain** in your WordPress menu.
4. Click **Connect** to link your site to the platform.

= Configuration (wp-config.php) =

    define( 'SEOA_API_BASE', 'https://api.your-domain.com' );   // FastAPI backend (default http://localhost:8000)
    define( 'SEOA_APP_URL',  'https://app.your-domain.com' );   // Dashboard frontend (default http://localhost:3000)
    define( 'SEOA_SSLVERIFY', false );                           // Local development only

== Frequently Asked Questions ==

= What data does the plugin send? =
During connection: your site URL, admin URL, REST URL, site name, WordPress version, permalink structure, active SEO plugin and a generated WordPress Application Password.
After connection: the WordPress post ID, linked article ID, status transition, event timestamp, plugin version and the acting WordPress user ID when available.
No post content, comment content, analytics, or visitor data is sent automatically.

= Can I disconnect later? =
Yes. Click **Disconnect** on the Hiqain page, or revoke the “Hiqain” Application Password in your user profile.

= What happens if I deactivate the plugin? =
The plugin removes its local credentials and Application Password and attempts a clean remote disconnect.

== Changelog ==

= 1.0.3 =
* Default backend/dashboard URLs point at the hosted platform so the plugin works on upload.

= 1.0.2 =
* Moved platform endpoints into the standard `/api` namespace.

= 1.0.1 =
* Updated the plugin branding to Hiqain.

= 1.0.0 =
* Initial release.
