document.addEventListener('DOMContentLoaded', async function() {
    // Проверка прав доступа
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    const user = JSON.parse(userData);
    if (!user.role || user.role.toLowerCase() !== 'admin') {
        alert('Доступ запрещён');
        window.location.href = 'index.html';
        return;
    }

    // Счётчик открытых модальных окон для блокировки скролла
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

    // Выход
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    // Элементы разделов
    const productsSection = document.getElementById('productsSection');
    const categoriesSection = document.getElementById('categoriesSection');
    const ordersSection = document.getElementById('ordersSection');
    const reportsSection = document.getElementById('reportsSection');
    const priceListSection = document.getElementById('priceListSection');

    // Навигация
    document.getElementById('nav-products').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav('nav-products');
        showSection(productsSection);
        loadProducts();
    });
    document.getElementById('nav-orders').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav('nav-orders');
        showSection(ordersSection);
        loadOrders();
    });
    document.getElementById('nav-categories').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav('nav-categories');
        showSection(categoriesSection);
        loadCategories();
    });
    document.getElementById('nav-reports').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav('nav-reports');
        showSection(reportsSection);
        loadReportCategories();
    });
    document.getElementById('nav-pricelist').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav('nav-pricelist');
        showSection(priceListSection);
        loadPriceListCategories();
    });

    function showSection(section) {
        [productsSection, categoriesSection, ordersSection, reportsSection, priceListSection].forEach(s => s.style.display = 'none');
        section.style.display = 'block';
    }

    function setActiveNav(activeId) {
        document.querySelectorAll('.admin-nav a').forEach(link => link.classList.remove('active'));
        document.getElementById(activeId).classList.add('active');
    }

    await loadProducts();

    document.getElementById('addProductBtn').addEventListener('click', () => openAddModal());
    document.getElementById('addCategoryBtn').addEventListener('click', () => openAddCategoryModal());
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    document.getElementById('downloadReportPdfBtn').addEventListener('click', downloadReportPdf);
    document.getElementById('generatePriceListBtn').addEventListener('click', showPriceList);
    document.getElementById('downloadPriceListPdfBtn').addEventListener('click', downloadPriceListPdf);

    // товары
    async function loadProducts() {
        const tbody = document.getElementById('productsTableBody');
        tbody.innerHTML = '<tr><td colspan="8">Загрузка...</td></tr>';

        try {
            const response = await fetch('http://127.0.0.1:5000/api/products');
            if (!response.ok) throw new Error('Ошибка загрузки');
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Неизвестная ошибка');

            if (data.products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8">Товары не найдены</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            data.products.forEach(product => {
                const row = document.createElement('tr');
                const photoHtml = product.image_url
                    ? `<img src="${product.image_url}" alt="${product.Name_Product}" style="width:50px; height:50px; object-fit:cover;">`
                    : '<i class="fas fa-image" style="font-size:2rem; color:#ccc;"></i>';

                row.innerHTML = `
                    <td>${product.idProduct}</td>
                    <td>${photoHtml}</td>
                    <td>${product.Name_Product}</td>
                    <td>${product.name_type || 'Без типа'}</td>
                    <td>${product.Price} ₽</td>
                    <td>${product.Col_Product}</td>
                    <td>${product.Guarantee || '—'}</td>
                    <td>
                        <button class="btn-icon edit-btn" data-id="${product.idProduct}" title="Редактировать"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-btn" data-id="${product.idProduct}" title="Удалить"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    openEditModal(id);
                });
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (!confirm(`Вы уверены, что хотите удалить товар #${id}?`)) return;

                    try {
                        const response = await fetch(`http://127.0.0.1:5000/api/products/${id}`, {
                            method: 'DELETE'
                        });
                        const data = await response.json();
                        if (data.success) {
                            alert('Товар удалён');
                            await loadProducts();
                            localStorage.setItem('productsUpdated', Date.now());
                        } else {
                            alert('Ошибка: ' + data.message);
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Ошибка соединения с сервером');
                    }
                });
            });

        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="8">Ошибка загрузки данных</td></tr>';
        }
    }

    // Модальное окно редактирования товара
    async function openEditModal(productId) {
        try {
            const prodResponse = await fetch(`http://127.0.0.1:5000/api/products/${productId}`);
            if (!prodResponse.ok) throw new Error('Ошибка загрузки товара');
            const prodData = await prodResponse.json();
            if (!prodData.success) throw new Error(prodData.message);
            const product = prodData.product;

            const catResponse = await fetch('http://127.0.0.1:5000/api/categories_with_id');
            const catData = await catResponse.json();
            if (!catData.success) throw new Error('Ошибка загрузки категорий');

            let categoryOptions = '';
            catData.categories.forEach(cat => {
                categoryOptions += `<option value="${cat.id}" ${cat.id === product.id_type_Product ? 'selected' : ''}>${cat.name}</option>`;
            });

            const guaranteeOptions = [
                'Без гарантии', '1 месяц', '3 месяца', '6 месяцев',
                '1 год', '2 года', '3 года', '5 лет'
            ];
            let guaranteeSelectHtml = '<select id="edit-guarantee">';
            guaranteeOptions.forEach(opt => {
                const selected = (opt === product.Guarantee) ? 'selected' : '';
                guaranteeSelectHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
            });
            guaranteeSelectHtml += '</select>';

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.zIndex = '10001';

            const content = document.createElement('div');
            content.className = 'modal-content';
            content.style.maxWidth = '600px';
            content.style.width = '90%';

            const closeBtn = document.createElement('span');
            closeBtn.className = 'close-modal';
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = () => {
                document.body.removeChild(modal);
                removeBodyLock();
            };
            content.appendChild(closeBtn);

            const title = document.createElement('h2');
            title.textContent = 'Редактирование товара';
            title.style.marginBottom = '20px';
            content.appendChild(title);

            const form = document.createElement('form');
            form.id = 'editProductForm';

            const currentPhotoHtml = product.image_url
                ? `<img src="${product.image_url}" alt="Фото" style="max-width: 100px; max-height: 100px; object-fit: contain;">`
                : '<i class="fas fa-image" style="font-size: 3rem; color: #ccc;"></i>';

            form.innerHTML = `
                <div class="form-group">
                    <label for="edit-name">Название товара *</label>
                    <input type="text" id="edit-name" value="${product.Name_Product}" required>
                </div>
                <div class="form-group">
                    <label for="edit-type">Тип товара *</label>
                    <select id="edit-type" required>
                        ${categoryOptions}
                    </select>
                </div>
                <div class="form-row" style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 1;">
                        <label for="edit-price">Цена (₽) *</label>
                        <input type="number" step="0.01" id="edit-price" value="${product.Price}" min="1" max="10000000" required>
                        <small style="color: #666;">от 1 до 10 000 000</small>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="edit-stock">Остаток на складе *</label>
                        <input type="number" id="edit-stock" value="${product.Col_Product}" min="0" max="1000" required>
                        <small style="color: #666;">от 0 до 1000</small>
                    </div>
                </div>
                <div class="form-group">
                    <label for="edit-guarantee">Гарантия</label>
                    ${guaranteeSelectHtml}
                </div>
                <div class="form-group">
                    <label>Текущее фото</label>
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                        <div id="currentPhotoContainer">${currentPhotoHtml}</div>
                        <button type="button" id="changePhotoBtn" class="btn-primary" style="padding: 8px 15px;">Изменить фото</button>
                    </div>
                    <div id="photoUpload" style="display: none;">
                        <input type="file" id="photoFile" accept="image/*">
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button type="button" id="cancelEditBtn" class="btn-details" style="background-color: var(--light-gray); color: var(--dark-gray);">Отмена</button>
                    <button type="submit" class="btn-primary">Сохранить</button>
                </div>
            `;

            content.appendChild(form);
            modal.appendChild(content);
            document.body.appendChild(modal);
            addBodyLock();

            const priceInput = document.getElementById('edit-price');
            const stockInput = document.getElementById('edit-stock');

            [priceInput, stockInput].forEach(input => {
                if (!input) return;
                input.addEventListener('keydown', (e) => {
                    const allowedKeys = [
                        'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
                        'ArrowUp', 'ArrowDown', 'Home', 'End'
                    ];
                    if (allowedKeys.includes(e.key)) return;
                    if (e.key === '+' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                        e.preventDefault();
                        return;
                    }
                    if (!/^\d$/.test(e.key) && e.key !== '.') {
                        e.preventDefault();
                    }
                });
                input.addEventListener('blur', function() {
                    let val = this.value;
                    val = val.replace(/^0+(?=\d)/, '');
                    if (val !== this.value) this.value = val;
                });
            });

            const changePhotoBtn = document.getElementById('changePhotoBtn');
            const photoUpload = document.getElementById('photoUpload');
            const photoFile = document.getElementById('photoFile');
            const currentPhotoContainer = document.getElementById('currentPhotoContainer');

            changePhotoBtn.addEventListener('click', () => {
                photoUpload.style.display = 'block';
                photoFile.click();
            });

            photoFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        currentPhotoContainer.innerHTML = `<img src="${event.target.result}" alt="Новое фото" style="max-width: 100px; max-height: 100px; object-fit: contain;">`;
                    };
                    reader.readAsDataURL(e.target.files[0]);
                } else {
                    currentPhotoContainer.innerHTML = product.image_url
                        ? `<img src="${product.image_url}" alt="Фото" style="max-width: 100px; max-height: 100px; object-fit: contain;">`
                        : '<i class="fas fa-image" style="font-size: 3rem; color: #ccc;"></i>';
                }
            });

            document.getElementById('cancelEditBtn').addEventListener('click', () => {
                document.body.removeChild(modal);
                removeBodyLock();
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const name = document.getElementById('edit-name').value.trim();
                const typeId = document.getElementById('edit-type').value;
                const price = parseFloat(document.getElementById('edit-price').value);
                const stock = parseInt(document.getElementById('edit-stock').value);
                const guarantee = document.getElementById('edit-guarantee').value;

                if (!name || !typeId) {
                    alert('Заполните все обязательные поля');
                    return;
                }
                if (isNaN(price) || price < 1 || price > 10000000) {
                    alert('Цена должна быть от 1 до 10 000 000');
                    return;
                }
                if (isNaN(stock) || stock < 0 || stock > 1000) {
                    alert('Количество должно быть от 0 до 1000');
                    return;
                }

                if (photoFile.files.length > 0) {
                    const file = photoFile.files[0];
                    const formData = new FormData();
                    formData.append('file', file);
                    try {
                        const uploadResponse = await fetch(`http://127.0.0.1:5000/api/products/${productId}/image`, {
                            method: 'POST',
                            body: formData
                        });
                        const uploadData = await uploadResponse.json();
                        if (!uploadData.success) {
                            alert('Ошибка загрузки фото: ' + uploadData.message);
                            return;
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Ошибка при загрузке фото');
                        return;
                    }
                }

                try {
                    const updateResponse = await fetch(`http://127.0.0.1:5000/api/products/${productId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            price: price,
                            guarantee: guarantee,
                            col_product: stock,
                            id_type_product: parseInt(typeId)
                        })
                    });
                    const updateData = await updateResponse.json();
                    if (updateData.success) {
                        alert('Товар обновлён');
                        document.body.removeChild(modal);
                        removeBodyLock();
                        await loadProducts();
                        localStorage.setItem('productsUpdated', Date.now());
                    } else {
                        alert('Ошибка: ' + updateData.message);
                    }
                } catch (err) {
                    console.error(err);
                    alert('Ошибка соединения с сервером');
                }
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    removeBodyLock();
                }
            });

        } catch (err) {
            console.error(err);
            alert('Ошибка при загрузке данных товара');
        }
    }

    // Модальное окно добавления товара
    async function openAddModal() {
        try {
            const catResponse = await fetch('http://127.0.0.1:5000/api/categories_with_id');
            const catData = await catResponse.json();
            if (!catData.success) throw new Error('Ошибка загрузки категорий');

            let categoryOptions = '<option value="">Выберите тип</option>';
            catData.categories.forEach(cat => {
                categoryOptions += `<option value="${cat.id}">${cat.name}</option>`;
            });

            const guaranteeOptions = [
                'Без гарантии', '1 месяц', '3 месяца', '6 месяцев',
                '1 год', '2 года', '3 года', '5 лет'
            ];
            let guaranteeSelectHtml = '<select id="add-guarantee">';
            guaranteeOptions.forEach(opt => {
                guaranteeSelectHtml += `<option value="${opt}">${opt}</option>`;
            });
            guaranteeSelectHtml += '</select>';

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.zIndex = '10001';

            const content = document.createElement('div');
            content.className = 'modal-content';
            content.style.maxWidth = '600px';
            content.style.width = '90%';

            const closeBtn = document.createElement('span');
            closeBtn.className = 'close-modal';
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = () => {
                document.body.removeChild(modal);
                removeBodyLock();
            };
            content.appendChild(closeBtn);

            const title = document.createElement('h2');
            title.textContent = 'Добавление нового товара';
            title.style.marginBottom = '20px';
            content.appendChild(title);

            const form = document.createElement('form');
            form.id = 'addProductForm';

            form.innerHTML = `
                <div class="form-group">
                    <label for="add-name">Название товара *</label>
                    <input type="text" id="add-name" required>
                </div>
                <div class="form-group">
                    <label for="add-type">Тип товара *</label>
                    <select id="add-type" required>
                        ${categoryOptions}
                    </select>
                </div>
                <div class="form-row" style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 1;">
                        <label for="add-price">Цена (₽) *</label>
                        <input type="number" step="0.01" id="add-price" min="1" max="10000000" required>
                        <small style="color: #666;">от 1 до 10 000 000</small>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="add-stock">Остаток на складе *</label>
                        <input type="number" id="add-stock" min="0" max="1000" required>
                        <small style="color: #666;">от 0 до 1000</small>
                    </div>
                </div>
                <div class="form-group">
                    <label for="add-guarantee">Гарантия</label>
                    ${guaranteeSelectHtml}
                </div>
                <div class="form-group">
                    <label>Фото товара</label>
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                        <div id="photoPreviewContainer" style="min-width:100px; min-height:100px; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-image" style="font-size: 3rem; color: #ccc;"></i>
                        </div>
                        <button type="button" id="choosePhotoBtn" class="btn-primary" style="padding: 8px 15px;">Выбрать фото</button>
                    </div>
                    <div id="photoUpload" style="display: none;">
                        <input type="file" id="photoFile" accept="image/*">
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button type="button" id="cancelAddBtn" class="btn-details" style="background-color: var(--light-gray); color: var(--dark-gray);">Отмена</button>
                    <button type="submit" class="btn-primary">Создать товар</button>
                </div>
            `;

            content.appendChild(form);
            modal.appendChild(content);
            document.body.appendChild(modal);
            addBodyLock();

            const priceInput = document.getElementById('add-price');
            const stockInput = document.getElementById('add-stock');

            [priceInput, stockInput].forEach(input => {
                if (!input) return;
                input.addEventListener('keydown', (e) => {
                    const allowedKeys = [
                        'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
                        'ArrowUp', 'ArrowDown', 'Home', 'End'
                    ];
                    if (allowedKeys.includes(e.key)) return;
                    if (e.key === '+' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                        e.preventDefault();
                        return;
                    }
                    if (!/^\d$/.test(e.key) && e.key !== '.') {
                        e.preventDefault();
                    }
                });
                input.addEventListener('blur', function() {
                    let val = this.value;
                    val = val.replace(/^0+(?=\d)/, '');
                    if (val !== this.value) this.value = val;
                });
            });

            const choosePhotoBtn = document.getElementById('choosePhotoBtn');
            const photoUpload = document.getElementById('photoUpload');
            const photoFile = document.getElementById('photoFile');
            const photoPreviewContainer = document.getElementById('photoPreviewContainer');

            choosePhotoBtn.addEventListener('click', () => {
                photoUpload.style.display = 'block';
                photoFile.click();
            });

            photoFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        photoPreviewContainer.innerHTML = `<img src="${event.target.result}" alt="Новое фото" style="max-width: 100px; max-height: 100px; object-fit: contain;">`;
                    };
                    reader.readAsDataURL(e.target.files[0]);
                } else {
                    photoPreviewContainer.innerHTML = '<i class="fas fa-image" style="font-size: 3rem; color: #ccc;"></i>';
                }
            });

            document.getElementById('cancelAddBtn').addEventListener('click', () => {
                document.body.removeChild(modal);
                removeBodyLock();
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const name = document.getElementById('add-name').value.trim();
                const typeId = document.getElementById('add-type').value;
                const price = parseFloat(document.getElementById('add-price').value);
                const stock = parseInt(document.getElementById('add-stock').value);
                const guarantee = document.getElementById('add-guarantee').value;

                if (!name || !typeId) {
                    alert('Заполните все обязательные поля');
                    return;
                }
                if (isNaN(price) || price < 1 || price > 10000000) {
                    alert('Цена должна быть от 1 до 10 000 000');
                    return;
                }
                if (isNaN(stock) || stock < 0 || stock > 1000) {
                    alert('Количество должно быть от 0 до 1000');
                    return;
                }

                let newProductId;
                try {
                    const createResponse = await fetch('http://127.0.0.1:5000/api/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            price: price,
                            guarantee: guarantee,
                            col_product: stock,
                            id_type_product: parseInt(typeId)
                        })
                    });
                    const createData = await createResponse.json();
                    if (!createData.success) {
                        alert('Ошибка создания товара: ' + createData.message);
                        return;
                    }
                    newProductId = createData.id;
                } catch (err) {
                    console.error(err);
                    alert('Ошибка соединения с сервером');
                    return;
                }

                if (photoFile.files.length > 0) {
                    const file = photoFile.files[0];
                    const formData = new FormData();
                    formData.append('file', file);
                    try {
                        const uploadResponse = await fetch(`http://127.0.0.1:5000/api/products/${newProductId}/image`, {
                            method: 'POST',
                            body: formData
                        });
                        const uploadData = await uploadResponse.json();
                        if (!uploadData.success) {
                            alert('Товар создан, но фото не загрузилось: ' + uploadData.message);
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Товар создан, но ошибка при загрузке фото');
                    }
                }

                alert('Товар успешно добавлен');
                document.body.removeChild(modal);
                removeBodyLock();
                await loadProducts();
                localStorage.setItem('productsUpdated', Date.now());
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    removeBodyLock();
                }
            });

        } catch (err) {
            console.error(err);
            alert('Ошибка при открытии формы добавления');
        }
    }

    // Категории
    async function loadCategories() {
        const tbody = document.getElementById('categoriesTableBody');
        tbody.innerHTML = '<tr><td colspan="3">Загрузка...</td></tr>';

        try {
            const response = await fetch('http://127.0.0.1:5000/api/categories_with_id');
            if (!response.ok) throw new Error('Ошибка загрузки');
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Неизвестная ошибка');

            if (data.categories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Категории не найдены</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            data.categories.forEach(cat => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${cat.id}</td>
                    <td>${cat.name}</td>
                    <td>
                        <button class="btn-icon edit-cat-btn" data-id="${cat.id}" data-name="${cat.name}" title="Редактировать"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-cat-btn" data-id="${cat.id}" title="Удалить"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.querySelectorAll('.edit-cat-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const name = e.currentTarget.dataset.name;
                    openEditCategoryModal(id, name);
                });
            });

            document.querySelectorAll('.delete-cat-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (!confirm(`Вы уверены, что хотите удалить категорию?`)) return;

                    try {
                        const response = await fetch(`http://127.0.0.1:5000/api/categories/${id}`, {
                            method: 'DELETE'
                        });
                        const data = await response.json();
                        if (data.success) {
                            alert('Категория удалена');
                            loadCategories();
                        } else {
                            alert('Ошибка: ' + data.message);
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Ошибка соединения с сервером');
                    }
                });
            });

        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="3">Ошибка загрузки данных</td></tr>';
        }
    }

    // Модальное окно добавления категории
    async function openAddCategoryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10001';

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.maxWidth = '400px';
        content.style.width = '90%';

        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-modal';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
            removeBodyLock();
        };
        content.appendChild(closeBtn);

        const title = document.createElement('h2');
        title.textContent = 'Добавление категории';
        title.style.marginBottom = '20px';
        content.appendChild(title);

        const form = document.createElement('form');
        form.id = 'addCategoryForm';
        form.innerHTML = `
            <div class="form-group">
                <label for="cat-name">Название категории *</label>
                <input type="text" id="cat-name" required>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button type="button" id="cancelCatBtn" class="btn-details" style="background-color: var(--light-gray); color: var(--dark-gray);">Отмена</button>
                <button type="submit" class="btn-primary">Создать</button>
            </div>
        `;

        content.appendChild(form);
        modal.appendChild(content);
        document.body.appendChild(modal);
        addBodyLock();

        document.getElementById('cancelCatBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
            removeBodyLock();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('cat-name').value.trim();
            if (!name) {
                alert('Введите название категории');
                return;
            }

            try {
                const response = await fetch('http://127.0.0.1:5000/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                const data = await response.json();
                if (data.success) {
                    alert('Категория создана');
                    document.body.removeChild(modal);
                    removeBodyLock();
                    loadCategories();
                } else {
                    alert('Ошибка: ' + data.message);
                }
            } catch (err) {
                console.error(err);
                alert('Ошибка соединения с сервером');
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                removeBodyLock();
            }
        });
    }

    // Модальное окно редактирования категории
    async function openEditCategoryModal(id, currentName) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10001';

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.maxWidth = '400px';
        content.style.width = '90%';

        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-modal';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
            removeBodyLock();
        };
        content.appendChild(closeBtn);

        const title = document.createElement('h2');
        title.textContent = 'Редактирование категории';
        title.style.marginBottom = '20px';
        content.appendChild(title);

        const form = document.createElement('form');
        form.id = 'editCategoryForm';
        form.innerHTML = `
            <div class="form-group">
                <label for="cat-name">Название категории *</label>
                <input type="text" id="cat-name" value="${currentName}" required>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button type="button" id="cancelEditCatBtn" class="btn-details" style="background-color: var(--light-gray); color: var(--dark-gray);">Отмена</button>
                <button type="submit" class="btn-primary">Сохранить</button>
            </div>
        `;

        content.appendChild(form);
        modal.appendChild(content);
        document.body.appendChild(modal);
        addBodyLock();

        document.getElementById('cancelEditCatBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
            removeBodyLock();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('cat-name').value.trim();
            if (!name) {
                alert('Введите название категории');
                return;
            }

            try {
                const response = await fetch(`http://127.0.0.1:5000/api/categories/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                const data = await response.json();
                if (data.success) {
                    alert('Категория обновлена');
                    document.body.removeChild(modal);
                    removeBodyLock();
                    loadCategories();
                } else {
                    alert('Ошибка: ' + data.message);
                }
            } catch (err) {
                console.error(err);
                alert('Ошибка соединения с сервером');
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                removeBodyLock();
            }
        });
    }

    // Заказы
    async function loadOrders() {
        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = '<tr><td colspan="8">Загрузка...</td></tr>';

        try {
            const response = await fetch('http://127.0.0.1:5000/api/admin/orders');
            if (!response.ok) throw new Error('Ошибка загрузки');
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Неизвестная ошибка');

            if (data.orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8">Заказы не найдены</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            data.orders.forEach(order => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.id}</td>
                    <td>${order.date}</td>
                    <td>${order.client_fio}</td>
                    <td>${order.address || '—'}</td>
                    <td>
                        <select class="order-status-select" data-order-id="${order.id}" data-current-state="${order.state_id}">
                            <option value="1" ${order.state_id == 1 ? 'selected' : ''}>Заказ оформлен</option>
                            <option value="2" ${order.state_id == 2 ? 'selected' : ''}>Заказ собран</option>
                            <option value="3" ${order.state_id == 3 ? 'selected' : ''}>Отправлен</option>
                            <option value="4" ${order.state_id == 4 ? 'selected' : ''}>Доставлен</option>
                            <option value="5" ${order.state_id == 5 ? 'selected' : ''}>Отменён</option>
                        </select>
                    </td>
                    <td>${order.total.toFixed(2)} ₽</td>
                    <td>
                        <button class="btn-icon view-order-btn" data-order-id="${order.id}" title="Просмотр состава"><i class="fas fa-eye"></i></button>
                    </td>
                    <td>
                        <button class="btn-icon delete-order-btn" data-order-id="${order.id}" ${order.state_id != 5 ? 'disabled' : ''} title="Удалить"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.querySelectorAll('.order-status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const orderId = e.target.dataset.orderId;
                    const newState = e.target.value;
                    if (!confirm(`Изменить статус заказа №${orderId}?`)) {
                        e.target.value = e.target.dataset.currentState;
                        return;
                    }
                    try {
                        const response = await fetch(`http://127.0.0.1:5000/api/admin/orders/${orderId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ state_id: parseInt(newState) })
                        });
                        const data = await response.json();
                        if (data.success) {
                            alert('Статус обновлён');
                            e.target.dataset.currentState = newState;
                            const deleteBtn = document.querySelector(`.delete-order-btn[data-order-id="${orderId}"]`);
                            if (deleteBtn) {
                                if (newState == 5) {
                                    deleteBtn.disabled = false;
                                } else {
                                    deleteBtn.disabled = true;
                                }
                            }
                        } else {
                            alert('Ошибка: ' + data.message);
                            e.target.value = e.target.dataset.currentState;
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Ошибка соединения с сервером');
                        e.target.value = e.target.dataset.currentState;
                    }
                });
            });

            document.querySelectorAll('.view-order-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const orderId = e.currentTarget.dataset.orderId;
                    await showOrderItems(orderId);
                });
            });

            document.querySelectorAll('.delete-order-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const orderId = e.currentTarget.dataset.orderId;
                    if (!confirm(`Вы уверены, что хотите удалить заказ №${orderId}?`)) return;

                    try {
                        const response = await fetch(`http://127.0.0.1:5000/api/admin/orders/${orderId}`, {
                            method: 'DELETE'
                        });
                        const data = await response.json();
                        if (data.success) {
                            alert('Заказ удалён');
                            loadOrders();
                        } else {
                            alert('Ошибка: ' + data.message);
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Ошибка соединения с сервером');
                    }
                });
            });

        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="8">Ошибка загрузки данных</td></tr>';
        }
    }

    // Функция отображения состава заказа
    async function showOrderItems(orderId) {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/admin/orders/${orderId}/items`);
            const data = await response.json();
            if (!data.success) {
                alert('Ошибка загрузки состава: ' + data.message);
                return;
            }

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

            const closeBtn = document.createElement('span');
            closeBtn.className = 'close-modal';
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = () => {
                document.body.removeChild(modal);
                removeBodyLock();
            };
            content.appendChild(closeBtn);

            const title = document.createElement('h2');
            title.textContent = `Состав заказа №${orderId}`;
            title.style.marginBottom = '20px';
            content.appendChild(title);

            if (data.items.length === 0) {
                content.innerHTML += '<p>Заказ пуст</p>';
            } else {
                const table = document.createElement('table');
                table.className = 'admin-table';
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Товар</th>
                            <th>Кол-во</th>
                            <th>Цена</th>
                            <th>Сумма</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>${item.price.toFixed(2)} ₽</td>
                                <td>${item.subtotal.toFixed(2)} ₽</td>
                            </tr>
                        `).join('')}
                    </tbody>
                `;
                content.appendChild(table);
            }

            modal.appendChild(content);
            document.body.appendChild(modal);
            addBodyLock();

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    removeBodyLock();
                }
            });

        } catch (err) {
            console.error(err);
            alert('Ошибка соединения с сервером');
        }
    }

    // Отчеты
    async function loadReportCategories() {
        const select = document.getElementById('reportCategory');
        select.innerHTML = '<option value="">Все категории</option>';
        try {
            const response = await fetch('http://127.0.0.1:5000/api/categories_with_id');
            const data = await response.json();
            if (data.success) {
                data.categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name;
                    select.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Ошибка загрузки категорий для отчёта:', err);
        }
    }

    async function generateReport() {
        const fromDate = document.getElementById('reportDateFrom').value;
        const toDate = document.getElementById('reportDateTo').value;
        const categoryId = document.getElementById('reportCategory').value;

        if (!fromDate || !toDate) {
            alert('Выберите период');
            return;
        }

        const resultDiv = document.getElementById('reportResult');
        resultDiv.innerHTML = '<p>Загрузка...</p>';

        try {
            const url = new URL('http://127.0.0.1:5000/api/reports/sales');
            url.searchParams.append('from_date', fromDate);
            url.searchParams.append('to_date', toDate);
            if (categoryId) url.searchParams.append('category_id', categoryId);
            url.searchParams.append('_', Date.now());

            const response = await fetch(url, { cache: 'no-cache' });
            const data = await response.json();
            if (!data.success) {
                resultDiv.innerHTML = `<p style="color: red;">Ошибка: ${data.message}</p>`;
                return;
            }

            if (data.sales.length === 0) {
                resultDiv.innerHTML = '<p>Нет продаж за выбранный период.</p>';
                return;
            }

            let totalSum = 0;
            let html = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Товар</th>
                            <th>Категория</th>
                            <th>Количество</th>
                            <th>Цена за шт.</th>
                            <th>Общая сумма</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            data.sales.forEach(item => {
                totalSum += item.total_sum;
                html += `
                    <tr>
                        <td>${item.product_name}</td>
                        <td>${item.category_name || '-'}</td>
                        <td>${item.total_quantity}</td>
                        <td>${item.price.toFixed(2)} ₽</td>
                        <td>${item.total_sum.toFixed(2)} ₽</td>
                    </tr>
                `;
            });
            html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="4" style="text-align: right;">Итого:</th>
                            <th>${totalSum.toFixed(2)} ₽</th>
                        </tr>
                    </tfoot>
                </table>
            `;
            resultDiv.innerHTML = html;
        } catch (err) {
            console.error(err);
            resultDiv.innerHTML = '<p style="color: red;">Ошибка соединения с сервером</p>';
        }
    }

    async function downloadReportPdf() {
        const fromDate = document.getElementById('reportDateFrom').value;
        const toDate = document.getElementById('reportDateTo').value;
        const categoryId = document.getElementById('reportCategory').value;

        if (!fromDate || !toDate) {
            alert('Выберите период');
            return;
        }

        const url = new URL('http://127.0.0.1:5000/api/reports/sales/pdf');
        url.searchParams.append('from_date', fromDate);
        url.searchParams.append('to_date', toDate);
        if (categoryId) url.searchParams.append('category_id', categoryId);
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
            a.download = `sales_report_${fromDate}_${toDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error(err);
            alert('Ошибка соединения с сервером');
        }
    }

    // Прайс-листы
    async function loadPriceListCategories() {
        const select = document.getElementById('plCategory');
        select.innerHTML = '<option value="">Все категории</option>';
        try {
            const response = await fetch('http://127.0.0.1:5000/api/categories_with_id');
            const data = await response.json();
            if (data.success) {
                data.categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name;
                    select.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Ошибка загрузки категорий для прайс-листа:', err);
        }
    }

    async function showPriceList() {
        const categoryId = document.getElementById('plCategory').value;
        const onlyInStock = document.getElementById('plOnlyInStock').checked;

        const resultDiv = document.getElementById('priceListResult');
        resultDiv.innerHTML = '<p>Загрузка...</p>';

        try {
            const url = new URL('http://127.0.0.1:5000/api/price-list');
            if (categoryId) url.searchParams.append('category_id', categoryId);
            if (onlyInStock) url.searchParams.append('only_in_stock', 'true');

            const response = await fetch(url, { cache: 'no-cache' });
            const data = await response.json();
            if (!data.success) {
                resultDiv.innerHTML = `<p style="color: red;">Ошибка: ${data.message}</p>`;
                return;
            }

            if (data.products.length === 0) {
                resultDiv.innerHTML = '<p>Нет товаров, соответствующих фильтру.</p>';
                return;
            }

            let html = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Наименование</th>
                            <th>Категория</th>
                            <th>Цена</th>
                            <th>Гарантия</th>
                            <th>Остаток</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            data.products.forEach(p => {
                html += `
                    <tr>
                        <td>${p.id}</td>
                        <td>${p.name}</td>
                        <td>${p.category}</td>
                        <td>${p.price.toFixed(2)} ₽</td>
                        <td>${p.guarantee || '-'}</td>
                        <td>${p.stock}</td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            resultDiv.innerHTML = html;
        } catch (err) {
            console.error(err);
            resultDiv.innerHTML = '<p style="color: red;">Ошибка соединения с сервером</p>';
        }
    }

    async function downloadPriceListPdf() {
        const categoryId = document.getElementById('plCategory').value;
        const onlyInStock = document.getElementById('plOnlyInStock').checked;

        const url = new URL('http://127.0.0.1:5000/api/price-list/pdf');
        if (categoryId) url.searchParams.append('category_id', categoryId);
        if (onlyInStock) url.searchParams.append('only_in_stock', 'true');
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
            a.download = `price_list_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error(err);
            alert('Ошибка соединения с сервером');
        }
    }
});