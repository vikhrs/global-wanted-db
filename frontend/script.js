let token = null;

// Автовход, если токен уже есть
window.onload = function() {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
        token = savedToken;
        document.getElementById('login').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadData();
    }
};

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');

    // Скрываем ошибку при новом вводе
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
        } else {
            errorMsg.textContent = '❌ Неверные логин или пароль';
            errorMsg.style.display = 'block';
            // Очищаем поле пароля
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (e) {
        errorMsg.textContent = '❌ Ошибка соединения с сервером';
        errorMsg.style.display = 'block';
    }
}

async function loadData() {
    const params = new URLSearchParams({
        name: document.getElementById('filterName').value,
        country: document.getElementById('filterCountry').value,
        ageMin: document.getElementById('filterAgeMin').value,
        ageMax: document.getElementById('filterAgeMax').value,
        sex: document.getElementById('filterSex').value,
        status: document.getElementById('filterStatus').value,
        source: document.getElementById('filterSource').value
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
            <strong>Всего:</strong> ${data.total || 0} &nbsp;|&nbsp;
            <strong>Обновлено:</strong> ${data.lastUpdate ? new Date(data.lastUpdate).toLocaleString() : '—'} &nbsp;|&nbsp;
            <strong>FBI:</strong> ${data.sources?.fbi || 0} &nbsp;|&nbsp;
            <strong>INTERPOL:</strong> ${data.sources?.interpol || 0} &nbsp;|&nbsp;
            <strong>Marshals:</strong> ${data.sources?.marshals || 0} &nbsp;|&nbsp;
            <strong>Europol:</strong> ${data.sources?.europol || 0}
        `;

        const resultsDiv = document.getElementById('results');

        if (!data.people || data.people.length === 0) {
            resultsDiv.innerHTML = '<div class="empty">🔍 Ничего не найдено</div>';
            return;
        }

        let html = `<table>
            <thead>
                <tr>
                    <th>Имя</th>
                    <th>Фамилия</th>
                    <th>Дата рождения</th>
                    <th>Страна</th>
                    <th>Преступление</th>
                    <th>Статус</th>
                    <th>Источник</th>
                </tr>
            </thead>
            <tbody>`;

        data.people.forEach(p => {
            html += `<tr>
                <td>${p.firstName || '-'}</td>
                <td>${p.lastName || '-'}</td>
                <td>${p.dob || '-'}</td>
                <td>${p.country || '-'}</td>
                <td>${p.crime || '-'}</td>
                <td>${p.status || '-'}</td>
                <td>${p.source || '-'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        resultsDiv.innerHTML = html;
    } catch (e) {
        document.getElementById('results').innerHTML = '<div class="empty">❌ Ошибка загрузки данных</div>';
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

// Enter для входа
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const loginDiv = document.getElementById('login');
        if (loginDiv.style.display !== 'none') {
            login();
        }
    }
});
