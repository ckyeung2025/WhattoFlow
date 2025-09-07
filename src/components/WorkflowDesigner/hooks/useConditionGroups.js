import { useCallback } from 'react';

// 條件群組管理 Hook
export const useConditionGroups = (selectedNode, nodes, setNodes) => {
  const getCurrentConditionGroups = useCallback(() => {
    const currentNode = nodes.find(node => node.id === selectedNode?.id);
    return currentNode?.data?.conditionGroups || [];
  }, [selectedNode, nodes]);

  const updateConditionGroups = useCallback((newGroups) => {
    setNodes(prev => prev.map(node => 
      node.id === selectedNode?.id 
        ? { ...node, data: { ...node.data, conditionGroups: newGroups } }
        : node
    ));
  }, [selectedNode, setNodes]);

  const addConditionGroup = useCallback((group) => {
    const currentGroups = getCurrentConditionGroups();
    const newGroups = [...currentGroups, group];
    updateConditionGroups(newGroups);
    return newGroups.length - 1; // 返回新群組的索引
  }, [getCurrentConditionGroups, updateConditionGroups]);

  const updateConditionGroup = useCallback((groupIndex, group) => {
    const currentGroups = getCurrentConditionGroups();
    const newGroups = [...currentGroups];
    newGroups[groupIndex] = group;
    updateConditionGroups(newGroups);
  }, [getCurrentConditionGroups, updateConditionGroups]);

  const removeConditionGroup = useCallback((groupIndex) => {
    const currentGroups = getCurrentConditionGroups();
    const newGroups = currentGroups.filter((_, i) => i !== groupIndex);
    updateConditionGroups(newGroups);
  }, [getCurrentConditionGroups, updateConditionGroups]);

  return {
    getCurrentConditionGroups,
    updateConditionGroups,
    addConditionGroup,
    updateConditionGroup,
    removeConditionGroup
  };
};
