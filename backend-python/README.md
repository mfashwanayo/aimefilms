# Python AI Backend (FastAPI)

## Run locally
From repo root:

```bash
cd backend-python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

## Endpoints
- `GET /health`
- `POST /ai/gemini`
  - Accepts JSON body matching the frontend `getAIStudioResponse` inputs.

### Expected request schema (example)
```json
{
  "userPrompt": "hello",
  "language": "EN",
  "isCurrentlyAuthenticated": false,
  "currentMovieTitle": "Home Page",
  "userRole": "user",
  "movies": [],
  "history": []
}
```

### Configure Gemini key
Set environment variable:
- `GEMINI_API_KEY`

