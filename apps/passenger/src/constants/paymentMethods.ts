export const PASSENGER_PAYMENT_METHODS = ['octopus', 'alipay', 'wechat', 'fps'] as const;

export type PassengerPaymentMethod = (typeof PASSENGER_PAYMENT_METHODS)[number];
