/**
 * @typedef {Object} CropRect
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * cropImageToFile (обрезка изображения через canvas)
 * @param {HTMLImageElement} image
 * @param {CropRect} rect
 * @param {string} fileName
 * @param {string} mimeType
 * @param {number} quality
 * @returns {Promise<File>}
 */
export function cropImageToFile(image, rect, fileName, mimeType = 'image/png', quality = 0.92) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.w));
  canvas.height = Math.max(1, Math.round(rect.h));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Canvas not supported'));
  }

  ctx.drawImage(
    image,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    0,
    0,
    rect.w,
    rect.h
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Crop failed'));
        const file = new File([blob], fileName, { type: mimeType });
        resolve(file);
      },
      mimeType,
      quality
    );
  });
}
