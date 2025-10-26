import { Snackbar, Alert } from '@mui/material';
import { createContext, useCallback, useContext, useState } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationContextProps {
  notify: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextProps>({ notify: () => {} });

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('info');

  const notify = useCallback((msg: string, notifType: NotificationType = 'info') => {
    setMessage(msg);
    setType(notifType);
    setOpen(true);
  }, []);

  const handleClose = (_: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <Snackbar open={open} autoHideDuration={4000} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleClose} severity={type} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}
