<?php
/*
Plugin Name: Hiqain
Description: Connect your site to Hiqain to research topics and publish AI-written, SEO-optimized articles.
Version: 1.0.3
Requires at least: 5.6
Requires PHP: 7.3
Author: Hiqain
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: seo-automation
*/

if ( ! defined( 'ABSPATH' ) ) { exit; } // Block direct access

// ------------------------------------------------------------------
// Plugin constants
// ------------------------------------------------------------------
if ( ! defined( 'SEOA_PLUGIN_VERSION' ) ) {
	define( 'SEOA_PLUGIN_VERSION', '1.0.3' );
}

if ( ! defined( 'SEOA_PLUGIN_FILE' ) ) {
	define( 'SEOA_PLUGIN_FILE', __FILE__ );
}

// Default backend (FastAPI) URL. Override in wp-config.php with:
//   define( 'SEOA_API_BASE', 'https://api.your-domain.com' );
if ( ! defined( 'SEOA_DEFAULT_API_BASE' ) ) {
	define( 'SEOA_DEFAULT_API_BASE', 'https://seo-automation.hiqain.com' );
}

// Default dashboard (frontend) URL. Override in wp-config.php with:
//   define( 'SEOA_APP_URL', 'https://app.your-domain.com' );
if ( ! defined( 'SEOA_DEFAULT_APP_URL' ) ) {
	define( 'SEOA_DEFAULT_APP_URL', 'https://seo-automation.hiqain.com' );
}

// Name of the WordPress Application Password created by this plugin.
if ( ! defined( 'SEOA_APP_PASSWORD_LABEL' ) ) {
	define( 'SEOA_APP_PASSWORD_LABEL', 'Hiqain' );
}

// ------------------------------------------------------------------
// Includes
// ------------------------------------------------------------------
require_once __DIR__ . '/inc/settings.php';
require_once __DIR__ . '/inc/security.php';
require_once __DIR__ . '/inc/connect-flow.php';
require_once __DIR__ . '/inc/disconnect.php';
require_once __DIR__ . '/inc/admin-menu.php';
require_once __DIR__ . '/inc/notices.php';
require_once __DIR__ . '/inc/permalinks.php';
require_once __DIR__ . '/inc/post-status.php';
require_once __DIR__ . '/inc/seo-rest.php';

// Admin UI
require_once __DIR__ . '/admin/connect-page.php';

// ------------------------------------------------------------------
//  SEO REST BOOTSTRAPPING (RankMath, Yoast, AIOSEO)
// ------------------------------------------------------------------

add_action(
	'plugins_loaded',
	function () {
		if ( class_exists( 'RankMath\\Plugin' ) || class_exists( 'RankMathPro\\Plugin' ) ) {
			add_filter( 'rank_math/sitemap/enable_caching', '__return_false' );
		}
		new SEOA_SEO_REST_API();
	},
	20
);

add_action( 'init', 'seoa_register_rank_math_meta' );
