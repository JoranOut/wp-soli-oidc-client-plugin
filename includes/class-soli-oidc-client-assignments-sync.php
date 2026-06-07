<?php

namespace Soli\OidcClient;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Assignments Sync
 *
 * Stores the `assignments` array from the OIDC provider claims
 * in WordPress user meta for downstream use by themes and other plugins.
 */
class Assignments_Sync {

	/**
	 * User meta key for storing assignments
	 */
	const META_KEY = 'soli_oidc_assignments';

	/**
	 * Initialize the assignments sync hook
	 */
	public function init(): void {
		add_action( 'openid-connect-generic-update-user-using-current-claim', array( $this, 'sync_assignments_from_claim' ), 10, 2 );
	}

	/**
	 * Sync assignments from OIDC claims to user meta
	 *
	 * @param \WP_User $user       The WordPress user object.
	 * @param array    $user_claim The user claims from the OIDC provider.
	 */
	public function sync_assignments_from_claim( \WP_User $user, array $user_claim ): void {
		if ( ! isset( $user_claim['assignments'] ) || ! is_array( $user_claim['assignments'] ) ) {
			return;
		}

		$assignments = $this->sanitize_assignments( $user_claim['assignments'] );

		update_user_meta( $user->ID, self::META_KEY, $assignments );
	}

	/**
	 * Sanitize the assignments array
	 *
	 * Each assignment is expected to be an associative array with string values.
	 *
	 * @param array $assignments Raw assignments from claims.
	 * @return array Sanitized assignments.
	 */
	private function sanitize_assignments( array $assignments ): array {
		$sanitized = array();

		foreach ( $assignments as $assignment ) {
			if ( ! is_array( $assignment ) ) {
				continue;
			}

			$clean = array();
			foreach ( $assignment as $key => $value ) {
				if ( is_string( $key ) && ( is_string( $value ) || is_numeric( $value ) || is_bool( $value ) ) ) {
					$clean[ sanitize_key( $key ) ] = sanitize_text_field( (string) $value );
				}
			}

			if ( ! empty( $clean ) ) {
				$sanitized[] = $clean;
			}
		}

		return $sanitized;
	}
}
