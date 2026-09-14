# Changelog

All notable Hollow Cards changes are documented here.

## [1.0.0] - 2026-09-14

### Added

- Stable HACS Dashboard packaging for the complete 16-card set.
- Canonical `hollow-cards.js` module entry point for one-resource installation.
- HACS validation and Node.js test workflows.
- Home Assistant card-picker documentation links for every card.

### Changed

- Corrected installation documentation to use the actual repository slug,
  `MrHollowX/hollow-cards`, and `/hacsfiles/hollow-cards/hollow-cards.js`.
- Declared the HACS payload as living outside the repository root in
  `hacs.json`.
- Removed the obsolete `hollow-cards-set.js` duplicate entry point.

### Compatibility

- Existing `custom:hollow-*` card types and card configuration options remain
  unchanged.
- The package remains a frontend Dashboard plugin; it does not become a
  Python custom integration or add a `custom_components/` backend.
