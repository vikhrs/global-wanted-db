const CryptoJS = require('crypto-js');
const fs = require('fs-extra');
const path = require('path');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '8f2c7a91d4e5b0f6c39a18de72b4f5a98c1e6d703fa9421b7c8d5e0f9a6b3142';

function encryptData(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
}

function decryptData(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

function saveEncrypted(filePath, data) {
    const encrypted = encryptData(data);
    fs.writeFileSync(filePath, encrypted);
}

function loadEncrypted(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const encrypted = fs.readFileSync(filePath, 'utf8');
    return decryptData(encrypted);
}

module.exports = { encryptData, decryptData, saveEncrypted, loadEncrypted };
