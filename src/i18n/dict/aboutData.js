// AboutDataPage.jsx — the sources/methodology page. Every fact here mirrors
// CLAUDE.md's own description of the data pipeline; nothing is invented.
export default {
  en: {
    title: 'About the data',
    intro:
      "Darbi's catalog comes from four spreadsheets the team built and verified for this project, not from scraping or guesswork. Every major, salary band, university programme, and job listing traces back to one of them.",
    liveCounts: (majors, universities, courses, jobs) =>
      `Right now the catalog holds ${majors} majors, ${universities} universities, ${courses} courses, and ${jobs} job listings.`,
    sourcesTitle: 'The four source files',
    fileHeader: 'File',
    ownerHeader: 'Owner',
    givesHeader: 'Gives us',
    sources: [
      { file: 'salaries_data.xlsx', owner: 'Shadi', gives: 'Salary bands (entry / 3-year / 5-year) per major, top jobs, cited sources, and a self-graded confidence level' },
      { file: 'Universities_majors.xlsx', owner: 'Khaleel', gives: 'Universities, degree programmes, and Tawjihi admission averages' },
      { file: 'companies_jobs.xlsx', owner: 'Hussam', gives: 'Job listings from real Jordanian employers, plus fresh-graduate salary benchmarks' },
      { file: 'All Courses.xlsx', owner: 'Team', gives: 'Courses, career paths, training centres, and online learning platforms' },
    ],
    qualityTitle: 'How to read the numbers',
    qualityBody: "A few distinctions matter when checking a figure against its source:",
    qualityMinVsCompetitive: 'A university programme can show two different admission averages: the minimum to apply, and the competitive average — what the last admitted student actually scored. They answer different questions; a missing competitive average means it was never published, not that there is no bar.',
    qualityEstimate: 'A job listing marked "Est." is a market estimate, not a figure the employer published — Darbi never presents one as confirmed.',
    qualityNotStated: 'When a source spreadsheet left a field blank (a minimum GPA, for instance), Darbi leaves it blank too rather than filling in a guess.',
    qualityDataQuality: "Each major carries its own confidence grade (high / medium / low / pending) from the salary source file's own self-assessment.",
    disclosureTitle: 'What we don\'t claim',
    disclosureBody:
      "Darbi's advisor and recommendations are grounded entirely in this catalog — they cite courses, salaries, and job listings that exist in these files, and say so explicitly when a major has no salary band or a university hasn't published a competitive average, rather than inventing a plausible-sounding number.",
    dataUseNote: 'Account data (profile, applications, chat history) is used only to run the platform you signed up for — matching you to majors and jobs, and showing companies the applicants to their own postings.',
  },
  ar: {
    title: 'عن البيانات',
    intro:
      'يستند كتالوج دربي إلى أربعة ملفات جداول بيانات أعدّها الفريق ودقّقها لهذا المشروع، وليس إلى جمع آلي أو تخمين. كل تخصص، ونطاق راتب، وبرنامج جامعي، وإعلان وظيفة يعود إلى أحد هذه الملفات.',
    liveCounts: (majors, universities, courses, jobs) =>
      `يضمّ الكتالوج حاليًا ${majors} تخصصًا، و${universities} جامعات، و${courses} مقررًا، و${jobs} إعلان وظيفة.`,
    sourcesTitle: 'ملفات المصادر الأربعة',
    fileHeader: 'الملف',
    ownerHeader: 'المسؤول',
    givesHeader: 'يوفّر لنا',
    sources: [
      { file: 'salaries_data.xlsx', owner: 'شادي', gives: 'نطاقات الرواتب (بداية التعيين / 3 سنوات / 5 سنوات) لكل تخصص، وأبرز الوظائف، والمصادر المذكورة، ودرجة ثقة ذاتية التقييم' },
      { file: 'Universities_majors.xlsx', owner: 'خليل', gives: 'الجامعات، والبرامج الجامعية، ومعدلات القبول التوجيهية' },
      { file: 'companies_jobs.xlsx', owner: 'حسام', gives: 'إعلانات وظائف من أصحاب عمل أردنيين حقيقيين، إضافة إلى معايير رواتب حديثي التخرج' },
      { file: 'All Courses.xlsx', owner: 'الفريق', gives: 'المقررات، والمسارات المهنية، ومراكز التدريب، ومنصات التعلّم عبر الإنترنت' },
    ],
    qualityTitle: 'كيف تقرأ الأرقام',
    qualityBody: 'هناك بعض الفروق المهمة عند التحقق من رقم مقابل مصدره:',
    qualityMinVsCompetitive: 'قد يعرض البرنامج الجامعي معدلين مختلفين للقبول: الحد الأدنى للتقديم، والمعدل التنافسي — أي ما حصل عليه فعليًا آخر طالب تم قبوله. كل منهما يجيب عن سؤال مختلف؛ غياب المعدل التنافسي يعني أنه لم يُنشر بعد، وليس أنه لا يوجد حد أدنى.',
    qualityEstimate: 'إعلان الوظيفة المُعلَّم بـ "تقديري" هو تقدير للسوق، وليس رقمًا نشره صاحب العمل — لا يعرضه دربي أبدًا وكأنه مؤكد.',
    qualityNotStated: 'عندما يترك ملف المصدر حقلًا فارغًا (الحد الأدنى للمعدل التراكمي مثلًا)، يتركه دربي فارغًا أيضًا بدلًا من تخمين قيمة له.',
    qualityDataQuality: 'يحمل كل تخصص درجة ثقة خاصة به (عالية / متوسطة / منخفضة / قيد المراجعة) من التقييم الذاتي لملف مصدر الرواتب.',
    disclosureTitle: 'ما لا نزعمه',
    disclosureBody:
      'مستشار دربي وتوصياته مبنية بالكامل على هذا الكتالوج — فهو يستشهد بمقررات ورواتب وإعلانات وظائف موجودة فعليًا في هذه الملفات، ويصرّح بوضوح عندما لا يملك تخصص ما نطاق راتب أو لم تنشر جامعة معدلًا تنافسيًا، بدلًا من اختلاق رقم يبدو معقولًا.',
    dataUseNote: 'تُستخدم بيانات حسابك (الملف الشخصي، طلبات التقديم، سجل المحادثة) فقط لتشغيل المنصة التي سجّلت فيها — مطابقتك بالتخصصات والوظائف، وإظهار المتقدمين للشركات على إعلاناتها الخاصة.',
  },
};
