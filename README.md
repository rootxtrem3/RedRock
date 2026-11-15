# Red-Rock

Mars exploration and survival-planning interface.

The application is in [`frontend/`](./frontend/).

```bash
cd frontend
npm install
npm run dev
```

The data-backed TypeScript API and its prepared 0.1° Mars grids are in [`backend/`](./backend/) and [`data/mars/processed/`](./data/mars/processed/). The supported local API development command is `cd backend; npm ci; npm run dev` (Node.js 22+). The API binds to `127.0.0.1:8000`; set `VITE_API_BASE_URL` in the frontend when using separate hosts.

Routes are exploratory planning paths over coarse MOLA terrain, not rover-safe guarantees. The API labels unsupported scientific values as unavailable rather than inventing measurements.
