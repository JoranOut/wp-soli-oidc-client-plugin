<?php

namespace Soli\OidcClient;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Role Sync
 *
 * Syncs the `roles` array from the OIDC provider claims to WordPress roles.
 *
 * The Laravel provider sends roles as an array (e.g. ["editor"]).
 * The first valid role in the array is set as the user's WordPress role.
 * An empty array removes all roles from the user.
 */
class Role_Sync {

	/**
	 * Initialize the role sync hook
	 */
	public function init(): void {
		add_action( 'openid-connect-generic-update-user-using-current-claim', array( $this, 'sync_roles_from_claim' ), 10, 2 );
	}

	/**
	 * Sync WordPress role from OIDC roles claim
	 *
	 * @param \WP_User $user       The WordPress user object.
	 * @param array    $user_claim The user claims from the OIDC provider.
	 */
	public function sync_roles_from_claim( \WP_User $user, array $user_claim ): void {
		// The roles claim must be present (even if empty array)
		if ( ! isset( $user_claim['roles'] ) || ! is_array( $user_claim['roles'] ) ) {
			return;
		}

		$claimed_roles = $user_claim['roles'];

		// Empty roles array = remove all roles (no access)
		if ( empty( $claimed_roles ) ) {
			$user->set_role( '' );
			return;
		}

		// Find the first valid WordPress role from the claims
		$valid_roles = array_keys( wp_roles()->roles );
		$new_role    = null;

		foreach ( $claimed_roles as $role ) {
			$role = sanitize_key( $role );
			if ( in_array( $role, $valid_roles, true ) ) {
				$new_role = $role;
				break;
			}
		}

		if ( null === $new_role ) {
			return;
		}

		// Only update if different
		if ( ! in_array( $new_role, $user->roles, true ) || count( $user->roles ) !== 1 ) {
			$user->set_role( $new_role );
		}
	}
}
