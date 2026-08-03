const fs = require('fs-extra');
const path = require('path');
const { loadEncrypted } = require('../backend/encryptor');

const DB_PATH = path.join(__dirname, '../backend/db', 'wanted.encrypted');
const BACKUP_DIR = path.join(__dirname, '../backups');

async function createBackup() {
    console.log('💾 Создание резервной копии...');
    
    await fs.ensureDir(BACKUP_DIR);
    
    if (!await fs.pathExists(DB_PATH)) {
        console.log('⚠️ База данных не найдена.');
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `wanted_${timestamp}.encrypted`);
    
    await fs.copy(DB_PATH, backupPath);
    console.log(`✅ Резервная копия создана: ${backupPath}`);
    
    // Удаляем старые бэкапы (оставляем только последние 7)
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
        .filter(f => f.startsWith('wanted_') && f.endsWith('.encrypted'))
        .map(f => ({
            name: f,
            path: path.join(BACKUP_DIR, f),
            time: fs.statSync(path.join(BACKUP_DIR, f)).mtime
        }))
        .sort((a, b) => b.time - a.time);
    
    if (backups.length > 7) {
        for (const old of backups.slice(7)) {
            await fs.remove(old.path);
            console.log(`🗑️ Удалён старый бэкап: ${old.name}`);
        }
    }
}

// Создаём бэкап каждые 6 часов
if (require.main === module) {
    createBackup().catch(console.error);
    setInterval(createBackup, 6 * 60 * 60 * 1000);
}

module.exports = createBackup;
