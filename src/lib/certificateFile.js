/** Mirrors the check server/routes/career.js actually enforces (4MB, PDF/PNG/JPEG). */
export const CERTIFICATE_FILE_MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

const MSG = {
  en: {
    badType: 'Please choose a .pdf, .png, or .jpg file.',
    tooBig: 'File must be 4MB or smaller.',
    readError: 'Could not read that file.',
  },
  ar: {
    badType: 'الرجاء اختيار ملف بصيغة .pdf أو .png أو .jpg.',
    tooBig: 'يجب ألا يتجاوز حجم الملف 4 ميجابايت.',
    readError: 'تعذّرت قراءة هذا الملف.',
  },
};

export class CertificateFileError extends Error {}

/** Reads a File into a data: URI after validating type and size client-side. */
export function readCertificateFile(file, lang = 'en') {
  const d = MSG[lang] ?? MSG.en;
  return new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      reject(new CertificateFileError(d.badType));
      return;
    }
    if (file.size > CERTIFICATE_FILE_MAX_BYTES) {
      reject(new CertificateFileError(d.tooBig));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new CertificateFileError(d.readError));
    reader.readAsDataURL(file);
  });
}
