// OnboardingPage — the one-time, post-signup questionnaire whose answers are
// analyzed into a structured profile the chat advisor reads on every turn.
// Question text and suggested-answer options themselves come from the API
// (server/lib/onboarding.js) and are NOT translated here — only the
// surrounding interface chrome (progress label, buttons, hints, errors).
export default {
  en: {
    questionProgress: (current, total) => `Question ${current} of ${total}`,
    pickSuggested: 'Pick a suggested answer',
    chooseOne: 'Choose one…',
    orWriteOwn: 'Or write your own',
    yourAnswer: 'Your answer',
    answerPlaceholderRequired: 'Type your answer…',
    answerPlaceholderOptional: 'Optional — leave blank if none',
    back: 'Back',
    analyzing: 'Analyzing your answers…',
    finish: 'Finish',
    next: 'Next',
    skipForNow: 'Skip for now',
    loadError: 'Could not load the onboarding questions.',
    continueToDashboard: 'Continue to dashboard',
    requiredHint: 'This one helps the advisor a lot — a sentence or two is enough.',
    saveError: 'Could not save your answers. You can try again, or skip for now.',
  },
  ar: {
    questionProgress: (current, total) => `السؤال ${current} من ${total}`,
    pickSuggested: 'اختر إجابة مقترحة',
    chooseOne: 'اختر واحدة…',
    orWriteOwn: 'أو اكتب إجابتك الخاصة',
    yourAnswer: 'إجابتك',
    answerPlaceholderRequired: 'اكتب إجابتك…',
    answerPlaceholderOptional: 'اختياري — اتركه فارغًا إن لم يكن لديك إجابة',
    back: 'رجوع',
    analyzing: 'جارٍ تحليل إجاباتك…',
    finish: 'إنهاء',
    next: 'التالي',
    skipForNow: 'تخطَّ الآن',
    loadError: 'تعذّر تحميل أسئلة التهيئة.',
    continueToDashboard: 'المتابعة إلى لوحة التحكم',
    requiredHint: 'هذا السؤال يساعد المستشار كثيرًا — تكفي جملة أو جملتان.',
    saveError: 'تعذّر حفظ إجاباتك. يمكنك المحاولة مجددًا، أو التخطي الآن.',
  },
};
