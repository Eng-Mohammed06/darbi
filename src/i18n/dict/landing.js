import { arabicPluralForm } from '../../lib/arabicPlural.js';

export default {
  en: {
    navStudent: 'Student',
    navCompany: 'Company',
    navCareer: 'Graduate',
    title: 'Every student deserves to see the path before choosing it.',
    sub: "Darbi is an AI career guide for Jordanian engineering students — helping you explore majors, salaries, and jobs, all grounded in real, verified data.",
    pillars: [
      {
        title: 'Trusted Jordanian data',
        body: 'Every major, salary range, and job listing here is grounded in a real, verified source — from university admission data, through the salary ladder, to verified job postings. We never guess, and when the data has a gap, we say so plainly instead of filling it in with an inaccurate number.',
      },
      {
        title: 'Your advisor, in conversation',
        body: "Darbi's advisor is a conversation, not just a form. Tell it what you enjoy or what you're unsure about, and it builds every answer on verified data — with the sources attached, so you can check them yourself.",
      },
      {
        title: 'From major to job, in clear steps',
        body: 'Every pathway connects your major to the universities that teach it, the courses that build the skills you need, and the real job listings waiting at the other end — one clear path with Darbi, instead of getting lost in scattered numbers and information.',
      },
    ],
    statsLabels: {
      majors: (n) => (n === 1 ? 'major' : 'majors'),
      courses: (n) => (n === 1 ? 'verified course' : 'verified courses'),
      jobs: (n) => (n === 1 ? 'verified job listing' : 'verified job listings'),
      trailing: 'every figure traced to a source.',
    },
    panelEyebrow: 'Career advice you can check',
    msgWho: 'Darbi advisor',
    sourcesLabel: 'Sources for this answer',
    loading: 'loading…',
    themeLabel: 'Change theme',
    joinTitle: 'Join Us!',
    joinStudentDesc: 'For high school and university students planning their academic and career future. Tell Darbi what you love and aspire to, and it will help you discover the majors and jobs that suit you, based on real Jordanian data.',
    joinGraduateDesc: 'For graduates and working professionals planning their next career step. Get AI-powered career guidance, a skills-gap assessment, and opportunities to help you grow your career path.',
    joinCompanyDesc: 'For employers looking for the right talent. Post your jobs and set your requirements for major, GPA, and skills, to reach the best-fit candidates quickly and efficiently.',
    joinCta: 'Get started',
  },
  ar: {
    navStudent: 'طالب',
    navCompany: 'شركة',
    navCareer: 'خريج',
    title: 'يستحق كل طالب رؤية الطريق قبل اختياره.',
    sub: 'دربي مرشد مهني ذكي لطلاب الهندسة في الأردن، يساعدك على استكشاف التخصصات والرواتب والوظائف، استنادًا إلى بيانات حقيقية وموثّقة.',
    pillars: [
      {
        title: 'بيانات أردنية موثوقة',
        body: 'كل تخصص، ونطاق راتب، وإعلان وظيفة هنا يستند إلى مصدر حقيقي وموثوق، بدءًا من بيانات القبول الجامعي مرورًا بسُلّم الرواتب، وصولًا إلى إعلانات الوظائف الموثوقة. لا نقدّم تخمينات، وعند وجود نقص في البيانات نوضحه بصراحة بدلًا من تعويضه بأرقام غير دقيقة.',
      },
      {
        title: 'مستشارك يحادثك',
        body: 'مستشار دربي تجربة حوارية، وليس مجرد استمارة. أخبره بما تحب أو بما تتردد بشأنه، وسيبني كل إجابة على بيانات موثوقة، مع إرفاق المصادر لتتمكن من التحقق منها بنفسك.',
      },
      {
        title: 'من التخصص إلى الوظيفة بخطوات واضحة',
        body: 'يربط كل مسار تخصصك بالجامعات التي تدرّسه، والمقررات التي تساعدك على بناء المهارات المطلوبة، وصولًا إلى إعلانات الوظائف الحقيقية في نهاية الطريق، مسار واضح واحد مع دربي، بدلًا من التشتت بين الأرقام والمعلومات.',
      },
    ],
    statsLabels: {
      majors: (n) => arabicPluralForm(n, { zero: 'تخصصات', one: 'تخصص', two: 'تخصصان', few: 'تخصصات', many: 'تخصصًا' }),
      courses: (n) => arabicPluralForm(n, { zero: 'مقررات موثقة', one: 'مقرر موثق', two: 'مقرران موثقان', few: 'مقررات موثقة', many: 'مقررًا موثقًا' }),
      jobs: (n) => arabicPluralForm(n, { zero: 'وظائف موثقة', one: 'وظيفة موثقة', two: 'وظيفتان موثقتان', few: 'وظائف موثقة', many: 'وظيفة موثقة' }),
      trailing: 'كل رقم هنا موثّق بمصدر.',
    },
    panelEyebrow: 'إرشاد مهني يمكنك التحقق منه',
    msgWho: 'مستشار دربي',
    sourcesLabel: 'مصادر هذه الإجابة',
    loading: 'جارٍ التحميل…',
    themeLabel: 'تغيير المظهر',
    joinTitle: 'انضم إلينا!',
    joinStudentDesc: 'لطلاب الثانوية والجامعات الذين يخططون لمستقبلهم الأكاديمي والمهني. أخبر دربي بما تحبه وما تطمح إليه، وسيساعدك على اكتشاف التخصصات والوظائف المناسبة لك، استنادًا إلى بيانات أردنية حقيقية.',
    joinGraduateDesc: 'للخريجين والمهنيين العاملين الذين يخططون لخطوتهم المهنية القادمة. احصل على إرشاد مهني مدعوم بالذكاء الاصطناعي، وتقييم لفجوات المهارات، وفرص تساعدك على تطوير مسارك المهني.',
    joinCompanyDesc: 'لأصحاب العمل الباحثين عن الكفاءات المناسبة. انشر وظائفك وحدد متطلباتك من حيث التخصص والمعدل والمهارات، للوصول إلى المرشحين الأنسب بسرعة وكفاءة.',
    joinCta: 'ابدأ الآن',
  },
};
