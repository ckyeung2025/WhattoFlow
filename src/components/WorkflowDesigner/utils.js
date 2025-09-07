// 工作流程設計器工具函數

// 通用錯誤處理函數
export const handleApiError = (error, fallbackData, setter, errorMessage) => {
  console.error(errorMessage, error);
  setter(fallbackData);
};

// 變量引用語法處理工具函數
export const processVariableReferences = (text, processVariables) => {
  if (!text || !processVariables) return text;
  
  // 匹配 ${variable_name} 格式的變量引用
  const variablePattern = /\$\{([^}]+)\}/g;
  
  return text.replace(variablePattern, (match, variableName) => {
    const variable = processVariables.find(pv => pv.variableName === variableName.trim());
    if (variable) {
      // 返回變量的示例值或類型信息
      return `[${variable.variableName}: ${variable.dataType}]`;
    }
    return match; // 如果找不到變量，保持原樣
  });
};

// 生成唯一的任務名稱
export const generateUniqueTaskName = (baseName, existingNodes) => {
  const existingNames = existingNodes.map(node => node.data.taskName);
  let counter = 1;
  let newName = baseName;
  
  while (existingNames.includes(newName)) {
    counter++;
    newName = `${baseName} (${counter})`;
  }
  
  return newName;
};

// 生成 Webhook Token
export const generateWebhookToken = () => {
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return token;
};

// 驗證工作流程連接邏輯
export const validateWorkflowLogic = (nodes, edges, t) => {
  const errors = [];
  const warnings = [];
  
  // 檢查是否有 Start 和 End 節點
  const hasStart = nodes.some(n => n.data.type === 'start');
  const hasEnd = nodes.some(n => n.data.type === 'end');
  
  if (!hasStart) {
    errors.push(t('workflowDesigner.missingStartNode'));
  }
  if (!hasEnd) {
    errors.push(t('workflowDesigner.missingEndNode'));
  }
  
  // 檢查是否有連接
  if (edges.length === 0) {
    errors.push(t('workflowDesigner.noConnections'));
    return { errors, warnings };
  }
  
  // 檢查循環連接
  const visited = new Set();
  const recursionStack = new Set();
  
  const hasCycle = (nodeId, parentId = null) => {
    if (recursionStack.has(nodeId)) {
      return true; // 發現循環
    }
    if (visited.has(nodeId)) {
      return false; // 已經訪問過，沒有循環
    }
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    // 找到從當前節點出發的所有邊
    const outgoingEdges = edges.filter(edge => edge.source === nodeId);
    
    for (const edge of outgoingEdges) {
      if (edge.target === parentId) {
        continue; // 跳過回到父節點的邊
      }
      
      if (hasCycle(edge.target, nodeId)) {
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  };
  
  // 檢查每個節點是否有循環
  for (const node of nodes) {
    if (hasCycle(node.id)) {
      errors.push(t('workflowDesigner.circularConnection', { nodeName: node.data.taskName || node.data.label }));
      break;
    }
  }
  
  // 檢查孤立節點（沒有輸入或輸出的節點）
  const connectedNodes = new Set();
  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });
  
  const isolatedNodes = nodes.filter(node => 
    node.data.type !== 'start' && 
    node.data.type !== 'end' && 
    !connectedNodes.has(node.id)
  );
  
  if (isolatedNodes.length > 0) {
    warnings.push(t('workflowDesigner.isolatedNodes', { nodeNames: isolatedNodes.map(n => n.data.taskName || n.data.label).join(', ') }));
  }
  
  // 檢查 Start 節點是否有輸出
  const startNodes = nodes.filter(n => n.data.type === 'start');
  for (const startNode of startNodes) {
    const hasOutput = edges.some(edge => edge.source === startNode.id);
    if (!hasOutput) {
      warnings.push(t('workflowDesigner.startNodeNoOutput', { nodeName: startNode.data.taskName || startNode.data.label }));
    }
  }
  
  // 檢查 End 節點是否有輸入
  const endNodes = nodes.filter(n => n.data.type === 'end');
  for (const endNode of endNodes) {
    const hasInput = edges.some(edge => edge.target === endNode.id);
    if (!hasInput) {
      warnings.push(t('workflowDesigner.endNodeNoInput', { nodeName: endNode.data.taskName || endNode.data.label }));
    }
  }
  
  return { errors, warnings };
};

// 獲取可用的輸出路徑（從當前節點出發的連線）
export const getAvailableOutputPaths = (nodeId, edges, nodes, t) => {
  if (!nodeId || !edges || !Array.isArray(edges) || !nodes || !Array.isArray(nodes)) {
    return [{
      id: 'default',
      label: t ? t('workflowDesigner.defaultPath') : 'Default Path',
      targetNodeId: null
    }];
  }
  
  const outgoingEdges = edges.filter(edge => edge.source === nodeId);
  const paths = outgoingEdges.map(edge => {
    const targetNode = nodes.find(n => n.id === edge.target);
    return {
      id: edge.id,
      label: targetNode ? targetNode.data.taskName || targetNode.data.label : `Node ${edge.target}`,
      targetNodeId: edge.target
    };
  });
  
  // 添加默認路徑選項
  paths.push({
    id: 'default',
    label: t ? t('workflowDesigner.defaultPath') : 'Default Path',
    targetNodeId: null
  });
  
  return paths;
};
