// Language metadata is shared by preferences and UI; never inferred from country.
export const LANGUAGES = [
  { code: 'en', name: 'English', key: 'langEnglish', description: 'langEnglishDesc' },
  { code: 'th', name: 'ไทย', key: 'langThai', description: 'langThaiDesc' },
  { code: 'zh', name: '简体中文', key: 'langChinese', description: 'langChineseDesc' },
  { code: 'ru', name: 'Русский', key: 'langRussian', description: 'langRussianDesc' },
  { code: 'es', name: 'Español', key: 'langSpanish', description: 'langSpanishDesc' },
  { code: 'de', name: 'Deutsch', key: 'langGerman', description: 'langGermanDesc' },
  { code: 'ar', name: 'العربية (نسخة تجريبية)', key: 'langArabic', description: 'langArabicDesc', experimental: true }
];
export const LANGUAGE_CODES = LANGUAGES.map(item => item.code);
export const languageDirection = language => language === 'ar' ? 'rtl' : 'ltr';
export const languageLocale = language => ({en:'en-US',th:'th-TH',zh:'zh-CN',ru:'ru-RU',ar:'ar',es:'es',de:'de-DE'}[language] || 'en-US');
export const applyLanguageToDom = language => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dir = languageDirection(language);
};
