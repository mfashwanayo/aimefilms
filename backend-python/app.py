from fastapi import FastAPI, Request
from pydantic import BaseModel
from typing import Literal, Optional, List
import os

try:
    from google.genai import Client
except Exception:
    Client = None

app = FastAPI(title="AimeFilms AI")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


class AIRequest(BaseModel):
    userPrompt: str
    language: Literal['EN','RW','FR','SW','ZH'] = 'EN'
    isCurrentlyAuthenticated: bool = False
    currentMovieTitle: Optional[str] = None
    userRole: Optional[str] = None
    movies: List[dict] = []
    history: List[dict] = []


@app.get('/health')
def health():
    return {"ok": True}


@app.post('/ai/gemini')
def gemini(req: AIRequest):
    # Fallback behavior if GenAI client isn't available.
    if not GEMINI_API_KEY or Client is None:
        return {
            "narrative": f"AI unavailable in this environment. (language={req.language})",
            "action": {"type": "NONE", "value": ""}
        }

    client = Client(api_key=GEMINI_API_KEY)

    language_names = {
        'EN': 'English',
        'RW': 'Kinyarwanda',
        'FR': 'French',
        'SW': 'Swahili',
        'ZH': 'Chinese'
    }
    current_lang_name = language_names[req.language]

    movies_context = "\n".join([
        f"- {m.get('name','')} ({m.get('year','')}): {str(m.get('synopsis',''))[:100]}... [Brand: {m.get('brand','')}, Section: {m.get('section','')}]"
        for m in req.movies
    ])

    system_instruction = f"""
    You are \"AimeFilms AI\", the Master Operations Director of the AimeFilms, TNTFilms, and PrinceFilms network.

    STRICT LANGUAGE RULE:
    You MUST respond ONLY in {current_lang_name}.

    WEBSITE CONTENT:
    Here are the movies currently available on the network:
    {movies_context}

    STRICT JSON RESPONSE:
    {{
      "narrative": "[Response text in {current_lang_name}]",
      "action": {{ "type": "FILTER" | "SEARCH" | "ADMIN_AUTH_SUCCESS" | "ADMIN_VIEW_USERS" | "GET_USER_DOCUMENT" | "PASSWORD_RECOVERY" | "NONE", "value": "..." }}
    }}
    """

    contents = []
    for h in req.history:
        role = 'user' if h.get('role') == 'user' else 'model'
        contents.append({"role": role, "parts": [{"text": h.get('text','')}]})
    contents.append({"role": 'user', "parts": [{"text": req.userPrompt}]})

    # Gemini model name kept aligned with current frontend.
    resp = client.models.generate_content(
        model='gemini-3-pro-preview',
        contents=contents,
        config={
            'systemInstruction': system_instruction,
            'responseMimeType': 'application/json',
            # Schema enforcement is intentionally lightweight here.
        }
    )

    text = resp.text if hasattr(resp, 'text') else str(resp)
    import json
    try:
        return json.loads(text)
    except Exception:
        return {"narrative": text, "action": {"type": "NONE", "value": ""}}

