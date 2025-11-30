import React from 'react';
import { DatePicker, Space, Button } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import moment from 'moment';

const { RangePicker } = DatePicker;

/**
 * 報表日期範圍選擇器組件
 * 完全參考 WorkflowMonitorPage.js 的簡單實現
 */
const ReportDateRangePicker = ({ value, onChange }) => {
  const handleChange = (dates) => {
    if (onChange) {
      onChange(dates);
    }
  };

  const handleQuickSelect = (days) => {
    if (!onChange) return;
    
    const end = moment().endOf('day');
    const start = moment().subtract(days - 1, 'days').startOf('day');
    onChange([start, end]);
  };

  return (
    <Space>
      <RangePicker
        placeholder={['開始日期', '結束日期']}
        value={value}
        onChange={handleChange}
        style={{ width: 350 }}
      />
      <Button 
        icon={<CalendarOutlined />} 
        onClick={() => handleQuickSelect(1)}
        size="small"
      >
        今天
      </Button>
      <Button 
        onClick={() => handleQuickSelect(7)}
        size="small"
      >
        最近7天
      </Button>
    </Space>
  );
};

export default ReportDateRangePicker;

