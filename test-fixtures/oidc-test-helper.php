<?php
/**
 * Test Fixture: OIDC Test Helper
 *
 * This mu-plugin runs on the OIDC client environment and exposes AJAX endpoints
 * the E2E suite uses to inspect and drive the plugin.
 *
 * It is only ever mounted by .wp-env.json, never shipped in a release, but every
 * endpoint is still capability-gated so a stray copy cannot leak or mutate data.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reject the request unless the caller is an administrator.
 */
function soli_oidc_test_require_admin(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_send_json_error( 'forbidden', 403 );
	}
}

/**
 * Report the current user's synced assignments.
 */
add_action( 'wp_ajax_soli_oidc_check_assignments', function () {
	wp_send_json_success( get_user_meta( get_current_user_id(), 'soli_oidc_assignments', true ) );
} );

/**
 * Report what the plugin registered on this request.
 *
 * Proves the plugin loaded, defined its constants and wired its hooks, without
 * needing the identity provider at all.
 */
add_action( 'wp_ajax_soli_oidc_test_status', function () {
	soli_oidc_test_require_admin();

	wp_send_json_success(
		array(
			'version'             => defined( 'SOLI_OIDC_CLIENT__PLUGIN_VERSION' ) ? SOLI_OIDC_CLIENT__PLUGIN_VERSION : null,
			'classes'             => array(
				'Dependency_Checker' => class_exists( '\Soli\OidcClient\Dependency_Checker' ),
				'Settings'           => class_exists( '\Soli\OidcClient\Settings' ),
				'Role_Sync'          => class_exists( '\Soli\OidcClient\Role_Sync' ),
				'Assignments_Sync'   => class_exists( '\Soli\OidcClient\Assignments_Sync' ),
				'Login_Customizer'   => class_exists( '\Soli\OidcClient\Login_Customizer' ),
			),
			'claim_hook_registered' => (bool) has_action( 'openid-connect-generic-update-user-using-current-claim' ),
			'login_message_filter'  => (bool) has_filter( 'login_message' ),
			'oidc_client_active'    => \Soli\OidcClient\Dependency_Checker::is_oidc_client_active(),
		)
	);
} );

/**
 * Fire the provider's claim hook against a scratch user and report the result.
 *
 * This drives the plugin's real, registered `Role_Sync` and `Assignments_Sync`
 * callbacks through WordPress - it does not reimplement their logic - so the
 * claim-handling contract is covered without a live identity provider.
 *
 * Params:
 *   login - username of the scratch user (created as a subscriber if absent)
 *   claim - JSON-encoded claim payload
 */
add_action( 'wp_ajax_soli_oidc_test_apply_claim', function () {
	soli_oidc_test_require_admin();

	$login = isset( $_REQUEST['login'] ) ? sanitize_user( wp_unslash( $_REQUEST['login'] ) ) : '';
	$raw   = isset( $_REQUEST['claim'] ) ? wp_unslash( $_REQUEST['claim'] ) : '';

	if ( '' === $login ) {
		wp_send_json_error( 'missing login', 400 );
	}

	$claim = json_decode( $raw, true );

	if ( ! is_array( $claim ) ) {
		wp_send_json_error( 'claim must be a JSON object', 400 );
	}

	$user = get_user_by( 'login', $login );

	if ( ! $user ) {
		$user_id = wp_insert_user(
			array(
				'user_login' => $login,
				'user_pass'  => wp_generate_password( 24 ),
				'user_email' => $login . '@example.test',
				'role'       => 'subscriber',
			)
		);

		if ( is_wp_error( $user_id ) ) {
			wp_send_json_error( $user_id->get_error_message(), 500 );
		}

		$user = get_user_by( 'id', $user_id );
	}

	do_action( 'openid-connect-generic-update-user-using-current-claim', $user, $claim );

	// Read the result back from the database rather than the in-memory object.
	$fresh = get_user_by( 'id', $user->ID );

	wp_send_json_success(
		array(
			'roles'       => array_values( $fresh->roles ),
			'assignments' => get_user_meta( $fresh->ID, 'soli_oidc_assignments', true ),
		)
	);
} );

/**
 * Delete a scratch user so specs can start from a known state.
 */
add_action( 'wp_ajax_soli_oidc_test_delete_user', function () {
	soli_oidc_test_require_admin();

	$login = isset( $_REQUEST['login'] ) ? sanitize_user( wp_unslash( $_REQUEST['login'] ) ) : '';
	$user  = $login ? get_user_by( 'login', $login ) : null;

	if ( $user ) {
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $user->ID );
	}

	wp_send_json_success( true );
} );
