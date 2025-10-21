// middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET );
        req.user = decoded; 
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const authorize = (userRole) =>(req, res, next) =>{
    if(!userRole.includes(req.user.userrole)){
        return res.status(403).json({error: 'Unauthorized access'})
    }
    next();
};

module.exports = {authMiddleware, authorize};