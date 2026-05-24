import { Game } from 'phaser';
import { Preload } from './scenes/Preload';
import { MainMenu } from './scenes/MainMenu';
import { WorldMap } from './scenes/WorldMap';
import { LevelSelect } from './scenes/LevelSelect';
import { GameScene } from './scenes/GameScene';
import { VictoryScreen } from './scenes/VictoryScreen';


const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0a2a',
  parent: 'game-container',
  // В массив scene добавить VictoryScreen:
  scene: [Preload, MainMenu, WorldMap, LevelSelect, GameScene, VictoryScreen],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  audio: { noAudio: true },
};

new Game(config);
