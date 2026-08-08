/**
 * Shared E2E helpers.
 */
const { expect } = require( '@playwright/test' );
const { CLIENT_URL, PROVIDER_URL } = require( './urls' );

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

module.exports = { loginAsAdmin, ajax, loginViaSSO };
