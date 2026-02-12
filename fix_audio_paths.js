const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'data/menu-wine.json',
    'frontend/public/data/menu-wine.json'
];

filesToUpdate.forEach(filePath => {
    const fullPath = path.resolve(process.cwd(), filePath);

    try {
        if (!fs.existsSync(fullPath)) {
            console.log(`Файл не найден: ${filePath}`);
            return;
        }

        const rawData = fs.readFileSync(fullPath, 'utf8');
        const wines = JSON.parse(rawData);
        let updatedCount = 0;

        wines.forEach(wine => {
            if (wine.i18n && wine.i18n.en) {
                // Всегда перезаписываем audio-en на правильный формат: ../audio/wine/{id}.mp3
                // Даже если поле уже существует или пустое.
                const newAudioPath = `../audio/wine/${wine.id}.mp3`;

                if (wine.i18n.en['audio-en'] !== newAudioPath) {
                    wine.i18n.en['audio-en'] = newAudioPath;
                    updatedCount++;
                }
            }
        });

        if (updatedCount > 0) {
            fs.writeFileSync(fullPath, JSON.stringify(wines, null, 2), 'utf8');
            console.log(`✅ Обновлен файл ${filePath}: исправлено ${updatedCount} записей.`);
        } else {
            console.log(`ℹ️ Файл ${filePath} уже содержит правильные данные.`);
        }

    } catch (error) {
        console.error(`❌ Ошибка при обработке ${filePath}:`, error.message);
    }
});
