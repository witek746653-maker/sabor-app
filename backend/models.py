from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json

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


class KitchenItem(db.Model):
    """
    Модель для позиций кухни.
    """

    __tablename__ = 'kitchen_items'

    id = db.Column(db.String(50), primary_key=True)
    menu = db.Column(db.String(200))
    section = db.Column(db.String(200))
    title = db.Column(db.String(500))
    description = db.Column(db.Text)
    contains = db.Column(db.Text)
    allergens = db.Column(db.Text)
    tags = db.Column(db.Text)
    pairings = db.Column(db.Text)
    image = db.Column(db.Text)
    i18n = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
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
        import json
        item = cls()
        item.id = data.get('id')
        item.menu = data.get('menu')
        item.section = data.get('section')
        item.title = data.get('title')
        item.description = data.get('description')
        item.contains = data.get('contains')
        item.allergens = json.dumps(data.get('allergens', []), ensure_ascii=False)
        item.tags = json.dumps(data.get('tags', []), ensure_ascii=False)
        item.pairings = json.dumps(data.get('pairings', {}), ensure_ascii=False)
        item.image = json.dumps(data.get('image', {}), ensure_ascii=False)
        item.i18n = json.dumps(data.get('i18n', {}), ensure_ascii=False)
        return item

    def __repr__(self):
        return f'<KitchenItem {self.id}: {self.title}>'


class WineItem(db.Model):
    """
    Модель для позиций вина.
    """

    __tablename__ = 'wine_items'

    id = db.Column(db.String(50), primary_key=True)
    menu = db.Column(db.String(200))
    section = db.Column(db.String(200))
    title = db.Column(db.String(500))
    description = db.Column(db.Text)
    contains = db.Column(db.Text)
    allergens = db.Column(db.Text)
    tags = db.Column(db.Text)
    pairings = db.Column(db.Text)
    image = db.Column(db.Text)
    i18n = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
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
        import json
        item = cls()
        item.id = data.get('id')
        item.menu = data.get('menu')
        item.section = data.get('section')
        item.title = data.get('title')
        item.description = data.get('description')
        item.contains = data.get('contains')
        item.allergens = json.dumps(data.get('allergens', []), ensure_ascii=False)
        item.tags = json.dumps(data.get('tags', []), ensure_ascii=False)
        item.pairings = json.dumps(data.get('pairings', {}), ensure_ascii=False)
        item.image = json.dumps(data.get('image', {}), ensure_ascii=False)
        item.i18n = json.dumps(data.get('i18n', {}), ensure_ascii=False)
        return item

    def __repr__(self):
        return f'<WineItem {self.id}: {self.title}>'


class BarItem(db.Model):
    """
    Модель для позиций бара.
    """

    __tablename__ = 'bar_items'

    id = db.Column(db.String(50), primary_key=True)
    menu = db.Column(db.String(200))
    section = db.Column(db.String(200))
    title = db.Column(db.String(500))
    description = db.Column(db.Text)
    contains = db.Column(db.Text)
    allergens = db.Column(db.Text)
    tags = db.Column(db.Text)
    pairings = db.Column(db.Text)
    image = db.Column(db.Text)
    i18n = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
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
        import json
        item = cls()
        item.id = data.get('id')
        item.menu = data.get('menu')
        item.section = data.get('section')
        item.title = data.get('title')
        item.description = data.get('description')
        item.contains = data.get('contains')
        item.allergens = json.dumps(data.get('allergens', []), ensure_ascii=False)
        item.tags = json.dumps(data.get('tags', []), ensure_ascii=False)
        item.pairings = json.dumps(data.get('pairings', {}), ensure_ascii=False)
        item.image = json.dumps(data.get('image', {}), ensure_ascii=False)
        item.i18n = json.dumps(data.get('i18n', {}), ensure_ascii=False)
        return item

    def __repr__(self):
        return f'<BarItem {self.id}: {self.title}>'


class TeaItem(db.Model):
    """
    Модель для позиций чая.
    """

    __tablename__ = 'tea_items'

    id = db.Column(db.String(50), primary_key=True)
    menu = db.Column(db.String(200))
    section = db.Column(db.String(200))
    title = db.Column(db.String(500))
    description = db.Column(db.Text)
    contains = db.Column(db.Text)
    allergens = db.Column(db.Text)
    tags = db.Column(db.Text)
    pairings = db.Column(db.Text)
    image = db.Column(db.Text)
    i18n = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
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
        import json
        item = cls()
        item.id = data.get('id')
        item.menu = data.get('menu')
        item.section = data.get('section')
        item.title = data.get('title')
        item.description = data.get('description')
        item.contains = data.get('contains')
        item.allergens = json.dumps(data.get('allergens', []), ensure_ascii=False)
        item.tags = json.dumps(data.get('tags', []), ensure_ascii=False)
        item.pairings = json.dumps(data.get('pairings', {}), ensure_ascii=False)
        item.image = json.dumps(data.get('image', {}), ensure_ascii=False)
        item.i18n = json.dumps(data.get('i18n', {}), ensure_ascii=False)
        return item

    def __repr__(self):
        return f'<TeaItem {self.id}: {self.title}>'


class Artwork(db.Model):
    """
    Модель для картин (сохраняем полный JSON).
    """

    __tablename__ = 'artworks'

    id = db.Column(db.String(50), primary_key=True)
    data_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        import json
        try:
            payload = json.loads(self.data_json) if self.data_json else {}
        except Exception:
            payload = {}
        payload = payload if isinstance(payload, dict) else {}
        if payload.get('id') != self.id:
            payload['id'] = self.id
        return payload

    @classmethod
    def from_dict(cls, data):
        import json
        item_id = str(data.get('id') or '').strip()
        if not item_id:
            raise ValueError('Artwork id is required')
        payload = dict(data)
        payload['id'] = item_id
        item = cls()
        item.id = item_id
        item.data_json = json.dumps(payload, ensure_ascii=False)
        return item

    def __repr__(self):
        return f'<Artwork {self.id}>'

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
    tags_json = db.Column(db.Text)  # JSON-массив тегов
    meta_json = db.Column(db.Text)  # JSON с тех.данными
    attachments_json = db.Column(db.Text)  # JSON-массив вложений
    read = db.Column(db.Boolean, default=False)  # Прочитано ли сообщение админом
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # Дата создания
    
    def to_dict(self):
        """
        Преобразует объект сообщения в словарь (для JSON ответа).
        Используется, когда отправляем данные на фронтенд.
        """
        def _safe_json(raw, fallback):
            try:
                return json.loads(raw) if raw else fallback
            except Exception:
                return fallback
        # Исправляем пути вложений для админки, чтобы фронтенд-роутер их не блокировал
        raw_attachments = _safe_json(self.attachments_json, [])
        for a in raw_attachments:
            if 'url' in a and '/static/uploads/feedback/' in a['url']:
                a['url'] = a['url'].replace('/static/uploads/feedback/', '/api/feedback/attachments/')

        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'message': self.message,
            'tags': _safe_json(self.tags_json, []),
            'meta': _safe_json(self.meta_json, {}),
            'attachments': raw_attachments,
            'read': self.read,
            'created_at': (self.created_at.isoformat() + 'Z') if self.created_at else None
        }
    
    def __repr__(self):
        """Строковое представление объекта (для отладки)"""
        return f'<FeedbackMessage {self.id}: {self.message[:50]}...>'


class Notification(db.Model):
    """
    Модель для уведомлений (колокольчик).
    
    Уведомления создаются админом и видны всем пользователям и гостям.
    """
    
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(300), nullable=False)
    message = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100))
    type = db.Column(db.String(50), default='announcement')  # announcement | update | attention | question
    lifetime_type = db.Column(db.String(50))  # shift_end | date | manual
    expires_at = db.Column(db.DateTime, nullable=True)
    author = db.Column(db.String(200))
    status = db.Column(db.String(20), default='draft')  # draft | active | archived
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """
        Преобразует уведомление в словарь для фронтенда.
        """
        return {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'category': self.category,
            'type': self.type,
            'lifetimeType': self.lifetime_type,
            'expiresAt': self.expires_at.isoformat() if self.expires_at else None,
            'author': self.author,
            'status': self.status,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self):
        return f'<Notification {self.id}: {self.title}>'


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


class VisibilityConfig(db.Model):
    """
    Модель для конфигурации видимости (feature flags / visibility rules).

    Хранит версии правил, черновики и публикации.
    """

    __tablename__ = 'visibility_configs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    status = db.Column(db.String(20), nullable=False, default='draft')  # draft | published | archived
    version = db.Column(db.Integer, nullable=False, default=1)
    config_json = db.Column(db.Text, nullable=False)  # JSON строка с правилами
    updated_by = db.Column(db.String(200))  # кто изменил (username или имя)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """
        Преобразует объект конфигурации в словарь для JSON ответа.
        """
        import json
        try:
            config = json.loads(self.config_json) if self.config_json else {}
        except Exception:
            config = {}
        return {
            'id': self.id,
            'status': self.status,
            'version': self.version,
            'config': config,
            'updated_by': self.updated_by,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class MediaLike(db.Model):
    """
    Лайки для медиа-материалов.

    Одна запись = один пользователь лайкнул один media_id.
    """

    __tablename__ = 'media_likes'
    __table_args__ = (
        db.UniqueConstraint('media_id', 'user_id', name='uq_media_like_media_user'),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    media_id = db.Column(db.String(100), nullable=False, index=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<MediaLike {self.media_id} by {self.user_id}>'


class FavoriteItem(db.Model):
    """
    Избранное пользователя.

    Одна запись = один пользователь добавил один item_id выбранного типа.
    """

    __tablename__ = 'favorite_items'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'item_type', 'item_id', name='uq_favorite_user_type_item'),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    item_type = db.Column(db.String(30), nullable=False, index=True)  # catalog | media | article
    item_id = db.Column(db.String(120), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<FavoriteItem {self.item_type}:{self.item_id} by {self.user_id}>'
