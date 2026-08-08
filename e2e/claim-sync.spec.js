/**
 * Claim handling contract.
 *
 * Hermetic: fires the provider's real claim action
 * (`openid-connect-generic-update-user-using-current-claim`) against a scratch
 * user and reads the result back out of the database. The plugin's registered
 * Role_Sync and Assignments_Sync callbacks do the work - nothing here
 * reimplements their logic, and no identity provider is involved.
 */
const { test, expect } = require( '@playwright/test' );
const { loginAsAdmin, ajax } = require( './helpers' );

const SCRATCH_USER = 'claimtestuser';

/**
 * Apply a claim to the scratch user and return { roles, assignments }.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object}                          claim
 */
async function applyClaim( page, claim ) {
	const { status, body } = await ajax( page, 'soli_oidc_test_apply_claim', {
		login: SCRATCH_USER,
		claim: JSON.stringify( claim ),
	} );

	expect( status ).toBe( 200 );
	expect( body.success ).toBe( true );

	return body.data;
}

test.describe( 'Claim handling', () => {
	test.beforeEach( async ( { page } ) => {
		await loginAsAdmin( page );
		// Start each test from a freshly created subscriber.
		await ajax( page, 'soli_oidc_test_delete_user', { login: SCRATCH_USER } );
	} );

	test.afterAll( async ( { browser } ) => {
		const page = await browser.newPage();
		await loginAsAdmin( page );
		await ajax( page, 'soli_oidc_test_delete_user', { login: SCRATCH_USER } );
		await page.close();
	} );

	test( 'first valid role in the claim becomes the WordPress role', async ( {
		page,
	} ) => {
		const result = await applyClaim( page, { roles: [ 'editor' ] } );

		expect( result.roles ).toEqual( [ 'editor' ] );
	} );

	test( 'unknown roles are skipped in favour of the first valid one', async ( {
		page,
	} ) => {
		const result = await applyClaim( page, {
			roles: [ 'bestuurslid', 'not-a-role', 'author' ],
		} );

		expect( result.roles ).toEqual( [ 'author' ] );
	} );

	test( 'a claim with only unknown roles leaves the role untouched', async ( {
		page,
	} ) => {
		await applyClaim( page, { roles: [ 'editor' ] } );
		const result = await applyClaim( page, {
			roles: [ 'dirigent', 'penningmeester' ],
		} );

		expect( result.roles ).toEqual( [ 'editor' ] );
	} );

	test( 'an empty roles array strips every role', async ( { page } ) => {
		await applyClaim( page, { roles: [ 'editor' ] } );
		const result = await applyClaim( page, { roles: [] } );

		expect( result.roles ).toEqual( [] );
	} );

	test( 'a missing roles claim is a no-op', async ( { page } ) => {
		await applyClaim( page, { roles: [ 'editor' ] } );
		const result = await applyClaim( page, { email: 'x@example.test' } );

		expect( result.roles ).toEqual( [ 'editor' ] );
	} );

	test( 'a non-array roles claim is a no-op', async ( { page } ) => {
		await applyClaim( page, { roles: [ 'editor' ] } );
		const result = await applyClaim( page, { roles: 'administrator' } );

		// A string claim must not be coerced into granting a role.
		expect( result.roles ).toEqual( [ 'editor' ] );
	} );

	test( 'assignments are stored in user meta', async ( { page } ) => {
		const result = await applyClaim( page, {
			roles: [ 'subscriber' ],
			assignments: [
				{
					onderdeel_id: 1,
					instrument_soort_id: 5,
					instrument_soort: 'Trompet',
					instrument_familie: 'Koperblazers',
				},
			],
		} );

		expect( result.assignments ).toEqual( [
			{
				onderdeel_id: '1',
				instrument_soort_id: '5',
				instrument_soort: 'Trompet',
				instrument_familie: 'Koperblazers',
			},
		] );
	} );

	test( 'multiple assignments are all stored, in order', async ( {
		page,
	} ) => {
		const result = await applyClaim( page, {
			assignments: [
				{ onderdeel_id: 1, instrument_soort: 'Trompet' },
				{ onderdeel_id: 2, instrument_soort: 'Bugel' },
			],
		} );

		expect( result.assignments ).toEqual( [
			{ onderdeel_id: '1', instrument_soort: 'Trompet' },
			{ onderdeel_id: '2', instrument_soort: 'Bugel' },
		] );
	} );

	test( 'assignment values are escaped, not stored raw', async ( {
		page,
	} ) => {
		const result = await applyClaim( page, {
			assignments: [
				{
					onderdeel_id: 1,
					instrument_soort: '<script>alert(1)</script>Trompet',
				},
			],
		} );

		expect( result.assignments[ 0 ].instrument_soort ).not.toContain(
			'<script>'
		);
	} );

	test( 'non-object assignment entries are discarded', async ( { page } ) => {
		const result = await applyClaim( page, {
			assignments: [ 'nope', 42, { onderdeel_id: 3 } ],
		} );

		expect( result.assignments ).toEqual( [ { onderdeel_id: '3' } ] );
	} );

	test( 'an empty assignments array clears previously stored assignments', async ( {
		page,
	} ) => {
		await applyClaim( page, {
			assignments: [ { onderdeel_id: 1, instrument_soort: 'Trompet' } ],
		} );
		const result = await applyClaim( page, { assignments: [] } );

		expect( result.assignments ).toEqual( [] );
	} );

	test( 'a missing assignments claim leaves stored assignments alone', async ( {
		page,
	} ) => {
		await applyClaim( page, {
			assignments: [ { onderdeel_id: 1, instrument_soort: 'Trompet' } ],
		} );
		const result = await applyClaim( page, { roles: [ 'subscriber' ] } );

		expect( result.assignments ).toEqual( [
			{ onderdeel_id: '1', instrument_soort: 'Trompet' },
		] );
	} );
} );
