import { useState, useEffect } from 'react';
import { issuesAPI, organizationsAPI, adminAPI } from '../services/api';
import { Issue, Organization, User } from '../../types';

export const useIssues = () => {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const abortController = new AbortController();
        let isMounted = true;

        const fetchIssues = async () => {
            try {
                if (!isMounted) return;
                setLoading(true);
                const response = await issuesAPI.getAll();
                if (isMounted) {
                    setIssues(response.data.data);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted && err.name !== 'AbortError') {
                    setError(err.response?.data?.message || 'Failed to fetch issues');
                    console.error('Error fetching issues:', err);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchIssues();

        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, []);

    const addIssue = async (data: any) => {
        try {
            const response = await issuesAPI.create(data);
            const newIssue = response.data.data;
            setIssues([newIssue, ...issues]);
            return { success: true, issue: newIssue };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message || 'Failed to create issue' };
        }
    };

    const updateIssueStatus = async (id: string, status: 'Open' | 'In Progress' | 'Resolved') => {
        try {
            await issuesAPI.update(id, { status });
            setIssues(issues.map(i => i.id === id ? { ...i, status } : i));
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const deleteIssue = async (id: string) => {
        try {
            await issuesAPI.delete(id);
            setIssues(issues.filter(i => i.id !== id));
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const upvoteIssue = async (id: string) => {
        try {
            const response = await issuesAPI.vote(id);
            const { votes } = response.data.data;
            setIssues(issues.map(i => i.id === id ? { ...i, votes } : i));
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const addComment = async (id: string, text: string) => {
        try {
            const response = await issuesAPI.addComment(id, { text });
            const newComment = response.data.data;
            setIssues(issues.map(i =>
                i.id === id
                    ? { ...i, comments: [newComment, ...i.comments] }
                    : i
            ));
            return { success: true, comment: newComment };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const refetchIssues = async () => {
        try {
            setLoading(true);
            const response = await issuesAPI.getAll();
            setIssues(response.data.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch issues');
            console.error('Error fetching issues:', err);
        } finally {
            setLoading(false);
        }
    };

    return {
        issues,
        loading,
        error,
        refetch: refetchIssues,
        addIssue,
        updateIssueStatus,
        deleteIssue,
        upvoteIssue,
        addComment
    };
};

export const useOrganizations = () => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const abortController = new AbortController();
        let isMounted = true;

        const fetchOrganizations = async () => {
            try {
                if (!isMounted) return;
                setLoading(true);
                const response = await organizationsAPI.getAll();
                if (isMounted) {
                    setOrganizations(response.data.data);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted && err.name !== 'AbortError') {
                    setError(err.response?.data?.message || 'Failed to fetch organizations');
                    console.error('Error fetching organizations:', err);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchOrganizations();

        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, []);

    const refetchOrganizations = async () => {
        try {
            setLoading(true);
            const response = await organizationsAPI.getAll();
            setOrganizations(response.data.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch organizations');
            console.error('Error fetching organizations:', err);
        } finally {
            setLoading(false);
        }
    };

    return {
        organizations,
        loading,
        error,
        refetch: refetchOrganizations
    };
};

export const useUsers = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const abortController = new AbortController();
        let isMounted = true;

        const fetchUsers = async () => {
            try {
                if (!isMounted) return;
                setLoading(true);
                const response = await adminAPI.getUsers();
                if (isMounted) {
                    setUsers(response.data.data);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted && err.name !== 'AbortError') {
                    setError(err.response?.data?.message || 'Failed to fetch users');
                    console.error('Error fetching users:', err);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchUsers();

        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, []);

    const toggleBlockUser = async (userId: string, currentBlocked: boolean) => {
        try {
            await adminAPI.blockUser(userId, !currentBlocked);
            setUsers(users.map(u =>
                u.id === userId ? { ...u, blocked: !currentBlocked } : u
            ));
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const refetchUsers = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getUsers();
            setUsers(response.data.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch users');
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    return {
        users,
        loading,
        error,
        refetch: refetchUsers,
        toggleBlockUser
    };
};