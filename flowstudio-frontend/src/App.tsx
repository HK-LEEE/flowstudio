import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import 'antd/dist/reset.css';

// Component imports
import PrivateRoute from '@/components/PrivateRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import FlowEditorPage from '@/pages/FlowEditorPage';

// Ant Design theme configuration
const theme = {
  token: {
    colorPrimary: '#667eea',
    borderRadius: 8,
    colorBgContainer: '#ffffff',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f5f5f5',
    },
    Card: {
      borderRadiusLG: 12,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 40,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 40,
    },
  },
};

// Create router with future flags enabled
const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/dashboard",
    element: (
      <PrivateRoute>
        <DashboardPage />
      </PrivateRoute>
    )
  },
  {
    path: "/flow-editor",
    element: (
      <PrivateRoute>
        <FlowEditorPage />
      </PrivateRoute>
    )
  },
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />
  }
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true
  }
});

const App: React.FC = () => {
  return (
    <ConfigProvider theme={theme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
};

export default App;