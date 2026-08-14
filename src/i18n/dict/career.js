// CareerDashboard — the graduate/professional portal (Overview, Learning
// Paths, Training Centres tabs). Tab labels themselves live in
// common.js's `tabs` map; this namespace covers everything on the page body.
export default {
  en: {
    welcome: (name) => `Welcome, ${name} 📈`,
    namePlaceholder: 'there',
    currentRole: 'Current role',
    notSet: 'Not set',
    experience: 'Experience',
    yearsExperience: (years) => `${years} years`,
    field: 'Field',
    noLearningPaths: 'No learning paths loaded yet.',
    inJordan: 'In Jordan: ',
    loadingCentres: 'Loading training centres…',
    centresCount: (count) => `${count} accredited centre(s) in Jordan`,
    noCentres: 'No training centres loaded yet.',
  },
  ar: {
    welcome: (name) => `مرحبًا، ${name} 📈`,
    namePlaceholder: 'زائر',
    currentRole: 'المنصب الحالي',
    notSet: 'غير محدد',
    experience: 'الخبرة',
    yearsExperience: (years) => `${years} سنة`,
    field: 'المجال',
    noLearningPaths: 'لا توجد مسارات تعلّم متاحة بعد.',
    inJordan: 'في الأردن: ',
    loadingCentres: 'جارٍ تحميل مراكز التدريب…',
    centresCount: (count) => `${count} مركز معتمد في الأردن`,
    noCentres: 'لا توجد مراكز تدريب متاحة بعد.',
  },
};
