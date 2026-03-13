import { useState, useEffect } from 'react';
import { issuesAPI } from '../services/api';

interface Issue {
    _id: string;
    title: string;
    description?: string;
    status: string;
    region?: string;
    category?: string;
    createdAt: string;
    updatedAt: string;
}

interface Organization {
    _id: string;
    name: string;
    region?: string;
    type?: string;
    createdAt: string;
    updatedAt: string;
}

interface UseIssuesReturn {
    issues: Issue[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

interface UseOrganizationsReturn {
    organizations: Organization[];
    loading: boolean;
    error: string | null;
}

export const useIssues = (filters: Record<string, unknown> = {}): UseIssuesReturn => {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchIssues = async (): Promise<void> => {
        try {
            setLoading(true);
            const response = await issuesAPI.getAll(filters);
            setIssues(response.data.data);
            setError(null);
        } catch (err: unknown) {
            const message = err instanceof Error
                ? (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? err.message
                : 'Failed to fetch issues';
            setError(message);
            console.error('Error fetching issues:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIssues();
    }, [JSON.stringify(filters)]);

    const refetch = (): void => { fetchIssues(); };

    return { issues, loading, error, refetch };
};

export const useOrganizations = (filters: Record<string, unknown> = {}): UseOrganizationsReturn => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrganizations = async (): Promise<void> => {
            try {
                setLoading(true);
                const { organizationsAPI } = await import('../services/api');
                const response = await organizationsAPI.getAll(filters);
                setOrganizations(response.data.data);
                setError(null);
            } catch (err: unknown) {
                const message = err instanceof Error
                    ? (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? err.message
                    : 'Failed to fetch organizations';
                setError(message);
                console.error('Error fetching organizations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrganizations();
    }, [JSON.stringify(filters)]);

    return { organizations, loading, error };
};