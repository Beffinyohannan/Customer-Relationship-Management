import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Leads from './Leads.jsx';
import Notifications from './Notifications.jsx';
import api from '../lib/api';
import { Avatar, Dropdown, Button, Modal } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useMe } from '../hooks/useMe';

export default function Dashboard() {
  const location = useLocation();
  const { data: me } = useMe({ retry: false });
  const user = me?.user;
  return (
    <div className="min-h-screen pt-14">
      <header className="fixed top-0 inset-x-0 z-40 bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="font-semibold">Micro CRM</div>
          <nav className="space-x-4 flex items-center">
            <Link
              to="/"
              className={`hover:underline ${location.pathname === '/' ? 'font-semibold text-blue-600 underline' : ''}`}
            >
              Leads
            </Link>
            <Link
              to="/notifications"
              className={`hover:underline ${location.pathname.startsWith('/notifications') ? 'font-semibold text-blue-600 underline' : ''}`}
            >
              Notifications
            </Link>
            {user ? (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    { key: 'profile', label: (
                      <div className="min-w-[180px]">
                        <div className="font-medium">{user.name || 'User'}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    ) },
                    { type: 'divider' },
                    { key: 'logout', label: 'Logout', onClick: () => {
                      Modal.confirm({
                        title: 'Logout',
                        content: 'Are you sure you want to logout?',
                        okText: 'Logout',
                        okButtonProps: { danger: true },
                        onOk: async () => { try { await api.post('/auth/logout'); } catch {}; window.location.href = '/login'; },
                      });
                    } },
                  ]
                }}
              >
                <button className="ml-4 inline-flex items-center gap-2">
                  <Avatar size={28} icon={<UserOutlined />}>
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </Avatar>
                  <span className="hidden sm:inline text-sm text-gray-700">{user.name || 'User'}</span>
                </button>
              </Dropdown>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route index element={<Leads />} />
          <Route path="notifications" element={<Notifications />} />
        </Routes>
      </main>
    </div>
  );
}
