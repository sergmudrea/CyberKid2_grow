// src/scenes/Paywall.ts
// ============================================================================
// ЭКРАН ПОКУПКИ МИРА (PAYWALL)
// ============================================================================

import { Scene } from 'phaser';
import { logger } from '../core/Logger';
import { unlockManager } from '../managers/UnlockManager';

export class Paywall extends Scene {
  private worldId: string = '';

  constructor() {
    super('Paywall');
  }

  init(data: { worldId: string }): void {
    this.worldId = data.worldId || '';
    logger.info('Paywall', 'init', `worldId=${this.worldId}`);
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Иконка/заголовок мира
    const worldName = unlockManager.getWorldName(this.worldId);
    const price = unlockManager.getPrice(this.worldId);
    const icons: Record<string, string> = {
      ocean: '🌊',
      clouds: '☁️',
      fairytale: '🏰',
      volcano: '🌋',
      bonus: '⭐',
    };
    const icon = icons[this.worldId] || '🔒';

    // Иконка мира
    this.add.text(width / 2, height / 4, icon, {
      fontSize: '72px',
    }).setOrigin(0.5);

    // Название
    this.add.text(width / 2, height / 4 + 100, worldName, {
      fontSize: '36px',
      color: '#00ffcc',
      fontFamily: 'monospace',
      stroke: '#0066ff',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Описание
    this.add.text(width / 2, height / 2 - 60, `Разблокируй мир "${worldName}" и исследуй новые уровни!`, {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'monospace',
      wordWrap: { width: 500 },
      align: 'center',
    }).setOrigin(0.5);

    // Цена
    this.add.text(width / 2, height / 2, `Цена: ${price}`, {
      fontSize: '28px',
      color: '#ffcc00',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Кнопка купить
    const buyBtn = this.add.text(width / 2, height / 2 + 70, `💳 КУПИТЬ ${price}`, {
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#1a8a3a',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    buyBtn.on('pointerdown', () => {
      logger.info('Paywall', 'buyBtn', `Purchasing ${this.worldId}`);
      const success = unlockManager.purchase(this.worldId);
      if (success) {
        this.showSuccessMessage(worldName);
      }
    });
    buyBtn.on('pointerover', () => buyBtn.setColor('#00ffcc'));
    buyBtn.on('pointerout', () => buyBtn.setColor('#ffffff'));

    // Кнопка восстановить покупки
    const restoreBtn = this.add.text(width / 2, height / 2 + 140, '🔄 Восстановить покупки', {
      fontSize: '16px',
      color: '#aaaaaa',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restoreBtn.on('pointerdown', () => {
      unlockManager.restorePurchases();
      this.showToast('Покупки восстановлены!');
    });
    restoreBtn.on('pointerover', () => restoreBtn.setColor('#ffffff'));
    restoreBtn.on('pointerout', () => restoreBtn.setColor('#aaaaaa'));

    // Кнопка назад
    const backBtn = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);

    backBtn.on('pointerdown', () => {
      this.scene.start('WorldMap');
    });
    backBtn.on('pointerover', () => backBtn.setColor('#00ffcc'));
    backBtn.on('pointerout', () => backBtn.setColor('#ffffff'));
  }

  private showSuccessMessage(worldName: string): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(400);

    const msg = this.add.text(width / 2, height / 2, `🎉 Мир "${worldName}" разблокирован!\n\nОтличный выбор!`, {
      fontSize: '24px',
      color: '#ffcc00',
      fontFamily: 'monospace',
      backgroundColor: '#1a1a4a',
      padding: { x: 30, y: 20 },
      align: 'center',
    }).setOrigin(0.5).setDepth(401);

    this.time.delayedCall(2000, () => {
      overlay.destroy();
      msg.destroy();
      this.scene.start('WorldMap');
    });
  }

  private showToast(text: string): void {
    const width = this.cameras.main.width;
    const toast = this.add.text(width / 2, 80, text, {
      fontSize: '18px',
      color: '#00ffcc',
      backgroundColor: '#000000aa',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.time.delayedCall(2000, () => toast.destroy());
  }
}
