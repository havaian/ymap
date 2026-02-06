import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const generateToken = (payload) => {
    return jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn
    });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, config.jwtSecret);
    } catch (error) {
        return null;
    }
};

export const decodeToken = (token) => {
    return jwt.decode(token);
};