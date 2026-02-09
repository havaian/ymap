import { getUsers, blockUser } from '../user/controller.js';
import { importOrganizationsFromExcel } from '../services/excel.js';
import { generateMockData, clearSeededData } from '../services/seeder.js';

export const adminGetUsers = getUsers;
export const adminBlockUser = blockUser;

export const uploadOrganizations = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    const result = await importOrganizationsFromExcel(req.file.path);

    res.json({
        success: true,
        data: result
    });
};

export const seedData = async (req, res) => {
    const { issuesCount = 1000, includeComments = true } = req.body;

    const result = await generateMockData(parseInt(issuesCount), includeComments);

    res.json({
        success: true,
        data: result
    });
};

export const clearSeeded = async (req, res) => {
    const result = await clearSeededData();

    res.json({
        success: true,
        data: result
    });
};