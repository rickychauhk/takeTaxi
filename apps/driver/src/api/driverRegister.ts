import { apiFetch, apiUploadForm } from './client';

export type DriverRegisterPayload = {
  phone: string;
  offDutyPhone?: string;
  displayName: string;
  licenseNumber: string;
  vehiclePlate: string;
  vehiclePlateExpiry?: string;
  vehicleModel?: string;
  firstRegistrationDate?: string;
  promoCode?: string;
  bankName: string;
  bankAccountNumber: string;
};

export async function checkRegisterPhones(phone: string, offDutyPhone?: string) {
  const res = await apiFetch('/driver/register/check-phones', {
    method: 'POST',
    body: JSON.stringify({ phone, offDutyPhone: offDutyPhone || undefined }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as {
    available: boolean;
    field?: 'phone' | 'offDutyPhone';
    message?: string;
  };
}

export async function registerDriver(payload: DriverRegisterPayload) {
  const res = await apiFetch('/driver/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as {
    driver: { id: string };
    promoApplied: boolean;
    promoRejectReason?: string | null;
  };
}

export type DriverDocumentType = 'driving_license' | 'driver_id' | 'vehicle_registration';

export async function uploadDriverDocument(
  driverId: string,
  docType: DriverDocumentType,
  uri: string,
) {
  const form = new FormData();
  form.append('driverId', driverId);
  form.append('docType', docType);
  form.append('file', {
    uri,
    name: `${docType}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);
  const res = await apiUploadForm('/driver/documents/upload', form);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
