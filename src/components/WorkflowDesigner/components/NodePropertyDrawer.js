import React, { useEffect, useMemo, useCallback } from 'react';
import { Drawer, Form, Input, Select, Card, Button, Space, Tag } from 'antd';
import { FormOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import ProcessVariableSelect from './ProcessVariableSelect';
import RecipientModal from '../modals/RecipientModal';
import { getAvailableOutputPaths } from '../utils';

// 節點屬性編輯抽屜組件
const NodePropertyDrawer = ({
  selectedNode,
  drawerOpen,
  setDrawerOpen,
  form,
  handleNodeDataChange,
  processVariables,
  nodes,
  edges,
  t,
  // 模態框狀態
  isTemplateModalVisible,
  setIsTemplateModalVisible,
  isUserModalVisible,
  setIsUserModalVisible,
  isEFormModalVisible,
  setIsEFormModalVisible,
  isRecipientModalVisible,
  setIsRecipientModalVisible,
  // 條件相關狀態
  conditionModalVisible,
  setConditionModalVisible,
  conditionGroupModalVisible,
  setConditionGroupModalVisible,
  defaultPathModalVisible,
  setDefaultPathModalVisible,
  editingCondition,
  setEditingCondition,
  editingConditionGroup,
  setEditingConditionGroup,
  conditionForm,
  conditionGroupForm,
  // 處理函數
  handleSelectTemplate,
  handleSelectUser,
  handleSelectEForm,
  onSaveConditionGroup,
  onEditCondition,
  onAddCondition,
  onDeleteCondition,
  onSelectPath,
}) => {
  // 當 selectedNode 改變時，更新 Form 的字段值
  useEffect(() => {
    if (selectedNode && form) {
      // 重置表單並設置新的初始值
      form.resetFields();
      form.setFieldsValue({
        taskName: selectedNode.data.taskName || selectedNode.data.label,
        to: selectedNode.data.to || '',
        message: selectedNode.data.message || '',
        templateName: selectedNode.data.templateName || '',
        timeout: selectedNode.data.timeout || '',
        sql: selectedNode.data.sql || '',
        url: selectedNode.data.url || '',
        formName: selectedNode.data.formName || '',
        result: selectedNode.data.result || '',
        replyType: selectedNode.data.replyType || '',
        specifiedUsers: selectedNode.data.specifiedUsers || '',
        qrCodeVariable: selectedNode.data.qrCodeVariable || '',
        qrCodeSuccessMessage: selectedNode.data.qrCodeSuccessMessage || 'QR Code 掃描成功！流程將繼續執行。',
        qrCodeErrorMessage: selectedNode.data.qrCodeErrorMessage || '無法處理您上傳的圖片，請重新上傳。',
        approvalResultVariable: selectedNode.data.approvalResultVariable || '',
        activationType: selectedNode.data.activationType || 'manual',
        webhookToken: selectedNode.data.webhookToken || '',
        scheduledTable: selectedNode.data.scheduledTable || '',
        scheduledQuery: selectedNode.data.scheduledQuery || '',
        scheduledInterval: selectedNode.data.scheduledInterval || 300,
        validation: selectedNode.data.validation || {},
        ...selectedNode.data
      });
    }
  }, [selectedNode?.id, form]); // 只依賴 selectedNode.id，而不是整個 selectedNode 對象

  // 優化 onValuesChange 處理函數
  const handleFormValuesChange = useCallback((changedValues, allValues) => {
    // 只更新非 taskName 字段，taskName 使用 onBlur 事件處理
    const { taskName, ...otherValues } = changedValues;
    if (Object.keys(otherValues).length > 0) {
      // 使用 setTimeout 來避免在輸入過程中觸發重新渲染
      setTimeout(() => {
        handleNodeDataChange(otherValues);
      }, 0);
    }
  }, [handleNodeDataChange]);

  if (!selectedNode) return null;

  return (
    <Drawer
      title={selectedNode ? t(`workflowDesigner.${selectedNode.data.type}Node`) : ''}
      placement="right"
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      width={340}
    >
      {selectedNode && selectedNode.data.type !== 'start' && (
        <Form
          form={form}
          key={selectedNode.id}
          layout="vertical"
          onValuesChange={handleFormValuesChange}
        >
          <Form.Item label={t('workflowDesigner.taskNameLabel')} name="taskName">
            <Input 
              placeholder={t('workflowDesigner.taskNamePlaceholder')}
              onBlur={(e) => {
                const value = e.target.value;
                if (value !== selectedNode.data.taskName) {
                  handleNodeDataChange({ taskName: value });
                }
              }}
            />
          </Form.Item>
          
          {/* 發送 WhatsApp 消息節點 */}
          {selectedNode.data.type === 'sendWhatsApp' && (
            <>
              <Form.Item label={t('workflow.to')}>
                <Input 
                  value={selectedNode.data.to || ''}
                  placeholder={t('workflowDesigner.selectRecipients')}
                  readOnly
                  onClick={() => setIsRecipientModalVisible(true)}
                  suffix={
                    <Space>
                      {selectedNode.data.to && (
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeDataChange({ to: '' });
                          }}
                        >
                          {t('workflowDesigner.clear')}
                        </Button>
                      )}
                      <Button 
                        type="text" 
                        size="small" 
                        onClick={() => setIsRecipientModalVisible(true)}
                      >
                        {t('workflowDesigner.selectRecipients')}
                      </Button>
                    </Space>
                  }
                  style={{
                    color: selectedNode.data.to ? '#000' : '#999',
                    backgroundColor: selectedNode.data.to ? '#fff' : '#f5f5f5',
                    width: '100%',
                    minWidth: '300px'
                  }}
                />
              </Form.Item>
              <Form.Item label={t('workflow.message')} name="message">
                <Input.TextArea 
                  rows={3} 
                  placeholder={t('workflowDesigner.messageWithVariablesPlaceholder')}
                />
              </Form.Item>
              {processVariables && processVariables.length > 0 && (
                <Form.Item label={t('workflowDesigner.availableVariables')}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {t('workflowDesigner.variableSyntaxHelp')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {processVariables.map(pv => (
                      <Tag 
                        key={pv.id} 
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const currentValue = form.getFieldValue('message') || '';
                          const newValue = currentValue + `\${${pv.variableName}}`;
                          form.setFieldValue('message', newValue);
                          handleNodeDataChange({ message: newValue });
                        }}
                      >
                        {pv.variableName} ({pv.dataType})
                      </Tag>
                    ))}
                  </div>
                </Form.Item>
              )}
            </>
          )}

          {/* 發送 WhatsApp 模板節點 */}
          {selectedNode.data.type === 'sendWhatsAppTemplate' && (
            <>
              <Form.Item label={t('workflow.to')}>
                <Input 
                  value={selectedNode.data.to || ''}
                  placeholder={t('workflowDesigner.selectRecipients')}
                  readOnly
                  onClick={() => setIsRecipientModalVisible(true)}
                  suffix={
                    <Space>
                      {selectedNode.data.to && (
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeDataChange({ to: '' });
                          }}
                        >
                          {t('workflowDesigner.clear')}
                        </Button>
                      )}
                      <Button 
                        type="text" 
                        size="small" 
                        onClick={() => setIsRecipientModalVisible(true)}
                      >
                        {t('workflowDesigner.selectRecipients')}
                      </Button>
                    </Space>
                  }
                  style={{
                    color: selectedNode.data.to ? '#000' : '#999',
                    backgroundColor: selectedNode.data.to ? '#fff' : '#f5f5f5',
                    width: '100%',
                    minWidth: '300px'
                  }}
                />
              </Form.Item>
              <Form.Item label="模板">
                <Input 
                  value={selectedNode.data.templateName || ''}
                  placeholder={t('workflowDesigner.selectTemplate')} 
                  readOnly 
                  onClick={() => setIsTemplateModalVisible(true)}
                  suffix={<FormOutlined />}
                />
              </Form.Item>
              {selectedNode.data.templateId && (
                <Card size="small" title={t('workflowDesigner.templateInfo')} style={{ marginBottom: 16 }}>
                  <p><strong>{t('workflowDesigner.templateId')}</strong>{selectedNode.data.templateId}</p>
                  <p><strong>{t('workflowDesigner.templateName')}</strong>{selectedNode.data.templateName}</p>
                </Card>
              )}
            </>
          )}

          {/* 等待回覆節點 */}
          {selectedNode.data.type === 'waitReply' && (
            <>
              <Form.Item label={t('workflowDesigner.replyType')} name="replyType">
                <Select
                  options={[
                    { value: 'initiator', label: t('workflowDesigner.initiator') },
                    { value: 'specified', label: t('workflowDesigner.specifiedPerson') }
                  ]}
                />
              </Form.Item>
              
              {selectedNode.data.replyType === 'specified' && (
                <Form.Item label={t('workflowDesigner.specifiedPerson')}>
                  <Input 
                    value={selectedNode.data.specifiedUsers || ''}
                    placeholder={t('workflowDesigner.selectRecipients')} 
                    readOnly 
                    onClick={() => setIsRecipientModalVisible(true)}
                    suffix={
                      <Space>
                        {selectedNode.data.specifiedUsers && (
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNodeDataChange({ specifiedUsers: '' });
                            }}
                          >
                            {t('workflowList.clear')}
                          </Button>
                        )}
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={() => setIsRecipientModalVisible(true)}
                        >
                          {t('workflowDesigner.selectRecipients')}
                        </Button>
                      </Space>
                    }
                    style={{
                      color: selectedNode.data.specifiedUsers ? '#000' : '#999',
                      backgroundColor: selectedNode.data.specifiedUsers ? '#fff' : '#f5f5f5',
                      width: '100%',
                      minWidth: '300px'
                    }}
                  />
                </Form.Item>
              )}
              
              <Form.Item label={t('workflowDesigner.promptMessage')} name="message">
                <Input.TextArea 
                  rows={3} 
                  placeholder={t('workflowDesigner.waitReplyMessagePlaceholder')}
                />
              </Form.Item>
              {processVariables && processVariables.length > 0 && (
                <Form.Item label={t('workflowDesigner.availableVariables')}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {t('workflowDesigner.variableSyntaxHelp')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {processVariables.map(pv => (
                      <Tag 
                        key={pv.id} 
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const currentValue = form.getFieldValue('message') || '';
                          const newValue = currentValue + `\${${pv.variableName}}`;
                          form.setFieldValue('message', newValue);
                          handleNodeDataChange({ message: newValue });
                        }}
                      >
                        {pv.variableName} ({pv.dataType})
                      </Tag>
                    ))}
                  </div>
                </Form.Item>
              )}
              <Form.Item label={t('workflowDesigner.validationConfig')}>
                <Card size="small" title={t('workflowDesigner.validationSettings')} style={{ marginBottom: 16 }}>
                  <Form.Item label={t('workflowDesigner.enableValidation')} name={['validation', 'enabled']}>
                    <Select
                      options={[
                        { value: true, label: t('workflowDesigner.yes') },
                        { value: false, label: t('workflowDesigner.no') }
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.validatorType')} name={['validation', 'validatorType']}>
                    <Select
                      options={[
                        { value: 'default', label: t('workflowDesigner.defaultValidator') },
                        { value: 'custom', label: t('workflowDesigner.customValidator') },
                        { value: 'openai', label: t('workflowDesigner.openaiValidation') },
                        { value: 'xai', label: t('workflowDesigner.xaiValidation') }
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.promptText')} name={['validation', 'prompt']}>
                    <Input placeholder={t('workflowDesigner.dateFormatExample')} />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.retryMessage')} name={['validation', 'retryMessage']}>
                    <Input placeholder={t('workflowDesigner.formatExample')} />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.maxRetries')} name={['validation', 'maxRetries']}>
                    <Input type="number" min="1" max="10" />
                  </Form.Item>
                </Card>
              </Form.Item>
              <Card size="small" title={t('workflowDesigner.functionDescription')} style={{ marginTop: 16 }}>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.waitReplyDescription1')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.waitReplyDescription2')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.waitReplyDescription3')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                  {t('workflowDesigner.waitReplyDescription4')}
                </p>
              </Card>
            </>
          )}

          {/* 等待 QR Code 節點 */}
          {selectedNode.data.type === 'waitForQRCode' && (
            <>
              <Form.Item label={t('workflowDesigner.qrCodeVariable')} name="qrCodeVariable">
                <Select
                  placeholder={t('workflowDesigner.selectProcessVariable')}
                  allowClear
                >
                  {processVariables.map(pv => (
                    <Select.Option key={pv.id} value={pv.variableName}>
                      {pv.variableName} ({pv.dataType})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Form.Item label={t('workflowDesigner.promptMessage')} name="message">
                <Input.TextArea 
                  rows={3} 
                  placeholder={t('workflowDesigner.qrCodeMessagePlaceholder')}
                />
              </Form.Item>
              {processVariables && processVariables.length > 0 && (
                <Form.Item label={t('workflowDesigner.availableVariables')}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {t('workflowDesigner.variableSyntaxHelp')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {processVariables.map(pv => (
                      <Tag 
                        key={pv.id} 
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const currentValue = form.getFieldValue('message') || '';
                          const newValue = currentValue + `\${${pv.variableName}}`;
                          form.setFieldValue('message', newValue);
                          handleNodeDataChange({ message: newValue });
                        }}
                      >
                        {pv.variableName} ({pv.dataType})
                      </Tag>
                    ))}
                  </div>
                </Form.Item>
              )}
              
              <Form.Item label={t('workflowDesigner.timeout')} name="timeout">
                <Input 
                  type="number" 
                  placeholder="300" 
                  addonAfter={t('workflowDesigner.seconds')}
                />
              </Form.Item>
              
              <Form.Item label={t('workflowDesigner.qrCodeSuccessMessage')} name="qrCodeSuccessMessage">
                <Input.TextArea 
                  rows={2} 
                  placeholder="QR Code 掃描成功！流程將繼續執行。"
                />
              </Form.Item>
              
              <Form.Item label={t('workflowDesigner.qrCodeErrorMessage')} name="qrCodeErrorMessage">
                <Input.TextArea 
                  rows={2} 
                  placeholder="無法處理您上傳的圖片，請重新上傳。"
                />
              </Form.Item>
              
              <Card size="small" title={t('workflowDesigner.functionDescription')} style={{ marginTop: 16 }}>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.qrCodeDescription1')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.qrCodeDescription2')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                  {t('workflowDesigner.qrCodeDescription3')}
                </p>
              </Card>
            </>
          )}

          {/* 數據庫查詢節點 */}
          {selectedNode.data.type === 'dbQuery' && (
            <Form.Item label={t('workflow.sql')} name="sql">
              <Input.TextArea rows={3} />
            </Form.Item>
          )}

          {/* API 調用節點 */}
          {selectedNode.data.type === 'callApi' && (
            <Form.Item label={t('workflow.apiUrl')} name="url">
              <Input />
            </Form.Item>
          )}
          
          {/* 表單節點 */}
          {selectedNode.data.type === 'sendEForm' && (
            <>
              <Form.Item label={t('workflowDesigner.selectForm')}>
                <Input 
                  value={selectedNode.data.formName || ''}
                  placeholder={t('workflowDesigner.selectEFormPlaceholder')} 
                  readOnly 
                  onClick={() => setIsEFormModalVisible(true)}
                  suffix={
                    <Space>
                      {selectedNode.data.formName && (
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeDataChange({ 
                              formName: '', 
                              formId: '', 
                              formDescription: '' 
                            });
                          }}
                        >
                          {t('workflowList.clear')}
                        </Button>
                      )}
                      <Button 
                        type="text" 
                        size="small" 
                        onClick={() => setIsEFormModalVisible(true)}
                      >
                        {t('workflowDesigner.selectForm')}
                      </Button>
                    </Space>
                  }
                  style={{
                    color: selectedNode.data.formName ? '#000' : '#999',
                    backgroundColor: selectedNode.data.formName ? '#fff' : '#f5f5f5',
                    width: '100%',
                    minWidth: '300px'
                  }}
                />
              </Form.Item>
              
              <Form.Item label={t('workflow.to')}>
                <Input 
                  value={selectedNode.data.to || ''}
                  placeholder={t('workflowDesigner.selectRecipients')}
                  readOnly
                  onClick={() => setIsRecipientModalVisible(true)}
                  suffix={
                    <Space>
                      {selectedNode.data.to && (
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeDataChange({ to: '' });
                          }}
                        >
                          {t('workflowDesigner.clear')}
                        </Button>
                      )}
                      <Button 
                        type="text" 
                        size="small" 
                        onClick={() => setIsRecipientModalVisible(true)}
                      >
                        {t('workflowDesigner.selectRecipients')}
                      </Button>
                    </Space>
                  }
                  style={{
                    color: selectedNode.data.to ? '#000' : '#999',
                    backgroundColor: selectedNode.data.to ? '#fff' : '#f5f5f5',
                    width: '100%',
                    minWidth: '300px'
                  }}
                />
              </Form.Item>
              
              {selectedNode.data.formId && (
                <Card size="small" title={t('workflowDesigner.formInfo')} style={{ marginBottom: 16 }}>
                  <p><strong>{t('workflowDesigner.formId')}</strong>{selectedNode.data.formId}</p>
                  <p><strong>{t('workflowDesigner.formName')}</strong>{selectedNode.data.formName}</p>
                  {selectedNode.data.formDescription && (
                    <p><strong>{t('workflowDesigner.formDescription')}</strong>{selectedNode.data.formDescription}</p>
                  )}
                </Card>
              )}
              
              <Form.Item label={t('workflowDesigner.approvalResultVariable')} name="approvalResultVariable">
                <Select
                  placeholder={t('workflowDesigner.selectApprovalResultVariable')}
                  allowClear
                >
                  {processVariables.map(pv => (
                    <Select.Option key={pv.id} value={pv.variableName}>
                      {pv.variableName} ({pv.dataType})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Card size="small" title={t('workflowDesigner.functionDescription')} style={{ marginTop: 16 }}>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.eFormDescription1')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.eFormDescription2')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.eFormDescription3')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.eFormDescription4')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.eFormDescription5')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.eFormDescription6')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                  {t('workflowDesigner.eFormDescription7')}
                </p>
              </Card>
            </>
          )}
          
          {/* 條件分支節點 */}
          {selectedNode.data.type === 'switch' && (
            <>
              <Form.Item label={t('workflowDesigner.conditionGroups')}>
                <div style={{ marginBottom: '8px' }}>
                  <Button 
                    type="dashed" 
                    onClick={() => {
                      const newGroup = {
                        id: `group${Date.now()}`,
                        relation: 'and',
                        conditions: [],
                        outputPath: '',
                        groupIndex: -1
                      };
                      setEditingConditionGroup(newGroup);
                      setConditionGroupModalVisible(true);
                    }}
                    style={{ width: '100%' }}
                  >
                    {t('workflowDesigner.addConditionGroup')}
                  </Button>
                </div>
                {(() => {
                  const currentNode = nodes.find(node => node.id === selectedNode?.id);
                  const currentConditionGroups = currentNode?.data?.conditionGroups || [];
                  return currentConditionGroups.map((group, groupIndex) => (
                    <Card 
                      key={group.id} 
                      size="small" 
                      style={{ 
                        marginBottom: '8px', 
                        border: '1px solid #d9d9d9',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setEditingConditionGroup({ ...group, groupIndex });
                        setConditionGroupModalVisible(true);
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                            {t('workflowDesigner.conditionGroup')} {groupIndex + 1}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            {t('workflowDesigner.conditions')}: {group.conditions?.length || 0}
                            {group.relation && ` • ${group.relation.toUpperCase()}`}
                          </div>
                          {group.conditions && group.conditions.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#999' }}>
                              {group.conditions.slice(0, 2).map(condition => 
                                `${condition.variableName} ${condition.operator} ${condition.value}`
                              ).join(', ')}
                              {group.conditions.length > 2 && ` +${group.conditions.length - 2} more`}
                            </div>
                          )}
                          {group.outputPath && selectedNode && (
                            <div style={{ fontSize: '11px', color: '#1890ff', marginTop: '2px' }}>
                              → {getAvailableOutputPaths(selectedNode.id, edges, nodes, t).find(p => p.id === group.outputPath)?.label || group.outputPath}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <Button 
                            type="text" 
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingConditionGroup({ ...group, groupIndex });
                              setConditionGroupModalVisible(true);
                            }}
                          />
                          <Button 
                            type="text" 
                            danger 
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentNode = nodes.find(node => node.id === selectedNode?.id);
                              const currentGroups = currentNode?.data?.conditionGroups || [];
                              const newGroups = currentGroups.filter((_, i) => i !== groupIndex);
                              handleNodeDataChange({ conditionGroups: newGroups });
                            }}
                          />
                        </div>
                      </div>
                    </Card>
                  ));
                })()}
              </Form.Item>
              
              <Form.Item label={t('workflowDesigner.defaultPath')}>
                <div style={{ 
                  padding: '8px 12px', 
                  border: '1px solid #d9d9d9', 
                  borderRadius: '6px',
                  backgroundColor: '#fafafa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setDefaultPathModalVisible(true);
                }}
                >
                  {selectedNode?.data?.defaultPath ? (
                    <span style={{ color: '#1890ff' }}>
                      → {selectedNode && getAvailableOutputPaths(selectedNode.id, edges, nodes, t).find(p => p.id === selectedNode.data.defaultPath)?.label || selectedNode?.data?.defaultPath}
                    </span>
                  ) : (
                    <span style={{ color: '#999' }}>
                      {t('workflowDesigner.clickToSelectDefaultPath')}
                    </span>
                  )}
                </div>
              </Form.Item>
              
              <Card size="small" title={t('workflowDesigner.functionDescription')} style={{ marginTop: 16 }}>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.switchDescription1')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0' }}>
                  {t('workflowDesigner.switchDescription2')}
                </p>
                <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                  {t('workflowDesigner.switchDescription3')}
                </p>
              </Card>
            </>
          )}
        </Form>
      )}
      
      {/* Start 節點屬性 */}
      {selectedNode && selectedNode.data.type === 'start' && (
        <div style={{ color: '#888' }}>
          <Form
            form={form}
            key={selectedNode.id}
            layout="vertical"
            onValuesChange={handleFormValuesChange}
          >
            <Form.Item label={t('workflowDesigner.taskNameLabel')} name="taskName">
              <Input 
                placeholder={t('workflowDesigner.taskNamePlaceholder')}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value !== selectedNode.data.taskName) {
                    handleNodeDataChange({ taskName: value });
                  }
                }}
              />
            </Form.Item>
            
            <h4>{t('workflowDesigner.activationConfig')}</h4>
            <Form.Item label={t('workflowDesigner.activationType')} name="activationType">
              <Select
                options={[
                  { value: 'manual', label: t('workflowDesigner.manualActivation') },
                  { value: 'webhook', label: t('workflowDesigner.metaWebhookCall') },
                  { value: 'scheduled', label: t('workflowDesigner.scheduledTableWatch') }
                ]}
              />
            </Form.Item>
            
            {selectedNode.data.activationType === 'webhook' && (
              <>
                <Form.Item label={t('workflowDesigner.webhookToken')} name="webhookToken">
                  <Input placeholder={t('workflowDesigner.webhookTokenPlaceholder')} />
                </Form.Item>
                <Card size="small" title={t('workflowDesigner.webhookInfo')} style={{ marginTop: 16 }}>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.webhookDescription1')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.webhookDescription2')}
                  </p>
                </Card>
              </>
            )}
            
            {selectedNode.data.activationType === 'scheduled' && (
              <>
                <Form.Item label={t('workflowDesigner.scheduledTable')} name="scheduledTable">
                  <Input placeholder={t('workflowDesigner.scheduledTablePlaceholder')} />
                </Form.Item>
                <Form.Item label={t('workflowDesigner.scheduledQuery')} name="scheduledQuery">
                  <Input.TextArea rows={3} placeholder={t('workflowDesigner.scheduledQueryPlaceholder')} />
                </Form.Item>
                <Form.Item label={t('workflowDesigner.scheduledInterval')} name="scheduledInterval">
                  <Input 
                    type="number" 
                    placeholder="300" 
                    addonAfter={t('workflowDesigner.seconds')}
                  />
                </Form.Item>
                <Card size="small" title={t('workflowDesigner.scheduledInfo')} style={{ marginTop: 16 }}>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.scheduledDescription1')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.scheduledDescription2')}
                  </p>
                </Card>
              </>
            )}
          </Form>
        </div>
      )}

      {/* 收件人選擇模態框 */}
      <RecipientModal
        visible={isRecipientModalVisible}
        onCancel={() => setIsRecipientModalVisible(false)}
        onSelect={(value, detailedValue) => {
          console.log('📤 NodePropertyDrawer - 收到選擇值:', value);
          console.log('📤 NodePropertyDrawer - 收到詳細值:', detailedValue);
          // 根據節點類型更新對應的字段
          if (selectedNode.data.type === 'sendWhatsApp' || selectedNode.data.type === 'sendWhatsAppTemplate' || selectedNode.data.type === 'sendEForm') {
            // 保存電話號碼字符串到 to 字段
            handleNodeDataChange({ to: value });
            // 保存詳細信息到 recipientDetails 字段
            if (detailedValue) {
              handleNodeDataChange({ recipientDetails: detailedValue });
            }
          } else if (selectedNode.data.type === 'waitReply') {
            // 保存電話號碼字符串到 specifiedUsers 字段
            handleNodeDataChange({ specifiedUsers: value });
            // 保存詳細信息到 recipientDetails 字段
            if (detailedValue) {
              handleNodeDataChange({ recipientDetails: detailedValue });
            }
          }
        }}
        value={
          selectedNode.data.type === 'sendWhatsApp' || selectedNode.data.type === 'sendWhatsAppTemplate' || selectedNode.data.type === 'sendEForm'
            ? selectedNode.data.to 
            : selectedNode.data.specifiedUsers
        }
        recipientDetails={selectedNode.data.recipientDetails}
        allowMultiple={true}
        placeholder={t('workflowDesigner.selectRecipients')}
      />
    </Drawer>
  );
};

export default React.memo(NodePropertyDrawer);
