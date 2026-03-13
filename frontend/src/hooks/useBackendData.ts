import { useState, useEffect, useRef, useCallback } from 'react';
import { markersAPI, issuesAPI, organizationsAPI, adminAPI } from '../services/api';
import { Issue, Organization, User } from '../../types';

/**
 * useIssues — OPTIMIZED
 * 
 * Initial load: /api/markers/issues (~80KB gzipped vs 798KB)
 *   Returns: id, lat, lng, title, category, severity, status, votes, organizationId, createdAt
 *   Missing: description, comments, author — fetched on demand
 * 
 * regionCode — when set, only issues from that region are loaded.
 *   Changing regionCode clears the cache and re-fetches.
 */
export const useIssues = (regionCode?: number | null) => {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Cache full issue details to avoid re-fetching
    const detailCache = useRef<Map<string, Issue>>(new Map());

    useEffect(() => {
        let isMounted = true;

        const fetchMarkers = async () => {
            try {
                if (!isMounted) return;
                setLoading(true);
                // Clear detail cache whenever the region filter changes
                detailCache.current.clear();

                const params: Record<string, any> = {};
                if (regionCode != null) params.regionCode = regionCode;

                const response = await markersAPI.getIssues(params);
                if (isMounted) {
                    const data = response.data.data.map((d: any) => ({
                        ...d,
                        comments: [],
                        description: '',
                        _isMarker: true
                    }));
                    setIssues(data);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted && err.name !== 'AbortError') {
                    setError(err.response?.data?.message || 'Failed to fetch issues');
                    console.error('Error fetching issue markers:', err);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchMarkers();
        return () => { isMounted = false; };
    }, [regionCode]);

    const fetchDetail = useCallback(async (id: string): Promise<Issue | null> => {
        if (detailCache.current.has(id)) {
            return detailCache.current.get(id)!;
        }

        try {
            const response = await issuesAPI.getOne(id);
            const full = response.data.data;
            detailCache.current.set(id, full);

            setIssues(prev => prev.map(i =>
                i.id === id ? { ...i, ...full, _isMarker: false } : i
            ));

            return full;
        } catch (err) {
            console.error('Error fetching issue detail:', err);
            return null;
        }
    }, []);

    const addIssue = async (issueData: Record<string, any>) => {
        try {
            const response = await issuesAPI.create(issueData);
            const newIssue = response.data.data;
            setIssues(prev => [{ ...newIssue, _isMarker: false }, ...prev]);
            return { success: true, issue: newIssue };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const updateIssueStatus = async (id: string, status: string) => {
        try {
            await issuesAPI.update(id, { status });
            setIssues(prev => prev.map(i => i.id === id ? { ...i, status: status as any } : i));
            detailCache.current.delete(id);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const deleteIssue = async (id: string) => {
        try {
            await issuesAPI.delete(id);
            setIssues(prev => prev.filter(i => i.id !== id));
            detailCache.current.delete(id);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const upvoteIssue = async (id: string) => {
        try {
            const response = await issuesAPI.vote(id);
            const votes = response.data.data?.votes ?? response.data.votes;
            setIssues(prev => prev.map(i => i.id === id ? { ...i, votes } : i));
            detailCache.current.delete(id);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const addComment = async (id: string, text: string) => {
        try {
            const response = await issuesAPI.addComment(id, { text });
            const newComment = response.data.data;
            setIssues(prev => prev.map(i =>
                i.id === id
                    ? { ...i, comments: [newComment, ...(i.comments || [])] }
                    : i
            ));
            detailCache.current.delete(id);
            return { success: true, comment: newComment };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message };
        }
    };

    const refetch = async () => {
        try {
            setLoading(true);
            detailCache.current.clear();
            const params: Record<string, any> = {};
            if (regionCode != null) params.regionCode = regionCode;
            const response = await markersAPI.getIssues(params);
            setIssues(response.data.data.map((d: any) => ({
                ...d, comments: [], description: '', _isMarker: true
            })));
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch issues');
        } finally {
            setLoading(false);
        }
    };

    return {
        issues,
        loading,
        error,
        refetch,
        fetchDetail,
        addIssue,
        updateIssueStatus,
        deleteIssue,
        upvoteIssue,
        addComment
    };
};

/**
 * useOrganizations — OPTIMIZED
 * 
 * Initial load: /api/markers/organizations (~60KB gzipped vs 3,922KB)
 *   Returns: id, lat, lng, name, type
 *   Missing: address, region, budget, year, sector — fetched on demand
 * 
 * regionCode — when set, only orgs from that region are loaded.
 *   Changing regionCode clears the cache and re-fetches.
 */
export const useOrganizations = (regionCode?: number | null) => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const detailCache = useRef<Map<string, Organization>>(new Map());

    useEffect(() => {
        let isMounted = true;

        const fetchMarkers = async () => {
            try {
                setLoading(true);
                // Clear detail cache whenever the region filter changes
                detailCache.current.clear();

                const params: Record<string, any> = {};
                if (regionCode != null) params.regionCode = regionCode;

                const response = await markersAPI.getOrganizations(params);
                if (isMounted) {
                    setOrganizations(response.data.data);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.response?.data?.message || 'Failed to fetch organizations');
                    console.error('Error fetching org markers:', err);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchMarkers();
        return () => { isMounted = false; };
    }, [regionCode]);

    const fetchDetail = useCallback(async (id: string): Promise<Organization | null> => {
        if (detailCache.current.has(id)) {
            return detailCache.current.get(id)!;
        }

        try {
            const response = await organizationsAPI.getOne(id);
            const full = response.data.data;
            detailCache.current.set(id, full);

            setOrganizations(prev => prev.map(o =>
                o.id === id ? { ...full } : o
            ));

            return full;
        } catch (err) {
            console.error('Error fetching org detail:', err);
            return null;
        }
    }, []);

    const refetch = async () => {
        try {
            setLoading(true);
            detailCache.current.clear();
            const params: Record<string, any> = {};
            if (regionCode != null) params.regionCode = regionCode;
            const response = await markersAPI.getOrganizations(params);
            setOrganizations(response.data.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch organizations');
        } finally {
            setLoading(false);
        }
    };

    return {
        organizations,
        loading,
        error,
        refetch,
        fetchDetail
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
                if (isMounted) setLoading(false);
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

    return { users, loading, error, toggleBlockUser };
};