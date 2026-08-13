import { useEffect, useRef, useState } from 'react';
import { api, getToken } from '../../services/api.js';
import { Alert, Button } from '../common/ui.jsx';

/** Openers differ per journey — slide 4's "one flow, two journeys". */
const OPENERS = {
  highschool: [
    'I like maths but I don’t know what engineers actually do',
    'What should I study if I want to work with computers?',
    'My family wants me to do medicine. What are my options?',
  ],
  undergraduate: [
    'I’m halfway through my degree and having doubts',
    'What can I add on top of my major to be more employable?',
    'Which skills are Jordanian employers actually asking for?',
  ],
  graduate: [
    'I graduated but can’t find work in my field',
    'What certifications are worth doing in Jordan?',
    'How do I move into software from another engineering field?',
  ],
};

export default function ChatAdvisor({ student, onFallback }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    api('/chat')
      .then((r) => {
        setMessages(r.messages);
        setConfigured(r.configured);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Keep the newest text in view as it streams in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streaming]);

  async function send(text) {
    const message = (text ?? draft).trim();
    if (!message || busy) return;

    setDraft('');
    setError('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: message }]);

    let assembled = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }

      // NDJSON: one JSON object per line. A chunk can split mid-line, so keep
      // the remainder in `buffer` until its newline arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.error) throw new Error(event.error);
          if (event.delta) {
            assembled += event.delta;
            setStreaming(assembled);
          }
        }
      }

      setMessages((m) => [...m, { role: 'assistant', content: assembled }]);
    } catch (err) {
      setError(err.message);
      // Keep whatever streamed before the failure rather than losing it.
      if (assembled) setMessages((m) => [...m, { role: 'assistant', content: assembled }]);
    } finally {
      setStreaming('');
      setBusy(false);
    }
  }

  async function reset() {
    await api('/chat', { method: 'DELETE' });
    setMessages([]);
    setError('');
  }

  if (!configured) {
    return (
      <Alert kind="warn">
        The AI advisor is not configured on this server — <code>ANTHROPIC_API_KEY</code> is unset.{' '}
        {onFallback && (
          <button onClick={onFallback} className="underline font-semibold">
            See your recommendations instead
          </button>
        )}{' '}
        — those rank your interests against DARBI’s verified course and job data, no AI required.
      </Alert>
    );
  }

  const openers = OPENERS[student?.level] ?? OPENERS.undergraduate;

  return (
    <div
      className="flex flex-col overflow-hidden darbi-section"
      style={{
        height: '32rem',
        background: 'var(--darbi-surface)',
        border: '1px solid var(--darbi-border)',
        borderRadius: 'var(--darbi-radius)',
      }}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--darbi-border)' }}>
        <div>
          <h2 className="font-bold text-darbi-navy">Talk to Darbi</h2>
          <p className="text-xs text-gray-500">
            Grounded in DARBI’s verified Jordanian course and job data
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300">
            Start over
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !streaming && (
          <div className="text-center mt-6">
            <div className="text-4xl mb-3">🎓</div>
            <p className="text-gray-200 font-medium mb-1">
              Hi {student?.name?.split(' ')[0] ?? 'there'} — what’s on your mind?
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Tell me what you enjoy, or what you’re unsure about. No forms.
            </p>
            <div className="flex flex-col gap-2 items-center">
              {openers.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  className="text-sm text-left text-gray-200 px-4 py-2 rounded-full border border-white/10 hover:border-cyan-400 hover:bg-white/5 transition max-w-md w-full"
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.content} />
        ))}
        {streaming && <Bubble role="assistant" text={streaming} />}
        {busy && !streaming && <Bubble role="assistant" text="…" />}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="px-5 pb-2">
          <Alert>
            {error}
            {onFallback && (
              <>
                {' '}
                <button onClick={onFallback} className="underline font-semibold">
                  See your recommendations instead
                </button>
                {' — those work without the AI.'}
              </>
            )}
          </Alert>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="px-5 py-3 flex gap-3"
        style={{ borderTop: '1px solid var(--darbi-border)' }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message…"
          disabled={busy}
          className="darbi-input flex-1"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          {busy ? '…' : 'Send'}
        </Button>
      </form>
    </div>
  );
}

function Bubble({ role, text }) {
  const mine = role === 'user';
  return (
    <div className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl whitespace-pre-wrap ${
          mine ? 'text-white rounded-br-sm' : 'bg-white/10 text-gray-100 rounded-bl-sm'
        }`}
        style={mine ? { background: 'var(--darbi-gradient)' } : undefined}
      >
        {text}
      </div>
    </div>
  );
}
