import { deployUnavailableUserMessage } from '@taxima/shared';
import { apiFetch, apiUploadForm } from './client';

export type DriverPointPackage = {
  id: string;
  points: number;
  priceHkd: string;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
};

export async function fetchDriverPointPackages(): Promise<DriverPointPackage[]> {
  const res = await apiFetch('/driver/point-packages');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      deployUnavailableUserMessage(res.status, text) ||
        parseApiErrorMessage(text) ||
        `HTTP ${res.status}`,
    );
  }
  return (await res.json()) as DriverPointPackage[];
}

export type DriverTopupPaymentMethod = {
  id: string;
  title: string;
  detail: string;
};

export type DriverPointsTopupConfig = {
  instructions: string;
  paymentMethods: DriverTopupPaymentMethod[];
};

export async function fetchDriverPointsTopupConfig(): Promise<DriverPointsTopupConfig> {
  const res = await apiFetch('/public/driver-points-topup');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      deployUnavailableUserMessage(res.status, text) ||
        parseApiErrorMessage(text) ||
        `無法載入付款設定（HTTP ${res.status}）`,
    );
  }
  const data = (await res.json()) as {
    instructions?: string;
    paymentMethods?: DriverTopupPaymentMethod[];
  };
  const paymentMethods = Array.isArray(data.paymentMethods)
    ? data.paymentMethods.filter(
        (m) => m && typeof m.id === 'string' && typeof m.title === 'string',
      )
    : [];
  return {
    instructions: data.instructions?.trim() ?? '',
    paymentMethods: paymentMethods.map((m) => ({
      id: m.id.trim(),
      title: m.title.trim(),
      detail: typeof m.detail === 'string' ? m.detail.trim() : '',
    })),
  };
}

export type DriverPendingPointTopup = {
  id: string;
  amountPoints: number;
  priceHkd: string | null;
  bankName: string | null;
  createdAt: string;
  createdAtHk: string;
};

export type DriverPendingPointTopupsResponse = {
  items: DriverPendingPointTopup[];
  pendingCount: number;
  pendingPointsTotal: number;
};

export async function fetchDriverPendingPointTopups(): Promise<DriverPendingPointTopupsResponse> {
  const res = await apiFetch('/driver/point-topups/pending');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      deployUnavailableUserMessage(res.status, text) ||
        parseApiErrorMessage(text) ||
        `HTTP ${res.status}`,
    );
  }
  const data = (await res.json()) as DriverPendingPointTopupsResponse;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    pendingCount: Number(data.pendingCount) || 0,
    pendingPointsTotal: Number(data.pendingPointsTotal) || 0,
  };
}

export async function submitDriverPointTopup(input: {
  packageId: string;
  paymentMethodId: string;
  receiptUri: string;
  receiptFileName?: string;
  mimeType?: string;
}): Promise<void> {
  const form = new FormData();
  form.append('packageId', input.packageId);
  form.append('paymentMethodId', input.paymentMethodId);
  form.append(
    'receipt',
    {
      uri: input.receiptUri,
      name: input.receiptFileName ?? 'receipt.jpg',
      type: input.mimeType ?? 'image/jpeg',
    } as unknown as Blob,
  );

  const res = await apiUploadForm('/driver/point-topups', form);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      deployUnavailableUserMessage(res.status, text) ||
        parseApiErrorMessage(text) ||
        `HTTP ${res.status}`,
    );
  }
}

function parseApiErrorMessage(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  try {
    const j = JSON.parse(t) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join('，');
    if (typeof j.message === 'string') return j.message;
  } catch {
    /* plain text */
  }
  return t.length > 200 ? `${t.slice(0, 200)}…` : t;
}
