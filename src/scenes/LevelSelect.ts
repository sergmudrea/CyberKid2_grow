import { Scene } from 'phaser';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';

export class LevelSelect extends Scene {
  private worldId: string = '';
  private levelIds: string[] = [];
  private levelButtons: Phaser.GameObjects.Container[] = [];
  private currentPage: number = 0;
  private levelsPerPage: number = 12;
  private pageText: Phaser.GameObjects.Text;
  private infoPanel: Phaser.GameObjects.Container;
  private selectedLevelId: string = '';

  constructor() {
    super('LevelSelect');
  }

  init(data: { worldId: string }): void {
    this.worldId = data.worldId;
  }

  async create(): Promise<void> {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Заголовок
    const worldNames: Record<string, string> = {
      meadow: 'MEADOW',
      ocean: 'OCEAN',
      clouds: 'CLOUDS',
      fairytale: 'FAIRYTALE',
      volcano: 'VOLCANO',
      arcade: 'ARCADE',
      bonus: 'BONUS',
    };
    const title = this.add.text(width / 2, 50, worldNames[this.worldId] || this.worldId, {
      fontSize: '32px',
      color: '#00ffcc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

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

    // Сетка уровней
    this.renderLevelGrid();

    // Панель информации
    this.createInfoPanel();

    // Кнопка назад
    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('WorldMap');
    });
    backButton.setScrollFactor(0);
    backButton.setDepth(100);
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
    const spacingX = 100;
    const spacingY = 90;

    for (let i = 0; i < pageLevels.length; i++) {
      const levelId = pageLevels[i];
      const levelNum = parseInt(levelId.split('_')[1]);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;

      const stats = progressManager.getLevelStats(levelId);
      const stars = stats?.stars || 0;
      const isLocked = this.isLevelLocked(levelId);
      const isCompleted = stats?.completed || false;

      const container = this.add.container(x, y);
      const bgColor = isLocked ? 0x444444 : (isCompleted ? 0x2a4a2a : 0x2a2a4a);
      const bg = this.add.rectangle(0, 0, 70, 70, bgColor, 0.9);
      bg.setStrokeStyle(2, isLocked ? 0x888888 : 0x00ffcc);

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
          this.updateInfoPanel(levelId);
        });
      }

      this.levelButtons.push(container);
    }

    // Пагинация
    const totalPages = Math.ceil(this.levelIds.length / this.levelsPerPage);
    if (this.pageText) this.pageText.destroy();
    this.pageText = this.add.text(this.cameras.main.width - 100, 100, `${this.currentPage + 1}/${totalPages}`, {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Кнопки пагинации
    const prevBtn = this.add.text(this.cameras.main.width - 200, 100, '◀', { fontSize: '24px', color: '#ffffff' }).setInteractive({ useHandCursor: true });
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

  private isLevelLocked(levelId: string): boolean {
    const levelNum = parseInt(levelId.split('_')[1]);
    if (levelNum === 1) return false;
    const prevLevelId = `${this.worldId}_${(levelNum - 1).toString().padStart(3, '0')}`;
    const prevStats = progressManager.getLevelStats(prevLevelId);
    return !prevStats?.completed;
  }

  private createInfoPanel(): void {
    const width = this.cameras.main.width;
    const panelBg = this.add.rectangle(width - 180, 200, 160, 150, 0x000000, 0.7);
    panelBg.setStrokeStyle(2, 0x00ffcc);
    
    this.infoPanel = this.add.container(width - 180, 200);
    
    const levelText = this.add.text(0, -50, 'Level --', { fontSize: '16px', color: '#ffffff', fontFamily: 'monospace' }).setOrigin(0.5);
    const starsText = this.add.text(0, -20, 'Stars: 0/3', { fontSize: '12px', color: '#ffcc00' }).setOrigin(0.5);
    const bestText = this.add.text(0, 0, 'Best: --', { fontSize: '12px', color: '#aaaaaa' }).setOrigin(0.5);
    const playBtn = this.add.text(0, 40, '▶ PLAY', { fontSize: '16px', color: '#00ffcc', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setOrigin(0.5);
    playBtn.setInteractive({ useHandCursor: true });
    playBtn.on('pointerdown', () => {
      if (this.selectedLevelId) {
        this.scene.start('GameScene', { levelId: this.selectedLevelId });
      }
    });
    
    this.infoPanel.add([panelBg, levelText, starsText, bestText, playBtn]);
    this.infoPanel.setVisible(false);
  }

  private updateInfoPanel(levelId: string): void {
    const stats = progressManager.getLevelStats(levelId);
    const stars = stats?.stars || 0;
    const bestSteps = stats?.bestSteps !== Infinity ? stats?.bestSteps : '--';
    
    const levelText = this.infoPanel.getAt(1) as Phaser.GameObjects.Text;
    const starsText = this.infoPanel.getAt(2) as Phaser.GameObjects.Text;
    const bestText = this.infoPanel.getAt(3) as Phaser.GameObjects.Text;
    
    levelText.setText(`Level ${levelId.split('_')[1]}`);
    starsText.setText(`Stars: ${stars}/3`);
    bestText.setText(`Best: ${bestSteps}`);
    
    this.infoPanel.setVisible(true);
  }
}
