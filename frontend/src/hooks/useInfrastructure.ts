import { useState, useEffect } from 'react';
import { Infrastructure } from '../../types';
import { infrastructureAPI } from '../services/api';

export const useInfrastructure = () => {
  const [infrastructure, setInfrastructure] = useState<Infrastructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfrastructure = async (type?: string, region?: string) => {
    try {
      setLoading(true);
      const response = await infrastructureAPI.getAll({ type, region });
      if (response.success && response.data) {
        setInfrastructure(response.data);
      } else {
        setError(response.error || 'Failed to load infrastructure');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load infrastructure');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfrastructure();
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
    refreshInfrastructure: fetchInfrastructure,
    getInfrastructureById,
    getNearby
  };
};