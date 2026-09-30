<?php
// inc/settings.php

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Settings helpers.
function seoa_get_settings() {
	$defaults = [
		'connected'          => false,
		'user'               => '',
		'method'             => '',
		'updated'            => 0,
		'api_base'           => SEOA_DEFAULT_API_BASE,
		'state'              => '',
		'cid'                => '',
		'integration_id'     => 0,
		'website_id'         => 0,
		'shared_secret'      => '',
		'base_url_cached'    => '',
		'last_connected_at'  => 0,
	];

	return wp_parse_args( get_option( 'seoa_settings', [] ), $defaults );
}

function seoa_set_settings( $overrides ) {
	$settings = seoa_get_settings();
	foreach ( (array) $overrides as $k => $v ) {
		$settings[ $k ] = $v;
	}
	update_option( 'seoa_settings', $settings );
}

function seoa_get_cid() {
	$settings = seoa_get_settings();
	if ( empty( $settings['cid'] ) ) {
		$settings['cid'] = wp_generate_uuid4();
		seoa_set_settings( [ 'cid' => $settings['cid'] ] );
	}
	return $settings['cid'];
}

/**
 * Base API URL for the SEO Automation backend (FastAPI).
 *
 * Resolution order:
 * 1. SEOA_API_BASE constant in wp-config.php
 * 2. api_base stored in plugin settings
 * 3. SEOA_DEFAULT_API_BASE
 *
 * No post content, user content, or blog data is transmitted through this
 * function. It only provides the base URL for admin-initiated
 * connect/disconnect/status calls.
 */
function seoa_api_base() {
	if ( defined( 'SEOA_API_BASE' ) && SEOA_API_BASE ) {
		return untrailingslashit( SEOA_API_BASE );
	}
	$settings = seoa_get_settings();
	return untrailingslashit( $settings['api_base'] ?: SEOA_DEFAULT_API_BASE );
}

/**
 * Base URL of the SEO Automation dashboard (frontend).
 */
function seoa_app_url() {
	if ( defined( 'SEOA_APP_URL' ) && SEOA_APP_URL ) {
		return untrailingslashit( SEOA_APP_URL );
	}
	return untrailingslashit( SEOA_DEFAULT_APP_URL );
}

/**
 * Remote endpoint: /api/integrations/wordpress/connect
 *
 * - GET  (browser bounce): starts the connect flow; the platform authenticates
 *   the user and redirects back to wp-admin with ?seoa_state=...
 * - POST (server-to-server): exchanges the state token + application password
 *   for an integration_id + shared_secret.
 *
 * Data sent on POST:
 * - Basic site metadata (home_url, admin_url, permalink structure)
 * - WordPress application password (generated for the current admin)
 * - Temporary state token used only during this flow
 *
 * No post content, comment content, or user-submitted data is exported.
 */
function seoa_api_wp_connect_url() {
	return trailingslashit( seoa_api_base() ) . 'api/integrations/wordpress/connect';
}

/**
 * Remote endpoint: POST /api/integrations/wordpress/disconnect
 *
 * Revokes the integration on the platform. HMAC-signed; no site content sent.
 */
function seoa_api_wp_disconnect_url() {
	return trailingslashit( seoa_api_base() ) . 'api/integrations/wordpress/disconnect';
}

/**
 * Allowlist the API host for safe_redirect so the connect bounce works.
 */
add_filter(
	'allowed_redirect_hosts',
	function ( $hosts ) {
		$api_parts = wp_parse_url( seoa_api_base() );
		$api_host  = isset( $api_parts['host'] ) ? $api_parts['host'] : '';

		if ( $api_host ) {
			$hosts[] = $api_host;
		}

		return array_values( array_unique( array_filter( $hosts ) ) );
	}
);

/**
 * Build the dashboard URL for the connected site.
 *
 * Includes the integration/website IDs (if connected) and the site's home URL.
 * No site content is transmitted here.
 */
function seoa_dashboard_url() {
	$s   = seoa_get_settings();
	$url = seoa_app_url() . '/dashboard';

	if ( ! empty( $s['website_id'] ) ) {
		$url = add_query_arg( [ 'website_id' => (int) $s['website_id'] ], $url );
	}

	if ( ! empty( $s['integration_id'] ) ) {
		$url = add_query_arg( [ 'wp_integration' => (int) $s['integration_id'] ], $url );
	}

	$url = add_query_arg( [ 'site' => home_url() ], $url );

	return apply_filters( 'seoa_dashboard_url', $url, $s );
}
