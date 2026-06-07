<?php

namespace Soli\OidcClient;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Login Customizer
 *
 * Provides SSO bypass functionality and error handling UX:
 * - ?bypass-sso parameter to show the regular WordPress login form
 * - Retry button on OIDC login errors that clears the provider session
 * - Hides the login form on error pages (only shows error + retry)
 */
class Login_Customizer {

	/**
	 * Query parameter to bypass SSO redirect
	 */
	const BYPASS_SSO_PARAM = 'bypass-sso';

	/**
	 * Initialize login customizer hooks
	 */
	public function init(): void {
		add_filter( 'openid-connect-generic-settings', array( $this, 'maybe_disable_sso' ) );
		add_filter( 'login_message', array( $this, 'add_retry_button_on_error' ) );
		add_action( 'login_enqueue_scripts', array( $this, 'hide_login_form_on_error' ) );
	}

	/**
	 * Disable SSO when bypass param or login error is present
	 *
	 * @param object $settings The OIDC plugin settings object.
	 * @return object Modified settings.
	 */
	public function maybe_disable_sso( $settings ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET[ self::BYPASS_SSO_PARAM ] ) || isset( $_GET['login-error'] ) ) {
			$settings->login_type = 'button';
		}

		return $settings;
	}

	/**
	 * Get the provider's logout URL with redirect back to client login
	 *
	 * Uses the configured logout URL from settings. The Laravel provider
	 * accepts a redirect_uri parameter to redirect after logout.
	 *
	 * @return string|null The logout URL, or null if not configured.
	 */
	private function get_provider_logout_url(): ?string {
		$logout_url = Settings::get_logout_url();

		if ( empty( $logout_url ) ) {
			return null;
		}

		$redirect_uri = wp_login_url();

		return add_query_arg(
			array(
				'redirect_uri' => $redirect_uri,
			),
			$logout_url
		);
	}

	/**
	 * Show a "Try again" button on OIDC login errors
	 *
	 * Links to the provider's logout endpoint, which clears the session
	 * and redirects back to the client login page.
	 *
	 * @param string $message The current login message.
	 * @return string Modified login message.
	 */
	public function add_retry_button_on_error( string $message ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( $_GET['login-error'] ) ) {
			return $message;
		}

		$retry_url = $this->get_provider_logout_url() ?? wp_login_url();

		$message .= '<p style="text-align: center; margin: 16px 0;">';
		$message .= '<a href="' . esc_url( $retry_url ) . '" style="display: inline-block; padding: 8px 24px; background: #2271b1; color: #fff; text-decoration: none; border-radius: 3px;">';
		$message .= esc_html__( 'Try again', 'soli-oidc-client' );
		$message .= '</a>';
		$message .= '</p>';

		return $message;
	}

	/**
	 * Hide the login form and OIDC button on error pages
	 *
	 * Only shows the error message and retry button.
	 */
	public function hide_login_form_on_error(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( $_GET['login-error'] ) ) {
			return;
		}

		echo '<style>
			#loginform, .openid-connect-login-button, #nav, #backtoblog { display: none !important; }
		</style>';
	}
}
