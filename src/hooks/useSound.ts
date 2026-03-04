import { Howl } from 'howler';
import { useMemo } from 'react';

import { storage } from '../utils/storage';

// Sound playback helper that respects persisted sound settings.
interface SoundPack {
  move: Howl;
  capture: Howl;
  check: Howl;
  gameEnd: Howl;
}

const createSoundPack = (): SoundPack => {
  const create = (path: string): Howl =>
    new Howl({
      src: [path],
      volume: 0.8,
      preload: true,
      html5: false,
      onloaderror: (_id, error) => {
        console.error(`Sound load failed: ${path}`, error);
      },
    });

  return {
    move: create('/sounds/move.mp3'),
    capture: create('/sounds/capture.mp3'),
    check: create('/sounds/check.mp3'),
    gameEnd: create('/sounds/game-end.mp3'),
  };
};

export function useSound(): {
  playMove: () => void;
  playCapture: () => void;
  playCheck: () => void;
  playGameEnd: () => void;
} {
  const sounds = useMemo(() => createSoundPack(), []);

  const playIfEnabled = (sound: Howl): void => {
    const settings = storage.getSettings();
    if (!settings.soundEnabled) {
      return;
    }

    sound.play();
  };

  return {
    playMove: () => playIfEnabled(sounds.move),
    playCapture: () => playIfEnabled(sounds.capture),
    playCheck: () => playIfEnabled(sounds.check),
    playGameEnd: () => playIfEnabled(sounds.gameEnd),
  };
}
