/** CRM 介面：英文代碼 → 繁中顯示 */

export function labelOrderStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待處理',
    matching: '配對中',
    accepted: '已接單',
    en_route: '前往接客',
    in_trip: '行程中',
    completed: '已完成',
    cancelled: '已取消',
  };
  return map[status] ?? status;
}

export function labelOrderType(type: string): string {
  const map: Record<string, string> = {
    instant: '即時',
    scheduled: '預約',
    multi_stop: '多站',
    blind_box: '盲盒',
    driver_posted: '司機發單',
  };
  return map[type] ?? type;
}

export function labelDriverTier(tier: string): string {
  const map: Record<string, string> = {
    admin: '管理員級',
    partner: '合作方',
    public: '公海',
  };
  return map[tier] ?? tier;
}

export function labelVerificationStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待審批',
    approved: '已審批',
    rejected: '已拒絕',
  };
  return map[status] ?? status;
}

export function labelSelectionMode(mode: string): string {
  const map: Record<string, string> = {
    single: '單選',
    multi: '多選',
  };
  return map[mode] ?? mode;
}

export function labelDisplayStyle(style: string): string {
  const map: Record<string, string> = {
    chip: '標籤按鈕',
    tunnel: '隧道圖示',
    vehicle: '車類圖示',
  };
  return map[style] ?? style;
}

export function labelScreenGroup(group: string): string {
  const map: Record<string, string> = {
    preferences: '偏好（隧道／停站等）',
    extras: '其他選項',
  };
  return map[group] ?? group;
}

export function labelAdTargetApp(target: string): string {
  const map: Record<string, string> = {
    passenger: '乘客 App',
    driver: '司機 App',
    both: '乘客與司機',
  };
  return map[target] ?? target;
}

export function labelRatingDirection(dir: string): string {
  const map: Record<string, string> = {
    passenger_to_driver: '乘客 → 司機',
    driver_to_passenger: '司機 → 乘客',
  };
  return map[dir] ?? dir;
}

export function labelActorType(actorType: string): string {
  const map: Record<string, string> = {
    admin: '管理員',
    driver: '司機',
    passenger: '乘客',
    system: '系統',
  };
  return map[actorType] ?? actorType;
}

export function labelTopupStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待審批',
    approved: '已批核',
    rejected: '已拒絕',
  };
  return map[status] ?? status;
}

/** 通用列表欄位名 → 中文表頭 */
export function labelDriverDocumentType(docType: string): string {
  const map: Record<string, string> = {
    driving_license: '行車證',
    driver_id: '司機證',
    vehicle_registration: '車輛登記文件',
    other: '其他文件',
  };
  return map[docType] ?? docType;
}

export function labelDocumentReviewStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待審批',
    approved: '已審批',
    rejected: '已拒絕',
  };
  return map[status] ?? status;
}

export function labelColumnKey(key: string): string {
  const map: Record<string, string> = {
    ID: '編號',
    id: '編號',
    email: '電郵',
    phone: '電話',
    code: '代碼',
    status: '狀態',
    new: '新',
    in_progress: '處理中',
    closed: '已結案',
    createdAt: '建立時間',
    updatedAt: '更新時間',
    message: '訊息',
    senderName: '姓名',
    senderPhone: '電話',
    subject: '主旨',
    body: '內容',
    title: '標題',
    name: '名稱',
    type: '類型',
    action: '操作類型',
    description: '說明',
  };
  return map[key] ?? key;
}
