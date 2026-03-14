import User from './model.js';

export const getUsers = async (req, res) => {
    const users = await User.find().select('-password');

    res.json({
        success: true,
        data: users.map(u => u.toJSON())
    });
};

export const blockUser = async (req, res) => {
    const { id } = req.params;
    const { blocked } = req.body;

    if (typeof blocked !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: 'blocked must be boolean'
        });
    }

    const user = await User.findById(id);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    if (user.role === 'ADMIN') {
        return res.status(400).json({
            success: false,
            message: 'Cannot block admin users'
        });
    }

    user.blocked = blocked;
    await user.save();

    res.json({
        success: true,
        data: user.toJSON()
    });
};