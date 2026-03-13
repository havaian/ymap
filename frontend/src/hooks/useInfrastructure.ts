import { useState, useEffect, useRef, useCallback } from 'react';
import { Infrastructure } from '../../types';
import { markersAPI, infrastructureAPI } from '../services/api';

/**
 * useInfrastructure — OPTIMIZED
 * 
 * Initial load: /api/markers/infrastructure (~100KB gzipped vs 7,007KB)
 *   Returns: id, lat, lng, name, type
 *   Missing: address, region, budget, year, sector, objectType — fetched on demand
 * 
 * regionCode — when set, only infra from that region is loaded.
 *   Changing regionCode clears the cache and re-fetches.
 */
export const useInfrastructure = (regionCode?: number | null) => {
  const [infrastructure, setInfrastructure] = useState<Infrastructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailCache = useRef<Map<string, Infrastructure>>(new Map());

  const fetchMarkers = useCallback(async (type?: string) => {
    try {
      setLoading(true);
      detailCache.current.clear();

      const params: Record<string, any> = {};
      if (type) params.type = type;
      if (regionCode != null) params.regionCode = regionCode;

      const response = await markersAPI.getInfrastructure(params);
      if (response.data.success && response.data.data) {
        setInfrastructure(response.data.data);
        setError(null);
      } else {
        setError('Failed to load infrastructure');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load infrastructure');
    } finally {
      setLoading(false);
    }
  }, [regionCode]);

  useEffect(() => {
    fetchMarkers();
  }, [fetchMarkers]);

  const fetchDetail = useCallback(async (id: string): Promise<Infrastructure | null> => {
    if (detailCache.current.has(id)) {
      return detailCache.current.get(id)!;
    }

    try {
      const response = await infrastructureAPI.getById(id);
      if (response.success && response.data) {
        detailCache.current.set(id, response.data);
        setInfrastructure(prev => prev.map(i =>
          i.id === id ? { ...response.data } : i
        ));
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Error fetching infra detail:', err);
      return null;
    }
  }, []);

  const getInfrastructureById = async (id: string) => {
    try {
      const response = await infrastructureAPI.getById(id);
      if (response.success && response.data) {
        return { success: true, infrastructure: response.data };
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch infrastructure' };
    }
  };

  const getNearby = async (lat: number, lng: number, maxDistance?: number, type?: string) => {
    try {
      const response = await infrastructureAPI.getNearby(lat, lng, maxDistance, type);
      if (response.success && response.data) {
        return { success: true, infrastructure: response.data };
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch nearby infrastructure' };
    }
  };

  return {
    infrastructure,
    loading,
    error,
    refreshInfrastructure: fetchMarkers,
    fetchDetail,
    getInfrastructureById,
    getNearby
  };
};