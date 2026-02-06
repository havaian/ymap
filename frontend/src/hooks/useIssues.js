import { useState, useEffect } from 'react';
import { issuesAPI } from '../services/api';

export const useIssues = (filters = {}) => {
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchIssues = async () => {
        try {
            setLoading(true);
            const response = await issuesAPI.getAll(filters);
            setIssues(response.data.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch issues');
            console.error('Error fetching issues:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIssues();
    }, [JSON.stringify(filters)]);

    const refetch = () => fetchIssues();

    return { issues, loading, error, refetch };
};

export const useOrganizations = (filters = {}) => {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchOrganizations = async () => {
            try {
                setLoading(true);
                const { organizationsAPI } = await import('../services/api');
                const response = await organizationsAPI.getAll(filters);
                setOrganizations(response.data.data);
                setError(null);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to fetch organizations');
                console.error('Error fetching organizations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrganizations();
    }, [JSON.stringify(filters)]);

    return { organizations, loading, error };
};