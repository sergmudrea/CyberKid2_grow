import { Scene } from 'phaser';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { logger } from '../core/Logger';

export class LevelSelect extends Scene {
  private worldId: string = '';
  private levelIds: string[] = [];
  private levelButtons: Phaser.GameObjects.Container[] = [];
  private currentPage: number = 0;
  private levelsPerPage: number = 12;
  private pageText: Phaser.GameObjects.Text;
  private infoPanel: Phaser.GameObjects.Container;
  private infoPanelBg: Phaser.GameObjects.Rectangle;
  private infoLevelText: Phaser.GameObjects.Text;
  private infoStarsText: Phaser.GameObjects.Text;
  private infoBestText: Phaser.GameObjects.Text;
  private playButton: Phaser.GameObjects.Text;
  private selectedLevelId: string = '';
  private selectedLevelIndex: number = -1;

  constructor() {
    super('LevelSelect');
  }

  init(data: { worldId: string }): void {
    this.worldId = data.worldId;
    logger.debug('LevelSelect', 'init', `Initializing for world: ${this.worldId}`);
  }

  async create(): Promise<void> {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Звёзды
    for (let i = 0; i < 80; i++) {
      this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 2 + 1, 0xffffff, 0.3);
    }

    // Заголовок
    const worldNames: Record<string, string> = {
      meadow: '🌾 MEADOW',
      ocean: '🌊 OCEAN',
      clouds: '☁️ CLOUDS',
      fairytale: '🏰 FAIRYTALE',
      volcano: '🌋 VOLCANO',
      arcade: '🎮 ARCADE',
      bonus: '⭐ BONUS',
    };
    const title = this.add.text(width / 2, 50, worldNames[this.worldId] || this.worldId, {
      fontSize: '28px',
      color: '#00ffcc',
      fontFamily: 'monospace',
      stroke: '#0066ff',
      strokeThickness: 2,
    }).setOrigin(0.5);
    title.setScrollFactor(0);

    // Загрузка уровней
    this.levelIds = levelManager.getLevelIdsForWorld(this.worldId);
    if (this.levelIds.length === 0) {
      await levelManager.initialize();
      this.levelIds = levelManager.getLevelIdsForWorld(this.worldId);
    }
    this.levelIds.sort((a, b) => {
      const numA = parseInt(a.split('_')[1]);
      const numB = parseInt(b.split('_')[1]);
      return numA - numB;
    });
    
    logger.debug('LevelSelect', 'create', `Loaded ${this.levelIds.length} levels for world ${this.worldId}`);

    // Сетка уровней
    this.renderLevelGrid();

    // Панель информации
    this.createInfoPanel();

    // Кнопка назад
    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('WorldMap');
    });
    backButton.setScrollFactor(0);
    backButton.setDepth(100);

    // Кнопка возврата на карту миров
    const worldMapButton = this.add.text(width - 120, 10, '🌍 WORLDS', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    worldMapButton.on('pointerdown', () => {
      this.scene.start('WorldMap');
    });
    worldMapButton.setScrollFactor(0);
    worldMapButton.setDepth(100);
  }

  private renderLevelGrid(): void {
    // Очищаем старые кнопки
    this.levelButtons.forEach(btn => btn.destroy());
    this.levelButtons = [];

    const startIdx = this.currentPage * this.levelsPerPage;
    const endIdx = Math.min(startIdx + this.levelsPerPage, this.levelIds.length);
    const pageLevels = this.levelIds.slice(startIdx, endIdx);

    const cols = 4;
    const rows = 3;
    const startX = 200;
    const startY = 130;
    const spacingX = 90;
    const spacingY = 85;

    for (let i = 0; i < pageLevels.length; i++) {
      const levelId = pageLevels[i];
      const levelNum = parseInt(levelId.split('_')[1]);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;

      const stats = progressManager.getLevelStats(levelId);
      const stars = stats?.stars || 0;
      // Используем ProgressManager для проверки разблокировки
      const isLocked = !progressManager.isLevelUnlocked(levelId);
      const isCompleted = stats?.completed || false;

      logger.debug('LevelSelect', 'renderLevelGrid', `Level ${levelId}: locked=${isLocked}, completed=${isCompleted}, stars=${stars}`);

      const container = this.add.container(x, y);
      const bgColor = isLocked ? 0x444444 : (isCompleted ? 0x2a4a2a : 0x2a2a4a);
      const bg = this.add.rectangle(0, 0, 70, 70, bgColor, 0.9);
      bg.setStrokeStyle(2, isLocked ? 0x888888 : (isCompleted ? 0x44cc44 : 0x00ffcc));

      const levelText = this.add.text(0, -10, `${levelNum}`, { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace' }).setOrigin(0.5);
      const starsText = this.add.text(0, 15, '★'.repeat(stars) + '☆'.repeat(3 - stars), { fontSize: '10px', color: '#ffcc00' }).setOrigin(0.5);

      container.add([bg, levelText, starsText]);

      if (isLocked) {
        const lock = this.add.text(0, 0, '🔒', { fontSize: '16px' }).setOrigin(0.5);
        container.add(lock);
      } else {
        container.setInteractive(new Phaser.Geom.Rectangle(-35, -35, 70, 70), Phaser.Geom.Rectangle.Contains);
        container.on('pointerdown', () => {
          this.selectedLevelId = levelId;
          this.selectedLevelIndex = startIdx + i;
          this.updateInfoPanel(levelId);
          logger.debug('LevelSelect', 'renderLevelGrid', `Selected level: ${levelId}`);
        });
        container.on('pointerover', () => {
          bg.setStrokeStyle(3, 0xffaa00);
          levelText.setColor('#ffaa00');
        });
        container.on('pointerout', () => {
          bg.setStrokeStyle(2, isCompleted ? 0x44cc44 : 0x00ffcc);
          levelText.setColor('#ffffff');
        });
      }

      this.levelButtons.push(container);
    }

    // Пагинация
    const totalPages = Math.ceil(this.levelIds.length / this.levelsPerPage);
    if (this.pageText) this.pageText.destroy();
    this.pageText = this.add.text(this.cameras.main.width - 100, 100, `${this.currentPage + 1}/${totalPages}`, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.pageText.setScrollFactor(0);

    const prevBtn = this.add.text(this.cameras.main.width - 170, 100, '◀', { fontSize: '24px', color: '#ffffff' }).setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.renderLevelGrid();
      }
    });
    prevBtn.setScrollFactor(0);
    prevBtn.setDepth(100);

    const nextBtn = this.add.text(this.cameras.main.width - 50, 100, '▶', { fontSize: '24px', color: '#ffffff' }).setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => {
      if (this.currentPage + 1 < totalPages) {
        this.currentPage++;
        this.renderLevelGrid();
      }
    });
    nextBtn.setScrollFactor(0);
    nextBtn.setDepth(100);
  }

  private createInfoPanel(): void {
    const width = this.cameras.main.width;
    
    this.infoPanelBg = this.add.rectangle(width - 150, 250, 140, 160, 0x000000, 0.85);
    this.infoPanelBg.setStrokeStyle(2, 0x00ffcc);
    this.infoPanelBg.setVisible(false);
    
    this.infoPanel = this.add.container(width - 150, 250);
    
    this.infoLevelText = this.add.text(0, -50, 'Level --', { fontSize: '14px', color: '#ffffff', fontFamily: 'monospace' }).setOrigin(0.5);
    this.infoStarsText = this.add.text(0, -20, '★ 0/3', { fontSize: '12px', color: '#ffcc00' }).setOrigin(0.5);
    this.infoBestText = this.add.text(0, 5, 'Best: --', { fontSize: '11px', color: '#aaaaaa' }).setOrigin(0.5);
    this.playButton = this.add.text(0, 40, '▶ PLAY', { fontSize: '14px', color: '#00ffcc', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setOrigin(0.5);
    this.playButton.setInteractive({ useHandCursor: true });
    this.playButton.on('pointerdown', () => {
      if (this.selectedLevelId) {
        logger.info('LevelSelect', 'playButton', `Starting level: ${this.selectedLevelId}`);
        this.scene.start('GameScene', { levelId: this.selectedLevelId });
      }
    });
    
    this.infoPanel.add([this.infoPanelBg, this.infoLevelText, this.infoStarsText, this.infoBestText, this.playButton]);
  }

  private updateInfoPanel(levelId: string): void {
    const stats = progressManager.getLevelStats(levelId);
    const stars = stats?.stars || 0;
    const bestSteps = (stats?.bestSteps !== undefined && stats.bestSteps !== Infinity) ? stats.bestSteps : '--';
    
    this.infoLevelText.setText(`Level ${levelId.split('_')[1]}`);
    this.infoStarsText.setText(`★ ${stars}/3`);
    this.infoBestText.setText(`Best: ${bestSteps}`);
    
    this.infoPanelBg.setVisible(true);
    this.infoPanel.setVisible(true);
  }
}
