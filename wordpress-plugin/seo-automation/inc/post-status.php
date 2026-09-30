<?php
// inc/post-status.php

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Post meta set by the platform when it publishes an article:
//   _seoa_article_id     → articles.id in the SEO Automation backend
//   _seoa_integration_id → integration that owns the post
const SEOA_MANAGED_ARTICLE_META_KEY     = '_seoa_article_id';
const SEOA_MANAGED_INTEGRATION_META_KEY = '_seoa_integration_id';
const SEOA_MANAGED_POST_CAPABILITY      = 'managed_post_trash_guard_v1';
const SEOA_SEO_META_CAPABILITY          = 'seo_meta_rest_v1';
const SEOA_DELETE_INTENT_MAX_SKEW       = 300;

function seoa_plugin_capabilities() {
	return array( SEOA_MANAGED_POST_CAPABILITY, SEOA_SEO_META_CAPABILITY );
}

/** Register protected metadata used to identify posts managed by the platform. */
add_action(
	'init',
	function () {
		$auth_callback = function ( $allowed, $meta_key, $post_id ) {
			unset( $allowed, $meta_key );
			return current_user_can( 'edit_post', $post_id );
		};
		foreach ( array( SEOA_MANAGED_ARTICLE_META_KEY, SEOA_MANAGED_INTEGRATION_META_KEY ) as $key ) {
			register_post_meta(
				'post',
				$key,
				array(
					'type'              => 'integer',
					'single'            => true,
					'show_in_rest'      => true,
					'auth_callback'     => $auth_callback,
					'sanitize_callback' => 'absint',
				)
			);
		}
	}
);

function seoa_is_managed_post( $post ) {
	if ( ! $post instanceof WP_Post || 'post' !== $post->post_type ) {
		return false;
	}
	$settings       = seoa_get_settings();
	$integration_id = ! empty( $settings['integration_id'] ) ? (int) $settings['integration_id'] : 0;
	$managed_id     = (int) get_post_meta( $post->ID, SEOA_MANAGED_INTEGRATION_META_KEY, true );
	$article_id     = (int) get_post_meta( $post->ID, SEOA_MANAGED_ARTICLE_META_KEY, true );
	return $integration_id > 0 && $article_id > 0 && $managed_id === $integration_id;
}

function seoa_delete_intent_headers() {
	return array(
		'integration_id' => isset( $_SERVER['HTTP_X_SEOA_DELETE_INTEGRATION_ID'] )
			? absint( wp_unslash( $_SERVER['HTTP_X_SEOA_DELETE_INTEGRATION_ID'] ) ) : 0,
		'timestamp'      => isset( $_SERVER['HTTP_X_SEOA_DELETE_TIMESTAMP'] )
			? absint( wp_unslash( $_SERVER['HTTP_X_SEOA_DELETE_TIMESTAMP'] ) ) : 0,
		'nonce'          => isset( $_SERVER['HTTP_X_SEOA_DELETE_NONCE'] )
			? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_SEOA_DELETE_NONCE'] ) ) : '',
		'signature'      => isset( $_SERVER['HTTP_X_SEOA_DELETE_SIGNATURE'] )
			? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_SEOA_DELETE_SIGNATURE'] ) ) : '',
	);
}

/**
 * Verify a signed delete intent sent by the platform alongside a REST trash call.
 *
 * canonical = integration_id \n timestamp \n nonce \n post_id \n "trash"
 * signature = "sha256=" + hex(HMAC-SHA256(canonical, hex-decoded shared_secret))
 */
function seoa_has_valid_delete_intent( $post_id ) {
	$headers  = seoa_delete_intent_headers();
	$settings = seoa_get_settings();
	$expected_integration_id = ! empty( $settings['integration_id'] )
		? (int) $settings['integration_id'] : 0;
	$secret = ! empty( $settings['shared_secret'] ) ? (string) $settings['shared_secret'] : '';
	if (
		! $headers['integration_id'] || ! $headers['timestamp'] || ! $headers['nonce'] ||
		! $headers['signature'] || ! $expected_integration_id || ! $secret ||
		$headers['integration_id'] !== $expected_integration_id ||
		abs( time() - $headers['timestamp'] ) > SEOA_DELETE_INTENT_MAX_SKEW
	) {
		return false;
	}
	$replay_key = 'seoa_delete_' . hash( 'sha256', $headers['integration_id'] . ':' . $headers['nonce'] );
	if ( get_transient( $replay_key ) ) {
		return false;
	}
	$canonical = implode(
		"\n",
		array(
			(string) $headers['integration_id'],
			(string) $headers['timestamp'],
			$headers['nonce'],
			(string) $post_id,
			'trash',
		)
	);
	$expected = 'sha256=' . hash_hmac( 'sha256', $canonical, pack( 'H*', $secret ) );
	if ( ! hash_equals( $expected, $headers['signature'] ) ) {
		return false;
	}
	set_transient( $replay_key, 1, SEOA_DELETE_INTENT_MAX_SKEW );
	return true;
}

function seoa_is_interactive_wordpress_delete( $post_id ) {
	if (
		( function_exists( 'wp_doing_cron' ) && wp_doing_cron() ) ||
		( defined( 'WP_CLI' ) && WP_CLI ) ||
		! get_current_user_id() || ! current_user_can( 'delete_post', $post_id )
	) {
		return false;
	}
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		// Cookie-authenticated editor requests carry a WordPress REST nonce. Application
		// Password requests must use the signed delete intent instead.
		return ! empty( $_SERVER['HTTP_X_WP_NONCE'] );
	}
	return is_admin();
}

function seoa_default_status_origin() {
	if ( ! get_current_user_id() ) {
		return 'UNKNOWN';
	}
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST && empty( $_SERVER['HTTP_X_WP_NONCE'] ) ) {
		return 'UNKNOWN';
	}
	return 'WORDPRESS_USER';
}

function seoa_event_body( $post, $new_status, $old_status, $origin, $blocked ) {
	$user_id    = get_current_user_id();
	$article_id = (int) get_post_meta( $post->ID, SEOA_MANAGED_ARTICLE_META_KEY, true );
	return array(
		'platform_id'     => (string) $post->ID,
		'article_id'      => $article_id ? $article_id : null,
		'status'          => (string) $new_status,
		'link'            => (string) get_permalink( $post ),
		'event_id'        => wp_generate_uuid4(),
		'previous_status' => (string) $old_status,
		'origin'          => (string) $origin,
		'actor_user_id'   => $user_id ? (int) $user_id : null,
		'blocked'         => (bool) $blocked,
		'occurred_at'     => gmdate( 'c' ),
		'plugin_version'  => SEOA_PLUGIN_VERSION,
	);
}

function seoa_send_status_event( $body ) {
	$endpoint = trailingslashit( seoa_api_base() ) . 'api/integrations/wordpress/post-status';
	seoa_signed_request( 'POST', $endpoint, $body );
}

/** Block unattended trashing of managed posts before WordPress changes status. */
add_filter(
	'pre_trash_post',
	function ( $trash, $post, $previous_status = '' ) {
		if ( ! seoa_is_managed_post( $post ) ) {
			return $trash;
		}
		if ( seoa_has_valid_delete_intent( $post->ID ) ) {
			$GLOBALS['seoa_status_origin'][ $post->ID ] = 'SEO_AUTOMATION';
			return $trash;
		}
		if ( seoa_is_interactive_wordpress_delete( $post->ID ) ) {
			$GLOBALS['seoa_status_origin'][ $post->ID ] = 'WORDPRESS_USER';
			return $trash;
		}
		seoa_send_status_event(
			seoa_event_body( $post, 'trash', $previous_status, 'AUTOMATION', true )
		);
		return false;
	},
	10,
	3
);

/** Notify the platform after an allowed post status transition. */
add_action( 'transition_post_status', 'seoa_on_post_status_change', 10, 3 );

function seoa_on_post_status_change( $new_status, $old_status, $post ) {
	if (
		! $post instanceof WP_Post || 'post' !== $post->post_type ||
		wp_is_post_revision( $post->ID ) || $new_status === $old_status ||
		! in_array( $new_status, array( 'publish', 'draft', 'trash' ), true ) ||
		! seoa_is_managed_post( $post )
	) {
		return;
	}
	$settings = seoa_get_settings();
	if ( empty( $settings['integration_id'] ) || empty( $settings['shared_secret'] ) ) {
		return;
	}
	$origin = isset( $GLOBALS['seoa_status_origin'][ $post->ID ] )
		? $GLOBALS['seoa_status_origin'][ $post->ID ]
		: seoa_default_status_origin();
	unset( $GLOBALS['seoa_status_origin'][ $post->ID ] );
	seoa_send_status_event( seoa_event_body( $post, $new_status, $old_status, $origin, false ) );
}

/** Report plugin capabilities once per installed version after connection. */
function seoa_report_plugin_capabilities() {
	$settings = seoa_get_settings();
	if ( empty( $settings['integration_id'] ) || empty( $settings['shared_secret'] ) ) {
		return;
	}
	$reported = (string) get_option( 'seoa_capabilities_reported_version', '' );
	if ( SEOA_PLUGIN_VERSION === $reported ) {
		return;
	}
	$body = array(
		'permalink_structure' => (string) get_option( 'permalink_structure', '' ),
		'site_url'            => home_url(),
		'plugin_version'      => SEOA_PLUGIN_VERSION,
		'plugin_capabilities' => seoa_plugin_capabilities(),
		'seo_plugin'          => seoa_detect_seo_plugin(),
	);
	$endpoint = trailingslashit( seoa_api_base() ) . 'api/integrations/wordpress/permalinks';
	$response = seoa_signed_request( 'POST', $endpoint, $body );
	if ( ! is_wp_error( $response ) && 200 === (int) wp_remote_retrieve_response_code( $response ) ) {
		update_option( 'seoa_capabilities_reported_version', SEOA_PLUGIN_VERSION, false );
	}
}
add_action( 'admin_init', 'seoa_report_plugin_capabilities' );
