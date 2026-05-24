import { Scene } from 'phaser';

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон с градиентом
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Звёзды на фоне
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

    // Логотип с анимацией
    const title = this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 6,
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 8, fill: true },
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: title,
      scale: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Подзаголовок
    const subtitle = this.add.text(width / 2, height / 3 + 80, 'Learn to think like a developer', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#aaffee',
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: subtitle,
      alpha: 0.7,
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    // Кнопки меню
    const buttonY = height / 2;
    const spacing = 65;

    const startButton = this.add.text(width / 2, buttonY, '▶ START', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const editorButton = this.add.text(width / 2, buttonY + spacing, '✏️ EDITOR', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const settingsButton = this.add.text(width / 2, buttonY + spacing * 2, '⚙️ SETTINGS', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Обработчики кнопок
    startButton.on('pointerdown', () => {
      this.scene.start('GameScene', { levelId: 'level_003' });
    });
    startButton.on('pointerover', () => startButton.setColor('#00ffcc'));
    startButton.on('pointerout', () => startButton.setColor('#ffffff'));

    editorButton.on('pointerdown', () => {
      console.log('Editor - will be implemented later');
    });
    editorButton.on('pointerover', () => editorButton.setColor('#00ffcc'));
    editorButton.on('pointerout', () => editorButton.setColor('#ffffff'));

    settingsButton.on('pointerdown', () => {
      console.log('Settings - will be implemented later');
    });
    settingsButton.on('pointerover', () => settingsButton.setColor('#00ffcc'));
    settingsButton.on('pointerout', () => settingsButton.setColor('#ffffff'));

    // Версия внизу экрана
    this.add.text(width - 20, height - 20, 'v0.2.0-alpha', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(1, 1);
  }
}
