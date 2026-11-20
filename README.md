# Red-Rock

Mars exploration and survival-planning interface.

The application is in [`frontend/`](./frontend/).

```bash
npx vercel@latest dev --local
```

Vercel builds the Vite app in [`frontend/`](./frontend/) and the TypeScript/Express API in [`backend/`](./backend/) as separate services in one project. Public `/api/*` requests reach the backend; all other requests reach the frontend. See [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md).

For standalone development, run `cd backend; npm ci; npm run dev` and `cd frontend; npm ci; cp .env.example .env.local; npm run dev` in separate terminals. Vite proxies same-origin `/api` requests to the local API at `127.0.0.1:8000`.

Routes are exploratory planning paths over coarse MOLA terrain, not rover-safe guarantees. The API labels unsupported scientific values as unavailable rather than inventing measurements.
