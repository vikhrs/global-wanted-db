require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { authMiddleware } = require('./auth');
const { loadEncrypted } = require('./encryptor');
const { collectAllData } = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const DB_PATH = path.join(__dirname, 'db', 'wanted.encrypted');

// ===== РОУТ ДЛЯ ЛОГИНА =====
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const token = require('./auth').login(username, password);
    if (token) {
        return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: 'Неверные логин или пароль' });
});

// ===== ЗАЩИЩЁННЫЙ РОУТ ДЛЯ ДАННЫХ =====
app.get('/api/wanted', authMiddleware, (req, res) => {
    const { country, name, ageMin, ageMax, sex, status, source, limit = 1000 } = req.query;
    
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    let list = data.people || [];
    
    if (name) {
        const search = name.toLowerCase();
        list = list.filter(p => 
            (p.firstName || '').toLowerCase().includes(search) ||
            (p.lastName || '').toLowerCase().includes(search) ||
            (p.patronymic || '').toLowerCase().includes(search)
        );
    }
    if (country) list = list.filter(p => (p.country || '').toLowerCase().includes(country.toLowerCase()));
    if (sex) list = list.filter(p => p.sex === sex);
    if (status) list = list.filter(p => (p.status || '').toLowerCase().includes(status.toLowerCase()));
    if (source) list = list.filter(p => (p.source || '').toLowerCase().includes(source.toLowerCase()));
    if (ageMin) list = list.filter(p => p.age >= parseInt(ageMin));
    if (ageMax) list = list.filter(p => p.age <= parseInt(ageMax));
    
    const total = list.length;
    const limited = list.slice(0, parseInt(limit));
    
    res.json({
        total,
        limit: parseInt(limit),
        lastUpdate: data.lastUpdate,
        sources: data.sources || {},
        people: limited
    });
});

// ===== СТАТИСТИКА =====
app.get('/api/stats', authMiddleware, (req, res) => {
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    res.json({
        total: data.total || 0,
        lastUpdate: data.lastUpdate,
        sources: data.sources || {},
        countries: [...new Set((data.people || []).map(p => p.country))].length
    });
});

// ===== ИЗМЕНЕНО: АВТООБНОВЛЕНИЕ КАЖДЫЕ 3 ЧАСА =====
cron.schedule('0 */3 * * *', () => {
    console.log('⏰ Плановое обновление (каждые 3 часа)...');
    collectAllData().catch(e => console.error('Ошибка обновления:', e));
});

// ===== ЗАПУСК =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
    console.log(`🌍 Global Wanted DB запущена на порту ${PORT}`);
    console.log(`🔐 Логин: ${process.env.ADMIN_USER || 'dbsvc_A9xR7QmL4VpN82'}`);
    console.log(`🔒 Шифрование: AES-256`);
    console.log(`⏰ Автообновление: каждые 3 часа`);
    await collectAllData();
});
