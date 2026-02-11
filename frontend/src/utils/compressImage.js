/**
 * Сжимает и уменьшает изображение перед отправкой
 * @param {File} file Исходный файл
 * @param {Object} options Настройки
 * @param {number} options.maxWidth Макс. ширина (1600)
 * @param {number} options.maxHeight Макс. высота (1600)
 * @param {number} options.quality Качество JPEG (0.8)
 * @returns {Promise<File>} Сжатый файл
 */
export async function compressImage(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.8 } = {}) {
    // Если не картинка или гифка (их не трогаем, т.к. поломаем анимацию) - возвращаем как есть
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        return file;
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // Расчет новых размеров с сохранением пропорций
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Переводим в JPEG для максимального сжатия скриншотов
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }
                        // Если сжатый файл вдруг стал БОЛЬШЕ оригинала (бывает на мелких картинках) - шлем оригинал
                        if (blob.size >= file.size) {
                            resolve(file);
                            return;
                        }

                        const name = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                        resolve(new File([blob], name, { type: 'image/jpeg' }));
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}
