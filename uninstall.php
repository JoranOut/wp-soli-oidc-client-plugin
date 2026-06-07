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

// Delete plugin options.
delete_option( 'soli_oidc_client_logout_url' );

// Delete user meta for all users.
global $wpdb;
$wpdb->delete( $wpdb->usermeta, array( 'meta_key' => 'soli_oidc_assignments' ) );
