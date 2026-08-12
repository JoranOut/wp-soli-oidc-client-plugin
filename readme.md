# Soli OIDC Client Plugin

OIDC client plugin for WordPress sites consuming the Soli Laravel provider.

~Current Version:0.1.0~

~Plugin Name: wp-soli-oidc-client-plugin~

## Description

This plugin extends the OpenID Connect Generic (daggerhart) plugin to consume OIDC claims from the Soli Laravel identity provider. It syncs roles and assignments from the provider to WordPress user roles and user meta.

## Features

- **Role Sync**: Maps `roles` array from provider claims to WordPress roles
- **Assignments Sync**: Stores `assignments` array in user meta for downstream use
- **SSO Bypass**: Direct WordPress login via `?bypass-sso` parameter
- **Error Handling**: Retry button on login errors with session reset
- **Configurable Logout URL**: Settings page for provider logout URL

## Requirements

- WordPress 6.0+
- PHP 8.3+
- [OpenID Connect Generic](https://wordpress.org/plugins/daggerhart-openid-connect-generic/) plugin (required)

## Installation

1. Upload the plugin files to `/wp-content/plugins/wp-soli-oidc-client-plugin`
2. Install and activate the OpenID Connect Generic plugin
3. Activate this plugin through the WordPress admin
4. Configure the provider logout URL under Settings > Soli OIDC Client

## Development

```bash
# Start the local environment: an OIDC client on :8904 and a test OIDC
# provider on :8905. Signing keys for the provider are generated on first
# start and are never committed.
npm run env:start

# Run the E2E suite
npm run test:e2e
```

Both ports are configurable, so a second checkout can run alongside:

```bash
WP_ENV_PORT=9888 WP_ENV_TESTS_PORT=9889 npm run env:start
WP_ENV_PORT=9888 WP_ENV_TESTS_PORT=9889 npm run test:e2e
```

## Changelog

### 0.1.0
- Initial release
- Role sync from `roles` array claim
- Assignments sync to user meta
- SSO bypass and error handling
- Configurable provider logout URL
