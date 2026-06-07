<?php

namespace Soli\OidcClient;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Settings
 *
 * Provides a settings page under Settings > Soli OIDC Client
 * for configuring the provider logout URL.
 */
class Settings {

	/**
	 * Option name for the logout URL
	 */
	const OPTION_LOGOUT_URL = 'soli_oidc_client_logout_url';

	/**
	 * Settings page slug
	 */
	const PAGE_SLUG = 'soli-oidc-client';

	/**
	 * Initialize the settings
	 */
	public function init(): void {
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	/**
	 * Add the settings page under the Settings menu
	 */
	public function add_settings_page(): void {
		add_options_page(
			__( 'Soli OIDC Client', 'soli-oidc-client' ),
			__( 'Soli OIDC Client', 'soli-oidc-client' ),
			'manage_options',
			self::PAGE_SLUG,
			array( $this, 'render_settings_page' )
		);
	}

	/**
	 * Register settings fields
	 */
	public function register_settings(): void {
		register_setting(
			self::PAGE_SLUG,
			self::OPTION_LOGOUT_URL,
			array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
				'default'           => '',
			)
		);

		add_settings_section(
			'soli_oidc_client_main',
			__( 'Provider Settings', 'soli-oidc-client' ),
			null,
			self::PAGE_SLUG
		);

		add_settings_field(
			self::OPTION_LOGOUT_URL,
			__( 'Provider Logout URL', 'soli-oidc-client' ),
			array( $this, 'render_logout_url_field' ),
			self::PAGE_SLUG,
			'soli_oidc_client_main'
		);
	}

	/**
	 * Render the logout URL field
	 */
	public function render_logout_url_field(): void {
		$value = get_option( self::OPTION_LOGOUT_URL, '' );
		?>
		<input
			type="url"
			name="<?php echo esc_attr( self::OPTION_LOGOUT_URL ); ?>"
			value="<?php echo esc_attr( $value ); ?>"
			class="regular-text"
			placeholder="https://admin.soli.nl/oauth/logout"
		/>
		<p class="description">
			<?php esc_html_e( 'The logout endpoint on the identity provider. Used to clear the provider session when login errors occur.', 'soli-oidc-client' ); ?>
		</p>
		<?php
	}

	/**
	 * Render the settings page
	 */
	public function render_settings_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form action="options.php" method="post">
				<?php
				settings_fields( self::PAGE_SLUG );
				do_settings_sections( self::PAGE_SLUG );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * Get the configured logout URL
	 *
	 * @return string The logout URL, or empty string if not configured.
	 */
	public static function get_logout_url(): string {
		return get_option( self::OPTION_LOGOUT_URL, '' );
	}
}
