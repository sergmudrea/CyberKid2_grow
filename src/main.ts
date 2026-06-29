import { Game } from 'phaser';
import { Preload } from './scenes/Preload';
import { MainMenu } from './scenes/MainMenu';
import { WorldMap } from './scenes/WorldMap';
import { LevelSelect } from './scenes/LevelSelect';
import { GameScene } from './scenes/GameScene';
import { VictoryScreen } from './scenes/VictoryScreen';
import { SandboxScene } from './scenes/SandboxScene';
import { Stats } from './scenes/Stats';
import { Paywall } from './scenes/Paywall';
import { Settings } from './scenes/Settings';


const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0a2a',
  parent: 'game-container',
  scene: [Preload, MainMenu, WorldMap, LevelSelect, GameScene, VictoryScreen, SandboxScene, Stats, Paywall, Settings],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  audio: { noAudio: true },
};

new Game(config);
