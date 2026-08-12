#!/bin/bash
#
# wp-env setup script for OIDC client testing
#
# This script runs after wp-env start and configures:
# - Tests environment: OIDC Provider with test data and Laravel-format claims
# - Development environment: OIDC Client connected to that provider
#
# Both site URLs are read back from WordPress instead of being hardcoded, so the
# environments work on any port (WP_ENV_PORT / WP_ENV_TESTS_PORT).
#

set -e

echo "=== Setting up wp-env OIDC client testing environments ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYS_DIR="${SCRIPT_DIR}/.oidc-keys"

# =============================================================================
# OIDC SIGNING KEYS
# =============================================================================
# The provider (OpenID Connect Server plugin) cannot issue ID tokens without a
# signing keypair. These keys are throwaway test credentials: they are
# gitignored and regenerated whenever they are missing, which is always the
# case on a fresh CI checkout.
echo ""
echo "--- OIDC signing keys ---"

if [ -f "${KEYS_DIR}/private.key" ] && [ -f "${KEYS_DIR}/public.key" ]; then
	echo "Existing keypair found, reusing it."
else
	echo "Generating a throwaway 2048-bit RSA keypair for the test provider..."
	mkdir -p "${KEYS_DIR}"
	openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${KEYS_DIR}/private.key" 2>/dev/null
	openssl rsa -in "${KEYS_DIR}/private.key" -pubout -out "${KEYS_DIR}/public.key" 2>/dev/null
	chmod 600 "${KEYS_DIR}/private.key"
	echo "Keypair generated."
fi

# =============================================================================
# RESOLVE SITE URLS
# =============================================================================
# wp-env's own defaults, overridable with the same variables wp-env reads, so a
# second checkout can run alongside this one on different ports.
CLIENT_URL="http://localhost:${WP_ENV_PORT:-8904}"
PROVIDER_URL="http://localhost:${WP_ENV_TESTS_PORT:-8905}"

# Fail loudly if WordPress disagrees with what we just computed - otherwise the
# OIDC endpoints would be silently wrong and every SSO test would time out.
ACTUAL_CLIENT_URL="$(wp-env run cli wp option get siteurl 2>/dev/null | tr -d '\r' | grep -Eo 'https?://[^[:space:]]+' | head -1)"

if [ "$ACTUAL_CLIENT_URL" != "$CLIENT_URL" ]; then
	echo "Client siteurl is '${ACTUAL_CLIENT_URL}' but expected '${CLIENT_URL}'." >&2
	exit 1
fi

# The client's browser-facing requests use localhost, but its server-to-server
# calls (token + userinfo) run inside the container and must reach the provider
# via the Docker host gateway. wp-env maps host.docker.internal for us.
PROVIDER_BACKCHANNEL_URL="${PROVIDER_URL/localhost/host.docker.internal}"

echo ""
echo "Client URL:               ${CLIENT_URL}"
echo "Provider URL:             ${PROVIDER_URL}"
echo "Provider back-channel:    ${PROVIDER_BACKCHANNEL_URL}"

# =============================================================================
# TESTS ENVIRONMENT (OIDC Provider)
# =============================================================================
echo ""
echo "--- Configuring Tests Environment (OIDC Provider - ${PROVIDER_URL}) ---"

# Activate the OIDC server plugin
# The test client and Laravel claims mu-plugins are auto-loaded via .wp-env.json mappings
wp-env run tests-cli wp plugin activate openid-connect-server

# Tell the test-client fixture where to redirect back to
wp-env run tests-cli wp option update soli_test_client_redirect_uri \
	"${CLIENT_URL}/wp-admin/admin-ajax.php?action=openid-connect-authorize"

# Update admin user with name fields (required for OIDC claims)
wp-env run tests-cli wp user update admin --first_name=Admin --last_name=User --display_name="Admin User"

# Create test user with subscriber role
wp-env run tests-cli wp user create testuser testuser@soli.nl --user_pass=testpass --role=subscriber --first_name=Test --last_name=User --display_name="Test User" 2>/dev/null || echo "Test user already exists"

# Create a test user with editor role for role sync testing
wp-env run tests-cli wp user create editoruser editor@soli.nl --user_pass=testpass --role=editor --first_name=Editor --last_name=User --display_name="Editor User" 2>/dev/null || echo "Editor user already exists"

# Enable pretty permalinks (required for REST API endpoints)
wp-env run tests-cli wp rewrite structure '/%postname%/' --hard

echo "Tests environment configured."

# =============================================================================
# DEVELOPMENT ENVIRONMENT (OIDC Client)
# =============================================================================
echo ""
echo "--- Configuring Development Environment (OIDC Client - ${CLIENT_URL}) ---"

# Activate plugins
wp-env run cli wp plugin activate wp-soli-oidc-client-plugin
wp-env run cli wp plugin activate daggerhart-openid-connect-generic

# soli.nl runs in Dutch, so the client environment does too. This also means the
# E2E suite exercises the plugin's nl_NL translation files.
wp-env run cli wp language core install nl_NL --activate

# Configure OIDC client settings to connect to the provider
wp-env run cli wp option update openid_connect_generic_settings "{
  \"login_type\": \"auto\",
  \"client_id\": \"soli-dev-client\",
  \"client_secret\": \"dev-secret-12345\",
  \"scope\": \"openid email profile roles assignments\",
  \"endpoint_login\": \"${PROVIDER_URL}/?rest_route=/openid-connect/authorize\",
  \"endpoint_userinfo\": \"${PROVIDER_BACKCHANNEL_URL}/?rest_route=/openid-connect/userinfo\",
  \"endpoint_token\": \"${PROVIDER_BACKCHANNEL_URL}/?rest_route=/openid-connect/token\",
  \"endpoint_end_session\": \"${PROVIDER_URL}/wp-login.php?action=logout\",
  \"acr_values\": \"\",
  \"enable_logging\": \"1\",
  \"log_limit\": \"1000\",
  \"link_existing_users\": \"1\",
  \"create_if_does_not_exist\": \"1\",
  \"redirect_user_back\": \"1\",
  \"redirect_on_logout\": \"1\",
  \"enforce_privacy\": \"0\",
  \"alternate_redirect_uri\": \"0\",
  \"identity_key\": \"nickname\",
  \"nickname_key\": \"nickname\",
  \"email_format\": \"{email}\",
  \"displayname_format\": \"{given_name} {family_name}\",
  \"identify_with_username\": \"1\",
  \"state_time_limit\": \"300\",
  \"token_refresh_enable\": \"1\",
  \"http_request_timeout\": \"5\",
  \"enable_sso\": \"1\",
  \"allow_internal_idp\": \"1\"
}" --format=json

# Set the provider logout URL
wp-env run cli wp option update soli_oidc_client_logout_url "${PROVIDER_URL}/wp-login.php?action=logout"

echo "Development environment configured."

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=== Setup Complete ==="
echo ""
echo "OIDC Provider (tests):     ${PROVIDER_URL}"
echo "  - Admin:                 admin / password"
echo "  - Test user:             testuser / testpass"
echo "  - Editor user:           editoruser / testpass"
echo ""
echo "OIDC Client (development): ${CLIENT_URL}"
echo "  - Admin:                 admin / password"
echo "  - Login with OIDC:       Auto-redirects to provider (SSO)"
echo ""
echo "OIDC Client Credentials:"
echo "  - Client ID:             soli-dev-client"
echo "  - Client Secret:         dev-secret-12345"
echo ""
