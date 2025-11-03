import React, { useState } from 'react';
import api from '../lib/api';
import { Form, Input, Button, Typography, Select } from 'antd';
import { useToast } from '../components/Toast.jsx';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = { name: values.name, email: values.email, password: values.password, role: values.role || 'sales' };
      await api.post('/auth/register', payload);
      toast.success({ title: 'Registration successful', message: 'You can now sign in.' });
      window.location.href = '/login';
    } catch (err) {
      const msg = err?.response?.data?.message || 'Registration failed';
      toast.error({ title: 'Registration failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white shadow p-6 rounded">
        <Typography.Title level={3} className="!mb-4">Create account</Typography.Title>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ role: 'sales' }}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Please enter your name' }]}
          >
            <Input placeholder="Your name" autoFocus />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Enter a valid email' }]}
          >
            <Input placeholder="you@example.com" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please enter a password' }, { min: 6, message: 'Minimum 6 characters' }]}
            hasFeedback
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>

          <Form.Item label="Role" name="role" rules={[{ required: true, message: 'Please select a role' }]}>
            <Select
              options={[
                { label: 'Sales', value: 'sales' },
                { label: 'Manager', value: 'manager' },
                { label: 'Admin', value: 'admin' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Confirm Password"
            name="confirm"
            dependencies={["password"]}
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
          <div className="text-sm text-gray-600 mt-3 text-center">
            Already have an account? <a className="text-blue-600 hover:underline" href="/login">Sign in</a>
          </div>
        </Form>
      </div>
    </div>
  );
}
