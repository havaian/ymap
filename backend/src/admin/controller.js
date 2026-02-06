import User from '../user/model.js';
import { hashPassword, comparePassword } from '../utils/bcrypt.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmail, validatePassword } from '../utils/validators.js';

export const register = async (req, res) => {
    const { name, email, password, district } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Name, email and password are required'
        });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format'
        });
    }

    if (!validatePassword(password)) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters'
        });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({
            success: false,
            message: 'Email already registered'
        });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        district: district || null,
        role: 'CITIZEN'
    });

    const token = generateToken({ userId: user._id });

    res.status(201).json({
        success: true,
        data: {
            user: user.toJSON(),
            token
        }
    });
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }

    if (user.blocked) {
        return res.status(403).json({
            success: false,
            message: 'Your account has been blocked'
        });
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }

    const token = generateToken({ userId: user._id });

    res.json({
        success: true,
        data: {
            user: user.toJSON(),
            token
        }
    });
};

export const getMe = async (req, res) => {
    res.json({
        success: true,
        data: req.user.toJSON()
    });
};