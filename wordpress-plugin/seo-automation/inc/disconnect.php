<?php
// inc/disconnect.php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Send an HMAC-signed request to the SEO Automation API.
 *
 * Signature (hex HMAC-SHA256, key = hex-decoded shared_secret):
 *   canonical = METHOD \n PATH?QUERY \n TIMESTAMP \n sha256_hex(BODY)
 *
 * Headers:
 *   X-SEOA-Integration-Id, X-SEOA-Timestamp, X-SEOA-Nonce,
 *   X-SEOA-Signature: sha256=<hex>
 */
function seoa_signed_request( $method, $url, $body = null ) {
	$settings       = seoa_get_settings();
	$integration_id = isset( $settings['integration_id'] ) ? intval( $settings['integration_id'] ) : 0;
	$secret_hex     = isset( $settings['shared_secret'] ) ? (string) $settings['shared_secret'] : '';

	if ( ! $integration_id || ! $secret_hex ) {
		return new WP_Error(
			'seoa_signed_request_misconfig',
			__( 'Missing integration_id or shared_secret', 'seo-automation' )
		);
	}

	$ts      = time();
	$nonce   = bin2hex( random_bytes( 16 ) );
	$parsed  = wp_parse_url( $url );
	$path    = isset( $parsed['path'] ) ? $parsed['path'] : '/';
	$query   = isset( $parsed['query'] ) ? ( '?' . $parsed['query'] ) : '';
	$path_qs = $path . $query;

	$body_raw  = $body ? wp_json_encode( $body ) : '';
	$body_hash = hash( 'sha256', $body_raw );

	$canonical = strtoupper( $method ) . "\n" . $path_qs . "\n" . $ts . "\n" . $body_hash;
	$hmac      = hash_hmac( 'sha256', $canonical, pack( 'H*', $secret_hex ) );

	$headers = [
		'Content-Type'          => 'application/json',
		'User-Agent'            => 'SEOAutomation-WP/' . SEOA_PLUGIN_VERSION . ' (+wp/' . get_bloginfo( 'version' ) . ')',
		'X-SEOA-Integration-Id' => $integration_id,
		'X-SEOA-Timestamp'      => $ts,
		'X-SEOA-Nonce'          => $nonce,
		'X-SEOA-Signature'      => 'sha256=' . $hmac,
	];

	$args = [
		'headers' => $headers,
		'method'  => $method,
		'timeout' => 15,
	];
	if ( $body ) {
		$args['body'] = $body_raw;
	}
	// Allow dev environments to override SSL explicitly.
	if ( defined( 'SEOA_SSLVERIFY' ) ) {
		$args['sslverify'] = (bool) SEOA_SSLVERIFY;
	}

	return wp_remote_request( $url, $args );
}

// ------------------------------------------------------------------
// Helper: delete the app password for the connected user
// ------------------------------------------------------------------
function seoa_delete_app_password_for_connected_user() {
	$settings = seoa_get_settings();
	$username = isset( $settings['user'] ) ? $settings['user'] : '';
	if ( ! $username ) {
		return;
	}
	$user = get_user_by( 'login', $username );
	if ( $user ) {
		seoa_delete_app_passwords_for_user( $user->ID );
	}
}

// Shared cleanup for both admin_post and deactivate paths.
function seoa_local_disconnect_cleanup() {
	seoa_delete_app_password_for_connected_user();
	seoa_set_settings(
		[
			'connected'      => false,
			'user'           => '',
			'method'         => '',
			'integration_id' => 0,
			'website_id'     => 0,
			'shared_secret'  => '',
		]
	);
	delete_option( 'seoa_capabilities_reported_version' );
}

/**
 * Admin-only handler: disconnect this site from the platform.
 *
 * Performs a signed POST to /api/integrations/wordpress/disconnect, then
 * removes local secrets and app passwords regardless of the remote result.
 */
add_action(
	'admin_post_seoa_disconnect',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die(
				esc_html__( 'Forbidden', 'seo-automation' ),
				'',
				[ 'response' => 403 ]
			);
		}

		if (
			empty( $_POST['_seoa_nonce'] ) ||
			! wp_verify_nonce(
				sanitize_text_field( wp_unslash( $_POST['_seoa_nonce'] ) ),
				'seoa_disconnect'
			)
		) {
			wp_die(
				esc_html__( 'Invalid request', 'seo-automation' ),
				'',
				[ 'response' => 400 ]
			);
		}

		$resp = seoa_signed_request( 'POST', seoa_api_wp_disconnect_url(), null );

		$ok = ! is_wp_error( $resp ) && 200 === (int) wp_remote_retrieve_response_code( $resp );

		// Regardless of backend result, wipe local secrets and delete WP App Passwords.
		seoa_local_disconnect_cleanup();

		$param = $ok
			? 'seoa_disconnected=1'
			: 'seoa_error=' . rawurlencode( __( 'Disconnected locally; server sync may have failed.', 'seo-automation' ) );

		wp_safe_redirect( admin_url( 'admin.php?page=seo-automation&' . $param ) );
		exit;
	}
);

// ------------------------------------------------------------------
// Deactivation + uninstall
// ------------------------------------------------------------------

/**
 * On plugin deactivation, attempt a clean remote disconnect, then always
 * remove local credentials and integration markers.
 */
register_deactivation_hook(
	SEOA_PLUGIN_FILE,
	function () {
		$settings = seoa_get_settings();

		if ( ! empty( $settings['integration_id'] ) && ! empty( $settings['shared_secret'] ) ) {
			// Ignore failures; we always clean up locally below.
			seoa_signed_request( 'POST', seoa_api_wp_disconnect_url(), null );
		}

		seoa_local_disconnect_cleanup();
	}
);

// Uninstall cleanup (when the plugin is deleted from Plugins screen).
function seoa_on_plugin_uninstall() {
	delete_option( 'seoa_settings' );
	delete_option( 'seoa_activation_redirect' );
	delete_option( 'seoa_capabilities_reported_version' );
}
register_uninstall_hook( SEOA_PLUGIN_FILE, 'seoa_on_plugin_uninstall' );
