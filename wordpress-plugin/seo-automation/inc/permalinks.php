<?php
// inc/permalinks.php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Notify the platform when the site's permalink structure changes
 * (Settings → Permalinks).
 */
add_action( 'update_option_permalink_structure', 'seoa_on_permalink_structure_change', 10, 3 );

function seoa_on_permalink_structure_change( $old_value, $value, $option ) {
	if ( 'permalink_structure' !== $option || $old_value === $value ) {
		return;
	}

	$settings = seoa_get_settings();
	if ( empty( $settings['integration_id'] ) || empty( $settings['shared_secret'] ) ) {
		return;
	}

	$body = [
		'permalink_structure'     => (string) $value, // '' for Plain
		'old_permalink_structure' => (string) $old_value,
		'site_url'                => home_url(),
		'plugin_version'          => SEOA_PLUGIN_VERSION,
		'plugin_capabilities'     => seoa_plugin_capabilities(),
	];

	$endpoint = trailingslashit( seoa_api_base() ) . 'api/integrations/wordpress/permalinks';

	// Failures are ignored so the admin UI never breaks.
	seoa_signed_request( 'POST', $endpoint, $body );
}
