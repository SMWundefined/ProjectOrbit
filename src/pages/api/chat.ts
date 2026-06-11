// AI chat endpoint: terminal -> RAG retrieval (Python sidecar) -> LLM.
// Generation uses Groq when GROQ_API_KEY is set, otherwise falls back to
// local Ollama so dev works without a key.
//
// POST { query: string, sessionId: string }
// Responds with a streamed text/plain body. The X-Orbit-Route header says
// how the answer was produced: "rag" (LLM with context), "fallback"
// (similarity below threshold), or "error" (friendly failure message).
// X-Orbit-Provider names the LLM backend that answered: "groq" | "ollama".

import type { APIRoute } from 'astro';
import Groq from 'groq-sdk';

export const prerender = false;

const RAG_SERVER_URL = import.meta.env.RAG_SERVER_URL ?? 'http://127.0.0.1:8001';
const GROQ_API_KEY = import.meta.env.GROQ_API_KEY ?? '';
const GROQ_MODEL = import.meta.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const OLLAMA_HOST = import.meta.env.OLLAMA_HOST ?? 'http://localhost:11434';
const OLLAMA_MODEL = import.meta.env.OLLAMA_MODEL || 'llama3.1:latest';

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const MIN_SIMILARITY = Number(import.meta.env.RAG_MIN_SIMILARITY ?? 0.32);
const GITHUB_URL = import.meta.env.PUBLIC_GITHUB_URL ?? '';
const LINKEDIN_URL = import.meta.env.PUBLIC_LINKEDIN_URL ?? '';
const OWNER = import.meta.env.PUBLIC_TERMINAL_USER ?? 'the portfolio owner';

const TOP_K = 5;
const MAX_QUERY_LENGTH = 500;

interface RetrievedChunk {
  text: string;
  score: number;
  metadata: { section: string; file: string; type: string; source: string };
}

// --- Session-scoped retrieval cache -----------------------------------
// Repeating a query within a session skips the embed + search round trip.

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 100;
const MAX_QUERIES_PER_SESSION = 30;

interface SessionEntry {
  touchedAt: number;
  queries: Map<string, RetrievedChunk[]>;
}

const sessions = new Map<string, SessionEntry>();

function sessionFor(sessionId: string): SessionEntry {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.touchedAt > SESSION_TTL_MS) sessions.delete(id);
  }
  let entry = sessions.get(sessionId);
  if (!entry) {
    if (sessions.size >= MAX_SESSIONS) {
      const oldest = [...sessions.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
      if (oldest) sessions.delete(oldest[0]);
    }
    entry = { touchedAt: now, queries: new Map() };
    sessions.set(sessionId, entry);
  }
  entry.touchedAt = now;
  return entry;
}

// --- Fallback when retrieval has nothing relevant ----------------------

const TECH_RE =
  /\b(code|coding|program|python|java|typescript|javascript|kubernetes|docker|aws|gcp|cloud|terraform|devops|sre|api|database|sql|git|github|repo|project|deploy|infra|linux|server|software|engineer|stack|framework)\w*\b/i;

function fallbackMessage(query: string): string {
  const technical = TECH_RE.test(query);
  const lines = [
    `I don't have enough in my notes to answer that well.`,
  ];
  if (technical && GITHUB_URL) {
    lines.push(`For code and technical work, ${OWNER}'s GitHub is the best source: ${GITHUB_URL}`);
  } else if (LINKEDIN_URL) {
    lines.push(`For background and personal questions, try ${OWNER}'s LinkedIn: ${LINKEDIN_URL}`);
  } else if (GITHUB_URL) {
    lines.push(`You can find more here: ${GITHUB_URL}`);
  }
  lines.push(`Or ask me something else about ${OWNER}'s experience, projects, or interests.`);
  return lines.join('\n');
}

// --- Helpers ------------------------------------------------------------

function textResponse(body: string, status: number, route: 'fallback' | 'error'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Orbit-Route': route },
  });
}

async function retrieve(query: string): Promise<RetrievedChunk[]> {
  const response = await fetch(`${RAG_SERVER_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, k: TOP_K }),
  });
  if (!response.ok) throw new Error(`RAG server responded ${response.status}`);
  const payload = (await response.json()) as { results: RetrievedChunk[] };
  return payload.results ?? [];
}

function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((chunk, i) => `[${i + 1}] (${chunk.metadata.section})\n${chunk.text}`)
    .join('\n\n');
  return [
    `You are the AI assistant inside ${OWNER}'s terminal portfolio website.`,
    `Answer questions about ${OWNER} using ONLY the context below.`,
    `Be concise: two to five sentences, plain text, no markdown headers.`,
    `Speak about ${OWNER} in the third person, warmly and factually.`,
    `If the context does not contain the answer, say so honestly and suggest asking something else.`,
    ``,
    `Context:`,
    context,
  ].join('\n');
}

const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Orbit-Route': 'rag',
  'Cache-Control': 'no-store',
} as const;

// Groq SDK yields chunk objects; re-emit just the token text.
function groqTextStream(
  stream: AsyncIterable<{ choices: Array<{ delta?: { content?: string | null } }> }>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content;
          if (token) controller.enqueue(encoder.encode(token));
        }
      } catch {
        controller.enqueue(encoder.encode('\n[stream interrupted]'));
      } finally {
        controller.close();
      }
    },
  });
}

async function generateWithGroq(systemPrompt: string, query: string): Promise<Response> {
  try {
    const stream = await groq!.chat.completions.create({
      model: GROQ_MODEL,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
    });
    return new Response(groqTextStream(stream), {
      status: 200,
      headers: { ...STREAM_HEADERS, 'X-Orbit-Provider': 'groq' },
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    const hint =
      status === 401
        ? 'The Groq API key was rejected. Check GROQ_API_KEY in .env.'
        : status === 403
          ? 'Groq denied access from this network (VPN or region block). Check your connection.'
          : status === 429
            ? 'The AI is rate limited right now. Try again in a moment.'
            : 'The AI service returned an error. Try again in a moment.';
    return textResponse(hint, 503, 'error');
  }
}

// Ollama streams NDJSON; re-emit just the token text as a plain stream.
function ollamaTextStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
            const token = parsed.message?.content;
            if (token) controller.enqueue(encoder.encode(token));
          }
        }
      } catch {
        controller.enqueue(encoder.encode('\n[stream interrupted]'));
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

// --- Route --------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  let query: string;
  let sessionId: string;
  try {
    const body = (await request.json()) as { query?: unknown; sessionId?: unknown };
    query = String(body.query ?? '').trim();
    sessionId = String(body.sessionId ?? '').trim();
  } catch {
    return textResponse('Invalid request body.', 400, 'error');
  }

  if (!query || !sessionId) {
    return textResponse('Both query and sessionId are required.', 400, 'error');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return textResponse(`Keep questions under ${MAX_QUERY_LENGTH} characters.`, 400, 'error');
  }

  // Retrieval, with the session cache short-circuiting repeats.
  const session = sessionFor(sessionId);
  const cacheKey = query.toLowerCase();
  let chunks = session.queries.get(cacheKey);
  if (!chunks) {
    try {
      chunks = await retrieve(query);
    } catch {
      return textResponse(
        'The retrieval service is offline. Start it with: python scripts/rag_server.py',
        503,
        'error'
      );
    }
    if (session.queries.size >= MAX_QUERIES_PER_SESSION) {
      const oldestKey = session.queries.keys().next().value;
      if (oldestKey !== undefined) session.queries.delete(oldestKey);
    }
    session.queries.set(cacheKey, chunks);
  }

  const bestScore = chunks[0]?.score ?? 0;
  if (chunks.length === 0 || bestScore < MIN_SIMILARITY) {
    return textResponse(fallbackMessage(query), 200, 'fallback');
  }

  // Generation: Groq when a key is configured, local Ollama otherwise.
  const systemPrompt = buildSystemPrompt(chunks);
  if (groq) return generateWithGroq(systemPrompt, query);
  return generateWithOllama(systemPrompt, query);
};

async function generateWithOllama(systemPrompt: string, query: string): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    });
  } catch {
    return textResponse(
      `The AI model is offline. Start Ollama and make sure '${OLLAMA_MODEL}' is pulled.`,
      503,
      'error'
    );
  }

  if (!upstream.ok || !upstream.body) {
    const hint =
      upstream.status === 404
        ? `Model '${OLLAMA_MODEL}' is not available. Run: ollama pull ${OLLAMA_MODEL}`
        : `The AI model returned an error (${upstream.status}). Try again in a moment.`;
    return textResponse(hint, 503, 'error');
  }

  return new Response(ollamaTextStream(upstream.body), {
    status: 200,
    headers: { ...STREAM_HEADERS, 'X-Orbit-Provider': 'ollama' },
  });
}
