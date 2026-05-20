/** Hook to fetch and manage framework update information. */
import { useEffect, useState } from 'react';
import { fetchUpdateInfo, type UpdateInfo } from './api';

export function useUpdateInfo() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUpdateInfoData() {
      try {
        const info = await fetchUpdateInfo();
        setUpdateInfo(info);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchUpdateInfoData();

    // Refresh every hour
    const interval = setInterval(fetchUpdateInfoData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { updateInfo, loading, error };
}
