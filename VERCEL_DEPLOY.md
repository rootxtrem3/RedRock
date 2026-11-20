# Deploy RED ROCK on Vercel

The repository deploys as one Vercel project with two independently built services. The root [`vercel.json`](./vercel.json) sends `/api/*` to the Express backend and all other public requests to the Vite frontend.

## Services

- `frontend` uses `frontend/`, the Vite preset, and `frontend/dist` as its output.
- `backend` uses `backend/`, the Express preset, and `backend/index.ts` as its function entrypoint. Its prepared science grids are included from `backend/data/mars/processed/`.

Both services are public only through the project-level rewrite table. The backend receives the original `/api/...` path, which matches its Express routes.

## Deploy

1. Import `rootxtrem3/Red-Rock` once and leave the Vercel project's **Root Directory** at the repository root.
2. Do not add `VITE_API_BASE_URL`; a blank value makes browser requests use the deployment's same-origin `/api` route.
3. Deploy, then open `/api/health`. It should return JSON with `status: "ok"` and the loaded datasets.
4. Open `/` and verify location analysis, seasonal solar data, and route planning.

Same-origin production requests do not require CORS configuration. `RED_ROCK_CORS_ORIGINS` remains available only for an intentionally separate browser origin.

## Service bindings

There are no service bindings in this deployment. The caller is static Vite code running in the user's browser, not a frontend function, so it cannot read runtime binding variables. Public same-origin `/api` routing is the correct connection. Do not set a generated binding variable manually.

## Local services development

Run both services through the same routing table:

```bash
npx vercel@latest dev --local
```

For standalone development, continue to run the backend and Vite separately. Copy `frontend/.env.example` to `frontend/.env.local`; Vite proxies `/api` to `VITE_API_PROXY_TARGET`.
