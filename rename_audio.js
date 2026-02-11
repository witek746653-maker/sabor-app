const fs = require('fs');
const path = require('path');

const jsonPath = 'd:/GitHub/sabor-app/data/menu-wine.json';
const audioDir = 'd:/GitHub/sabor-app/audio/wine';

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

data.forEach(item => {
    const id = item.id;
    if (!item.i18n || !item.i18n.en || !item.i18n.en['audio-en']) return;

    const currentUrl = item.i18n.en['audio-en'];
    const fileName = path.basename(currentUrl);
    const currentFilePath = path.join(audioDir, fileName);

    const newFileName = `${id}.mp3`;
    const newFilePath = path.join(audioDir, newFileName);

    if (fs.existsSync(currentFilePath)) {
        console.log(`Renaming: ${fileName} -> ${newFileName}`);
        fs.renameSync(currentFilePath, newFilePath);
    } else {
        // Try searching for file without 'vino-' prefix or with it if it was missing
        let altFileName = fileName.startsWith('vino-') ? fileName.replace('vino-', '') : 'vino-' + fileName;
        let altFilePath = path.join(audioDir, altFileName);

        if (fs.existsSync(altFilePath)) {
            console.log(`Found alternative: ${altFileName} -> ${newFileName}`);
            fs.renameSync(altFilePath, newFilePath);
        } else {
            // Special cases like typos or slightly different names
            console.log(`File not found: ${fileName} (ID: ${id})`);
        }
    }

    // Update JSON
    item.i18n.en['audio-en'] = `../audio/wine/${newFileName}`;
});

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log('JSON updated successfully.');
