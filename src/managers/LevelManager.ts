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
      // Загружаем уровень из папки public/levels/
      const response = await fetch(`/levels/${levelId}.json`);
      if (!response.ok) {
        console.error(`Failed to load level ${levelId}: ${response.status}`);
        return null;
      }
      const levelData: LevelData = await response.json();
      this.cache.set(levelId, levelData);
      return levelData;
    } catch (error) {
      console.error(`Error loading level ${levelId}:`, error);
      return null;
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const levelManager = LevelManager.getInstance();
