/**
 * 只讀工作流視圖組件
 * 
 * ⚠️ 重要：此組件複製自 WorkflowDesigner 的顯示邏輯，以確保樣式完全一致
 * 
 * 同步來源（請在 WorkflowDesigner 更新時檢查這些文件）：
 * 1. 節點樣式和結構：
 *    - src/components/WorkflowDesigner/components/NodeTypes.js (createNodeTypesObj 函數)
 *    - src/components/WorkflowDesigner/constants.js (NODE_STYLES)
 *    - src/components/WorkflowDesigner/components/NodeContent.js
 *    - src/components/WorkflowDesigner/components/CommonHandle.js
 * 
 * 2. 節點/邊解析邏輯：
 *    - src/components/WorkflowDesigner/hooks/useDataFetching.js (loadWorkflow 函數, 第 166-244 行)
 *    - 特別是節點類型映射邏輯（start -> input, end -> output, 其他 -> default）
 *    - 邊的樣式設置（animated, strokeWidth, markerEnd）
 * 
 * 3. ReactFlow 配置：
 *    - src/components/WorkflowDesigner/components/WorkflowCanvas.js (第 99-159 行)
 *    - defaultEdgeOptions 配置
 *    - 滾動和縮放配置（panOnScroll, zoomOnScroll 等）
 * 
 * 4. 節點類型定義（用於圖標）：
 *    - src/components/WorkflowDesigner/hooks/useWorkflowState.js (nodeTypes, 第 44-70 行)
 *    - src/components/WorkflowDesigner/constants.js (NODE_TYPE_CONFIGS)
 * 
 * 日後同步步驟：
 * 1. 檢查上述文件是否有更新
 * 2. 如果節點樣式有變化，更新 getNodeStyle 和 ReadOnlyNode 組件
 * 3. 如果節點解析邏輯有變化，更新 useEffect 中的節點處理邏輯
 * 4. 如果 ReactFlow 配置有變化，更新 ReactFlow 組件的 props
 * 5. 如果節點類型定義有變化，確保 nodeTypes prop 正確傳遞
 * 
 * 此組件為只讀版本，移除了所有編輯功能（拖拽、連接、刪除等）
 * 但保留了統計標註功能（執行次數、平均時長、成功率）
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { ReactFlow, MiniMap, Controls, Background, ReactFlowProvider, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, Tag, Badge } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

// ========== 以下代碼直接複製自 WorkflowDesigner，確保樣式完全一致 ==========
// 來源：src/components/WorkflowDesigner/constants.js
import { NODE_STYLES } from '../../../components/WorkflowDesigner/constants';
// 來源：src/components/WorkflowDesigner/components/NodeContent.js
import NodeContent from '../../../components/WorkflowDesigner/components/NodeContent';
// 來源：src/components/WorkflowDesigner/components/CommonHandle.js
import CommonHandle from '../../../components/WorkflowDesigner/components/CommonHandle';
// 來源：src/components/WorkflowDesigner/styles.js（移除 React Flow 預設節點外框）
import { purpleButtonStyle } from '../../../components/WorkflowDesigner/styles';

// 獲取節點樣式函數（完全複製自 NodeTypes.js）
// 來源：src/components/WorkflowDesigner/components/NodeTypes.js (第 9-32 行)
const getNodeStyle = (nodeType, selected) => {
  const baseStyle = { ...NODE_STYLES.default };
  
  switch (nodeType) {
    case 'input':
      return {
        ...baseStyle,
        ...NODE_STYLES.input,
        ...(selected ? NODE_STYLES.inputSelected : {})
      };
    case 'output':
      return {
        ...baseStyle,
        ...NODE_STYLES.output,
        ...(selected ? NODE_STYLES.outputSelected : {})
      };
    default:
      return {
        ...baseStyle,
        ...NODE_STYLES.unselected,
        ...(selected ? NODE_STYLES.selected : {})
      };
  }
};

// 只讀節點組件（基於 createNodeTypesObj，但移除編輯功能）
// 來源：src/components/WorkflowDesigner/components/NodeTypes.js (第 35-180 行)
// 注意：此處複製了節點的結構和樣式，但移除了 DeleteButton 和編輯相關功能
const ReadOnlyNode = ({ id, data, selected }) => {
  const stats = data.stats || {};
  const nodeType = data.type === 'start' ? 'input' : data.type === 'end' ? 'output' : 'default';
  const nodeStyle = getNodeStyle(nodeType, selected);
  
  // 根據節點類型渲染不同的 Handle 配置（完全複製自 NodeTypes.js）
  const renderHandles = () => {
    if (nodeType === 'input') {
      // 複製自 NodeTypes.js input 節點的 Handle 配置（第 93-133 行）
      return (
        <>
          <CommonHandle
            type="target"
            position={Position.Left}
            id="left-target"
            style={{ left: -7, top: '50%' }}
            t={() => ''} // 只讀模式不需要翻譯
            onTypeChange={() => {}} // 只讀模式不允許修改
            nodeId={id}
            isEditable={false}
          />
          <CommonHandle
            type="source"
            position={Position.Right}
            id="right-source"
            style={{ right: -7, top: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
          <CommonHandle
            type="source"
            position={Position.Bottom}
            id="bottom-source"
            style={{ bottom: -7, left: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
        </>
      );
    } else if (nodeType === 'output') {
      // 複製自 NodeTypes.js output 節點的 Handle 配置（第 134-178 行）
      return (
        <>
          <CommonHandle
            type="target"
            position="top"
            id="top-target"
            style={{ top: -7, left: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
          <CommonHandle
            type="target"
            position="left"
            id="left-target"
            style={{ left: -7, top: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
          <CommonHandle
            type="source"
            position="right"
            id="right-source"
            style={{ right: -7, top: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
        </>
      );
    } else {
      // 複製自 NodeTypes.js default 節點的 Handle 配置（第 37-92 行）
      return (
        <>
          <CommonHandle
            type="target"
            position={Position.Top}
            id="top-target"
            style={{ top: -7, left: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
          <CommonHandle
            type="target"
            position={Position.Left}
            id="left-target"
            style={{ left: -7, top: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
          <CommonHandle
            type="source"
            position={Position.Right}
            id="right-source"
            style={{ right: -7, top: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
          <CommonHandle
            type="source"
            position={Position.Bottom}
            id="bottom-source"
            style={{ bottom: -7, left: '50%' }}
            t={() => ''}
            onTypeChange={() => {}}
            nodeId={id}
            isEditable={false}
          />
        </>
      );
    }
  };
  
  return (
    <div
      style={{
        ...nodeStyle,
        position: 'relative'
      }}
      className="custom-node"
    >
      {/* Handles - 使用 CommonHandle 組件（與設計器完全一致） */}
      {renderHandles()}
      
      {/* 節點內容 - 使用 NodeContent 組件（與設計器完全一致） */}
      <NodeContent data={data} />
      
      {/* 統計標註（只讀模式特有功能，不影響設計器樣式） */}
      {stats.executionCount > 0 && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#666', borderTop: '1px solid #f0f0f0', paddingTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>執行:</span>
            <Badge count={stats.executionCount} style={{ backgroundColor: '#1890ff' }} />
          </div>
          {stats.avgDuration > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>時長:</span>
              <span style={{ color: '#7234CF', fontWeight: 'bold', fontSize: '10px' }}>
                {stats.avgDuration.toFixed(1)}m
              </span>
            </div>
          )}
          {stats.successRate !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>成功:</span>
              <Tag 
                color={stats.successRate >= 80 ? 'success' : stats.successRate >= 50 ? 'warning' : 'error'}
                icon={stats.successRate >= 80 ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                style={{ fontSize: '10px', margin: 0, padding: '0 4px' }}
              >
                {stats.successRate.toFixed(0)}%
              </Tag>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ========== 以上代碼直接複製自 WorkflowDesigner ==========

// 只讀工作流視圖組件（內部組件）
const ReadOnlyWorkflowViewInner = ({ 
  workflowJson, 
  stepStats = {}, 
  height = 600,
  workflowName = '工作流',
  onInit,
  nodeTypes = [] // 可選：節點類型定義（用於圖標），格式：[{ type: 'start', label: 'Start', icon: PlayCircleOutlined }, ...]
}) => {
  const [nodes, setNodes] = React.useState([]);
  const [edges, setEdges] = React.useState([]);
  const reactFlowInstanceRef = useRef(null);

  // 解析工作流 JSON 並設置節點和邊
  // 此邏輯完全複製自：src/components/WorkflowDesigner/hooks/useDataFetching.js (loadWorkflow 函數, 第 166-244 行)
  useEffect(() => {
    if (!workflowJson) return;

    try {
      const flow = typeof workflowJson === 'string' ? JSON.parse(workflowJson) : workflowJson;
      
      if (flow.nodes) {
        // 重新添加圖標組件並確保正確的 React Flow 類型（完全複製自 useDataFetching.js 第 182-209 行）
        const nodesWithIcons = flow.nodes.map(node => {
          const nodeType = nodeTypes.find(n => n.type === node.data?.type);
          
          // 確定節點的 React Flow 類型（複製自 useDataFetching.js 第 187-195 行）
          let reactFlowType;
          if (node.data?.type === 'start') {
            reactFlowType = 'input';
          } else if (node.data?.type === 'end') {
            reactFlowType = 'output';
          } else {
            reactFlowType = 'default';
          }
          
          // 查找對應的統計數據（只讀模式特有）
          const taskName = node.data?.taskName || node.data?.label;
          const stepName = taskName || node.data?.type;
          const stats = stepStats[stepName] || stepStats[taskName] || stepStats[node.id] || {};
          
          // 節點數據結構（複製自 useDataFetching.js 第 197-207 行）
          return {
            ...node,
            type: reactFlowType, // 確保使用正確的 React Flow 類型
            data: {
              ...node.data,
              icon: nodeType ? nodeType.icon : null,
              label: node.data?.label || nodeType?.label || node.data?.type,
              taskName: node.data?.taskName || node.data?.label || nodeType?.label || node.data?.type,
              // 添加統計數據（只讀模式特有）
              stats: {
                executionCount: stats.executionCount || 0,
                avgDuration: stats.avgDuration || 0,
                successRate: stats.successRate,
                totalDuration: stats.totalDuration || 0
              }
            }
          };
        });
        setNodes(nodesWithIcons);
      }
      
      if (flow.edges) {
        // 設置連線，確保有正確的樣式（完全複製自 useDataFetching.js 第 211-234 行）
        const edgesWithStyle = flow.edges.map(edge => ({
          ...edge,
          type: edge.type || 'smoothstep',
          animated: edge.animated !== undefined ? edge.animated : true,
          style: edge.style || { 
            strokeWidth: 3,
            stroke: '#1890ff'
          },
          markerEnd: edge.markerEnd || {
            type: 'arrowclosed',
            width: 12,
            height: 12,
            color: '#1890ff',
          }
        }));
        setEdges(edgesWithStyle);
      }
    } catch (error) {
      console.error('解析工作流 JSON 失敗:', error);
    }
  }, [workflowJson, stepStats, nodeTypes]);

  // 自動適配視圖
  const handleInit = (reactFlowInstance) => {
    reactFlowInstanceRef.current = reactFlowInstance;
    if (onInit) onInit(reactFlowInstance);
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
    }, 100);
  };

  const nodeTypesComponents = useMemo(() => ({
    default: ReadOnlyNode,
    input: ReadOnlyNode,
    output: ReadOnlyNode
  }), []);

  // ReactFlow 配置完全複製自：src/components/WorkflowDesigner/components/WorkflowCanvas.js (第 99-159 行)
  return (
    <>
      {/* 應用 WorkflowDesigner 樣式（移除 React Flow 預設節點外框） */}
      <style>{purpleButtonStyle}</style>
      <Card 
        title={workflowName}
        style={{ height: '100%' }}
        bodyStyle={{ padding: 0, height: 'calc(100% - 57px)' }}
      >
        <div style={{ width: '100%', height: height }}>
        <ReactFlow
          onInit={handleInit}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypesComponents}
          // 只讀模式：禁用所有編輯功能
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          // 與設計器完全一致的滾動和縮放配置（複製自 WorkflowCanvas.js 第 131-140 行）
          panOnScroll={false}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomActivationKeyCode={null}
          zoomOnDoubleClick={false}
          // 與設計器完全一致的邊配置（複製自 WorkflowCanvas.js 第 145-159 行）
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { 
              strokeWidth: 3,
              stroke: '#1890ff'
            },
            markerEnd: {
              type: 'arrowclosed',
              width: 12,
              height: 12,
              color: '#1890ff',
            }
          }}
        >
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              const stats = node.data?.stats;
              if (stats?.successRate >= 80) return '#52c41a';
              if (stats?.successRate >= 50) return '#faad14';
              if (stats?.successRate > 0) return '#ff4d4f';
              return '#d9d9d9';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
          <Background />
        </ReactFlow>
      </div>
    </Card>
    </>
  );
};

// 包裝組件以提供 ReactFlowProvider
const ReadOnlyWorkflowView = (props) => {
  return (
    <ReactFlowProvider>
      <ReadOnlyWorkflowViewInner {...props} />
    </ReactFlowProvider>
  );
};

export default ReadOnlyWorkflowView;
