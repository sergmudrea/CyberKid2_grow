import { LevelData } from '../types/index';

export class LevelManager {
  private static instance: LevelManager;
  private levels: Map<string, LevelData> = new Map();

  private constructor() {
    this.loadDemoLevels();
  }

  public static getInstance(): LevelManager {
    if (!LevelManager.instance) {
      LevelManager.instance = new LevelManager();
    }
    return LevelManager.instance;
  }

  private loadDemoLevels(): void {
    // Уровень 15x15 с платформами
    const level1: LevelData = {
      id: 'level_001',
      name: 'First Steps',
      worldId: 'meadow',
      width: 15,
      height: 15,
      map: Array(15).fill(null).map(() => Array(15).fill(TileType.PLATFORM)),
      startPos: { col: 0, row: 0 },
      coinPos: { col: 14, row: 14 },
    };
    // Добавляем несколько стен для теста
    level1.map[5][5] = TileType.WALL;
    level1.map[5][6] = TileType.WALL;
    level1.map[6][5] = TileType.WALL;
    level1.map[6][6] = TileType.WALL;
    // Добавляем яму
    level1.map[10][10] = TileType.HOLE;
    
    this.levels.set('level_001', level1);
    
    // Простой уровень 5x5
    const level2: LevelData = {
      id: 'level_002',
      name: 'Simple',
      worldId: 'meadow',
      width: 5,
      height: 5,
      map: Array(5).fill(null).map(() => Array(5).fill(TileType.PLATFORM)),
      startPos: { col: 0, row: 0 },
      coinPos: { col: 4, row: 4 },
    };
    this.levels.set('level_002', level2);
  }

  public async loadLevel(levelId: string): Promise<LevelData | null> {
    // Имитация асинхронной загрузки
    await this.delay(10);
    return this.levels.get(levelId) || null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const levelManager = LevelManager.getInstance();
