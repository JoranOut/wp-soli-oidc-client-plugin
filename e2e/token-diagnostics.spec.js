/**
 * Token endpoint failure diagnostics.
 *
 * The OIDC client plugin reports every unparseable token response as
 * `invalid-token`, discarding the HTTP status. A provider rate limit, a gateway
 * error and a redirect to a login page all look identical, which is how a stale
 * rate-limiter counter on admin.soli.nl cost an afternoon on 2026-08-10.
 *
 * Token_Diagnostics asks for JSON and translates a non-JSON body into an error
 * naming the real status. These tests pin that: the point is that a 429 says 429.
 *
 * The failures are injected client-side by the oidc-token-failure fixture, since
 * the wp-env provider will not produce them on request.
 */
const { test, expect } = require( '@playwright/test' );
const { CLIENT_URL, PROVIDER_URL } = require( './urls' );
const { loginAsAdmin } = require( './helpers' );

/**
 * Set the fixture's failure mode.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          mode
 */
async function setFailureMode( page, mode ) {
	const result = await page.evaluate( async ( m ) => {
		const query = new URLSearchParams( {
			action: 'soli_test_force_token_failure',
			mode: m,
		} );
		const response = await fetch(
			`/wp-admin/admin-ajax.php?${ query.toString() }`,
			{ credentials: 'same-origin' }
		);
		return { status: response.status, body: await response.json() };
	}, mode );

	expect( result.status ).toBe( 200 );
	expect( result.body.success ).toBe( true );
	expect( result.body.data.mode ).toBe( mode );
}

/**
 * Run the SSO handshake far enough to reach the token exchange, and return the
 * URL the client lands on.
 *
 * @param {import('@playwright/test').Page}           page
 * @param {import('@playwright/test').BrowserContext} context
 * @return {Promise<string>} The final URL.
 */
async function attemptSSO( page, context ) {
	await context.clearCookies();
	await page.goto( `${ CLIENT_URL }/wp-login.php` );

	await expect( page ).toHaveURL(
		new RegExp( PROVIDER_URL.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ),
		{ timeout: 15000 }
	);

	await page.locator( '#user_login' ).fill( 'admin' );
	await page.locator( '#user_pass' ).fill( 'password' );
	await page.locator( '#wp-submit' ).click();

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

	return page.url();
}

test.describe( 'Token endpoint failure diagnostics', () => {
	// The client and the provider share the localhost domain and cookies are not
	// port-scoped, so a session left by an earlier test is visible here.
	test.beforeEach( async ( { context } ) => {
		await context.clearCookies();
	} );

	// No teardown: the fixture disarms itself after one token request, so a
	// failing assertion cannot leak a broken login into the next test.

	test( 'an HTML 429 from the token endpoint reports the status, not invalid-token', async ( {
		page,
		context,
	} ) => {
		await loginAsAdmin( page );
		await setFailureMode( page, 'html-429' );

		const url = await attemptSSO( page, context );

		// The regression this exists to catch.
		expect( url ).not.toContain( 'login-error=invalid-token' );

		expect( url ).toContain( 'login-error=provider-http-429' );

		// The message must carry the status too - the error code alone is not
		// what an administrator reads off the login screen.
		expect( decodeURIComponent( url ) ).toContain( '429' );
	} );

	test( 'an empty 200 body is reported as unreadable rather than as a token', async ( {
		page,
		context,
	} ) => {
		await loginAsAdmin( page );
		await setFailureMode( page, 'empty-200' );

		const url = await attemptSSO( page, context );

		expect( url ).not.toContain( 'login-error=invalid-token' );
		expect( url ).toContain( 'login-error=provider-http-200' );
	} );

	test( 'a JSON error body is left alone for the client to report', async ( {
		page,
		context,
	} ) => {
		await loginAsAdmin( page );
		await setFailureMode( page, 'json-429' );

		const url = await attemptSSO( page, context );

		// Translation must not fire on a parseable body. The client's own
		// handling of a JSON response is correct and stays in charge.
		expect( url ).not.toContain( 'login-error=provider-http-429' );
		expect( url ).toContain( 'login-error=' );
	} );

	test( 'a failed token exchange leaves no session', async ( {
		page,
		context,
	} ) => {
		await loginAsAdmin( page );
		await setFailureMode( page, 'html-429' );

		const url = await attemptSSO( page, context );

		expect( url ).toContain( 'login-error=provider-http-429' );

		// Fail closed: a diagnostic improvement must not have opened a door.
		//
		// Asserted with a single un-followed request. Navigating there would
		// start a fresh SSO cycle - the fixture is one-shot, so that second
		// exchange succeeds and logs the user in, and the assertion would
		// trigger the very thing it is checking for.
		//
		// Not asserted on the cookie jar either: the client and the provider
		// are both on localhost and cookies are not port-scoped, so the
		// provider's own wordpress_logged_in_* cookie is visible here. Only
		// the client's response says whether the client considers us logged in.
		const response = await page.request.get(
			`${ CLIENT_URL }/wp-admin/profile.php`,
			{ maxRedirects: 0 }
		);

		expect( response.status() ).toBe( 302 );
		expect( response.headers().location ).toContain( 'wp-login.php' );
	} );
} );
