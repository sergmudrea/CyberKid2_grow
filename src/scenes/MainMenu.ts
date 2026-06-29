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
    const title = this.add.text(width / 2, height / 3 - 20, 'CYBERKID', {
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

    const buttonBaseY = height / 2 - 20;
    const buttonSpacing = 65;

    // START
    const startButton = this.add.text(width / 2, buttonBaseY, '▶ START', {
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

    // EDITOR
    const editorButton = this.add.text(width / 2, buttonBaseY + buttonSpacing, '✏️ EDITOR', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    editorButton.on('pointerdown', () => {
      this.scene.start('SandboxScene');
    });
    editorButton.on('pointerover', () => editorButton.setColor('#00ffcc'));
    editorButton.on('pointerout', () => editorButton.setColor('#ffffff'));

    // SETTINGS
    const settingsButton = this.add.text(width / 2, buttonBaseY + buttonSpacing * 2, '⚙️ SETTINGS', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    settingsButton.on('pointerdown', () => {
      this.scene.start('Settings');
    });
    settingsButton.on('pointerover', () => settingsButton.setColor('#00ffcc'));
    settingsButton.on('pointerout', () => settingsButton.setColor('#ffffff'));

    // STATS
    const statsButton = this.add.text(width / 2, buttonBaseY + buttonSpacing * 3, '📊 STATS', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    statsButton.on('pointerdown', () => {
      this.scene.start('Stats');
    });
    statsButton.on('pointerover', () => statsButton.setColor('#00ffcc'));
    statsButton.on('pointerout', () => statsButton.setColor('#ffffff'));

    // Версия
    this.add.text(width - 20, height - 20, 'v0.4.0-alpha', {
      fontSize: '12px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(1, 1);
  }
}
