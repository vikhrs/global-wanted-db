let token = null;
let currentPersonId = null;
let isAdmin = false;
let currentRole = 'user';

// ===== СЕКРЕТНАЯ ССЫЛКА ДЛЯ АДМИНКИ =====
const ADMIN_SECRET = '6b1d4f0e2a9c7e8d5f31b84a6c92e715/9f7c2a61d4e84b3ea8f1c9076b5d2e41';

// ===== АВТОВХОД =====
window.onload = function() {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
        token = savedToken;
        document.getElementById('login').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadData();
        checkAdmin();
    }
};

// ===== ПРОВЕРКА АДМИНА =====
async function checkAdmin() {
    try {
        const res = await fetch('/api/admin/check', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        isAdmin = data.isAdmin || false;
        currentRole = data.role || 'user';
        if (isAdmin) {
            document.getElementById('adminButton').style.display = 'block';
        }
    } catch {}
}

// ===== ВХОД =====
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');

    errorMsg.style.display = 'none';

    if (!username || !password) {
        errorMsg.textContent = '❌ Please enter username and password';
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
            if (data.isAdmin) {
                isAdmin = true;
                document.getElementById('adminButton').style.display = 'block';
            }
        } else {
            errorMsg.textContent = '❌ Invalid username or password';
            errorMsg.style.display = 'block';
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (e) {
        errorMsg.textContent = '❌ Connection error';
        errorMsg.style.display = 'block';
    }
}

// ===== ОЧИСТКА ФИЛЬТРОВ =====
function clearFilters() {
    document.getElementById('filterName').value = '';
    document.getElementById('filterCountry').value = '';
    document.getElementById('filterAgeMin').value = '';
    document.getElementById('filterAgeMax').value = '';
    document.getElementById('filterSex').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterSource').value = '';
    loadData();
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
            alert('Session expired. Please login again.');
            logout();
            return;
        }

        const data = await res.json();

        const total = data.total || 0;
        const sources = data.sources || {};
        const totalFromSources = Object.values(sources).reduce((a, b) => a + b, 0);
        const displayTotal = total > 0 ? total : totalFromSources;

        document.getElementById('stats').innerHTML = `
            <strong>Total:</strong> ${displayTotal} &nbsp;|&nbsp;
            <strong>Updated:</strong> ${data.lastUpdate ? new Date(data.lastUpdate).toLocaleString() : '—'} &nbsp;|&nbsp;
            <strong>FBI:</strong> ${sources.fbi || 0} &nbsp;|&nbsp;
            <strong>INTERPOL:</strong> ${sources.interpol || 0} &nbsp;|&nbsp;
            <strong>Miami Jail:</strong> ${sources.miamiJail || 0} &nbsp;|&nbsp;
            <strong>Miami Sex:</strong> ${sources.miamiSex || 0}
        `;

        const resultsDiv = document.getElementById('results');

        if (!data.people || data.people.length === 0) {
            resultsDiv.innerHTML = `<div class="empty">🔍 Nothing found</div>`;
            return;
        }

        let html = `<table>
            <thead>
                <tr>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>DOB</th>
                    <th>Country</th>
                    <th>Crime</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Photo</th>
                </tr>
            </thead>
            <tbody>`;

        data.people.forEach(p => {
            const id = p.caseNumber || p.id || Math.random().toString(36);
            html += `<tr onclick="openProfile('${id}')">
                <td>${p.firstName || '-'}</td>
                <td>${p.lastName || '-'}</td>
                <td>${p.dob || '-'}</td>
                <td>${p.country || '-'}</td>
                <td>${(p.crime || '').substring(0, 30)}${(p.crime || '').length > 30 ? '...' : ''}</td>
                <td>${p.status || '-'}</td>
                <td>${p.source || '-'}</td>
                <td>${p.photo ? `<img src="${p.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #1a6aff;">` : '📷'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        resultsDiv.innerHTML = html;
    } catch (e) {
        document.getElementById('results').innerHTML = `<div class="empty">❌ Error loading data</div>`;
    }
}

// ===== ОТКРЫТИЕ КАРТОЧКИ =====
async function openProfile(id) {
    currentPersonId = id;
    try {
        const res = await fetch(`/api/person/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            throw new Error('Person not found');
        }
        
        const person = await res.json();
        showProfile(person);
    } catch (e) {
        alert('Error loading profile: ' + e.message);
    }
}

function showProfile(person) {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileContent');
    
    content.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">
                ${person.photo ? `<img src="${person.photo}" alt="${person.firstName}">` : `<div class="avatar-placeholder">👤</div>`}
                <h3>${person.firstName || ''} ${person.lastName || ''}</h3>
                <p>${person.source || 'N/A'}</p>
            </div>
            <div class="profile-info">
                <div class="profile-grid">
                    <div class="profile-grid-item"><label>📅 Date of Birth</label><value>${person.dob || 'N/A'}</value></div>
                    <div class="profile-grid-item"><label>🌍 Country</label><value>${person.country || 'N/A'}</value></div>
                    <div class="profile-grid-item"><label>📍 Address</label><value>${person.address || 'N/A'}</value></div>
                    <div class="profile-grid-item"><label>🏙️ City</label><value>${person.city || 'N/A'}</value></div>
                    <div class="profile-grid-item"><label>📞 Phone</label><value>${person.phone || 'N/A'}</value></div>
                    <div class="profile-grid-item"><label>⚖️ Status</label><value>${person.status || 'N/A'}</value></div>
                    <div class="profile-grid-item"><label>📂 Category</label><value>${person.crimeCategory || 'N/A'}</value></div>
                    <div class="profile-grid-item"><label>💰 Reward</label><value>${person.reward || 'N/A'}</value></div>
                </div>
            </div>
        </div>
        <div class="profile-section">
            <h4>📜 Charges</h4>
            <ul>${(person.charges || ['No data']).map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
        ${person.history ? `
        <div class="profile-section">
            <h4>📋 Criminal History</h4>
            ${person.history.map(h => `
                <div class="history-item">
                    <div class="crime-name">${h.crime || 'N/A'}</div>
                    <div class="crime-details">Sentence: ${h.sentence || 'N/A'} | ${h.from || ''} - ${h.to || ''} | ${h.released ? '<span class="released">✅ Released</span>' : '<span class="not-released">🔒 Not released</span>'}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        <div class="profile-actions">
            <button onclick="closeProfile()" class="btn-close">Close</button>
            <button onclick="editPerson()" class="btn-edit">✏️ Edit</button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeProfile() {
    document.getElementById('profileModal').style.display = 'none';
}

// ===== ДОБАВЛЕНИЕ =====
function showAddPerson() {
    document.getElementById('addModal').style.display = 'flex';
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
        source: 'My DB'
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
        alert('Error adding person');
    }
}

// ===== АДМИН-ПАНЕЛЬ =====
function openAdmin() {
    document.getElementById('adminPanel').style.display = 'flex';
    loadAdminData();
}

function closeAdmin() {
    document.getElementById('adminPanel').style.display = 'none';
}

async function loadAdminData() {
    try {
        const res = await fetch('/api/admin/logs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const tbody = document.getElementById('adminLogBody');
        tbody.innerHTML = '';
        data.logs.slice().reverse().forEach(log => {
            const roleBadge = log.role === 'admin' ? '👑' : '👤';
            tbody.innerHTML += `<tr>
                <td>${log.username} ${roleBadge}</td>
                <td>${log.ip}</td>
                <td>${log.country}</td>
                <td>${new Date(log.time).toLocaleString()}</td>
                <td>${(log.userAgent || '').substring(0, 30)}...</td>
            </tr>`;
        });
        
        const usersRes = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await usersRes.json();
        const userList = document.getElementById('adminUserList');
        userList.innerHTML = users.map(u => 
            `<div class="admin-user-item">
                ${u.username} 
                ${u.role === 'admin' ? '👑' : '👤'} 
                ${u.username !== 'ops_root_f7Qn2LmX' ? `<button onclick="deleteUser('${u.username}')">❌</button>` : '🔒'}
            </div>`
        ).join('');
    } catch {}
}

async function addUser() {
    const username = document.getElementById('adminNewUser').value;
    const password = document.getElementById('adminNewPass').value;
    const role = document.getElementById('adminNewRole')?.value || 'user';
    if (!username || !password) return alert('Enter username and password');
    
    const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username, password, role })
    });
    
    if (res.ok) {
        document.getElementById('adminNewUser').value = '';
        document.getElementById('adminNewPass').value = '';
        loadAdminData();
        alert('✅ User added successfully');
    } else {
        const err = await res.json();
        alert('❌ ' + err.error);
    }
}

async function deleteUser(username) {
    if (!confirm(`Delete user ${username}?`)) return;
    await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username })
    });
    loadAdminData();
}

// ===== ВЫХОД =====
function logout() {
    token = null;
    localStorage.removeItem('token');
    document.getElementById('login').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('errorMsg').style.display = 'none';
    document.getElementById('adminButton').style.display = 'none';
}

// ===== ENTER ДЛЯ ВХОДА =====
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const loginDiv = document.getElementById('login');
        if (loginDiv.style.display !== 'none') {
            login();
        }
    }
});
