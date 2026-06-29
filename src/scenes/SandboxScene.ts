// src/scenes/SandboxScene.ts
// ============================================================================
// СЦЕНА РЕДАКТОРА УРОВНЕЙ
// ============================================================================

import { Scene } from 'phaser';
import { SandboxMaker } from '../modules/SandboxMaker';
import { LevelData } from '../types/index';
import { logger } from '../core/Logger';

export class SandboxScene extends Scene {
  private sandboxMaker: SandboxMaker | null = null;

  constructor() {
    super('SandboxScene');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    logger.info('SandboxScene', 'create', 'Editor opened');

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Заголовок
    this.add.text(width / 2, 16, '✏️ SANDBOX EDITOR', {
      fontSize: '20px',
      color: '#00ffcc',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Создаём редактор
    this.sandboxMaker = new SandboxMaker(
      this,
      (level: LevelData) => {
        logger.info('SandboxScene', 'onTest', `Testing level: ${level.id}`);
        this.scene.start('GameScene', { testLevel: level });
      },
      () => {
        this.scene.start('MainMenu');
      }
    );
  }

  shutdown(): void {
    this.sandboxMaker?.destroy();
    this.sandboxMaker = null;
  }
}
