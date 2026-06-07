<?php
/**
 * Test Fixture: OIDC Test Client Registration
 *
 * This mu-plugin registers a test OIDC client on the provider (port 8889)
 * for the OpenID Connect Server plugin. The server plugin only accepts
 * clients via the `oidc_registered_clients` filter.
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
	$clients['soli-dev-client'] = array(
		'name'         => 'Soli Dev Client',
		'secret'       => 'dev-secret-12345',
		'redirect_uri' => 'http://localhost:8888/wp-admin/admin-ajax.php?action=openid-connect-authorize',
		'grant_types'  => array( 'authorization_code' ),
		'scope'        => 'openid email profile roles assignments',
	);

	return $clients;
} );
