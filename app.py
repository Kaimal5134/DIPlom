import os
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from bd import db_connection
from werkzeug.security import generate_password_hash, check_password_hash
import pymysql
import io
from datetime import datetime
from fpdf import FPDF
import traceback

app = Flask(__name__, static_folder='static')
CORS(app)


@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/admin.html')
def serve_admin():
    return send_from_directory('static', 'admin.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


# Авторизация
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Нет данных"}), 400

    login_input = data.get("login", "").strip()
    password_input = data.get("password", "")

    if not login_input or not password_input:
        return jsonify({"success": False, "message": "Логин и пароль обязательны"}), 400

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql_auth = """
                    SELECT a.idAuthorization, a.Login, a.Password, a.idrole, r.Role_name
                    FROM Authorization a
                    JOIN Role r ON a.idrole = r.idrole
                    WHERE a.Login = %s
                """
                cursor.execute(sql_auth, (login_input,))
                auth_user = cursor.fetchone()

                if not auth_user:
                    return jsonify({"success": False, "message": "Неверный логин или пароль"}), 401

                if not check_password_hash(auth_user["Password"], password_input):
                    return jsonify({"success": False, "message": "Неверный логин или пароль"}), 401

                client_data = None
                cursor.execute(
                    "SELECT id_clients, FIO, Email_clients FROM Clients WHERE Idavtoriz = %s",
                    (auth_user["idAuthorization"],)
                )
                client = cursor.fetchone()
                if client:
                    client_data = {
                        "id_clients": client["id_clients"],
                        "fio": client["FIO"],
                        "email": client["Email_clients"]
                    }

                return jsonify({
                    "success": True,
                    "user": {
                        "id": auth_user["idAuthorization"],
                        "login": auth_user["Login"],
                        "role": auth_user["Role_name"],
                        "role_id": auth_user["idrole"],
                        "client": client_data
                    }
                })
    except Exception as e:
        print(f"Ошибка при авторизации: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Регистрация
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Нет данных"}), 400

    login = data.get("login", "").strip()
    password = data.get("password", "")
    fio = data.get("fio", "").strip()
    email = data.get("email", "").strip()

    if not login or not password or not fio or not email:
        return jsonify({"success": False, "message": "Все поля обязательны"}), 400

    if len(login) > 45 or len(password) > 45 or len(fio) > 45 or len(email) > 45:
        return jsonify({"success": False, "message": "Слишком длинные значения"}), 400

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT idrole FROM Role WHERE Role_name = 'user'")
                role_row = cursor.fetchone()
                if not role_row:
                    return jsonify({"success": False, "message": "Роль 'user' не найдена в БД"}), 500
                role_id = role_row["idrole"]

                cursor.execute("SELECT idAuthorization FROM Authorization WHERE Login = %s", (login,))
                if cursor.fetchone():
                    return jsonify({"success": False, "message": "Логин уже занят"}), 400

                cursor.execute("SELECT id_clients FROM Clients WHERE Email_clients = %s", (email,))
                if cursor.fetchone():
                    return jsonify({"success": False, "message": "Email уже используется"}), 400

                hashed_password = generate_password_hash(password)

                sql_auth = "INSERT INTO Authorization (Login, Password, idrole) VALUES (%s, %s, %s)"
                cursor.execute(sql_auth, (login, hashed_password, role_id))
                auth_id = cursor.lastrowid

                sql_client = "INSERT INTO Clients (FIO, Email_clients, Idavtoriz) VALUES (%s, %s, %s)"
                cursor.execute(sql_client, (fio, email, auth_id))

                return jsonify({"success": True, "message": "Регистрация успешна"})
    except Exception as e:
        print(f"Ошибка при регистрации: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Категории товаров (имена)
@app.route("/api/categories", methods=["GET"])
def get_categories():
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT name_tupe FROM Type_product ORDER BY name_tupe")
                rows = cursor.fetchall()
                categories = [row['name_tupe'] for row in rows]
                return jsonify({"success": True, "categories": categories})
    except Exception as e:
        print(f"Ошибка получения категорий: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Категории с id для админа
@app.route("/api/categories_with_id", methods=["GET"])
def get_categories_with_id():
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT idType_Equipment as id, name_tupe as name FROM Type_product ORDER BY name_tupe")
                categories = cursor.fetchall()
                return jsonify({"success": True, "categories": categories})
    except Exception as e:
        print(f"Ошибка получения категорий: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Создание категории
@app.route("/api/categories", methods=["POST"])
def create_category():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Нет данных"}), 400
    name = data.get("name")
    if not name:
        return jsonify({"success": False, "message": "Имя категории обязательно"}), 400
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("INSERT INTO Type_product (name_tupe) VALUES (%s)", (name,))
                return jsonify({"success": True, "message": "Категория создана"})
    except pymysql.IntegrityError:
        return jsonify({"success": False, "message": "Категория с таким именем уже существует"}), 400
    except Exception as e:
        print(f"Ошибка создания категории: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Обновление категории
@app.route("/api/categories/<int:category_id>", methods=["PUT"])
def update_category(category_id):
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Нет данных"}), 400
    name = data.get("name")
    if not name:
        return jsonify({"success": False, "message": "Имя категории обязательно"}), 400
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("UPDATE Type_product SET name_tupe = %s WHERE idType_Equipment = %s", (name, category_id))
                if cursor.rowcount == 0:
                    return jsonify({"success": False, "message": "Категория не найдена"}), 404
                return jsonify({"success": True, "message": "Категория обновлена"})
    except pymysql.IntegrityError:
        return jsonify({"success": False, "message": "Категория с таким именем уже существует"}), 400
    except Exception as e:
        print(f"Ошибка обновления категории: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Удаление категории
@app.route("/api/categories/<int:category_id>", methods=["DELETE"])
def delete_category(category_id):
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) as cnt FROM Product WHERE id_type_Product = %s", (category_id,))
                if cursor.fetchone()['cnt'] > 0:
                    return jsonify({"success": False, "message": "Нельзя удалить категорию, которая используется в товарах"}), 400
                cursor.execute("DELETE FROM Type_product WHERE idType_Equipment = %s", (category_id,))
                if cursor.rowcount == 0:
                    return jsonify({"success": False, "message": "Категория не найдена"}), 404
                return jsonify({"success": True, "message": "Категория удалена"})
    except Exception as e:
        print(f"Ошибка удаления категории: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Список товаров с фильтрацией
@app.route("/api/products", methods=["GET"])
def get_products():
    search = request.args.get('search', '')
    category = request.args.get('category', '')
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT 
                        p.idProduct,
                        p.Name_Product,
                        p.Price,
                        p.Guarantee,
                        p.Col_Product,
                        t.name_tupe AS name_type,
                        (SELECT pi.idproduct_images 
                         FROM product_images pi 
                         WHERE pi.id_product = p.idProduct 
                         ORDER BY pi.idproduct_images 
                         LIMIT 1) AS image_id
                    FROM Product p
                    LEFT JOIN Type_product t ON p.id_type_Product = t.idType_Equipment
                    WHERE 1=1
                """
                params = []
                if search:
                    sql += " AND p.Name_Product LIKE %s"
                    params.append(f"%{search}%")
                if category:
                    sql += " AND t.name_tupe = %s"
                    params.append(category)
                cursor.execute(sql, params)
                products = cursor.fetchall()
                for product in products:
                    if product['image_id']:
                        # Формируем URL 
                        product['image_url'] = request.host_url.rstrip('/') + f"/api/product_image/{product['image_id']}"
                    else:
                        product['image_url'] = None
                    del product['image_id']
                return jsonify({"success": True, "products": products})
    except Exception as e:
        print(f"Ошибка получения товаров: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Получение одного товара
@app.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT p.idProduct, p.Name_Product, p.Price, p.Guarantee, p.Col_Product,
                           p.id_type_Product, t.name_tupe as name_type,
                           (SELECT pi.idproduct_images 
                            FROM product_images pi 
                            WHERE pi.id_product = p.idProduct 
                            LIMIT 1) AS image_id
                    FROM Product p
                    LEFT JOIN Type_product t ON p.id_type_Product = t.idType_Equipment
                    WHERE p.idProduct = %s
                """
                cursor.execute(sql, (product_id,))
                product = cursor.fetchone()
                if not product:
                    return jsonify({"success": False, "message": "Товар не найден"}), 404
                if product['image_id']:
                    product['image_url'] = request.host_url.rstrip('/') + f"/api/product_image/{product['image_id']}"
                else:
                    product['image_url'] = None
                del product['image_id']
                return jsonify({"success": True, "product": product})
    except Exception as e:
        print(f"Ошибка получения товара: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Создание товара
@app.route("/api/products", methods=["POST"])
def create_product():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Нет данных"}), 400

    name = data.get("name")
    price = data.get("price")
    guarantee = data.get("guarantee")
    col_product = data.get("col_product")
    id_type_product = data.get("id_type_product")

    if name is None or price is None or col_product is None or id_type_product is None:
        return jsonify({"success": False, "message": "Заполните все обязательные поля"}), 400

    try:
        price = float(price)
        col_product = int(col_product)
        id_type_product = int(id_type_product)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Неверный формат данных"}), 400

    if price < 1 or price > 10000000:
        return jsonify({"success": False, "message": "Цена должна быть от 1 до 10 000 000"}), 400
    if col_product < 0 or col_product > 1000:
        return jsonify({"success": False, "message": "Количество должно быть от 0 до 1000"}), 400

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    INSERT INTO Product (Name_Product, Price, Guarantee, Col_Product, id_type_Product)
                    VALUES (%s, %s, %s, %s, %s)
                """
                cursor.execute(sql, (name, price, guarantee, col_product, id_type_product))
                new_id = cursor.lastrowid
                return jsonify({"success": True, "message": "Товар создан", "id": new_id})
    except Exception as e:
        print(f"Ошибка создания товара: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Обновление товара
@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Нет данных"}), 400

    name = data.get("name")
    price = data.get("price")
    guarantee = data.get("guarantee")
    col_product = data.get("col_product")
    id_type_product = data.get("id_type_product")

    if name is None or price is None or col_product is None or id_type_product is None:
        return jsonify({"success": False, "message": "Заполните все обязательные поля"}), 400

    try:
        price = float(price)
        col_product = int(col_product)
        id_type_product = int(id_type_product)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Неверный формат данных"}), 400

    if price < 1 or price > 10000000:
        return jsonify({"success": False, "message": "Цена должна быть от 1 до 10 000 000"}), 400
    if col_product < 0 or col_product > 1000:
        return jsonify({"success": False, "message": "Количество должно быть от 0 до 1000"}), 400

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    UPDATE Product
                    SET Name_Product = %s, Price = %s, Guarantee = %s,
                        Col_Product = %s, id_type_Product = %s
                    WHERE idProduct = %s
                """
                cursor.execute(sql, (name, price, guarantee, col_product, id_type_product, product_id))
                return jsonify({"success": True, "message": "Товар обновлён"})
    except Exception as e:
        print(f"Ошибка обновления товара: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Удаление товара
@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) as cnt FROM Order_items WHERE id_product = %s", (product_id,))
                if cursor.fetchone()['cnt'] > 0:
                    return jsonify({"success": False, "message": "Товар нельзя удалить, так как он присутствует в одном или нескольких заказах"}), 400
                cursor.execute("DELETE FROM product_images WHERE id_product = %s", (product_id,))
                cursor.execute("DELETE FROM Product WHERE idProduct = %s", (product_id,))
                return jsonify({"success": True, "message": "Товар удалён"})
    except Exception as e:
        print(f"Ошибка удаления товара: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Загрузка изображения для товара
@app.route("/api/products/<int:product_id>/image", methods=["POST"])
def upload_product_image(product_id):
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "Файл не передан"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "Файл не выбран"}), 400

    image_data = file.read()

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM product_images WHERE id_product = %s", (product_id,))
                cursor.execute("INSERT INTO product_images (id_product, image) VALUES (%s, %s)",
                               (product_id, image_data))
                return jsonify({"success": True, "message": "Изображение загружено"})
    except Exception as e:
        print(f"Ошибка загрузки изображения: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Получение изображения товара по id изображения
@app.route("/api/product_image/<int:image_id>")
def get_product_image(image_id):
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT image FROM product_images WHERE idproduct_images = %s", (image_id,))
                row = cursor.fetchone()
                if row and row['image']:
                    image_data = row['image']
                    if image_data.startswith(b'\xff\xd8'):
                        mimetype = 'image/jpeg'
                    elif image_data.startswith(b'\x89PNG\r\n\x1a\n'):
                        mimetype = 'image/png'
                    elif image_data.startswith(b'GIF87a') or image_data.startswith(b'GIF89a'):
                        mimetype = 'image/gif'
                    else:
                        mimetype = 'application/octet-stream'

                    response = send_file(
                        io.BytesIO(image_data),
                        mimetype=mimetype,
                        as_attachment=False,
                        download_name='product'
                    )
                    response.headers['Access-Control-Allow-Origin'] = '*'
                    return response
                else:
                    return "Image not found", 404
    except Exception as e:
        print(f"Ошибка получения изображения: {e}")
        return str(e), 500

# Оформление заказа
@app.route("/api/checkout", methods=["POST"])
def checkout():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Нет данных"}), 400

    user_id = data.get("user_id")
    items = data.get("items")
    address = data.get("address", "").strip()

    if len(address) > 100:
        return jsonify({"success": False, "message": "Адрес не может быть длиннее 100 символов"}), 400

    if not user_id or not items:
        return jsonify({"success": False, "message": "Недостаточно данных"}), 400

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id_clients FROM Clients WHERE id_clients = %s", (user_id,))
                if not cursor.fetchone():
                    return jsonify({"success": False, "message": "Клиент не найден"}), 401

                for item in items:
                    cursor.execute("SELECT Col_Product, Price, Name_Product FROM Product WHERE idProduct = %s", (item['id'],))
                    row = cursor.fetchone()
                    if not row:
                        return jsonify({"success": False, "message": f"Товар с id {item['id']} не найден"}), 400
                    if row['Col_Product'] < item['quantity']:
                        return jsonify({"success": False, "message": f"Недостаточно товара '{row['Name_Product']}' на складе"}), 400

                cursor.execute(
                    "INSERT INTO Orders (date_order, id_clients, id_state, total_price, delivery_address) VALUES (NOW(), %s, 1, 0, %s)",
                    (user_id, address if address else None)
                )
                order_id = cursor.lastrowid

                total = 0
                for item in items:
                    product_id = item['id']
                    qty = item['quantity']
                    cursor.execute("SELECT Price FROM Product WHERE idProduct = %s", (product_id,))
                    price = cursor.fetchone()['Price']
                    subtotal = price * qty
                    cursor.execute(
                        "INSERT INTO Order_items (id_Order, id_product, quantity, price, subtotal) VALUES (%s, %s, %s, %s, %s)",
                        (order_id, product_id, qty, price, subtotal)
                    )
                    cursor.execute(
                        "UPDATE Product SET Col_Product = Col_Product - %s WHERE idProduct = %s",
                        (qty, product_id)
                    )
                    total += subtotal

                cursor.execute("UPDATE Orders SET total_price = %s WHERE idOrder = %s", (total, order_id))

                return jsonify({"success": True, "message": "Заказ оформлен", "order_id": order_id})
    except Exception as e:
        print(f"Ошибка при оформлении заказа: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Получение истории заказов
@app.route("/api/orders", methods=["GET"])
def get_orders():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "Не указан пользователь"}), 400
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT o.idOrder, o.date_order, o.total_price, s.Category_state as status, o.delivery_address, o.id_state
                    FROM Orders o
                    JOIN State s ON o.id_state = s.idState
                    WHERE o.id_clients = %s
                    ORDER BY o.date_order DESC
                """
                cursor.execute(sql, (user_id,))
                orders = cursor.fetchall()
                result = []
                for order in orders:
                    cursor.execute("""
                        SELECT oi.id_product, p.Name_Product, oi.quantity, oi.price, oi.subtotal, p.Guarantee
                        FROM Order_items oi
                        JOIN Product p ON oi.id_product = p.idProduct
                        WHERE oi.id_Order = %s
                    """, (order['idOrder'],))
                    items = cursor.fetchall()
                    result.append({
                        "id": order['idOrder'],
                        "date": order['date_order'].strftime('%d.%m.%Y'),
                        "status": order['status'],
                        "total": float(order['total_price']),
                        "address": order['delivery_address'],
                        "state_id": order['id_state'],
                        "items": [{
                            "name": item['Name_Product'],
                            "quantity": item['quantity'],
                            "price": float(item['price']),
                            "subtotal": float(item['subtotal']),
                            "guarantee": item['Guarantee']
                        } for item in items]
                    })
                return jsonify({"success": True, "orders": result})
    except Exception as e:
        print(f"Ошибка получения заказов: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Отмена заказа (клиент)
@app.route("/api/order/cancel", methods=["POST", "OPTIONS"])
def cancel_order():
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json()
    if not data or 'order_id' not in data or 'user_id' not in data:
        return jsonify({"success": False, "message": "Не указан ID заказа или пользователя"}), 400

    order_id = data['order_id']
    user_id = data['user_id']

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id_state, id_clients FROM Orders WHERE idOrder = %s", (order_id,))
                order = cursor.fetchone()
                if not order:
                    return jsonify({"success": False, "message": "Заказ не найден"}), 404
                if order['id_clients'] != user_id:
                    return jsonify({"success": False, "message": "Нет прав на отмену этого заказа"}), 403
                if order['id_state'] != 1:
                    return jsonify({"success": False, "message": "Данный заказ уже нельзя отменить"}), 400

                cursor.execute("SELECT id_product, quantity FROM Order_items WHERE id_Order = %s", (order_id,))
                items = cursor.fetchall()

                for item in items:
                    cursor.execute("UPDATE Product SET Col_Product = Col_Product + %s WHERE idProduct = %s",
                                   (item['quantity'], item['id_product']))

                cursor.execute("UPDATE Orders SET id_state = 5 WHERE idOrder = %s", (order_id,))

                return jsonify({"success": True, "message": "Заказ отменён"})
    except Exception as e:
        print(f"Ошибка при отмене заказа: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Админ список всех заказов
@app.route("/api/admin/orders", methods=["GET"])
def admin_get_orders():
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT o.idOrder, o.date_order, o.total_price, o.id_state, s.Category_state as status,
                           c.FIO as client_fio, o.delivery_address
                    FROM Orders o
                    JOIN State s ON o.id_state = s.idState
                    JOIN Clients c ON o.id_clients = c.id_clients
                    ORDER BY o.date_order DESC
                """
                cursor.execute(sql)
                orders = cursor.fetchall()
                result = [{
                    "id": order['idOrder'],
                    "date": order['date_order'].strftime('%d.%m.%Y'),
                    "client_fio": order['client_fio'],
                    "state_id": order['id_state'],
                    "status": order['status'],
                    "total": float(order['total_price']),
                    "address": order['delivery_address']
                } for order in orders]
                return jsonify({"success": True, "orders": result})
    except Exception as e:
        print(f"Ошибка получения заказов для админа: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Админ изменение статуса заказа
@app.route("/api/admin/orders/<int:order_id>", methods=["PUT"])
def admin_update_order(order_id):
    data = request.get_json()
    if not data or 'state_id' not in data:
        return jsonify({"success": False, "message": "Не указан новый статус"}), 400
    new_state = data['state_id']
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("UPDATE Orders SET id_state = %s WHERE idOrder = %s", (new_state, order_id))
                return jsonify({"success": True, "message": "Статус обновлён"})
    except Exception as e:
        print(f"Ошибка обновления статуса заказа: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Админ удаление заказа (только отменённые)
@app.route("/api/admin/orders/<int:order_id>", methods=["DELETE"])
def admin_delete_order(order_id):
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id_state FROM Orders WHERE idOrder = %s", (order_id,))
                order = cursor.fetchone()
                if not order:
                    return jsonify({"success": False, "message": "Заказ не найден"}), 404
                if order['id_state'] != 5:
                    return jsonify({"success": False, "message": "Можно удалять только отменённые заказы"}), 400
                cursor.execute("DELETE FROM Order_items WHERE id_Order = %s", (order_id,))
                cursor.execute("DELETE FROM Orders WHERE idOrder = %s", (order_id,))
                return jsonify({"success": True, "message": "Заказ удалён"})
    except Exception as e:
        print(f"Ошибка удаления заказа: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Админ получение состава заказа
@app.route("/api/admin/orders/<int:order_id>/items", methods=["GET"])
def admin_get_order_items(order_id):
    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT oi.id_product, p.Name_Product, oi.quantity, oi.price, oi.subtotal
                    FROM Order_items oi
                    JOIN Product p ON oi.id_product = p.idProduct
                    WHERE oi.id_Order = %s
                """, (order_id,))
                items = cursor.fetchall()
                result = [{
                    "id": item["id_product"],
                    "name": item["Name_Product"],
                    "quantity": item["quantity"],
                    "price": float(item["price"]),
                    "subtotal": float(item["subtotal"])
                } for item in items]
                return jsonify({"success": True, "items": result})
    except Exception as e:
        print(f"Ошибка получения состава заказа: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Отчёт о продажах (данные)
@app.route("/api/reports/sales", methods=["GET"])
def sales_report():
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')
    category_id = request.args.get('category_id', type=int)

    if not from_date or not to_date:
        return jsonify({"success": False, "message": "Не указан период"}), 400

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT 
                        p.idProduct,
                        p.Name_Product AS product_name,
                        t.name_tupe AS category_name,
                        oi.price,
                        SUM(oi.quantity) AS total_quantity,
                        SUM(oi.subtotal) AS total_sum
                    FROM Order_items oi
                    JOIN Orders o ON oi.id_Order = o.idOrder
                    JOIN Product p ON oi.id_product = p.idProduct
                    LEFT JOIN Type_product t ON p.id_type_Product = t.idType_Equipment
                    WHERE DATE(o.date_order) BETWEEN %s AND %s
                      AND o.id_state IN (3,4)
                """
                params = [from_date, to_date]

                if category_id:
                    sql += " AND p.id_type_Product = %s"
                    params.append(category_id)

                sql += " GROUP BY p.idProduct, p.Name_Product, t.name_tupe, oi.price ORDER BY total_sum DESC"

                cursor.execute(sql, params)
                rows = cursor.fetchall()
                sales = [{
                    "product_name": row["product_name"],
                    "category_name": row["category_name"],
                    "price": float(row["price"]),
                    "total_quantity": row["total_quantity"],
                    "total_sum": float(row["total_sum"])
                } for row in rows]

                return jsonify({"success": True, "sales": sales})
    except Exception as e:
        print(f"Ошибка генерации отчёта: {e}")
        return jsonify({"success": False, "message": "Ошибка сервера"}), 500

# Отчёт о продажах (PDF)
@app.route("/api/reports/sales/pdf", methods=["GET"])
def sales_report_pdf():
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')
    category_id = request.args.get('category_id', type=int)

    if not from_date or not to_date:
        return "Не указан период", 400

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT 
                        p.Name_Product AS product_name,
                        t.name_tupe AS category_name,
                        oi.price,
                        SUM(oi.quantity) AS total_quantity,
                        SUM(oi.subtotal) AS total_sum
                    FROM Order_items oi
                    JOIN Orders o ON oi.id_Order = o.idOrder
                    JOIN Product p ON oi.id_product = p.idProduct
                    LEFT JOIN Type_product t ON p.id_type_Product = t.idType_Equipment
                    WHERE DATE(o.date_order) BETWEEN %s AND %s
                      AND o.id_state IN (3,4)
                """
                params = [from_date, to_date]

                if category_id:
                    sql += " AND p.id_type_Product = %s"
                    params.append(category_id)

                sql += " GROUP BY p.idProduct, p.Name_Product, t.name_tupe, oi.price ORDER BY total_sum DESC"

                cursor.execute(sql, params)
                rows = cursor.fetchall()
                sales = [{
                    "product_name": row["product_name"],
                    "category_name": row["category_name"] or '-',
                    "price": float(row["price"]),
                    "total_quantity": row["total_quantity"],
                    "total_sum": float(row["total_sum"])
                } for row in rows]

                if not sales:
                    return "Нет данных за выбранный период", 404

                pdf = FPDF()
                pdf.add_page()

                arial_path = "C:/Windows/Fonts/arial.ttf"
                arial_bd_path = "C:/Windows/Fonts/arialbd.ttf"

                if not os.path.exists(arial_path):
                    return "Системный шрифт Arial не найден", 500

                pdf.add_font('Arial', '', arial_path, uni=True)
                if os.path.exists(arial_bd_path):
                    pdf.add_font('Arial', 'B', arial_bd_path, uni=True)
                else:
                    pdf.add_font('Arial', 'B', arial_path, uni=True)

                pdf.set_font('Arial', '', 10)

                pdf.set_font('Arial', 'B', 16)
                pdf.cell(0, 10, 'Отчёт о продажах', ln=True, align='C')
                pdf.set_font('Arial', '', 10)
                pdf.cell(0, 10, f'Период: {from_date} — {to_date}', ln=True, align='C')
                pdf.ln(10)

                pdf.set_font('Arial', 'B', 9)
                headers = ['Товар', 'Категория', 'Кол-во', 'Цена', 'Сумма']
                col_widths = [70, 40, 20, 30, 30]
                pdf.set_fill_color(255, 107, 0)
                pdf.set_text_color(255, 255, 255)
                for i, header in enumerate(headers):
                    pdf.cell(col_widths[i], 10, header, border=1, align='C', fill=True)
                pdf.ln()
                pdf.set_text_color(0, 0, 0)
                pdf.set_font('Arial', '', 9)

                total_sum = 0
                for item in sales:
                    pdf.cell(col_widths[0], 8, item['product_name'], border=1)
                    pdf.cell(col_widths[1], 8, item['category_name'], border=1)
                    pdf.cell(col_widths[2], 8, str(item['total_quantity']), border=1, align='C')
                    pdf.cell(col_widths[3], 8, f"{item['price']:.2f} ₽", border=1, align='R')
                    pdf.cell(col_widths[4], 8, f"{item['total_sum']:.2f} ₽", border=1, align='R')
                    pdf.ln()
                    total_sum += item['total_sum']

                pdf.ln(5)
                pdf.set_font('Arial', 'B', 9)
                pdf.cell(0, 10, f'ИТОГО: {total_sum:.2f} ₽', ln=True, align='R')
                pdf.set_font('Arial', '', 8)
                pdf.cell(0, 10, f'Отчёт от {datetime.now().strftime("%d.%m.%Y")}', ln=True, align='R')

                pdf_output = io.BytesIO()
                pdf.output(pdf_output)
                pdf_output.seek(0)

                return send_file(
                    pdf_output,
                    download_name=f"sales_report_{from_date}_{to_date}.pdf",
                    as_attachment=True,
                    mimetype='application/pdf'
                )
    except Exception as e:
        traceback.print_exc()
        return str(e), 500

# Получение данных для прайс-листа
@app.route("/api/price-list", methods=["GET"])
def get_price_list():
    category_id = request.args.get('category_id', type=int)
    only_in_stock = request.args.get('only_in_stock', 'false').lower() == 'true'

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT 
                        p.idProduct,
                        p.Name_Product,
                        p.Price,
                        p.Guarantee,
                        p.Col_Product,
                        t.name_tupe AS category_name
                    FROM Product p
                    LEFT JOIN Type_product t ON p.id_type_Product = t.idType_Equipment
                    WHERE 1=1
                """
                params = []
                if category_id:
                    sql += " AND p.id_type_Product = %s"
                    params.append(category_id)
                if only_in_stock:
                    sql += " AND p.Col_Product > 0"
                sql += " ORDER BY t.name_tupe, p.Name_Product"

                cursor.execute(sql, params)
                rows = cursor.fetchall()
                products = [{
                    "id": row["idProduct"],
                    "name": row["Name_Product"],
                    "price": float(row["Price"]),
                    "guarantee": row["Guarantee"] or '',
                    "stock": row["Col_Product"],
                    "category": row["category_name"] or '-'
                } for row in rows]

                return jsonify({"success": True, "products": products})
    except Exception as e:
        print(f"Ошибка получения прайс-листа: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# PDF прайс-листа
@app.route("/api/price-list/pdf", methods=["GET"])
def price_list_pdf():
    category_id = request.args.get('category_id', type=int)
    only_in_stock = request.args.get('only_in_stock', 'false').lower() == 'true'

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT 
                        p.idProduct,
                        p.Name_Product,
                        p.Price,
                        p.Guarantee,
                        p.Col_Product,
                        t.name_tupe AS category_name
                    FROM Product p
                    LEFT JOIN Type_product t ON p.id_type_Product = t.idType_Equipment
                    WHERE 1=1
                """
                params = []
                if category_id:
                    sql += " AND p.id_type_Product = %s"
                    params.append(category_id)
                if only_in_stock:
                    sql += " AND p.Col_Product > 0"
                sql += " ORDER BY t.name_tupe, p.Name_Product"

                cursor.execute(sql, params)
                rows = cursor.fetchall()
                products = [{
                    "id": row["idProduct"],
                    "name": row["Name_Product"],
                    "price": float(row["Price"]),
                    "guarantee": row["Guarantee"] or '',
                    "stock": row["Col_Product"],
                    "category": row["category_name"] or '-'
                } for row in rows]

                if not products:
                    return "Нет товаров, соответствующих фильтру", 404

                pdf = FPDF()
                pdf.add_page()

                arial_path = "C:/Windows/Fonts/arial.ttf"
                arial_bd_path = "C:/Windows/Fonts/arialbd.ttf"

                if not os.path.exists(arial_path):
                    return "Системный шрифт Arial не найден", 500

                pdf.add_font('Arial', '', arial_path, uni=True)
                if os.path.exists(arial_bd_path):
                    pdf.add_font('Arial', 'B', arial_bd_path, uni=True)
                else:
                    pdf.add_font('Arial', 'B', arial_path, uni=True)

                pdf.set_font('Arial', 'B', 16)
                pdf.cell(0, 10, 'Прайс-лист', ln=True, align='C')
                pdf.set_font('Arial', '', 10)
                filter_text = f"Категория: {'Все' if not category_id else 'выбрана'}"
                if only_in_stock:
                    filter_text += " | Только в наличии"
                pdf.cell(0, 10, filter_text, ln=True, align='C')
                pdf.ln(5)

                pdf.set_font('Arial', 'B', 9)
                headers = ['ID', 'Наименование', 'Категория', 'Цена', 'Гарантия', 'Остаток']
                col_widths = [15, 70, 40, 25, 25, 20]
                pdf.set_fill_color(255, 107, 0)
                pdf.set_text_color(255, 255, 255)
                for i, header in enumerate(headers):
                    pdf.cell(col_widths[i], 10, header, border=1, align='C', fill=True)
                pdf.ln()
                pdf.set_text_color(0, 0, 0)
                pdf.set_font('Arial', '', 9)

                for item in products:
                    pdf.cell(col_widths[0], 8, str(item['id']), border=1, align='C')
                    name = item['name'][:50] + ('...' if len(item['name']) > 50 else '')
                    pdf.cell(col_widths[1], 8, name, border=1)
                    pdf.cell(col_widths[2], 8, item['category'], border=1)
                    pdf.cell(col_widths[3], 8, f"{item['price']:.2f} ₽", border=1, align='R')
                    pdf.cell(col_widths[4], 8, item['guarantee'] or '-', border=1)
                    pdf.cell(col_widths[5], 8, str(item['stock']), border=1, align='C')
                    pdf.ln()

                pdf.ln(5)
                pdf.set_font('Arial', '', 8)
                pdf.cell(0, 10, f'Прайс-лист от {datetime.now().strftime("%d.%m.%Y")}', ln=True, align='R')

                pdf_output = io.BytesIO()
                pdf.output(pdf_output)
                pdf_output.seek(0)

                return send_file(
                    pdf_output,
                    download_name=f"price_list_{datetime.now().strftime('%Y%m%d')}.pdf",
                    as_attachment=True,
                    mimetype='application/pdf'
                )
    except Exception as e:
        traceback.print_exc()
        return str(e), 500

# накладная для клиента
@app.route("/api/order/<int:order_id>/receipt", methods=["GET"])
def order_receipt(order_id):
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return "Не указан пользователь", 400

    try:
        with db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT o.idOrder, o.date_order, o.total_price, o.id_state,
                           c.FIO, c.Email_clients, o.delivery_address
                    FROM Orders o
                    JOIN Clients c ON o.id_clients = c.id_clients
                    WHERE o.idOrder = %s AND o.id_clients = %s
                """, (order_id, user_id))
                order = cursor.fetchone()
                if not order:
                    return "Заказ не найден или доступ запрещён", 404

                if order['id_state'] == 5:
                    return "Невозможно сгенерировать накладную для отменённого заказа", 400

                cursor.execute("""
                    SELECT p.Name_Product, oi.quantity, oi.price, oi.subtotal, p.Guarantee
                    FROM Order_items oi
                    JOIN Product p ON oi.id_product = p.idProduct
                    WHERE oi.id_Order = %s
                """, (order_id,))
                items = cursor.fetchall()
                if not items:
                    return "Заказ не содержит товаров", 404

                pdf = FPDF()
                pdf.add_page()

                arial_path = "C:/Windows/Fonts/arial.ttf"
                arial_bd_path = "C:/Windows/Fonts/arialbd.ttf"
                if not os.path.exists(arial_path):
                    return "Системный шрифт Arial не найден", 500

                pdf.add_font('Arial', '', arial_path, uni=True)
                if os.path.exists(arial_bd_path):
                    pdf.add_font('Arial', 'B', arial_bd_path, uni=True)
                else:
                    pdf.add_font('Arial', 'B', arial_path, uni=True)

                pdf.set_font('Arial', '', 10)

                pdf.set_font('Arial', 'B', 16)
                pdf.cell(0, 10, 'Накладная', ln=True, align='C')
                pdf.ln(5)

                pdf.set_font('Arial', '', 10)
                pdf.cell(0, 10, f'Заказ №{order["idOrder"]} от {order["date_order"].strftime("%d.%m.%Y")}', ln=True, align='C')
                pdf.ln(5)

                pdf.set_font('Arial', 'B', 10)
                pdf.cell(0, 10, 'Покупатель:', ln=True)
                pdf.set_font('Arial', '', 10)
                pdf.cell(0, 8, f'ФИО: {order["FIO"]}', ln=True)
                pdf.cell(0, 8, f'Email: {order["Email_clients"]}', ln=True)
                if order['delivery_address']:
                    pdf.cell(0, 8, f'Адрес доставки: {order["delivery_address"]}', ln=True)
                pdf.ln(5)

                pdf.set_font('Arial', 'B', 9)
                headers = ['Наименование', 'Кол-во', 'Цена', 'Гарантия', 'Сумма']
                col_widths = [80, 20, 30, 30, 30]
                pdf.set_fill_color(255, 107, 0)
                pdf.set_text_color(255, 255, 255)
                for i, header in enumerate(headers):
                    pdf.cell(col_widths[i], 10, header, border=1, align='C', fill=True)
                pdf.ln()
                pdf.set_text_color(0, 0, 0)
                pdf.set_font('Arial', '', 9)

                for item in items:
                    name = item['Name_Product'][:45] + ('...' if len(item['Name_Product']) > 45 else '')
                    pdf.cell(col_widths[0], 8, name, border=1)
                    pdf.cell(col_widths[1], 8, str(item['quantity']), border=1, align='C')
                    pdf.cell(col_widths[2], 8, f"{item['price']:.2f} ₽", border=1, align='R')
                    pdf.cell(col_widths[3], 8, item['Guarantee'] or '-', border=1, align='C')
                    pdf.cell(col_widths[4], 8, f"{item['subtotal']:.2f} ₽", border=1, align='R')
                    pdf.ln()

                pdf.ln(5)
                pdf.set_font('Arial', 'B', 10)
                pdf.cell(0, 10, f'ИТОГО: {order["total_price"]:.2f} ₽', ln=True, align='R')

                pdf.ln(5)
                pdf.set_font('Arial', '', 8)
                pdf.cell(0, 10, f'Дата формирования: {datetime.now().strftime("%d.%m.%Y")}', ln=True, align='R')
                pdf_output = io.BytesIO()
                pdf.output(pdf_output)
                pdf_output.seek(0)

                return send_file(
                    pdf_output,
                    download_name=f"receipt_{order_id}.pdf",
                    as_attachment=True,
                    mimetype='application/pdf'
                )
    except Exception as e:
        traceback.print_exc()
        return f"Ошибка сервера: {e}", 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)