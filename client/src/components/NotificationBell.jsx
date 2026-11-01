import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Sparkles,
  X
} from 'lucide-react';

export default function NotificationBell({ setActiveRoute }) {
  const { user, accessToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const fetchNotifications = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/v1/notifications?limit=25', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('[NotificationBell] Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [accessToken]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('[NotificationBell] Mark read error:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('[NotificationBell] Mark all read error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setUnreadCount(data.data.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('[NotificationBell] Delete error:', err);
    }
  };

  const clearRead = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/notifications', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.filter(n => !n.is_read));
      }
    } catch (err) {
      console.error('[NotificationBell] Clear read error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.link_url && setActiveRoute) {
      setIsOpen(false);
      const route = notification.link_url.replace(/^\//, '').split('/')[0];
      if (route === 'creator') setActiveRoute('creator-dashboard');
      else if (route === 'student') setActiveRoute('learner-dashboard');
      else if (route === 'super-admin') setActiveRoute('admin-dashboard');
      else if (route === 'insights') setActiveRoute('teacher-insights');
      else setActiveRoute(route);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'SUCCESS':
        return <CheckCircle2 size={16} className="text-[#10B981] shrink-0" />;
      case 'WARNING':
        return <AlertCircle size={16} className="text-[#F43F5E] shrink-0" />;
      case 'ACTION_REQUIRED':
        return <Sparkles size={16} className="text-[#F59E0B] shrink-0" />;
      default:
        return <Info size={16} className="text-[#38BDF8] shrink-0" />;
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch (e) {
      return '';
    }
  };

  if (!user) return null;

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        className="relative p-2 rounded-xl bg-[#132238] hover:bg-[#1E2E48] border border-[#243754] text-[#CBD5E1] hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#34D399]"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#EF4444] rounded-full shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu / Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-[#0E1726] border border-[#1E2E48] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-3.5 border-b border-[#1E2E48] flex items-center justify-between bg-[#131F33]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Notifications</span>
              {unreadCount > 0 ? (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30">
                  {unreadCount} new
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30">
                  All caught up
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loading}
                  title="Mark all as read"
                  className="p-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-[#34D399] hover:bg-[#1B2B45] transition-colors"
                >
                  <CheckCheck size={15} />
                </button>
              )}
              {notifications.some(n => n.is_read) && (
                <button
                  onClick={clearRead}
                  disabled={loading}
                  title="Clear read notifications"
                  className="p-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-[#F43F5E] hover:bg-[#1B2B45] transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-white hover:bg-[#1B2B45] transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[#1A2840]">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#132238] flex items-center justify-center text-[#64748B] mb-2">
                  <Bell size={20} />
                </div>
                <p className="text-sm font-semibold text-[#CBD5E1]">No notifications yet</p>
                <p className="text-xs text-[#64748B] mt-1">Updates on assessments, requests, and enrollments will appear here.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 group ${
                    notif.is_read ? 'bg-[#0E1726] hover:bg-[#142036]' : 'bg-[#121E36] hover:bg-[#172744]'
                  }`}
                >
                  {/* Status Indicator / Icon */}
                  <div className="mt-0.5">
                    {getIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs font-bold truncate ${notif.is_read ? 'text-[#CBD5E1]' : 'text-white'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-[#64748B] shrink-0 font-medium">
                        {formatTime(notif.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    {notif.link_url && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#38BDF8] mt-1.5 hover:underline">
                        View details <ExternalLink size={10} />
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notif.is_read && (
                      <button
                        onClick={(e) => markAsRead(notif.id, e)}
                        title="Mark as read"
                        className="p-1 rounded text-[#94A3B8] hover:text-[#34D399] hover:bg-[#1E2E48]"
                      >
                        <Check size={13} />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteNotification(notif.id, e)}
                      title="Delete notification"
                      className="p-1 rounded text-[#94A3B8] hover:text-[#F43F5E] hover:bg-[#1E2E48]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-[#0A101D] border-t border-[#1E2E48] text-center">
              <span className="text-[11px] text-[#64748B]">
                Synced with institutional activity
              </span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
