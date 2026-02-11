const fs = require('fs');
const filePath = 'd:/GitHub/sabor-app/frontend/public/data/menu-wine.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const topLevelOrder = ["id", "status", "menu", "category", "section", "title", "origin", "region", "producer", "sweetness", "alcoholContent", "tags", "grapeVarieties", "description", "features", "pairings", "comments", "reference_info", "image", "i18n"];
const enOrder = ["menu-en", "section-en", "title-en", "description-en", "contains-en", "allergens-en", "tags-en", "audio-en", "comments-en", "useful phrases & words"];

const reordered = data.map(item => {
    const newItem = {};

    // 1. Process Top Level
    topLevelOrder.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
            if (key === 'i18n') {
                const newI18n = {};
                if (item.i18n && item.i18n.en) {
                    const newEn = {};
                    enOrder.forEach(enKey => {
                        if (Object.prototype.hasOwnProperty.call(item.i18n.en, enKey)) {
                            newEn[enKey] = item.i18n.en[enKey];
                        }
                    });
                    // Add remaining keys in 'en'
                    Object.keys(item.i18n.en).forEach(k => {
                        if (!Object.prototype.hasOwnProperty.call(newEn, k)) {
                            newEn[k] = item.i18n.en[k];
                        }
                    });
                    newI18n.en = newEn;
                }
                // Add remaining keys in 'i18n'
                if (item.i18n) {
                    Object.keys(item.i18n).forEach(k => {
                        if (!Object.prototype.hasOwnProperty.call(newI18n, k)) {
                            newI18n[k] = item.i18n[k];
                        }
                    });
                }
                newItem.i18n = newI18n;
            } else {
                newItem[key] = item[key];
            }
        }
    });

    // 2. Add remaining top-level keys
    Object.keys(item).forEach(k => {
        if (!Object.prototype.hasOwnProperty.call(newItem, k)) {
            newItem[k] = item[k];
        }
    });

    return newItem;
});

fs.writeFileSync(filePath, JSON.stringify(reordered, null, 2), 'utf8');
console.log('Successfully reordered JSON fields.');
