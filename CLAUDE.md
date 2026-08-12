# wp-soli-oidc-client-plugin

WordPress plugin that extends the OpenID Connect Generic (daggerhart) plugin to consume OIDC claims from the Soli Laravel identity provider.

## Purpose

This plugin handles the client side of the OIDC authentication flow:

1. **Role Sync** - Maps the `roles` array from provider claims to WordPress roles
2. **Assignments Sync** - Stores the `assignments` array in user meta
3. **Login Customizer** - SSO bypass, error retry button, login form hiding
4. **Settings** - Configurable provider logout URL

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                Laravel Soli Administration                       │
│                    (Identity Provider)                           │
│                                                                 │
│  /oauth/authorize  →  /oauth/token  →  /oauth/userinfo         │
│                                                                 │
│  Claims: { roles: ["editor"], assignments: [{...}] }            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ OIDC Flow
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            WordPress Site (Client)                               │
│                                                                 │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │ daggerhart OIDC      │  │ wp-soli-oidc-client-plugin     │  │
│  │ (handles OIDC flow)  │→ │                                │  │
│  └──────────────────────┘  │ Role_Sync: roles[] → WP role   │  │
│                            │ Assignments_Sync: → user meta  │  │
│                            │ Login_Customizer: SSO bypass    │  │
│                            │ Settings: logout URL config     │  │
│                            └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Claim Formats

### Roles (from Laravel provider)

```json
{
  "roles": ["editor"]
}
```

- Array of WordPress role slugs
- First valid role is set as the user's WordPress role
- Empty array removes all roles (no access)

### Assignments (from Laravel provider)

```json
{
  "assignments": [
    {
      "onderdeel_id": 1,
      "instrument_soort_id": 5,
      "instrument_soort": "Trompet",
      "instrument_familie": "Koperblazers"
    }
  ]
}
```

- Array of assignment objects with orchestra/instrument details
- `onderdeel_id` — Orchestra/group ID
- `instrument_soort_id` — Instrument type ID
- `instrument_soort` — Instrument type name
- `instrument_familie` — Instrument family name (nullable)
- Stored in user meta (`soli_oidc_assignments`)
- Available for themes and other plugins

## Plugin Structure

```
wp-soli-oidc-client-plugin/
├── wp-soli-oidc-client-plugin.php     # Main plugin file
├── updater.php                         # GitHub updater
├── uninstall.php                       # Cleanup options + user meta
├── readme.md                           # Version info for updater
├── includes/
│   ├── class-soli-oidc-client-dependency-checker.php
│   ├── class-soli-oidc-client-settings.php
│   ├── class-soli-oidc-client-role-sync.php
│   ├── class-soli-oidc-client-assignments-sync.php
│   └── class-soli-oidc-client-login-customizer.php
├── languages/
└── e2e/
    ├── sso-login.spec.js
    └── role-sync.spec.js
```

## Settings

| Option | Key | Description |
|--------|-----|-------------|
| Provider Logout URL | `soli_oidc_client_logout_url` | URL to clear provider session on errors |

Configure under **Settings > Soli OIDC Client** in WordPress admin.

## User Meta

| Key | Description |
|-----|-------------|
| `soli_oidc_assignments` | Array of assignment objects from provider claims |

## Development Guidelines

### Coding Standards

- Namespace: `Soli\OidcClient`
- Function prefix: `soli_oidc_client_`
- Hook prefix: `soli_oidc_client_`
- Text domain: `soli-oidc-client`
- Constants: `SOLI_OIDC_CLIENT__*`

### Testing

```bash
# Start environment (includes OIDC client on 8904, provider on 8905)
npm run env:start

# Run tests
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed
```

### Test Setup

The test environment uses:
- **Port 8904**: WordPress with daggerhart OIDC client + this plugin
- **Port 8905**: WordPress with OIDC server + `oidc-laravel-claims.php` mu-plugin

The `oidc-laravel-claims.php` mu-plugin on the test provider hooks into `oidc_user_claims` to return claims in the Laravel format (`roles` array, `assignments` array).
