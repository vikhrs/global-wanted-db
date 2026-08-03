const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ЖЕСТКО ЗАШИТЫЕ ДАННЫЕ (из .env или напрямую)
const JWT_SECRET = process.env.JWT_SECRET || '9vR#4mX!qP7@Lk2$Nz8^Df5&Ha1*Cs6Wu3Ye0BgTx';
const ADMIN_USER = process.env.ADMIN_USER || 'dbsvc_A9xR7QmL4VpN82';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Y#8vQ!2mL@7xP$4rN^9kW&5cT*1zHf6JbXs';

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(ADMIN_PASS, salt);

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

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
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
