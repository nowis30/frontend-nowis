import { useEffect, useState } from 'react';
import { Chip, Tooltip, type ChipProps } from '@mui/material';
import { apiClient } from '../api/client';

export function BackendStatus() {
  const [status, setStatus] = useState<'ok' | 'down' | 'loading'>('loading');
  const [detail, setDetail] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiClient.get('/health', { timeout: 5000 });
        if (!mounted) return;
        setStatus(res.data?.status === 'ok' ? 'ok' : 'down');
        setDetail(JSON.stringify(res.data));
      } catch (err: unknown) {
        if (!mounted) return;
        setStatus('down');
        const message = err instanceof Error ? err.message : 'Request failed';
        setDetail(message);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const color: ChipProps['color'] = status === 'ok' ? 'success' : status === 'down' ? 'error' : 'default';
  const label = status === 'ok' ? 'Backend: OK' : status === 'down' ? 'Backend: DOWN' : 'Backend: ...';

  return (
    <Tooltip title={detail || ''}>
      <Chip size="small" color={color} label={label} variant={status === 'ok' ? 'filled' : 'outlined'} />
    </Tooltip>
  );
}

export default BackendStatus;
