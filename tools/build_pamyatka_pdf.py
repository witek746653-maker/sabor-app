from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    ListFlowable,
    ListItem,
    PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
import os


OUTPUT_PATH = r"D:\GitHub\sabor-app\Sabor_Pamyatka_RU.pdf"
FONT_ARIAL = r"C:\Windows\Fonts\arial.ttf"
FONT_ARIAL_BOLD = r"C:\Windows\Fonts\arialbd.ttf"
FONT_COURIER = r"C:\Windows\Fonts\cour.ttf"


def register_fonts():
    # Регистрация русских шрифтов (если есть в системе)
    if os.path.exists(FONT_ARIAL):
        pdfmetrics.registerFont(TTFont("Arial", FONT_ARIAL))
    if os.path.exists(FONT_ARIAL_BOLD):
        pdfmetrics.registerFont(TTFont("Arial-Bold", FONT_ARIAL_BOLD))
    if os.path.exists(FONT_COURIER):
        pdfmetrics.registerFont(TTFont("CourierNew", FONT_COURIER))


def build_styles():
    base = getSampleStyleSheet()
    font_body = "Arial" if "Arial" in pdfmetrics.getRegisteredFontNames() else "Helvetica"
    font_bold = "Arial-Bold" if "Arial-Bold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold"
    font_mono = "CourierNew" if "CourierNew" in pdfmetrics.getRegisteredFontNames() else "Courier"

    styles = {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontName=font_bold,
            fontSize=18,
            leading=22,
            alignment=1,
            spaceAfter=10,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["BodyText"],
            fontName=font_body,
            fontSize=11,
            leading=14,
            alignment=1,
            textColor=colors.HexColor("#444444"),
            spaceAfter=12,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading2"],
            fontName=font_bold,
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName=font_body,
            fontSize=11,
            leading=15,
            spaceAfter=6,
        ),
        "mono": ParagraphStyle(
            "mono",
            parent=base["BodyText"],
            fontName=font_mono,
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#1f2937"),
            backColor=colors.HexColor("#f3f4f6"),
            borderColor=colors.HexColor("#e5e7eb"),
            borderWidth=0.5,
            borderPadding=6,
            spaceAfter=8,
        ),
        "note": ParagraphStyle(
            "note",
            parent=base["BodyText"],
            fontName=font_body,
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#111827"),
        ),
    }
    return styles


def bullet_list(items, styles):
    return ListFlowable(
        [ListItem(Paragraph(item, styles["body"]), leftIndent=12) for item in items],
        bulletType="bullet",
        start="•",
        leftIndent=16,
        bulletFontName=styles["body"].fontName,
        bulletFontSize=10,
        spaceBefore=2,
        spaceAfter=6,
    )


def code_block(text, styles):
    # Перевод строки для Paragraph
    return Paragraph(text.replace("\n", "<br/>"), styles["mono"])


def header_box(styles):
    data = [[
        Paragraph("<b>Памятка</b> по безопасной локальной работе", styles["note"]),
        Paragraph("Проект: <b>Sabor app</b><br/>Цель: не ломать прод-данные", styles["note"]),
    ]]
    table = Table(data, colWidths=[8 * cm, 8 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff7ed")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#fdba74")),
        ("INNERGRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#fdba74")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def build_pdf():
    register_fonts()
    styles = build_styles()

    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="Памятка Sabor",
    )

    story = []
    story.append(Paragraph("ПАМЯТКА ПО РАБОТЕ С ЛОКАЛЬНОЙ БАЗОЙ И АДМИНКОЙ", styles["title"]))
    story.append(Paragraph("Версия для печати (2–3 страницы)", styles["subtitle"]))
    story.append(header_box(styles))
    story.append(Spacer(1, 10))

    story.append(Paragraph("0) Зачем это нужно (самое простое объяснение)", styles["h1"]))
    story.append(Paragraph(
        "Есть живой сайт (сервер) и локальная копия (ваш компьютер). "
        "На сервере настоящие данные, на локалке — копия. "
        "Если вы работаете локально, вы ничего не портите на сервере.",
        styles["body"],
    ))

    story.append(Paragraph("1) Термины (простыми словами)", styles["h1"]))
    story.append(bullet_list([
        "<b>Backend</b> — серверная часть, которая работает с базой и отвечает на запросы.",
        "<b>Frontend</b> — интерфейс в браузере (то, что вы видите).",
        "<b>База данных</b> — файл, где лежат пользователи, блюда, цены и т.д.",
        "<b>Dev‑база</b> — локальная копия базы, чтобы безопасно тестировать.",
        "<b>SSH</b> — вход на сервер через консоль (терминал).",
        "<b>SABOR_DB_PATH</b> — переменная, указывающая путь к базе, которую использует backend.",
    ], styles))

    story.append(Paragraph("2) Где лежат базы", styles["h1"]))
    story.append(Paragraph("<b>На сервере (рабочая база):</b> /var/lib/sabor-app/database.db", styles["body"]))
    story.append(Paragraph("<b>Локально (dev‑база):</b> D:\\GitHub\\sabor-app\\backend\\database.dev.db", styles["body"]))
    story.append(Paragraph(
        "Важно: серверная база и локальная база — это разные файлы, и они могут отличаться.",
        styles["body"],
    ))

    story.append(Paragraph("3) Как скачать актуальную базу (самая важная команда)", styles["h1"]))
    story.append(Paragraph("Запускать в PowerShell на компьютере:", styles["body"]))
    story.append(code_block(
        "scp romka@85.198.98.16:/var/lib/sabor-app/database.db "
        "D:\\GitHub\\sabor-app\\backend\\database.dev.db",
        styles,
    ))
    story.append(Paragraph(
        "Что делает команда: берет рабочую базу на сервере и копирует ее в локальный файл database.dev.db. "
        "Если попросит пароль — это пароль от SSH.",
        styles["body"],
    ))

    story.append(Paragraph("4) Как запустить локальный backend правильно", styles["h1"]))
    story.append(code_block(
        "cd D:\\GitHub\\sabor-app\n"
        "powershell -ExecutionPolicy Bypass -File .\\tools\\run_backend_dev.ps1",
        styles,
    ))
    story.append(Paragraph(
        "Почему именно так: этот скрипт автоматически подставляет путь к dev‑базе, "
        "чтобы backend не взял случайно database.db.",
        styles["body"],
    ))

    story.append(Paragraph("5) Как запустить фронтенд", styles["h1"]))
    story.append(code_block(
        "cd D:\\GitHub\\sabor-app\\frontend\n"
        "npm start",
        styles,
    ))
    story.append(Paragraph("Открыть в браузере: http://localhost:3000/admin/login", styles["body"]))

    story.append(PageBreak())

    story.append(Paragraph("6) Как проверить пользователей в локальной базе", styles["h1"]))
    story.append(code_block(
        "python -c \"import sqlite3; db=r'D:\\GitHub\\sabor-app\\backend\\database.dev.db'; "
        "con=sqlite3.connect(db); cur=con.cursor(); "
        "cur.execute('select id, username, role from users'); print(cur.fetchall()); con.close()\"",
        styles,
    ))
    story.append(Paragraph('Пример результата: [(1, "78", "администратор"), (2, "76", "официант")]', styles["body"]))

    story.append(Paragraph("7) Если не получается войти в админку (ошибка 401)", styles["h1"]))
    story.append(Paragraph("Это значит: логин или пароль не подходят локальной базе.", styles["body"]))
    story.append(Paragraph("Решение: сбросить пароль пользователя:", styles["body"]))
    story.append(code_block(
        "cd D:\\GitHub\\sabor-app\\backend\n"
        "py reset_password.py",
        styles,
    ))
    story.append(Paragraph("Скрипт спросит логин, новый пароль и роль администратора (введите y).", styles["body"]))

    story.append(Paragraph("8) Если в базе нет пользователей", styles["h1"]))
    story.append(Paragraph("Создайте локального администратора:", styles["body"]))
    story.append(code_block(
        "cd D:\\GitHub\\sabor-app\\backend\n"
        "py create_admin.py",
        styles,
    ))

    story.append(Paragraph("9) Как понять, где вы находитесь", styles["h1"]))
    story.append(bullet_list([
        "<b>Сервер:</b> https://sabor-dlv.ru/…",
        "<b>Локалка:</b> http://localhost:3000/…",
        "Если видите <b>sabor-dlv.ru</b> — это сервер.",
        "Если видите <b>localhost:3000</b> — это локальная копия.",
    ], styles))

    story.append(Paragraph("10) Проверка, что сервер работает", styles["h1"]))
    story.append(Paragraph("Эта команда выполняется на сервере (через SSH):", styles["body"]))
    story.append(code_block("systemctl status sabor.service", styles))
    story.append(Paragraph("Важно: на Windows эту команду не запускать — будет ошибка.", styles["body"]))

    story.append(Paragraph("11) Частые ошибки и что они означают", styles["h1"]))
    story.append(bullet_list([
        "<b>CommandNotFoundException</b> — команда запущена не там (например systemctl в Windows).",
        "<b>POST /api/admin/login 401</b> — логин/пароль не совпадают с локальной базой.",
        "<b>Пользователь admin не найден</b> — в базе нет такого логина (используйте 78 или создайте пользователя).",
    ], styles))

    story.append(Paragraph("12) Мини‑шпаргалка (очень коротко)", styles["h1"]))
    story.append(Paragraph("Обновить базу → запустить backend → открыть админку", styles["body"]))
    story.append(code_block(
        "scp romka@85.198.98.16:/var/lib/sabor-app/database.db "
        "D:\\GitHub\\sabor-app\\backend\\database.dev.db\n"
        "cd D:\\GitHub\\sabor-app\n"
        "powershell -ExecutionPolicy Bypass -File .\\tools\\run_backend_dev.ps1",
        styles,
    ))
    story.append(Paragraph("Открыть: http://localhost:3000/admin/login", styles["body"]))

    story.append(Paragraph("13) Важно про безопасность", styles["h1"]))
    story.append(bullet_list([
        "Никогда не коммитить .env и *.db.",
        "Не удалять /var/lib/sabor-app/database.db — это рабочая база.",
        "Работать локально только с database.dev.db.",
    ], styles))

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
