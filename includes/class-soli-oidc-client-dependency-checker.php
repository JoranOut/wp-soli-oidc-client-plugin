<?php

namespace Soli\OidcClient;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Dependency Checker
 *
 * Checks for the required OpenID Connect Generic (daggerhart) plugin
 * and displays an admin notice if it is not installed.
 */
class Dependency_Checker {

	/**
	 * Initialize the dependency checker
	 */
	public function init(): void {
		add_action( 'admin_notices', array( $this, 'display_notices' ) );
	}

	/**
	 * Display admin notices for missing dependencies
	 */
	public function display_notices(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( ! self::is_oidc_client_active() ) {
			?>
			<div class="notice notice-error">
				<p>
					<strong><?php esc_html_e( 'Soli OIDC Client', 'soli-oidc-client' ); ?>:</strong>
					<?php esc_html_e( 'The OpenID Connect Generic plugin is required but not installed or activated.', 'soli-oidc-client' ); ?>
					<a href="https://wordpress.org/plugins/daggerhart-openid-connect-generic/" target="_blank">
						<?php esc_html_e( 'Get the plugin', 'soli-oidc-client' ); ?>
					</a>
				</p>
			</div>
			<?php
		}
	}

	/**
	 * Check if the OpenID Connect Generic (client) plugin is active
	 *
	 * @return bool
	 */
	public static function is_oidc_client_active(): bool {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			include_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$possible_plugins = array(
			'daggerhart-openid-connect-generic/openid-connect-generic.php',
			'openid-connect-generic/openid-connect-generic.php',
		);

		foreach ( $possible_plugins as $plugin ) {
			if ( is_plugin_active( $plugin ) ) {
				return true;
			}
		}

		return false;
	}
}
