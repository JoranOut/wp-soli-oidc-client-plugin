/**
 * Guards the environment the other tests depend on.
 *
 * Every "no PHP diagnostics" assertion in this suite works by reading PHP
 * diagnostics out of the rendered document. That only happens when both
 * `WP_DEBUG` and `WP_DEBUG_DISPLAY` are enabled: `wp_debug_mode()` leaves
 * `display_errors` untouched when `WP_DEBUG` is false, and then no diagnostic of
 * any severity - not even a fatal - reaches the page, so those assertions pass
 * unconditionally.
 *
 * Note which environment this checks. In this repo the wp-env *development*
 * environment hosts the plugin under test and the *tests* environment is the
 * throwaway OIDC provider, so `CLIENT_URL` (development) is the environment
 * whose diagnostics matter. Both are configured in `.wp-env.json`; wp-env's own
 * defaults would set `env.tests.config.WP_DEBUG = false`, and
 * environment-specific defaults beat the root-level `config`, so neither
 * environment can be left to the defaults. This test fails loudly if that
 * regresses instead of letting the diagnostics assertions go quietly vacuous.
 */
const { test, expect } = require( '@playwright/test' );
const { CLIENT_URL } = require( './urls' );
const { loginAsAdmin } = require( './helpers' );

/**
 * Matches the "on" state of a constant in Site Health.
 *
 * `.wp-env-setup.sh` installs and activates nl_NL on the client environment, so
 * Site Health answers `Ingeschakeld`/`Uitgeschakeld` rather than
 * `Enabled`/`Disabled`. Both spellings are accepted so the guard survives a
 * locale change.
 *
 * The anchors are load-bearing. `Uitgeschakeld` - the *disabled* state -
 * contains `geschakeld`, so an unanchored pattern would match while WP_DEBUG is
 * off, reintroducing exactly the vacuity this guard exists to prevent.
 */
const ENABLED = /^(Enabled|Ingeschakeld)$/;

/**
 * Reads a constant's reported state from the Site Health "Info" tab.
 *
 * The constants live in a collapsed accordion panel, so the value is read from
 * `textContent` (which Playwright's `toHaveText` uses) rather than from
 * `innerText`, which is empty for hidden elements.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          constant Constant name.
 * @return {import('@playwright/test').Locator} The value cell.
 */
function constantValue( page, constant ) {
	return page
		.locator( '#health-check-accordion-block-wp-constants tr', {
			has: page.locator( 'th', {
				hasText: new RegExp( `^${ constant }$` ),
			} ),
		} )
		.locator( 'td' );
}

test.describe( 'PHP diagnostics are visible in the environment under test', () => {
	test( 'WP_DEBUG and WP_DEBUG_DISPLAY are enabled on the client', async ( {
		page,
	} ) => {
		await loginAsAdmin( page );
		await page.goto( `${ CLIENT_URL }/wp-admin/site-health.php?tab=debug` );

		// Fail with a clear message if the panel moved, rather than as an
		// inscrutable empty-locator timeout on the assertions below.
		await expect(
			page.locator( '#health-check-accordion-block-wp-constants' )
		).toHaveCount( 1 );

		await expect( constantValue( page, 'WP_DEBUG' ) ).toHaveText( ENABLED );
		await expect( constantValue( page, 'WP_DEBUG_DISPLAY' ) ).toHaveText(
			ENABLED
		);
	} );
} );
