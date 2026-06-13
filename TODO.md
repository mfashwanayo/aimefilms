# TODO - PHP + Python backend wiring — COMPLETE

- [x] Create complete PHP REST API backend (`backend-php/index.php`)
  - [x] Auth: login (JWT tokens), register
  - [x] Movies: public list, search by name
  - [x] Movies: admin CRUD (create, update, delete, hide/show)
  - [x] Views: track per-movie, server-side top 10
  - [x] Watchlist: per-user sync to server
  - [x] Continue Watching: per-user sync to server
  - [x] Messages (inbox): send, list, mark-read, delete
  - [x] Admin: user management (list, toggle-block)
  - [x] Admin: analytics dashboard data
  - [x] Admin: event logs (list, clear)
  - [x] Admin: feedback/messages inbox
  - [x] User: profile update
  - [x] SQLite database with auto-schema + master admin seeding
  - [x] CORS support, JSON-only responses
  - [x] `.env.example` config file

- [x] Create Python AI backend (`backend-python/app.py`)
  - [x] FastAPI server on port 8001
  - [x] `POST /ai/gemini` — mirrors frontend `getAIStudioResponse` signature
  - [x] Gemini API integration with language streaming
  - [x] `requirements.txt` with all deps
  - [x] `README.md` with run instructions

- [x] Frontend -> Backend wiring
  - [x] `services/http.ts` — base URL config, JWT token management, fetch wrapper
  - [x] `services/backendApi.ts` — typed backend API calls (login, register, movies, search, track view)
  - [x] `services/geminiBackendClient.ts` — typed client for Python AI endpoint
  - [x] `services/api.ts` — refactored: tries PHP backend first, falls back to localStorage
  - [x] `.env.example` for frontend env vars (`VITE_API_BASE_URL`, `VITE_AI_BASE_URL`)

- [x] TypeScript compiles cleanly (`tsc --noEmit` passes)
