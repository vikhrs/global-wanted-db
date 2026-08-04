const axios = require('axios');
const { saveEncrypted } = require('./encryptor');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'wanted.encrypted');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9'
};

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ===== 1. FBI MOST WANTED =====
async function fetchFBI() {
    try {
        const response = await axios.get('https://api.fbi.gov/wanted/v1/list', {
            headers: HEADERS,
            params: { pageSize: 200 },
            timeout: 15000
        });
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
            city: item.field_offices?.[0] || 'N/A',
            sourceUrl: 'https://api.fbi.gov/wanted/v1/list',
            crimeCategory: 'other'
        }));
    } catch (error) {
        console.error('❌ FBI API error:', error.message);
        return [];
    }
}

// ===== 2. INTERPOL RED NOTICES =====
async function fetchInterpol() {
    try {
        const response = await axios.get('https://ws-public.interpol.int/notices/v1/red', {
            headers: HEADERS,
            params: { resultPerPage: 200 },
            timeout: 15000
        });
        const notices = response.data._embedded?.notices || [];
        const result = [];
        for (const notice of notices) {
            let photos = [];
            let details = {};
            try {
                const detailRes = await axios.get(
                    `https://ws-public.interpol.int/notices/v1/red/${notice.entity_id}`,
                    { headers: HEADERS, timeout: 10000 }
                );
                details = detailRes.data || {};
            } catch {}
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
                city: 'N/A',
                sourceUrl: 'https://ws-public.interpol.int/notices/v1/red',
                height: details.height || 'N/A',
                weight: details.weight || 'N/A',
                hairColor: details.hair_color || 'N/A',
                eyeColor: details.eye_color || 'N/A',
                crimeCategory: 'other'
            });
            await delay(300);
        }
        return result;
    } catch (error) {
        console.error('❌ INTERPOL API error:', error.message);
        return [];
    }
}

// ===== 3. US MARSHALS =====
async function fetchUSMarshals() {
    try {
        const response = await axios.get('https://www.usmarshals.gov/assets/json/wanted.json', {
            headers: HEADERS,
            timeout: 15000
        });
        const data = response.data;
        if (!Array.isArray(data)) return [];
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
            city: 'N/A',
            sourceUrl: 'https://www.usmarshals.gov/assets/json/wanted.json',
            crimeCategory: 'other'
        }));
    } catch (error) {
        console.error('❌ US Marshals API error:', error.message);
        return [];
    }
}

// ===== 4. EUROPOL =====
async function fetchEuropol() {
    try {
        const response = await axios.get('https://www.europol.europa.eu/api/wanted', {
            headers: HEADERS,
            timeout: 15000
        });
        const data = response.data;
        if (!Array.isArray(data)) return [];
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
            city: 'N/A',
            sourceUrl: 'https://www.europol.europa.eu/api/wanted',
            crimeCategory: 'other'
        }));
    } catch (error) {
        console.error('❌ Europol API error:', error.message);
        return [];
    }
}

// ===== 5. MIAMI-DADE JAIL =====
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
                classification: 'Inmate',
                sourceUrl: 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/ArcGIS/rest/services/miamidade_jail_data/FeatureServer/0',
                crimeCategory: 'other'
            };
        });
    } catch (error) {
        console.error('❌ Miami-Dade Jail API error:', error.message);
        return [];
    }
}

// ===== 6. MIAMI-DADE SEX OFFENDERS =====
async function fetchMiamiSexOffenders() {
    try {
        const url = 'https://gis-mdc.opendata.arcgis.com/datasets/MDC::sexual-predator.geojson';
        const response = await axios.get(url, {
            headers: HEADERS,
            timeout: 15000
        });
        const features = response.data.features || [];
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
                classification: 'Sex Offender',
                sourceUrl: 'https://gis-mdc.opendata.arcgis.com/datasets/MDC::sexual-predator.geojson',
                height: attrs.height || 'N/A',
                weight: attrs.weight || 'N/A',
                race: attrs.race || 'N/A',
                crimeCategory: 'sexual'
            };
        });
    } catch (error) {
        console.error('❌ Miami Sex Offenders API error:', error.message);
        return [];
    }
}

// ===== 7. DETROIT CRIME =====
async function fetchDetroitCrime() {
    try {
        const url = 'https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services/RMS_Crime_Incidents/FeatureServer/0/query';
        const response = await axios.get(url, {
            headers: HEADERS,
            params: {
                where: '1=1',
                outFields: 'offense_description,address,incident_date',
                returnGeometry: false,
                f: 'json',
                resultRecordCount: 500
            },
            timeout: 15000
        });
        const features = response.data.features || [];
        return features.map(f => {
            const attrs = f.attributes || {};
            return {
                firstName: 'Unknown',
                lastName: 'Unknown',
                dob: '',
                address: attrs.address || 'N/A',
                city: 'Detroit',
                state: 'MI',
                zip: 'N/A',
                country: 'USA',
                crime: attrs.offense_description || 'Unknown crime',
                status: 'Incident reported',
                source: 'Detroit Police',
                sex: 'unknown',
                age: 0,
                reward: 'N/A',
                caseNumber: attrs.ObjectId?.toString() || 'N/A',
                photo: null,
                charges: [attrs.offense_description].filter(Boolean),
                classification: 'Incident',
                sourceUrl: 'https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services/RMS_Crime_Incidents/FeatureServer/0',
                crimeCategory: 'other'
            };
        });
    } catch (error) {
        console.error('❌ Detroit Crime API error:', error.message);
        return [];
    }
}

// ===== 8. MIAMI-DADE POLICE (SRRR) =====
async function fetchMiamiPolice() {
    try {
        const url = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/ArcGIS/rest/services/PCB_Report/FeatureServer/0/query';
        const response = await axios.get(url, {
            headers: HEADERS,
            params: {
                where: '1=1',
                outFields: 'District,Incident_Date,Employee_Race,Employee_Sex,Employee_Age,Subject_Race,Subject_Sex,Subject_Age,Case_Number',
                returnGeometry: false,
                f: 'json',
                resultRecordCount: 500
            },
            timeout: 15000
        });
        const features = response.data.features || [];
        return features.map(f => {
            const attrs = f.attributes || {};
            return {
                firstName: 'Subject',
                lastName: `Case ${attrs.Case_Number || 'N/A'}`,
                dob: '',
                address: 'N/A',
                city: 'Miami',
                state: 'FL',
                zip: 'N/A',
                country: 'USA',
                crime: 'Police incident',
                status: 'Reported',
                source: 'Miami-Dade Police',
                sex: attrs.Subject_Sex || 'unknown',
                age: attrs.Subject_Age || 0,
                reward: 'N/A',
                caseNumber: attrs.Case_Number || 'N/A',
                photo: null,
                charges: ['Police incident'],
                classification: 'Incident',
                sourceUrl: 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/ArcGIS/rest/services/PCB_Report/FeatureServer/0',
                race: attrs.Subject_Race || 'N/A',
                employeeRace: attrs.Employee_Race || 'N/A',
                employeeSex: attrs.Employee_Sex || 'N/A',
                employeeAge: attrs.Employee_Age || 0,
                district: attrs.District || 'N/A',
                crimeCategory: 'other'
            };
        });
    } catch (error) {
        console.error('❌ Miami Police API error:', error.message);
        return [];
    }
}

// ===== ОСНОВНОЙ СБОР (БЕЗ ДЕМО) =====
async function collectAllData() {
    console.log('🔄 Начинается сбор данных из API (БЕЗ ДЕМО)...');

    const allData = [];

    // FBI
    const fbi = await fetchFBI();
    allData.push(...fbi);
    console.log(`✅ FBI: ${fbi.length} записей`);
    await delay(1000);

    // INTERPOL
    const interpol = await fetchInterpol();
    allData.push(...interpol);
    console.log(`✅ INTERPOL: ${interpol.length} записей`);
    await delay(1000);

    // US Marshals
    const marshals = await fetchUSMarshals();
    allData.push(...marshals);
    console.log(`✅ US Marshals: ${marshals.length} записей`);
    await delay(1000);

    // Europol
    const europol = await fetchEuropol();
    allData.push(...europol);
    console.log(`✅ Europol: ${europol.length} записей`);
    await delay(1000);

    // Miami-Dade Jail
    const miamiJail = await fetchMiamiDadeJail();
    allData.push(...miamiJail);
    console.log(`✅ Miami-Dade Jail: ${miamiJail.length} записей`);
    await delay(1000);

    // Miami-Dade Sex Offenders
    const miamiSex = await fetchMiamiSexOffenders();
    allData.push(...miamiSex);
    console.log(`✅ Miami-Dade Sex Offenders: ${miamiSex.length} записей`);
    await delay(1000);

    // Detroit Crime
    const detroit = await fetchDetroitCrime();
    allData.push(...detroit);
    console.log(`✅ Detroit Crime: ${detroit.length} записей`);
    await delay(1000);

    // Miami-Dade Police
    const miamiPolice = await fetchMiamiPolice();
    allData.push(...miamiPolice);
    console.log(`✅ Miami-Dade Police: ${miamiPolice.length} записей`);

    // Удаление дубликатов
    const unique = Array.from(
        new Map(allData.map(item =>
            [`${item.firstName}|${item.lastName}|${item.dob}|${item.country}`, item]
        )).values()
    );

    // Формируем результат с детальной статистикой по источникам
    const sources = {};
    allData.forEach(item => {
        const sourceName = item.source || 'Unknown';
        if (!sources[sourceName]) sources[sourceName] = 0;
        sources[sourceName]++;
    });

    const result = {
        total: unique.length,
        lastUpdate: new Date().toISOString(),
        sources: sources,
        people: unique
    };

    saveEncrypted(DB_PATH, result);
    console.log(`✅ База обновлена: ${result.total} записей`);
    console.log('📊 Источники:');
    Object.entries(sources).forEach(([name, count]) => {
        console.log(`   - ${name}: ${count} записей`);
    });

    return result;
}

module.exports = { collectAllData };
