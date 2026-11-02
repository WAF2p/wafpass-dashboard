# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
This release is the coordinated WAFPass → WOMBATpass rebrand and is versioned as
a minor release at the project owner's request; treat the rename as breaking and
pin exact versions.

## [1.2.0] - 2026-11-02

### Breaking changes

- Renamed the package and product from `wafpass-dashboard` / WAFPass to
  **`wombat-dashboard` / WOMBATpass**.
- Browser storage keys moved from the `wafpass_` prefix to `wombat_`. A one-time
  migration in `src/legacyStorage.ts` copies existing values, but custom scripts
  or third-party tooling that reads `wafpass_*` keys must be updated.
- The dashboard calls `wombat-server` under `/api/v1/*`. Reverse proxies and
  CORS configurations must forward `/api` rather than individual paths such as
  `/runs` or `/controls`.
- Renamed the repository from `WAF2p/wafpass-dashboard` to
  `wombat-gov/wombat-dashboard`.

### Changed

- User-facing branding, documentation, favicons and the About page now show
  WOMBATpass and report version `1.2.0`.
- Package metadata, release workflow names and repository links point at the
  `wombat-gov` organisation.
- Version fallback in the About page updated to `1.2.0`.

### Migration

1. Update Docker image, compose service and deployment names from
   `wafpass-dashboard` to `wombat-dashboard`.
2. If you integrate with browser storage, rename `wafpass_*` keys to
   `wombat_*` (the app migrates them automatically once).
3. Forward `/api` to `wombat-server` and allow the dashboard origins in the
   server's CORS configuration.
4. Update CI and pins from `WAF2p/wafpass-dashboard` to
   `wombat-gov/wombat-dashboard`.
5. Pin the image/tag to `1.2.0` for reproducible deployments.

### Companion releases

- `wombat-core` 1.2.0
- `wombat-server` 1.2.0
- `wombat-mcp` 0.2.0
- `wombat-action` 0.2.0
