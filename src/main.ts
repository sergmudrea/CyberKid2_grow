import { Game } from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: 800,
  height: 600,
  backgroundColor: '#0a0a2a',
  parent: 'game-container',
  scene: {
    create: function() {
      this.add.text(400, 300, 'CYBERKID', {
        fontSize: '64px',
        color: '#ffffff'
      }).setOrigin(0.5);
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  audio: { noAudio: true },
};

new Game(config);
