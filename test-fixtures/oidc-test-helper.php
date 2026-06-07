<?php
/**
 * Test Fixture: OIDC Test Helper
 *
 * This mu-plugin runs on the OIDC client (port 8888) and provides
 * an AJAX endpoint to read the current user's OIDC assignments meta.
 * Used by E2E tests to verify assignment sync from the provider.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_soli_oidc_check_assignments', function () {
	wp_send_json_success( get_user_meta( get_current_user_id(), 'soli_oidc_assignments', true ) );
} );
