import React from 'react';

/**
 * AdminHelpPage — "шпаргалка" для админа прямо в админ-панели.
 *
 * KISS: это просто страница с понятными правилами и короткими рецептами.
 */
export default function AdminHelpPage() {
  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      <div className="flex flex-col gap-2 mb-6">
        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Справка для админа
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Здесь собраны правила “откуда берутся данные” и быстрые ответы “что нажать”.
        </p>
      </div>

      <div className="space-y-6">
        <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5">
          <h3 className="text-base font-bold mb-2 text-text-primary-light dark:text-text-primary-dark">
            1) Откуда берётся меню (самое важное)
          </h3>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Термин <b>источник данных</b>: место, откуда сайт берёт список блюд. Это влияет на то, что вы видите после F5.
          </p>

          <details className="mt-3">
            <summary>Авто (как обычно)</summary>
            <div className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              - Сайт берёт меню из <b>API</b> (термин API: “адрес на бэкенде”).
              <br />- Обычно API берёт данные из <b>БД</b> (термин БД: база данных).
              <br />- Это режим “официальные данные” и “админка всё меняет”.
            </div>
          </details>

          <details>
            <summary>Файл через бэкенд (быстро править)</summary>
            <div className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              - Сайт берёт меню из файла <code>data/menu-database.json</code> через эндпоинт <code>/api/menu-json</code>.
              <br />- Это режим <b>предпросмотра</b>: быстро правите файл → F5 → сразу видите.
              <br />- Важно: изменения из админки (БД) в этом режиме могут “не появиться”, потому что вы смотрите файл.
            </div>
          </details>

          <details>
            <summary>Файл public (fallback)</summary>
            <div className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              - Это запасной вариант: файл сайта <code>/data/menu-database.json</code> (лежит в <code>frontend/public/data</code>).
              <br />- Обычно нужен, когда API недоступен.
            </div>
          </details>
        </div>

        <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5">
          <h3 className="text-base font-bold mb-2 text-text-primary-light dark:text-text-primary-dark">
            2) Быстрые сценарии (что делать)
          </h3>

          <details className="mt-3">
            <summary>Хочу быстро править руками и сразу видеть результат</summary>
            <div className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              1) В “Статус” выберите режим <b>“Файл через бэкенд (быстро править)”</b>.
              <br />2) Правьте <code>data/menu-database.json</code>.
              <br />3) Жмите F5.
            </div>
          </details>

          <details>
            <summary>Хочу править через админку, чтобы это было “официально”</summary>
            <div className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              1) В “Статус” выберите <b>“Авто (как обычно)”</b>.
              <br />2) Правьте блюда в админке и сохраняйте.
            </div>
          </details>

          <details>
            <summary>Хочу взять файл и применить его “официально” (в БД)</summary>
            <div className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              1) Откройте вкладку <b>“Обновление”</b>.
              <br />2) Загрузите <code>menu-database.json</code> и нажмите “Загрузить и применить”.
              <br />3) После этого режим “Авто” покажет обновления всем пользователям.
            </div>
          </details>
        </div>

        <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5">
          <h3 className="text-base font-bold mb-2 text-text-primary-light dark:text-text-primary-dark">
            3) Частые ошибки и как их избегать
          </h3>
          <details className="mt-3">
            <summary>“Я поменял файл, но на сайте не поменялось”</summary>
            <div className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Причины:
              <br />- Вы в режиме “Авто” и смотрите БД, а правили файл.
              <br />- В браузере остался кэш (в статусе есть “кэш сохранён…”).
              <br />
              Решение:
              <br />- Переключите режим источника в “Статус”.
              <br />- Или очистите кэш меню (кнопки режима делают это автоматически).
            </div>
          </details>
          <details>
            <summary>“JSON сломался (ошибка) после моих правок”</summary>
            <div className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Термин <b>JSON</b>: формат данных. Одна лишняя запятая может сломать файл.
              <br />Проверка:
              <br />
              <code>node -e "JSON.parse(require('fs').readFileSync('data/menu-database.json','utf8')); console.log('JSON OK')"</code>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

