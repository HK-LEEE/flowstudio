import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Space,
  Progress,
  Button,
  List,
  Tag,
  Collapse,
  Alert,
  Spin,
  Empty,
  Divider,
  Timeline,
  Modal,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import { webSocketService, ExecutionUpdate, connectWebSocket } from '@/services/websocket';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface ExecutionPanelProps {
  currentFlowId: string | null;
  onClose: () => void;
}

interface ExecutionStatus {
  execution_id: string;
  flow_id: string;
  status: string;
  progress: number;
  total_components: number;
  completed_components: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  final_output?: Record<string, any>;
}

interface ComponentExecution {
  component_id: string;
  component_type: string;
  status: string;
  execution_order: number;
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
  error_message?: string;
  output_data?: Record<string, any>;
}

interface ExecutionLog {
  id: string;
  level: string;
  message: string;
  timestamp: string;
  component_execution_id?: string;
  details?: Record<string, any>;
}

const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  currentFlowId,
  onClose,
}) => {
  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [components, setComponents] = useState<ComponentExecution[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket connection and cleanup
  useEffect(() => {
    let unsubscribeConnection: (() => void) | null = null;

    const initWebSocket = async () => {
      try {
        await connectWebSocket();
        
        // Subscribe to connection status
        unsubscribeConnection = webSocketService.onConnectionChange((connected) => {
          setWsConnected(connected);
        });
        
        setWsConnected(webSocketService.isConnected());
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
      }
    };

    initWebSocket();

    return () => {
      if (unsubscribeConnection) {
        unsubscribeConnection();
      }
    };
  }, []);

  // Subscribe to execution updates when execution starts
  useEffect(() => {
    let unsubscribeExecution: (() => void) | null = null;

    if (execution?.execution_id && wsConnected) {
      unsubscribeExecution = webSocketService.subscribeToExecution(
        execution.execution_id,
        handleExecutionUpdate
      );
    }

    return () => {
      if (unsubscribeExecution) {
        unsubscribeExecution();
      }
    };
  }, [execution?.execution_id, wsConnected]);

  const handleExecutionUpdate = useCallback((update: ExecutionUpdate) => {
    console.log('Received execution update:', update);

    switch (update.update_type) {
      case 'status':
        setExecution(prev => prev ? {
          ...prev,
          status: update.data.status,
          progress: update.data.progress
        } : null);
        
        // Stop polling when execution completes
        if (update.data.status === 'completed' || update.data.status === 'failed') {
          setPolling(false);
        }
        break;

      case 'component':
        setComponents(prev => 
          prev.map(comp => 
            comp.component_id === update.data.component_id
              ? { ...comp, status: update.data.status }
              : comp
          )
        );
        break;

      case 'log':
        const newLog: ExecutionLog = {
          id: `ws-${Date.now()}`,
          level: update.data.level,
          message: update.data.message,
          timestamp: update.timestamp,
          component_execution_id: update.data.component_id
        };
        setLogs(prev => [newLog, ...prev]);
        break;

      case 'error':
        setExecution(prev => prev ? {
          ...prev,
          status: 'failed',
          error_message: update.data.error_message
        } : null);
        break;

      case 'result':
        setResults(update.data.results);
        break;
    }
  }, []);

  const startExecution = async () => {
    if (!currentFlowId) return;

    try {
      setLoading(true);
      setLogs([]); // Clear previous logs
      setResults(null); // Clear previous results

      const response = await apiService.getAxiosInstance().post(`/flows/${currentFlowId}/execute`, {
        flow_id: currentFlowId,
        execution_config: {}
      });

      if (response.data) {
        const executionId = response.data.execution_id;
        
        // Set initial execution state
        setExecution({
          execution_id: executionId,
          flow_id: currentFlowId,
          status: response.data.status,
          progress: response.data.progress,
          total_components: 0,
          completed_components: 0
        });

        // Get initial component data (for the timeline)
        try {
          const componentsResponse = await apiService.getAxiosInstance().get(`/executions/${executionId}/components`);
          if (componentsResponse.data) {
            setComponents(componentsResponse.data);
          }
        } catch (error) {
          console.warn('Failed to get initial component data:', error);
        }

        // If WebSocket is not connected, fall back to polling
        if (!wsConnected) {
          console.warn('WebSocket not connected, falling back to polling');
          await pollExecutionStatus(executionId);
          setPolling(true);
        }
      }
    } catch (error: any) {
      console.error('Failed to start execution:', error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const pollExecutionStatus = useCallback(async (executionId: string) => {
    try {
      // Get execution status
      const statusResponse = await apiService.getAxiosInstance().get(`/executions/${executionId}/status`);
      if (statusResponse.data) {
        setExecution(statusResponse.data);

        // Get component executions
        const componentsResponse = await apiService.getAxiosInstance().get(`/executions/${executionId}/components`);
        if (componentsResponse.data) {
          setComponents(componentsResponse.data);
        }

        // Get logs
        const logsResponse = await apiService.getAxiosInstance().get(`/executions/${executionId}/logs?limit=50`);
        if (logsResponse.data) {
          setLogs(logsResponse.data);
        }

        // If execution is still running, continue polling
        if (statusResponse.data.status === 'running' || statusResponse.data.status === 'pending') {
          setTimeout(() => pollExecutionStatus(executionId), 2000);
        } else {
          setPolling(false);
          
          // If completed successfully, get results
          if (statusResponse.data.status === 'completed') {
            try {
              const resultsResponse = await apiService.getAxiosInstance().get(`/executions/${executionId}/results`);
              if (resultsResponse.data) {
                setResults(resultsResponse.data);
              }
            } catch (e) {
              console.warn('Failed to get execution results:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to poll execution status:', error);
      setPolling(false);
    }
  }, []);

  const cancelExecution = async () => {
    if (!execution) return;

    try {
      await apiService.getAxiosInstance().delete(`/executions/${execution.execution_id}`);
      setPolling(false);
    } catch (error) {
      console.error('Failed to cancel execution:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'running': return 'blue';
      case 'failed': return 'red';
      case 'cancelled': return 'orange';
      case 'pending': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'running': return <Spin size="small" />;
      case 'failed': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'cancelled': return <CloseOutlined style={{ color: '#faad14' }} />;
      case 'pending': return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
      default: return <InfoCircleOutlined />;
    }
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'Not started';
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const showResultsModal = () => {
    setShowResults(true);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa'
      }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space align="center">
            <PlayCircleOutlined style={{ color: '#1890ff' }} />
            <Title level={5} style={{ margin: 0 }}>
              Flow Execution
            </Title>
            {/* WebSocket status indicator */}
            <div 
              style={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                backgroundColor: wsConnected ? '#52c41a' : '#ff4d4f',
                marginLeft: 8
              }}
              title={wsConnected ? 'Real-time updates connected' : 'Real-time updates disconnected'}
            />
          </Space>
          <Button type="text" size="small" onClick={onClose}>
            ×
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {!execution ? (
          // No execution state
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Empty 
              description="No active execution"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
            <Button 
              type="primary" 
              icon={<PlayCircleOutlined />}
              onClick={startExecution}
              loading={loading}
              disabled={!currentFlowId}
              style={{ marginTop: '16px' }}
            >
              Start Execution
            </Button>
          </div>
        ) : (
          // Execution active
          <Space direction="vertical" style={{ width: '100%' }}>
            {/* Execution Status */}
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space align="center">
                    {getStatusIcon(execution.status)}
                    <Text strong>Status: </Text>
                    <Tag color={getStatusColor(execution.status)}>
                      {execution.status.toUpperCase()}
                    </Tag>
                  </Space>
                  
                  {(execution.status === 'running' || execution.status === 'pending') && (
                    <Button 
                      size="small" 
                      danger
                      onClick={cancelExecution}
                      icon={<CloseOutlined />}
                    >
                      Cancel
                    </Button>
                  )}
                </Space>

                <Progress 
                  percent={execution.progress} 
                  status={execution.status === 'failed' ? 'exception' : undefined}
                  format={() => `${execution.completed_components}/${execution.total_components}`}
                />

                <Space split={<Divider type="vertical" />}>
                  <Text type="secondary">
                    Duration: {formatDuration(execution.started_at, execution.completed_at)}
                  </Text>
                  <Text type="secondary">
                    Components: {execution.completed_components}/{execution.total_components}
                  </Text>
                </Space>

                {execution.error_message && (
                  <Alert
                    message="Execution Error"
                    description={execution.error_message}
                    type="error"
                    showIcon
                  />
                )}

                {execution.status === 'completed' && results && (
                  <Space>
                    <Button 
                      type="primary" 
                      icon={<DownloadOutlined />}
                      onClick={showResultsModal}
                    >
                      View Results
                    </Button>
                  </Space>
                )}
              </Space>
            </Card>

            {/* Components Progress */}
            <Collapse defaultActiveKey={['components']}>
              <Panel header={`Component Progress (${components.length})`} key="components">
                <Timeline mode="left">
                  {components.map((component) => (
                    <Timeline.Item
                      key={component.component_id}
                      dot={getStatusIcon(component.status)}
                      color={getStatusColor(component.status)}
                    >
                      <div>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <Space align="center">
                            <Text strong>{component.component_type}</Text>
                            <Tag size="small">{component.status}</Tag>
                            {component.execution_time_ms && (
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                {component.execution_time_ms}ms
                              </Text>
                            )}
                          </Space>
                          
                          {component.error_message && (
                            <Text type="danger" style={{ fontSize: '12px' }}>
                              Error: {component.error_message}
                            </Text>
                          )}
                        </Space>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Panel>

              {/* Execution Logs */}
              <Panel header={`Execution Logs (${logs.length})`} key="logs">
                <List
                  size="small"
                  dataSource={logs}
                  renderItem={(log) => (
                    <List.Item>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                          <Tag 
                            color={
                              log.level === 'error' ? 'red' : 
                              log.level === 'warning' ? 'orange' : 
                              'blue'
                            }
                          >
                            {log.level.toUpperCase()}
                          </Tag>
                          <Text style={{ fontSize: '12px' }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </Text>
                        </Space>
                        <Text>{log.message}</Text>
                      </Space>
                    </List.Item>
                  )}
                  style={{ maxHeight: '300px', overflow: 'auto' }}
                />
              </Panel>
            </Collapse>
          </Space>
        )}
      </div>

      {/* Results Modal */}
      <Modal
        title="Execution Results"
        open={showResults}
        onCancel={() => setShowResults(false)}
        footer={[
          <Button key="close" onClick={() => setShowResults(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '16px', 
          borderRadius: '6px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {results ? JSON.stringify(results, null, 2) : 'No results available'}
        </pre>
      </Modal>
    </div>
  );
};

export default ExecutionPanel;