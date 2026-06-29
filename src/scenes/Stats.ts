// src/scenes/Stats.ts
// ============================================================================
// ЭКРАН СТАТИСТИКИ ИГРОКА
// ============================================================================

import { Scene } from 'phaser';
import { logger } from '../core/Logger';
import { progressManager } from '../managers/ProgressManager';
import { levelManager } from '../managers/LevelManager';

export class Stats extends Scene {
  constructor() {
    super('Stats');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    logger.info('Stats', 'create', 'Stats screen open');

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Заголовок
    this.add.text(width / 2, 40, '📊 СТАТИСТИКА', {
      fontSize: '32px',
      color: '#ffcc00',
      fontFamily: 'monospace',
      stroke: '#ff6600',
      strokeThickness: 2,
    }).setOrigin(0.5);

    const progress = progressManager.get();

    // === СЕКЦИЯ: ОБЗОР ===
    this.add.text(50, 100, '─── Обзор ───', {
      fontSize: '18px',
      color: '#00ffcc',
      fontFamily: 'monospace',
    });

    const formatTime = (sec: number): string => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${h}ч ${m}м ${s}с`;
    };

    const overviewItems = [
      { label: '⭐ Всего звёзд', value: String(progress.totalStars) },
      { label: '🌑 Чёрных звёзд', value: String(progress.totalBlackStars) },
      { label: '✅ Уровней пройдено', value: String(progress.levelsCompleted.length) },
      { label: '🎯 Попыток', value: String(progress.totalAttempts) },
      { label: '💀 Смертей', value: String(progress.totalDeaths) },
      { label: '⏱ Время игры', value: formatTime(progress.totalPlayTimeSec) },
    ];

    overviewItems.forEach((item, i) => {
      const y = 140 + i * 32;
      this.add.text(70, y, item.label, {
        fontSize: '16px',
        color: '#cccccc',
        fontFamily: 'monospace',
      });
      this.add.text(width / 2 - 20, y, item.value, {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
      }).setOrigin(0, 0);
    });

    // === СЕКЦИЯ: МИРЫ ===
    this.add.text(50, 360, '─── Прогресс по мирам ───', {
      fontSize: '18px',
      color: '#00ffcc',
      fontFamily: 'monospace',
    });

    const worldsData = [
      { id: 'meadow',    name: 'Meadow',    icon: '🌾', totalLevels: 20 },
      { id: 'ocean',     name: 'Ocean',     icon: '🌊', totalLevels: 20 },
      { id: 'clouds',    name: 'Clouds',    icon: '☁️',  totalLevels: 20 },
      { id: 'fairytale', name: 'Fairytale', icon: '🏰', totalLevels: 20 },
      { id: 'volcano',   name: 'Volcano',   icon: '🌋', totalLevels: 20 },
      { id: 'bonus',     name: 'Bonus',     icon: '⭐', totalLevels: 20 },
    ];

    worldsData.forEach((world, i) => {
      const y = 400 + i * 44;

      // Считаем пройденные уровни
      const levelIds = levelManager.getLevelIdsForWorld(world.id);
      let completed = 0;
      let totalStars = 0;
      for (const lid of levelIds) {
        const stats = progress.levelStats[lid];
        if (stats?.completed) completed++;
        totalStars += stats?.stars || 0;
      }
      const total = levelIds.length > 0 ? levelIds.length : world.totalLevels;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      this.add.text(70, y, `${world.icon} ${world.name}`, {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
      });

      // Прогресс-бар
      const barX = 220;
      const barW = 200;
      const barH = 14;
      const barFill = Math.round((percent / 100) * barW);

      const barBg = this.add.rectangle(barX, y + 8, barW, barH, 0x333355);
      barBg.setOrigin(0, 0.5);
      if (barFill > 0) {
        const barFg = this.add.rectangle(barX, y + 8, barFill, barH, 0x00aa66);
        barFg.setOrigin(0, 0.5);
      }

      this.add.text(barX + barW + 10, y, `${completed}/${total} (${percent}%)  ★${totalStars}`, {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      }).setOrigin(0, 0);
    });

    // Кнопка BACK
    const backBtn = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);

    backBtn.on('pointerdown', () => {
      this.scene.start('MainMenu');
    });
    backBtn.on('pointerover', () => backBtn.setColor('#00ffcc'));
    backBtn.on('pointerout', () => backBtn.setColor('#ffffff'));
  }
}
