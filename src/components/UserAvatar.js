import React, { useState } from 'react';
import { Avatar, Dropdown, Menu } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import MyPreferencesModal from './MyPreferencesModal';

// props: userInfo = { name, avatar_url }
const UserAvatar = ({ userInfo }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleMenuClick = ({ key }) => {
    if (key === 'preferences') setModalVisible(true);
    // 這裡可擴充更多選單項目
  };

  const menu = (
    <Menu onClick={handleMenuClick}>
      <Menu.Item key="preferences">My Preferences</Menu.Item>
    </Menu>
  );

  const getInitial = () => {
    if (userInfo && userInfo.name) return userInfo.name.charAt(0).toUpperCase();
    return <UserOutlined />;
  };

  return (
    <>
      <Dropdown overlay={menu} placement="bottomLeft">
        <Avatar
          src={userInfo && userInfo.avatar_url ? userInfo.avatar_url : undefined}
          style={{ backgroundColor: '#87d068', cursor: 'pointer' }}
          size={40}
        >
          {!userInfo?.avatar_url && getInitial()}
        </Avatar>
      </Dropdown>
      <MyPreferencesModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        userInfo={userInfo}
      />
    </>
  );
};

export default UserAvatar; 