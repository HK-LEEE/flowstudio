import React, { useState } from 'react';
import { 
  Button, 
  Space, 
  Input, 
  Modal, 
  message, 
  Dropdown, 
  Typography,
  Switch,
  Select,
  Form
} from 'antd';
import {
  SaveOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  TagOutlined,
  BranchesOutlined,
  CopyOutlined,
  DeleteOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { useReactFlow } from '@xyflow/react';
import { apiService } from '@/services/api';
import { ValidationResult } from '@/utils/flowValidator';

const { Text } = Typography;

interface FlowToolbarProps {
  currentFlowId: string | null;
  currentFlowName: string;
  onFlowChange: (flowId: string, flowName: string) => void;
  onNewFlow: () => void;
  validationResult?: ValidationResult | null;
  onShowExecution?: () => void;
  onTestFlow?: () => void;
}

const FlowToolbar: React.FC<FlowToolbarProps> = ({
  currentFlowId,
  currentFlowName,
  onFlowChange,
  onNewFlow,
  validationResult,
  onShowExecution,
  onTestFlow,
}) => {
  const [isNewFlowModalVisible, setIsNewFlowModalVisible] = useState(false);
  const [isLoadFlowModalVisible, setIsLoadFlowModalVisible] = useState(false);
  const [isPublishModalVisible, setIsPublishModalVisible] = useState(false);
  const [isVersionModalVisible, setIsVersionModalVisible] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDescription, setNewFlowDescription] = useState('');
  const [availableFlows, setAvailableFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishSettings, setPublishSettings] = useState({
    isPublic: false,
    tags: '',
    releaseNotes: '',
  });
  const [versionInfo, setVersionInfo] = useState({
    currentVersion: '1.0.0',
    newVersion: '',
    versionType: 'patch',
    changelog: '',
  });

  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  const handleSaveFlow = async () => {
    if (!currentFlowId) {
      message.warning('Please create or select a flow first');
      return;
    }

    try {
      setLoading(true);
      const nodes = getNodes();
      const edges = getEdges();

      const flowData = {
        nodes,
        edges,
        viewport: { x: 0, y: 0, zoom: 1 }, // Could get from useViewport hook
      };

      const response = await apiService.saveFlow(currentFlowId, flowData);

      if (response.success) {
        message.success('Flow saved successfully');
      } else {
        message.error(`Failed to save flow: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error saving flow:', error);
      message.error('Error saving flow');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewFlow = async () => {
    if (!newFlowName.trim()) {
      message.warning('Please enter a flow name');
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.createFlow({
        name: newFlowName.trim(),
        description: newFlowDescription.trim() || null,
      });

      if (response.success) {
        const newFlow = response.data;
        onFlowChange(newFlow.id, newFlow.name);
        setIsNewFlowModalVisible(false);
        setNewFlowName('');
        setNewFlowDescription('');
        // Clear canvas
        setNodes([]);
        setEdges([]);
        message.success('New flow created successfully');
      } else {
        message.error(`Failed to create flow: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error creating flow:', error);
      message.error('Error creating flow');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFlows = async () => {
    try {
      setLoading(true);
      const response = await apiService.getFlows();

      if (response.success) {
        setAvailableFlows(response.data || []);
        setIsLoadFlowModalVisible(true);
      } else {
        message.error(`Failed to load flows: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error loading flows:', error);
      message.error('Error loading flows');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFlow = async (flowId: string, flowName: string) => {
    try {
      setLoading(true);
      const response = await apiService.getFlow(flowId);

      if (response.success) {
        const flowData = response.data;
        
        if (flowData.flow_data && flowData.flow_data.nodes) {
          setNodes(flowData.flow_data.nodes || []);
          setEdges(flowData.flow_data.edges || []);
        }

        onFlowChange(flowId, flowName);
        setIsLoadFlowModalVisible(false);
        message.success(`Flow "${flowName}" loaded successfully`);
      } else {
        message.error(`Failed to load flow: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error loading flow:', error);
      message.error('Error loading flow');
    } finally {
      setLoading(false);
    }
  };

  const handleRunFlow = () => {
    if (!currentFlowId) {
      message.warning('Please create or select a flow first');
      return;
    }

    if (validationResult && validationResult.errors.length > 0) {
      message.error(`Cannot run flow: ${validationResult.errors.length} error(s) found`);
      return;
    }

    // Open execution panel
    if (onShowExecution) {
      onShowExecution();
    }
  };

  const handlePublishFlow = async () => {
    try {
      setLoading(true);
      const nodes = getNodes();
      const edges = getEdges();

      const publishData = {
        flowId: currentFlowId,
        isPublic: publishSettings.isPublic,
        tags: publishSettings.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        releaseNotes: publishSettings.releaseNotes,
        flowData: { nodes, edges },
      };

      const response = await apiService.publishFlow(publishData);

      if (response.success) {
        message.success('Flow published successfully');
        setIsPublishModalVisible(false);
        setPublishSettings({ isPublic: false, tags: '', releaseNotes: '' });
      } else {
        message.error(`Failed to publish flow: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error publishing flow:', error);
      message.error('Error publishing flow');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    try {
      setLoading(true);
      const nodes = getNodes();
      const edges = getEdges();

      const versionData = {
        flowId: currentFlowId,
        versionType: versionInfo.versionType,
        newVersion: versionInfo.newVersion || generateNextVersion(versionInfo.currentVersion, versionInfo.versionType),
        changelog: versionInfo.changelog,
        flowData: { nodes, edges },
      };

      const response = await apiService.createFlowVersion(versionData);

      if (response.success) {
        message.success(`Version ${versionData.newVersion} created successfully`);
        setIsVersionModalVisible(false);
        setVersionInfo({
          currentVersion: versionData.newVersion,
          newVersion: '',
          versionType: 'patch',
          changelog: '',
        });
      } else {
        message.error(`Failed to create version: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error creating version:', error);
      message.error('Error creating version');
    } finally {
      setLoading(false);
    }
  };

  const generateNextVersion = (currentVersion: string, versionType: string): string => {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    switch (versionType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  };

  const handleDuplicateFlow = async () => {
    if (!currentFlowId) {
      message.warning('Please select a flow first');
      return;
    }

    try {
      setLoading(true);
      const nodes = getNodes();
      const edges = getEdges();

      const response = await apiService.duplicateFlow({
        originalFlowId: currentFlowId,
        name: `${currentFlowName} (Copy)`,
        flowData: { nodes, edges },
      });

      if (response.success) {
        message.success('Flow duplicated successfully');
      } else {
        message.error(`Failed to duplicate flow: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error duplicating flow:', error);
      message.error('Error duplicating flow');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFlow = async () => {
    if (!currentFlowId) {
      message.warning('Please select a flow first');
      return;
    }

    Modal.confirm({
      title: 'Delete Flow',
      content: `Are you sure you want to delete "${currentFlowName}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setLoading(true);
          const response = await apiService.deleteFlow(currentFlowId);

          if (response.success) {
            message.success('Flow deleted successfully');
            onNewFlow(); // Clear canvas and reset state
          } else {
            message.error(`Failed to delete flow: ${response.error}`);
          }
        } catch (error: any) {
          console.error('Error deleting flow:', error);
          message.error('Error deleting flow');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleTestFlow = () => {
    const nodes = getNodes();
    const chatInputNodes = nodes.filter(node => 
      node.data?.template?.component_type === 'chat_input'
    );

    if (chatInputNodes.length === 0) {
      message.warning('This flow does not contain any Chat Input nodes. Add a Chat Input node to enable testing.');
      return;
    }

    if (validationResult && validationResult.errors.length > 0) {
      message.error(`Cannot test flow: ${validationResult.errors.length} error(s) found`);
      return;
    }

    message.success('Opening Chat Test interface...');
    
    // Call the test flow handler
    if (onTestFlow) {
      onTestFlow();
    }
  };

  const moreMenuItems = [
    {
      key: 'export',
      label: 'Export Flow',
      icon: <DownloadOutlined />,
      onClick: () => console.log('Export flow'),
    },
    {
      key: 'import',
      label: 'Import Flow',
      icon: <UploadOutlined />,
      onClick: () => console.log('Import flow'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'duplicate',
      label: 'Duplicate Flow',
      icon: <CopyOutlined />,
      onClick: handleDuplicateFlow,
    },
    {
      key: 'delete',
      label: 'Delete Flow',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleDeleteFlow,
    },
  ];

  return (
    <>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e8e8e8',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsNewFlowModalVisible(true)}
          >
            New Flow
          </Button>
          
          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleLoadFlows}
            loading={loading}
          >
            Load Flow
          </Button>
          
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveFlow}
            disabled={!currentFlowId}
            loading={loading}
          >
            Save
          </Button>

          <Button
            icon={<CloudUploadOutlined />}
            onClick={() => setIsPublishModalVisible(true)}
            disabled={!currentFlowId}
            type="default"
            style={{ color: '#1890ff', borderColor: '#1890ff' }}
          >
            Publish
          </Button>

          <Button
            icon={<TagOutlined />}
            onClick={() => setIsVersionModalVisible(true)}
            disabled={!currentFlowId}
          >
            Version
          </Button>
        </Space>

        <div style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text strong style={{ fontSize: '16px', marginRight: '8px' }}>
            {currentFlowName || 'Untitled Flow'}
          </Text>
          
          {/* Validation Status */}
          {validationResult && (
            <Space>
              {validationResult.errors.length > 0 && (
                <CloseCircleOutlined 
                  style={{ color: '#ff4d4f', fontSize: '16px' }} 
                  title={`${validationResult.errors.length} error(s)`}
                />
              )}
              {validationResult.warnings.length > 0 && (
                <ExclamationCircleOutlined 
                  style={{ color: '#faad14', fontSize: '16px' }} 
                  title={`${validationResult.warnings.length} warning(s)`}
                />
              )}
              {validationResult.isValid && validationResult.warnings.length === 0 && (
                <CheckCircleOutlined 
                  style={{ color: '#52c41a', fontSize: '16px' }} 
                  title="Flow is valid"
                />
              )}
            </Space>
          )}
        </div>

        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRunFlow}
            disabled={!currentFlowId || (validationResult && validationResult.errors.length > 0)}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Run Flow
          </Button>

          <Button
            type="primary"
            icon={<BugOutlined />}
            onClick={handleTestFlow}
            disabled={!currentFlowId || (validationResult && validationResult.errors.length > 0)}
            style={{ background: '#1890ff', borderColor: '#1890ff' }}
          >
            Test Flow
          </Button>

          <Dropdown
            menu={{
              items: moreMenuItems,
              onClick: ({ key }) => {
                const item = moreMenuItems.find(item => item.key === key);
                if (item && 'onClick' in item && item.onClick) {
                  item.onClick();
                }
              },
            }}
            trigger={['click']}
          >
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      </div>

      {/* New Flow Modal */}
      <Modal
        title="Create New Flow"
        open={isNewFlowModalVisible}
        onOk={handleCreateNewFlow}
        onCancel={() => {
          setIsNewFlowModalVisible(false);
          setNewFlowName('');
          setNewFlowDescription('');
        }}
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text>Flow Name *</Text>
            <Input
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder="Enter flow name"
              maxLength={100}
            />
          </div>
          
          <div>
            <Text>Description</Text>
            <Input.TextArea
              value={newFlowDescription}
              onChange={(e) => setNewFlowDescription(e.target.value)}
              placeholder="Enter flow description (optional)"
              rows={3}
              maxLength={500}
            />
          </div>
        </Space>
      </Modal>

      {/* Load Flow Modal */}
      <Modal
        title="Load Flow"
        open={isLoadFlowModalVisible}
        onCancel={() => setIsLoadFlowModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {availableFlows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Text type="secondary">No flows found</Text>
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {availableFlows.map((flow) => (
                <div
                  key={flow.id}
                  style={{
                    padding: '12px',
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleLoadFlow(flow.id, flow.name)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1890ff';
                    e.currentTarget.style.backgroundColor = '#f6ffed';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e8e8e8';
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <div style={{ marginBottom: '4px' }}>
                    <Text strong>{flow.name}</Text>
                    {flow.is_public && (
                      <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                        Public
                      </Text>
                    )}
                  </div>
                  {flow.description && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {flow.description}
                    </Text>
                  )}
                  <div style={{ marginTop: '4px' }}>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      Version: {flow.version} • Updated: {new Date(flow.updated_at).toLocaleDateString()}
                    </Text>
                  </div>
                </div>
              ))}
            </Space>
          )}
        </div>
      </Modal>

      {/* Publish Flow Modal */}
      <Modal
        title="Publish Flow"
        open={isPublishModalVisible}
        onOk={handlePublishFlow}
        onCancel={() => {
          setIsPublishModalVisible(false);
          setPublishSettings({ isPublic: false, tags: '', releaseNotes: '' });
        }}
        confirmLoading={loading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Space align="center">
              <Switch
                checked={publishSettings.isPublic}
                onChange={(checked) => 
                  setPublishSettings(prev => ({ ...prev, isPublic: checked }))
                }
              />
              <Text>Make this flow public</Text>
            </Space>
            <div style={{ marginTop: '8px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Public flows can be discovered and used by other users
              </Text>
            </div>
          </div>

          <div>
            <Text>Tags (separated by commas)</Text>
            <Input
              value={publishSettings.tags}
              onChange={(e) => 
                setPublishSettings(prev => ({ ...prev, tags: e.target.value }))
              }
              placeholder="e.g., automation, data-processing, ai"
              maxLength={200}
            />
          </div>

          <div>
            <Text>Release Notes</Text>
            <Input.TextArea
              value={publishSettings.releaseNotes}
              onChange={(e) => 
                setPublishSettings(prev => ({ ...prev, releaseNotes: e.target.value }))
              }
              placeholder="Describe what's new in this release..."
              rows={4}
              maxLength={1000}
            />
          </div>
        </Space>
      </Modal>

      {/* Version Management Modal */}
      <Modal
        title="Create New Version"
        open={isVersionModalVisible}
        onOk={handleCreateVersion}
        onCancel={() => {
          setIsVersionModalVisible(false);
          setVersionInfo({
            currentVersion: versionInfo.currentVersion,
            newVersion: '',
            versionType: 'patch',
            changelog: '',
          });
        }}
        confirmLoading={loading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text>Current Version: <Text strong>{versionInfo.currentVersion}</Text></Text>
          </div>

          <div>
            <Text>Version Type</Text>
            <Select
              value={versionInfo.versionType}
              onChange={(value) => 
                setVersionInfo(prev => ({ ...prev, versionType: value }))
              }
              style={{ width: '100%' }}
            >
              <Select.Option value="patch">
                Patch ({generateNextVersion(versionInfo.currentVersion, 'patch')}) - Bug fixes
              </Select.Option>
              <Select.Option value="minor">
                Minor ({generateNextVersion(versionInfo.currentVersion, 'minor')}) - New features
              </Select.Option>
              <Select.Option value="major">
                Major ({generateNextVersion(versionInfo.currentVersion, 'major')}) - Breaking changes
              </Select.Option>
            </Select>
          </div>

          <div>
            <Text>Custom Version (optional)</Text>
            <Input
              value={versionInfo.newVersion}
              onChange={(e) => 
                setVersionInfo(prev => ({ ...prev, newVersion: e.target.value }))
              }
              placeholder={`Leave empty to use ${generateNextVersion(versionInfo.currentVersion, versionInfo.versionType)}`}
            />
          </div>

          <div>
            <Text>Changelog *</Text>
            <Input.TextArea
              value={versionInfo.changelog}
              onChange={(e) => 
                setVersionInfo(prev => ({ ...prev, changelog: e.target.value }))
              }
              placeholder="Describe the changes in this version..."
              rows={4}
              maxLength={1000}
            />
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default FlowToolbar;