import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';

const { Title } = Typography;

const Dashboard = () => {
  const { t } = useLanguage();
  const [delivered, setDelivered] = useState(0);
  const [signedPending, setSignedPending] = useState(0);
  const [totalProcessed, setTotalProcessed] = useState(0);

  useEffect(() => {
    // TODO: 請根據後端 API 實際路徑調整
    axios.get('/api/DeliveryReceipt/count', { params: { uploadedBy: 'DeliveryMan', confirmed: 0 } })
      .then(res => setDelivered(res.data.count))
      .catch(() => setDelivered(0));
    axios.get('/api/DeliveryReceipt/count', { params: { uploadedBy: 'Customer', confirmed: 0 } })
      .then(res => setSignedPending(res.data.count))
      .catch(() => setSignedPending(0));
    axios.get('/api/DeliveryReceipt/count', { params: { uploadedBy: 'all', confirmed: 1 } })
      .then(res => setTotalProcessed(res.data.count))
      .catch(() => setTotalProcessed(0));
  }, []);

  // 假資料，待後端 API 完成後再串接
  const barData = {
    xAxis: ['2024-06-01', '2024-06-02', '2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07'],
    delivered: [5, 8, 6, 7, 4, 9, 10],
    signedPending: [2, 3, 1, 2, 2, 1, 0],
    totalProcessed: [1, 2, 3, 4, 5, 6, 7],
  };
  const barOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: [t('menu.unsigned'), t('menu.signedPending'), t('unsigned.totalProcessed')] },
    xAxis: { type: 'category', data: barData.xAxis },
    yAxis: { type: 'value' },
    series: [
      { name: t('menu.unsigned'), type: 'bar', stack: 'total', data: barData.delivered },
      { name: t('menu.signedPending'), type: 'bar', stack: 'total', data: barData.signedPending },
      { name: t('unsigned.totalProcessed'), type: 'bar', stack: 'total', data: barData.totalProcessed },
    ]
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>
        {t('menu.dashboard')}
      </Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('menu.unsigned')}
              value={delivered}
              prefix={<FileTextOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('menu.signedPending')}
              value={signedPending}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('unsigned.totalProcessed')}
              value={totalProcessed}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card title={t('menu.dashboardRecentActivity')}>
            <ReactECharts option={barOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 