import { Game } from 'phaser';
import { Preload } from './scenes/Preload';
import { MainMenu } from './scenes/MainMenu';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0a2a',
  scene: [Preload, MainMenu, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  audio: { noAudio: true },
};

new Game(config);
