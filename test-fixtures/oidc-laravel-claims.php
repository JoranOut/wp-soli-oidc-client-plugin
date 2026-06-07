<?php
/**
 * Test Fixture: OIDC Laravel Claims
 *
 * This mu-plugin hooks into the OpenID Connect Server plugin on the test
 * provider (port 8889) and transforms user claims to match the format
 * returned by the Soli Laravel identity provider.
 *
 * Laravel format:
 * - roles: array of role strings (e.g. ["editor", "subscriber"])
 * - assignments: array of objects with onderdeel_id, instrument_soort_id, instrument_soort, instrument_familie
 *
 * This replaces the old passport plugin's single "user_role" string claim.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Add Laravel-format claims to OIDC userinfo response
 */
add_filter( 'oidc_user_claims', function ( array $claims, \WP_User $user ) {

	// Add email claim (required by daggerhart OIDC client, not included by OIDC Server plugin)
	$claims['email'] = $user->user_email;

	// Build roles array from WordPress roles
	$claims['roles'] = array_values( $user->roles );

	// Build assignments array based on user meta or test data
	$assignments = array();

	// Check for test assignment data in user meta
	$test_assignments = get_user_meta( $user->ID, 'soli_test_assignments', true );

	if ( ! empty( $test_assignments ) && is_array( $test_assignments ) ) {
		$assignments = $test_assignments;
	} else {
		// Default test assignments matching the Laravel provider format
		if ( in_array( 'administrator', $user->roles, true ) || in_array( 'subscriber', $user->roles, true ) ) {
			$assignments[] = array(
				'onderdeel_id'       => 1,
				'instrument_soort_id' => 5,
				'instrument_soort'   => 'Trompet',
				'instrument_familie' => 'Koperblazers',
			);
		}
	}

	$claims['assignments'] = $assignments;

	return $claims;
}, 10, 2 );
