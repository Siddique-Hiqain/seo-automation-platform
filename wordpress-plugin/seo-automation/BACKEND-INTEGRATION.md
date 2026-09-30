# Backend integration contract

The WordPress plugin talks to the FastAPI backend (`SEOA_API_BASE`, default
`http://localhost:8000`). The backend implements this contract in
`backend/app/api/wordpress.py` and publishes through
`backend/app/services/wordpress.py`.

All endpoints live under `/api/integrations/wordpress/`.

---

## 1. Connect flow

```
WP admin ──(1) POST admin-post.php?action=seoa_start_connect
         ──(2) 302 → GET {API}/api/integrations/wordpress/connect?site_url=..&return=..&cid=..
Backend  ──(3) authenticate the user (login page on the dashboard), create a
               one-time `state` token tied to that user + site_url
         ──(4) 302 → {return}&seoa_state=<state>
WP admin ──(5) POST {API}/api/integrations/wordpress/connect   (server → server, JSON)
Backend  ──(6) 200 {"integration_id", "shared_secret", "website_id"}
```

### `GET /api/integrations/wordpress/connect`

| query      | meaning                                              |
|------------|------------------------------------------------------|
| `site_url` | URL-encoded `home_url()` of the WordPress site        |
| `return`   | URL-encoded wp-admin URL to redirect back to          |
| `cid`      | correlation ID (UUID), echoed again in step 5         |

Must end with a redirect to `return` + `&seoa_state=<token>`. Validate that the
host of `return` matches the host of `site_url`.

### `POST /api/integrations/wordpress/connect`

Request body:

```json
{
  "state": "one-time token from step 3",
  "base_url": "https://example.com",
  "admin_url": "https://example.com/wp-admin",
  "rest_url": "https://example.com/wp-json/",
  "username": "admin",
  "app_password": "abcd efgh ijkl mnop qrst uvwx",
  "permalink_structure": "/%postname%/",
  "site_name": "Example",
  "wp_version": "6.9",
  "plugin_version": "1.0.0",
  "seo_plugin": "yoast | rank_math | aioseo | none",
  "cid": "uuid"
}
```

Backend should:

1. Validate + consume `state` (single use, short TTL).
2. Find or create the `Website` row for `base_url` (fits the existing
   `websites` table — `url` is unique).
3. Store the integration: `website_id`, `base_url`, `rest_url`, `username`,
   `app_password` (**encrypted at rest**), `seo_plugin`, `permalink_structure`,
   a random 32-byte `shared_secret`, `status = "connected"`.
4. Respond `200`:

```json
{ "integration_id": 12, "shared_secret": "<64 hex chars>", "website_id": 3 }
```

`shared_secret` **must be hex** — the plugin does `pack('H*', secret)`.
Any non-200 is shown to the admin; FastAPI's `{"detail": "..."}` is unwrapped.

---

## 2. Signed requests (plugin → backend)

Used by `disconnect`, `permalinks` and `post-status`.

Headers:

```
X-SEOA-Integration-Id: 12
X-SEOA-Timestamp:      1758240000          (unix seconds)
X-SEOA-Nonce:          32 hex chars
X-SEOA-Signature:      sha256=<hex>
```

Verification (Python):

```python
import hashlib, hmac, time

def verify(method, path_with_query, headers, raw_body: bytes, secret_hex: str) -> bool:
    ts = int(headers["X-SEOA-Timestamp"])
    if abs(time.time() - ts) > 300:
        return False
    body_hash = hashlib.sha256(raw_body).hexdigest()   # sha256("") when no body
    canonical = f"{method.upper()}\n{path_with_query}\n{ts}\n{body_hash}"
    expected = "sha256=" + hmac.new(bytes.fromhex(secret_hex),
                                    canonical.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, headers["X-SEOA-Signature"])
```

Also reject a reused `(integration_id, nonce)` within the 300 s window.
`path_with_query` is the request path as the plugin saw it in `SEOA_API_BASE`
(e.g. `/api/integrations/wordpress/disconnect`). If the API sits behind a path
prefix/proxy, use the external path.

### `POST /api/integrations/wordpress/disconnect`
No body. Mark the integration disconnected and delete the stored app password.
Return `200`.

### `POST /api/integrations/wordpress/permalinks`
Sent when permalinks change and once per plugin version after connecting.

```json
{
  "permalink_structure": "/%postname%/",
  "old_permalink_structure": "",
  "site_url": "https://example.com",
  "plugin_version": "1.0.0",
  "plugin_capabilities": ["managed_post_trash_guard_v1", "seo_meta_rest_v1"],
  "seo_plugin": "yoast"
}
```
(`old_permalink_structure` only on change; `seo_plugin` only on the capability report.)
Return `200`.

### `POST /api/integrations/wordpress/post-status`

```json
{
  "platform_id": "123",
  "article_id": 45,
  "status": "publish | draft | trash",
  "link": "https://example.com/my-article/",
  "event_id": "uuid (idempotency key)",
  "previous_status": "draft",
  "origin": "SEO_AUTOMATION | WORDPRESS_USER | AUTOMATION | UNKNOWN",
  "actor_user_id": 1,
  "blocked": false,
  "occurred_at": "2026-09-19T10:00:00+00:00",
  "plugin_version": "1.0.0"
}
```

Update `articles.status` for `article_id` (dedupe on `event_id`).
`blocked: true` means another plugin/cron tried to trash the post and the
plugin stopped it — log it, don't change the status. Return `200`.

---

## 3. Publishing an article (backend → WordPress)

Use the stored app password with HTTP Basic auth against core WP REST:

```
POST {rest_url}wp/v2/posts
Authorization: Basic base64(username:app_password)
```

Mapping from the `articles` table:

```json
{
  "title": "<articles.title>",
  "content": "<articles.content as HTML, plus the FAQ section>",
  "status": "draft | publish",
  "slug": "<articles.slug>",
  "meta": {
    "_seoa_article_id": 45,
    "_seoa_integration_id": 12
  },

  "yoast_meta":          { "yoast_wpseo_title": "<meta_title>", "yoast_wpseo_metadesc": "<meta_description>", "yoast_wpseo_focuskw": "<keyword>" },
  "rank_math_meta_data": { "title": "<meta_title>", "description": "<meta_description>", "focuskw": "<keyword>" },
  "aioseo_meta_data":    { "title": "<meta_title>", "description": "<meta_description>", "focuskw": "<keyword>" }
}
```

Only send the SEO field matching the `seo_plugin` reported at connect time —
the plugin only registers the field for the active SEO plugin.

The two `_seoa_*` meta keys mark the post as managed; without them the trash
guard and status sync ignore the post. Save the returned post `id` and `link`
on the article.

### Deleting / trashing a managed post

Managed posts can only be trashed via the Application Password if the request
carries a signed delete intent:

```
DELETE {rest_url}wp/v2/posts/{post_id}
X-SEOA-Delete-Integration-Id: 12
X-SEOA-Delete-Timestamp:      1758240000
X-SEOA-Delete-Nonce:          <random>
X-SEOA-Delete-Signature:      sha256=<hex>
```

```python
canonical = f"{integration_id}\n{ts}\n{nonce}\n{post_id}\ntrash"
sig = "sha256=" + hmac.new(bytes.fromhex(secret_hex), canonical.encode(),
                           hashlib.sha256).hexdigest()
```

---

## Storage model

```
wordpress_integrations
  id               PK
  website_id       FK websites.id
  base_url         varchar(512)
  rest_url         varchar(512)
  username         varchar(255)
  app_password     text   (encrypted)
  shared_secret    varchar(64)
  seo_plugin       varchar(20)
  permalink_structure varchar(255)
  plugin_version   varchar(20)
  capabilities     JSON
  status           varchar(20)   connected | disconnected
  created_at / updated_at
```

Plus on `articles`: `wp_post_id` (int, nullable) and `wp_link` (varchar, nullable).
