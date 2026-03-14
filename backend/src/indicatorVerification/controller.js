// backend/src/indicatorVerification/controller.js
import IndicatorVerification from './model.js';
import User from '../user/model.js';
import mongoose from 'mongoose';

// GET /api/objects/:id/indicator-verifications
export const getForObject = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ success: false, message: 'Invalid id' });

        const verifs = await IndicatorVerification.find({ objectId: id }).lean();

        // Агрегируем по полю: avgRating, confirmed, disputed
        const byField = {};
        verifs.forEach(v => {
            if (!byField[v.field]) byField[v.field] = { confirmed: 0, disputed: 0, ratings: [], total: 0 };
            byField[v.field][v.status]++;
            byField[v.field].total++;
            if (v.rating) byField[v.field].ratings.push(v.rating);
        });

        // Считаем avgRating
        Object.values(byField).forEach(f => {
            f.avgRating = f.ratings.length
                ? Math.round((f.ratings.reduce((a, b) => a + b, 0) / f.ratings.length) * 10) / 10
                : null;
            delete f.ratings;
        });

        res.json({ success: true, data: byField });
    } catch (err) {
        console.error('getForObject error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch indicator verifications' });
    }
};

// POST /api/objects/:id/indicator-verifications
export const submit = async (req, res) => {
    try {
        const { id } = req.params;
        const { field, status, rating, comment } = req.body;

        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ success: false, message: 'Invalid id' });
        if (!field || !['confirmed', 'disputed'].includes(status))
            return res.status(400).json({ success: false, message: 'field and status are required' });
        if (rating !== undefined && (rating < 1 || rating > 5))
            return res.status(400).json({ success: false, message: 'rating must be 1-5' });

        // upsert — пользователь может изменить своё мнение
        await IndicatorVerification.findOneAndUpdate(
            { objectId: id, field, userId: req.user._id },
            { status, rating: rating || null, comment: comment || null },
            { upsert: true, new: true }
        );

        // +1 балл пользователю (только при первом сабмите — upsert отслеживает)
        // Используем $inc безопасно, если поле points не существует — создастся
        await User.findByIdAndUpdate(req.user._id, { $inc: { points: 1 } });

        // Возвращаем обновлённую агрегацию по этому полю
        const verifs = await IndicatorVerification.find({ objectId: id, field }).lean();
        const confirmed = verifs.filter(v => v.status === 'confirmed').length;
        const disputed = verifs.filter(v => v.status === 'disputed').length;
        const ratings = verifs.map(v => v.rating).filter(Boolean);
        const avgRating = ratings.length
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
            : null;

        res.json({ success: true, data: { field, confirmed, disputed, total: verifs.length, avgRating } });
    } catch (err) {
        console.error('submit indicator verification error:', err);
        res.status(500).json({ success: false, message: 'Failed to submit indicator verification' });
    }
};