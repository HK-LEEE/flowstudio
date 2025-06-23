import React, { useState, useMemo, useRef } from 'react';
import { 
  Input, 
  Typography, 
  Empty,
  Badge
} from 'antd';
import { 
  SearchOutlined,
  MessageOutlined,
  FileTextOutlined,
  CloudOutlined,
  EditOutlined,
  BranchesOutlined,
  FormatPainterOutlined,
  ExperimentOutlined,
  ApiOutlined,
  FunctionOutlined,
  RobotOutlined,
  FieldStringOutlined,
  FileAddOutlined,
  FilePdfOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  SendOutlined,
  MailOutlined
} from '@ant-design/icons';
import './ModernWhiteLibrary.css';

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

interface LangflowStyleLibraryProps {
  templates: ComponentTemplate[];
  onTemplateSelect?: (template: ComponentTemplate) => void;
  onDragStart?: (event: React.DragEvent, template: ComponentTemplate) => void;
}

// Enhanced icon mapping with more visual variety
const getComponentIcon = (iconName: string, componentType: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'EditOutlined': <EditOutlined />,
    'FileTextOutlined': <FileTextOutlined />,
    'RobotOutlined': <RobotOutlined />,
    'FieldStringOutlined': <FieldStringOutlined />,
    'BranchesOutlined': <BranchesOutlined />,
    'FormatPainterOutlined': <FormatPainterOutlined />,
    'FileAddOutlined': <FileAddOutlined />,
    'FilePdfOutlined': <FilePdfOutlined />,
    'ApiOutlined': <ApiOutlined />,
    'FunctionOutlined': <FunctionOutlined />,
    'CodeOutlined': <CodeOutlined />,
    'ClockCircleOutlined': <ClockCircleOutlined />,
    'SendOutlined': <SendOutlined />,
    'MailOutlined': <MailOutlined />,
  };

  // Component-specific icons
  const componentIcons: Record<string, React.ReactNode> = {
    'text_input': <EditOutlined />,
    'text_output': <FileTextOutlined />,
    'openai_llm': <RobotOutlined />,
    'claude_llm': <RobotOutlined />,
    'prompt_template': <FieldStringOutlined />,
    'conditional': <BranchesOutlined />,
    'text_processor': <FormatPainterOutlined />,
    'file_input': <FileAddOutlined />,
    'file_output': <FilePdfOutlined />,
    'http_request': <ApiOutlined />,
    'data_transform': <FunctionOutlined />,
    'json_parser': <CodeOutlined />,
    'delay': <ClockCircleOutlined />,
    'webhook': <SendOutlined />,
    'email_sender': <MailOutlined />,
    'code_executor': <CodeOutlined />,
  };

  return componentIcons[componentType] || iconMap[iconName] || <ExperimentOutlined />;
};

// Category configuration with Langflow-style colors
const getCategoryConfig = (category: string) => {
  const categoryConfigs: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
    'Input/Output': { 
      color: '#1890ff', 
      bgColor: '#e6f7ff', 
      icon: <MessageOutlined /> 
    },
    'AI/LLM': { 
      color: '#722ed1', 
      bgColor: '#f9f0ff', 
      icon: <CloudOutlined /> 
    },
    'Text Processing': { 
      color: '#fa8c16', 
      bgColor: '#fff2e6', 
      icon: <FormatPainterOutlined /> 
    },
    'Logic': { 
      color: '#f5222d', 
      bgColor: '#fff1f0', 
      icon: <BranchesOutlined /> 
    },
    'Network': { 
      color: '#eb2f96', 
      bgColor: '#fff0f6', 
      icon: <ApiOutlined /> 
    },
    'Data Processing': { 
      color: '#059669', 
      bgColor: '#f0fdf4', 
      icon: <FunctionOutlined /> 
    },
    'Programming': { 
      color: '#7c3aed', 
      bgColor: '#f3f4f6', 
      icon: <CodeOutlined /> 
    },
  };

  return categoryConfigs[category] || { 
    color: '#52c41a', 
    bgColor: '#f6ffed', 
    icon: <ExperimentOutlined /> 
  };
};

const LangflowStyleLibrary: React.FC<LangflowStyleLibraryProps> = ({ 
  templates, 
  onTemplateSelect,
  onDragStart 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);

  // Group and filter templates
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
    // Set drag data
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template));
    event.dataTransfer.effectAllowed = 'move';
    
    // Create custom drag image
    const dragElement = event.currentTarget as HTMLElement;
    const rect = dragElement.getBoundingClientRect();
    
    // Clone the element for drag preview
    const dragImage = dragElement.cloneNode(true) as HTMLElement;
    dragImage.style.transform = 'rotate(3deg)';
    dragImage.style.opacity = '0.8';
    dragImage.style.pointerEvents = 'none';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.zIndex = '1000';
    
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, rect.width / 2, rect.height / 2);
    
    // Clean up drag image after drag starts
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);

    setDraggedComponent(template.id);
    onDragStart?.(event, template);
  };

  const handleDragEnd = () => {
    setDraggedComponent(null);
  };

  const renderComponentCard = (template: ComponentTemplate) => {
    const categoryConfig = getCategoryConfig(template.category);
    const isDragging = draggedComponent === template.id;
    
    return (
      <div
        key={template.id}
        className={`langflow-component-card ${isDragging ? 'dragging' : ''}`}
        draggable
        onDragStart={(event) => handleDragStart(event, template)}
        onDragEnd={handleDragEnd}
        onClick={() => onTemplateSelect?.(template)}
        style={{
          '--component-color': template.color,
          '--category-bg': categoryConfig.bgColor,
        } as React.CSSProperties}
      >
        {/* Component Icon */}
        <div className="component-icon" style={{ color: template.color }}>
          {getComponentIcon(template.icon, template.component_type)}
        </div>

        {/* Component Content */}
        <div className="component-content">
          <div className="component-header">
            <Text className="component-name" strong>
              {template.display_name}
            </Text>
            {template.is_beta && (
              <Badge count="BETA" style={{ backgroundColor: '#faad14', fontSize: '10px' }} />
            )}
          </div>
          
          <Text className="component-description">
            {template.description}
          </Text>

          {/* Component Meta */}
          <div className="component-meta">
            <div className="component-handles">
              {Object.keys(template.input_schema?.properties || {}).length > 0 && (
                <span className="handle-count input">
                  {Object.keys(template.input_schema.properties).length} in
                </span>
              )}
              {Object.keys(template.output_schema?.properties || {}).length > 0 && (
                <span className="handle-count output">
                  {Object.keys(template.output_schema.properties).length} out
                </span>
              )}
            </div>
            <span className="component-version">v{template.version}</span>
          </div>
        </div>

        {/* Drag Indicator */}
        <div className="drag-indicator">
          <div className="drag-dots">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>

        {/* Hover Effect Overlay */}
        <div className="hover-overlay"></div>
      </div>
    );
  };

  const renderCategorySection = (category: string, templates: ComponentTemplate[]) => {
    const categoryConfig = getCategoryConfig(category);
    
    return (
      <div key={category} className="category-section">
        <div className="category-header">
          <div className="category-icon" style={{ color: categoryConfig.color }}>
            {categoryConfig.icon}
          </div>
          <Text strong className="category-title">{category}</Text>
          <Badge 
            count={templates.length} 
            style={{ 
              backgroundColor: categoryConfig.color,
              color: 'white'
            }}
          />
        </div>
        
        <div className="category-components">
          {templates.map(renderComponentCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="langflow-component-library">
      {/* Search Bar */}
      <div className="library-search">
        <Input
          placeholder="Search components..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          size="large"
        />
      </div>

      {/* Components */}
      <div className="library-content">
        {Object.keys(categorizedTemplates).length === 0 ? (
          <Empty 
            description="No components found"
            style={{ marginTop: 40 }}
          />
        ) : (
          <div className="categories-container">
            {Object.entries(categorizedTemplates).map(([category, categoryTemplates]) =>
              renderCategorySection(category, categoryTemplates)
            )}
          </div>
        )}
      </div>

      {/* Help Footer */}
      <div className="library-footer">
        <div className="help-text">
          <span className="drag-emoji">🎯</span>
          <Text type="secondary">
            Drag components to canvas to build your flow
          </Text>
        </div>
      </div>

      {/* Drag Preview */}
      <div ref={dragPreviewRef} className="drag-preview" />
    </div>
  );
};

export default LangflowStyleLibrary;