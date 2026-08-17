/**
 * Interest chips (a student's `interests` array) are effectively free text —
 * ProfileSetupPage.jsx offers a fixed list as a dropdown, but older rows and
 * anything the chat advisor writes can hold values outside that list (real
 * examples seen on production cards: "Physics", "Math", "Software"). A
 * locale key can't translate a free-text value, so this is a lookup table
 * instead: known English values -> Arabic display label. Anything not in
 * the table renders as-is (English) rather than guessing a translation —
 * matching the rest of this app's "never invent a data point" rule.
 */
const AR_BY_EN = {
  'Software Development': 'تطوير البرمجيات',
  'Web Development': 'تطوير الويب',
  'Mobile App Development': 'تطوير تطبيقات الجوال',
  'Artificial Intelligence & Machine Learning': 'الذكاء الاصطناعي وتعلّم الآلة',
  'Data Science & Analytics': 'علم البيانات والتحليلات',
  Cybersecurity: 'الأمن السيبراني',
  'Cloud Computing': 'الحوسبة السحابية',
  'Computer Networks': 'شبكات الحاسوب',
  'Game Development': 'تطوير الألعاب',
  'UI/UX Design': 'تصميم واجهات وتجربة المستخدم',
  Robotics: 'الروبوتات',
  'Embedded Systems & IoT': 'الأنظمة المدمجة وإنترنت الأشياء',
  Electronics: 'الإلكترونيات',
  Telecommunications: 'الاتصالات',
  'Renewable Energy': 'الطاقة المتجددة',
  'Power & Energy Systems': 'أنظمة الطاقة والقوى',
  'Mechanical Design': 'التصميم الميكانيكي',
  'Automotive Engineering': 'هندسة السيارات',
  'Aerospace Engineering': 'هندسة الطيران والفضاء',
  'Civil & Structural Engineering': 'الهندسة المدنية والإنشائية',
  'Construction & Project Management': 'إدارة الإنشاءات والمشاريع',
  'Architecture & Urban Planning': 'العمارة والتخطيط العمراني',
  'Biomedical Engineering': 'الهندسة الطبية الحيوية',
  'Chemical Engineering': 'الهندسة الكيميائية',
  'Environmental Engineering': 'الهندسة البيئية',
  'Industrial & Manufacturing Engineering': 'الهندسة الصناعية والتصنيع',
  'Materials Science': 'علم المواد',
  '3D Printing & Prototyping': 'الطباعة ثلاثية الأبعاد والنماذج الأولية',
  'Entrepreneurship & Startups': 'ريادة الأعمال والشركات الناشئة',
  'Finance & FinTech': 'التمويل والتكنولوجيا المالية',
  'Research & Academia': 'البحث العلمي والأكاديميا',
  Mathematics: 'الرياضيات',
  // Free-text values seen on real profiles, outside the fixed option list.
  'Data Science': 'علم البيانات',
  'Electrical Engineering': 'الهندسة الكهربائية',
  Physics: 'الفيزياء',
  Math: 'الرياضيات',
  Software: 'البرمجيات',
};

/** `lang !== 'ar'` (or no known translation) returns the value unchanged. */
export function interestLabel(value, lang) {
  if (lang !== 'ar') return value;
  return AR_BY_EN[value] ?? value;
}
