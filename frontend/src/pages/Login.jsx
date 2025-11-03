import React, { useState } from 'react';
import api from '../lib/api';
import { Form, Input, Button, Typography } from 'antd';
import { useToast } from '../components/Toast.jsx';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await api.post('/auth/login', values);
      window.location.href = '/';
    } catch (err) {
      const msg = err?.response?.data?.message || 'Login failed';
      toast.error({ title: 'Login failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white shadow p-6 rounded">
        <Typography.Title level={3} className="!mb-4">Sign in</Typography.Title>
        <Form
          layout="vertical"
          initialValues={{ email: 'admin@example.com', password: 'admin123' }}
          onFinish={onFinish}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input placeholder="you@example.com" autoFocus />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }, { min: 6, message: 'Minimum 6 characters' }]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </Form>

        <div className="text-sm text-gray-600 mt-3 text-center">
          Don't have an account? <a className="text-blue-600 hover:underline" href="/register">Register</a>
        </div>
      </div>
    </div>
  );
}
