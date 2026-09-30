<?php
// inc/admin-menu.php
if ( ! defined( 'ABSPATH' ) ) { exit; }

add_action( 'admin_menu', function () {
	add_menu_page(
		__( 'Hiqain', 'seo-automation' ),
		__( 'Hiqain', 'seo-automation' ),
		'manage_options',
		'seo-automation',
		'seoa_render_connect_page', // from admin/connect-page.php
		plugins_url( 'assets/menu-icon.svg', SEOA_PLUGIN_FILE ),
		65
	);
});

// Activation redirect
register_activation_hook( SEOA_PLUGIN_FILE, function () {
	delete_option( 'seoa_settings' );
	seoa_set_settings( [ 'api_base' => SEOA_DEFAULT_API_BASE ] );
	update_option( 'seoa_activation_redirect', 1 );
});

function seoa_admin_enqueue_connect_assets( $hook_suffix ) {
	// Only load on: admin.php?page=seo-automation
	if ( 'toplevel_page_seo-automation' !== $hook_suffix ) {
		return;
	}

	wp_enqueue_style(
		'seo-automation-admin-connect',
		plugins_url( 'assets/admin-connect.css', SEOA_PLUGIN_FILE ),
		array(),
		SEOA_PLUGIN_VERSION
	);

	wp_enqueue_script(
		'seo-automation-admin-connect',
		plugins_url( 'assets/admin-connect.js', SEOA_PLUGIN_FILE ),
		array(),
		SEOA_PLUGIN_VERSION,
		true
	);
}
add_action( 'admin_enqueue_scripts', 'seoa_admin_enqueue_connect_assets' );
