// 重構後的工作流程設計器頁面
// 使用分拆後的模塊組件

import React from 'react';
import { WhatsAppWorkflowDesigner } from '../components/WorkflowDesigner';

// 重構後的頁面組件，使用分拆的模塊
const WhatsAppWorkflowDesignerPage = () => {
  return <WhatsAppWorkflowDesigner />;
};

export default WhatsAppWorkflowDesignerPage;
