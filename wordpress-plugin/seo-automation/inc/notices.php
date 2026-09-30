<?php
// inc/notices.php

if ( ! defined( 'ABSPATH' ) ) { exit; }

// ------------------------------------------------------------------
// Persistent helper notices: guide admins to finish setup
// ------------------------------------------------------------------
add_action(
	'admin_notices',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// The plugin page renders its own banners.
		if ( function_exists( 'get_current_screen' ) ) {
			$screen = get_current_screen();
			if ( $screen && 'toplevel_page_seo-automation' === $screen->id ) {
				return;
			}
		}

		$settings       = seoa_get_settings();
		$connected      = ! empty( $settings['connected'] );
		$apps_available = seoa_app_passwords_available();

		// If we *think* we're connected but our App Password is gone, treat as "needs reconnect".
		$lost_app_password = $connected && ! seoa_has_app_password();

		if ( $connected && ! $lost_app_password ) {
			return;
		}

		$sec_status       = seoa_security_plugins_status();
		$wordfence_active = ! empty( $sec_status['wordfence'] );
		$aios_active      = ! empty( $sec_status['aios'] );
		$page_url         = admin_url( 'admin.php?page=seo-automation' );

		$render = function ( $title, $text, $button ) use ( $page_url ) {
			echo '<div class="notice notice-warning seoa-admin-notice">';
			echo '<p><strong>' . esc_html( $title ) . '</strong></p>';
			echo '<p>' . esc_html( $text ) . '</p>';
			printf(
				'<p><a href="%1$s" class="button button-primary">%2$s</a></p>',
				esc_url( $page_url ),
				esc_html( $button )
			);
			echo '</div>';
		};

		// Case 0: We were connected, but the App Password was deleted manually.
		if ( $lost_app_password ) {
			$render(
				__( 'Hiqain lost its WordPress Application Password.', 'seo-automation' ),
				__( 'The application password Hiqain uses was removed from this site. To restore the connection, reconnect.', 'seo-automation' ),
				__( 'Reconnect Hiqain', 'seo-automation' )
			);
			return;
		}

		// Case 1–3: Application passwords are disabled.
		if ( ! $apps_available ) {
			if ( $wordfence_active ) {
				$render(
					__( 'Hiqain can’t connect — Wordfence is blocking Application Passwords.', 'seo-automation' ),
					__( 'Follow the steps on the Hiqain page to re-enable Application Passwords in Wordfence.', 'seo-automation' ),
					__( 'View fix instructions', 'seo-automation' )
				);
				return;
			}

			if ( $aios_active ) {
				$render(
					__( 'Hiqain can’t connect — All In One Security is blocking Application Passwords.', 'seo-automation' ),
					__( 'Follow the steps on the Hiqain page to re-enable Application Passwords in All In One Security.', 'seo-automation' ),
					__( 'View fix instructions', 'seo-automation' )
				);
				return;
			}

			$render(
				__( 'Hiqain can’t connect — WordPress Application Passwords are disabled on this site.', 'seo-automation' ),
				__( 'Open the Hiqain page to see what to share with your developer or host so they can re-enable them.', 'seo-automation' ),
				__( 'View fix instructions', 'seo-automation' )
			);
			return;
		}

		// Case 4: Application passwords are available, but the site isn’t connected yet.
		$render(
			__( 'Hiqain is installed but not connected yet.', 'seo-automation' ),
			__( 'Connect now to enable AI-powered topic research and article publishing.', 'seo-automation' ),
			__( 'Finish connecting', 'seo-automation' )
		);
	}
);
