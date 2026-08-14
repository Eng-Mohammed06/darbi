import { useEffect, useRef, useState } from 'react';
import { api, getToken } from '../../services/api.js';
import { Alert, Button, Skeleton } from '../common/ui.jsx';
import { useLang } from '../../i18n/index.jsx';

// After a couple of real exchanges, nudge toward Recommendations — chat is
// the front door, but it shouldn't be the only door a student ever finds.
const BRIDGE_AFTER_MESSAGES = 4;

export default function ChatAdvisor({ student, onFallback }) {
  const { t } = useLang();
  const OPENERS = t('student.chat.openers');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  // Without this, a returning user with real chat history briefly saw the
  // "what's on your mind?" opener screen every load, as if history was lost,
  // until GET /chat resolved.
  const [loadingHistory, setLoadingHistory] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    api('/chat')
      .then((r) => {
        setMessages(r.messages);
        setConfigured(r.configured);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingHistory(false));
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
        {t('student.chat.notConfiguredPrefix')}<code>ANTHROPIC_API_KEY</code>{t('student.chat.notConfiguredSuffix')}{' '}
        {onFallback && (
          <button onClick={onFallback} className="underline font-semibold">
            {t('student.chat.seeRecommendationsInstead')}
          </button>
        )}{' '}
        {t('student.chat.notConfiguredFooter')}
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
          <h2 className="font-bold text-darbi-navy">{t('student.chat.title')}</h2>
          <p className="text-xs text-gray-500">
            {t('student.chat.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {onFallback && messages.length >= BRIDGE_AFTER_MESSAGES && (
            <button
              onClick={onFallback}
              className="text-xs font-bold px-2.5 py-1 rounded-full transition hover:brightness-110"
              style={{
                background: 'color-mix(in srgb, var(--darbi-purple) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--darbi-purple) 35%, transparent)',
                color: 'var(--darbi-purple)',
              }}
            >
              {t('student.chat.seeRecommendations')}
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300">
              {t('student.chat.startOver')}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loadingHistory && (
          <div>
            <div className="flex justify-start mb-3"><Skeleton style={{ height: 40, width: '55%', borderRadius: 16 }} /></div>
            <div className="flex justify-end mb-3"><Skeleton style={{ height: 40, width: '40%', borderRadius: 16 }} /></div>
            <div className="flex justify-start mb-3"><Skeleton style={{ height: 40, width: '65%', borderRadius: 16 }} /></div>
          </div>
        )}

        {!loadingHistory && messages.length === 0 && !streaming && (
          <div className="text-center mt-6">
            <div className="text-4xl mb-3">🎓</div>
            <p className="text-gray-200 font-medium mb-1">
              {t('student.chat.greeting')(student?.name?.split(' ')[0] ?? t('student.chat.greetingNameFallback'))}
            </p>
            <p className="text-sm text-gray-500 mb-5">
              {t('student.chat.greetingBody')}
            </p>
            <div className="flex flex-col gap-2 items-center">
              {openers.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  className="text-sm text-left text-gray-200 px-4 py-2 rounded-full border border-white/10 hover:border-[var(--darbi-purple)] hover:bg-white/5 transition max-w-md w-full"
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
                  {t('student.chat.seeRecommendationsInstead')}
                </button>
                {t('student.chat.noAiFallbackFooter')}
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
          placeholder={t('student.chat.inputPlaceholder')}
          disabled={busy}
          className="darbi-input flex-1"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          {busy ? t('student.chat.sending') : t('student.chat.send')}
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
