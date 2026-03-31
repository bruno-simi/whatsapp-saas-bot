const env = require("../config/env");
const logger = require("../utils/logger");
const { buildSystemPrompt } = require("./prompts/systemPrompt");
const { handleFallback } = require("./skills/assistantSkills");

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (typeof payload.intent !== "string") return false;
  if (typeof payload.response !== "string") return false;
  return true;
}

function clampContext(context = {}) {
  const messages = Array.isArray(context.lastMessages) ? context.lastMessages.slice(-4) : [];
  return {
    ...context,
    lastMessages: messages.map((item) => String(item).slice(0, 180)),
  };
}

async function askGemini(message, context = {}) {
  if (!env.geminiApiKey) {
    return handleFallback();
  }

  const safeContext = clampContext(context);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.geminiTimeoutMs);

  try {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify({
                message,
                context: safeContext,
              }),
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: buildSystemPrompt({ businessType: context.businessType }),
          },
        ],
      },
      generationConfig: {
        temperature: 0.3,
      },
    };

    const response = await fetch(`${GEMINI_URL}?key=${env.geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn("geminiService", "Falha HTTP Gemini", { status: response.status });
      return handleFallback();
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = safeJsonParse(text);

    if (!validatePayload(parsed)) {
      logger.warn("geminiService", "Retorno Gemini invalido");
      return handleFallback();
    }

    return {
      intent: parsed.intent || "unknown",
      service: parsed.service || null,
      date: parsed.date || null,
      name: parsed.name || null,
      response: parsed.response || handleFallback().response,
    };
  } catch (error) {
    logger.error("geminiService", "Erro na chamada Gemini", error.message);
    return handleFallback();
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  askGemini,
};
