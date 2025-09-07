import React from 'react';
import { Input } from 'antd';
import { 
  PlayCircleOutlined, 
  SendOutlined, 
  MessageOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  DatabaseOutlined, 
  ApiOutlined, 
  FormOutlined, 
  StopOutlined 
} from '@ant-design/icons';

// 左側工具欄組件
const Sidebar = ({ 
  isToolbarCollapsed,
  name,
  setName,
  description,
  setDescription,
  nodeTypeDefinitions,
  loadingNodeTypes,
  nodeTypes,
  nodes,
  onDragStart,
  t
}) => {
  return (
    <div style={{ 
      width: isToolbarCollapsed ? '0px' : '250px', 
      borderRight: isToolbarCollapsed ? 'none' : '1px solid #e8e8e8',
      backgroundColor: '#fafafa',
      padding: isToolbarCollapsed ? '0px' : '16px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s ease',
      opacity: isToolbarCollapsed ? 0 : 1,
      visibility: isToolbarCollapsed ? 'hidden' : 'visible',
      height: '100%'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h4>{t('workflowDesigner.workflowInfo')}</h4>
        <div style={{ marginBottom: '12px' }}>
          <label>{t('workflowDesigner.workflowName')}:</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('workflowDesigner.workflowNamePlaceholder')}
            style={{ marginTop: '4px' }}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label>{t('workflowDesigner.workflowDescription')}:</label>
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('workflowDesigner.workflowDescriptionPlaceholder')}
            rows={3}
            style={{ marginTop: '4px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>{t('workflow.nodeTypes')}</h4>

        {loadingNodeTypes ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div>{t('workflowDesigner.loadingNodeTypes')}</div>
          </div>
        ) : (
          <>
            {/* 按類別分組顯示節點類型 */}
            {(() => {
              // 使用 nodeTypeDefinitions 如果存在，否則使用 nodeTypes
              const availableNodeTypes = nodeTypeDefinitions && nodeTypeDefinitions.length > 0 
                ? nodeTypeDefinitions 
                : nodeTypes.map(nt => ({
                    type: nt.type,
                    label: nt.label,
                    category: 'Default',
                    description: nt.label,
                    isImplemented: true,
                    hasExecution: nt.type !== 'start' && nt.type !== 'end',
                    defaultData: {}
                  }));
              
              return Object.entries(
                availableNodeTypes.reduce((acc, nodeType) => {
                  const category = nodeType.category || 'Other';
                  if (!acc[category]) acc[category] = [];
                  acc[category].push(nodeType);
                  return acc;
                }, {})
              ).map(([category, types]) => (
                <div key={category} style={{ marginBottom: '16px' }}>
                  <h5 style={{ margin: '8px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                    {category}
                  </h5>
                  {types.map(nodeType => {
                    const iconComponent = nodeTypes.find(n => n.type === nodeType.type)?.icon;
                    const isDisabled = nodeType.type === 'start' && nodes.some(nd => nd.data.type === 'start');
                    
                    return (
                      <div
                        key={nodeType.type}
                        style={{ 
                          margin: '4px 0', 
                          padding: 8, 
                          background: nodeType.isImplemented ? '#fff' : '#f5f5f5', 
                          border: `1px solid ${nodeType.isImplemented ? '#ddd' : '#ccc'}`, 
                          borderRadius: 4, 
                          cursor: isDisabled ? 'not-allowed' : 'grab', 
                          opacity: isDisabled ? 0.5 : (nodeType.isImplemented ? 1 : 0.6),
                          position: 'relative'
                        }}
                        draggable={nodeType.isImplemented && !isDisabled}
                        onDragStart={e => {
                          if (nodeType.isImplemented && !isDisabled) {
                            onDragStart(e, nodeType.type);
                          }
                        }}
                        title={nodeType.description}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {iconComponent && React.createElement(iconComponent, { 
                            style: { fontSize: '16px', color: nodeType.isImplemented ? '#666' : '#999' } 
                          })}
                          <span style={{ 
                            fontSize: '12px', 
                            color: nodeType.isImplemented ? '#333' : '#999' 
                          }}>
                            {nodeType.label}
                          </span>
                        </div>
                        {!nodeType.isImplemented && (
                          <div style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            fontSize: '10px',
                            color: '#999',
                            backgroundColor: '#f0f0f0',
                            padding: '1px 4px',
                            borderRadius: '2px'
                          }}>
                            {t('workflowDesigner.inDevelopment')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
