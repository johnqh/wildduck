# Repository Guidelines

## Project Structure & Module Organization
The runtime entry point is `server.js`, with protocol logic in `lib/`, `imap-core/`, and `plugins/`. Configuration templates and defaults live under `config/`, static assets for the admin UI in `public/` and `assets/`, and operational helpers in `scripts/` and `docs/`. Tests, fixtures, and auth runners reside in `test/`, while `Dockerfile` and `docker-compose.yml` provision MongoDB, Redis, and auxiliary services for local stacks.

## Build, Test, and Development Commands
`npm install` bootstraps dependencies. `npm start` runs the server with local config; pair it with `npm run printconf` to confirm effective settings. `npm test` flushes the test MongoDB and Redis databases before executing the Grunt-driven suite. Use `npm run dev:quick-test` for Mocha API checks, `npm run test:auth:*` for protocol-specific validation, and `npm run generate-api-docs` (or `npm run apidoc`) whenever API shapes change.

## Coding Style & Naming Conventions
Lint with `grunt eslint`, which extends the Nodemailer preset. Prettier enforces 4-space indentation, single quotes, 160-character lines, LF endings, and no trailing commas. Use camelCase for functions and variables, PascalCase for constructors, and kebab-case for CLI or script filenames. Favor async/await and add concise comments only for intent that is not obvious from the code.

## Testing Guidelines
Ensure MongoDB and Redis are running locally before invoking `npm test`. Place new tests in `test/` using `*.spec.js` filenames that mirror the module under coverage, and group fixtures alongside the suite that consumes them. For regression fixes, add a focused spec and verify with `npm run dev:check-all` so linting and status helpers run before opening a PR. Document any external dependencies or unusual setup in the PR body.

## Commit & Pull Request Guidelines
Follow the observed conventional prefixes (`chore:`, `refactor:`, `enhance:`) plus a clear summary, and keep commits narrowly scoped for easier review. Reference related issues or tickets in the description and note config, schema, or protocol updates explicitly. PRs should outline motivation, list validation commands, and include screenshots or curl examples when API responses or UI assets change. Request review from a domain owner for protocol, storage, or API surface changes.

## Environment & Configuration Tips
Start from `.env.example` or `.env.local.example`, keeping production credentials out of the repository. Update `config/default.json` derivatives rather than generated output, and document new environment flags or defaults in `docs/` alongside the relevant feature notes.
