import type { ParsedTripVoice } from '../location/parseTripVoiceUtterance';
import { useShootOrderVoice } from './useShootOrderVoice';

type UseShootVoiceInputOptions = {
  onPartial?: (parsed: ParsedTripVoice, rawTranscript: string) => void;
  onFinal?: (parsed: ParsedTripVoice, rawTranscript: string) => void | Promise<void>;
};

/** @deprecated 請改用 useShootOrderVoice */
export function useShootVoiceInput(options: UseShootVoiceInputOptions) {
  const { listening, toggleTripVoice } = useShootOrderVoice(options);
  return { listening: listening?.mode === 'trip', toggleVoiceInput: toggleTripVoice };
}
