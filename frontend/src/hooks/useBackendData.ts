import { useState, useEffect, useRef, useCallback } from 'react';
import { markersAPI, issuesAPI, organizationsAPI, adminAPI } from '../services/api';
import { Issue, Organization, User } from '../../types';

/**
 * useIssues — OPTIMIZED
 * 
 * Initial load: /api/markers/issues (~80KB gzipped vs 798KB)
 *   Returns: id, lat, lng, title, category, severity, status, votes, organizationId, createdAt
 *   Missing: description, comments, author, photos — fetched on demand
 * 
 * Detail fetch: /api/issues/:id (single issue with comments)
 *   Called when user clicks an issue or navigates to /map/issues/:id
 */
export const useIssues = () => {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Cache full issue details to avoid re-fetching
    const detailCache = useRef<Map<string, Issue>>(new Map());

    useEffect(() => {
        const abortController = new AbortController();
        let isMounted = true;

        const fetchMarkers = async () => {
            try {
                if (!isMounted) return;
                setLoading(true);
                const response = await markersAPI.getIssues();
                if (isMounted) {
                    // Markers come with minimal fields — add empty comments array
                    // so existing code doesn't crash on issue.comments
                    const data = response.data.data.map((d: any) => ({
                        ...d,
                        comments: [],
                        description: '',
                        _isMarker: true // flag: detail not yet loaded
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
        return () => { isMounted = false; abortController.abort(); };
    }, []);

    /**
     * Fetch full issue detail (with comments) on demand.
     * Returns the full issue object, also updates it in the issues array.
     */
    const fetchDetail = useCallback(async (id: string): Promise<Issue | null> => {
        // Return cached if available
        if (detailCache.current.has(id)) {
            return detailCache.current.get(id)!;
        }

        try {
            const response = await issuesAPI.getOne(id);
            const full = response.data.data;
            detailCache.current.set(id, full);

            // Merge full data into the markers array
            setIssues(prev => prev.map(i =>
                i.id === id ? { ...full, _isMarker: false } : i
            ));

            return full;
        } catch (err) {
            console.error('Error fetching issue detail:', err);
            return null;
        }
    }, []);

    const addIssue = async (data: any) => {
        try {
            const response = await issuesAPI.create(data);
            const newIssue = response.data.data;
            setIssues(prev => [newIssue, ...prev]);
            detailCache.current.set(newIssue.id, newIssue);
            return { success: true, issue: newIssue };
        } catch (err: any) {
            return { success: false, error: err.response?.data?.message || 'Failed to create issue' };
        }
    };

    const updateIssueStatus = async (id: string, status: 'Open' | 'In Progress' | 'Resolved') => {
        try {
            await issuesAPI.update(id, { status });
            setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
            // Invalidate cache
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
            const { votes } = response.data.data;
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
            const response = await markersAPI.getIssues();
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
 */
export const useOrganizations = () => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasFetchedRef = useRef(false);
    const detailCache = useRef<Map<string, Organization>>(new Map());

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        const fetchMarkers = async () => {
            try {
                setLoading(true);
                const response = await markersAPI.getOrganizations();
                setOrganizations(response.data.data);
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.message || 'Failed to fetch organizations');
                console.error('Error fetching org markers:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMarkers();
    }, []);

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
            const response = await markersAPI.getOrganizations();
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

    const refetch = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getUsers();
            setUsers(response.data.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    return {
        users,
        loading,
        error,
        refetch,
        toggleBlockUser
    };
};