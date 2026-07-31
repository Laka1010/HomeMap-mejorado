/**
 * photoUtils.js
 * Utilities for handling photos in Haven
 */

// File type validation
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

// NOTE: getPhotoError returns an i18n key path (not translated text) because
// this module has no access to the React i18n context. Callers must run the
// result through t() before showing it, e.g. `setError(t(getPhotoError(file)))`.
export function getPhotoError(file) {
  if (!file) return null;
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return 'errors.unsupportedFormat';
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return 'errors.imageTooLarge';
  }
  return null;
}

/**
 * Convert file to base64 data URL
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('errors.imageReadError'));
    reader.readAsDataURL(file);
  });
}

const COMPRESS_MAX_DIMENSION = 1600;
const COMPRESS_JPEG_QUALITY = 0.82;

/**
 * Redimensiona (lado más largo a COMPRESS_MAX_DIMENSION) y recomprime una
 * foto como JPEG antes de subirla a Storage — evita acumular fotos a
 * resolución de cámara completa cuando un objeto/habitación/caja puede
 * tener varias. Devuelve un Blob, listo para `storage.upload`.
 */
export function compressImage(file, { maxDimension = COMPRESS_MAX_DIMENSION, quality = COMPRESS_JPEG_QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('errors.imageReadError'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('errors.imageReadError'));
    };
    img.src = objectUrl;
  });
}
