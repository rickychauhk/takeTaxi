const METHOD_ZH: Record<string, string> = {
  get: '查詢',
  post: '新增',
  put: '更新',
  patch: '修改',
  delete: '刪除',
};

const RESOURCE_FUNCTION_ZH: Record<string, string> = {
  'audit-logs': '系統日誌',
  'point-topups': '積分購買審批',
  settings: '系統設定',
  'driver-point-packages': '司機積分套餐',
  drivers: '司機管理',
  passengers: '乘客管理',
  orders: '柯打管理',
  'order-records': '柯打紀錄',
  ads: '廣告管理',
  messages: '訊息中心',
  promos: '優惠碼',
  feedbacks: '意見反饋',
  ratings: '評分管理',
  'booking-options': '叫車選項',
  'booking-option-categories': '叫車選項分類',
  'mobile-app-releases': 'APK 發佈',
  'driver-busy-hours': '司機繁忙時段',
  'driver-busy-region-rewards': '地區獎賞設定',
  auth: '登入認證',
};

const SUB_ACTION_ZH: Record<string, string> = {
  approve: '批核',
  reject: '拒絕',
  deploy: '部署',
  download: '下載',
  status: '更新狀態',
  accept: '接單',
  'misaccept-cancel': '誤接取消',
  'driver_remove': '司機取消訂單',
  cancel: '取消',
  detail: '查看詳情',
};

const EXACT_ACTION_ZH: Record<string, { functionName: string; operationType: string }> = {
  'admin.login': { functionName: '登入', operationType: '密碼登入' },
  'admin.login.phone': { functionName: '登入', operationType: '電話登入' },
  'admin.login.firebase': { functionName: '登入', operationType: 'Firebase 登入' },
  'order.driver_remove': { functionName: '柯打管理', operationType: '司機取消訂單' },
  'order.release_to_hall': { functionName: '柯打管理', operationType: '司機放出柯打' },
  'order.passenger_release_to_hall': {
    functionName: '柯打管理',
    operationType: '乘客不等返回大廳',
  },
  'order.driver_accept_far_from_pickup': {
    functionName: '柯打管理',
    operationType: '司機接單距離上車點過遠',
  },
  'order.driver_accept_far_from_pickup.email_skipped': {
    functionName: '柯打管理',
    operationType: '接單過遠通知（電郵未送出）',
  },
  'driver.suspend.days': { functionName: '司機管理', operationType: '限期停用' },
  'driver.suspend.permanent': { functionName: '司機管理', operationType: '永久停用' },
  'driver.unsuspend': { functionName: '司機管理', operationType: '解除停用' },
};

function humanizeSegment(seg: string): string {
  if (!seg || seg.startsWith(':')) return '';
  return seg.replace(/-/g, ' ');
}

export function describeAuditLogAction(action: string): {
  functionName: string;
  operationType: string;
} {
  const exact = EXACT_ACTION_ZH[action];
  if (exact) return exact;

  const parts = action.split('.');
  if (parts[0] !== 'admin' || parts.length < 3) {
    return { functionName: '其他', operationType: action };
  }

  const method = parts[1];
  const routeParts = parts.slice(2);
  const adminIdx = routeParts[0] === 'admin' ? 1 : 0;
  const resourceKey = routeParts[adminIdx] ?? '';
  const tail = routeParts.slice(adminIdx + 1).filter((s) => s && !s.startsWith(':'));

  const functionName =
    RESOURCE_FUNCTION_ZH[resourceKey] ??
    (resourceKey ? humanizeSegment(resourceKey) : 'CRM 操作');

  const sub = tail.at(-1);
  if (sub && SUB_ACTION_ZH[sub]) {
    return { functionName, operationType: SUB_ACTION_ZH[sub] };
  }

  const methodZh = METHOD_ZH[method] ?? method.toUpperCase();
  return { functionName, operationType: methodZh };
}
