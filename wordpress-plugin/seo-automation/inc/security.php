<?php
// inc/security.php

if ( ! defined( 'ABSPATH' ) ) { exit; }

if ( ! function_exists( 'is_plugin_active' ) ) {
	require_once ABSPATH . 'wp-admin/includes/plugin.php';
}

function seoa_security_plugins_status() {
	$wordfence_active = function_exists( 'is_plugin_active' ) && is_plugin_active( 'wordfence/wordfence.php' );
	$aios_active      = function_exists( 'is_plugin_active' ) && is_plugin_active( 'all-in-one-wp-security-and-firewall/wp-security.php' );

	return [
		'wordfence' => $wordfence_active,
		'aios'      => $aios_active,
	];
}

function seoa_app_passwords_available() {
	if ( function_exists( 'wp_is_application_passwords_available' ) ) {
		try {
			return (bool) wp_is_application_passwords_available();
		} catch ( \Throwable $t ) {}
	}

	if ( class_exists( 'WP_Application_Passwords' ) ) {
		if ( method_exists( 'WP_Application_Passwords', 'create_new_application_password' ) ) {
			return true;
		}
		if ( method_exists( 'WP_Application_Passwords', 'is_available' ) ) {
			try {
				return (bool) WP_Application_Passwords::is_available();
			} catch ( \Throwable $t ) {}
		}
		return false;
	}

	$core_file = ABSPATH . 'wp-includes/class-wp-application-passwords.php';
	if ( file_exists( $core_file ) ) {
		require_once $core_file;
		return seoa_app_passwords_available();
	}

	return false;
}

/**
 * Delete every application password with our label for the given user.
 */
function seoa_delete_app_passwords_for_user( $user_id ) {
	if ( ! $user_id || ! class_exists( 'WP_Application_Passwords' ) ) {
		return;
	}
	$existing = WP_Application_Passwords::get_user_application_passwords( $user_id );
	if ( ! is_array( $existing ) ) {
		return;
	}
	foreach ( $existing as $ap ) {
		if ( isset( $ap['name'] ) && SEOA_APP_PASSWORD_LABEL === $ap['name'] ) {
			WP_Application_Passwords::delete_application_password( $user_id, $ap['uuid'] );
		}
	}
}

function seoa_has_app_password() {
	$settings = seoa_get_settings();
	$username = isset( $settings['user'] ) ? $settings['user'] : '';

	if ( ! $username ) {
		return true;
	}

	if ( ! class_exists( 'WP_Application_Passwords' ) ) {
		return true;
	}

	$user = get_user_by( 'login', $username );
	if ( ! $user ) {
		return false;
	}

	$apps = WP_Application_Passwords::get_user_application_passwords( $user->ID );
	if ( ! is_array( $apps ) ) {
		return false;
	}

	foreach ( $apps as $ap ) {
		if ( isset( $ap['name'] ) && SEOA_APP_PASSWORD_LABEL === $ap['name'] ) {
			return true;
		}
	}

	return false;
}
