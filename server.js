require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { authMiddleware } = require('./auth');
const { loadEncrypted, saveEncrypted } = require('./encryptor');
const { collectAllData } = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const DB_PATH = path.join(__dirname, 'db', 'wanted.encrypted');

// ===== ВХОД =====
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const token = require('./auth').login(username, password);
    if (token) {
        return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: 'Неверные логин или пароль' });
});

// ===== ПОЛУЧЕНИЕ СПИСКА (С ФИЛЬТРАМИ) =====
app.get('/api/wanted', authMiddleware, (req, res) => {
    const { country, name, ageMin, ageMax, sex, status, source, category, limit = 1000 } = req.query;
    
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
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

// ===== ПОЛУЧЕНИЕ КАРТОЧКИ ЧЕЛОВЕКА =====
app.get('/api/person/:id', authMiddleware, (req, res) => {
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    const person = data.people.find(p => p.caseNumber === req.params.id || p.id === parseInt(req.params.id));
    if (!person) {
        return res.status(404).json({ error: 'Человек не найден' });
    }
    
    res.json(person);
});

// ===== ДОБАВЛЕНИЕ ЧЕЛОВЕКА (МОЯ БД) =====
app.post('/api/person', authMiddleware, (req, res) => {
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    const newPerson = req.body;
    newPerson.id = Date.now();
    newPerson.source = 'Моя БД';
    newPerson.status = newPerson.status || 'active';
    
    data.people.push(newPerson);
    data.total = data.people.length;
    
    saveEncrypted(DB_PATH, data);
    res.json({ success: true, person: newPerson });
});

// ===== РЕДАКТИРОВАНИЕ ЧЕЛОВЕКА =====
app.put('/api/person/:id', authMiddleware, (req, res) => {
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    const index = data.people.findIndex(p => p.id === parseInt(req.params.id) || p.caseNumber === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Человек не найден' });
    }
    
    data.people[index] = { ...data.people[index], ...req.body };
    saveEncrypted(DB_PATH, data);
    res.json({ success: true, person: data.people[index] });
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
        categories: [...new Set((data.people || []).map(p => p.crimeCategory))],
        countries: [...new Set((data.people || []).map(p => p.country))].length
    });
});

// ===== ЯЗЫКИ =====
app.get('/api/locales/:lang', (req, res) => {
    const lang = req.params.lang || 'ru';
    try {
        const locale = require(`./locales/${lang}.json`);
        res.json(locale);
    } catch {
        res.json(require('./locales/ru.json'));
    }
});

// ===== АВТООБНОВЛЕНИЕ (КАЖДЫЕ 3 ЧАСА) =====
cron.schedule('0 */3 * * *', () => {
    console.log('⏰ Плановое обновление (каждые 3 часа)...');
    collectAllData().catch(e => console.error('Ошибка обновления:', e));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
    console.log(`🌍 Global Wanted DB запущена на порту ${PORT}`);
    console.log(`🔐 Логин: ${process.env.ADMIN_USER || 'dbsvc_A9xR7QmL4VpN82'}`);
    console.log(`🔒 Шифрование: AES-256`);
    console.log(`⏰ Автообновление: каждые 3 часа`);
    await collectAllData();
});
