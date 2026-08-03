require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware } = require('./auth');
const { loadEncrypted } = require('./encryptor');
const { collectAllData } = require('./scraper');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const DB_PATH = path.join(__dirname, 'db', 'wanted.encrypted');

// Роут для логина
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const token = require('./auth').login(username, password);
    if (token) {
        return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: 'Неверные логин или пароль' });
});

// Защищённый роут для получения данных
app.get('/api/wanted', authMiddleware, (req, res) => {
    const { country, name, ageMin, ageMax, sex, status, source } = req.query;
    
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    let list = data.people || [];
    
    // Фильтрация
    if (name) list = list.filter(p => 
        p.firstName.toLowerCase().includes(name.toLowerCase()) ||
        p.lastName.toLowerCase().includes(name.toLowerCase())
    );
    if (country) list = list.filter(p => p.country.toLowerCase().includes(country.toLowerCase()));
    if (sex) list = list.filter(p => p.sex === sex);
    if (status) list = list.filter(p => p.status.toLowerCase().includes(status.toLowerCase()));
    if (source) list = list.filter(p => p.source.toLowerCase().includes(source.toLowerCase()));
    if (ageMin) list = list.filter(p => p.age >= parseInt(ageMin));
    if (ageMax) list = list.filter(p => p.age <= parseInt(ageMax));
    
    res.json({
        total: list.length,
        lastUpdate: data.lastUpdate,
        sources: data.sources,
        people: list
    });
});

// Автоматическое обновление каждые 5 минут
cron.schedule('*/5 * * * *', () => {
    console.log('⏰ Плановое обновление базы данных...');
    collectAllData().catch(e => console.error('Ошибка обновления:', e));
});

// Запуск
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
    console.log(`🌍 Global Wanted DB запущена на порту ${PORT}`);
    console.log(`🔐 Авторизация: ${process.env.ADMIN_USER} / ${process.env.ADMIN_PASS}`);
    console.log(`🔒 Шифрование: AES-256`);
    
    // Первичный сбор данных
    await collectAllData();
});
