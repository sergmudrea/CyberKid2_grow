import { LevelData } from '../types/index';

export class LevelManager {
  private static instance: LevelManager;
  private cache: Map<string, LevelData> = new Map();
  private worldsLevels: Map<string, string[]> = new Map();

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
    // Генерируем уровни для Meadow
    const meadowLevels: LevelData[] = [];
    for (let i = 1; i <= 20; i++) {
      const map = Array(10).fill(null).map(() => Array(10).fill(0));
      if (i === 5) {
        map[3][3] = 1; // стена
        map[3][4] = 1;
        map[4][3] = 1;
        map[4][4] = 1;
      }
      if (i === 10) {
        map[5][5] = 2; // яма
      }
      meadowLevels.push({
        id: `meadow_${i.toString().padStart(3, '0')}`,
        name: `Meadow ${i}`,
        worldId: 'meadow',
        width: 10,
        height: 10,
        map: map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 9, row: 9 },
        optimalSteps: 18,
      });
    }
    
    for (const level of meadowLevels) {
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('meadow')) this.worldsLevels.set('meadow', []);
      this.worldsLevels.get('meadow')!.push(level.id);
    }
    
    // Ocean уровни (заглушки)
    for (let i = 501; i <= 510; i++) {
      const levelId = `ocean_${i.toString().padStart(3, '0')}`;
      this.cache.set(levelId, {
        id: levelId,
        name: `Ocean ${i}`,
        worldId: 'ocean',
        width: 12,
        height: 12,
        map: Array(12).fill(null).map(() => Array(12).fill(0)),
        startPos: { col: 0, row: 0 },
        coinPos: { col: 11, row: 11 },
        optimalSteps: 22,
      });
      if (!this.worldsLevels.has('ocean')) this.worldsLevels.set('ocean', []);
      this.worldsLevels.get('ocean')!.push(levelId);
    }
  }

  public async initialize(): Promise<void> {
    // Уже инициализировано в конструкторе
  }

  public async loadLevel(levelId: string): Promise<LevelData | null> {
    return this.cache.get(levelId) || null;
  }

  public getLevelIdsForWorld(worldId: string): string[] {
    return this.worldsLevels.get(worldId) || [];
  }

  public getNextLevelId(currentLevelId: string): string | null {
    const worldId = currentLevelId.split('_')[0];
    const levelIds = this.worldsLevels.get(worldId) || [];
    const index = levelIds.indexOf(currentLevelId);
    if (index !== -1 && index + 1 < levelIds.length) {
      return levelIds[index + 1];
    }
    return null;
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const levelManager = LevelManager.getInstance();
