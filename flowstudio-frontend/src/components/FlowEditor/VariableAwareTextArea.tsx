import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input, Tooltip, Tag, Space, Typography } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import './VariableAwareTextArea.css';

const { TextArea } = Input;
const { Text } = Typography;

interface VariableInfo {
  name: string;
  type: string;
  description?: string;
  sourceNode?: string;
  sourcePort?: string;
}

interface VariableSuggestion extends VariableInfo {
  insertText: string;
  cursorOffset: number;
}

interface VariableAwareTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  availableVariables: VariableInfo[];
  placeholder?: string;
  label?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  showVariableAnalysis?: boolean;
  showSuggestions?: boolean;
  highlightVariables?: boolean;
}

// Extract variables from text using {variable} pattern
const extractVariables = (text: string): string[] => {
  const matches = text.match(/\{([^}]+)\}/g);
  return matches ? matches.map(match => match.slice(1, -1)).filter(Boolean) : [];
};

// Get suggestions based on current cursor position and input
const getVariableSuggestions = (
  text: string,
  cursorPosition: number,
  availableVariables: VariableInfo[]
): VariableSuggestion[] => {
  // Find if cursor is inside a potential variable pattern
  const beforeCursor = text.substring(0, cursorPosition);
  const afterCursor = text.substring(cursorPosition);
  
  // Look for incomplete variable pattern like "{us" or "{user_"
  const incompleteMatch = beforeCursor.match(/\{([^}]*)$/);
  if (!incompleteMatch) return [];
  
  const partialVar = incompleteMatch[1].toLowerCase();
  const startPos = incompleteMatch.index! + 1; // Position after '{'
  
  // Filter variables that match the partial input
  const suggestions = availableVariables
    .filter(variable => 
      variable.name.toLowerCase().includes(partialVar) ||
      variable.name.toLowerCase().startsWith(partialVar)
    )
    .map(variable => ({
      ...variable,
      insertText: variable.name + '}',
      cursorOffset: variable.name.length + 1
    }))
    .slice(0, 5); // Limit to 5 suggestions
  
  return suggestions;
};

// Highlight variables in text
const highlightVariablesInText = (text: string, availableVariables: VariableInfo[]): string => {
  const variableNames = availableVariables.map(v => v.name);
  
  return text.replace(/\{([^}]+)\}/g, (match, varName) => {
    const isValid = variableNames.includes(varName);
    const className = isValid ? 'variable-valid' : 'variable-invalid';
    return `<span class="${className}" data-variable="${varName}">${match}</span>`;
  });
};

export const VariableAwareTextArea: React.FC<VariableAwareTextAreaProps> = ({
  value,
  onChange,
  availableVariables,
  placeholder = "Enter text here. Use {variable} for dynamic content.",
  label,
  rows = 4,
  disabled = false,
  className = '',
  showVariableAnalysis = true,
  showSuggestions = true,
  highlightVariables = true
}) => {
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestions, setSuggestions] = useState<VariableSuggestion[]>([]);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  
  // Extract variables used in the current text
  const usedVariables = useMemo(() => extractVariables(value), [value]);
  
  // Categorize variables as valid or invalid
  const variableStatus = useMemo(() => {
    const availableNames = availableVariables.map(v => v.name);
    return usedVariables.map(varName => ({
      name: varName,
      isValid: availableNames.includes(varName),
      info: availableVariables.find(v => v.name === varName)
    }));
  }, [usedVariables, availableVariables]);
  
  // Get highlighted text for overlay
  const highlightedText = useMemo(() => {
    if (!highlightVariables) return '';
    return highlightVariablesInText(value, availableVariables);
  }, [value, availableVariables, highlightVariables]);
  
  // Handle text change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    
    onChange(newValue);
    setCursorPosition(newCursorPos);
    
    // Update suggestions if enabled
    if (showSuggestions) {
      const newSuggestions = getVariableSuggestions(newValue, newCursorPos, availableVariables);
      setSuggestions(newSuggestions);
      setShowSuggestionBox(newSuggestions.length > 0);
    }
  }, [onChange, availableVariables, showSuggestions]);
  
  // Handle cursor position change
  const handleCursorChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCursorPos = e.target.selectionStart;
    setCursorPosition(newCursorPos);
    
    if (showSuggestions) {
      const newSuggestions = getVariableSuggestions(value, newCursorPos, availableVariables);
      setSuggestions(newSuggestions);
      setShowSuggestionBox(newSuggestions.length > 0);
    }
  }, [value, availableVariables, showSuggestions]);
  
  // Insert variable suggestion
  const insertSuggestion = useCallback((suggestion: VariableSuggestion) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);
    
    // Find the start of the incomplete variable
    const incompleteMatch = beforeCursor.match(/\{([^}]*)$/);
    if (!incompleteMatch) return;
    
    const startPos = incompleteMatch.index! + 1; // Position after '{'
    const newValue = 
      value.substring(0, startPos) + 
      suggestion.insertText + 
      afterCursor;
    
    onChange(newValue);
    
    // Set cursor position after the inserted variable
    const newCursorPos = startPos + suggestion.cursorOffset;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
    
    setShowSuggestionBox(false);
  }, [value, cursorPosition, onChange]);
  
  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestionBox && suggestions.length > 0) {
      if (e.key === 'Escape') {
        setShowSuggestionBox(false);
        e.preventDefault();
      } else if (e.key === 'Tab' && suggestions.length > 0) {
        insertSuggestion(suggestions[0]);
        e.preventDefault();
      }
    }
  }, [showSuggestionBox, suggestions, insertSuggestion]);
  
  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSuggestionBox(false);
    };
    
    if (showSuggestionBox) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSuggestionBox]);
  
  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);
  
  return (
    <div className={`variable-aware-textarea ${className}`}>
      {label && (
        <div className="textarea-label">
          <Text strong>{label}</Text>
          {availableVariables.length > 0 && (
            <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
              ({availableVariables.length} variables available)
            </Text>
          )}
        </div>
      )}
      
      {/* Main textarea container with overlay */}
      <div className="textarea-container" style={{ position: 'relative' }}>
        {/* Highlight overlay */}
        {highlightVariables && (
          <div
            ref={highlightRef}
            className="highlight-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.5715',
              padding: '4px 11px',
              border: '1px solid transparent',
              overflow: 'hidden',
              color: 'transparent',
              zIndex: 1
            }}
            dangerouslySetInnerHTML={{ __html: highlightedText }}
          />
        )}
        
        {/* Actual textarea */}
        <TextArea
          ref={textareaRef}
          value={value}
          onChange={handleTextChange}
          onSelect={handleCursorChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          style={{
            position: 'relative',
            zIndex: 2,
            background: highlightVariables ? 'transparent' : undefined,
            fontFamily: 'monospace'
          }}
        />
        
        {/* Variable suggestions dropdown */}
        {showSuggestions && showSuggestionBox && suggestions.length > 0 && (
          <div className="variable-suggestions" onClick={(e) => e.stopPropagation()}>
            <div className="suggestions-header">
              <Text strong>Available Variables</Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>Press Tab to insert</Text>
            </div>
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.name}-${index}`}
                className="suggestion-item"
                onClick={() => insertSuggestion(suggestion)}
              >
                <div className="suggestion-main">
                  <code className="suggestion-code">{`{${suggestion.name}}`}</code>
                  <span className="suggestion-type">{suggestion.type}</span>
                </div>
                {suggestion.description && (
                  <div className="suggestion-description">{suggestion.description}</div>
                )}
                {suggestion.sourceNode && (
                  <div className="suggestion-source">from {suggestion.sourceNode}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Variable analysis section */}
      {showVariableAnalysis && (
        <div className="variable-analysis">
          {/* Used variables status */}
          {usedVariables.length > 0 && (
            <div className="used-variables">
              <Text strong style={{ fontSize: '12px', marginRight: '8px' }}>
                Used variables:
              </Text>
              <Space size="small" wrap>
                {variableStatus.map(({ name, isValid, info }) => (
                  <Tooltip
                    key={name}
                    title={
                      isValid && info
                        ? `${info.type} from ${info.sourceNode || 'manual'}`
                        : 'Variable not available - check connections'
                    }
                  >
                    <Tag
                      icon={isValid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                      color={isValid ? 'green' : 'red'}
                      style={{ fontSize: '11px' }}
                    >
                      {name}
                    </Tag>
                  </Tooltip>
                ))}
              </Space>
            </div>
          )}
          
          {/* Available variables info */}
          {availableVariables.length > 0 && (
            <div className="available-variables">
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Available: {availableVariables.map(v => v.name).join(', ')}
              </Text>
            </div>
          )}
          
          {/* Help text */}
          <div className="help-text">
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Use {`{variable}`} syntax for dynamic content. Type {`{`} to see suggestions.
            </Text>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariableAwareTextArea;