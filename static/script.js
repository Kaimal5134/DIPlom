document.addEventListener('DOMContentLoaded', function() {
    // элементы для авторизации
    const authBtn = document.getElementById('authBtn');
    const authDropdown = document.getElementById('authDropdown');
    const authForm = document.getElementById('authForm');
    const loginInput = document.getElementById('login');
    const passwordInput = document.getElementById('password');

    if (!authBtn || !authDropdown || !authForm || !loginInput || !passwordInput) {
        console.error('Ошибка: не найдены элементы авторизации');
        return;
    }

    // ссылки переключения режимов
    const formLinks = document.querySelector('.form-links');
    if (!formLinks) {
        console.error('Не найден .form-links');
        return;
    }

    const registerLink = formLinks.querySelector('a');
    if (!registerLink) {
        console.error('Не найдена ссылка "Регистрация"');
        return;
    }

    const loginLink = document.createElement('a');
    loginLink.href = '#';
    loginLink.textContent = 'Вход';
    loginLink.style.display = 'none';
    formLinks.appendChild(loginLink);

    // поля для регистрации 
    const fioGroup = document.createElement('div');
    fioGroup.className = 'form-group';
    fioGroup.innerHTML = `
        <label for="fio">ФИО:</label>
        <input type="text" id="fio" placeholder="Введите ФИО" required>
    `;
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    emailGroup.innerHTML = `
        <label for="email">Email:</label>
        <input type="email" id="email" placeholder="Введите email" required>
    `;

    const formGroups = authForm.querySelectorAll('.form-group');
    const lastFormGroup = formGroups[formGroups.length - 1];
    if (lastFormGroup) {
        lastFormGroup.insertAdjacentElement('afterend', fioGroup);
        lastFormGroup.insertAdjacentElement('afterend', emailGroup);
    } else {
        authForm.appendChild(fioGroup);
        authForm.appendChild(emailGroup);
    }

    fioGroup.style.display = 'none';
    emailGroup.style.display = 'none';

    const fioInput = document.getElementById('fio');
    const emailInput = document.getElementById('email');

    let mode = 'login';

    // счётчик открытых модальных окон для блокировки скролла
    let modalCounter = 0;

    function addBodyLock() {
        modalCounter++;
        if (modalCounter === 1) {
            document.body.classList.add('modal-open');
        }
    }

    function removeBodyLock() {
        if (modalCounter > 0) {
            modalCounter--;
            if (modalCounter === 0) {
                document.body.classList.remove('modal-open');
            }
        }
    }

    function containsWhitespace(str) {
        return /\s/.test(str);
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function setMode(newMode) {
        mode = newMode;
        if (mode === 'login') {
            fioGroup.style.display = 'none';
            emailGroup.style.display = 'none';
            fioInput.required = false;
            emailInput.required = false;
            authForm.querySelector('h3').textContent = 'Вход в систему';
            authForm.querySelector('.submit-btn').textContent = 'Войти';
            registerLink.style.display = 'inline';
            loginLink.style.display = 'none';
        } else {
            fioGroup.style.display = 'block';
            emailGroup.style.display = 'block';
            fioInput.required = true;
            emailInput.required = true;
            authForm.querySelector('h3').textContent = 'Регистрация';
            authForm.querySelector('.submit-btn').textContent = 'Зарегистрироваться';
            registerLink.style.display = 'none';
            loginLink.style.display = 'inline';
        }
    }

    registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        setMode('register');
    });
    loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        setMode('login');
    });

    // Меню пользователя 
    const userMenu = document.createElement('div');
    userMenu.id = 'userMenu';
    userMenu.className = 'user-menu';
    userMenu.style.display = 'none';
    authBtn.insertAdjacentElement('afterend', userMenu);

    function updateAuthButton(user) {
        const displayName = (user.client && user.client.fio) ? user.client.fio : user.login;
        authBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${displayName}`;
    }
    function resetAuthButton() {
        authBtn.innerHTML = `<i class="fas fa-user-circle"></i> Авторизация`;
    }

    let isAdmin = false;

    function updateUIBasedOnRole() {
        const cartSection = document.querySelector('.cart-section');
        if (isAdmin) {
            if (cartSection) cartSection.style.display = 'none';
            userMenu.innerHTML = `
                <ul>
                    <li id="adminPanelBtn">Админ-панель</li>
                    <li id="logoutBtn">Выйти</li>
                </ul>
            `;
        } else {
            if (cartSection) cartSection.style.display = '';
            userMenu.innerHTML = `
                <ul>
                    <li id="ordersHistoryBtn">История заказов</li>
                    <li id="logoutBtn">Выйти</li>
                </ul>
            `;
        }
    }

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            updateAuthButton(user);
            isAdmin = (user.role && user.role.toLowerCase() === 'admin');
            updateUIBasedOnRole();
        } catch {
            localStorage.removeItem('user');
        }
    }

    userMenu.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target.closest('li');
        if (!target) return;

        if (target.id === 'adminPanelBtn') {
            userMenu.style.display = 'none';
            window.location.href = 'admin.html';
        } else if (target.id === 'ordersHistoryBtn') {
            userMenu.style.display = 'none';
            openOrdersModal();
        } else if (target.id === 'logoutBtn') {
            localStorage.removeItem('user');
            resetAuthButton();
            userMenu.style.display = 'none';
            authDropdown.style.display = 'none';
            isAdmin = false;
            updateUIBasedOnRole();

            // очистка корзины при сбросе
            cart = [];
            saveCart();
            updateCartUI();

            // перезагрузить каталог с обычным режимом
            loadProductsWithFilters();
        }
    });

    authBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const userData = localStorage.getItem('user');
        if (userData) {
            // закрываем корзину перед открытием меню 
            if (cartDropdown) cartDropdown.style.display = 'none';
            userMenu.style.display = userMenu.style.display === 'block' ? 'none' : 'block';
        } else {
            // закрываем корзину перед открытием входа
            if (cartDropdown) cartDropdown.style.display = 'none';
            setMode('login');
            authDropdown.style.display = authDropdown.style.display === 'block' ? 'none' : 'block';
        }
    });

    document.addEventListener('click', function(e) {
        if (!authBtn.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.style.display = 'none';
        }
        if (!authBtn.contains(e.target) && !authDropdown.contains(e.target)) {
            authDropdown.style.display = 'none';
        }
    });
    authDropdown.addEventListener('click', (e) => e.stopPropagation());

    // формы авторизации/регистрации
    authForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const login = loginInput.value.trim();
        const password = passwordInput.value;

        if (mode === 'login') {
            if (!login || !password) {
                alert('Заполните все поля');
                return;
            }
            if (containsWhitespace(login) || containsWhitespace(password)) {
                alert('Логин и пароль не должны содержать пробелов');
                return;
            }
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login, password })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    const name = (data.user.client?.fio) ? data.user.client.fio : data.user.login;
                    alert(`Добро пожаловать, ${name}!`);
                    updateAuthButton(data.user);
                    isAdmin = (data.user.role && data.user.role.toLowerCase() === 'admin');
                    updateUIBasedOnRole();
                    authForm.reset();
                    authDropdown.style.display = 'none';
                    if (isAdmin) {
                        window.location.href = 'admin.html';
                    } else {
                        loadProductsWithFilters();
                    }
                } else {
                    alert('Ошибка: ' + data.message);
                }
            } catch (err) {
                console.error(err);
                alert('Сервер не отвечает. Запустите бэкенд.');
            }
        } else {
            const fio = fioInput.value.trim();
            const email = emailInput.value.trim();
            if (!login || !password || !fio || !email) {
                alert('Заполните все поля');
                return;
            }
            if (containsWhitespace(login) || containsWhitespace(password) || containsWhitespace(email)) {
                alert('Логин, пароль и email не должны содержать пробелов');
                return;
            }
            if (!isValidEmail(email)) {
                alert('Введите корректный email (например, name@mail.ru)');
                return;
            }
            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login, password, fio, email })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Регистрация успешна! Теперь войдите.');
                    setMode('login');
                    authForm.reset();
                } else {
                    alert('Ошибка: ' + data.message);
                }
            } catch (err) {
                console.error(err);
                alert('Сервер не отвечает.');
            }
        }
    });

    // каталог товаров 
    async function loadCategories() {
        try {
            const res = await fetch('/api/categories');
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            if (data.success) {
                const select = document.getElementById('categorySelect');
                if (select) {
                    data.categories.forEach(cat => {
                        const opt = document.createElement('option');
                        opt.value = cat;
                        opt.textContent = cat;
                        select.appendChild(opt);
                    });
                }
            }
        } catch (err) {
            console.error('Ошибка загрузки категорий:', err);
        }
    }

    async function loadProductsWithFilters() {
        const search = document.getElementById('searchInput')?.value.trim() || '';
        const category = document.getElementById('categorySelect')?.value || '';
        let url = '/api/products?';
        const params = [];
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (category) params.push(`category=${encodeURIComponent(category)}`);
        url += params.join('&');

        try {
            const res = await fetch(url, {
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            if (data.success) renderProducts(data.products);
            else console.error('Ошибка загрузки товаров:', data.message);
        } catch (err) {
            console.error('Ошибка при запросе товаров:', err);
        }
    }

    // изменения в localStorage после редактирования/удаления в админе
    window.addEventListener('storage', (e) => {
        if (e.key === 'productsUpdated') {
            console.log('Обновление каталога после изменений в админке');
            loadProductsWithFilters();
        }
    });

    // обновление каталога при возврате на страницу 
    window.addEventListener('pageshow', function(event) {
        console.log('Событие pageshow, обновляем каталог');
        loadProductsWithFilters();
    });

    window.addEventListener('focus', function() {
        console.log('Вкладка получила фокус, обновляем каталог');
        loadProductsWithFilters();
    });

    function renderProducts(products) {
        const container = document.getElementById('productsContainer');
        if (!container) return;
        container.innerHTML = '';

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';

            const imageHtml = p.image_url
                ? `<img src="${p.image_url}" alt="${p.Name_Product}">`
                : '<i class="fas fa-image"></i>';

            let buttonHtml = '';
            if (!isAdmin) {
                buttonHtml = p.Col_Product > 0
                    ? `<button class="btn-details" data-id="${p.idProduct}">Подробнее</button>`
                    : '<button class="btn-details disabled" disabled>Нет в наличии</button>';
            }

            card.innerHTML = `
                <div class="product-image">${imageHtml}</div>
                <div class="product-info">
                    <div class="product-name">${p.Name_Product}</div>
                    <div class="product-type">${p.name_type || 'Без типа'}</div>
                    <div class="product-details">
                        <span class="product-price">${p.Price} ₽</span>
                        <span class="product-stock">Осталось: ${p.Col_Product}</span>
                    </div>
                    <div class="product-guarantee">Гарантия: ${p.Guarantee || 'Нет'}</div>
                    ${buttonHtml}
                </div>
            `;
            container.appendChild(card);

            if (!isAdmin) {
                const btn = card.querySelector('.btn-details:not(.disabled)');
                if (btn) {
                    btn.addEventListener('click', () => openProductModal(p));
                }
            }
        });
    }

    // Модальное окно товара 
    const modal = document.getElementById('productModal');
    const modalDetails = document.getElementById('modalProductDetails');
    const closeModal = document.querySelector('.close-modal');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const modalQuantity = document.getElementById('modalQuantity');
    let currentProduct = null;

    // не дает писать в поле количество 
    if (modalQuantity) {
        modalQuantity.addEventListener('keydown', (e) => {
            const allowedKeys = [
                'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
                'ArrowUp', 'ArrowDown', 'Home', 'End'
            ];
            if (allowedKeys.includes(e.key)) return;
            if (e.key === '+' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                return;
            }
            if (!/^\d$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    function closeProductModal() {
        if (modal) {
            removeBodyLock();
            modal.style.display = 'none';
        }
    }
    if (closeModal) closeModal.addEventListener('click', closeProductModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeProductModal();
    });

    function openProductModal(product) {
        if (!modal || !modalDetails) return;
        currentProduct = product;
        modalDetails.innerHTML = `
            <div class="modal-product-image">
                ${product.image_url ? `<img src="${product.image_url}" alt="${product.Name_Product}">` : '<i class="fas fa-image"></i>'}
            </div>
            <h2>${product.Name_Product}</h2>
            <p class="product-type">${product.name_type || 'Без типа'}</p>
            <p class="product-price">${product.Price} ₽</p>
            <p class="product-stock">Наличие: ${product.Col_Product} шт.</p>
            <p class="product-guarantee">Гарантия: ${product.Guarantee || 'Нет'}</p>
        `;

        const actions = document.querySelector('.modal-actions');
        if (actions) {
            if (isAdmin) {
                actions.style.display = 'none';
            } else {
                actions.style.display = 'flex';
            }
        }

        if (modalQuantity && !isAdmin) {
            modalQuantity.value = 1;
            modalQuantity.max = product.Col_Product;
            modalQuantity.disabled = (product.Col_Product <= 0);
        }
        if (addToCartBtn && !isAdmin) {
            addToCartBtn.disabled = (product.Col_Product <= 0);
            addToCartBtn.textContent = (product.Col_Product <= 0) ? 'Нет в наличии' : 'Добавить в корзину';
        }
        modal.style.display = 'flex';
        addBodyLock();
    }

    // корзина
    const cartBtn = document.getElementById('cartBtn');
    const cartDropdown = document.getElementById('cartDropdown');
    const cartCountSpan = document.getElementById('cartCount');
    let cart = [];

    function loadCart() {
        const saved = localStorage.getItem('cart');
        try { cart = saved ? JSON.parse(saved) : []; } catch { cart = []; }
        updateCartUI();
    }
    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    function updateCartUI() {
        if (isAdmin) return;
        const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
        if (cartCountSpan) cartCountSpan.textContent = totalItems;
        if (!cartDropdown) return;

        if (cart.length === 0) {
            cartDropdown.innerHTML = '<p class="empty-cart">Корзина пуста</p>';
        } else {
            let html = '';
            cart.forEach((item, idx) => {
                html += `
                    <div class="cart-item">
                        <span>${item.name} x${item.quantity}</span>
                        <span>${(parseFloat(item.price) * item.quantity).toFixed(2)} ₽</span>
                        <button class="remove-item" data-index="${idx}">✖</button>
                    </div>
                `;
            });
            const total = cart.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
            html += `<div class="cart-total">Итого: ${total.toFixed(2)} ₽</div>`;
            html += `<button id="checkoutBtn" class="checkout-btn">Оформить заказ</button>`;
            cartDropdown.innerHTML = html;

            document.querySelectorAll('.remove-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = e.target.dataset.index;
                    cart.splice(index, 1);
                    saveCart();
                    updateCartUI();
                });
            });

            const checkoutBtn = document.getElementById('checkoutBtn');
            if (checkoutBtn) {
                checkoutBtn.addEventListener('click', () => {
                    const userData = localStorage.getItem('user');
                    if (!userData) {
                        alert('Необходимо авторизоваться');
                        return;
                    }
                    const user = JSON.parse(userData);
                    if (!user.client || !user.client.id_clients) {
                        alert('Для оформления заказа необходимо быть клиентом');
                        return;
                    }
                    if (cart.length === 0) {
                        alert('Корзина пуста');
                        return;
                    }

                    // модальное окно подтверждения
                    const modal = document.createElement('div');
                    modal.className = 'modal';
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    modal.style.zIndex = '10002';

                    const content = document.createElement('div');
                    content.className = 'modal-content';
                    content.style.maxWidth = '600px';
                    content.style.width = '90%';
                    content.style.maxHeight = '80vh';
                    content.style.overflowY = 'auto';

                    const closeBtn = document.createElement('span');
                    closeBtn.className = 'close-modal';
                    closeBtn.innerHTML = '&times;';
                    closeBtn.onclick = () => {
                        document.body.removeChild(modal);
                        removeBodyLock();
                    };
                    content.appendChild(closeBtn);

                    const title = document.createElement('h2');
                    title.textContent = 'Подтверждение заказа';
                    title.style.marginBottom = '20px';
                    content.appendChild(title);

                    const clientInfo = document.createElement('div');
                    clientInfo.style.marginBottom = '20px';
                    clientInfo.style.padding = '10px';
                    clientInfo.style.backgroundColor = '#f9f9f9';
                    clientInfo.style.borderRadius = '5px';
                    clientInfo.innerHTML = `
                        <p><strong>ФИО:</strong> ${user.client.fio || 'Не указано'}</p>
                        <p><strong>Email:</strong> ${user.client.email || 'Не указан'}</p>
                    `;
                    content.appendChild(clientInfo);

                    const itemsDiv = document.createElement('div');
                    itemsDiv.style.marginBottom = '20px';
                    itemsDiv.innerHTML = '<h3 style="margin-bottom:10px;">Ваш заказ:</h3>';

                    const table = document.createElement('table');
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                    table.innerHTML = `
                        <thead>
                            <tr>
                                <th style="text-align:left; border-bottom:1px solid #ddd; padding:5px;">Товар</th>
                                <th style="text-align:center; border-bottom:1px solid #ddd; padding:5px;">Кол-во</th>
                                <th style="text-align:right; border-bottom:1px solid #ddd; padding:5px;">Цена</th>
                                <th style="text-align:right; border-bottom:1px solid #ddd; padding:5px;">Сумма</th>
                            </tr>
                        </thead>
                        <tbody>
                    `;
                    cart.forEach(item => {
                        const price = parseFloat(item.price);
                        table.innerHTML += `
                            <tr>
                                <td style="padding:5px;">${item.name}</td>
                                <td style="text-align:center; padding:5px;">${item.quantity}</td>
                                <td style="text-align:right; padding:5px;">${price.toFixed(2)} ₽</td>
                                <td style="text-align:right; padding:5px;">${(price * item.quantity).toFixed(2)} ₽</td>
                            </tr>
                        `;
                    });
                    const total = cart.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
                    table.innerHTML += `
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="text-align:right; font-weight:bold; padding:5px;">Итого:</td>
                                <td style="text-align:right; font-weight:bold; padding:5px;">${total.toFixed(2)} ₽</td>
                            </tr>
                        </tfoot>
                    `;
                    itemsDiv.appendChild(table);
                    content.appendChild(itemsDiv);

                    // Блок выбора способа оплаты
                    const paymentDiv = document.createElement('div');
                    paymentDiv.style.marginBottom = '20px';
                    paymentDiv.innerHTML = `
                        <label style="display:block; margin-bottom:5px; font-weight:bold;">Способ оплаты:</label>
                        <label style="margin-right:15px;">
                            <input type="radio" name="payment" value="cash" checked> Наличными
                        </label>
                        <label>
                            <input type="radio" name="payment" value="card" disabled> Картой (недоступно)
                        </label>
                    `;
                    content.appendChild(paymentDiv);

                    const addressDiv = document.createElement('div');
                    addressDiv.style.marginBottom = '20px';
                    addressDiv.innerHTML = `
                        <label for="addressInput" style="display:block; margin-bottom:5px; font-weight:bold;">Адрес доставки (макс. 100 символов):</label>
                        <input type="text" id="addressInput" placeholder="Введите адрес" maxlength="100" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
                    `;
                    content.appendChild(addressDiv);

                    const buttonsDiv = document.createElement('div');
                    buttonsDiv.style.display = 'flex';
                    buttonsDiv.style.justifyContent = 'flex-end';
                    buttonsDiv.style.gap = '10px';
                    buttonsDiv.style.marginTop = '20px';

                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'btn-details';
                    cancelBtn.style.backgroundColor = 'var(--light-gray)';
                    cancelBtn.style.color = 'var(--dark-gray)';
                    cancelBtn.textContent = 'Отмена';
                    cancelBtn.onclick = () => {
                        document.body.removeChild(modal);
                        removeBodyLock();
                    };

                    const payBtn = document.createElement('button');
                    payBtn.className = 'btn-primary';
                    payBtn.textContent = 'Оплатить';
                    payBtn.onclick = async () => {
                        // Проверка способа оплаты
                        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
                        if (paymentMethod !== 'cash') {
                            alert('Оплата картой временно недоступна. Выберите наличные.');
                            return;
                        }

                        const addressInput = document.getElementById('addressInput');
                        const address = addressInput?.value.trim();
                        if (!address) {
                            alert('Пожалуйста, укажите адрес доставки');
                            return;
                        }

                        document.body.removeChild(modal);
                        removeBodyLock();

                        try {
                            const response = await fetch('/api/checkout', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    user_id: user.client.id_clients,
                                    items: cart.map(item => ({ id: item.id, quantity: item.quantity })),
                                    address: address,
                                    payment_method: paymentMethod
                                })
                            });
                            const data = await response.json();
                            if (data.success) {
                                alert(`Заказ №${data.order_id} успешно оформлен!`);
                                cart = [];
                                saveCart();
                                updateCartUI();
                                loadProductsWithFilters();
                            } else {
                                alert('Ошибка: ' + data.message);
                            }
                        } catch (err) {
                            console.error(err);
                            alert('Ошибка при оформлении заказа. Проверьте соединение с сервером.');
                        }
                    };

                    buttonsDiv.appendChild(cancelBtn);
                    buttonsDiv.appendChild(payBtn);
                    content.appendChild(buttonsDiv);
                    modal.appendChild(content);
                    document.body.appendChild(modal);
                    addBodyLock();

                    // Закрытие по клику на фон
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            document.body.removeChild(modal);
                            removeBodyLock();
                        }
                    });
                });
            }
        }
    }

    function addToCart(product, qty) {
        if (qty < 1) {
            alert('Количество должно быть не менее 1');
            return false;
        }
        if (isAdmin) return false;
        const existing = cart.find(item => item.id === product.idProduct);
        const currentQty = existing ? existing.quantity : 0;
        if (currentQty + qty > product.Col_Product) {
            alert(`Нельзя добавить больше ${product.Col_Product} шт. товара "${product.Name_Product}". В корзине уже ${currentQty} шт.`);
            return false;
        }
        if (existing) {
            existing.quantity += qty;
        } else {
            cart.push({
                id: product.idProduct,
                name: product.Name_Product,
                price: parseFloat(product.Price),
                quantity: qty
            });
        }
        saveCart();
        updateCartUI();
        return true;
    }

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            if (isAdmin) {
                alert('Администратор не может добавлять товары в корзину.');
                return;
            }
            if (!localStorage.getItem('user')) {
                alert('Необходимо авторизоваться');
                return;
            }
            if (!currentProduct) return;
            const qty = parseInt(modalQuantity.value);
            if (isNaN(qty) || qty < 1) {
                alert('Укажите корректное количество (целое число не менее 1)');
                return;
            }
            if (qty > currentProduct.Col_Product) {
                alert(`Нельзя добавить больше ${currentProduct.Col_Product} шт.`);
                return;
            }
            const added = addToCart(currentProduct, qty);
            if (added) {
                alert('Товар добавлен в корзину');
                closeProductModal();
            }
        });
    }

    if (cartBtn) {
        cartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (authDropdown) authDropdown.style.display = 'none';
            if (userMenu) userMenu.style.display = 'none';
            if (cartDropdown) {
                cartDropdown.style.display = cartDropdown.style.display === 'block' ? 'none' : 'block';
            }
        });
    }
    document.addEventListener('click', (e) => {
        if (cartBtn && !cartBtn.contains(e.target) && cartDropdown && !cartDropdown.contains(e.target)) {
            cartDropdown.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            authDropdown.style.display = 'none';
            userMenu.style.display = 'none';
            if (cartDropdown) cartDropdown.style.display = 'none';
        }
    });

    // функция отмены заказа 
    async function cancelOrder(orderId) {
        const userData = localStorage.getItem('user');
        if (!userData) {
            alert('Необходимо авторизоваться');
            return;
        }
        const user = JSON.parse(userData);
        if (!user.client || !user.client.id_clients) {
            alert('Не удалось определить клиента');
            return;
        }
        if (!confirm('Вы уверены, что хотите отменить заказ?')) return;

        try {
            const response = await fetch('/api/order/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: orderId,
                    user_id: user.client.id_clients
                })
            });
            const data = await response.json();
            if (data.success) {
                alert('Заказ успешно отменён');
                loadProductsWithFilters();
                // Закрыть все модалки истории перед открытием новой
                document.querySelectorAll('.orders-modal').forEach(el => {
                    el.remove();
                    removeBodyLock();
                });
                openOrdersModal();
            } else {
                alert('Ошибка: ' + data.message);
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка соединения с сервером');
        }
    }

    // функция скачивания накладной
    async function downloadInvoice(orderId) {
        const userData = localStorage.getItem('user');
        if (!userData) {
            alert('Необходимо авторизоваться');
            return;
        }
        const user = JSON.parse(userData);
        if (!user.client || !user.client.id_clients) {
            alert('Не удалось определить клиента');
            return;
        }

        const url = new URL(`/api/order/${orderId}/receipt`, window.location.origin);
        url.searchParams.append('user_id', user.client.id_clients);
        url.searchParams.append('_', Date.now());

        try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response.ok) {
                const errorText = await response.text();
                alert(`Ошибка: ${errorText}`);
                return;
            }
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `nakladnaya_${orderId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error(err);
            alert('Ошибка соединения с сервером');
        }
    }

    // модальное окно истории заказов
    async function openOrdersModal() {
        if (cartDropdown) cartDropdown.style.display = 'none';

        const userData = localStorage.getItem('user');
        if (!userData) {
            alert('Необходимо авторизоваться');
            return;
        }
        const user = JSON.parse(userData);
        if (!user.client || !user.client.id_clients) {
            alert('История заказов доступна только клиентам');
            return;
        }

        try {
            const response = await fetch(`/api/orders?user_id=${user.client.id_clients}`);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const data = await response.json();
            console.log('Данные заказов:', data);
            if (!data.success) {
                alert('Ошибка загрузки заказов: ' + data.message);
                return;
            }

            // Закрыть предыдущие модалки
            document.querySelectorAll('.orders-modal').forEach(el => {
                el.remove();
                removeBodyLock();
            });

            const modal = document.createElement('div');
            modal.className = 'orders-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
            modal.style.zIndex = '10000';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';

            const content = document.createElement('div');
            content.style.backgroundColor = 'white';
            content.style.padding = '30px';
            content.style.borderRadius = '10px';
            content.style.maxWidth = '800px';
            content.style.width = '90%';
            content.style.maxHeight = '80vh';
            content.style.overflowY = 'auto';
            content.style.position = 'relative';

            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '10px';
            closeBtn.style.right = '20px';
            closeBtn.style.fontSize = '30px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.color = '#aaa';
            closeBtn.onclick = () => {
                modal.remove();
                removeBodyLock();
            };
            content.appendChild(closeBtn);

            const title = document.createElement('h2');
            title.textContent = 'История заказов';
            title.style.marginBottom = '20px';
            content.appendChild(title);

            const listDiv = document.createElement('div');

            if (!data.orders || data.orders.length === 0) {
                listDiv.innerHTML = '<p style="text-align:center;">У вас пока нет заказов.</p>';
            } else {
                let ordersHtml = '';
                data.orders.forEach(order => {
                    const canCancel = order.state_id === 1;
                    const canDownload = order.state_id !== 5;

                    ordersHtml += `
                        <div style="border:1px solid #ccc; border-radius:8px; padding:15px; margin-bottom:15px; background:white; color:black;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-weight:bold;">
                                <span>Заказ №${order.id} от ${order.date}</span>
                                <span>Статус: ${order.status}</span>
                                <span>Сумма: ${order.total.toFixed(2)} ₽</span>
                            </div>
                            ${order.address ? `<div style="margin-bottom:10px; font-size:0.9rem;"><strong>Адрес доставки:</strong> ${order.address}</div>` : ''}
                            <div style="padding-left:20px; border-top:1px solid #eee; padding-top:10px;">
                    `;
                    if (order.items && order.items.length > 0) {
                        order.items.forEach(item => {
                            ordersHtml += `
                                <div style="display:flex; justify-content:space-between; padding:5px 0;">
                                    <span>${item.name}</span>
                                    <span>${item.quantity} x ${item.price.toFixed(2)} ₽ = ${item.subtotal.toFixed(2)} ₽</span>
                                </div>
                            `;
                        });
                    } else {
                        ordersHtml += '<p>Нет позиций</p>';
                    }
                    ordersHtml += `<div style="margin-top:10px; text-align:right;">`;
                    if (canCancel) {
                        ordersHtml += `
                            <button class="cancel-order-btn" data-order-id="${order.id}" style="background-color:#ff4444; color:white; border:none; border-radius:5px; padding:8px 15px; cursor:pointer; margin-right:10px;">Отменить заказ</button>
                        `;
                    }
                    if (canDownload) {
                        ordersHtml += `
                            <button class="download-invoice-btn" data-order-id="${order.id}" style="background-color:#4CAF50; color:white; border:none; border-radius:5px; padding:8px 15px; cursor:pointer;">Скачать накладную</button>
                        `;
                    }
                    ordersHtml += `</div>`;
                    ordersHtml += '</div></div>';
                });
                listDiv.innerHTML = ordersHtml;

                listDiv.querySelectorAll('.cancel-order-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const orderId = e.target.dataset.orderId;
                        cancelOrder(orderId);
                    });
                });

                listDiv.querySelectorAll('.download-invoice-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const orderId = e.target.dataset.orderId;
                        downloadInvoice(orderId);
                    });
                });
            }

            content.appendChild(listDiv);
            modal.appendChild(content);
            document.body.appendChild(modal);
            addBodyLock();

            // Закрытие по клику на фон
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    removeBodyLock();
                }
            });
        } catch (err) {
            console.error(err);
            alert('Ошибка соединения с сервером');
        }
    }

    // Инициализация (обновления)
    loadCart();
    loadCategories();
    loadProductsWithFilters();

    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const categorySelect = document.getElementById('categorySelect');

    if (searchBtn) searchBtn.addEventListener('click', loadProductsWithFilters);
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadProductsWithFilters();
        });
    }
    if (categorySelect) categorySelect.addEventListener('change', loadProductsWithFilters);
});