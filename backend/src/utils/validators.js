export const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

export const validatePassword = (password) => {
    return password && password.length >= 6;
};

export const validateObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

export const validateCoordinates = (lat, lng) => {
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180
    );
};