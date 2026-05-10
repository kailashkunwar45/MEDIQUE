import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';
import { io } from 'socket.io-client';

export function useUnreadCount(accessToken?: string) {
  const [totalUnread, setTotalUnread] = useState(0);

  const loadUnreadCount = async () => {
    if (!accessToken) return;
    try {
      // conversations endpoint returns unread counts per conversation
      const data = await authFetch("/api/chat/conversations");
      if (Array.isArray(data)) {
        const total = data.reduce((acc: number, conv: any) => acc + (conv.unreadCount || 0), 0);
        setTotalUnread(total);
      }
    } catch (e) {
      console.error("Failed to load unread count", e);
    }
  };

  useEffect(() => {
    if (!accessToken) return;

    // Initial load
    loadUnreadCount();

    // Listen for real-time updates
    const socket = io();
    socket.emit("registerUser", { token: accessToken });

    const handleNotification = () => {
      loadUnreadCount();
    };

    socket.on("messageNotification", handleNotification);
    socket.on("message", handleNotification);

    return () => {
      socket.off("messageNotification", handleNotification);
      socket.off("message", handleNotification);
      socket.disconnect();
    };
  }, [accessToken]);

  return { totalUnread, refresh: loadUnreadCount };
}
