import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Alert, Button, Wisps } from '../components/common/ui.jsx';

/**
 * One-time, post-signup questionnaire. Answers are analyzed by Claude into a
 * structured profile (server/lib/onboarding.js) that the chat advisor reads
 * on every turn afterward — see server/lib/chat.js's `analysisBlock`.
 *
 * Each question ships a few suggested full-sentence answers (server/lib/
 * onboarding.js) as a dropdown shortcut — picking one fills the textarea,
 * which stays editable, since the analysis reads for nuance/"why" and a
 * bare category label would flatten that.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    api('/students/me/onboarding-questions')
      .then((res) => setQuestions(res.questions))
      .catch(() => setError('Could not load the onboarding questions.'));
  }, []);

  if (error && !questions) {
    return (
      <Centered>
        <Alert>{error}</Alert>
        <Button onClick={() => navigate('/')}>Continue to dashboard</Button>
      </Centered>
    );
  }

  if (!questions) {
    return (
      <Centered>
        <p className="text-gray-500">Loading…</p>
      </Centered>
    );
  }

  const q = questions[step];
  const isLast = step === questions.length - 1;
  const value = answers[q.id] ?? '';

  function setAnswer(text) {
    setAnswers({ ...answers, [q.id]: text });
  }

  function next() {
    if (q.required && !value.trim()) {
      setError('This one helps the advisor a lot — a sentence or two is enough.');
      return;
    }
    setError('');
    if (isLast) return submit();
    setStep(step + 1);
  }

  function back() {
    setError('');
    setStep(Math.max(0, step - 1));
  }

  async function submit() {
    setAnalyzing(true);
    setError('');
    try {
      await api('/students/me/onboarding', {
        method: 'POST',
        body: { answers: questions.map((qq) => ({ id: qq.id, answer: answers[qq.id] ?? '' })) },
      });
      navigate('/');
    } catch {
      setError('Could not save your answers. You can try again, or skip for now.');
      setAnalyzing(false);
    }
  }

  return (
    <Centered>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--darbi-gold)' }}>
        Question {step + 1} of {questions.length}
      </p>
      <div
        className="flex gap-1.5 mt-3 mb-5"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
      >
        {questions.map((_, i) => (
          <span
            key={i}
            className="flex-1 h-1.5 rounded-full transition-colors"
            style={{ background: i <= step ? 'var(--darbi-gradient)' : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>

      <h1 className="text-lg font-bold text-darbi-navy mb-5 leading-snug">{q.question}</h1>

      <Alert>{error}</Alert>

      <div className="space-y-4">
        {q.options?.length > 0 && (
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
              Pick a suggested answer
            </span>
            <select
              className="darbi-input"
              value=""
              onChange={(e) => {
                if (e.target.value) setAnswer(e.target.value);
              }}
              disabled={analyzing}
            >
              <option value="">Choose one…</option>
              {q.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.length > 70 ? `${opt.slice(0, 70)}…` : opt}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {q.options?.length > 0 ? 'Or write your own' : 'Your answer'}
          </span>
          <textarea
            className="darbi-input"
            rows={4}
            value={value}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={q.required ? 'Type your answer…' : 'Optional — leave blank if none'}
            disabled={analyzing}
            autoFocus
          />
        </label>
      </div>

      <div className="flex items-center justify-center gap-3 mt-6">
        {step > 0 && (
          <Button variant="navy" onClick={back} disabled={analyzing}>
            Back
          </Button>
        )}
        <Button onClick={next} disabled={analyzing}>
          {analyzing ? 'Analyzing your answers…' : isLast ? 'Finish' : 'Next'}
        </Button>
      </div>

      <button
        onClick={() => navigate('/')}
        disabled={analyzing}
        className="text-xs text-gray-500 mt-6 underline block mx-auto"
      >
        Skip for now
      </button>
    </Centered>
  );
}

function Centered({ children }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10"
      style={{ background: 'var(--darbi-bg)' }}
    >
      <Wisps palette={['#06b6d4', '#ff5722']} opacity={0.4} fixed />
      <div
        className="relative z-10 max-w-lg w-full text-center"
        style={{
          background: 'var(--darbi-surface)',
          border: '1px solid var(--darbi-border)',
          borderRadius: 'var(--darbi-radius)',
          boxShadow: '0 0 60px rgba(8,145,178,0.15)',
          padding: '2rem',
        }}
      >
        {children}
      </div>
    </div>
  );
}
