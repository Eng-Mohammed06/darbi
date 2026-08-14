/** Mirrors the check server/routes/auth.js actually enforces (2MB, PNG/JPEG). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg'];

const MSG = {
  en: {
    badType: 'Please choose a .png or .jpg image.',
    tooBig: 'Image must be 2MB or smaller.',
    readError: 'Could not read that file.',
  },
  ar: {
    badType: 'الرجاء اختيار صورة بصيغة .png أو .jpg.',
    tooBig: 'يجب ألا يتجاوز حجم الصورة 2 ميجابايت.',
    readError: 'تعذّرت قراءة هذا الملف.',
  },
};

export class AvatarFileError extends Error {}

/** Reads a File into a data: URI after validating type and size client-side. */
export function readAvatarFile(file, lang = 'en') {
  const d = MSG[lang] ?? MSG.en;
  return new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      reject(new AvatarFileError(d.badType));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      reject(new AvatarFileError(d.tooBig));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new AvatarFileError(d.readError));
    reader.readAsDataURL(file);
  });
}
