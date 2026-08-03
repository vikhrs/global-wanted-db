const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// Хеширование пароля
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(ADMIN_PASS, salt);

// Логин
function login(username, password) {
    if (username === ADMIN_USER && bcrypt.compareSync(password, hash)) {
        return jwt.sign(
            { user: username, role: 'admin', timestamp: Date.now() },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
    }
    return null;
}

// Проверка токена
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

// Middleware для защиты роутов
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
