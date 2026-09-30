<?php
// admin/security-generic.php
// Expects: $err_qs (optional)
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<div class="seoa-banner warn">
	<?php
	if ( ! empty( $err_qs ) ) {
		echo esc_html( $err_qs );
	} else {
		echo esc_html__( 'Application passwords are currently disabled on this site.', 'seo-automation' );
	}
	?>
</div>

<p class="seoa-sub">
	<?php echo esc_html__( 'Hiqain needs WordPress Application Passwords to connect securely, but something on this site has turned them off.', 'seo-automation' ); ?>
</p>

<h2 class="seoa-sub seoa-h2">
	<?php echo esc_html__( 'Next steps:', 'seo-automation' ); ?>
</h2>

<p class="seoa-sub">
	<?php echo esc_html__( 'Ask your developer or site administrator to re-enable WordPress Application Passwords.', 'seo-automation' ); ?>
</p>

<h2 class="seoa-sub seoa-h2 seoa-h2--spaced">
	<?php echo esc_html__( 'For developers:', 'seo-automation' ); ?>
</h2>

<ul class="seoa-bullets">
	<li>
		<?php echo esc_html__( 'Review your security plugins for any setting that disables “Application Passwords”.', 'seo-automation' ); ?>
	</li>
	<li>
		<?php echo wp_kses_post( __( 'Search the codebase for filters on <code>wp_is_application_passwords_available</code> or <code>wp_is_application_passwords_available_for_user</code>. These can be used to turn the feature off.', 'seo-automation' ) ); ?>
	</li>
	<li>
		<?php echo esc_html__( 'Application Passwords require HTTPS unless WP_ENVIRONMENT_TYPE is set to "local". On a local test site, add define( \'WP_ENVIRONMENT_TYPE\', \'local\' ); to wp-config.php.', 'seo-automation' ); ?>
	</li>
	<li>
		<?php echo esc_html__( 'Some hosts disable application passwords globally for security reasons. If you’re unsure, ask your host.', 'seo-automation' ); ?>
	</li>
	<li>
		<?php echo wp_kses_post( __( 'When Application Passwords have been enabled, finish connecting by pressing <strong>Connect</strong> below.', 'seo-automation' ) ); ?>
	</li>
</ul>
