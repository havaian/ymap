// frontend/src/hooks/useBackendData.ts

import { useState, useEffect, useRef, useCallback } from "react";
import { markersAPI, issuesAPI, objectsAPI, adminAPI } from "../services/api";
import { Issue, FacilityObject, User } from "../../types";

// ── useIssues ─────────────────────────────────────────────────────────────────
// Initial load: /api/markers/issues — only map fields
// Full details fetched on demand when a user opens an issue panel

export const useIssues = (regionCode?: number | null) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailCache = useRef<Map<string, Issue>>(new Map());

  useEffect(() => {
    let isMounted = true;

    const fetchMarkers = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        detailCache.current.clear();

        const params: Record<string, any> = {};
        if (regionCode != null) params.regionCode = regionCode;

        const response = await markersAPI.getIssues(params);
        if (isMounted) {
          setIssues(
            response.data.data.map((d: any) => ({
              ...d,
              comments: [],
              description: "",
              _isMarker: true,
            }))
          );
          setError(null);
        }
      } catch (err: any) {
        if (isMounted)
          setError(err.response?.data?.message || "Failed to fetch issues");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMarkers();
    return () => {
      isMounted = false;
    };
  }, [regionCode]);

  const fetchDetail = useCallback(async (id: string): Promise<Issue | null> => {
    if (detailCache.current.has(id)) return detailCache.current.get(id)!;
    try {
      const response = await issuesAPI.getOne(id);
      const full = response.data.data;
      detailCache.current.set(id, full);
      setIssues((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...full, _isMarker: false } : i))
      );
      return full;
    } catch (err) {
      console.error("Error fetching issue detail:", err);
      return null;
    }
  }, []);

  const addIssue = async (issueData: Record<string, any>) => {
    try {
      const response = await issuesAPI.create(issueData);
      const newIssue = response.data.data;
      setIssues((prev) => [{ ...newIssue, _isMarker: false }, ...prev]);
      return { success: true, issue: newIssue };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message };
    }
  };

  const updateIssueStatus = async (id: string, status: string) => {
    try {
      await issuesAPI.update(id, { status });
      setIssues((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: status as any } : i))
      );
      detailCache.current.delete(id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message };
    }
  };

  const deleteIssue = async (id: string) => {
    try {
      await issuesAPI.delete(id);
      setIssues((prev) => prev.filter((i) => i.id !== id));
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
      setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, votes } : i)));
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
      setIssues((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, comments: [newComment, ...(i.comments || [])] }
            : i
        )
      );
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
      setIssues(
        response.data.data.map((d: any) => ({
          ...d,
          comments: [],
          description: "",
          _isMarker: true,
        }))
      );
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch issues");
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
    addComment,
  };
};

// ── useObjects ────────────────────────────────────────────────────────────────
// Initial load: /api/markers/objects — only map fields (id, lat, lng, name, objectType, sourceApi)
// Full details fetched on demand.

export const useObjects = (regionCode?: number | null) => {
  const [objects, setObjects] = useState<FacilityObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailCache = useRef<Map<string, FacilityObject>>(new Map());

  useEffect(() => {
    let isMounted = true;

    const fetchMarkers = async () => {
      try {
        setLoading(true);
        detailCache.current.clear();

        const params: Record<string, any> = {};
        if (regionCode != null) params.regionCode = regionCode;

        const response = await markersAPI.getObjects(params);
        if (isMounted) {
          setObjects(response.data.data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted)
          setError(err.response?.data?.message || "Failed to fetch objects");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMarkers();
    return () => {
      isMounted = false;
    };
  }, [regionCode]);

  const fetchDetail = useCallback(
    async (id: string): Promise<FacilityObject | null> => {
      if (detailCache.current.has(id)) return detailCache.current.get(id)!;
      try {
        const response = await objectsAPI.getOne(id);
        const full = response.data.data;
        detailCache.current.set(id, full);
        setObjects((prev) => prev.map((o) => (o.id === id ? { ...full } : o)));
        return full;
      } catch (err) {
        console.error("Error fetching object detail:", err);
        return null;
      }
    },
    []
  );

  const refetch = async () => {
    try {
      setLoading(true);
      detailCache.current.clear();
      const params: Record<string, any> = {};
      if (regionCode != null) params.regionCode = regionCode;
      const response = await markersAPI.getObjects(params);
      setObjects(response.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch objects");
    } finally {
      setLoading(false);
    }
  };

  return { objects, loading, error, refetch, fetchDetail };
};

// ── useUsers ──────────────────────────────────────────────────────────────────

export const useUsers = (enabled = false) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await adminAPI.getUsers();
        if (isMounted) {
          setUsers(response.data.data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted)
          setError(err.response?.data?.message || "Failed to fetch users");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleBlockUser = async (userId: string, currentBlocked: boolean) => {
    try {
      await adminAPI.blockUser(userId, !currentBlocked);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, blocked: !currentBlocked } : u
        )
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message };
    }
  };

  return { users, loading, error, toggleBlockUser };
};
