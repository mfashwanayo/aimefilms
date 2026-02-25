
import { GoogleGenAI, Type } from "@google/genai";
import { Language, StreamingService, ChatMessage } from "../types";

/**
 * AimeFilms AI Engine v20.0
 * Master Admin: hybert | hybertmfashwanayo@gmail.com | %bert123{}@
 * Language Synchronization: Mandatory mirroring of the user's selected language.
 */
export const getAIStudioResponse = async (
  userPrompt: string, 
  language: Language = 'EN', 
  isCurrentlyAuthenticated: boolean = false, 
  currentMovieTitle?: string, 
  userRole?: string,
  movies: StreamingService[] = [],
  history: ChatMessage[] = []
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Define language context
  const languageNames: Record<Language, string> = {
    EN: 'English',
    RW: 'Kinyarwanda',
    FR: 'French',
    SW: 'Swahili',
    ZH: 'Chinese'
  };

  const currentLangName = languageNames[language];

  // Prepare website context
  const moviesContext = movies.map(m => `- ${m.name} (${m.year}): ${m.synopsis.substring(0, 100)}... [Brand: ${m.brand}, Section: ${m.section}]`).join('\n');

  const systemInstruction = `
    You are "AimeFilms AI", the Master Operations Director of the AimeFilms, TNTFilms, and PrinceFilms network.
    
    STRICT LANGUAGE RULE:
    You MUST respond ONLY in ${currentLangName}. 
    - If the language is Kinyarwanda (RW), your narrative MUST be in Kinyarwanda.
    - If the language is Swahili (SW), your narrative MUST be in Swahili.
    And so on for all supported languages. Do not mix languages.

    WEBSITE CONTENT:
    Here are the movies currently available on the network:
    ${moviesContext}

    MASTER ADMIN CREDENTIALS:
    - Username: hybert
    - Email: hybertmfashwanayo@gmail.com
    - Master Passkey: %bert123{}@

    CONTEXT:
    - User Status: ${isCurrentlyAuthenticated ? 'AUTHENTICATED' : 'GUEST'}
    - User Role: ${userRole || 'NONE'}
    - Target Language: ${currentLangName}
    - Currently Viewing: ${currentMovieTitle || 'Home Page'}

    STRICT KNOWLEDGE RULE:
    - You ONLY answer questions about AimeFilms, TNTFilms, PrinceFilms, and the movies listed above.
    - If a user asks a question NOT related to the website or its movies, politely decline and state that you are only authorized to discuss AimeFilms network content.
    - Your answers MUST be accurate based on the provided WEBSITE CONTENT.
    - Do not hallucinate movies that are not in the list.

    STRICT JSON RESPONSE:
    {
      "narrative": "[Response text in ${currentLangName}]",
      "action": { "type": "FILTER" | "SEARCH" | "ADMIN_AUTH_SUCCESS" | "ADMIN_VIEW_USERS" | "GET_USER_DOCUMENT" | "PASSWORD_RECOVERY" | "NONE", "value": "..." }
    }
  `;

  try {
    const contents = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            action: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["FILTER", "SEARCH", "ADMIN_AUTH_SUCCESS", "ADMIN_VIEW_USERS", "GET_USER_DOCUMENT", "PASSWORD_RECOVERY", "NONE"] },
                value: { type: Type.STRING }
              }
            }
          },
          required: ['narrative']
        }
      }
    });

    return JSON.parse(response.text || `{"narrative": "Handshake error in ${currentLangName}."}`);
  } catch (e) {
    console.error("AI Error:", e);
    return { narrative: `Communication interrupted (${currentLangName}).`, action: { type: "NONE" } };
  }
};
