import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import 'antd/dist/reset.css';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import api from './lib/api';
import { useMe } from './hooks/useMe';
import { ToastProvider } from './components/Toast.jsx';
import { ConfigProvider, theme } from 'antd';

const qc = new QueryClient();

function PrivateRoute({ children }) {
  const { isLoading, isError } = useMe({ retry: false });
  if (isLoading) return null;
  return !isError ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/*" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
