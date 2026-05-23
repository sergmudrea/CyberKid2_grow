import { Game } from 'phaser';

class SimpleScene extends Phaser.Scene {
  create() {
    // Белый текст
    this.add.text(400, 300, 'CYBERKID', {
      fontSize: '64px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Зелёный квадрат в центре
    this.add.rectangle(400, 400, 100, 100, 0x00ff00);

    // Красный квадрат в левом верхнем углу
    this.add.rectangle(100, 100, 50, 50, 0xff0000);

    // Жёлтый круг для проверки
    this.add.circle(700, 500, 40, 0xffcc00);
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
