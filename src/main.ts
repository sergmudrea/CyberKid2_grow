import { Game } from 'phaser';
import { Preload } from './scenes/Preload';
import { MainMenu } from './scenes/MainMenu';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0a2a',
  scene: [Preload, MainMenu],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Game(config);
