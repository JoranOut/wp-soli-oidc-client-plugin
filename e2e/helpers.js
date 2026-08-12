/**
 * Shared E2E helpers.
 */
const { expect } = require( '@playwright/test' );
const { CLIENT_URL, PROVIDER_URL } = require( './urls' );

/**
 * Fragment matching any PHP file this repository owns.
 *
 * Used to scope the softer PHP diagnostics (warnings, notices, deprecations) to
 * code this repository owns. Scoping matters more here than in most Soli
 * plugins: this plugin is an adapter around the third-party
 * `daggerhart-openid-connect-generic` plugin, whose own deprecations must not
 * turn CI red. daggerhart lives under `daggerhart-openid-connect-generic/`, so
 * matching on this plugin's directory excludes it while still covering
 * everything this repo ships - the main file, `includes/class-soli-oidc-*.php`,
 * `updater.php` and `uninstall.php`.
 *
 * The `test-fixtures/*.php` mu-plugins are deliberately out of scope: wp-env
 * maps them to `wp-content/mu-plugins/`, outside the plugin directory, and they
 * are test scaffolding rather than shipped code.
 */
const PLUGIN_PHP_FILES = 'wp-soli-oidc-client-plugin/[\\w/-]+\\.php';

/** Diagnostics that are never acceptable, wherever they come from. */
const FATAL_ERROR_PATTERN = /Fatal error|Parse error/i;

/** Softer diagnostics, but only when they point at this plugin's files. */
const PLUGIN_DIAGNOSTIC_PATTERN = new RegExp(
	'(Warning|Notice|Deprecated):[^\\n]*(' + PLUGIN_PHP_FILES + ')',
	'i'
);

/**
 * Asserts that the currently loaded page contains no PHP diagnostics.
 *
 * `WP_DEBUG` and `WP_DEBUG_DISPLAY` are enabled for the wp-env `development`
 * environment - which is the one hosting this plugin, see `.wp-env.json` - so
 * PHP diagnostics are printed into the rendered document. Anything PHP emits
 * before `<html>` or inside `<head>` is relocated into the body by the HTML
 * parser, so reading the body text catches diagnostics from any point in the
 * request. `debug-mode.spec.js` guards that both constants really are on,
 * because without them this assertion passes unconditionally.
 *
 * Read `textContent()`, never `innerText()`. `innerText` returns *rendered*
 * text, so it silently drops anything the CSS hides - and a diagnostic that
 * happens to land inside a hidden container then makes this assertion pass
 * vacuously. That is not hypothetical here: `Login_Customizer::
 * hide_login_form_on_error()` prints a stylesheet that sets
 * `#loginform, .openid-connect-login-button, #nav, #backtoblog { display: none
 * !important }` on every `?login-error` page, which is exactly the surface
 * these tests exercise. Any diagnostic emitted while those elements render
 * would be invisible to `innerText`. `textContent` walks the DOM instead of the
 * layout, so it sees hidden nodes too. The same swap was measured in two
 * sibling repos: with the identical injected error, `textContent` failed and
 * `innerText` passed blind.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectNoPhpDiagnostics( page ) {
	const url = page.url();
	const body = await page.locator( 'body' ).textContent();

	expect( body, `PHP fatal/parse error rendered by ${ url }` ).not.toMatch(
		FATAL_ERROR_PATTERN
	);
	expect(
		body,
		`PHP warning/notice/deprecation from this plugin rendered by ${ url }`
	).not.toMatch( PLUGIN_DIAGNOSTIC_PATTERN );
}

/**
 * Log into the client without touching the identity provider.
 *
 * The client runs with login_type=auto, so ?bypass-sso is what makes the native
 * form reachable. daggerhart skips its auto-redirect on any request carrying
 * wp-submit, so the POST completes against WordPress itself.
 *
 * @param {import('@playwright/test').Page} page
 */
async function loginAsAdmin( page ) {
	await page.goto( `${ CLIENT_URL }/wp-login.php?bypass-sso`, {
		waitUntil: 'domcontentloaded',
	} );
	await page.locator( '#user_login' ).fill( 'admin' );
	await page.locator( '#user_pass' ).fill( 'password' );

	// Wait for the POST's navigation explicitly. The default 5s expect timeout
	// is not enough for a cold PHP request on a loaded CI runner, which showed
	// up as a flaky #wpadminbar assertion.
	await Promise.all( [
		page.waitForURL( /wp-admin/, { timeout: 60000 } ),
		page.locator( '#wp-submit' ).click(),
	] );

	await expect( page.locator( '#wpadminbar' ) ).toBeVisible( {
		timeout: 30000,
	} );
}

/**
 * Call an admin-ajax action on the client as the current session.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          action
 * @param {Object}                          params
 * @return {Promise<Object>} The decoded JSON response.
 */
async function ajax( page, action, params = {} ) {
	return page.evaluate(
		async ( { action: a, params: p } ) => {
			const query = new URLSearchParams( { action: a, ...p } );
			const response = await fetch(
				`/wp-admin/admin-ajax.php?${ query.toString() }`,
				{ credentials: 'same-origin' }
			);
			return { status: response.status, body: await response.json() };
		},
		{ action, params }
	);
}

/**
 * Log into the client through the full OIDC handshake against the provider.
 *
 * @param {import('@playwright/test').Page}           page
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string}                                    username
 * @param {string}                                    password
 */
async function loginViaSSO( page, context, username, password ) {
	await context.clearCookies();
	await page.goto( `${ CLIENT_URL }/wp-login.php` );

	// login_type=auto must send us to the provider.
	await expect( page ).toHaveURL(
		new RegExp( PROVIDER_URL.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ),
		{ timeout: 15000 }
	);

	await page.locator( '#user_login' ).fill( username );
	await page.locator( '#user_pass' ).fill( password );
	await page.locator( '#wp-submit' ).click();

	// The provider shows a consent screen the first time a client is used.
	const authorizeButton = page.locator(
		'input[name="authorize"], button[name="authorize"]'
	);
	if (
		await authorizeButton
			.isVisible( { timeout: 5000 } )
			.catch( () => false )
	) {
		await authorizeButton.click();
	}

	await expect( page ).toHaveURL(
		new RegExp( CLIENT_URL.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ),
		{ timeout: 15000 }
	);

	// A failed handshake also lands back on the client, so assert it succeeded.
	expect( page.url() ).not.toContain( 'login-error' );
}

module.exports = {
	PLUGIN_PHP_FILES,
	FATAL_ERROR_PATTERN,
	PLUGIN_DIAGNOSTIC_PATTERN,
	expectNoPhpDiagnostics,
	loginAsAdmin,
	ajax,
	loginViaSSO,
};
