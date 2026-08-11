import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Alert, Button } from '../components/common/ui.jsx';

/**
 * One-time, post-signup questionnaire. Answers are analyzed by Claude into a
 * structured profile (server/lib/onboarding.js) that the chat advisor reads
 * on every turn afterward — see server/lib/chat.js's `analysisBlock`.
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
        <Button onClick={() => navigate('/dashboard')}>Continue to dashboard</Button>
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
      navigate('/dashboard');
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
      <h1 className="text-xl font-bold text-darbi-navy mt-2 mb-5">{q.question}</h1>

      <Alert>{error}</Alert>

      <textarea
        className="darbi-input"
        rows={4}
        value={value}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={q.required ? 'Type your answer…' : 'Optional — leave blank if none'}
        disabled={analyzing}
        autoFocus
      />

      <div className="flex items-center justify-center gap-3 mt-5">
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
        onClick={() => navigate('/dashboard')}
        disabled={analyzing}
        className="text-xs text-gray-500 mt-6 underline block"
      >
        Skip for now
      </button>
    </Centered>
  );
}

function Centered({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #001a33 0%, #0a2647 100%)' }}
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">{children}</div>
    </div>
  );
}
