import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let audioModeReady = false;

/** 短訊式提示音（行程 Chat 收到乘客訊息） */
export async function playChatIncomingSound(): Promise<void> {
  try {
    if (!audioModeReady) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      audioModeReady = true;
    }
    if (!player) {
      player = createAudioPlayer(require('../../assets/sounds/chat-incoming.wav'));
    }
    player.seekTo(0);
    player.play();
  } catch {
    /* 音效非關鍵路徑 */
  }
}
