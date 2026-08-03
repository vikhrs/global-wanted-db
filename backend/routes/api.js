const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const { loadEncrypted } = require('../encryptor');
const path = require('path');

const DB_PATH = path.join(__dirname, '../db', 'wanted.encrypted');

// Получение данных с фильтрацией
router.get('/wanted', authMiddleware, (req, res) => {
    const { country, name, ageMin, ageMax, sex, status, source, limit = 1000 } = req.query;
    
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    let list = data.people || [];
    
    // Фильтрация
    if (name) {
        const search = name.toLowerCase();
        list = list.filter(p => 
            p.firstName.toLowerCase().includes(search) ||
            p.lastName.toLowerCase().includes(search) ||
            (p.patronymic && p.patronymic.toLowerCase().includes(search))
        );
    }
    if (country) list = list.filter(p => p.country.toLowerCase().includes(country.toLowerCase()));
    if (sex) list = list.filter(p => p.sex === sex);
    if (status) list = list.filter(p => p.status.toLowerCase().includes(status.toLowerCase()));
    if (source) list = list.filter(p => p.source.toLowerCase().includes(source.toLowerCase()));
    if (ageMin) list = list.filter(p => p.age >= parseInt(ageMin));
    if (ageMax) list = list.filter(p => p.age <= parseInt(ageMax));
    
    // Пагинация
    const total = list.length;
    const limited = list.slice(0, parseInt(limit));
    
    res.json({
        total,
        limit: parseInt(limit),
        lastUpdate: data.lastUpdate,
        sources: data.sources,
        people: limited
    });
});

// Получение статистики
router.get('/stats', authMiddleware, (req, res) => {
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    const stats = {
        total: data.total,
        lastUpdate: data.lastUpdate,
        sources: data.sources,
        countries: [...new Set(data.people.map(p => p.country))].length,
        sexDistribution: {
            male: data.people.filter(p => p.sex === 'male').length,
            female: data.people.filter(p => p.sex === 'female').length,
            unknown: data.people.filter(p => p.sex === 'unknown' || !p.sex).length
        }
    };
    
    res.json(stats);
});

// Экспорт данных (только для админа)
router.get('/export', authMiddleware, (req, res) => {
    const data = loadEncrypted(DB_PATH);
    if (!data) {
        return res.status(404).json({ error: 'База данных не найдена' });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=wanted_export.json');
    res.json(data);
});

module.exports = router;
