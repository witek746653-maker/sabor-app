const fs = require('fs');
const path = require('path');

const fieldOrder = ["id", "status", "menu", "section", "category", "title", "description", "features", "origin", "region", "producer", "grapeVarieties", "tags", "sweetness", "alcoholContent", "comments", "pairings", "reference_info", "image", "i18n"];

const sectionOrder = [
    "Бокальные позиции — Игристые вина",
    "Бокальные позиции — Белые вина",
    "Бокальные позиции — Розовые вина",
    "Бокальные позиции — Красные вина",
    "Coravin — Белые вина",
    "Coravin — Красные вина",
    "Белые вина — Франция",
    "Белые вина — Италия",
    "Белые вина — Испания",
    "Белые вина — Германия",
    "Белые вина — Австрия",
    "Белые вина — Новый Свет",
    "Красные вина — Франция",
    "Красные вина — Италия",
    "Красные вина — Испания",
    "Красные вина — Новый Свет",
    "Розовые вина",
    "Сладкие и десертные вина",
    "Безалкогольные вина"
];

const newWine = {
    "status": "актуально",
    "menu": "Вино",
    "section": "Безалкогольные вина",
    "category": "non-alcoholic",
    "title": "Le Grand Noir Grenache Blanc-Chardonnay",
    "description": "Освежающее безалкогольное белое вино из Лангедока. Обладает ярким ароматом лимона, лайма, дыни и ананаса. Во вкусе свежее и сбалансированное, с приятной кислинкой и гораздо более сухим профилем, чем у большинства безалкогольных вин.",
    "features": "Аромат цитрусовых, дыни и тропических фруктов; легкое тело, освежающий вкус, низкое содержание калорий (10 ккал на 100 мл).",
    "origin": "Франция, Лангедок-Руссильон.",
    "region": "Лангедок-Руссильон",
    "producer": "Les Celliers Jean d'Alibert.",
    "grapeVarieties": [
        "Grenache Blanc (80%)",
        "Chardonnay (10%)",
        "Viognier (10%)"
    ],
    "tags": [
        "Франция",
        "белое",
        "безалкогольное",
        "легкое",
        "свежее"
    ],
    "sweetness": "сухое",
    "alcoholContent": "0.0%",
    "comments": [
        "Алкоголь бережно удаляется методом вакуумной дистилляции, что позволяет сохранить структуру и аромат вина. Содержит всего 13 г сахара на литр, что делает его одним из самых сухих безалкогольных вин на рынке."
    ],
    "pairings": {
        "dishes": [
            "морепродукты",
            "белая рыба на гриле",
            "курица",
            "салаты",
            "сыры (козий, Гауда)"
        ],
        "notes": [
            "Прекрасный аперитив или сопровождение к легким блюдам из рыбы и птицы."
        ]
    },
    "reference_info": "",
    "image": {
        "src": "../images/wine/le-grand-noir-non-alcoholic.webp",
        "alt": "Le Grand Noir Grenache Blanc-Chardonnay"
    },
    "i18n": {
        "en": {
            "menu-en": "Wine",
            "section-en": "Non-alcoholic Wines",
            "title-en": "Le Grand Noir Grenache Blanc-Chardonnay (Non-Alcoholic)",
            "description-en": "A refreshing non-alcoholic white wine from Languedoc. It features bright aromas of lemon, lime, melon, and pineapple. The palate is fresh and balanced with attractive acidity and a much drier profile than most non-alcoholic wines.",
            "tags-en": "France, white, non-alcoholic, light, fresh",
            "comments-en": "The alcohol is gently removed using vacuum distillation to preserve the wine's texture and aroma. With only 13g of sugar per liter, it is significantly drier than average alcohol-free drinks.",
            "useful phrases & words": [
                "Non-alcoholic — alcohol-free wine",
                "Vacuum distillation — gentle process to remove alcohol",
                "Drier profile — less sweet than typical zero-alcohol wines",
                "Pairs excellently with seafood and salads"
            ]
        }
    }
};

const winePaths = [
    "d:/GitHub/sabor-app/data/menu-wine.json",
    "d:/GitHub/sabor-app/frontend/public/data/menu-wine.json"
];

winePaths.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;

    let wines = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Проверка, что вина еще нет в списке
    if (!wines.find(w => w.title.includes("Le Grand Noir"))) {
        wines.push(newWine);
    }

    // Сортировка
    wines.sort((a, b) => {
        const indexA = sectionOrder.indexOf(a.section);
        const indexB = sectionOrder.indexOf(b.section);

        if (indexA !== indexB) {
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        }
        return a.title.localeCompare(b.title, 'ru');
    });

    // Перенумерация и упорядочивание полей
    const processedWines = wines.map((wine, index) => {
        const id = (601 + index).toString().padStart(4, '0');
        const reordered = {};
        reordered.id = id;

        fieldOrder.forEach(field => {
            if (field !== 'id' && wine.hasOwnProperty(field)) {
                reordered[field] = wine[field];
            }
        });

        // Поля, не вошедшие в список
        Object.keys(wine).forEach(key => {
            if (!reordered.hasOwnProperty(key)) {
                reordered[key] = wine[key];
            }
        });

        return reordered;
    });

    fs.writeFileSync(filePath, JSON.stringify(processedWines, null, 2), 'utf8');
});

console.log("Successfully updated wine data.");
