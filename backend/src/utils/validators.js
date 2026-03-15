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

const UZ_BOUNDS = { latMin: 37.2, latMax: 45.6, lngMin: 55.9, lngMax: 73.1 };

export const validateCoordinates = (lat, lng) => {
    const la = parseFloat(lat);
    const lo = parseFloat(lng);
    if (isNaN(la) || isNaN(lo)) return false;
    return la >= UZ_BOUNDS.latMin && la <= UZ_BOUNDS.latMax &&
           lo >= UZ_BOUNDS.lngMin && lo <= UZ_BOUNDS.lngMax;
};