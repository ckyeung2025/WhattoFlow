/**
 * 通用報表表格組件
 * 支持動態表單字段列
 */

import React, { useMemo } from 'react';
import { Table } from 'antd';
import { useDynamicColumns } from './DynamicFormColumns';

/**
 * 報表表格組件
 * @param {Object} props
 * @param {Array} props.dataSource - 數據源
 * @param {Array} props.baseColumns - 基礎列定義
 * @param {Object} props.tableProps - 傳遞給 Ant Design Table 的其他屬性
 */
const ReportTable = ({ dataSource = [], baseColumns = [], ...tableProps }) => {
  // 使用動態列 Hook
  const columns = useDynamicColumns(dataSource, baseColumns);

  // 計算所有列的總寬度，用於橫向滾動
  const totalWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      // 如果列有固定寬度，使用固定寬度；否則使用默認寬度 150
      const width = col.width || col.fixedWidth || 150;
      return sum + (typeof width === 'number' ? width : 150);
    }, 0);
  }, [columns]);

  // 設置滾動配置
  const scrollConfig = useMemo(() => {
    const config = {
      x: Math.max(totalWidth, 1200), // 最小寬度 1200px，確保有足夠空間顯示列
    };
    
    // 如果傳入了自定義 scroll 配置，合併它
    if (tableProps.scroll) {
      return {
        ...config,
        ...tableProps.scroll,
        // 確保 x 值不小於計算出的總寬度
        x: Math.max(config.x, tableProps.scroll.x || totalWidth)
      };
    }
    
    return config;
  }, [totalWidth, tableProps.scroll]);

  return (
    <Table
      dataSource={dataSource}
      columns={columns}
      rowKey={(record) => record.id || record.key || JSON.stringify(record)}
      scroll={scrollConfig}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 條記錄`,
        ...tableProps.pagination
      }}
      {...tableProps}
    />
  );
};

export default ReportTable;

