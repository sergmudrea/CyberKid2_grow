import { LevelData, TileType } from '../types/index';

export class LevelManager {
  private static instance: LevelManager;
  private cache: Map<string, LevelData> = new Map();
  private worldsLevels: Map<string, string[]> = new Map();
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): LevelManager {
    if (!LevelManager.instance) {
      LevelManager.instance = new LevelManager();
    }
    return LevelManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Загружаем уровни из папки levels (если они есть)
    await this.loadLevelsFromFolder();
    
    // Если уровней нет, генерируем демо-уровни
    if (this.cache.size === 0) {
      this.generateDemoLevels();
    }
    
    this.initialized = true;
  }

  private async loadLevelsFromFolder(): Promise<void> {
    try {
      // Пытаемся загрузить манифест уровней (список всех levelId)
      const manifestResponse = await fetch('/levels/manifest.json');
      if (manifestResponse.ok) {
        const manifest: string[] = await manifestResponse.json();
        for (const levelId of manifest) {
          const response = await fetch(`/levels/${levelId}.json`);
          if (response.ok) {
            const levelData: LevelData = await response.json();
            this.cache.set(levelId, levelData);
            if (!this.worldsLevels.has(levelData.worldId)) {
              this.worldsLevels.set(levelData.worldId, []);
            }
            this.worldsLevels.get(levelData.worldId)!.push(levelId);
          }
        }
      }
    } catch (e) {
      console.log('No level files found, will use demo levels');
    }
  }

  private generateDemoLevels(): void {
    // Meadow уровни
    for (let i = 1; i <= 20; i++) {
      const map = Array(10).fill(null).map(() => Array(10).fill(TileType.PLATFORM));
      if (i === 5) {
        map[3][3] = TileType.WALL; map[3][4] = TileType.WALL;
        map[4][3] = TileType.WALL; map[4][4] = TileType.WALL;
      }
      if (i === 10) {
        map[5][5] = TileType.HOLE;
      }
      
      const level: LevelData = {
        id: `meadow_${i.toString().padStart(3, '0')}`,
        name: `Meadow ${i}`,
        worldId: 'meadow',
        width: 10,
        height: 10,
        map: map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 9, row: 9 },
        optimalSteps: 18,
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('meadow')) this.worldsLevels.set('meadow', []);
      this.worldsLevels.get('meadow')!.push(level.id);
    }

    // Ocean уровни
    for (let i = 501; i <= 520; i++) {
      const map = Array(12).fill(null).map(() => Array(12).fill(TileType.PLATFORM));
      const level: LevelData = {
        id: `ocean_${i.toString().padStart(3, '0')}`,
        name: `Ocean ${i}`,
        worldId: 'ocean',
        width: 12,
        height: 12,
        map: map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 11, row: 11 },
        optimalSteps: 22,
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('ocean')) this.worldsLevels.set('ocean', []);
      this.worldsLevels.get('ocean')!.push(level.id);
    }

    // Clouds уровни
    for (let i = 1001; i <= 1020; i++) {
      const map = Array(14).fill(null).map(() => Array(14).fill(TileType.PLATFORM));
      const level: LevelData = {
        id: `clouds_${i.toString().padStart(4, '0')}`,
        name: `Clouds ${i}`,
        worldId: 'clouds',
        width: 14,
        height: 14,
        map: map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 13, row: 13 },
        optimalSteps: 26,
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('clouds')) this.worldsLevels.set('clouds', []);
      this.worldsLevels.get('clouds')!.push(level.id);
    }

    // Fairytale уровни
    for (let i = 1501; i <= 1520; i++) {
      const map = Array(14).fill(null).map(() => Array(14).fill(TileType.PLATFORM));
      const level: LevelData = {
        id: `fairytale_${i.toString().padStart(4, '0')}`,
        name: `Fairytale ${i}`,
        worldId: 'fairytale',
        width: 14,
        height: 14,
        map: map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 13, row: 13 },
        optimalSteps: 26,
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('fairytale')) this.worldsLevels.set('fairytale', []);
      this.worldsLevels.get('fairytale')!.push(level.id);
    }

    // Volcano уровни
    for (let i = 2001; i <= 2020; i++) {
      const map = Array(16).fill(null).map(() => Array(16).fill(TileType.PLATFORM));
      const level: LevelData = {
        id: `volcano_${i.toString().padStart(4, '0')}`,
        name: `Volcano ${i}`,
        worldId: 'volcano',
        width: 16,
        height: 16,
        map: map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 15, row: 15 },
        optimalSteps: 30,
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('volcano')) this.worldsLevels.set('volcano', []);
      this.worldsLevels.get('volcano')!.push(level.id);
    }

    // Arcade (пустой)
    this.worldsLevels.set('arcade', []);

    // Bonus уровни
    for (let i = 2501; i <= 2520; i++) {
      const map = Array(20).fill(null).map(() => Array(20).fill(TileType.PLATFORM));
      const level: LevelData = {
        id: `bonus_${i.toString().padStart(4, '0')}`,
        name: `Bonus ${i}`,
        worldId: 'bonus',
        width: 20,
        height: 20,
        map: map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 19, row: 19 },
        optimalSteps: 38,
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('bonus')) this.worldsLevels.set('bonus', []);
      this.worldsLevels.get('bonus')!.push(level.id);
    }
  }

  public async loadLevel(levelId: string): Promise<LevelData | null> {
    if (!this.initialized) await this.initialize();
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
