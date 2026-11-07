# Contributing to wafpass-dashboard

WOMBAT Dashboard is the React control plane for Wombat runs, controls, waivers, risk acceptances and reports.

## Before you start

- Open an issue for larger changes so the approach can be agreed before implementation.
- Keep pull requests focused and include tests for behaviour changes.
- Sign off your commits with `git commit -s` (Developer Certificate of Origin, see `DCO`).

## Development checks

```bash
npm ci
npm run build
npm test -- --run
```

See `README.md` and `DESIGN.md` for architecture and visual conventions.

## Pull requests

- Describe the problem and the chosen approach.
- Link related issues.
- Update `CHANGELOG.md` when the change is user-visible.
- Keep documentation and examples in sync with the code.
