import React from 'react';
import { Modal, Card, Button } from 'antd';

// 用戶選擇 Modal
const UserModal = ({ 
  visible, 
  onCancel, 
  users, 
  onSelectUser, 
  t 
}) => {
  return (
    <Modal
      title={t('workflowDesigner.selectUser')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={400}
    >
      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
        {users.map(user => (
          <Card
            key={user.id}
            size="small"
            style={{ marginBottom: 8, cursor: 'pointer' }}
            onClick={() => onSelectUser(user)}
            hoverable
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>{user.name}</h4>
                <p style={{ margin: '4px 0', color: '#666' }}>{user.phone}</p>
              </div>
              <Button type="primary" size="small">{t('workflowList.select')}</Button>
            </div>
          </Card>
        ))}
        {users.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            {t('workflowDesigner.noUsersAvailable')}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UserModal;
