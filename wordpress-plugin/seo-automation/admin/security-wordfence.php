<?php
// admin/security-wordfence.php
// Expects: $err_qs, $wf_url, $wf_image_url (optional)
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<div class="seoa-banner warn">
	<?php
	if ( $err_qs ) {
		echo esc_html( $err_qs );
	} else {
		echo esc_html__( 'Wordfence is currently disabling application passwords.', 'seo-automation' );
	}
	?>
</div>

<p class="seoa-sub">
	<?php echo esc_html__( 'Follow the steps below in Wordfence to re-enable WordPress application passwords for this site.', 'seo-automation' ); ?>
</p>

<h2 class="seoa-sub seoa-h2">
	<?php echo esc_html__( 'How to enable in Wordfence:', 'seo-automation' ); ?>
</h2>

<ol class="seoa-list">
	<li>
		<?php
		echo wp_kses_post(
			sprintf(
				/* translators: %1$s: Link to the "Firewall Options" page in Wordfence. */
				__( 'In Wordfence, open %1$s.', 'seo-automation' ),
				'<a href="' . esc_url( $wf_url ) . '" target="_blank" rel="noopener"><strong>' . esc_html__( 'Firewall Options', 'seo-automation' ) . '</strong></a>'
			)
		);
		?>
	</li>

	<li>
		<?php
		echo wp_kses_post(
			sprintf(
				/* translators: %1$s: Label of the "Disable WordPress application passwords" setting. */
				__( 'Uncheck %1$s (make sure it is set to off).', 'seo-automation' ),
				'<span class="seoa-kbd">' . esc_html__( 'Disable WordPress application passwords', 'seo-automation' ) . '</span>'
			)
		);
		?>
		<?php if ( ! empty( $wf_image_url ) ) : ?>
			<div class="seoa-shot">
				<img src="<?php echo esc_url( $wf_image_url ); ?>" alt="<?php echo esc_attr__( 'Wordfence setting for application passwords', 'seo-automation' ); ?>">
			</div>
		<?php endif; ?>
	</li>

	<li>
		<?php
		echo wp_kses_post(
			sprintf(
				/* translators: %1$s: Text of the "SAVE CHANGES" button in Wordfence. */
				__( 'Save your changes by pressing %1$s.', 'seo-automation' ),
				'<span class="seoa-kbd">' . esc_html__( 'SAVE CHANGES', 'seo-automation' ) . '</span>'
			)
		);
		?>
	</li>

	<li>
		<?php echo wp_kses_post( __( 'Return here and click <strong>Connect</strong> to finish connecting Hiqain.', 'seo-automation' ) ); ?>
	</li>
</ol>
