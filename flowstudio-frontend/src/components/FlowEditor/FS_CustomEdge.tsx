import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

interface CustomEdgeData {
  sourceHandleId?: string;
  targetHandleId?: string;
  onDelete?: (edgeId: string) => void;
  isMultiVariableConnection?: boolean;
  isOllamaConnection?: boolean;
  variableMappings?: Array<{
    outputVariable: string;
    targetVariable: string;
    dataType: string;
    description?: string;
  }>;
  ollamaVariableMappings?: Array<{
    outputVariable: string;
    targetVariable: string;
    dataType: string;
    description?: string;
  }>;
}

const FS_CustomEdge: React.FC<EdgeProps<CustomEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}) => {
  const { deleteElements } = useReactFlow();
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = () => {
    if (data?.onDelete) {
      data.onDelete(id);
    } else {
      deleteElements({ edges: [{ id }] });
    }
  };

  const isMultiVariable = (data?.isMultiVariableConnection && data?.variableMappings) ||
                         (data?.isOllamaConnection && data?.ollamaVariableMappings);
  const variableCount = data?.variableMappings?.length || data?.ollamaVariableMappings?.length || 0;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          strokeWidth: selected ? 3 : (isMultiVariable ? 3 : 2),
          stroke: selected ? '#1890ff' : (isMultiVariable ? '#52c41a' : '#b1b1b7'),
          strokeDasharray: data?.sourceHandleId ? undefined : '5,5',
        }}
      />
      
      {/* Multi-variable indicator */}
      {isMultiVariable && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              pointerEvents: 'none',
              backgroundColor: '#52c41a',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '8px',
              fontWeight: 'bold',
              border: '1px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
            className="nodrag nopan"
          >
            {variableCount} vars
          </div>
        </EdgeLabelRenderer>
      )}
      
      {/* Delete button on edge when selected */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (isMultiVariable ? 25 : 0)}px)`,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <Button
              type="primary"
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={handleDelete}
              style={{
                width: 20,
                height: 20,
                padding: 0,
                minWidth: 20,
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default FS_CustomEdge;