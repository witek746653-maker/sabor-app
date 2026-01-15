import React, { useEffect, useMemo, useState } from 'react';
import { importMenuJson, getDeployJob, getDeployStatus, runDeploy } from '../../services/api';
import HelpPopover from '../../components/HelpPopover';

/**
 * DeployPage - "Одна кнопка" для обновлений из админки.
 *
 * В индустрии обычно деплой кода делается через CI/CD, а не из веб-интерфейса.
 * Поэтому:
 * - "Импорт меню" (JSON -> БД) безопасен и включён всегда.
 * - "Deploy кода" (git pull/build/restart) выключен по умолчанию и включается флагами на сервере.
 */
function DeployPage() {
  const [menuFile, setMenuFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  const [deployEnabled, setDeployEnabled] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployToken, setDeployToken] = useState('');
  const [deployState, setDeployState] = useState(null);
  const [deployError, setDeployError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const status = await getDeployStatus();
        setDeployEnabled(Boolean(status?.enabled));
        setDeployState(status?.state || null);
      } catch (e) {
        // Если эндпоинт недоступен — просто скрываем deploy
        setDeployEnabled(false);
      }
    };
    load();
  }, []);

  // Поллинг статуса деплоя, если он запущен
  useEffect(() => {
    if (!deployEnabled) return;
    if (!deployState || deployState.status !== 'running') return;

    const timer = setInterval(async () => {
      try {
        const job = await getDeployJob();
        setDeployState(job);
      } catch (e) {
        // если в этот момент сервис перезапускается — запрос может отвалиться, это нормально
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [deployEnabled, deployState]);

  const deployLogText = useMemo(() => {
    const lines = deployState?.log || [];
    return lines.join('\n');
  }, [deployState]);

  const handleImport = async () => {
    if (!menuFile) {
      alert('Выберите файл menu-database.json');
      return;
    }

    setImportLoading(true);
    setImportResult(null);
    setImportError(null);

    try {
      const res = await importMenuJson(menuFile);
      setImportResult(res);
    } catch (e) {
      setImportError(e.response?.data?.error || e.message || 'Ошибка импорта');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!deployEnabled) return;
    if (!deployToken.trim()) {
      alert('Введите Deploy Token (секретный ключ)');
      return;
    }

    setDeployLoading(true);
    setDeployError(null);

    try {
      const res = await runDeploy(deployToken.trim());
      setDeployState(res?.state || null);
    } catch (e) {
      setDeployError(e.response?.data?.error || e.message || 'Ошибка запуска деплоя');
    } finally {
      setDeployLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Обновление
          </h2>
          <HelpPopover title="Справка: обновление меню" icon="help" size="lg">
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Главная идея</div>
              <div style={{ opacity: 0.9 }}>
                В индустрии код обычно обновляют через CI/CD, но меню можно обновлять безопасно через импорт JSON.
              </div>
              <details>
                <summary>1) “Обновить меню из menu-database.json” — что делает</summary>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  Термин <b>импорт</b>: взять файл и применить его к базе.
                  <br />- загружает ваш <code>menu-database.json</code>
                  <br />- убирает дубликаты по <code>id</code>
                  <br />- перезаливает блюда в <b>БД</b> (термин БД: база данных)
                  <br />После этого пользователи увидят изменения в режиме “Авто”.
                </div>
              </details>
              <details>
                <summary>2) “Обновить приложение (код)” — почему опасно</summary>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  Это запускает на сервере: <code>git pull</code> + сборку + миграцию + перезапуск.
                  <br />Возможна короткая недоступность. Поэтому режим выключен по умолчанию.
                </div>
              </details>
            </div>
          </HelpPopover>
        </div>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Самый безопасный способ для частых правок — загрузить новый <b>menu-database.json</b> и применить его.
        </p>
      </div>

      {/* Импорт меню */}
      <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            1) Обновить меню из menu-database.json
          </h3>
          <HelpPopover title="Справка: импорт меню" icon="help">
            <div style={{ opacity: 0.9 }}>
              Этот блок “делает изменения официальными”: применяет файл к базе данных.
              <details>
                <summary>Когда использовать</summary>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  - после серии правок в файле (когда вы довольны результатом)
                  <br />- когда хотите, чтобы режим “Авто” показывал обновления всем
                </div>
              </details>
            </div>
          </HelpPopover>
        </div>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-4">
          Это обновит файл на сервере и перезальёт блюда в базу данных. Пользователи увидят изменения сразу.
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => setMenuFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-700 dark:text-gray-200"
          />

          <button
            onClick={handleImport}
            disabled={importLoading}
            className="h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {importLoading ? 'Применяю...' : 'Загрузить и применить'}
          </button>

          {importError && (
            <div className="text-sm text-red-500">
              ❌ {importError}
            </div>
          )}

          {importResult?.status === 'ok' && (
            <div className="text-sm text-green-600 dark:text-green-400">
              ✅ Готово. Получено: {importResult.received}, уникальных: {importResult.deduped}, импорт в БД: {importResult.imported_to_db}
            </div>
          )}
        </div>
      </div>

      {/* Deploy кода (опционально) */}
      <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            2) Обновить приложение (код) — опционально
          </h3>
          <HelpPopover title="Справка: деплой кода" icon="help">
            <div style={{ opacity: 0.9 }}>
              Этот режим потенциально опаснее, потому что может временно “уронить” сайт при перезапуске.
              <details>
                <summary>Почему нужен токен</summary>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  Термин <b>токен</b>: секретный ключ. Он защищает от случайного запуска деплоя.
                  <br />Важно: не храните токен в Git и не вставляйте в публичные места.
                </div>
              </details>
            </div>
          </HelpPopover>
        </div>

        {!deployEnabled ? (
          <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Этот режим выключен по умолчанию (это небезопасно). Чтобы включить, на сервере задайте переменные окружения:
            <div className="mt-2 font-mono text-[11px] bg-black/5 dark:bg-white/5 p-3 rounded-lg whitespace-pre-wrap">
              ADMIN_DEPLOY_ENABLED=true{'\n'}
              DEPLOY_ADMIN_TOKEN=ваш_секретный_токен
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-orange-700 dark:text-orange-300">
              Внимание: это запустит git pull + сборку фронта + миграцию и затем перезапустит сервис. Возможна короткая недоступность сайта.
            </p>

            <input
              type="password"
              value={deployToken}
              onChange={(e) => setDeployToken(e.target.value)}
              placeholder="Deploy Token (не сохраняется)"
              className="w-full rounded-xl bg-white dark:bg-[#2f221c] border border-gray-200 dark:border-gray-700 h-12 px-4 text-base text-gray-900 dark:text-white focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary"
            />

            <button
              onClick={handleDeploy}
              disabled={deployLoading || deployState?.status === 'running'}
              className="h-12 rounded-xl bg-gray-900 hover:bg-black text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deployState?.status === 'running' ? 'Деплой выполняется...' : (deployLoading ? 'Запускаю...' : 'Запустить деплой')}
            </button>

            {deployError && <div className="text-sm text-red-500">❌ {deployError}</div>}

            {deployState && (
              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                <div className="mb-2">
                  Статус: <b>{deployState.status}</b> {deployState.step ? `— ${deployState.step}` : ''}
                  {deployState.error ? <span className="text-red-500"> — {deployState.error}</span> : null}
                </div>
                <textarea
                  readOnly
                  value={deployLogText}
                  className="w-full h-48 font-mono text-[11px] rounded-xl bg-black/5 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeployPage;

