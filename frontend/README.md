# AimeFilms frontend

This folder contains the React + TypeScript single-page application.

## Run locally

```powershell
cd frontend
npm ci
npm run dev
```

Vite starts at <http://localhost:5173>. Set `VITE_API_BASE_URL` in `.env.local` when the backend is hosted somewhere other than the local default `http://localhost:8001`.

## Main areas

- `App.tsx`: page state and high-level composition
- `components/`: reusable page sections, dialogs, player and admin dashboard
- `services/http.ts`: shared HTTP client, bearer token handling and error normalization
- `services/backendApi.ts`: API operations, multipart local uploads and resumable Supabase uploads
- `services/api.ts`: application data and admin-facing API methods
- `locales/`: translated interface text
- `index.css`: global styles and design tokens

## Checks

```powershell
npm run lint
npm run build
```

The browser does not have database credentials. Authentication and privileged actions go through the FastAPI backend.
