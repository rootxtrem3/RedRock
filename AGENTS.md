# Repository Guidelines

## Project Structure

The React, TypeScript, and Vite app lives in `frontend/src/`; reusable UI is in `components/`, with app data and types in `data/` and `types.ts`. Static images and terrain assets are under `frontend/public/`. The TypeScript/Express API is in `backend/src/`, with tests in `backend/test/`. Prepared Mars grids and provenance are in `data/mars/processed/`; Python data-preparation utilities are in `scripts/`.

## Build, Test, and Development

Run commands from the indicated directory:

```powershell
cd frontend
npm ci                 # install lockfile-pinned dependencies
npm run dev            # start the Vite development server
npm run lint           # run Oxlint
npm run build          # type-check and build the production app
```

For the API, run `cd backend`, `npm ci`, and `npm run dev`; it listens on `http://127.0.0.1:8000`. Use `npm test` for API tests, `npm run typecheck` for TypeScript checks, and `npm run build` for production output.

## Coding Style

Follow existing conventions: two-space indentation, no semicolons in TypeScript, PascalCase React component files and names, and camelCase variables/functions. Use Python `snake_case` and type hints in data-preparation scripts. Keep changes focused and reuse existing components and data types.

## Scientific Data Practices

Preserve source attribution, units, coverage, and no-data states. Do not present SWIM ice-consistency scores as confirmed water or coarse route estimates as guaranteed safe routes. Label model outputs and derived terrain indicators clearly; do not invent measurements for unavailable layers.

## Commits and Pull Requests

The existing history does not establish a commit-message convention. Use a concise imperative subject, such as `Add route profile endpoint`. Pull requests should summarize the user-visible or API change, list validation performed, include screenshots for UI changes, and cite sources or explain caveats for scientific-data changes.
