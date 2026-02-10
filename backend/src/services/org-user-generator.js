import crypto from 'crypto';
import User from '../user/model.js';
import { hashPassword } from '../utils/bcrypt.js';

/**
 * Generate deterministic username from organization data
 */
export const generateOrgUsername = (externalId, name) => {
    const cleanName = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
    return `org_${externalId}_${cleanName}`;
};

/**
 * Generate deterministic password from organization fields
 */
export const generateOrgPassword = (orgData) => {
    const { externalId, projectId, objectId, objectType, name, lat } = orgData;
    const combined = `${externalId}|${projectId}|${objectId}|${objectType}|${name}|${lat}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    return `${hash.substring(0, 12)}@${hash.substring(12, 16)}`;
};

/**
 * Create or update user account for an organization
 */
export const createOrganizationUser = async (orgData, organizationId) => {
    try {
        const username = generateOrgUsername(orgData.externalId, orgData.name);
        const email = `${username}@map.ytech.space`;
        const plainPassword = generateOrgPassword(orgData);

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            // Update organizationId if changed
            if (existingUser.organizationId !== organizationId) {
                existingUser.organizationId = organizationId;
                existingUser.organizationName = orgData.name;
                await existingUser.save();
            }
            return {
                userId: existingUser._id,
                email,
                password: plainPassword,
                isNew: false
            };
        }

        // Create new user with ORG_ADMIN role
        const hashedPassword = await hashPassword(plainPassword);

        const user = await User.create({
            name: orgData.name,
            email,
            password: hashedPassword,
            role: 'ORG_ADMIN',
            district: orgData.region?.name || null,
            blocked: false,
            organizationId,
            organizationName: orgData.name
        });

        return {
            userId: user._id,
            email,
            password: plainPassword,
            isNew: true
        };
    } catch (error) {
        console.error('Failed to create org user:', error);
        throw error;
    }
};