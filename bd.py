
import pymysql
from pymysql.cursors import DictCursor
from contextlib import contextmanager

# Подключение к бд
DB_CONFIG = {
    "host": "91.222.238.6", # хост бд
    "user": "Timofeev", # пользователь
    "password": "Timofeev_pass", # пароль
    "database": "Timofeev_diplom", # имя базы
    "port": 3306, # порт 
    "cursorclass": DictCursor, # чтобы результаты были в виде словарей
    "autocommit": True, # автоматически сохранять изменения
    "charset": "utf8mb4"
}

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

