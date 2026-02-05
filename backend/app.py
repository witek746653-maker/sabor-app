
# Этот файл теперь является обёрткой (wrapper) для обратной совместимости.
# Сервер (Gunicorn/Systemd) по-прежнему запускает "app:app", но получает новый "create_app()".

from backend.app_factory import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
