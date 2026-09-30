<?php
// inc/connect-flow.php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Handle the first admin load after activation and the return
 * from the external SEO Automation connect flow.
 *
 * - On activation, redirects the admin once to the plugin page.
 * - When the platform redirects back with ?seoa_state=..., stores the
 *   state token and calls seoa_finish_connect().
 */
add_action(
	'admin_init',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Activation: redirect to the plugin page once.
		if ( get_option( 'seoa_activation_redirect' ) ) {
			delete_option( 'seoa_activation_redirect' );
			wp_safe_redirect( admin_url( 'admin.php?page=seo-automation' ) );
			exit;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- state token is verified by the platform.
		if ( isset( $_GET['seoa_state'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$state = sanitize_text_field( wp_unslash( $_GET['seoa_state'] ) );
			if ( $state ) {
				seoa_set_settings( [ 'state' => $state ] );
				$notice = seoa_finish_connect(); // redirects on success
				if ( is_array( $notice ) && ! headers_sent() ) {
					$param = $notice['ok']
						? 'seoa_connected=1'
						: ( 'seoa_error=' . rawurlencode( $notice['message'] ) );
					wp_safe_redirect( admin_url( 'admin.php?page=seo-automation&' . $param ) );
					exit;
				}
			}
		}
	}
);

/**
 * Admin-only handler: start the external "Connect" bounce.
 *
 * Redirects the admin to the platform connect URL with:
 * - site_url (home_url)
 * - return URL back to wp-admin
 * - a local correlation ID (cid)
 */
add_action(
	'admin_post_seoa_start_connect',
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
				'seoa_start_connect'
			)
		) {
			wp_die(
				esc_html__( 'Invalid request', 'seo-automation' ),
				'',
				[ 'response' => 400 ]
			);
		}

		// If App Passwords are disabled, send back to Connect with a clear message.
		if ( ! seoa_app_passwords_available() ) {
			$msg = __( 'Application passwords are still disabled. Please follow the steps below, then click “Connect” again.', 'seo-automation' );
			wp_safe_redirect( admin_url( 'admin.php?page=seo-automation&seoa_error=' . rawurlencode( $msg ) ) );
			exit;
		}

		// add_query_arg() does not encode values, so encode the URLs ourselves.
		$return_url = admin_url( 'admin.php?page=seo-automation' );
		$bounce_url = add_query_arg(
			[
				'site_url' => rawurlencode( home_url() ),
				'return'   => rawurlencode( $return_url ),
				'cid'      => seoa_get_cid(),
			],
			seoa_api_wp_connect_url()
		);

		wp_safe_redirect( $bounce_url );
		exit;
	}
);

/**
 * Finish the connect flow.
 *
 * - Consumes the temporary state token saved from ?seoa_state=...
 * - Creates a WordPress Application Password for the current admin.
 * - POSTs a one-time JSON payload to /api/integrations/wordpress/connect.
 * - Receives integration_id, shared_secret (hex) and optionally website_id.
 * - Stores only those identifiers + timestamps in the seoa_settings option.
 */
function seoa_finish_connect() {
	try {
		$settings = seoa_get_settings();
		$state    = $settings['state'];
		$cid      = seoa_get_cid();

		if ( ! $state ) {
			return [
				'ok'      => false,
				'message' => __( 'Missing connect token. Please try again.', 'seo-automation' ),
			];
		}

		if ( ! seoa_app_passwords_available() ) {
			return [
				'ok'      => false,
				'message' => __( 'Application Passwords are not available on this site.', 'seo-automation' ),
			];
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return [
				'ok'      => false,
				'message' => __( 'Not logged in.', 'seo-automation' ),
			];
		}

		// Remove old app passwords created by this plugin.
		seoa_delete_app_passwords_for_user( $user_id );

		// Create new App Password.
		$created = WP_Application_Passwords::create_new_application_password( $user_id, [ 'name' => SEOA_APP_PASSWORD_LABEL ] );
		if ( is_wp_error( $created ) || empty( $created[0] ) ) {
			return [
				'ok'      => false,
				'message' => __( 'Failed to create application password.', 'seo-automation' ),
			];
		}

		$app_password = $created[0];
		$username     = wp_get_current_user()->user_login;
		$base_url     = home_url();
		$admin_url    = rtrim( admin_url(), '/' );

		$payload = [
			'state'               => $state,
			'base_url'            => $base_url,
			'admin_url'           => $admin_url,
			'rest_url'            => rest_url(),
			'username'            => $username,
			'app_password'        => $app_password,
			'permalink_structure' => get_option( 'permalink_structure', '' ),
			'site_name'           => get_bloginfo( 'name' ),
			'wp_version'          => get_bloginfo( 'version' ),
			'plugin_version'      => SEOA_PLUGIN_VERSION,
			'seo_plugin'          => seoa_detect_seo_plugin(),
			'cid'                 => $cid,
		];

		$args = [
			'timeout' => 15,
			'headers' => [
				'Content-Type' => 'application/json',
				'User-Agent'   => 'SEOAutomation-WP/' . SEOA_PLUGIN_VERSION . ' (+wp/' . get_bloginfo( 'version' ) . ')',
				'X-Request-ID' => $cid,
			],
			'body' => wp_json_encode( $payload ),
		];

		// Allow dev environments to override SSL explicitly.
		if ( defined( 'SEOA_SSLVERIFY' ) ) {
			$args['sslverify'] = (bool) SEOA_SSLVERIFY;
		}

		$response = wp_remote_post( seoa_api_wp_connect_url(), $args );
		$code     = is_wp_error( $response ) ? 0 : (int) wp_remote_retrieve_response_code( $response );
		$body     = is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_body( $response );

		if ( 200 !== $code ) {
			// Roll back the created app password.
			seoa_delete_app_passwords_for_user( $user_id );

			// FastAPI errors come back as {"detail": "..."}.
			$parsed_err = json_decode( (string) $body, true );
			if ( is_array( $parsed_err ) && ! empty( $parsed_err['detail'] ) && is_string( $parsed_err['detail'] ) ) {
				$body = $parsed_err['detail'];
			}

			return [
				'ok'      => false,
				'message' => ( $body ?: __( 'Connection failed. Please try again.', 'seo-automation' ) ),
			];
		}

		$parsed         = json_decode( $body, true );
		$integration_id = isset( $parsed['integration_id'] ) ? (int) $parsed['integration_id'] : 0;
		$shared_secret  = isset( $parsed['shared_secret'] ) ? (string) $parsed['shared_secret'] : '';
		$website_id     = isset( $parsed['website_id'] ) ? (int) $parsed['website_id'] : 0;

		if ( ! $integration_id || ! $shared_secret || ! ctype_xdigit( $shared_secret ) ) {
			seoa_delete_app_passwords_for_user( $user_id );
			return [
				'ok'      => false,
				'message' => __( 'Malformed connect response.', 'seo-automation' ),
			];
		}

		seoa_set_settings(
			[
				'connected'          => true,
				'user'               => $username,
				'method'             => 'app_password',
				'updated'            => time(),
				'state'              => '',
				'integration_id'     => $integration_id,
				'website_id'         => $website_id,
				'shared_secret'      => $shared_secret,
				'base_url_cached'    => $base_url,
				'last_connected_at'  => time(),
			]
		);

		// Force a fresh capabilities report for the new integration.
		delete_option( 'seoa_capabilities_reported_version' );

		wp_safe_redirect( admin_url( 'admin.php?page=seo-automation&seoa_connected=1' ) );
		exit;

	} catch ( \Throwable $t ) {
		return [
			'ok'      => false,
			'message' => __( 'Unexpected error during connection.', 'seo-automation' ),
		];
	}
}
