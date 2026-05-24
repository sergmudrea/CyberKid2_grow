import { Scene } from 'phaser';

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Звёзды
    for (let i = 0; i < 100; i++) {
      const star = this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 2 + 1, 0xffffff, 0.5);
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      });
    }

    // Логотип
    const title = this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontSize: '72px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 6,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: title,
      scale: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    // Кнопки
    const startButton = this.add.text(width / 2, height / 2, '▶ START', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    startButton.on('pointerdown', () => {
      this.scene.start('WorldMap');
    });
    startButton.on('pointerover', () => startButton.setColor('#00ffcc'));
    startButton.on('pointerout', () => startButton.setColor('#ffffff'));

    const editorButton = this.add.text(width / 2, height / 2 + 70, '✏️ EDITOR', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    editorButton.on('pointerdown', () => {
      console.log('Editor - coming soon');
    });
    editorButton.on('pointerover', () => editorButton.setColor('#00ffcc'));
    editorButton.on('pointerout', () => editorButton.setColor('#ffffff'));

    const settingsButton = this.add.text(width / 2, height / 2 + 140, '⚙️ SETTINGS', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    settingsButton.on('pointerdown', () => {
      console.log('Settings - coming soon');
    });
    settingsButton.on('pointerover', () => settingsButton.setColor('#00ffcc'));
    settingsButton.on('pointerout', () => settingsButton.setColor('#ffffff'));

    // Версия
    this.add.text(width - 20, height - 20, 'v0.3.0-alpha', {
      fontSize: '12px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(1, 1);
  }
}
