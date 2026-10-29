import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  parseTripVoiceUtterance,
  type ParsedTripVoice,
} from '../location/parseTripVoiceUtterance';
import { voiceTranscriptToDigits } from '../voice/voiceTranscriptToDigits';

export type ShootPhoneVoiceField = 'owner' | 'passenger';

export type ShootVoiceListening =
  | { mode: 'trip' }
  | { mode: 'phone'; field: ShootPhoneVoiceField }
  | null;

type TripVoiceHandlers = {
  onPartial?: (parsed: ParsedTripVoice, rawTranscript: string) => void;
  onFinal?: (parsed: ParsedTripVoice, rawTranscript: string) => void | Promise<void>;
  /** 開始收聽起終點語音 */
  onTripSessionStart?: () => void;
  /** 起終點語音 session 結束（含手動停止） */
  onTripSessionEnd?: () => void;
};

type ActiveSession =
  | { mode: 'trip' }
  | { mode: 'phone'; field: ShootPhoneVoiceField; applyDigits: (digits: string) => void }
  | null;

async function ensureSpeechPermissions(): Promise<boolean> {
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
    Alert.alert('語音輸入', '此裝置不支援語音辨識');
    return false;
  }
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('語音輸入', '請允許麥克風及語音辨識權限');
    return false;
  }
  return true;
}

/** 出貨頁共用語音 session（起終點、貨主／客人電話不可同時收音）。 */
export function useShootOrderVoice(tripHandlers: TripVoiceHandlers) {
  const sessionRef = useRef<ActiveSession>(null);
  const [listening, setListening] = useState<ShootVoiceListening>(null);

  useSpeechRecognitionEvent('start', () => {
    /* listening state set before start() */
  });
  useSpeechRecognitionEvent('end', () => {
    const wasTrip = sessionRef.current?.mode === 'trip';
    sessionRef.current = null;
    setListening(null);
    if (wasTrip) tripHandlers.onTripSessionEnd?.();
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    Alert.alert('語音輸入', event.message || '無法使用語音辨識，請稍後再試');
  });
  useSpeechRecognitionEvent('result', (event) => {
    const session = sessionRef.current;
    if (!session) return;
    const raw = event.results[0]?.transcript?.trim() ?? '';
    if (!raw) return;

    if (session.mode === 'trip') {
      const parsed = parseTripVoiceUtterance(raw);
      if (event.isFinal) {
        void tripHandlers.onFinal?.(parsed, raw);
      } else {
        tripHandlers.onPartial?.(parsed, raw);
      }
      return;
    }

    const digits = voiceTranscriptToDigits(raw);
    if (digits) session.applyDigits(digits);
  });

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const startListening = useCallback(async (session: NonNullable<ActiveSession>) => {
    sessionRef.current = session;
    ExpoSpeechRecognitionModule.start({
      lang: 'zh-HK',
      interimResults: true,
      continuous: false,
    });
  }, []);

  const toggleTripVoice = useCallback(async () => {
    if (listening?.mode === 'trip') {
      stopListening();
      return;
    }
    if (listening) {
      stopListening();
    }
    if (!(await ensureSpeechPermissions())) return;
    setListening({ mode: 'trip' });
    tripHandlers.onTripSessionStart?.();
    await startListening({ mode: 'trip' });
  }, [listening, startListening, stopListening]);

  const togglePhoneVoice = useCallback(
    async (field: ShootPhoneVoiceField, applyDigits: (digits: string) => void) => {
      if (listening?.mode === 'phone' && listening.field === field) {
        stopListening();
        return;
      }
      if (listening) {
        stopListening();
      }
      if (!(await ensureSpeechPermissions())) return;
      setListening({ mode: 'phone', field });
      await startListening({ mode: 'phone', field, applyDigits });
    },
    [listening, startListening, stopListening],
  );

  return { listening, toggleTripVoice, togglePhoneVoice };
}
