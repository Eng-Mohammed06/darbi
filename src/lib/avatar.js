/** Mirrors the check server/routes/auth.js actually enforces (2MB, PNG/JPEG). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg'];

export class AvatarFileError extends Error {}

/** Reads a File into a data: URI after validating type and size client-side. */
export function readAvatarFile(file) {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      reject(new AvatarFileError('Please choose a .png or .jpg image.'));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      reject(new AvatarFileError('Image must be 2MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new AvatarFileError('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
