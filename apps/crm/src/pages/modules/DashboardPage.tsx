import { Card, Col, Row, Statistic, Typography } from 'antd';

export default function DashboardPage() {
  return (
    <div>
      <Typography.Title level={4}>營運儀表板（UAT）</Typography.Title>
      <Typography.Paragraph type="secondary">
        車輛分佈、派單效率、Stripe/PayPal 對帳報表將在此擴展；API 已預留 maps / payments / locations 模組。
      </Typography.Paragraph>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="環境" value="UAT" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="域名" value="taxima.hkcodai.space" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="派單級別邏輯" value="管理員 2 秒 → 合作方 → 公海" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
