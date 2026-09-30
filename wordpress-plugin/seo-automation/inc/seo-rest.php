<?php
// inc/seo-rest.php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Detect which SEO plugin is active so the platform knows which REST field
 * to send meta_title / meta_description / focus keyword through.
 *
 * @return string 'yoast' | 'rank_math' | 'aioseo' | 'none'
 */
function seoa_detect_seo_plugin() {
	if ( class_exists( 'WPSEO_Frontend' ) || defined( 'WPSEO_VERSION' ) ) {
		return 'yoast';
	}
	if (
		class_exists( 'RankMath\\Plugin' ) || class_exists( 'RankMathPro\\Plugin' ) ||
		( function_exists( 'is_plugin_active' ) && is_plugin_active( 'seo-by-rank-math/rank-math.php' ) )
	) {
		return 'rank_math';
	}
	if ( function_exists( 'aioseo' ) && is_object( aioseo() ) ) {
		return 'aioseo';
	}
	return 'none';
}

/**
 * Exposes SEO meta for Yoast, AIOSEO and Rank Math on /wp/v2/posts and
 * /wp/v2/pages so the platform can set meta_title, meta_description and
 * focus keyword while publishing an article.
 */
class SEOA_SEO_REST_API {

	private $yoast_keys = array(
		'yoast_wpseo_focuskw',
		'yoast_wpseo_title',
		'yoast_wpseo_metadesc',
		'yoast_wpseo_linkdex',
		'yoast_wpseo_metakeywords',
		'yoast_wpseo_meta-robots-noindex',
		'yoast_wpseo_meta-robots-nofollow',
		'yoast_wpseo_meta-robots-adv',
		'yoast_wpseo_canonical',
		'yoast_wpseo_redirect',
		'yoast_wpseo_opengraph-title',
		'yoast_wpseo_opengraph-description',
		'yoast_wpseo_opengraph-image',
		'yoast_wpseo_twitter-title',
		'yoast_wpseo_twitter-description',
		'yoast_wpseo_twitter-image',
	);

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest_fields' ) );
	}

	public function register_rest_fields() {
		$post_types = array( 'post', 'page' );
		$active     = seoa_detect_seo_plugin();

		// Yoast SEO
		if ( 'yoast' === $active ) {
			register_rest_field(
				$post_types,
				'yoast_meta',
				array(
					'get_callback'    => array( $this, 'get_yoast_meta' ),
					'update_callback' => array( $this, 'update_yoast_meta' ),
					'schema'          => null,
				)
			);
		}

		// All in One SEO
		if ( function_exists( 'aioseo' ) && is_object( aioseo() ) ) {
			register_rest_field(
				$post_types,
				'aioseo_meta_data',
				array(
					'get_callback'    => array( $this, 'get_aioseo_meta' ),
					'update_callback' => array( $this, 'update_aioseo_meta' ),
					'schema'          => null,
				)
			);
		}

		// Rank Math
		if (
			class_exists( 'RankMath\\Plugin' ) || class_exists( 'RankMathPro\\Plugin' ) ||
			( function_exists( 'is_plugin_active' ) && is_plugin_active( 'seo-by-rank-math/rank-math.php' ) )
		) {
			register_rest_field(
				$post_types,
				'rank_math_meta_data',
				array(
					'get_callback'    => array( $this, 'get_rank_math_meta' ),
					'update_callback' => array( $this, 'update_rank_math_meta' ),
					'schema'          => null,
				)
			);
		}
	}

	// ========== YOAST METHODS ==========

	public function get_yoast_meta( $post, $field_name, $request ) {
		$post_id = $post['id'];

		if ( function_exists( 'YoastSEO' ) ) {
			$meta = YoastSEO()->meta->for_post( $post_id );
			if ( $meta ) {
				return array(
					'yoast_wpseo_title'     => $meta->title,
					'yoast_wpseo_metadesc'  => $meta->description,
					'yoast_wpseo_canonical' => $meta->canonical,
					'yoast_wpseo_focuskw'   => get_post_meta( $post_id, '_yoast_wpseo_focuskw', true ),
				);
			}
		}

		return array(
			'yoast_wpseo_title'     => get_post_meta( $post_id, '_yoast_wpseo_title', true ),
			'yoast_wpseo_metadesc'  => get_post_meta( $post_id, '_yoast_wpseo_metadesc', true ),
			'yoast_wpseo_canonical' => get_post_meta( $post_id, '_yoast_wpseo_canonical', true ),
			'yoast_wpseo_focuskw'   => get_post_meta( $post_id, '_yoast_wpseo_focuskw', true ),
		);
	}

	public function update_yoast_meta( $value, $data, $field_name ) {
		$post_id = $data->ID;

		if ( is_array( $value ) ) {
			foreach ( $value as $key => $val ) {
				if ( in_array( $key, $this->yoast_keys, true ) ) {
					update_post_meta( $post_id, '_' . $key, sanitize_text_field( $val ) );
				}
			}
		}

		return $this->get_yoast_meta( array( 'id' => $post_id ), $field_name, null );
	}

	// ========== AIOSEO METHODS ==========

	public function get_aioseo_meta( $post_arr, $field_name, $request ) {
		$post_id = $post_arr['id'];

		$title       = get_post_meta( $post_id, '_aioseo_title', true );
		$description = get_post_meta( $post_id, '_aioseo_description', true );
		$focuskw     = get_post_meta( $post_id, '_aioseo_focuskw', true );

		if ( function_exists( 'aioseo' ) && is_object( aioseo() ) && isset( aioseo()->meta ) ) {
			$aio = aioseo()->meta;

			if (
				isset( $aio->title, $aio->description, $aio->focusKeyword ) &&
				method_exists( $aio->title, 'getTitle' ) &&
				method_exists( $aio->description, 'getDescription' ) &&
				method_exists( $aio->focusKeyword, 'getKeyword' )
			) {
				$title       = $aio->title->getTitle( $post_id );
				$description = $aio->description->getDescription( $post_id );
				$focuskw     = $aio->focusKeyword->getKeyword( $post_id );
			}
		}

		return array(
			'title'       => $title,
			'description' => $description,
			'focuskw'     => $focuskw,
		);
	}

	public function update_aioseo_meta( $value, $post_obj, $field_name ) {
		$post_id = $post_obj->ID;

		if ( is_array( $value ) ) {
			$value = array_map( 'sanitize_text_field', array_intersect_key( $value, array_flip( array( 'title', 'description', 'focuskw' ) ) ) );

			if ( function_exists( 'aioseo' ) && is_object( aioseo() ) && isset( aioseo()->meta ) ) {
				$aio = aioseo()->meta;

				if (
					isset( $aio->title, $aio->description, $aio->focusKeyword ) &&
					method_exists( $aio->title, 'save' ) &&
					method_exists( $aio->description, 'save' ) &&
					method_exists( $aio->focusKeyword, 'setPrimary' )
				) {
					if ( isset( $value['title'] ) ) {
						$aio->title->save( $post_id, $value['title'] );
					}
					if ( isset( $value['description'] ) ) {
						$aio->description->save( $post_id, $value['description'] );
					}
					if ( isset( $value['focuskw'] ) ) {
						$aio->focusKeyword->setPrimary( $post_id, $value['focuskw'] );
					}
				}
			}

			if ( isset( $value['title'] ) ) {
				update_post_meta( $post_id, '_aioseo_title', $value['title'] );
			}
			if ( isset( $value['description'] ) ) {
				update_post_meta( $post_id, '_aioseo_description', $value['description'] );
			}
			if ( isset( $value['focuskw'] ) ) {
				update_post_meta( $post_id, '_aioseo_focuskw', $value['focuskw'] );
			}
		}

		return $this->get_aioseo_meta( array( 'id' => $post_id ), $field_name, null );
	}

	// ========== RANK MATH METHODS ==========

	public function get_rank_math_meta( $post_arr, $field_name, $request ) {
		$post_id = $post_arr['id'];

		return array(
			'title'       => get_post_meta( $post_id, 'rank_math_title', true ),
			'description' => get_post_meta( $post_id, 'rank_math_description', true ),
			'focuskw'     => get_post_meta( $post_id, 'rank_math_focus_keyword', true ),
		);
	}

	public function update_rank_math_meta( $value, $post_obj, $field_name ) {
		$post_id = $post_obj->ID;

		if ( is_array( $value ) ) {
			if ( isset( $value['title'] ) ) {
				update_post_meta( $post_id, 'rank_math_title', sanitize_text_field( $value['title'] ) );
			}
			if ( isset( $value['description'] ) ) {
				update_post_meta( $post_id, 'rank_math_description', sanitize_text_field( $value['description'] ) );
			}
			if ( isset( $value['focuskw'] ) ) {
				update_post_meta( $post_id, 'rank_math_focus_keyword', sanitize_text_field( $value['focuskw'] ) );
			}
		}

		return $this->get_rank_math_meta( array( 'id' => $post_id ), $field_name, null );
	}
}

/**
 * Explicitly register Rank Math meta for REST.
 */
function seoa_register_rank_math_meta() {
	$rank_math_meta_keys = array(
		'rank_math_title'         => 'Rank Math Title',
		'rank_math_description'   => 'Rank Math Description',
		'rank_math_focus_keyword' => 'Rank Math Focus Keyword',
	);

	foreach ( $rank_math_meta_keys as $key => $description ) {
		register_meta(
			'post',
			$key,
			array(
				'type'              => 'string',
				'single'            => true,
				'sanitize_callback' => 'sanitize_text_field',
				'auth_callback'     => function () {
					return current_user_can( 'edit_posts' );
				},
				'show_in_rest'      => array(
					'schema' => array(
						'type'        => 'string',
						'description' => $description,
						'context'     => array( 'view', 'edit' ),
					),
				),
			)
		);
	}
}
