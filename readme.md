[![version](https://img.shields.io/github/package-json/v/JoranOut/wp-soli-oidc-client-plugin?label=version&color=3858e9)](https://github.com/JoranOut/wp-soli-oidc-client-plugin/releases)
[![nightly](https://img.shields.io/github/v/release/JoranOut/wp-soli-oidc-client-plugin?include_prereleases&label=nightly&color=fb8817)](https://github.com/JoranOut/wp-soli-oidc-client-plugin/releases)
[![tested up to](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.wordpress.org%2Fcore%2Fversion-check%2F1.7%2F&query=%24.offers%5B0%5D.current&label=tested%20up%20to&prefix=WP%20&color=40a8af)](https://wordpress.org/download/releases/)
[![requires](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FJoranOut%2Fwp-soli-oidc-client-plugin%2Fmain%2Fpackage.json&query=%24.wordpress.requiresAtLeast&label=requires&prefix=WP%20&color=40a8af)](https://wordpress.org/download/releases/)
[![wp-env](https://img.shields.io/github/package-json/dependency-version/JoranOut/wp-soli-oidc-client-plugin/dev/@wordpress/env?label=wp-env&color=40a8af)](https://www.npmjs.com/package/@wordpress/env)
[![node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FJoranOut%2Fwp-soli-oidc-client-plugin%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&color=43853d)](https://nodejs.org)
[![license](https://img.shields.io/github/license/JoranOut/wp-soli-oidc-client-plugin?color=blue)](LICENSE)

# Soli OIDC Client Plugin

OIDC client plugin for WordPress sites consuming the Soli Laravel provider.

<!-- Machine-readable markers. publish.js reads the plugin name to name the zip,
     and the release workflows rewrite the version here when packaging a build.
     Kept in a comment because a single tilde renders as strikethrough on GitHub;
     the badges above are the human-readable version. Do not reformat.
~Current Version:0.1.0~
~Plugin Name: wp-soli-oidc-client-plugin~
-->

## Description

This plugin extends the OpenID Connect Generic (daggerhart) plugin to consume OIDC claims from the Soli Laravel identity provider. It syncs roles and assignments from the provider to WordPress user roles and user meta.

## Features

- **Role Sync**: Maps `roles` array from provider claims to WordPress roles
- **Assignments Sync**: Stores `assignments` array in user meta for downstream use
- **SSO Bypass**: Direct WordPress login via `?bypass-sso` parameter
- **Error Handling**: Retry button on login errors with session reset
- **Configurable Logout URL**: Settings page for provider logout URL

## Requirements

- WordPress 6.9+ (the e2e suite runs against the newest patch of 6.9 and against the newest WordPress release)
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
