import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Alert, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import type { LoginRequest } from '@/types/auth';

const { Title, Text } = Typography;

interface LocationState {
  redirect?: string;
}

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();

  const state = location.state as LocationState;
  const redirectPath = state?.redirect || '/dashboard';

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  useEffect(() => {
    // Clear errors on component unmount
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleSubmit = async (values: LoginRequest) => {
    const success = await login(values);
    
    if (success) {
      navigate(redirectPath, { replace: true });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        padding: '20px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          borderRadius: '16px',
          border: 'none',
        }}
        styles={{
          body: { padding: '40px' }
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginBottom: 16,
            }}
          >
            <NodeIndexOutlined style={{ fontSize: 32, color: 'white' }} />
          </div>
          <Title level={2} style={{ color: '#1a1a1a', marginBottom: 8, fontWeight: 600 }}>
            FlowStudio
          </Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Visual Flow Design Platform
          </Text>
        </div>

        {error && (
          <Alert
            message="Login Failed"
            description={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{ 
              marginBottom: 24,
              borderRadius: '8px',
            }}
          />
        )}

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          layout="vertical"
          requiredMark={false}
          size="large"
        >
          <Form.Item
            name="email"
            label={<span style={{ fontWeight: 500 }}>Email</span>}
            rules={[
              { required: true, message: 'Please enter your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
              placeholder="Enter your email"
              autoComplete="email"
              disabled={isLoading}
              style={{
                borderRadius: '8px',
                height: '48px',
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ fontWeight: 500 }}>Password</span>}
            rules={[
              { required: true, message: 'Please enter your password!' },
              { min: 6, message: 'Password must be at least 6 characters.' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
              onPressEnter={() => form.submit()}
              style={{
                borderRadius: '8px',
                height: '48px',
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 24, marginTop: 32 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              style={{ 
                height: 48,
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 500,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical" size="small">
            <Text type="secondary" style={{ fontSize: 14 }}>
              Don't have an account?
            </Text>
            <Button
              type="link"
              style={{ 
                padding: 0, 
                height: 'auto',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Contact administrator
            </Button>
          </Space>
        </div>

        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: '#f8f9fa',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Secure access to FlowStudio platform
            <br />
            Design and manage your visual flows with ease
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;