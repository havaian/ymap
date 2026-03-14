// backend/src/middleware/citizenOnly.js
// Blocks admin accounts from creating citizen issue reports.
// Assumes authMiddleware has already run and populated req.user.

export const citizenOnly = (req, res, next) => {
    if (req.user?.role === 'ADMIN') {
        return res.status(403).json({
            success: false,
            message: 'Admins cannot create citizen issue reports'
        });
    }
    next();
};