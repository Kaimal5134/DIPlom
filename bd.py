import os
import pymysql
from pymysql.cursors import DictCursor
from contextlib import contextmanager

def get_db_config():
    """Получить конфигурацию подключения к БД из переменных окружения."""
    return {
        "host": os.environ.get("DB_HOST", "91.222.238.6"),        
        "user": os.environ.get("DB_USER", "Timofeev"),
        "password": os.environ.get("DB_PASSWORD", "Timofeev_pass"),
        "database": os.environ.get("DB_NAME", "Timofeev_diplom"),
        "port": int(os.environ.get("DB_PORT", 3306)),
        "cursorclass": DictCursor,
        "autocommit": True,
        "charset": "utf8mb4"
    }

# Формируем конфигурацию при запуске модуля
DB_CONFIG = get_db_config()

@contextmanager
def db_connection():
    """
    Контекстный менеджер для работы с БД.
    Использование:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT ...")
                result = cursor.fetchall()
    """
    conn = None
    try:
        conn = pymysql.connect(**DB_CONFIG)
        yield conn
    finally:
        if conn:
            conn.close()