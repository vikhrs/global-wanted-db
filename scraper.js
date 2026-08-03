const axios = require('axios');
const { saveEncrypted } = require('./encryptor');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'wanted.encrypted');

// Функция для получения данных из FBI
async function fetchFBI() {
    const url = 'https://api.fbi.gov/wanted/v1/list';
    const response = await axios.get(url, { params: { pageSize: 200 } });
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
}

// Функция для получения данных из INTERPOL
async function fetchInterpol() {
    const url = 'https://ws-public.interpol.int/notices/v1/red';
    const response = await axios.get(url, { params: { resultPerPage: 200 } });
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
}

// Функция для получения данных из US Marshals
async function fetchUSMarshals() {
    try {
        const url = 'https://www.usmarshals.gov/api/wanted';
        const response = await axios.get(url);
        return response.data.map(item => ({
            firstName: item.name ? item.name.split(' ')[0] : '',
            lastName: item.name ? item.name.split(' ').slice(1).join(' ') : '',
            dob: item.dob || '',
            country: 'USA',
            crime: item.crime || 'US Marshals Wanted',
            status: 'US Marshals 15 Most Wanted',
            source: 'US Marshals',
            sex: item.sex || 'unknown',
            age: item.age || 0,
            reward: item.reward || 'N/A',
            caseNumber: item.case_number || 'N/A',
            lastSeen: item.last_known_address || 'N/A'
        }));
    } catch { return []; }
}

// Функция для получения данных из Europol
async function fetchEuropol() {
    try {
        const url = 'https://www.europol.europa.eu/api/wanted';
        const response = await axios.get(url);
        return response.data.map(item => ({
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
    } catch { return []; }
}

// Функция для получения данных из России (МВД)
async function fetchRussia() {
    try {
        const url = 'https://xn--b1aew.xn--p1ai/upload/expired/export.json';
        const response = await axios.get(url);
        return response.data.map(item => ({
            firstName: item.firstName || '',
            lastName: item.lastName || '',
            patronymic: item.patronymic || '',
            dob: item.birthDate || '',
            country: 'Russia',
            crime: item.crime || 'Разыскивается',
            status: 'Федеральный розыск',
            source: 'МВД РФ',
            sex: item.sex || 'unknown',
            age: item.age || 0,
            reward: 'N/A',
            caseNumber: item.caseNumber || 'N/A',
            lastSeen: item.address || 'N/A'
        }));
    } catch { return []; }
}

// Сбор всех данных
async function collectAllData() {
    console.log('🔄 Начинается сбор данных со всех источников...');
    
    const allData = [];
    
    try {
        const fbi = await fetchFBI();
        allData.push(...fbi);
        console.log(`✅ FBI: ${fbi.length} записей`);
    } catch(e) { console.error('❌ FBI error:', e.message); }
    
    try {
        const interpol = await fetchInterpol();
        allData.push(...interpol);
        console.log(`✅ INTERPOL: ${interpol.length} записей`);
    } catch(e) { console.error('❌ INTERPOL error:', e.message); }
    
    try {
        const marshals = await fetchUSMarshals();
        allData.push(...marshals);
        console.log(`✅ US Marshals: ${marshals.length} записей`);
    } catch(e) { console.error('❌ US Marshals error:', e.message); }
    
    try {
        const europol = await fetchEuropol();
        allData.push(...europol);
        console.log(`✅ EUROPOL: ${europol.length} записей`);
    } catch(e) { console.error('❌ EUROPOL error:', e.message); }
    
    try {
        const russia = await fetchRussia();
        allData.push(...russia);
        console.log(`✅ Russia: ${russia.length} записей`);
    } catch(e) { console.error('❌ Russia error:', e.message); }
    
    // Удаление дубликатов по имени + дате + стране
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
            europol: allData.filter(d => d.source === 'Europol').length,
            russia: allData.filter(d => d.source === 'МВД РФ').length
        },
        people: unique
    };
    
    // Сохраняем в зашифрованный файл
    saveEncrypted(DB_PATH, result);
    console.log(`✅ База данных обновлена: ${unique.length} уникальных записей`);
    console.log(`🔒 Данные зашифрованы AES-256`);
    
    return result;
}

// Запускаем каждые 5 минут
if (require.main === module) {
    collectAllData();
    setInterval(collectAllData, 300000); // 5 минут
}

module.exports = { collectAllData };
