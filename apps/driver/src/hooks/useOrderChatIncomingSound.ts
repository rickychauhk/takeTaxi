import { useEffect, useRef } from 'react';
import type { OrderChatMessage } from '../api/orderChat';
import { playChatIncomingSound } from '../audio/chatIncomingSound';

/** 輪詢 Chat 時，為新收到的乘客訊息播放提示音（略過首次載入） */
export function useOrderChatIncomingSound(orderId: string, messages: OrderChatMessage[]) {
  const seenPassengerIds = useRef(new Set<string>());
  const primed = useRef(false);

  useEffect(() => {
    seenPassengerIds.current.clear();
    primed.current = false;
  }, [orderId]);

  useEffect(() => {
    const passengerMsgs = messages.filter((m) => m.senderRole === 'passenger');
    if (!primed.current) {
      for (const m of passengerMsgs) seenPassengerIds.current.add(m.id);
      primed.current = true;
      return;
    }
    let played = false;
    for (const m of passengerMsgs) {
      if (seenPassengerIds.current.has(m.id)) continue;
      seenPassengerIds.current.add(m.id);
      played = true;
    }
    if (played) void playChatIncomingSound();
  }, [messages]);
}
