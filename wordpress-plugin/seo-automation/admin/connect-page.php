<?php
// admin/connect-page.php

if ( ! defined( 'ABSPATH' ) ) { exit; }

function seoa_render_connect_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$s         = seoa_get_settings();
	$connected = ! empty( $s['connected'] );
	$icon_url  = plugins_url( 'assets/icon.svg', SEOA_PLUGIN_FILE );
	$open_url  = seoa_dashboard_url();

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- non-sensitive admin notice only.
	$err_qs = isset( $_GET['seoa_error'] ) && is_string( $_GET['seoa_error'] ) ? sanitize_text_field( wp_unslash( $_GET['seoa_error'] ) ) : '';

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- non-sensitive admin state flag only.
	$ok_qs = isset( $_GET['seoa_connected'] ) && '1' === sanitize_text_field( wp_unslash( $_GET['seoa_connected'] ) );

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- non-sensitive admin state flag only.
	$disconnected_qs = isset( $_GET['seoa_disconnected'] ) && '1' === sanitize_text_field( wp_unslash( $_GET['seoa_disconnected'] ) );

	$apps_available = seoa_app_passwords_available();

	$lost_app_password = false;
	if ( $connected ) {
		$lost_app_password = ! seoa_has_app_password();
		// For the UI below, treat this like "not connected" but with a special banner.
		if ( $lost_app_password ) {
			$connected = false;
		}
	}

	// Security plugins.
	$sec_status       = seoa_security_plugins_status();
	$wordfence_active = ! empty( $sec_status['wordfence'] );
	$aios_active      = ! empty( $sec_status['aios'] );

	// Security plugin deep links.
	$wf_url   = admin_url( 'admin.php?page=WordfenceWAF&subpage=waf_options#wf-option-loginSec-disableApplicationPasswords' );
	$aios_url = admin_url( 'admin.php?page=aiowpsec_usersec&tab=additional#disable-application-password-badge' );

	// Security plugin images.
	$wf_image_url   = plugins_url( 'assets/wordfence-disable-app-passwords.png', SEOA_PLUGIN_FILE );
	$aios_image_url = plugins_url( 'assets/aios-disable-app-passwords.png', SEOA_PLUGIN_FILE );

	$seo_plugin_labels = array(
		'yoast'     => 'Yoast SEO',
		'rank_math' => 'Rank Math',
		'aioseo'    => 'All in One SEO',
		'none'      => __( 'None detected', 'seo-automation' ),
	);
	$seo_plugin = seoa_detect_seo_plugin();

	?>
	<div class="wrap seoa-wrap">
		<div class="seoa-card">
			<div class="seoa-head">
				<img src="<?php echo esc_url( $icon_url ); ?>" alt="<?php echo esc_attr__( 'Hiqain', 'seo-automation' ); ?>">
				<h1 class="seoa-h1"><?php echo esc_html__( 'Hiqain', 'seo-automation' ); ?></h1>
			</div>

			<?php if ( ! $apps_available ) : ?>

				<?php
				// ===== Branch 1: App Passwords are DISABLED → inline requirements UI =====
				if ( $wordfence_active ) {
					require __DIR__ . '/security-wordfence.php';
				} elseif ( $aios_active ) {
					require __DIR__ . '/security-aios.php';
				} else {
					require __DIR__ . '/security-generic.php';
				}
				?>

				<form method="post"
					  action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>"
					  class="seoa-connect-form">
					<?php wp_nonce_field( 'seoa_start_connect', '_seoa_nonce' ); ?>
					<input type="hidden" name="action" value="seoa_start_connect">
					<div class="seoa-actions">
						<button type="submit" class="seoa-btn">
							<?php echo esc_html__( 'Connect', 'seo-automation' ); ?>
						</button>
					</div>
				</form>

			<?php else : // ===== Branch 2: App Passwords available → connected / CTA views ===== ?>

				<?php if ( $connected ) : ?>
					<div class="seoa-banner ok">
						<?php
						echo $ok_qs
							? esc_html__( 'Success! Your site is now connected to Hiqain.', 'seo-automation' )
							: esc_html__( 'Hiqain is connected.', 'seo-automation' );
						?>
					</div>

					<div class="seoa-sub">
						<?php echo esc_html__( 'Your WordPress site is securely connected to Hiqain. Use the dashboard to research topics, score keywords, write SEO-optimized articles and publish them here.', 'seo-automation' ); ?>
					</div>

					<table class="seoa-meta">
						<tr>
							<th><?php echo esc_html__( 'Connected as', 'seo-automation' ); ?></th>
							<td><?php echo esc_html( $s['user'] ); ?></td>
						</tr>
						<?php if ( ! empty( $s['website_id'] ) ) : ?>
						<tr>
							<th><?php echo esc_html__( 'Website ID', 'seo-automation' ); ?></th>
							<td><?php echo esc_html( (string) (int) $s['website_id'] ); ?></td>
						</tr>
						<?php endif; ?>
						<tr>
							<th><?php echo esc_html__( 'Connected since', 'seo-automation' ); ?></th>
							<td><?php echo esc_html( $s['last_connected_at'] ? wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $s['last_connected_at'] ) : '—' ); ?></td>
						</tr>
						<tr>
							<th><?php echo esc_html__( 'SEO plugin', 'seo-automation' ); ?></th>
							<td><?php echo esc_html( isset( $seo_plugin_labels[ $seo_plugin ] ) ? $seo_plugin_labels[ $seo_plugin ] : $seo_plugin ); ?></td>
						</tr>
						<tr>
							<th><?php echo esc_html__( 'API', 'seo-automation' ); ?></th>
							<td><code><?php echo esc_html( seoa_api_base() ); ?></code></td>
						</tr>
					</table>

					<h2 class="seoa-sub seoa-h2">
						<?php echo esc_html__( 'Open the dashboard to:', 'seo-automation' ); ?>
					</h2>
					<ul class="seoa-bullets">
						<li><?php echo esc_html__( 'Crawl your site and build a business profile.', 'seo-automation' ); ?></li>
						<li><?php echo esc_html__( 'Discover and score high-value topics and keywords.', 'seo-automation' ); ?></li>
						<li><?php echo esc_html__( 'Write and publish SEO-optimized articles with FAQs and meta tags.', 'seo-automation' ); ?></li>
					</ul>

					<div class="seoa-actions">
						<a class="seoa-btn" href="<?php echo esc_url( $open_url ); ?>" target="_blank" rel="noopener">
							<?php echo esc_html__( 'Open Dashboard', 'seo-automation' ); ?>
						</a>

						<form method="post"
							  action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>"
							  class="seoa-disconnect-form">
							<?php wp_nonce_field( 'seoa_disconnect', '_seoa_nonce' ); ?>
							<input type="hidden" name="action" value="seoa_disconnect">
							<button type="submit" class="seoa-btn seoa-btn--ghost"
								data-confirm="<?php echo esc_attr__( 'Disconnect this site from Hiqain? Articles already published will stay on your site.', 'seo-automation' ); ?>">
								<?php echo esc_html__( 'Disconnect', 'seo-automation' ); ?>
							</button>
						</form>
					</div>

				<?php else : // not connected (either first-time or lost app password) ?>

					<?php if ( $err_qs ) : ?>
						<div class="seoa-banner err"><?php echo esc_html( $err_qs ); ?></div>
					<?php endif; ?>

					<?php if ( $disconnected_qs ) : ?>
						<div class="seoa-banner ok"><?php echo esc_html__( 'Hiqain disconnected.', 'seo-automation' ); ?></div>
					<?php endif; ?>

					<?php if ( $lost_app_password ) : ?>
						<div class="seoa-banner warn">
							<?php echo esc_html__( 'Hiqain lost its WordPress Application Password. Click Connect below to restore the connection.', 'seo-automation' ); ?>
						</div>
					<?php endif; ?>

					<p class="seoa-sub">
						<?php echo esc_html__( 'Click Connect to securely create or renew a WordPress Application Password and finish setup with Hiqain.', 'seo-automation' ); ?>
					</p>

					<form method="post"
						  action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>"
						  class="seoa-connect-form">
						<?php wp_nonce_field( 'seoa_start_connect', '_seoa_nonce' ); ?>
						<input type="hidden" name="action" value="seoa_start_connect">

						<div class="seoa-actions">
							<button type="submit" class="seoa-btn">
								<?php echo esc_html__( 'Connect', 'seo-automation' ); ?>
							</button>
						</div>
					</form>

				<?php endif; // connected ?>

			<?php endif; // apps_available ?>

		</div>
	</div>
	<?php
}
