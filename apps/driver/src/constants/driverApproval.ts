export const DRIVER_PENDING_APPROVAL_MSG = '管理員未審批，不能接柯打、出貨或上線接單';

export function isDriverApproved(verificationStatus?: string | null): boolean {
  return verificationStatus === 'approved';
}

export function isDriverSuspended(profile?: {
  suspensionActive?: boolean;
} | null): boolean {
  return Boolean(profile?.suspensionActive);
}

export function driverDispatchBlockedMessage(profile?: {
  verificationStatus?: string | null;
  suspensionActive?: boolean;
  suspendedPermanent?: boolean;
  suspendedUntilHk?: string | null;
} | null): string | null {
  if (isDriverSuspended(profile)) {
    if (profile?.suspendedPermanent) {
      return '帳戶已被管理員永久停用，請聯絡客服。';
    }
    const until = profile?.suspendedUntilHk?.trim();
    return until
      ? `帳戶已被管理員停用至 ${until}，到期後可恢復接單。`
      : '帳戶已被管理員停用，暫不可接單。';
  }
  if (!isDriverApproved(profile?.verificationStatus)) {
    return '管理員未審批，不能接柯打、射柯打或上線接單';
  }
  return null;
}
