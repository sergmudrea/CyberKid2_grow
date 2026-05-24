import { LevelData, TileType } from '../types/index';
import { logger } from '../core/Logger';

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
    const method = 'initialize';
    if (this.initialized) {
      logger.debug('LevelManager', method, 'Already initialized');
      return;
    }
    
    logger.info('LevelManager', method, 'Starting initialization');
    
    try {
      await this.loadLevelsFromFolder();
      
      // Всегда генерируем демо-уровни для миров, в которых нет уровней
      this.generateMissingDemoLevels();
      
      this.initialized = true;
      logger.info('LevelManager', method, `Initialization complete. Loaded ${this.cache.size} levels across ${this.worldsLevels.size} worlds`);
      
      for (const [worldId, levels] of this.worldsLevels) {
        logger.debug('LevelManager', method, `World ${worldId}: ${levels.length} levels`);
      }
    } catch (error) {
      logger.error('LevelManager', method, 'Initialization failed', error);
      throw error;
    }
  }

  private async loadLevelsFromFolder(): Promise<void> {
    const method = 'loadLevelsFromFolder';
    logger.debug('LevelManager', method, 'Attempting to load levels from /levels/ folder');
    
    try {
      const manifestResponse = await fetch('/levels/manifest.json');
      if (!manifestResponse.ok) {
        logger.warn('LevelManager', method, `Manifest not found at /levels/manifest.json (status: ${manifestResponse.status})`);
        return;
      }
      
      const manifestText = await manifestResponse.text();
      let manifest: string[];
      try {
        manifest = JSON.parse(manifestText);
        if (!Array.isArray(manifest)) {
          throw new Error('Manifest is not an array');
        }
      } catch (parseError) {
        logger.error('LevelManager', method, 'Failed to parse manifest.json - invalid JSON format', { raw: manifestText.substring(0, 200) });
        return;
      }
      
      logger.info('LevelManager', method, `Manifest loaded, found ${manifest.length} level entries`);
      
      let loadedCount = 0;
      let failedCount = 0;
      
      for (const levelId of manifest) {
        try {
          const response = await fetch(`/levels/${levelId}.json`);
          if (!response.ok) {
            failedCount++;
            logger.warn('LevelManager', method, `Failed to load level ${levelId}: HTTP ${response.status}`);
            continue;
          }
          
          const text = await response.text();
          if (!text || text.trim() === '') {
            failedCount++;
            logger.warn('LevelManager', method, `Level file ${levelId}.json is empty`);
            continue;
          }
          
          let levelData: LevelData;
          try {
            levelData = JSON.parse(text);
          } catch (parseError) {
            failedCount++;
            logger.error('LevelManager', method, `Failed to parse level ${levelId}.json - invalid JSON`, { raw: text.substring(0, 200) });
            continue;
          }
          
          if (!levelData.id || !levelData.worldId || !levelData.map) {
            failedCount++;
            logger.warn('LevelManager', method, `Level ${levelId} has invalid structure (missing required fields)`);
            continue;
          }
          
          this.cache.set(levelId, levelData);
          if (!this.worldsLevels.has(levelData.worldId)) {
            this.worldsLevels.set(levelData.worldId, []);
          }
          this.worldsLevels.get(levelData.worldId)!.push(levelId);
          loadedCount++;
          logger.debug('LevelManager', method, `Loaded level: ${levelId} (${levelData.worldId}), optimalSteps: ${levelData.optimalSteps}`);
        } catch (err) {
          failedCount++;
          logger.error('LevelManager', method, `Error loading level ${levelId}`, err);
        }
      }
      
      logger.info('LevelManager', method, `Folder load complete: ${loadedCount} loaded, ${failedCount} failed`);
    } catch (error) {
      logger.error('LevelManager', method, 'Failed to load from folder', error);
    }
  }

  private generateMissingDemoLevels(): void {
    const method = 'generateMissingDemoLevels';
    logger.info('LevelManager', method, 'Generating missing demo levels');
    
    const worlds = ['meadow', 'ocean', 'clouds', 'fairytale', 'volcano', 'bonus'];
    
    for (const worldId of worlds) {
      if (!this.worldsLevels.has(worldId) || this.worldsLevels.get(worldId)!.length === 0) {
        logger.debug('LevelManager', method, `Generating demo levels for ${worldId}`);
        this.generateWorldDemoLevels(worldId);
      }
    }
    
    // Arcade - собираем все уровни из всех миров
    if (!this.worldsLevels.has('arcade')) {
      this.worldsLevels.set('arcade', []);
    }
    const allLevels = Array.from(this.cache.keys()).sort();
    for (const levelId of allLevels) {
      if (!this.worldsLevels.get('arcade')!.includes(levelId)) {
        this.worldsLevels.get('arcade')!.push(levelId);
      }
    }
    logger.debug('LevelManager', method, `Arcade now has ${this.worldsLevels.get('arcade')!.length} levels from all worlds`);
  }

  private generateWorldDemoLevels(worldId: string): void {
    let count = 20;
    let width = 10;
    let height = 10;
    let startCol = 0, startRow = 0;
    let coinCol = 9, coinRow = 9;
    let optimalSteps = 18;
    
    switch (worldId) {
      case 'ocean':
        width = 12; height = 12; coinCol = 11; coinRow = 11; optimalSteps = 22;
        break;
      case 'clouds':
      case 'fairytale':
        width = 14; height = 14; coinCol = 13; coinRow = 13; optimalSteps = 26;
        break;
      case 'volcano':
        width = 16; height = 16; coinCol = 15; coinRow = 15; optimalSteps = 30;
        break;
      case 'bonus':
        width = 20; height = 20; coinCol = 19; coinRow = 19; optimalSteps = 38;
        break;
      default:
        width = 10; height = 10; coinCol = 9; coinRow = 9; optimalSteps = 18;
    }
    
    for (let i = 1; i <= count; i++) {
      const map = Array(height).fill(null).map(() => Array(width).fill(TileType.PLATFORM));
      const levelId = `${worldId}_${i.toString().padStart(worldId === 'meadow' ? 3 : 4, '0')}`;
      
      const level: LevelData = {
        id: levelId,
        name: `${worldId.charAt(0).toUpperCase() + worldId.slice(1)} ${i}`,
        worldId: worldId,
        width: width,
        height: height,
        map: map,
        startPos: { col: startCol, row: startRow },
        coinPos: { col: coinCol, row: coinRow },
        optimalSteps: optimalSteps,
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has(worldId)) this.worldsLevels.set(worldId, []);
      this.worldsLevels.get(worldId)!.push(level.id);
    }
    logger.debug('LevelManager', 'generateWorldDemoLevels', `Generated ${count} levels for ${worldId}`);
  }

  public async loadLevel(levelId: string): Promise<LevelData | null> {
    const method = 'loadLevel';
    if (!this.initialized) {
      logger.warn('LevelManager', method, 'Not initialized, initializing now');
      await this.initialize();
    }
    
    logger.debug('LevelManager', method, `Loading level: ${levelId}`);
    const level = this.cache.get(levelId);
    
    if (level) {
      logger.info('LevelManager', method, `Level loaded: ${levelId} (${level.name}), optimalSteps: ${level.optimalSteps}`);
    } else {
      logger.error('LevelManager', method, `Level not found: ${levelId}`);
    }
    
    return level || null;
  }

  public getLevelIdsForWorld(worldId: string): string[] {
    const method = 'getLevelIdsForWorld';
    const levels = this.worldsLevels.get(worldId) || [];
    logger.debug('LevelManager', method, `World ${worldId}: ${levels.length} levels`);
    return levels;
  }

  public getNextLevelId(currentLevelId: string): string | null {
    const method = 'getNextLevelId';
    const worldId = currentLevelId.split('_')[0];
    const levelIds = this.worldsLevels.get(worldId) || [];
    const index = levelIds.indexOf(currentLevelId);
    
    if (index !== -1 && index + 1 < levelIds.length) {
      const nextId = levelIds[index + 1];
      logger.debug('LevelManager', method, `${currentLevelId} -> ${nextId}`);
      return nextId;
    }
    
    logger.debug('LevelManager', method, `${currentLevelId} has no next level`);
    return null;
  }

  public clearCache(): void {
    const method = 'clearCache';
    logger.info('LevelManager', method, `Clearing cache (${this.cache.size} levels)`);
    this.cache.clear();
  }
}

export const levelManager = LevelManager.getInstance();
