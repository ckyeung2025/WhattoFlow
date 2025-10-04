import React, { useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Form } from 'antd';

// 導入分拆的 Hooks
import { useWorkflowState } from './hooks/useWorkflowState';
import { useDataFetching } from './hooks/useDataFetching';
import { useNodeHandlers } from './hooks/useNodeHandlers';
import { useEdgeHandlers } from './hooks/useEdgeHandlers';
import { useWorkflowSave } from './hooks/useWorkflowSave';
import { useAdvancedFeatures } from './hooks/useAdvancedFeatures';
import { useNodeSelection } from './hooks/useNodeSelection';

// 導入分拆的組件
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import WorkflowCanvas from './components/WorkflowCanvas';
import NodePropertyDrawer from './components/NodePropertyDrawer';

// 導入模態框
import TemplateModal from './modals/TemplateModal';
import UserModal from './modals/UserModal';
import EFormModal from './modals/EFormModal';
import ProcessVariablesModal from './modals/ProcessVariablesModal';
import ConditionModal from './modals/ConditionModal';
import ConditionGroupModal from './modals/ConditionGroupModal';
import DefaultPathModal from './modals/DefaultPathModal';

// 導入樣式
import { purpleButtonStyle } from './styles';
import { getAvailableOutputPaths } from './utils';

const WhatsAppWorkflowDesignerRefactored = () => {
  const { t, isReady } = useLanguage();
  const [processVariableForm] = Form.useForm();
  
  // 使用節點選中 Hook
  const {
    selectedNodes,
    setSelectedNodes,
    isNodeSelected,
    handleNodeSelect,
    handleCanvasClick,
    clearSelection,
    selectAllNodes,
    handleSelectionChange,
    syncSelectionToReactFlow
  } = useNodeSelection();

  // 使用工作流程狀態 Hook
  const {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    selectedNode,
    setSelectedNode,
    selectedEdge,
    setSelectedEdge,
    hoveredEdge,
    setHoveredEdge,
    drawerOpen,
    setDrawerOpen,
    isToolbarCollapsed,
    setIsToolbarCollapsed,
    isConnecting,
    setIsConnecting,
    connectionStart,
    setConnectionStart,
    reactFlowInstanceRef,
    form,
    nodeTypes,
    nodeTypesComponents,
    nodeTypeLabel,
    handleNodeDataChange,
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
    onMove,
    handleInit,
    toggleToolbar,
    handleEdgeSwitch,
    edgeTypes,
    setGlobalDragHandler,
  } = useWorkflowState(isNodeSelected);

  // 使用高級功能 Hook
  const {
    copyNodes,
    pasteNodes,
    alignNodes,
    handleKeyDown: originalHandleKeyDown,
  } = useAdvancedFeatures(nodes, setNodes, edges, setEdges, selectedNodes, setSelectedNodes);


  // 包裝鍵盤事件處理
  const handleKeyDown = useCallback((event) => {
    // 檢查是否在輸入框、文本區域或可編輯元素中
    const target = event.target;
    const isInputElement = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.contentEditable === 'true' ||
                          target.isContentEditable ||
                          // 檢查是否在 Ant Design 的輸入組件中
                          target.closest('.ant-input') ||
                          target.closest('.ant-input-affix-wrapper') ||
                          target.closest('.ant-select-selector') ||
                          target.closest('.ant-cascader-picker') ||
                          target.closest('.ant-picker') ||
                          target.closest('.ant-mentions') ||
                          target.closest('.ant-upload');
    
    // 如果在輸入元素中，不攔截鍵盤事件
    if (isInputElement) {
      return; // 讓瀏覽器處理輸入事件
    }
    
    originalHandleKeyDown(event);
    
    // 處理全選功能
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'a') {
        event.preventDefault();
        selectAllNodes(nodes);
        // 同步選擇狀態到 React Flow
        if (reactFlowInstanceRef.current) {
          syncSelectionToReactFlow(reactFlowInstanceRef.current, selectedNodes);
        }
      }
    }
  }, [originalHandleKeyDown, selectAllNodes, nodes, syncSelectionToReactFlow, selectedNodes, reactFlowInstanceRef]);

  // 使用數據獲取 Hook
  const {
    name,
    setName,
    description,
    setDescription,
    status,
    setStatus,
    workflowId,
    templates,
    setTemplates,
    isTemplateModalVisible,
    setIsTemplateModalVisible,
    selectedTemplate,
    setSelectedTemplate,
    users,
    setUsers,
    isUserModalVisible,
    setIsUserModalVisible,
    selectedUser,
    setSelectedUser,
    eforms,
    setEforms,
    isEFormModalVisible,
    setIsEFormModalVisible,
    selectedEForm,
    setSelectedEForm,
    isRecipientModalVisible,
    setIsRecipientModalVisible,
    nodeTypeDefinitions,
    setNodeTypeDefinitions,
    loadingNodeTypes,
    setLoadingNodeTypes,
    processVariables,
    setProcessVariables,
    processVariablesModalVisible,
    setProcessVariablesModalVisible,
    selectedProcessVariable,
    setSelectedProcessVariable,
    editingProcessVariable,
    setEditingProcessVariable,
    initializeData,
  } = useDataFetching();

  // 使用節點處理 Hook
  const {
    handleDeleteNode,
    handleAddNode,
    onDragStart,
    onDragOver,
    onDrop,
    handleSelectTemplate,
    handleSelectUser,
    handleSelectEForm,
  } = useNodeHandlers(nodeTypes, setNodes, setSelectedNode, selectedNode, handleNodeDataChange, isReady, t);

  // 使用邊處理 Hook
  const {
    onConnect,
    handleDeleteEdge,
    onEdgeDelete,
    onEdgeMouseEnter: onEdgeMouseEnterHandler,
    onEdgeMouseLeave: onEdgeMouseLeaveHandler,
    onMove: onMoveHandler,
    onEdgeSwitch: onEdgeSwitchHandler,
  } = useEdgeHandlers(nodes, edges, setEdges, setSelectedEdge, setHoveredEdge, handleEdgeSwitch);

  // 使用工作流程保存 Hook
  const { handleSave } = useWorkflowSave(
    nodes, 
    edges, 
    name, 
    description, 
    status, 
    null, // createdAt
    null, // createdBy
    null, // updatedBy
    workflowId, 
    t
  );


  // 條件相關狀態
  const [conditionModalVisible, setConditionModalVisible] = React.useState(false);
  const [conditionGroupModalVisible, setConditionGroupModalVisible] = React.useState(false);
  const [defaultPathModalVisible, setDefaultPathModalVisible] = React.useState(false);
  const [editingCondition, setEditingCondition] = React.useState(null);
  const [editingConditionGroup, setEditingConditionGroup] = React.useState(null);
  const [conditionForm] = Form.useForm();
  const [conditionGroupForm] = Form.useForm();

  // 當編輯條件時預填表單
  React.useEffect(() => {
    if (editingCondition && conditionModalVisible) {
      if (editingCondition.condIndex !== -1) {
        // 編輯現有條件，預填表單
        conditionForm.setFieldsValue({
          variableName: editingCondition.variableName,
          operator: editingCondition.operator,
          value: editingCondition.value,
          label: editingCondition.label
        });
      } else {
        // 新增條件，清空表單
        conditionForm.resetFields();
      }
    }
  }, [editingCondition, conditionModalVisible, conditionForm]);

  // 當編輯條件群組時預填表單
  React.useEffect(() => {
    if (editingConditionGroup && conditionGroupModalVisible) {
      if (editingConditionGroup.groupIndex !== -1) {
        // 編輯現有條件群組，預填表單
        conditionGroupForm.setFieldsValue({
          relation: editingConditionGroup.relation,
          outputPath: editingConditionGroup.outputPath
        });
      } else {
        // 新增條件群組，清空表單
        conditionGroupForm.resetFields();
      }
    }
  }, [editingConditionGroup, conditionGroupModalVisible, conditionGroupForm]);

  // 初始化數據
  useEffect(() => {
    if (isReady) {
      initializeData(nodeTypes, setNodes, setEdges, handleDeleteNode, onEdgeSwitchHandler);
    }
  }, [isReady, initializeData]);

  // 確保所有節點都有正確的 onDelete 函數
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      if (n.data.type === 'start') {
        return { ...n, data: { ...n.data, onDelete: null }, draggable: true };
      } else if (!n.data.onDelete) {
        return { ...n, data: { ...n.data, onDelete: handleDeleteNode } };
      }
      return n;
    }));
  }, [setNodes, handleDeleteNode]);

  // 設置條件群組表單初始值
  useEffect(() => {
    if (editingConditionGroup && conditionGroupForm) {
      conditionGroupForm.setFieldsValue({
        relation: editingConditionGroup.relation || 'and',
        outputPath: editingConditionGroup.outputPath || ''
      });
    }
  }, [editingConditionGroup, conditionGroupForm]);

  // 設置條件編輯表單初始值
  useEffect(() => {
    if (editingCondition && conditionForm) {
      conditionForm.setFieldsValue({
        variableName: editingCondition.variableName || '',
        operator: editingCondition.operator || '',
        value: editingCondition.value || '',
        label: editingCondition.label || ''
      });
    }
  }, [editingCondition, conditionForm]);

  // 處理拖放
  const handleDrop = (event) => {
    onDrop(event, reactFlowInstanceRef);
  };

  // 處理邊的懸停
  const handleEdgeMouseEnter = (event, edge) => {
    onEdgeMouseEnterHandler(event, edge);
  };

  const handleEdgeMouseLeave = () => {
    onEdgeMouseLeaveHandler();
  };

  // 處理視圖變化
  const handleMove = () => {
    onMoveHandler(selectedEdge);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{purpleButtonStyle}</style>
      
      {/* 頂部工具欄 */}
      <Toolbar
        onSave={handleSave}
        onOpenProcessVariables={() => setProcessVariablesModalVisible(true)}
        onCopyNodes={copyNodes}
        onPasteNodes={pasteNodes}
        onAlignNodes={alignNodes}
        selectedNodes={selectedNodes}
        t={t}
      />

      {/* 主要內容區域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左側工具欄 */}
        <Sidebar
          isToolbarCollapsed={isToolbarCollapsed}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          nodeTypeDefinitions={nodeTypeDefinitions}
          loadingNodeTypes={loadingNodeTypes}
          nodeTypes={nodeTypes}
          nodes={nodes}
          onDragStart={onDragStart}
          t={t}
        />

        {/* 編輯器區域 */}
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={handleDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeClick={onEdgeClick}
          onEdgeMouseEnter={handleEdgeMouseEnter}
          onEdgeMouseLeave={handleEdgeMouseLeave}
          nodeTypes={nodeTypes}
          nodeTypesComponents={nodeTypesComponents}
          edgeTypes={edgeTypes}
          onEdgeSwitch={onEdgeSwitchHandler}
          onMove={handleMove}
          handleInit={handleInit}
          selectedEdge={selectedEdge}
          hoveredEdge={hoveredEdge}
          onEdgeDelete={onEdgeDelete}
          reactFlowInstanceRef={reactFlowInstanceRef}
          onNodeSelect={handleNodeSelect}
          onCanvasClick={handleCanvasClick}
          onKeyDown={handleKeyDown}
          onSelectionChange={handleSelectionChange}
          t={t}
        />

        {/* 右側屬性編輯 */}
        <NodePropertyDrawer
          selectedNode={selectedNode}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          form={form}
          handleNodeDataChange={handleNodeDataChange}
          processVariables={processVariables}
          nodes={nodes}
          edges={edges}
          workflowId={workflowId}
          t={t}
          isTemplateModalVisible={isTemplateModalVisible}
          setIsTemplateModalVisible={setIsTemplateModalVisible}
          isUserModalVisible={isUserModalVisible}
          setIsUserModalVisible={setIsUserModalVisible}
          isEFormModalVisible={isEFormModalVisible}
          setIsEFormModalVisible={setIsEFormModalVisible}
          isRecipientModalVisible={isRecipientModalVisible}
          setIsRecipientModalVisible={setIsRecipientModalVisible}
          conditionModalVisible={conditionModalVisible}
          setConditionModalVisible={setConditionModalVisible}
          conditionGroupModalVisible={conditionGroupModalVisible}
          setConditionGroupModalVisible={setConditionGroupModalVisible}
          defaultPathModalVisible={defaultPathModalVisible}
          setDefaultPathModalVisible={setDefaultPathModalVisible}
          editingCondition={editingCondition}
          setEditingCondition={setEditingCondition}
          editingConditionGroup={editingConditionGroup}
          setEditingConditionGroup={setEditingConditionGroup}
          conditionForm={conditionForm}
          conditionGroupForm={conditionGroupForm}
          handleSelectTemplate={handleSelectTemplate}
          handleSelectUser={handleSelectUser}
          handleSelectEForm={handleSelectEForm}
          onSaveConditionGroup={(values) => {
            if (editingConditionGroup && selectedNode) {
              const conditionGroup = {
                id: editingConditionGroup.id || `group_${Date.now()}`,
                relation: values.relation,
                outputPath: values.outputPath,
                conditions: editingConditionGroup.conditions || []
              };
              
              const currentGroups = selectedNode.data.conditionGroups || [];
              const newGroups = [...currentGroups];
              
              if (editingConditionGroup.groupIndex === -1) {
                // 新增條件群組
                newGroups.push(conditionGroup);
              } else {
                // 更新現有條件群組
                newGroups[editingConditionGroup.groupIndex] = conditionGroup;
              }
              
              handleNodeDataChange({ conditionGroups: newGroups });
            }
            setConditionGroupModalVisible(false);
            setEditingConditionGroup(null);
            conditionGroupForm.resetFields();
          }}
          onEditCondition={(condition, condIndex) => {
            setEditingCondition({ ...condition, groupIndex: editingConditionGroup.groupIndex, condIndex });
            setConditionModalVisible(true);
          }}
          onAddCondition={() => {
            setEditingCondition({ groupIndex: editingConditionGroup.groupIndex, condIndex: -1 });
            setConditionModalVisible(true);
          }}
          onDeleteCondition={(condIndex) => {
            const currentConditions = editingConditionGroup.conditions || [];
            const newConditions = currentConditions.filter((_, i) => i !== condIndex);
            setEditingConditionGroup({ ...editingConditionGroup, conditions: newConditions });
          }}
          onSelectPath={() => {}}
        />
      </div>

      {/* 模態框組件 */}
      <TemplateModal
        visible={isTemplateModalVisible}
        onCancel={() => setIsTemplateModalVisible(false)}
        templates={templates}
        onSelectTemplate={(template) => {
          handleSelectTemplate(template);
          setIsTemplateModalVisible(false);
        }}
        t={t}
      />

      <UserModal
        visible={isUserModalVisible}
        onCancel={() => setIsUserModalVisible(false)}
        users={users}
        onSelectUser={(user) => {
          handleSelectUser(user);
          setIsUserModalVisible(false);
        }}
        t={t}
      />

      <EFormModal
        visible={isEFormModalVisible}
        onCancel={() => setIsEFormModalVisible(false)}
        eforms={eforms}
        onSelectEForm={(eform) => {
          handleSelectEForm(eform);
          setIsEFormModalVisible(false);
        }}
        t={t}
      />

      <ProcessVariablesModal
        visible={processVariablesModalVisible}
        onCancel={() => setProcessVariablesModalVisible(false)}
        processVariables={processVariables}
        selectedProcessVariable={selectedProcessVariable}
        editingProcessVariable={editingProcessVariable}
        processVariableForm={processVariableForm}
        onAddProcessVariable={() => {
          const newVariable = {
            id: null,
            workflowDefinitionId: workflowId,
            variableName: '',
            displayName: '',
            dataType: 'string',
            description: '',
            isRequired: false,
            defaultValue: '',
            validationRules: '',
            jsonSchema: ''
          };
          setEditingProcessVariable(newVariable);
          setSelectedProcessVariable(newVariable);
          processVariableForm.setFieldsValue(newVariable);
        }}
        onEditProcessVariable={(variable) => {
          setEditingProcessVariable(variable);
          setSelectedProcessVariable(variable);
          processVariableForm.setFieldsValue(variable);
        }}
        onDeleteProcessVariable={async (variableId) => {
          try {
            console.log('刪除流程變量:', variableId);
            
            // 調用 API 刪除
            const { apiService } = await import('./services/apiService');
            const success = await apiService.deleteProcessVariable(variableId);
            
            if (success) {
              // 重新載入流程變量列表
              const updatedVariables = await apiService.fetchProcessVariables(workflowId);
              setProcessVariables(updatedVariables);
              
              // 重置編輯狀態
              setEditingProcessVariable(null);
              setSelectedProcessVariable(null);
              processVariableForm.resetFields();
              
              console.log('流程變量刪除成功');
            } else {
              console.error('流程變量刪除失敗');
            }
          } catch (error) {
            console.error('刪除流程變量失敗:', error);
          }
        }}
        onSaveProcessVariable={async (values) => {
          try {
            console.log('保存流程變量:', values);
            
            // 準備保存的數據
            const variableData = {
              ...values,
              workflowDefinitionId: workflowId,
              id: editingProcessVariable?.id || null
            };
            
            // 檢查是更新還是創建
            const isUpdate = editingProcessVariable && editingProcessVariable.id;
            
            // 調用 API 保存
            const { apiService } = await import('./services/apiService');
            const success = await apiService.saveProcessVariable(variableData, isUpdate, editingProcessVariable?.id);
            
            if (success) {
              // 重新載入流程變量列表
              const updatedVariables = await apiService.fetchProcessVariables(workflowId);
              setProcessVariables(updatedVariables);
              
              // 重置編輯狀態
              setEditingProcessVariable(null);
              setSelectedProcessVariable(null);
              processVariableForm.resetFields();
              
              console.log('流程變量保存成功');
            } else {
              console.error('流程變量保存失敗');
            }
          } catch (error) {
            console.error('保存流程變量失敗:', error);
          }
        }}
        onCancelProcessVariableEdit={() => {
          setEditingProcessVariable(null);
          processVariableForm.resetFields();
        }}
        t={t}
      />

      <ConditionGroupModal
        visible={conditionGroupModalVisible}
        onCancel={() => {
          setConditionGroupModalVisible(false);
          setEditingConditionGroup(null);
          conditionGroupForm.resetFields();
        }}
        editingConditionGroup={editingConditionGroup}
        conditionGroupForm={conditionGroupForm}
        selectedNode={selectedNode}
        getAvailableOutputPaths={(nodeId) => getAvailableOutputPaths(nodeId, edges, nodes, t)}
        onSave={(values) => {
          if (editingConditionGroup && selectedNode) {
            const conditionGroup = {
              id: editingConditionGroup.id || `group_${Date.now()}`,
              relation: values.relation,
              outputPath: values.outputPath,
              conditions: editingConditionGroup.conditions || []
            };
            
            const currentGroups = selectedNode.data.conditionGroups || [];
            const newGroups = [...currentGroups];
            
            if (editingConditionGroup.groupIndex === -1) {
              // 新增條件群組
              newGroups.push(conditionGroup);
            } else {
              // 更新現有條件群組
              newGroups[editingConditionGroup.groupIndex] = conditionGroup;
            }
            
            handleNodeDataChange({ conditionGroups: newGroups });
          }
          setConditionGroupModalVisible(false);
          setEditingConditionGroup(null);
          conditionGroupForm.resetFields();
        }}
        onEditCondition={(condition, condIndex) => {
          setEditingCondition({ ...condition, groupIndex: editingConditionGroup.groupIndex, condIndex });
          setConditionModalVisible(true);
        }}
        onAddCondition={() => {
          console.log('=== 開始添加條件 ===');
          console.log('editingConditionGroup:', editingConditionGroup);
          console.log('groupIndex:', editingConditionGroup.groupIndex);
          const newEditingCondition = { groupIndex: editingConditionGroup.groupIndex, condIndex: -1 };
          console.log('newEditingCondition:', newEditingCondition);
          setEditingCondition(newEditingCondition);
          setConditionModalVisible(true);
          console.log('條件模態框已打開');
        }}
        onDeleteCondition={(condIndex) => {
          const currentConditions = editingConditionGroup.conditions || [];
          const newConditions = currentConditions.filter((_, i) => i !== condIndex);
          
          // 更新編輯中的條件群組狀態
          setEditingConditionGroup({ ...editingConditionGroup, conditions: newConditions });
          
          // 同時更新節點數據
          if (selectedNode && editingConditionGroup.groupIndex >= 0) {
            const currentGroups = selectedNode.data.conditionGroups || [];
            const newGroups = [...currentGroups];
            if (newGroups[editingConditionGroup.groupIndex]) {
              newGroups[editingConditionGroup.groupIndex].conditions = newConditions;
              handleNodeDataChange({ conditionGroups: newGroups });
            }
          }
        }}
        t={t}
      />

      <ConditionModal
        visible={conditionModalVisible}
        onCancel={() => {
          setConditionModalVisible(false);
          setEditingCondition(null);
          conditionForm.resetFields();
        }}
        editingCondition={editingCondition}
        conditionForm={conditionForm}
        processVariables={processVariables}
        onSave={(values) => {
          console.log('=== 保存條件 ===');
          console.log('values:', values);
          console.log('editingCondition:', editingCondition);
          console.log('selectedNode:', selectedNode);
          console.log('editingConditionGroup:', editingConditionGroup);
          
          if (editingCondition && selectedNode) {
            const condition = {
              id: editingCondition.id || `condition_${Date.now()}`,
              variableName: values.variableName,
              operator: values.operator,
              value: values.value,
              label: values.label || `${values.variableName} ${values.operator} ${values.value}`
            };
            console.log('新條件:', condition);
            
            const currentGroups = selectedNode.data.conditionGroups || [];
            console.log('當前條件群組:', currentGroups);
            const newGroups = [...currentGroups];
            console.log('新條件群組數組:', newGroups);
            
            if (editingCondition.groupIndex === -1) {
              // 新增條件群組的情況，直接更新 editingConditionGroup
              console.log('新增條件群組，直接更新 editingConditionGroup');
              const currentConditions = editingConditionGroup?.conditions || [];
              const newConditions = [...currentConditions, condition];
              console.log('新的條件列表:', newConditions);
              
              const updatedGroup = {
                ...editingConditionGroup,
                conditions: newConditions
              };
              console.log('更新後的 editingConditionGroup:', updatedGroup);
              setEditingConditionGroup(updatedGroup);
              console.log('editingConditionGroup 狀態已更新');
            } else if (editingCondition.groupIndex >= 0 && newGroups[editingCondition.groupIndex]) {
              // 編輯現有條件群組的情況
              console.log('目標群組索引:', editingCondition.groupIndex);
              console.log('目標群組:', newGroups[editingCondition.groupIndex]);
              
              if (!newGroups[editingCondition.groupIndex].conditions) {
                newGroups[editingCondition.groupIndex].conditions = [];
                console.log('初始化條件數組');
              }
              
              if (editingCondition.condIndex === -1) {
                // 新增條件
                console.log('添加新條件到群組');
                newGroups[editingCondition.groupIndex].conditions.push(condition);
                console.log('添加後的條件列表:', newGroups[editingCondition.groupIndex].conditions);
              } else {
                // 更新現有條件
                console.log('更新現有條件');
                newGroups[editingCondition.groupIndex].conditions[editingCondition.condIndex] = condition;
              }
              
              console.log('更新節點數據前的完整群組:', newGroups);
              handleNodeDataChange({ conditionGroups: newGroups });
              console.log('節點數據已更新');
              
              // 更新編輯中的條件群組狀態 - 確保狀態同步
              const updatedGroup = { 
                ...editingConditionGroup, 
                conditions: [...newGroups[editingCondition.groupIndex].conditions] // 創建新數組確保引用更新
              };
              console.log('更新後的 editingConditionGroup:', updatedGroup);
              setEditingConditionGroup(updatedGroup);
              console.log('editingConditionGroup 狀態已更新');
            } else {
              console.log('條件保存失敗：無效的群組索引或群組不存在');
            }
          } else {
            console.log('條件保存失敗：缺少必要參數');
          }
          setConditionModalVisible(false);
          setEditingCondition(null);
          conditionForm.resetFields();
          console.log('條件模態框已關閉');
        }}
        t={t}
      />

      <DefaultPathModal
        visible={defaultPathModalVisible}
        onCancel={() => setDefaultPathModalVisible(false)}
        selectedNode={selectedNode}
        availablePaths={selectedNode ? getAvailableOutputPaths(selectedNode.id, edges, nodes, t) : []}
        onSelectPath={(pathId) => {
          if (selectedNode) {
            handleNodeDataChange({ defaultPath: pathId });
          }
          setDefaultPathModalVisible(false);
        }}
        t={t}
      />
    </div>
  );
};

export default WhatsAppWorkflowDesignerRefactored;
