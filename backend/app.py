from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager, login_required, login_user, logout_user, UserMixin
from pathlib import Path
import json
import os
from dotenv import load_dotenv
from models import db, Dish, FeedbackMessage, User

# Загружаем переменные окружения
load_dotenv()

# Создаём приложение Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'change-this-in-production-12345')

# Настройка базы данных SQLite
ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "backend" / "database.db"
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Отключаем отслеживание изменений (не нужно для SQLite)

# Инициализируем базу данных
db.init_app(app)

# Разрешаем запросы с фронтенда (CORS)
# Важно: allows_credentials=True необходимо для работы с cookies (сессии Flask-Login)
CORS(app, 
     supports_credentials=True,
     resources={r"/api/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Настройка Flask-Login для аутентификации
login_manager = LoginManager()
login_manager.init_app(app)
# Для API не используем login_view (перенаправления не нужны)
# login_manager.login_view = 'admin_login'  # Если нужно, используйте имя функции

# Пути к директориям
IMAGES_DIR = ROOT_DIR / "images"
AUDIO_DIR = ROOT_DIR / "audio"
# Добавляем пути к директориям с HTML файлами и PDF
MENUS_DIR = ROOT_DIR / "frontend" / "public" / "menus"
TRAINER_DIR = ROOT_DIR / "frontend" / "public" / "trainer"

# Класс для гостевого пользователя (не сохраняется в базе данных)
class GuestUser(UserMixin):
    """
    Гостевой пользователь для demo-режима.
    
    Это специальный класс, который не связан с базой данных.
    Используется только в рамках текущей сессии.
    
    UserMixin автоматически предоставляет свойства is_authenticated, is_active, is_anonymous
    как свойства только для чтения. Мы не переопределяем их, чтобы избежать конфликтов.
    """
    def __init__(self):
        # Используем специальный ID 'guest' вместо 0, чтобы избежать проблем с сериализацией
        self.id = 'guest'  # Специальный ID для гостя
        self.name = 'Гость'
        self.username = 'guest'
        self.role = 'guest'
        # НЕ устанавливаем is_authenticated, is_active, is_anonymous здесь!
        # UserMixin предоставляет их как свойства только для чтения
    
    def get_id(self):
        """Возвращает ID гостя как строку"""
        return str(self.id)
    
    # Переопределяем методы UserMixin для правильной работы с Flask-Login
    @property
    def is_authenticated(self):
        """Гость всегда считается аутентифицированным в рамках сессии"""
        return True
    
    @property
    def is_active(self):
        """Гость всегда активен"""
        return True
    
    @property
    def is_anonymous(self):
        """Гость не является анонимным (он авторизован как гость)"""
        return False
    
    def to_dict(self):
        """Преобразует объект гостя в словарь (для JSON ответа)"""
        return {
            'id': 0,  # Для фронтенда возвращаем 0, чтобы совпадало с ожидаемым форматом
            'name': self.name,
            'username': self.username,
            'role': self.role
        }

# Загрузка пользователя (для Flask-Login)
@login_manager.user_loader
def load_user(user_id):
    """Загружает пользователя по ID из базы данных"""
    try:
        # Проверяем, что user_id не пустой
        if not user_id:
            return None
        # Если ID = 'guest' или '0', это гость
        if str(user_id) == 'guest' or str(user_id) == '0':
            return GuestUser()
        # Иначе пытаемся преобразовать в int и загрузить из базы данных
        user_id_int = int(user_id)
        return User.query.get(user_id_int)
    except (ValueError, TypeError):
        # Если user_id не является числом, возвращаем None
        return None

# Вспомогательная функция для проверки прав доступа
def check_not_guest():
    """
    Проверяет, что текущий пользователь НЕ является гостем.
    
    Вызывает ошибку 403, если пользователь - гость.
    Используется для защиты эндпоинтов, которые требуют записи/изменения данных.
    """
    from flask_login import current_user
    if current_user.is_authenticated and (current_user.id == 0 or current_user.id == 'guest'):
        return jsonify({'error': 'Доступ запрещён. Гостевой режим поддерживает только просмотр данных.'}), 403
    return None

# ========== ПУБЛИЧНЫЕ API (для посетителей) ==========

@app.route('/api/dishes', methods=['GET'])
def get_dishes():
    """Возвращает все блюда из базы данных"""
    try:
        # Получаем все блюда из базы данных
        dishes = Dish.query.all()
        
        # Преобразуем в список словарей (для JSON)
        return jsonify([dish.to_dict() for dish in dishes])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dishes/<dish_id>', methods=['GET'])
def get_dish(dish_id):
    """Возвращает одно блюдо по ID"""
    try:
        # Ищем блюдо в базе данных по ID
        dish = Dish.query.get(dish_id)
        
        if not dish:
            return jsonify({'error': 'Dish not found'}), 404
        
        return jsonify(dish.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/menus', methods=['GET'])
def get_menus():
    """Возвращает список всех меню (уникальные значения поля 'menu')"""
    try:
        # Получаем уникальные значения меню из базы данных
        menus = db.session.query(Dish.menu).distinct().all()
        # Преобразуем в список строк и фильтруем пустые
        menu_list = [m[0] for m in menus if m[0]]
        return jsonify(sorted(menu_list))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sections', methods=['GET'])
def get_sections():
    """Возвращает список всех разделов"""
    try:
        menu_name = request.args.get('menu')
        
        # Строим запрос к базе данных
        query = db.session.query(Dish.section).distinct()
        
        # Фильтруем по меню, если указано
        if menu_name:
            query = query.filter(Dish.menu == menu_name)
        
        sections = query.all()
        # Преобразуем в список строк и фильтруем пустые
        section_list = [s[0] for s in sections if s[0]]
        return jsonify(sorted(section_list))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/images/<path:filename>')
def serve_image(filename):
    """Отдаёт изображения из папки images"""
    try:
        if IMAGES_DIR.exists() and (IMAGES_DIR / filename).exists():
            return send_from_directory(str(IMAGES_DIR), filename)
        else:
            return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<path:filename>')
def serve_audio(filename):
    """Отдаёт аудиофайлы из папки audio"""
    try:
        audio_file = AUDIO_DIR / filename
        if AUDIO_DIR.exists() and audio_file.exists() and audio_file.is_file():
            return send_from_directory(str(audio_file.parent), audio_file.name)
        else:
            return jsonify({'error': f'Audio file not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/menus/<path:filename>')
def serve_menu_html(filename):
    """Отдаёт HTML файлы и PDF из папки frontend/public/menus"""
    try:
        # Проверяем, что файл существует в директории меню
        file_path = MENUS_DIR / filename
        if MENUS_DIR.exists() and file_path.exists() and file_path.is_file():
            # Определяем MIME-тип на основе расширения файла
            if filename.endswith('.pdf'):
                return send_from_directory(str(MENUS_DIR), filename, mimetype='application/pdf')
            elif filename.endswith('.html'):
                return send_from_directory(str(MENUS_DIR), filename, mimetype='text/html')
            else:
                return send_from_directory(str(MENUS_DIR), filename)
        else:
            return jsonify({'error': f'File not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/trainer/<path:filename>')
def serve_trainer_html(filename):
    """Отдаёт HTML файлы из папки frontend/public/trainer"""
    try:
        # Проверяем, что файл существует в директории тренажера
        file_path = TRAINER_DIR / filename
        if TRAINER_DIR.exists() and file_path.exists() and file_path.is_file():
            if filename.endswith('.html'):
                return send_from_directory(str(TRAINER_DIR), filename, mimetype='text/html')
            else:
                return send_from_directory(str(TRAINER_DIR), filename)
        else:
            return jsonify({'error': f'File not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== API ДЛЯ ВИН ==========

@app.route('/api/wines', methods=['GET'])
def get_wines():
    """Возвращает все вина (menu='Вино')"""
    try:
        # Ищем все блюда, где menu = 'Вино'
        wines = Dish.query.filter(Dish.menu == 'Вино').all()
        return jsonify([wine.to_dict() for wine in wines])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/wines/category/<category>', methods=['GET'])
def get_wines_by_category(category):
    """Возвращает вина по категории (by-glass/coravin/half-bottles)"""
    try:
        # Ищем вина по меню и категории
        # Примечание: если category хранится в другом поле, нужно будет адаптировать
        wines = Dish.query.filter(Dish.menu == 'Вино').all()
        
        # Фильтруем по категории из JSON полей
        # Для простоты проверяем в i18n или других JSON полях
        filtered_wines = []
        for wine in wines:
            wine_dict = wine.to_dict()
            # Если категория хранится в отдельном поле, нужно добавить его в модель
            # Пока используем фильтрацию по pairings или i18n
            if wine_dict.get('category') == category:
                filtered_wines.append(wine_dict)
        
        return jsonify(filtered_wines)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/wines/<wine_id>', methods=['GET'])
def get_wine(wine_id):
    """Возвращает одно вино по ID"""
    try:
        # Ищем вино в базе данных
        wine = Dish.query.filter(Dish.id == wine_id, Dish.menu == 'Вино').first()
        
        if not wine:
            return jsonify({'error': 'Wine not found'}), 404
        
        return jsonify(wine.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== API ДЛЯ БАРНОГО МЕНЮ ==========

@app.route('/api/bar-items', methods=['GET'])
def get_bar_items():
    """Возвращает все барные напитки (menu='Барное меню')"""
    try:
        # Ищем все блюда, где menu = 'Барное меню'
        bar_items = Dish.query.filter(Dish.menu == 'Барное меню').all()
        return jsonify([item.to_dict() for item in bar_items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== АДМИНСКИЕ API (требуют авторизации) ==========

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Вход в систему с логином и паролем"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Проверяем, что переданы оба поля
    if not username or not password:
        return jsonify({'error': 'Логин и пароль обязательны'}), 400
    
    # Ищем пользователя в базе данных по логину
    user = User.query.filter_by(username=username).first()
    
    # Проверяем, существует ли пользователь и правильный ли пароль
    if user and user.check_password(password):
        login_user(user)
        return jsonify({'status': 'ok', 'message': 'Успешный вход', 'user': user.to_dict()})
    else:
        return jsonify({'error': 'Неверный логин или пароль'}), 401

@app.route('/api/admin/login/guest', methods=['POST'])
def guest_login():
    """Вход в гостевой (demo) режим без логина и пароля"""
    try:
        # Создаём гостевого пользователя
        guest = GuestUser()
        # Устанавливаем сессию для гостя
        # Используем remember=False, чтобы сессия была временной
        login_user(guest, remember=False)
        return jsonify({
            'status': 'ok',
            'message': 'Вход в гостевой режим',
            'user': guest.to_dict()
        })
    except Exception as e:
        # Логируем ошибку для отладки
        app.logger.error(f'Ошибка при входе гостя: {str(e)}')
        return jsonify({'error': f'Ошибка входа в гостевой режим: {str(e)}'}), 500

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    """
    Выход из системы.
    
    Работает как для обычных пользователей, так и для гостей.
    Декоратор @login_required не нужен, так как logout можно вызвать без авторизации.
    """
    logout_user()
    return jsonify({'status': 'ok'})

@app.route('/api/admin/check', methods=['GET'])
def check_auth():
    """Проверка авторизации и получение информации о текущем пользователе"""
    from flask_login import current_user
    if current_user.is_authenticated:
        # Если это гость (ID = 'guest' или 0)
        if current_user.id == 'guest' or current_user.id == 0:
            return jsonify({
                'authenticated': True,
                'user': current_user.to_dict()
            })
        # Иначе загружаем из базы данных
        user = User.query.get(current_user.id)
        return jsonify({
            'authenticated': True,
            'user': user.to_dict() if user else None
        })
    else:
        return jsonify({'authenticated': False})

@app.route('/api/admin/dishes', methods=['POST'])
@login_required
def save_dishes():
    """Сохранение всех блюд (для админа)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        data = request.json
        
        if not isinstance(data, list):
            return jsonify({'error': 'Payload must be a list'}), 400
        
        # Валидация: проверяем, что у каждого блюда есть ID
        for dish in data:
            if not isinstance(dish, dict) or not dish.get('id'):
                return jsonify({'error': 'Each dish must have an id'}), 400
        
        # Удаляем все существующие блюда
        Dish.query.delete()
        
        # Добавляем новые блюда
        for dish_data in data:
            dish = Dish.from_dict(dish_data)
            db.session.add(dish)
        
        # Сохраняем в базу данных
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Данные сохранены'})
    except Exception as e:
        db.session.rollback()  # Откатываем изменения в случае ошибки
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dishes/<dish_id>', methods=['PUT'])
@login_required
def update_dish(dish_id):
    """Обновление одного блюда"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Ищем блюдо в базе данных
        dish = Dish.query.get(dish_id)
        
        if not dish:
            return jsonify({'error': 'Dish not found'}), 404
        
        # Получаем новые данные
        data = request.json
        
        # Обновляем поля блюда
        updated_dish = Dish.from_dict(data)
        
        # Обновляем поля существующего блюда
        dish.menu = updated_dish.menu
        dish.section = updated_dish.section
        dish.title = updated_dish.title
        dish.description = updated_dish.description
        dish.contains = updated_dish.contains
        dish.allergens = updated_dish.allergens
        dish.tags = updated_dish.tags
        dish.pairings = updated_dish.pairings
        dish.image = updated_dish.image
        dish.i18n = updated_dish.i18n
        
        # Сохраняем изменения
        db.session.commit()
        
        return jsonify({'status': 'ok', 'dish': dish.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dishes', methods=['PUT'])
@login_required
def add_dish():
    """Добавление нового блюда"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        new_dish_data = request.json
        
        if not new_dish_data.get('id'):
            return jsonify({'error': 'Dish must have an id'}), 400
        
        # Проверяем, нет ли уже блюда с таким ID
        existing_dish = Dish.query.get(new_dish_data.get('id'))
        if existing_dish:
            return jsonify({'error': 'Dish with this id already exists'}), 400
        
        # Создаём новое блюдо
        new_dish = Dish.from_dict(new_dish_data)
        db.session.add(new_dish)
        db.session.commit()
        
        return jsonify({'status': 'ok', 'dish': new_dish.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dishes/<dish_id>', methods=['DELETE'])
@login_required
def delete_dish(dish_id):
    """Удаление блюда"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Ищем блюдо в базе данных
        dish = Dish.query.get(dish_id)
        
        if not dish:
            return jsonify({'error': 'Dish not found'}), 404
        
        # Удаляем блюдо
        db.session.delete(dish)
        db.session.commit()
        
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ========== API ДЛЯ ОБРАТНОЙ СВЯЗИ ==========

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    """Отправка сообщения обратной связи"""
    # Проверяем, что это не гость
    from flask_login import current_user
    if current_user.is_authenticated and (current_user.id == 0 or current_user.id == 'guest'):
        return jsonify({'error': 'Доступ запрещён. Гостевой режим поддерживает только просмотр данных.'}), 403
    try:
        data = request.json
        
        # Проверяем, что есть текст сообщения
        if not data.get('message'):
            return jsonify({'error': 'Message is required'}), 400
        
        # Создаём новое сообщение
        feedback = FeedbackMessage(
            name=data.get('name', ''),
            type=data.get('type', 'question'),
            message=data.get('message'),
            read=False
        )
        
        # Сохраняем в базу данных
        db.session.add(feedback)
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Сообщение отправлено', 'id': feedback.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/feedback', methods=['GET'])
@login_required
def get_feedback_messages():
    """Получение всех сообщений обратной связи (только для админа)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Получаем все сообщения, отсортированные по дате (новые сначала)
        messages = FeedbackMessage.query.order_by(FeedbackMessage.created_at.desc()).all()
        
        # Преобразуем в список словарей
        return jsonify([msg.to_dict() for msg in messages])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/feedback/<int:message_id>/read', methods=['PUT'])
@login_required
def mark_feedback_read(message_id):
    """Отметить сообщение как прочитанное"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Ищем сообщение в базе данных
        message = FeedbackMessage.query.get(message_id)
        
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Отмечаем как прочитанное
        message.read = True
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': message.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/feedback/<int:message_id>', methods=['DELETE'])
@login_required
def delete_feedback_message(message_id):
    """Удаление сообщения обратной связи"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Ищем сообщение в базе данных
        message = FeedbackMessage.query.get(message_id)
        
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Удаляем сообщение
        db.session.delete(message)
        db.session.commit()
        
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ========== API ДЛЯ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ==========

@app.route('/api/admin/users', methods=['GET'])
@login_required
def get_users():
    """Получение списка всех пользователей (только для админа)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Проверяем, что текущий пользователь - администратор
        from flask_login import current_user
        current_user_obj = User.query.get(current_user.id)
        
        if not current_user_obj or current_user_obj.role != 'администратор':
            return jsonify({'error': 'Доступ запрещен'}), 403
        
        # Получаем всех пользователей, отсортированных по дате создания (новые сначала)
        users = User.query.order_by(User.created_at.desc()).all()
        
        # Преобразуем в список словарей (без паролей!)
        return jsonify([user.to_dict() for user in users])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['POST'])
@login_required
def create_user():
    """Создание нового пользователя (только для администратора)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Проверяем, что текущий пользователь - администратор
        from flask_login import current_user
        current_user_obj = User.query.get(current_user.id)
        
        if not current_user_obj or current_user_obj.role != 'администратор':
            return jsonify({'error': 'Доступ запрещен. Только администратор может создавать пользователей'}), 403
        
        # Получаем данные из запроса
        data = request.json
        
        # Проверяем обязательные поля
        name = data.get('name')
        username = data.get('username')
        password = data.get('password')
        role = data.get('role', 'официант')  # По умолчанию - официант
        
        if not name or not username or not password:
            return jsonify({'error': 'Имя, логин и пароль обязательны'}), 400
        
        # Проверяем, что роль допустима
        allowed_roles = ['официант', 'администратор', 'хостес']
        if role not in allowed_roles and role:
            # Если роль не из списка, но указана, разрешаем произвольную роль
            pass
        
        # Проверяем, что логин уникален
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400
        
        # Создаём нового пользователя
        new_user = User(
            name=name,
            username=username,
            role=role if role else 'официант'  # Если роль пустая, ставим официант
        )
        # Устанавливаем пароль (он автоматически хешируется)
        new_user.set_password(password)
        
        # Сохраняем в базу данных
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Пользователь создан', 'user': new_user.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    """Обновление пользователя (только для администратора)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Проверяем, что текущий пользователь - администратор
        from flask_login import current_user
        current_user_obj = User.query.get(current_user.id)
        
        if not current_user_obj or current_user_obj.role != 'администратор':
            return jsonify({'error': 'Доступ запрещен. Только администратор может редактировать пользователей'}), 403
        
        # Ищем пользователя в базе данных
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        # Получаем данные из запроса
        data = request.json
        
        # Обновляем поля, если они переданы
        if 'name' in data:
            user.name = data['name']
        
        if 'username' in data:
            # Проверяем, что новый логин уникален (если он изменился)
            new_username = data['username']
            if new_username != user.username:
                existing_user = User.query.filter_by(username=new_username).first()
                if existing_user:
                    return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400
                user.username = new_username
        
        if 'password' in data and data['password']:
            # Обновляем пароль только если он указан
            user.set_password(data['password'])
        
        if 'role' in data:
            role = data['role']
            # Разрешаем любую роль (включая произвольную)
            user.role = role if role else 'официант'
        
        # Сохраняем изменения
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Пользователь обновлен', 'user': user.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    """Удаление пользователя (только для администратора)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Проверяем, что текущий пользователь - администратор
        from flask_login import current_user
        current_user_obj = User.query.get(current_user.id)
        
        if not current_user_obj or current_user_obj.role != 'администратор':
            return jsonify({'error': 'Доступ запрещен. Только администратор может удалять пользователей'}), 403
        
        # Не позволяем удалить самого себя
        if current_user.id == user_id:
            return jsonify({'error': 'Нельзя удалить самого себя'}), 400
        
        # Ищем пользователя в базе данных
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        # Удаляем пользователя
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Пользователь удален'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ========== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ==========

# Создаём таблицы при первом запуске (если их ещё нет)
with app.app_context():
    db.create_all()

# ========== ЗАПУСК СЕРВЕРА ==========

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    app.run(debug=debug, port=port, host='0.0.0.0')

