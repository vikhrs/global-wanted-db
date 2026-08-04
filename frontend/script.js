let token = null;
let currentLang = localStorage.getItem('lang') || 'ru';
let currentPersonId = null;

// ===== ПЕРЕКЛЮЧЕНИЕ ЯЗЫКА =====
async function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    const res = await fetch(`/api/locales/${lang}`);
    const locale = await res.json();
    applyLocale(locale);
}

function applyLocale(locale) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const parts = key.split('.');
        let value = locale;
        for (const part of parts) {
            value = value?.[part];
        }
        if (value) el.textContent = value;
    });
}

// ===== ВХОД =====
window.onload = function() {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
        token = savedToken;
        document.getElementById('login').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadData();
        loadLocales();
    }
};

async function loadLocales() {
    const res = await fetch(`/api/locales/${currentLang}`);
    const locale = await res.json();
    applyLocale(locale);
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');

    errorMsg.style.display = 'none';

    if (!username || !password) {
        errorMsg.textContent = '❌ Введите логин и пароль';
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
            token = data.token;
            localStorage.setItem('token', token);
            document.getElementById('login').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            errorMsg.style.display = 'none';
            loadData();
            loadLocales();
        } else {
            errorMsg.textContent = '❌ Неверные логин или пароль';
            errorMsg.style.display = 'block';
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (e) {
        errorMsg.textContent = '❌ Ошибка соединения с сервером';
        errorMsg.style.display = 'block';
    }
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
    const params = new URLSearchParams({
        name: document.getElementById('filterName').value,
        country: document.getElementById('filterCountry').value,
        ageMin: document.getElementById('filterAgeMin').value,
        ageMax: document.getElementById('filterAgeMax').value,
        sex: document.getElementById('filterSex').value,
        status: document.getElementById('filterStatus').value,
        source: document.getElementById('filterSource').value,
        category: document.getElementById('filterCategory').value
    });

    try {
        const res = await fetch(`/api/wanted?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            alert('Сессия истекла. Войдите снова.');
            logout();
            return;
        }

        const data = await res.json();

        document.getElementById('stats').innerHTML = `
            <strong data-i18n="total">Всего:</strong> ${data.total || 0} &nbsp;|&nbsp;
            <strong data-i18n="updated">Обновлено:</strong> ${data.lastUpdate ? new Date(data.lastUpdate).toLocaleString() : '—'} &nbsp;|&nbsp;
            <strong>FBI:</strong> ${data.sources?.fbi || 0} &nbsp;|&nbsp;
            <strong>INTERPOL:</strong> ${data.sources?.interpol || 0} &nbsp;|&nbsp;
            <strong>Miami Jail:</strong> ${data.sources?.miamiJail || 0} &nbsp;|&nbsp;
            <strong>Miami Sex:</strong> ${data.sources?.miamiSex || 0}
        `;

        const resultsDiv = document.getElementById('results');

        if (!data.people || data.people.length === 0) {
            resultsDiv.innerHTML = `<div class="empty" data-i18n="errors.no_data">🔍 Ничего не найдено</div>`;
            return;
        }

        let html = `<table>
            <thead>
                <tr>
                    <th data-i18n="profile.full_name">Имя</th>
                    <th data-i18n="profile.dob">Дата рождения</th>
                    <th data-i18n="profile.country">Страна</th>
                    <th data-i18n="profile.crime">Преступление</th>
                    <th data-i18n="profile.status">Статус</th>
                    <th data-i18n="profile.source">Источник</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>`;

        data.people.forEach(p => {
            html += `<tr onclick="openProfile('${p.caseNumber || p.id}')">
                <td>${p.firstName || '-'} ${p.lastName || ''}</td>
                <td>${p.dob || '-'}</td>
                <td>${p.country || '-'}</td>
                <td>${p.crime || '-'}</td>
                <td>${p.status || '-'}</td>
                <td>${p.source || '-'}</td>
                <td>${p.photo ? '<img src="'+p.photo+'" style="width:30px;height:30px;border-radius:50%;object-fit:cover;">' : '📷'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        resultsDiv.innerHTML = html;
    } catch (e) {
        document.getElementById('results').innerHTML = `<div class="empty" data-i18n="errors.load_error">❌ Ошибка загрузки данных</div>`;
    }
}

// ===== ОТКРЫТИЕ КАРТОЧКИ =====
async function openProfile(id) {
    currentPersonId = id;
    try {
        const res = await fetch(`/api/person/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const person = await res.json();
        showProfile(person);
    } catch (e) {
        alert('Ошибка загрузки карточки');
    }
}

function showProfile(person) {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileContent');
    
    content.innerHTML = `
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
            <div style="flex:0 0 150px;text-align:center;">
                ${person.photo ? `<img src="${person.photo}" style="width:150px;height:150px;border-radius:50%;object-fit:cover;border:3px solid #1a6aff;">` : '<div style="width:150px;height:150px;border-radius:50%;background:#1a2a4a;display:flex;align-items:center;justify-content:center;font-size:60px;color:#4af;">👤</div>'}
                <h3>${person.firstName || ''} ${person.lastName || ''}</h3>
                <p style="color:#8ab;">${person.source || 'N/A'}</p>
            </div>
            <div style="flex:1;min-width:300px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div><strong>📅 Дата рождения:</strong> ${person.dob || 'N/A'}</div>
                    <div><strong>🌍 Страна:</strong> ${person.country || 'N/A'}</div>
                    <div><strong>📍 Адрес:</strong> ${person.address || 'N/A'}</div>
                    <div><strong>🏙️ Город:</strong> ${person.city || 'N/A'}</div>
                    <div><strong>📞 Телефон:</strong> ${person.phone || 'N/A'}</div>
                    <div><strong>⚖️ Статус:</strong> ${person.status || 'N/A'}</div>
                    <div><strong>📂 Категория:</strong> ${person.crimeCategory || 'N/A'}</div>
                    <div><strong>💰 Награда:</strong> ${person.reward || 'N/A'}</div>
                </div>
                <div style="margin-top:15px;border-top:1px solid #1a2a4a;padding-top:15px;">
                    <strong>📜 Обвинения:</strong>
                    <ul>${(person.charges || ['Нет данных']).map(c => `<li>${c}</li>`).join('')}</ul>
                </div>
                ${person.history ? `
                <div style="margin-top:15px;border-top:1px solid #1a2a4a;padding-top:15px;">
                    <strong>📋 История судимостей:</strong>
                    ${person.history.map(h => `
                        <div style="background:#0d1421;padding:10px;border-radius:8px;margin-top:5px;">
                            <div>${h.crime || 'N/A'}</div>
                            <div style="font-size:12px;color:#8ab;">Срок: ${h.sentence || 'N/A'} | ${h.from || ''} - ${h.to || ''} | ${h.released ? '✅ Освобождён' : '🔒 Не освобождён'}</div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        </div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
            <button onclick="closeProfile()" style="padding:10px 20px;background:#333;border:none;border-radius:8px;color:white;cursor:pointer;">Закрыть</button>
            <button onclick="editPerson()" style="padding:10px 20px;background:#1a6aff;border:none;border-radius:8px;color:white;cursor:pointer;">✏️ Редактировать</button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeProfile() {
    document.getElementById('profileModal').style.display = 'none';
}

// ===== ДОБАВЛЕНИЕ ЧЕЛОВЕКА =====
function showAddPerson() {
    const modal = document.getElementById('addModal');
    modal.style.display = 'flex';
}

function closeAddPerson() {
    document.getElementById('addModal').style.display = 'none';
}

async function addPerson() {
    const person = {
        firstName: document.getElementById('addFirstName').value,
        lastName: document.getElementById('addLastName').value,
        dob: document.getElementById('addDob').value,
        address: document.getElementById('addAddress').value,
        city: document.getElementById('addCity').value,
        country: document.getElementById('addCountry').value,
        phone: document.getElementById('addPhone').value,
        crime: document.getElementById('addCrime').value,
        crimeCategory: document.getElementById('addCategory').value,
        status: document.getElementById('addStatus').value,
        sex: document.getElementById('addSex').value,
        charges: document.getElementById('addCharges').value.split(',').map(c => c.trim()),
        source: 'Моя БД'
    };
    
    try {
        const res = await fetch('/api/person', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(person)
        });
        const data = await res.json();
        if (data.success) {
            closeAddPerson();
            loadData();
        }
    } catch (e) {
        alert('Ошибка добавления');
    }
}

function logout() {
    token = null;
    localStorage.removeItem('token');
    document.getElementById('login').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('errorMsg').style.display = 'none';
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const loginDiv = document.getElementById('login');
        if (loginDiv.style.display !== 'none') {
            login();
        }
    }
});
