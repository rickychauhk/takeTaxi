import * as Speech from 'expo-speech';
import { getNewOrderVoiceEnabled } from '../settings/driverNewOrderVoice';
import type { OrderOffer } from '../types/order';

function newOrderSpeechText(offer: OrderOffer): string {
  const pickup = offer.pickupLabel?.trim() || '上車點';
  const dropoff = offer.dropoffLabel?.trim() || '目的地';
  return `${pickup} 去 ${dropoff}`;
}

/** 新柯打廣東話語音（設定頁可關閉） */
export async function playNewOrderAlertIfEnabled(offer: OrderOffer): Promise<void> {
  const enabled = await getNewOrderVoiceEnabled();
  if (!enabled) return;
  Speech.stop();
  Speech.speak(newOrderSpeechText(offer), { language: 'zh-HK', rate: 1.0, pitch: 1.05 });
}

export async function stopNewOrderAlertSound(): Promise<void> {
  Speech.stop();
}
