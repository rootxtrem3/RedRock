# Deploy RED ROCK on Vercel

The repository has separate `frontend` and `backend` apps. Import the same GitHub repository twice in Vercel and set a different Root Directory for each project.

## Backend project

1. Import `rootxtrem3/Red-Rock` and set **Root Directory** to `backend`.
2. Keep the framework preset on **Other** (or allow Express detection), Build Command `npm run build`, and Node.js version **22.x**. Do not set a custom output directory or start command.
3. Add `RED_ROCK_CORS_ORIGINS` with the exact frontend production origin, for example `https://red-rock-frontend.vercel.app`. Add any frontend preview origin you intend to use, comma separated.
4. Deploy. Open `https://<backend-project>.vercel.app/api/health`; it should return JSON with `status: "ok"` and loaded datasets.

The backend project contains its required processed science grids under `backend/data/mars/processed`; `backend/vercel.json` bundles them with the Express function.

## Frontend project

1. Import the same GitHub repository again and set **Root Directory** to `frontend`.
2. Use the **Vite** preset, Build Command `npm run build`, and Output Directory `dist`.
3. Set `VITE_API_BASE_URL` to the backend project origin, for example `https://red-rock-backend.vercel.app` (no trailing slash). Add it for Production and Preview, then redeploy.
4. Open the frontend deployment and try a site selection, a map sample, and a route request. If the API is blocked, add the exact frontend origin to the backend's `RED_ROCK_CORS_ORIGINS` and redeploy the backend.

Vercel's Git integration deploys connected projects when the selected branch receives a push. Use the feature branch deployment first; promote or merge to the production branch only after review.
