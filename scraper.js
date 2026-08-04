const axios = require('axios');
const { saveEncrypted } = require('./encryptor');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'wanted.encrypted');

// ЗАГОЛОВКИ для обхода блокировки
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
};

// Задержка между запросами
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== FBI =====
async function fetchFBI() {
    try {
        const url = 'https://api.fbi.gov/wanted/v1/list';
        const response = await axios.get(url, {
            headers: HEADERS,
            params: { pageSize: 200 },
            timeout: 10000
        });
        return response.data.items.map(item => ({
            firstName: item.title ? item.title.split(' ')[0] : '',
            lastName: item.title ? item.title.split(' ').slice(1).join(' ') : '',
            dob: item.date_of_birth || '',
            country: 'USA',
            crime: item.description || 'FBI Wanted',
            status: 'FBI Most Wanted',
            source: 'FBI',
            sex: item.sex || 'unknown',
            age: item.age || 0,
            reward: item.reward_text || 'N/A',
            caseNumber: item.uid || 'N/A',
            lastSeen: item.place_of_birth || 'N/A'
        }));
    } catch (error) {
        console.error('❌ FBI error:', error.message);
        return [];
    }
}

// ===== INTERPOL =====
async function fetchInterpol() {
    try {
        const url = 'https://ws-public.interpol.int/notices/v1/red';
        const response = await axios.get(url, {
            headers: HEADERS,
            params: { resultPerPage: 200 },
            timeout: 10000
        });
        return response.data._embedded.notices.map(notice => ({
            firstName: notice.forename || '',
            lastName: notice.name || '',
            dob: notice.date_of_birth || '',
            country: notice.nationality || '',
            crime: notice.charge || 'INTERPOL Red Notice',
            status: 'INTERPOL Red Notice',
            source: 'INTERPOL',
            sex: notice.sex_id || 'unknown',
            age: notice.age || 0,
            reward: 'N/A',
            caseNumber: notice.entity_id || 'N/A',
            lastSeen: notice.place_of_birth || 'N/A'
        }));
    } catch (error) {
        console.error('❌ INTERPOL error:', error.message);
        return [];
    }
}

// ===== US MARSHALS =====
async function fetchUSMarshals() {
    try {
        const url = 'https://www.usmarshals.gov/assets/json/wanted.json';
        const response = await axios.get(url, {
            headers: HEADERS,
            timeout: 10000
        });
        const data = response.data;
        if (!Array.isArray(data)) return [];
        return data.map(item => ({
            firstName: item.name ? item.name.split(' ')[0] : '',
            lastName: item.name ? item.name.split(' ').slice(1).join(' ') : '',
            dob: item.dob || '',
            country: 'USA',
            crime: item.charge || 'US Marshals Wanted',
            status: 'US Marshals Most Wanted',
            source: 'US Marshals',
            sex: item.sex || 'unknown',
            age: item.age || 0,
            reward: item.reward || 'N/A',
            caseNumber: item.case_number || 'N/A',
            lastSeen: item.location || 'N/A'
        }));
    } catch (error) {
        console.error('❌ US Marshals error:', error.message);
        return [];
    }
}

// ===== EUROPOL =====
async function fetchEuropol() {
    try {
        const url = 'https://www.europol.europa.eu/api/wanted';
        const response = await axios.get(url, {
            headers: HEADERS,
            timeout: 10000
        });
        const data = response.data;
        if (!Array.isArray(data)) return [];
        return data.map(item => ({
            firstName: item.first_name || '',
            lastName: item.last_name || '',
            dob: item.dob || '',
            country: item.country || 'EU',
            crime: item.charge || 'Europol Wanted',
            status: 'Europol Most Wanted',
            source: 'Europol',
            sex: item.sex || 'unknown',
            age: item.age || 0,
            reward: item.reward || 'N/A',
            caseNumber: item.case_number || 'N/A',
            lastSeen: item.last_location || 'N/A'
        }));
    } catch (error) {
        console.error('❌ Europol error:', error.message);
        return [];
    }
}

// ===== ОСНОВНОЙ СБОР (БЕЗ ДЕМО) =====
async function collectAllData() {
    console.log('🔄 Начинается сбор данных...');

    const allData = [];

    const fbi = await fetchFBI();
    allData.push(...fbi);
    console.log(`✅ FBI: ${fbi.length} записей`);
    await delay(1000);

    const interpol = await fetchInterpol();
    allData.push(...interpol);
    console.log(`✅ INTERPOL: ${interpol.length} записей`);
    await delay(1000);

    const marshals = await fetchUSMarshals();
    allData.push(...marshals);
    console.log(`✅ US Marshals: ${marshals.length} записей`);
    await delay(1000);

    const europol = await fetchEuropol();
    allData.push(...europol);
    console.log(`✅ Europol: ${europol.length} записей`);

    // Удаление дубликатов
    const unique = Array.from(
        new Map(allData.map(item =>
            [`${item.firstName}|${item.lastName}|${item.dob}|${item.country}`, item]
        )).values()
    );

    const result = {
        total: unique.length,
        lastUpdate: new Date().toISOString(),
        sources: {
            fbi: allData.filter(d => d.source === 'FBI').length,
            interpol: allData.filter(d => d.source === 'INTERPOL').length,
            marshals: allData.filter(d => d.source === 'US Marshals').length,
            europol: allData.filter(d => d.source === 'Europol').length
        },
        people: unique
    };

    saveEncrypted(DB_PATH, result);
    console.log(`✅ База обновлена: ${result.total} записей`);
    console.log(`📊 Источники: FBI=${result.sources.fbi}, INTERPOL=${result.sources.interpol}, Marshals=${result.sources.marshals}, Europol=${result.sources.europol}`);

    return result;
}

module.exports = { collectAllData };
