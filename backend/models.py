from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

# Создаём объект для работы с базой данных
# (он будет инициализирован в app.py)
db = SQLAlchemy()

class Dish(db.Model):
    """
    Модель для блюда (dish).
    
    Это класс, который описывает таблицу в базе данных.
    Каждое поле класса = колонка в таблице.
    """
    
    # Указываем имя таблицы в базе данных
    __tablename__ = 'dishes'
    
    # Поля таблицы (колонки)
    id = db.Column(db.String(50), primary_key=True)  # ID блюда (основной ключ)
    menu = db.Column(db.String(200))  # Название меню
    section = db.Column(db.String(200))  # Раздел меню
    title = db.Column(db.String(500))  # Название блюда
    description = db.Column(db.Text)  # Описание блюда (текст может быть длинным)
    contains = db.Column(db.Text)  # Что входит в блюдо (HTML)
    
    # JSON поля - сохраняем как текст, но в Python работаем как словари/списки
    allergens = db.Column(db.Text)  # Список аллергенов (JSON строка)
    tags = db.Column(db.Text)  # Теги (JSON строка)
    pairings = db.Column(db.Text)  # Парные блюда/вина (JSON строка)
    image = db.Column(db.Text)  # Информация об изображении (JSON строка)
    i18n = db.Column(db.Text)  # Переводы на другие языки (JSON строка)
    
    # Служебные поля
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # Дата создания
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # Дата обновления
    
    def to_dict(self):
        """
        Преобразует объект блюда в словарь (для JSON ответа).
        Используется, когда отправляем данные на фронтенд.
        """
        import json
        
        return {
            'id': self.id,
            'menu': self.menu,
            'section': self.section,
            'title': self.title,
            'description': self.description,
            'contains': self.contains,
            'allergens': json.loads(self.allergens) if self.allergens else [],
            'tags': json.loads(self.tags) if self.tags else [],
            'pairings': json.loads(self.pairings) if self.pairings else {},
            'image': json.loads(self.image) if self.image else {},
            'i18n': json.loads(self.i18n) if self.i18n else {}
        }
    
    @classmethod
    def from_dict(cls, data):
        """
        Создаёт объект блюда из словаря.
        Используется при сохранении данных из JSON или API.
        """
        import json
        
        dish = cls()
        dish.id = data.get('id')
        dish.menu = data.get('menu')
        dish.section = data.get('section')
        dish.title = data.get('title')
        dish.description = data.get('description')
        dish.contains = data.get('contains')
        
        # Преобразуем списки и словари в JSON строки
        dish.allergens = json.dumps(data.get('allergens', []), ensure_ascii=False)
        dish.tags = json.dumps(data.get('tags', []), ensure_ascii=False)
        dish.pairings = json.dumps(data.get('pairings', {}), ensure_ascii=False)
        dish.image = json.dumps(data.get('image', {}), ensure_ascii=False)
        dish.i18n = json.dumps(data.get('i18n', {}), ensure_ascii=False)
        
        return dish
    
    def __repr__(self):
        """Строковое представление объекта (для отладки)"""
        return f'<Dish {self.id}: {self.title}>'


class FeedbackMessage(db.Model):
    """
    Модель для сообщений обратной связи от пользователей.
    
    Хранит сообщения, которые пользователи отправляют через форму обратной связи.
    """
    
    # Указываем имя таблицы в базе данных
    __tablename__ = 'feedback_messages'
    
    # Поля таблицы (колонки)
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)  # Автоматический ID
    name = db.Column(db.String(200))  # Имя пользователя (необязательно)
    type = db.Column(db.String(50), default='question')  # Тип сообщения: question, bug, suggestion, greeting
    message = db.Column(db.Text, nullable=False)  # Текст сообщения (обязательно)
    read = db.Column(db.Boolean, default=False)  # Прочитано ли сообщение админом
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # Дата создания
    
    def to_dict(self):
        """
        Преобразует объект сообщения в словарь (для JSON ответа).
        Используется, когда отправляем данные на фронтенд.
        """
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'message': self.message,
            'read': self.read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        """Строковое представление объекта (для отладки)"""
        return f'<FeedbackMessage {self.id}: {self.message[:50]}...>'


class User(db.Model, UserMixin):
    """
    Модель для пользователя системы.
    
    Хранит данные пользователей: имя, логин, пароль (хешированный), роль.
    UserMixin - это класс из Flask-Login, который добавляет методы для аутентификации.
    """
    
    # Указываем имя таблицы в базе данных
    __tablename__ = 'users'
    
    # Поля таблицы (колонки)
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)  # Автоматический ID
    name = db.Column(db.String(200), nullable=False)  # Имя пользователя (обязательно)
    username = db.Column(db.String(100), unique=True, nullable=False)  # Логин (уникальный, обязательно)
    password_hash = db.Column(db.String(255), nullable=False)  # Хеш пароля (обязательно)
    role = db.Column(db.String(50), nullable=False, default='официант')  # Роль пользователя
    
    # Служебные поля
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # Дата создания
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # Дата обновления
    
    def set_password(self, password):
        """
        Устанавливает пароль пользователя.
        
        Принимает обычный пароль, хеширует его и сохраняет в password_hash.
        Хеширование - это преобразование пароля в случайную строку, которую нельзя обратно расшифровать.
        Это нужно для безопасности - если кто-то украдет базу данных, он не увидит реальные пароли.
        """
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """
        Проверяет, правильный ли пароль.
        
        Сравнивает введенный пароль с сохраненным хешем.
        Возвращает True если пароль правильный, False если нет.
        """
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """
        Преобразует объект пользователя в словарь (для JSON ответа).
        
        Используется, когда отправляем данные на фронтенд.
        Важно: мы НЕ возвращаем password_hash в ответе - это безопасность!
        """
        return {
            'id': self.id,
            'name': self.name,
            'username': self.username,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        """Строковое представление объекта (для отладки)"""
        return f'<User {self.id}: {self.username} ({self.role})>'
