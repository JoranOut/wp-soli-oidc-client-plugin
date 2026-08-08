<?php
/**
 * Test Fixture: OIDC Test Client Registration
 *
 * This mu-plugin registers a test OIDC client on the provider environment for
 * the OpenID Connect Server plugin. The server plugin only accepts clients via
 * the `oidc_registered_clients` filter.
 *
 * The redirect URI is read from the `soli_test_client_redirect_uri` option,
 * which .wp-env-setup.sh sets from the client's actual site URL, so the fixture
 * works on any port.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Allow all authenticated users (including subscribers) to use OIDC.
// The default capability 'edit_posts' excludes subscribers.
add_filter( 'oidc_minimal_capability', function (): string {
	return 'read';
} );

add_filter( 'oidc_registered_clients', function ( array $clients ): array {
	$redirect_uri = get_option(
		'soli_test_client_redirect_uri',
		'http://localhost:8888/wp-admin/admin-ajax.php?action=openid-connect-authorize'
	);

	$clients['soli-dev-client'] = array(
		'name'         => 'Soli Dev Client',
		'secret'       => 'dev-secret-12345',
		'redirect_uri' => $redirect_uri,
		'grant_types'  => array( 'authorization_code' ),
		'scope'        => 'openid email profile roles assignments',
	);

	return $clients;
} );
