require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs-extra');
const { authMiddleware } = require('./auth');
const { loadEncrypted, saveEncrypted } = require('./encryptor');
const { collectAllData } = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/public', express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'db', 'wanted.encrypted');
const LOGS_PATH = path.join(__dirname, 'db', 'admin_logs.json');
const USERS_PATH = path.join(__dirname, 'db', 'users.json');

// ===== СЕКРЕТНАЯ ССЫЛКА ДЛЯ АДМИНКИ =====
const ADMIN_SECRET = '6b1d4f0e2a9c7e8d5f31b84a6c92e715/9f7c2a61d4e84b3ea8f1c9076b5d2e41';

// ===== ИНИЦИАЛИЗАЦИЯ ФАЙЛОВ =====
function initFiles() {
    if (!fs.existsSync(LOGS_PATH)) {
        fs.writeJSONSync(LOGS_PATH, { logs: [] });
    }
    if (!fs.existsSync(USERS_PATH)) {
        fs.writeJSONSync(USERS_PATH, { 
            users: [
                {
                    username: 'ops_root_f7Qn2LmX',
                    password: 'kR8vQm2LxP7#Nd4!Ha9@Ts5$Wy1^Fg6CbJz3Xe0VuMn8Lp2KrQ5Dh7Yt',
                    role: 'admin'
                }
            ]
        });
    }
}
initFiles();

// ===== ВХОД =====
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = fs.readJSONSync(USERS_PATH);
    const user = users.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const token = require('./auth').login(username, password);
        if (token) {
            // Логируем вход
            const logs = fs.readJSONSync(LOGS_PATH);
            logs.logs.push({
                username,
                ip: req.ip || req.connection.remoteAddress,
                country: req.headers['cf-ipcountry'] || 'Unknown',
                time: new Date().toISOString(),
                userAgent: req.headers['user-agent'] || 'Unknown'
            });
            fs.writeJSONSync(LOGS_PATH, logs);
            return res.json({ success: true, token, isAdmin: user.role === 'admin' });
        }
    }
    res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// ===== ПРОВЕРКА АДМИНА =====
app.get('/api/admin/check', authMiddleware, (req, res) => {
    const users = fs.readJSONSync(USERS_PATH);
    const user = users.users.find(u => u.username === req.user.user);
    res.json({ isAdmin: user?.role === 'admin' });
});

// ===== АДМИН-ЛОГИ =====
app.get('/api/admin/logs', authMiddleware, (req, res) => {
    const users = fs.readJSONSync(USERS_PATH);
    const user = users.users.find(u => u.username === req.user.user);
    if (user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const logs = fs.readJSONSync(LOGS_PATH);
    res.json(logs);
});

// ===== АДМИН-ПОЛЬЗОВАТЕЛИ =====
app.get('/api/admin/users', authMiddleware, (req, res) => {
    const users = fs.readJSONSync(USERS_PATH);
    const user = users.users.find(u => u.username === req.user.user);
    if (user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    res.json(users.users);
});

app.post('/api/admin/users', authMiddleware, (req, res) => {
    const users = fs.readJSONSync(USERS_PATH);
    const user = users.users.find(u => u.username === req.user.user);
    if (user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password } = req.body;
    users.users.push({ username, password, role: 'user' });
    fs.writeJSONSync(USERS_PATH, users);
    res.json({ success: true });
});

app.delete('/api/admin/users', authMiddleware, (req, res) => {
    const users = fs.readJSONSync(USERS_PATH);
    const user = users.users.find(u => u.username === req.user.user);
    if (user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username } = req.body;
    if (username === 'ops_root_f7Qn2LmX') {
        return res.status(400).json({ error: 'Cannot delete main admin' });
    }
    users.users = users.users.filter(u => u.username !== username);
    fs.writeJSONSync(USERS_PATH, users);
    res.json({ success: true });
});

// ===== ОСНОВНЫЕ МАРШРУТЫ =====
app.get('/api/wanted', authMiddleware, (req, res) => {
    const { country, name, ageMin, ageMax, sex, status, source, category, limit = 1000 } = req.query;
    const data = loadEncrypted(DB_PATH);
    if (!data) return res.status(404).json({ error: 'Database not found' });
    
    let list = data.people || [];
    
    if (name) {
        const search = name.toLowerCase();
        list = list.filter(p => 
            (p.firstName || '').toLowerCase().includes(search) ||
            (p.lastName || '').toLowerCase().includes(search)
        );
    }
    if (country) list = list.filter(p => (p.country || '').toLowerCase().includes(country.toLowerCase()));
    if (sex) list = list.filter(p => p.sex === sex);
    if (status) list = list.filter(p => (p.status || '').toLowerCase().includes(status.toLowerCase()));
    if (source) list = list.filter(p => (p.source || '').toLowerCase().includes(source.toLowerCase()));
    if (category) list = list.filter(p => p.crimeCategory === category);
    if (ageMin) list = list.filter(p => p.age >= parseInt(ageMin));
    if (ageMax) list = list.filter(p => p.age <= parseInt(ageMax));
    
    res.json({
        total: list.length,
        limit: parseInt(limit),
        lastUpdate: data.lastUpdate,
        sources: data.sources || {},
        people: list.slice(0, parseInt(limit))
    });
});

app.get('/api/person/:id', authMiddleware, (req, res) => {
    const data = loadEncrypted(DB_PATH);
    if (!data) return res.status(404).json({ error: 'Database not found' });
    const person = data.people.find(p => p.caseNumber === req.params.id || p.id === parseInt(req.params.id));
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
});

app.post('/api/person', authMiddleware, (req, res) => {
    const data = loadEncrypted(DB_PATH);
    if (!data) return res.status(404).json({ error: 'Database not found' });
    const newPerson = req.body;
    newPerson.id = Date.now();
    newPerson.source = 'My DB';
    data.people.push(newPerson);
    data.total = data.people.length;
    saveEncrypted(DB_PATH, data);
    res.json({ success: true, person: newPerson });
});

// ===== АВТООБНОВЛЕНИЕ =====
cron.schedule('0 */3 * * *', () => {
    console.log('⏰ Scheduled update (every 3 hours)...');
    collectAllData().catch(e => console.error('Update error:', e));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
    console.log(`🌍 Global Wanted DB running on port ${PORT}`);
    console.log(`🔐 Admin login: ops_root_f7Qn2LmX`);
    console.log(`🔑 Admin password: kR8vQm2LxP7#Nd4!Ha9@Ts5$Wy1^Fg6CbJz3Xe0VuMn8Lp2KrQ5Dh7Yt`);
    console.log(`🔗 Admin panel: /${ADMIN_SECRET}`);
    await collectAllData();
});
