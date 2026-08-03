let token = null;

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (data.success) {
        token = data.token;
        document.getElementById('login').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadData();
    } else {
        alert('❌ Неверные логин или пароль');
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
        <strong>Всего записей:</strong> ${data.total} | 
        <strong>Обновлено:</strong> ${new Date(data.lastUpdate).toLocaleString()} |
        <strong>Источники:</strong> FBI: ${data.sources.fbi}, INTERPOL: ${data.sources.interpol}, 
        US Marshals: ${data.sources.marshals}, Europol: ${data.sources.europol}, МВД РФ: ${data.sources.russia}
    `;
    
    let html = '<table><thead><tr><th>Имя</th><th>Фамилия</th><th>Дата рождения</th><th>Страна</th><th>Преступление</th><th>Статус</th><th>Источник</th><th>Награда</th></tr></thead><tbody>';
    
    data.people.forEach(p => {
        html += `<tr>
            <td>${p.firstName || '-'}</td>
            <td>${p.lastName || '-'}</td>
            <td>${p.dob || '-'}</td>
            <td>${p.country || '-'}</td>
            <td>${p.crime || '-'}</td>
            <td>${p.status || '-'}</td>
            <td>${p.source || '-'}</td>
            <td>${p.reward || '-'}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    document.getElementById('results').innerHTML = html;
}

function logout() {
    token = null;
    document.getElementById('login').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
}
