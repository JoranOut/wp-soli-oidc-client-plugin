#!/bin/bash
#
# wp-env setup script for OIDC client testing
#
# This script runs after wp-env start and configures:
# - Tests environment (8889): OIDC Provider with test data and Laravel-format claims
# - Development environment (8888): OIDC Client connected to provider
#

set -e

echo "=== Setting up wp-env OIDC client testing environments ==="

# =============================================================================
# TESTS ENVIRONMENT (OIDC Provider) - localhost:8889
# =============================================================================
echo ""
echo "--- Configuring Tests Environment (OIDC Provider - localhost:8889) ---"

# Activate the OIDC server plugin
# The test client and Laravel claims mu-plugins are auto-loaded via .wp-env.json mappings
wp-env run tests-cli wp plugin activate openid-connect-server

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
# DEVELOPMENT ENVIRONMENT (OIDC Client) - localhost:8888
# =============================================================================
echo ""
echo "--- Configuring Development Environment (OIDC Client - localhost:8888) ---"

# Activate plugins
wp-env run cli wp plugin activate wp-soli-oidc-client-plugin
wp-env run cli wp plugin activate daggerhart-openid-connect-generic

# Configure OIDC client settings to connect to the provider (8889)
wp-env run cli wp option update openid_connect_generic_settings '{
  "login_type": "auto",
  "client_id": "soli-dev-client",
  "client_secret": "dev-secret-12345",
  "scope": "openid email profile roles assignments",
  "endpoint_login": "http://localhost:8889/?rest_route=/openid-connect/authorize",
  "endpoint_userinfo": "http://host.docker.internal:8889/?rest_route=/openid-connect/userinfo",
  "endpoint_token": "http://host.docker.internal:8889/?rest_route=/openid-connect/token",
  "endpoint_end_session": "http://localhost:8889/wp-login.php?action=logout",
  "acr_values": "",
  "enable_logging": "1",
  "log_limit": "1000",
  "link_existing_users": "1",
  "create_if_does_not_exist": "1",
  "redirect_user_back": "1",
  "redirect_on_logout": "1",
  "enforce_privacy": "0",
  "alternate_redirect_uri": "0",
  "identity_key": "nickname",
  "nickname_key": "nickname",
  "email_format": "{email}",
  "displayname_format": "{given_name} {family_name}",
  "identify_with_username": "1",
  "state_time_limit": "300",
  "token_refresh_enable": "1",
  "http_request_timeout": "5",
  "enable_sso": "1",
  "allow_internal_idp": "1"
}' --format=json

# Set the provider logout URL
wp-env run cli wp option update soli_oidc_client_logout_url "http://localhost:8889/wp-login.php?action=logout"

echo "Development environment configured."

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=== Setup Complete ==="
echo ""
echo "OIDC Provider (tests):     http://localhost:8889"
echo "  - Admin:                 admin / password"
echo "  - Test user:             testuser / testpass"
echo "  - Editor user:           editoruser / testpass"
echo ""
echo "OIDC Client (development): http://localhost:8888"
echo "  - Admin:                 admin / password"
echo "  - Login with OIDC:       Auto-redirects to provider (SSO)"
echo ""
echo "OIDC Client Credentials:"
echo "  - Client ID:             soli-dev-client"
echo "  - Client Secret:         dev-secret-12345"
echo ""
