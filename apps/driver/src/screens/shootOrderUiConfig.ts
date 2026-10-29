/** 出貨頁 UI 色（跟設計稿） */
export const SHOOT_UI = {
  inputBg: '#333333',
  inputText: '#ffffff',
  inputPlaceholder: '#aaaaaa',
  chipGrey: '#7F8C8D',
  chipGreyText: '#ffffff',
  chipOnBg: '#F4D03F',
  chipOnText: '#1a1a1a',
  chipOnBorder: '#ffffff',
  gold: '#F4D03F',
  blue: '#5D9CEC',
  green: '#58D68D',
  red: '#E53935',
  micBlue: '#42A5F5',
  scheduleGrey: '#757575',
  companyPurple: '#8E44AD',
} as const;

export type ShootDirectKind = 'chinSuchin' | 'nineTael' | 'setMeal' | 'company';

export const SHOOT_DIRECT_LABEL: Record<ShootDirectKind, string> = {
  chinSuchin: '千足金',
  nineTael: '九折',
  setMeal: '定食',
  company: '公司',
};

/** 定食直出、公司直出用公司價公式 */
export const SHOOT_DIRECT_COMPANY_PRICE_KINDS: ReadonlySet<ShootDirectKind> = new Set([
  'setMeal',
  'company',
]);

export type ShootDirectAction = {
  kind: ShootDirectKind;
  miniLabel: string;
  bottomLabel: string;
  backgroundColor: string;
  darkText?: boolean;
};

export const SHOOT_DIRECT_ACTIONS: ShootDirectAction[] = [
  {
    kind: 'chinSuchin',
    miniLabel: '千足直出',
    bottomLabel: '千足金 直出',
    backgroundColor: SHOOT_UI.gold,
    darkText: true,
  },
  {
    kind: 'nineTael',
    miniLabel: '九折直出',
    bottomLabel: '九折 直出',
    backgroundColor: SHOOT_UI.blue,
  },
  {
    kind: 'setMeal',
    miniLabel: '定食直出',
    bottomLabel: '定食 直出',
    backgroundColor: SHOOT_UI.green,
  },
  {
    kind: 'company',
    miniLabel: '公司直出',
    bottomLabel: '公司 直出',
    backgroundColor: SHOOT_UI.companyPurple,
  },
];

/** 灰色快捷掣 → booking option code（無則寫入備註） */
export const SHOOT_GRID_OPTION_CODES: Record<string, string | null> = {
  no_smoking: null,
  pet: null,
  tunnel_round: null,
  no_luggage: 'no_luggage_fee',
  hybrid: 'hybrid',
  seats_5: 'seats_5',
  seats_6: 'seats_6',
  wheelchair: 'wheelchair',
  electronic_pay: null,
  round_trip: null,
  tips: null,
  set_meal: null,
};

export const SHOOT_GRID_ROWS: { key: string; label: string }[][] = [
  [
    { key: 'electronic_pay', label: '電子支付' },
    { key: 'round_trip', label: '來回' },
    { key: 'tips', label: '免寵物費' },
    { key: 'set_meal', label: '等緊行李' },
  ],
  [
    { key: 'no_smoking', label: '無煙' },
    { key: 'pet', label: '寵物' },
    { key: 'tunnel_round', label: '來回隧道' },
    { key: 'no_luggage', label: '免行李費' },
  ],
  [
    { key: 'hybrid', label: '混能' },
    { key: 'seats_5', label: '五人車' },
    { key: 'seats_6', label: '六人車' },
    { key: 'wheelchair', label: '輪椅專車' },
  ],
];

/** 出貨頁「六人車」下方：接單司機接單時需扣的分數（完成後入帳出貨人） */
export const SHOOT_BOUNTY_ROW_LABEL = '柯打分數（接單人付）';
