import { Game } from 'phaser';

class SimpleScene extends Phaser.Scene {
  create() {
    this.add.text(400, 300, 'CYBERKID', {
      fontSize: '64px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.rectangle(400, 400, 100, 100, 0xff0000);
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: 800,
  height: 600,
  backgroundColor: '#0a0a2a',
  parent: 'game-container',
  scene: SimpleScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  audio: { noAudio: true },
};

new Game(config);
