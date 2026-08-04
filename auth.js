const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ===== ВАШИ ДАННЫЕ (жёстко прописаны) =====
const JWT_SECRET = '9vR#4mX!qP7@Lk2$Nz8^Df5&Ha1*Cs6Wu3Ye0BgTx';
const ADMIN_USER = 'dbsvc_A9xR7QmL4VpN82';
const ADMIN_PASS = 'Y#8vQ!2mL@7xP$4rN^9kW&5cT*1zHf6JbXs';

// Хешируем пароль
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(ADMIN_PASS, salt);

function login(username, password) {
    console.log(`🔐 Попытка входа: ${username}`);
    console.log(`📌 Ожидаемый логин: ${ADMIN_USER}`);
    
    if (username === ADMIN_USER && bcrypt.compareSync(password, hash)) {
        const token = jwt.sign(
            { user: username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        console.log('✅ Вход успешен');
        return token;
    }
    console.log('❌ Неверные логин или пароль');
    return null;
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.log('❌ Ошибка верификации токена:', error.message);
        return null;
    }
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ error: 'Недействительный токен' });
    }
    
    req.user = decoded;
    next();
}

module.exports = { login, verifyToken, authMiddleware };
