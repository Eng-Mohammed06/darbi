/** Mirrors the check server/routes/career.js actually enforces (4MB, PDF only). */
export const CV_MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPE = 'application/pdf';

const MSG = {
  en: {
    badType: 'Please choose a .pdf file.',
    tooBig: 'File must be 4MB or smaller.',
    readError: 'Could not read that file.',
  },
  ar: {
    badType: 'الرجاء اختيار ملف بصيغة .pdf.',
    tooBig: 'يجب ألا يتجاوز حجم الملف 4 ميجابايت.',
    readError: 'تعذّرت قراءة هذا الملف.',
  },
};

export class CvFileError extends Error {}

/** Reads a File into a data: URI after validating type and size client-side. */
export function readCvFile(file, lang = 'en') {
  const d = MSG[lang] ?? MSG.en;
  return new Promise((resolve, reject) => {
    if (file.type !== ALLOWED_TYPE) {
      reject(new CvFileError(d.badType));
      return;
    }
    if (file.size > CV_MAX_BYTES) {
      reject(new CvFileError(d.tooBig));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new CvFileError(d.readError));
    reader.readAsDataURL(file);
  });
}
