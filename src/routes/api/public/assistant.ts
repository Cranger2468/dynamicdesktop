import { createFileRoute } from '@tanstack/react-router';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/responses';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM = `You are Island, a tiny desktop companion assistant. The user asks short questions or gives commands.
You receive live system status as JSON. Answer briefly (one or two short sentences, plain text).
If the user wants an action, map it to exactly one of these commands:
- setVolume (value 0-100), setBrightness (value 0-100), play, pause, next, previous, startTimer (value = minutes), showBattery, showMedia, showAssistant
- none (for pure questions)
Respond ONLY with JSON matching the schema.`;

export const Route = createFileRoute('/api/public/assistant')({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { headers: cors }),
      POST: async ({ request }) => {
        let body: { question?: string; status?: unknown; mode?: string; text?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid request body.' }, { status: 400, headers: cors });
        }
        const fix = body.mode === 'fix';
        const question = String(body.question ?? '').slice(0, 500);
        const fixText = String(body.text ?? '').slice(0, 4000);
        if (!question || (fix && !fixText)) return Response.json({ error: 'Ask something first.' }, { status: 400, headers: cors });

        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return Response.json({ error: 'Assistant is not configured.' }, { status: 500, headers: cors });

        const res = await fetch(GATEWAY, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-Lovable-AIG-SDK': 'fetch',
          },
          body: JSON.stringify({
            model: 'openai/gpt-6-astra',
            instructions: fix ? 'You transform text. Apply the requested instruction to the text and put ONLY the resulting text in "reply" (no preamble). Set action to "none" and value to null.' : SYSTEM,
            input: fix ? `Instruction: ${question}\n\nText:\n${fixText}` : `Status: ${JSON.stringify(body.status ?? {})}\nQuestion: ${question}`,
            reasoning: { effort: 'low' },
            store: false,
            stream: true,
            text: {
              format: {
                type: 'json_schema',
                name: 'island_reply',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    reply: { type: 'string' },
                    action: { type: 'string', enum: ['setVolume', 'setBrightness', 'play', 'pause', 'next', 'previous', 'startTimer', 'showBattery', 'showMedia', 'showAssistant', 'none'] },
                    value: { type: ['number', 'null'] },
                  },
                  required: ['reply', 'action', 'value'],
                  additionalProperties: false,
                },
              },
            },
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => '');
          console.error(`Assistant gateway failed [${res.status}]: ${detail}`);
          return Response.json({ error: 'The assistant is unavailable right now.' }, { status: res.status === 429 ? 429 : 502, headers: cors });
        }

        // Consume the SSE stream server-side and return the accumulated JSON text.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let text = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const line = frame.split('\n').find(l => l.startsWith('data:'));
            if (!line) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const event = JSON.parse(data);
              if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') text += event.delta;
            } catch { /* ignore partial frames */ }
          }
        }

        try {
          const parsed = JSON.parse(text);
          return Response.json({ reply: String(parsed.reply ?? ''), action: String(parsed.action ?? 'none'), value: typeof parsed.value === 'number' ? parsed.value : null }, { headers: cors });
        } catch {
          return Response.json({ reply: text || 'Sorry, I did not understand that.', action: 'none', value: null }, { headers: cors });
        }
      },
    },
  },
});
