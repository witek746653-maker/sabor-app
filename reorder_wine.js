const fs = require('fs');
const order = ["id", "status", "menu", "section", "category", "title", "description", "features", "origin", "region", "producer", "grapeVarieties", "tags", "sweetness", "alcoholContent", "comments", "pairings", "reference_info", "image", "i18n"];
const paths = ["d:/GitHub/sabor-app/data/menu-wine.json", "d:/GitHub/sabor-app/frontend/public/data/menu-wine.json"];

paths.forEach(p => {
    if (!fs.existsSync(p)) return;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const reordered = data.map(item => {
        const newItem = {};
        order.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(item, key)) {
                newItem[key] = item[key];
            }
        });
        // Добавляем поля, которых не было в списке (если есть)
        Object.keys(item).forEach(key => {
            if (!order.includes(key)) {
                newItem[key] = item[key];
            }
        });
        return newItem;
    });
    fs.writeFileSync(p, JSON.stringify(reordered, null, 2), 'utf8');
});
console.log("Done");
