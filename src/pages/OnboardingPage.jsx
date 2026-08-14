import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Alert, Button, CenteredCard } from '../components/common/ui.jsx';
import { useLang } from '../i18n/index.jsx';

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
  const { t } = useLang();

  const [questions, setQuestions] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    api('/students/me/onboarding-questions')
      .then((res) => setQuestions(res.questions))
      .catch(() => setError(t('onboarding.loadError')));
  }, []);

  if (error && !questions) {
    return (
      <CenteredCard>
        <Alert>{error}</Alert>
        <Button onClick={() => navigate('/')}>{t('onboarding.continueToDashboard')}</Button>
      </CenteredCard>
    );
  }

  if (!questions) {
    return (
      <CenteredCard>
        <p className="text-gray-500">{t('common.loading')}</p>
      </CenteredCard>
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
      setError(t('onboarding.requiredHint'));
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
      setError(t('onboarding.saveError'));
      setAnalyzing(false);
    }
  }

  return (
    <CenteredCard>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--darbi-gold)' }}>
        {t('onboarding.questionProgress')(step + 1, questions.length)}
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
            style={{ background: i <= step ? 'var(--darbi-gradient)' : 'color-mix(in srgb, var(--darbi-navy) 15%, transparent)' }}
          />
        ))}
      </div>

      <h1 className="text-lg font-bold text-darbi-navy mb-5 leading-snug">{q.question}</h1>

      <Alert>{error}</Alert>

      <div className="space-y-4">
        {q.options?.length > 0 && (
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
              {t('onboarding.pickSuggested')}
            </span>
            <select
              className="darbi-input"
              value=""
              onChange={(e) => {
                if (e.target.value) setAnswer(e.target.value);
              }}
              disabled={analyzing}
            >
              <option value="">{t('onboarding.chooseOne')}</option>
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
            {q.options?.length > 0 ? t('onboarding.orWriteOwn') : t('onboarding.yourAnswer')}
          </span>
          <textarea
            className="darbi-input"
            rows={4}
            value={value}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={q.required ? t('onboarding.answerPlaceholderRequired') : t('onboarding.answerPlaceholderOptional')}
            disabled={analyzing}
            autoFocus
          />
        </label>
      </div>

      <div className="flex items-center justify-center gap-3 mt-6">
        {step > 0 && (
          <Button variant="navy" onClick={back} disabled={analyzing}>
            {t('onboarding.back')}
          </Button>
        )}
        <Button onClick={next} disabled={analyzing}>
          {analyzing ? t('onboarding.analyzing') : isLast ? t('onboarding.finish') : t('onboarding.next')}
        </Button>
      </div>

      <button
        onClick={() => navigate('/')}
        disabled={analyzing}
        className="text-xs text-gray-500 mt-6 underline block mx-auto"
      >
        {t('onboarding.skipForNow')}
      </button>
    </CenteredCard>
  );
}
