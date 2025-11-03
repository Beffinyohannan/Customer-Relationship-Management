import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../lib/api';
import { List, Badge, Button, Divider } from 'antd';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/notifications');
      setItems(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to mark as read');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);

  const markAllRead = useCallback(async () => {
    const unread = items.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      await Promise.allSettled(unread.map(n => api.post(`/notifications/${n._id}/read`))); 
      setItems(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to mark all as read');
    }
  }, [items]);

  function splitGroups(list) {
    const now = new Date();
    const today = [];
    const yesterday = [];
    const earlier = [];
    for (const n of list) {
      const d = new Date(n.createdAt);
      const diffDays = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
      if (diffDays === 0) today.push(n);
      else if (diffDays === 1) yesterday.push(n);
      else earlier.push(n);
    }
    return { today, yesterday, earlier };
  }

  const groups = useMemo(() => splitGroups(items), [items]);

  return (
    <div className="bg-white p-4 rounded border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Notifications</h2>
          <Badge count={unreadCount} overflowCount={99} />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={load}>Refresh</Button>
          <Button disabled={unreadCount === 0} onClick={markAllRead}>Mark all read</Button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading...</div>}
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      {!loading && items.length === 0 && (
        <div className="text-sm text-gray-600">No notifications</div>
      )}

      {groups.today.length > 0 && (
        <>
          <Divider orientation="left">Today</Divider>
          <List
            dataSource={groups.today}
            renderItem={(n) => (
              <List.Item actions={[!n.read ? <Button size="small" onClick={() => markRead(n._id)}>Mark read</Button> : null]}>
                <List.Item.Meta
                  title={<>
                    <span className="font-medium">{n.title || 'Notification'}</span>
                    {!n.read && <span className="ml-2 inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">new</span>}
                  </>}
                  description={
                    <>
                      <div className="text-sm text-gray-700">{n.body}</div>
                      <div className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}

      {groups.yesterday.length > 0 && (
        <>
          <Divider orientation="left">Yesterday</Divider>
          <List
            dataSource={groups.yesterday}
            renderItem={(n) => (
              <List.Item actions={[!n.read ? <Button size="small" onClick={() => markRead(n._id)}>Mark read</Button> : null]}>
                <List.Item.Meta
                  title={<span className="font-medium">{n.title || 'Notification'}</span>}
                  description={
                    <>
                      <div className="text-sm text-gray-700">{n.body}</div>
                      <div className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}

      {groups.earlier.length > 0 && (
        <>
          <Divider orientation="left">Earlier</Divider>
          <List
            dataSource={groups.earlier}
            renderItem={(n) => (
              <List.Item actions={[!n.read ? <Button size="small" onClick={() => markRead(n._id)}>Mark read</Button> : null]}>
                <List.Item.Meta
                  title={<span className="font-medium">{n.title || 'Notification'}</span>}
                  description={
                    <>
                      <div className="text-sm text-gray-700">{n.body}</div>
                      <div className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </div>
  );
}
