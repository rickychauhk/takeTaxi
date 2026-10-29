import { Alert, Button, Card, Checkbox, Form, Input, Space, Typography } from 'antd';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { loadRememberPhone, saveRememberPhone } from '../auth/session';
import { firebaseAuth } from '../firebase/config';
import { loginFlowErrorMessage } from '../firebase/authErrors';
import { antdHongKongPhoneRules, toE164HongKong } from '../firebase/phone';

function phoneForDisplay(e164: string): string {
  return e164.startsWith('+852') ? e164.slice(4) : e164;
}

export default function LoginPage() {
  const { token, loginWithFirebase } = useAuth();
  const [form] = Form.useForm();
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [phoneE164, setPhoneE164] = useState('');
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const { remember, phone } = loadRememberPhone();
    form.setFieldsValue({ phone, rememberPhone: remember });
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, [form]);

  if (token) return <Navigate to="/" replace />;

  async function ensureRecaptcha() {
    if (recaptchaRef.current) return recaptchaRef.current;
    recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'crm-recaptcha', {
      size: 'normal',
    });
    return recaptchaRef.current;
  }

  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', background: '#f5f5f5' }}>
      <Card style={{ width: 420 }}>
        <Typography.Title level={3}>搭的後台</Typography.Title>
        <Typography.Paragraph type="secondary">
          以已授權管理員電話 + SMS 驗證碼登入；同一裝置登入狀態保持 24 小時。
        </Typography.Paragraph>
        {err && <Alert type="error" message={err} style={{ marginBottom: 16 }} />}
        {step === 'phone' ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={async (v) => {
              setErr(null);
              setSending(true);
              try {
                const e164 = toE164HongKong(v.phone);
                await api.post('/admin/auth/check-phone', { phone: e164 });
                setPhoneE164(e164);
                saveRememberPhone(String(v.phone), Boolean(v.rememberPhone));
                const verifier = await ensureRecaptcha();
                confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, e164, verifier);
                setStep('otp');
              } catch (e) {
                recaptchaRef.current?.clear();
                recaptchaRef.current = null;
                setErr(loginFlowErrorMessage(e));
              } finally {
                setSending(false);
              }
            }}
          >
            <Form.Item
              name="phone"
              label="電話"
              rules={[...antdHongKongPhoneRules()]}
              extra="香港 8 位可直接輸入，例如 91234567"
            >
              <Input placeholder="91234567 或 +85291234567" />
            </Form.Item>
            <Form.Item name="rememberPhone" valuePropName="checked">
              <Checkbox>記住登入電話</Checkbox>
            </Form.Item>
            <div id="crm-recaptcha" style={{ marginBottom: 16 }} />
            <Button type="primary" htmlType="submit" block loading={sending}>
              發送驗證碼
            </Button>
          </Form>
        ) : (
          <Form
            layout="vertical"
            onFinish={async (v) => {
              setErr(null);
              setConfirming(true);
              try {
                const result = confirmationRef.current;
                if (!result) throw new Error('驗證已過期，請重新發送');
                await result.confirm(v.code);
                const idToken = await firebaseAuth.currentUser?.getIdToken(true);
                if (!idToken) throw new Error('無法取得 Firebase token');
                await loginWithFirebase(idToken);
              } catch (e) {
                setErr(loginFlowErrorMessage(e));
              } finally {
                setConfirming(false);
              }
            }}
          >
            <Typography.Paragraph>
              驗證碼已發送至 <Typography.Text strong>{phoneForDisplay(phoneE164)}</Typography.Text>
            </Typography.Paragraph>
            <Form.Item name="code" label="SMS 驗證碼" rules={[{ required: true, min: 4, max: 8 }]}>
              <Input inputMode="numeric" maxLength={6} placeholder="6 位數字" />
            </Form.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit" block loading={confirming}>
                確認登入
              </Button>
              <Button
                type="link"
                block
                onClick={() => {
                  setStep('phone');
                  confirmationRef.current = null;
                  recaptchaRef.current?.clear();
                  recaptchaRef.current = null;
                }}
              >
                改用其他電話
              </Button>
            </Space>
          </Form>
        )}
      </Card>
    </div>
  );
}
