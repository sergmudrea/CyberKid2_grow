import { LevelData } from '../types/index';

export class LevelManager {
  private static instance: LevelManager;
  private cache: Map<string, LevelData> = new Map();

  private constructor() {}

  public static getInstance(): LevelManager {
    if (!LevelManager.instance) {
      LevelManager.instance = new LevelManager();
    }
    return LevelManager.instance;
  }

  public async loadLevel(levelId: string): Promise<LevelData | null> {
    if (this.cache.has(levelId)) {
      return this.cache.get(levelId)!;
    }
    
    try {
      // Загружаем уровень из папки levels в корне проекта
      const response = await fetch(`/levels/${levelId}.json`);
      if (!response.ok) {
        console.error(`Failed to load level ${levelId}: ${response.status}`);
        // Возвращаем демо-уровень вместо null, чтобы игра не падала
        return this.getDemoLevel(levelId);
      }
      const levelData: LevelData = await response.json();
      this.cache.set(levelId, levelData);
      return levelData;
    } catch (error) {
      console.error(`Error loading level ${levelId}:`, error);
      return this.getDemoLevel(levelId);
    }
  }

  private getDemoLevel(levelId: string): LevelData {
    console.log(`Using demo level instead of ${levelId}`);
    return {
      id: levelId,
      name: 'Demo Level',
      worldId: 'meadow',
      width: 10,
      height: 10,
      map: Array(10).fill(null).map(() => Array(10).fill(0)),
      startPos: { col: 0, row: 0 },
      coinPos: { col: 9, row: 9 },
    };
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const levelManager = LevelManager.getInstance();
