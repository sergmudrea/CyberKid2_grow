import { Scene } from 'phaser';
import { levelManager } from '../managers/LevelManager';
import { logger } from '../core/Logger';

export class Preload extends Scene {
  constructor() {
    super('Preload');
  }

  async create(): Promise<void> {
    logger.info('Preload', 'create', 'Starting preload');
    
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    
    const percentText = this.add.text(width / 2, height / 2 + 5, '0%', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ffcc, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
      percentText.setText(`${Math.floor(value * 100)}%`);
    });
    
    this.load.on('loaderror', (file: any) => {
      logger.warn('Preload', 'loaderror', `Failed to load: ${file.key}`);
    });
    
    // Загрузка тайлов (с обработкой ошибок)
    this.load.image('tile_platform', '/assets/tiles/platform.png');
    this.load.image('tile_wall', '/assets/tiles/wall.png');
    this.load.image('tile_hole', '/assets/tiles/hole.png');
    this.load.image('tile_coin', '/assets/tiles/coin.png');
    this.load.image('tile_start', '/assets/tiles/start.png');
    
    // Загрузка спрайтов игрока
    this.load.image('player_up', '/assets/player/player_up.png');
    this.load.image('player_down', '/assets/player/player_down.png');
    this.load.image('player_left', '/assets/player/player_left.png');
    this.load.image('player_right', '/assets/player/player_right.png');
    this.load.image('player', '/assets/player/player.png');
    
    // Загрузка монстров
    this.load.image('monster_patrol', '/assets/monsters/monster_patrol.png');
    this.load.image('monster_chase', '/assets/monsters/monster_chase.png');
    this.load.image('monster_tameable', '/assets/monsters/monster_tameable.png');
    
    // Загрузка UI (опционально)
    this.load.image('ui_button_run', '/assets/ui/button_run.png');
    this.load.image('ui_button_clear', '/assets/ui/button_clear.png');
    this.load.image('ui_button_save', '/assets/ui/button_save.png');
    this.load.image('ui_button_load', '/assets/ui/button_load.png');
    
    // Эффекты (опционально, не критично)
    this.load.image('effect_teleport', '/assets/effects/teleport.png').on('loaderror', () => {});
    this.load.image('effect_death', '/assets/effects/death.png').on('loaderror', () => {});
    this.load.image('effect_victory', '/assets/effects/victory.png').on('loaderror', () => {});
    
    // Генерация плейсхолдеров для отсутствующих текстур
    this.load.on('complete', () => {
      this.generatePlaceholders();
      this.startGame();
    });
    
    this.load.start();
  }
  
  private generatePlaceholders(): void {
    const textureManager = this.textures;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Генерация плейсхолдера для тайлов
    const generateTilePlaceholder = (key: string, color: string, icon: string) => {
      if (textureManager.exists(key)) return;
      canvas.width = 64;
      canvas.height = 64;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#aaa';
      ctx.strokeRect(0, 0, 64, 64);
      ctx.fillStyle = '#fff';
      ctx.font = '32px Arial';
      ctx.fillText(icon, 16, 48);
      textureManager.addImage(key, canvas);
    };
    
    // Генерация плейсхолдера для игрока
    const generatePlayerPlaceholder = (key: string, color: string, icon: string) => {
      if (textureManager.exists(key)) return;
      canvas.width = 64;
      canvas.height = 64;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#fff';
      ctx.font = '40px Arial';
      ctx.fillText(icon, 12, 52);
      textureManager.addImage(key, canvas);
    };
    
    // Генерация плейсхолдеров для тайлов
    generateTilePlaceholder('tile_platform', '#8B5A2B', '⬜');
    generateTilePlaceholder('tile_wall', '#555555', '🧱');
    generateTilePlaceholder('tile_hole', '#000000', '🕳️');
    generateTilePlaceholder('tile_coin', '#FFD700', '💰');
    generateTilePlaceholder('tile_start', '#00AA00', '🚀');
    
    // Генерация плейсхолдеров для игрока
    generatePlayerPlaceholder('player', '#00BFFF', '🤖');
    generatePlayerPlaceholder('player_up', '#00BFFF', '↑');
    generatePlayerPlaceholder('player_down', '#00BFFF', '↓');
    generatePlayerPlaceholder('player_left', '#00BFFF', '←');
    generatePlayerPlaceholder('player_right', '#00BFFF', '→');
    
    // Генерация плейсхолдеров для монстров
    generateTilePlaceholder('monster_patrol', '#8B008B', '👾');
    generateTilePlaceholder('monster_chase', '#DC143C', '👾⚡');
    generateTilePlaceholder('monster_tameable', '#228B22', '👾❤️');
    
    // Генерация плейсхолдеров для UI
    generateTilePlaceholder('ui_button_run', '#00AA44', '▶');
    generateTilePlaceholder('ui_button_clear', '#AA4444', '🗑');
    generateTilePlaceholder('ui_button_save', '#4444AA', '💾');
    generateTilePlaceholder('ui_button_load', '#AA8844', '📂');
    
    logger.info('Preload', 'generatePlaceholders', 'Placeholder textures generated');
  }
  
  private async startGame(): Promise<void> {
    logger.info('Preload', 'startGame', 'Initializing level manager');
    await levelManager.initialize();
    logger.info('Preload', 'startGame', 'Starting MainMenu');
    this.scene.start('MainMenu');
  }
}
