import {
  AuditOutlined,
  CarOutlined,
  ControlOutlined,
  CommentOutlined,
  FileTextOutlined,
  GiftOutlined,
  MailOutlined,
  PictureOutlined,
  SettingOutlined,
  StarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WalletOutlined,
  AndroidOutlined,
} from '@ant-design/icons';
import { Card, Layout, Menu, Typography } from 'antd';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import AppTermsEditorPage from './pages/modules/AppTermsEditorPage';
import CompanyPriceNoticeEditorPage from './pages/modules/CompanyPriceNoticeEditorPage';
import RideTipsEditorPage from './pages/modules/RideTipsEditorPage';
import ContactUsEditorPage from './pages/modules/ContactUsEditorPage';
import DashboardPage from './pages/modules/DashboardPage';
import GenericListPage from './pages/modules/GenericListPage';
import MessagesPage from './pages/modules/MessagesPage';
import PromosPage from './pages/modules/PromosPage';
import AdsPage from './pages/modules/AdsPage';
import DriversPage from './pages/modules/DriversPage';
import PassengersPage from './pages/modules/PassengersPage';
import SettingsNewsPage from './pages/modules/SettingsNewsPage';
import SettingsPassengerPointsPage from './pages/modules/SettingsPassengerPointsPage';
import SettingsPassengerAutoTipPage from './pages/modules/SettingsPassengerAutoTipPage';
import SettingsDriverBusyHoursPage from './pages/modules/SettingsDriverBusyHoursPage';
import SettingsPassengerNearbyDriversPage from './pages/modules/SettingsPassengerNearbyDriversPage';
import SettingsDriverHallPriorityPage from './pages/modules/SettingsDriverHallPriorityPage';
import TopupApprovalPage from './pages/modules/TopupApprovalPage';
import SettingsDriverPointPackagesPage from './pages/modules/SettingsDriverPointPackagesPage';
import DriverAcceptanceRecordsPage from './pages/modules/DriverAcceptanceRecordsPage';
import PassengerOrderRecordsPage from './pages/modules/PassengerOrderRecordsPage';
import RatingsPage from './pages/modules/RatingsPage';
import AuditLogsPage from './pages/modules/AuditLogsPage';
import BookingOptionsPage from './pages/modules/BookingOptionsPage';
import LiveOrdersPage from './pages/modules/LiveOrdersPage';
import OrderChatQuickRepliesPage from './pages/modules/OrderChatQuickRepliesPage';
import AppReleasesPage from './pages/modules/AppReleasesPage';
import SettingsGeminiPage from './pages/modules/SettingsGeminiPage';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <AuditOutlined />, label: <Link to="/">儀表板</Link> },
  { key: '/live-orders', icon: <ThunderboltOutlined />, label: <Link to="/live-orders">即時柯打</Link> },
  { key: '/topups', icon: <WalletOutlined />, label: <Link to="/topups">積分購買審批</Link> },
  {
    key: '/driver-point-packages',
    icon: <WalletOutlined />,
    label: <Link to="/driver-point-packages">司機積分套餐</Link>,
  },
  { key: '/contact', icon: <MailOutlined />, label: <Link to="/contact">聯絡我們（網頁）</Link> },
  { key: '/app-terms', icon: <FileTextOutlined />, label: <Link to="/app-terms">App 使用條款</Link> },
  {
    key: '/company-price-notice',
    icon: <FileTextOutlined />,
    label: <Link to="/company-price-notice">公司價告示</Link>,
  },
  {
    key: '/ride-tips',
    icon: <FileTextOutlined />,
    label: <Link to="/ride-tips">搭車秘笈</Link>,
  },
  { key: '/feedbacks', icon: <CommentOutlined />, label: <Link to="/feedbacks">意見反饋</Link> },
  { key: '/news', icon: <SettingOutlined />, label: <Link to="/news">最新消息連結</Link> },
  {
    key: '/passenger-points',
    icon: <GiftOutlined />,
    label: <Link to="/passenger-points">乘客行程積分</Link>,
  },
  {
    key: '/passenger-auto-tip',
    icon: <GiftOutlined />,
    label: <Link to="/passenger-auto-tip">乘客自動貼士</Link>,
  },
  {
    key: '/passenger-nearby-drivers',
    icon: <CarOutlined />,
    label: <Link to="/passenger-nearby-drivers">乘客附近司機範圍</Link>,
  },
  {
    key: '/driver-busy-hours',
    icon: <SettingOutlined />,
    label: <Link to="/driver-busy-hours">司機繁忙時段</Link>,
  },
  {
    key: '/driver-hall-priority',
    icon: <CarOutlined />,
    label: <Link to="/driver-hall-priority">大廳優先秒數</Link>,
  },
  { key: '/messages', icon: <MailOutlined />, label: <Link to="/messages">訊息中心</Link> },
  { key: '/promos', icon: <GiftOutlined />, label: <Link to="/promos">優惠碼</Link> },
  { key: '/ads', icon: <PictureOutlined />, label: <Link to="/ads">廣告管理</Link> },
  { key: '/app-releases', icon: <AndroidOutlined />, label: <Link to="/app-releases">APK 發佈</Link> },
  { key: '/booking-options', icon: <ControlOutlined />, label: <Link to="/booking-options">叫車選項</Link> },
  {
    key: '/order-chat-quick-replies',
    icon: <CommentOutlined />,
    label: <Link to="/order-chat-quick-replies">乘客快捷訊息</Link>,
  },
  { key: '/drivers', icon: <CarOutlined />, label: <Link to="/drivers">司機</Link> },
  { key: '/passengers', icon: <TeamOutlined />, label: <Link to="/passengers">乘客</Link> },
  { key: '/order-records/drivers', icon: <CarOutlined />, label: <Link to="/order-records/drivers">司機接單紀錄</Link> },
  { key: '/order-records/passengers', icon: <TeamOutlined />, label: <Link to="/order-records/passengers">乘客落柯打</Link> },
  { key: '/ratings', icon: <StarOutlined />, label: <Link to="/ratings">評分</Link> },
  { key: '/audit', icon: <AuditOutlined />, label: <Link to="/audit">系統日誌</Link> },
  { key: '/gemini', icon: <SettingOutlined />, label: <Link to="/gemini">Gemini 設定</Link> },
];

function Shell() {
  const { token, admin, logout } = useAuth();
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div style={{ color: '#fff', padding: 16, fontWeight: 600 }}>搭的後台</div>
        <Menu theme="dark" mode="inline" selectedKeys={[loc.pathname]} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', paddingInline: 24 }}>
          <Typography.Text>{admin?.displayName ?? '管理員'} · UAT</Typography.Text>
          <Typography.Link onClick={logout}>登出</Typography.Link>
        </Header>
        <Content style={{ margin: 24 }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/live-orders" element={<LiveOrdersPage />} />
            <Route path="/topups" element={<TopupApprovalPage />} />
            <Route path="/driver-point-packages" element={<SettingsDriverPointPackagesPage />} />
            <Route path="/contact" element={<ContactUsEditorPage />} />
            <Route path="/app-terms" element={<AppTermsEditorPage />} />
            <Route path="/company-price-notice" element={<CompanyPriceNoticeEditorPage />} />
            <Route path="/ride-tips" element={<RideTipsEditorPage />} />
            <Route path="/feedbacks" element={<GenericListPage title="意見反饋" endpoint="/admin/feedbacks" />} />
            <Route path="/news" element={<SettingsNewsPage />} />
            <Route path="/passenger-points" element={<SettingsPassengerPointsPage />} />
            <Route path="/passenger-auto-tip" element={<SettingsPassengerAutoTipPage />} />
            <Route
              path="/passenger-nearby-drivers"
              element={<SettingsPassengerNearbyDriversPage />}
            />
            <Route path="/driver-busy-hours" element={<SettingsDriverBusyHoursPage />} />
            <Route path="/driver-hall-priority" element={<SettingsDriverHallPriorityPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/promos" element={<PromosPage />} />
            <Route path="/ads" element={<AdsPage />} />
            <Route path="/app-releases" element={<AppReleasesPage />} />
            <Route path="/booking-options" element={<BookingOptionsPage />} />
            <Route
              path="/order-chat-quick-replies"
              element={
                <Card>
                  <Typography.Title level={4}>乘客行程快捷訊息</Typography.Title>
                  <OrderChatQuickRepliesPage />
                </Card>
              }
            />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/passengers" element={<PassengersPage />} />
            <Route path="/users" element={<Navigate to="/drivers" replace />} />
            <Route path="/order-records/drivers" element={<DriverAcceptanceRecordsPage />} />
            <Route path="/order-records/passengers" element={<PassengerOrderRecordsPage />} />
            <Route path="/orders" element={<Navigate to="/order-records/passengers" replace />} />
            <Route path="/ratings" element={<RatingsPage />} />
            <Route path="/audit" element={<AuditLogsPage />} />
            <Route path="/gemini" element={<SettingsGeminiPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </AuthProvider>
  );
}
