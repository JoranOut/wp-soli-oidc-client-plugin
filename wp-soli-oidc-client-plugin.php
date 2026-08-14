<?php

namespace Soli\OidcClient;

/*
  Plugin Name: Soli OIDC Client Plugin
  Version: 0.1.0
  Author: Joran Out
  Description: OIDC client plugin for WordPress sites consuming the Soli Laravel provider
  Requires PHP: 8.3
  Text Domain: soli-oidc-client
  Domain Path: /languages
*/

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SOLI_OIDC_CLIENT__PLUGIN_DIR_PATH', plugin_dir_path( __FILE__ ) );
define( 'SOLI_OIDC_CLIENT__PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
define( 'SOLI_OIDC_CLIENT__PLUGIN_DIR_URL', plugin_dir_url( __FILE__ ) );
define( 'SOLI_OIDC_CLIENT__PLUGIN_VERSION', '0.1.0' );

// Load classes
require_once SOLI_OIDC_CLIENT__PLUGIN_DIR_PATH . 'includes/class-soli-oidc-client-dependency-checker.php';
require_once SOLI_OIDC_CLIENT__PLUGIN_DIR_PATH . 'includes/class-soli-oidc-client-settings.php';
require_once SOLI_OIDC_CLIENT__PLUGIN_DIR_PATH . 'includes/class-soli-oidc-client-role-sync.php';
require_once SOLI_OIDC_CLIENT__PLUGIN_DIR_PATH . 'includes/class-soli-oidc-client-assignments-sync.php';
require_once SOLI_OIDC_CLIENT__PLUGIN_DIR_PATH . 'includes/class-soli-oidc-client-login-customizer.php';
require_once SOLI_OIDC_CLIENT__PLUGIN_DIR_PATH . 'includes/class-soli-oidc-client-token-diagnostics.php';

add_action( 'init', function () {
	load_plugin_textdomain( 'soli-oidc-client', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );

	include_once 'updater.php';

	if ( ! defined( 'WP_GITHUB_FORCE_UPDATE' ) ) {
		define( 'WP_GITHUB_FORCE_UPDATE', true );
	}

	if ( is_admin() ) {
		$config = array(
			'slug'               => plugin_basename( __FILE__ ),
			'proper_folder_name' => dirname( plugin_basename( __FILE__ ) ),
			'api_url'            => 'https://api.github.com/repos/JoranOut/wp-soli-oidc-client-plugin',
			'raw_url'            => 'https://raw.githubusercontent.com/JoranOut/wp-soli-oidc-client-plugin/main',
			'github_url'         => 'https://github.com/JoranOut/wp-soli-oidc-client-plugin',
			// Fallback only. The updater resolves the real download from the
			// GitHub releases API and overrides this with the release's zip asset.
			'zip_url'            => 'https://github.com/JoranOut/wp-soli-oidc-client-plugin/releases/latest/download/wp-soli-oidc-client-plugin.zip',
			'sslverify'          => true,
			// Both ends of the supported range are rewritten at packaging time by
			// the nightly and release workflows, from the same two numbers the
			// e2e matrix runs against: 'requires' from package.json's
			// wordpress.requiresAtLeast, 'tested' from wordpress.org's current
			// release. Do not reformat.
			'requires'           => '6.9',
			'tested'             => '7.0.4',
			'readme'             => 'readme.md',
		);

		new WP_GitHub_Updater( $config );
	}
} );

// Initialize dependency checker (shows admin notices) - always active
$soli_oidc_client_dependency_checker = new Dependency_Checker();
$soli_oidc_client_dependency_checker->init();

// Initialize settings page - always active
$soli_oidc_client_settings = new Settings();
$soli_oidc_client_settings->init();

// Only initialize OIDC-dependent features when the client plugin is active
if ( Dependency_Checker::is_oidc_client_active() ) {
	$soli_oidc_client_role_sync = new Role_Sync();
	$soli_oidc_client_role_sync->init();

	$soli_oidc_client_assignments_sync = new Assignments_Sync();
	$soli_oidc_client_assignments_sync->init();

	$soli_oidc_client_login_customizer = new Login_Customizer();
	$soli_oidc_client_login_customizer->init();

	$soli_oidc_client_token_diagnostics = new Token_Diagnostics();
	$soli_oidc_client_token_diagnostics->init();
}
