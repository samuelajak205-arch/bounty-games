import { useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import useSoundPkg from 'use-sound';

const SOUNDS = {
  move: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
  capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
  check: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/check.mp3',
  gameEnd: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3',
};

export const useSound = () => {
  const { settings } = useSettings();
  const [playMove] = useSoundPkg(SOUNDS.move);
  const [playCapture] = useSoundPkg(SOUNDS.capture);
  const [playCheck] = useSoundPkg(SOUNDS.check);
  const [playGameEnd] = useSoundPkg(SOUNDS.gameEnd);

  const playSound = useCallback((type: keyof typeof SOUNDS) => {
    if (!settings.soundEnabled) {
      console.log('Sound disabled in settings');
      return;
    }

    console.log('Attempting to play sound:', type);
    switch (type) {
      case 'move': playMove(); break;
      case 'capture': playCapture(); break;
      case 'check': playCheck(); break;
      case 'gameEnd': playGameEnd(); break;
    }
  }, [settings.soundEnabled, playMove, playCapture, playCheck, playGameEnd]);

  return { playSound };
};
