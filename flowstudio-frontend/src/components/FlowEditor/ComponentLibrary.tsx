import React, { useState, useMemo } from 'react';
import { 
  Input, 
  Collapse, 
  Card, 
  Badge, 
  Typography, 
  Space,
  Tooltip,
  Empty
} from 'antd';
import { 
  SearchOutlined,
  MessageOutlined,
  FileTextOutlined,
  CloudOutlined,
  EditOutlined,
  BranchesOutlined,
  FormatPainterOutlined,
  ExperimentOutlined
} from '@ant-design/icons';

const { Panel } = Collapse;
const { Text } = Typography;

// Component template interface
interface ComponentTemplate {
  id: string;
  component_type: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  version: string;
  is_active: boolean;
  is_beta: boolean;
  sort_order: number;
  documentation: string | null;
  examples: Record<string, any> | null;
}

interface ComponentLibraryProps {
  templates: ComponentTemplate[];
  onTemplateSelect?: (template: ComponentTemplate) => void;
}

// Icon mapping for component categories and types
const getComponentIcon = (iconName: string, category: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'MessageOutlined': <MessageOutlined />,
    'FileTextOutlined': <FileTextOutlined />,
    'CloudOutlined': <CloudOutlined />,
    'EditOutlined': <EditOutlined />,
    'BranchesOutlined': <BranchesOutlined />,
    'FormatPainterOutlined': <FormatPainterOutlined />,
  };

  // Fallback icons by category
  const categoryIcons: Record<string, React.ReactNode> = {
    'Inputs': <MessageOutlined />,
    'Outputs': <MessageOutlined />,
    'LLMs': <CloudOutlined />,
    'Prompts': <EditOutlined />,
    'Logic': <BranchesOutlined />,
    'Utilities': <FormatPainterOutlined />,
  };

  return iconMap[iconName] || categoryIcons[category] || <ExperimentOutlined />;
};

const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ 
  templates, 
  onTemplateSelect 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>([]);

  // Group templates by category and filter by search term
  const categorizedTemplates = useMemo(() => {
    const filtered = templates.filter(template =>
      template.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped = filtered.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, ComponentTemplate[]>);

    // Sort templates within each category
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.display_name.localeCompare(b.display_name);
      });
    });

    return grouped;
  }, [templates, searchTerm]);

  const handleDragStart = (event: React.DragEvent, template: ComponentTemplate) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleTemplateClick = (template: ComponentTemplate) => {
    onTemplateSelect?.(template);
  };

  const renderComponentCard = (template: ComponentTemplate) => (
    <Card
      key={template.id}
      size="small"
      hoverable
      draggable
      onDragStart={(event) => handleDragStart(event, template)}
      onClick={() => handleTemplateClick(template)}
      style={{
        marginBottom: 8,
        borderLeft: `4px solid ${template.color}`,
        cursor: 'grab'
      }}
      styles={{ body: { padding: '12px' } }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space align="center">
            <span style={{ color: template.color, fontSize: '16px' }}>
              {getComponentIcon(template.icon, template.category)}
            </span>
            <Text strong style={{ fontSize: '14px' }}>
              {template.display_name}
            </Text>
          </Space>
          
          {template.is_beta && (
            <Badge count="BETA" style={{ backgroundColor: '#faad14' }} />
          )}
        </Space>
        
        {template.description && (
          <Text 
            type="secondary" 
            style={{ 
              fontSize: '12px', 
              lineHeight: '1.4',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {template.description}
          </Text>
        )}
        
        <Space size="small" wrap>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            v{template.version}
          </Text>
          
          {Object.keys(template.input_schema).length > 0 && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {Object.keys(template.input_schema).length} inputs
            </Text>
          )}
          
          {Object.keys(template.output_schema).length > 0 && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {Object.keys(template.output_schema).length} outputs
            </Text>
          )}
        </Space>
      </Space>
    </Card>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search Input */}
      <Input
        placeholder="Search components..."
        prefix={<SearchOutlined />}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />
      
      {/* Component Categories */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {Object.keys(categorizedTemplates).length === 0 ? (
          <Empty 
            description="No components found"
            style={{ marginTop: 40 }}
          />
        ) : (
          <Collapse
            defaultActiveKey={Object.keys(categorizedTemplates)}
            activeKey={activeCategories}
            onChange={(keys) => setActiveCategories(keys as string[])}
            ghost
            size="small"
          >
            {Object.entries(categorizedTemplates).map(([category, categoryTemplates]) => (
              <Panel
                key={category}
                header={
                  <Space align="center">
                    <Text strong>{category}</Text>
                    <Badge 
                      count={categoryTemplates.length} 
                      style={{ backgroundColor: '#f0f0f0', color: '#666' }}
                    />
                  </Space>
                }
              >
                <div style={{ paddingTop: 8 }}>
                  {categoryTemplates.map(renderComponentCard)}
                </div>
              </Panel>
            ))}
          </Collapse>
        )}
      </div>
      
      {/* Help Text */}
      <div style={{ 
        marginTop: 16, 
        padding: '12px', 
        background: '#f8f9fa', 
        borderRadius: '6px',
        border: '1px solid #e8e8e8'
      }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          💡 Drag components to the canvas to add them to your flow
        </Text>
      </div>
    </div>
  );
};

export default ComponentLibrary;