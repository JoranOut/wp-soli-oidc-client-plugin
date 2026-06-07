/**
 * SSO login flow tests
 *
 * Tests the OIDC client (localhost:8888) authenticating against the provider (localhost:8889).
 */
const { test, expect } = require( '@playwright/test' );

const CLIENT_URL = 'http://localhost:8888';
const PROVIDER_URL = 'http://localhost:8889';

test.describe( 'SSO Login Flow', () => {
	test.beforeEach( async ( { context } ) => {
		// Clear cookies to ensure a fresh session
		await context.clearCookies();
	} );

	test( 'SSO auto-redirects to provider and logs in successfully', async ( { page } ) => {
		// Visit the client login page - SSO should auto-redirect to provider
		await page.goto( `${ CLIENT_URL }/wp-login.php` );

		// Should end up on the provider login page
		await expect( page ).toHaveURL( /localhost:8889/, { timeout: 10000 } );

		// Fill in credentials on the provider
		await page.locator( '#user_login' ).fill( 'admin' );
		await page.locator( '#user_pass' ).fill( 'password' );
		await page.locator( '#wp-submit' ).click();

		// Provider may show the authorize prompt - click Authorize if visible
		const authorizeButton = page.locator( 'input[name="authorize"], button[name="authorize"]' );
		if ( await authorizeButton.isVisible( { timeout: 5000 } ).catch( () => false ) ) {
			await authorizeButton.click();
		}

		// Should be redirected back to the client and logged in (not on login page with error)
		await expect( page ).toHaveURL( /localhost:8888/, { timeout: 10000 } );
		expect( page.url() ).not.toContain( 'login-error' );

		// Should be on the admin dashboard (logged in)
		await expect( page.locator( '#wpadminbar' ) ).toBeVisible( { timeout: 5000 } );
	} );

	test( 'bypass-sso shows regular login form', async ( { page } ) => {
		await page.goto( `${ CLIENT_URL }/wp-login.php?bypass-sso` );

		// Should stay on client login page, not redirect
		await expect( page ).toHaveURL( /localhost:8888/ );

		// Should see the login form
		await expect( page.locator( '#user_login' ) ).toBeVisible();
		await expect( page.locator( '#user_pass' ) ).toBeVisible();
	} );

	test( 'login error page shows retry button and hides login form', async ( { page } ) => {
		await page.goto( `${ CLIENT_URL }/wp-login.php?login-error=http_request_failed&message=Test+error` );

		// Should stay on client login page
		await expect( page ).toHaveURL( /localhost:8888/ );

		// Should show error message
		await expect( page.locator( '#login_error' ) ).toContainText( 'Test error' );

		// Should show "Probeer opnieuw" button
		const retryButton = page.locator( 'a' ).filter( { hasText: 'Probeer opnieuw' } );
		await expect( retryButton ).toBeVisible();

		// Retry button should link to provider logout with redirect back to client
		const href = await retryButton.getAttribute( 'href' );
		expect( href ).toContain( 'redirect_uri=' );

		// Login form should be hidden
		await expect( page.locator( '#loginform' ) ).toBeHidden();
	} );
} );
