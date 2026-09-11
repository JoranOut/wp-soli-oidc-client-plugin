<?php
/**
 * Uninstall script for Soli OIDC Client Plugin
 *
 * This file is executed when the plugin is deleted through the WordPress admin.
 *
 * @package Soli\OidcClient
 */

// If uninstall.php is not called by WordPress, die.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// A second copy of this plugin may still be active - for instance when another
// version is installed alongside this one and this folder is the one being
// deleted. Removing shared data would break that active copy, so bail out.
$soli_oidc_client_active = (array) get_option( 'active_plugins', array() );
if ( is_multisite() ) {
	$soli_oidc_client_active = array_merge( $soli_oidc_client_active, array_keys( (array) get_site_option( 'active_sitewide_plugins', array() ) ) );
}
foreach ( $soli_oidc_client_active as $soli_oidc_client_active_file ) {
	if ( basename( $soli_oidc_client_active_file ) === 'wp-soli-oidc-client-plugin.php' && dirname( $soli_oidc_client_active_file ) !== basename( __DIR__ ) ) {
		return;
	}
}
unset( $soli_oidc_client_active, $soli_oidc_client_active_file );

// Delete plugin options.
delete_option( 'soli_oidc_client_logout_url' );

// Delete user meta for all users.
global $wpdb;
$wpdb->delete( $wpdb->usermeta, array( 'meta_key' => 'soli_oidc_assignments' ) );
