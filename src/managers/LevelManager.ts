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
      
      if (this.cache.size === 0) {
        logger.warn('LevelManager', method, 'No levels found in folder, generating demo levels');
        this.generateDemoLevels();
      }
      
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

  private generateDemoLevels(): void {
    const method = 'generateDemoLevels';
    logger.info('LevelManager', method, 'Generating demo levels');
    
    for (let i = 1; i <= 20; i++) {
      const map = Array(10).fill(null).map(() => Array(10).fill(TileType.PLATFORM));
      if (i === 5) {
        map[3][3] = TileType.WALL; map[3][4] = TileType.WALL;
        map[4][3] = TileType.WALL; map[4][4] = TileType.WALL;
        logger.debug('LevelManager', method, `Level meadow_${i.toString().padStart(3, '0')}: added walls`);
      }
      if (i === 10) {
        map[5][5] = TileType.HOLE;
        logger.debug('LevelManager', method, `Level meadow_${i.toString().padStart(3, '0')}: added hole`);
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
    logger.debug('LevelManager', method, 'Generated 20 meadow levels');
    
    this.worldsLevels.set('ocean', []);
    this.worldsLevels.set('clouds', []);
    this.worldsLevels.set('fairytale', []);
    this.worldsLevels.set('volcano', []);
    this.worldsLevels.set('arcade', []);
    this.worldsLevels.set('bonus', []);
    
    logger.info('LevelManager', method, `Demo generation complete. Total levels: ${this.cache.size}`);
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
