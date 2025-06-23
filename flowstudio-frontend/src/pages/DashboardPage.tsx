import React from 'react';
import { Layout, Card, Typography, Button, Space, Avatar, Dropdown } from 'antd';
import { 
  LogoutOutlined, 
  UserOutlined, 
  PlusOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  EditOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth, useAuthenticatedUser } from '@/store/authStore';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  const { logout } = useAuth();
  const user = useAuthenticatedUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
  };

  const handleCreateNewFlow = () => {
    navigate('/flow-editor');
  };

  const handleOpenFlowEditor = () => {
    navigate('/flow-editor');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginRight: 12,
            }}
          >
            <NodeIndexOutlined style={{ fontSize: 20, color: 'white' }} />
          </div>
          <Title level={4} style={{ margin: 0, color: '#1a1a1a' }}>
            FlowStudio
          </Title>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Text type="secondary">Welcome back, {user.username}!</Text>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Avatar
              style={{ 
                backgroundColor: '#667eea',
                cursor: 'pointer',
              }}
              icon={<UserOutlined />}
            />
          </Dropdown>
        </div>
      </Header>

      <Content
        style={{
          padding: '24px',
          background: '#f5f5f5',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 32 }}>
            <Title level={2} style={{ marginBottom: 8 }}>
              Dashboard
            </Title>
            <Text type="secondary" style={{ fontSize: 16 }}>
              Design and manage your visual flows
            </Text>
          </div>

          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <Card
              title="Quick Actions"
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: '24px' } }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="large"
                  block
                  onClick={handleCreateNewFlow}
                  style={{
                    height: 48,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                  }}
                >
                  Create New Flow
                </Button>
                <Button
                  icon={<EditOutlined />}
                  size="large"
                  block
                  onClick={handleOpenFlowEditor}
                  style={{
                    height: 48,
                    borderRadius: 8,
                  }}
                >
                  Open Flow Editor
                </Button>
              </Space>
            </Card>

            <Card
              title="Recent Flows"
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <NodeIndexOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <Text type="secondary">No flows created yet</Text>
              </div>
            </Card>

            <Card
              title="Statistics"
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: '24px' } }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Total Flows</Text>
                  <Text strong style={{ fontSize: 18 }}>0</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Active Flows</Text>
                  <Text strong style={{ fontSize: 18 }}>0</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Last Activity</Text>
                  <Text type="secondary">Never</Text>
                </div>
              </Space>
            </Card>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default DashboardPage;