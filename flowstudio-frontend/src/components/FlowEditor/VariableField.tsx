import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input, Select, Tag, Tooltip, Space, Typography, Alert } from 'antd';
import { FieldStringOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

interface VariableFieldProps {
  value?: string;
  onChange: (value: string) => void;
  availableVariables: string[];
  realInputData?: Record<string, any>;
  placeholder?: string;
  isTextArea?: boolean;
  disabled?: boolean;
}

const VariableField: React.FC<VariableFieldProps> = ({
  value = '',
  onChange,
  availableVariables,
  realInputData = {},
  placeholder,
  isTextArea = false,
  disabled = false
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const inputRef = useRef<any>(null);

  // Extract variables from current text
  const extractVariables = (text: string): string[] => {
    if (typeof text !== 'string' || !text) return [];
    const matches = text.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  };

  // Analyze variables in current value
  const analyzeVariables = useCallback(() => {
    const variables = extractVariables(value);
    const mappedVariables = variables.filter(v => availableVariables.includes(v));
    const unmappedVariables = variables.filter(v => !availableVariables.includes(v));
    const hasRealData = variables.some(v => realInputData[v] !== undefined);
    
    return {
      variables,
      mappedVariables,
      unmappedVariables,
      hasRealData
    };
  }, [value, availableVariables, realInputData]);

  const { variables, mappedVariables, unmappedVariables, hasRealData } = analyzeVariables();

  // Handle input change and detect variable typing
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // Check if user is typing a variable
    if (inputRef.current) {
      const cursorPos = inputRef.current.input?.selectionStart || 0;
      const textBeforeCursor = newValue.substring(0, cursorPos);
      const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
      const lastCloseBrace = textBeforeCursor.lastIndexOf('}');
      
      if (lastOpenBrace > lastCloseBrace && lastOpenBrace !== -1) {
        const currentWord = textBeforeCursor.substring(lastOpenBrace + 1);
        setCurrentWord(currentWord);
        setShowSuggestions(true);
        setCursorPosition(cursorPos);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    const input = inputRef.current?.input || inputRef.current?.resizableTextArea?.textArea;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const textBeforeCursor = value.substring(0, start);
    const textAfterCursor = value.substring(end);
    
    // Find the start of current variable typing (after '{')
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
    const insertStart = lastOpenBrace !== -1 ? lastOpenBrace + 1 : start;
    
    const newValue = value.substring(0, insertStart) + variable + '}' + textAfterCursor;
    onChange(newValue);
    setShowSuggestions(false);
    
    // Focus back to input
    setTimeout(() => {
      input.focus();
      const newCursorPos = insertStart + variable.length + 1;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Quick insert variable (for clicking on suggestion chips)
  const quickInsertVariable = (variable: string) => {
    const newValue = value + `{${variable}}`;
    onChange(newValue);
    
    // Focus back to input
    setTimeout(() => {
      const input = inputRef.current?.input || inputRef.current?.resizableTextArea?.textArea;
      if (input) {
        input.focus();
        input.setSelectionRange(newValue.length, newValue.length);
      }
    }, 0);
  };

  // Filter suggestions based on current typing
  const filteredSuggestions = availableVariables.filter(variable =>
    variable.toLowerCase().includes(currentWord.toLowerCase())
  );

  // Render preview of current value with variable substitution
  const renderPreview = () => {
    if (!value || variables.length === 0) return null;
    
    let previewText = value;
    variables.forEach(variable => {
      const realValue = realInputData[variable];
      const displayValue = realValue !== undefined ? 
        (typeof realValue === 'object' ? JSON.stringify(realValue) : String(realValue)) :
        `[${variable}]`;
      
      previewText = previewText.replace(
        new RegExp(`\\{${variable}\\}`, 'g'),
        displayValue
      );
    });

    return (
      <div style={{ 
        marginTop: '8px',
        padding: '8px',
        backgroundColor: '#f8fafc',
        borderRadius: '4px',
        border: '1px solid #e2e8f0'
      }}>
        <Text style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
          Preview:
        </Text>
        <div style={{ 
          marginTop: '4px',
          fontSize: '12px',
          fontFamily: 'Monaco, monospace',
          color: '#374151',
          whiteSpace: 'pre-wrap'
        }}>
          {previewText}
        </div>
      </div>
    );
  };

  const InputComponent = isTextArea ? TextArea : Input;
  const inputProps = {
    ref: inputRef,
    value,
    onChange: (e: any) => handleInputChange(e.target.value),
    placeholder,
    disabled,
    ...(isTextArea ? { rows: 4, autoSize: { minRows: 2, maxRows: 8 } } : {}),
    style: { fontFamily: isTextArea ? 'Monaco, monospace' : undefined }
  };

  return (
    <div style={{ position: 'relative' }}>
      <InputComponent {...inputProps} />
      
      {/* Variable Status Indicators */}
      {variables.length > 0 && (
        <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {variables.map(variable => {
            const isMapped = availableVariables.includes(variable);
            const hasData = realInputData[variable] !== undefined;
            
            return (
              <Tooltip 
                key={variable}
                title={
                  isMapped 
                    ? hasData 
                      ? `Variable mapped with real data: ${realInputData[variable]}`
                      : 'Variable mapped but no real data available yet'
                    : 'Variable not mapped - add to manual variables or connect a node'
                }
              >
                <Tag 
                  size="small"
                  color={isMapped ? (hasData ? 'green' : 'blue') : 'orange'}
                  style={{ fontSize: '10px' }}
                >
                  {variable}
                  {isMapped && hasData && <CheckCircleOutlined style={{ marginLeft: '2px' }} />}
                  {!isMapped && <ExclamationCircleOutlined style={{ marginLeft: '2px' }} />}
                </Tag>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Variable Analysis Alert */}
      {unmappedVariables.length > 0 && (
        <Alert
          message={`Unmapped variables: ${unmappedVariables.join(', ')}`}
          description="These variables won't be replaced during execution"
          type="warning"
          size="small"
          showIcon
          style={{ marginTop: '8px' }}
        />
      )}

      {/* Available Variables Chips */}
      {availableVariables.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <Text style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
            Available variables (click to insert):
          </Text>
          <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {availableVariables.map(variable => (
              <Tag
                key={variable}
                style={{ 
                  fontSize: '10px', 
                  cursor: 'pointer',
                  borderStyle: 'dashed'
                }}
                onClick={() => quickInsertVariable(variable)}
              >
                {variable}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Auto-complete Suggestions */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          marginTop: '4px',
          backgroundColor: 'white',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #f0f0f0' }}>
            <FieldStringOutlined style={{ marginRight: '4px' }} />
            Variable suggestions:
          </div>
          {filteredSuggestions.map(variable => (
            <div
              key={variable}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'background-color 0.2s'
              }}
              onClick={() => insertVariable(variable)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Space>
                <Text>{variable}</Text>
                {realInputData[variable] !== undefined && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    = {String(realInputData[variable]).substring(0, 20)}
                    {String(realInputData[variable]).length > 20 ? '...' : ''}
                  </Text>
                )}
              </Space>
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {renderPreview()}
    </div>
  );
};

export default VariableField;