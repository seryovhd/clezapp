import React, { useContext, useEffect } from 'react';
import { toast } from 'react-toastify';
import { SocketContext } from '../../context/Socket/SocketContext';

const NotificationHandler = () => {
  const socketManager = useContext(SocketContext);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const companyId = userData?.companyId || localStorage.getItem('companyId');

    if (!companyId) return;

    const socket = socketManager.getSocket(companyId);

    if (socket) {
      // En components/NotificationHandler.js
      const handleNotification = (data) => {
        console.log("🔔 NOTIFICACIÓN RECIBIDA:", data); // Agrega este log

        const { type, title, message } = data;

        switch (type) {
          case 'error':
            toast.error(`${title}: ${message}`, {
              position: "top-right",
              autoClose: 10000,
            });
            break;
          case 'warning':
            toast.warning(`${title}: ${message}`, {
              position: "top-right",
              autoClose: 8000,
            });
            break;
          default:
            toast.info(message, {
              position: "top-right",
              autoClose: 5000,
            });
        }
      };

      socket.on(`company-${companyId}-notification`, handleNotification);

      return () => {
        socket.off(`company-${companyId}-notification`, handleNotification);
      };
    }
  }, [socketManager]);

  return null;
};

export default NotificationHandler;