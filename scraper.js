const axios = require('axios');
const { saveEncrypted } = require('./encryptor');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'wanted.encrypted');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json'
};

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ===== FBI MOST WANTED (РЕАЛЬНЫЕ ДАННЫЕ) =====
async function fetchFBI() {
    try {
        const response = await axios.get('https://api.fbi.gov/wanted/v1/list', {
            headers: HEADERS,
            params: { pageSize: 200 },
            timeout: 15000
        });
        console.log(`✅ FBI API доступен, получено ${response.data.items?.length || 0} записей`);
        return response.data.items.map(item => ({
            firstName: item.title ? item.title.split(' ')[0] : '',
            lastName: item.title ? item.title.split(' ').slice(1).join(' ') : '',
            dob: item.date_of_birth || '',
            address: item.place_of_birth || 'N/A',
            country: 'USA',
            crime: item.description || 'FBI Wanted',
            status: item.status || 'Active',
            source: 'FBI',
            sex: item.sex || 'unknown',
            age: item.age || 0,
            reward: item.reward_text || 'N/A',
            caseNumber: item.uid || 'N/A',
            photo: item.images?.[0]?.original || null,
            charges: item.charges || [],
            classification: item.classification || '',
            city: item.field_offices?.[0] || 'N/A'
        }));
    } catch (error) {
        console.error('❌ FBI API недоступен:', error.message);
        return [];
    }
}

// ===== INTERPOL RED NOTICES (РЕАЛЬНЫЕ ДАННЫЕ) =====
async function fetchInterpol() {
    try {
        const response = await axios.get('https://ws-public.interpol.int/notices/v1/red', {
            headers: HEADERS,
            params: { resultPerPage: 200 },
            timeout: 15000
        });
        const notices = response.data._embedded?.notices || [];
        console.log(`✅ INTERPOL API доступен, получено ${notices.length} записей`);
        
        const result = [];
        for (const notice of notices) {
            let photos = [];
            try {
                const photoRes = await axios.get(
                    `https://ws-public.interpol.int/notices/v1/red/${notice.entity_id}/images`,
                    { headers: HEADERS, timeout: 10000 }
                );
                photos = photoRes.data._embedded?.images || [];
            } catch {}
            
            result.push({
                firstName: notice.forename || '',
                lastName: notice.name || '',
                dob: notice.date_of_birth || '',
                address: notice.place_of_birth || 'N/A',
                country: notice.nationality || '',
                crime: notice.charge || 'INTERPOL Red Notice',
                status: 'INTERPOL Red Notice',
                source: 'INTERPOL',
                sex: notice.sex_id || 'unknown',
                age: notice.age || 0,
                reward: 'N/A',
                caseNumber: notice.entity_id || 'N/A',
                photo: photos.length > 0 ? photos[0]._links?.self?.href : null,
                charges: notice.charge ? [notice.charge] : [],
                classification: 'Red Notice',
                city: 'N/A'
            });
            await delay(300);
        }
        return result;
    } catch (error) {
        console.error('❌ INTERPOL API недоступен:', error.message);
        return [];
    }
}

// ===== MIAMI-DADE JAIL (РЕАЛЬНЫЕ ДАННЫЕ) =====
async function fetchMiamiDadeJail() {
    try {
        const url = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/ArcGIS/rest/services/miamidade_jail_data/FeatureServer/0/query';
        const response = await axios.get(url, {
            headers: HEADERS,
            params: {
                where: '1=1',
                outFields: 'Defendant,DOB,Address,City,State,Zip,Charge1,Charge2,Charge3',
                returnGeometry: false,
                f: 'json',
                resultRecordCount: 1000
            },
            timeout: 15000
        });
        const features = response.data.features || [];
        console.log(`✅ Miami-Dade Jail API доступен, получено ${features.length} записей`);
        
        return features.map(f => {
            const attrs = f.attributes || {};
            return {
                firstName: (attrs.Defendant || '').split(' ')[0] || '',
                lastName: (attrs.Defendant || '').split(' ').slice(1).join(' ') || '',
                dob: attrs.DOB || '',
                address: attrs.Address || 'N/A',
                city: attrs.City || 'Miami',
                state: attrs.State || 'FL',
                zip: attrs.Zip || 'N/A',
                country: 'USA',
                crime: [attrs.Charge1, attrs.Charge2, attrs.Charge3].filter(Boolean).join(', ') || 'Unknown charge',
                status: 'Booked',
                source: 'Miami-Dade Jail',
                sex: 'unknown',
                age: 0,
                reward: 'N/A',
                caseNumber: attrs.ObjectId?.toString() || 'N/A',
                photo: null,
                charges: [attrs.Charge1, attrs.Charge2, attrs.Charge3].filter(Boolean),
                classification: 'Inmate'
            };
        });
    } catch (error) {
        console.error('❌ Miami-Dade Jail API недоступен:', error.message);
        return [];
    }
}

// ===== MIAMI-DADE SEX OFFENDERS (РЕАЛЬНЫЕ ДАННЫЕ) =====
async function fetchMiamiSexOffenders() {
    try {
        const url = 'https://gis-mdc.opendata.arcgis.com/datasets/MDC::sexual-predator.geojson';
        const response = await axios.get(url, {
            headers: HEADERS,
            timeout: 15000
        });
        const features = response.data.features || [];
        console.log(`✅ Miami Sex Offenders API доступен, получено ${features.length} записей`);
        
        return features.map(f => {
            const attrs = f.properties || {};
            return {
                firstName: attrs.fname || '',
                lastName: attrs.lname || '',
                dob: attrs.dob || '',
                address: [attrs.address, attrs.address2].filter(Boolean).join(' ') || 'N/A',
                city: attrs.city || 'N/A',
                state: attrs.tran_state || 'FL',
                zip: attrs.zip || 'N/A',
                country: 'USA',
                crime: 'Sexual offense',
                status: attrs.status || 'Registered',
                source: 'Miami-Dade Sex Offender Registry',
                sex: attrs.sex || 'unknown',
                age: 0,
                reward: 'N/A',
                caseNumber: attrs.doc_nbr || 'N/A',
                photo: attrs.image_id ? `https://gis-mdc.opendata.arcgis.com/images/${attrs.image_id}` : null,
                charges: ['Sexual offense'],
                classification: 'Sex Offender'
            };
        });
    } catch (error) {
        console.error('❌ Miami Sex Offenders API недоступен:', error.message);
        return [];
    }
}

// ===== US MARSHALS (РЕАЛЬНЫЕ ДАННЫЕ) =====
async function fetchUSMarshals() {
    try {
        const response = await axios.get('https://www.usmarshals.gov/assets/json/wanted.json', {
            headers: HEADERS,
            timeout: 15000
        });
        const data = response.data;
        if (!Array.isArray(data)) return [];
        console.log(`✅ US Marshals API доступен, получено ${data.length} записей`);
        
        return data.map(item => ({
            firstName: item.name ? item.name.split(' ')[0] : '',
            lastName: item.name ? item.name.split(' ').slice(1).join(' ') : '',
            dob: item.dob || '',
            address: item.location || 'N/A',
            country: 'USA',
            crime: item.charge || 'US Marshals Wanted',
            status: 'US Marshals Most Wanted',
            source: 'US Marshals',
            sex: item.sex || 'unknown',
            age: item.age || 0,
            reward: item.reward || 'N/A',
            caseNumber: item.case_number || 'N/A',
            photo: item.photo || null,
            charges: item.charge ? [item.charge] : [],
            classification: '15 Most Wanted',
            city: 'N/A'
        }));
    } catch (error) {
        console.error('❌ US Marshals API недоступен:', error.message);
        return [];
    }
}

// ===== EUROPOL (РЕАЛЬНЫЕ ДАННЫЕ) =====
async function fetchEuropol() {
    try {
        const response = await axios.get('https://www.europol.europa.eu/api/wanted', {
            headers: HEADERS,
            timeout: 15000
        });
        const data = response.data;
        if (!Array.isArray(data)) return [];
        console.log(`✅ Europol API доступен, получено ${data.length} записей`);
        
        return data.map(item => ({
            firstName: item.first_name || '',
            lastName: item.last_name || '',
            dob: item.dob || '',
            address: item.last_location || 'N/A',
            country: item.country || 'EU',
            crime: item.charge || 'Europol Wanted',
            status: 'Europol Most Wanted',
            source: 'Europol',
            sex: item.sex || 'unknown',
            age: item.age || 0,
            reward: item.reward || 'N/A',
            caseNumber: item.case_number || 'N/A',
            photo: item.photo || null,
            charges: item.charge ? [item.charge] : [],
            classification: 'EU Most Wanted',
            city: 'N/A'
        }));
    } catch (error) {
        console.error('❌ Europol API недоступен:', error.message);
        return [];
    }
}

// ===== ОСНОВНОЙ СБОР (ТОЛЬКО РЕАЛЬНЫЕ API) =====
async function collectAllData() {
    console.log('🔄 Начинается сбор РЕАЛЬНЫХ данных из API...');

    const allData = [];

    // FBI
    const fbi = await fetchFBI();
    allData.push(...fbi);
    await delay(1000);

    // INTERPOL
    const interpol = await fetchInterpol();
    allData.push(...interpol);
    await delay(1000);

    // Miami-Dade Jail
    const miamiJail = await fetchMiamiDadeJail();
    allData.push(...miamiJail);
    await delay(1000);

    // Miami Sex Offenders
    const miamiSex = await fetchMiamiSexOffenders();
    allData.push(...miamiSex);
    await delay(1000);

    // US Marshals
    const marshals = await fetchUSMarshals();
    allData.push(...marshals);
    await delay(1000);

    // Europol
    const europol = await fetchEuropol();
    allData.push(...europol);

    // Удаление дубликатов по имени + дате + стране
    const unique = Array.from(
        new Map(allData.map(item =>
            [`${item.firstName}|${item.lastName}|${item.dob}|${item.country}`, item]
        )).values()
    );

    // Формируем результат
    const result = {
        total: unique.length,
        lastUpdate: new Date().toISOString(),
        sources: {
            fbi: allData.filter(d => d.source === 'FBI').length,
            interpol: allData.filter(d => d.source === 'INTERPOL').length,
            miamiJail: allData.filter(d => d.source === 'Miami-Dade Jail').length,
            miamiSex: allData.filter(d => d.source === 'Miami-Dade Sex Offender Registry').length,
            marshals: allData.filter(d => d.source === 'US Marshals').length,
            europol: allData.filter(d => d.source === 'Europol').length
        },
        people: unique
    };

    saveEncrypted(DB_PATH, result);
    console.log(`✅ База обновлена: ${result.total} РЕАЛЬНЫХ записей`);
    console.log(`📊 Источники: FBI=${result.sources.fbi}, INTERPOL=${result.sources.interpol}, Miami Jail=${result.sources.miamiJail}, Miami Sex=${result.sources.miamiSex}, Marshals=${result.sources.marshals}, Europol=${result.sources.europol}`);

    return result;
}

module.exports = { collectAllData };
