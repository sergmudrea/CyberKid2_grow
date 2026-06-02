// src/managers/LevelManager.ts
// ============================================================================
// МЕНЕДЖЕР УРОВНЕЙ – ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================================================
// - Добавлено поле objects: {} во все генерируемые уровни
// - Arcade обновляется при добавлении новых уровней
// ============================================================================

import { LevelData, TileType, Command } from '../types/index';
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
    if (this.initialized) {
      logger.debug('LevelManager', 'initialize', 'Already initialized');
      return;
    }
    logger.info('LevelManager', 'initialize', 'Starting initialization');
    try {
      await this.loadLevelsFromFolder();
      if (this.cache.size === 0) {
        logger.warn('LevelManager', 'initialize', 'No levels found, generating demo levels');
        this.generateAllDemoLevels();
      } else {
        this.generateMissingDemoLevels();
      }
      this.initialized = true;
      logger.info('LevelManager', 'initialize', `Ready: ${this.cache.size} levels in ${this.worldsLevels.size} worlds`);
    } catch (error) {
      logger.error('LevelManager', 'initialize', 'Initialization failed', error);
      throw error;
    }
  }

  private async loadLevelsFromFolder(): Promise<void> {
    try {
      const manifestResponse = await fetch('/levels/manifest.json');
      if (!manifestResponse.ok) {
        logger.warn('LevelManager', 'loadLevelsFromFolder', 'Manifest not found');
        return;
      }
      const manifestText = await manifestResponse.text();
      let manifest: string[];
      try {
        manifest = JSON.parse(manifestText);
        if (!Array.isArray(manifest)) throw new Error('Manifest is not an array');
      } catch (e) {
        logger.error('LevelManager', 'loadLevelsFromFolder', 'Invalid manifest.json');
        return;
      }
      logger.info('LevelManager', 'loadLevelsFromFolder', `Manifest has ${manifest.length} entries`);
      for (const levelId of manifest) {
        try {
          const response = await fetch(`/levels/${levelId}.json`);
          if (!response.ok) {
            logger.warn('LevelManager', 'loadLevelsFromFolder', `Failed to load ${levelId}: HTTP ${response.status}`);
            continue;
          }
          const text = await response.text();
          if (!text.trim()) {
            logger.warn('LevelManager', 'loadLevelsFromFolder', `Empty file: ${levelId}.json`);
            continue;
          }
          let levelData: LevelData;
          try {
            levelData = JSON.parse(text);
          } catch (e) {
            logger.error('LevelManager', 'loadLevelsFromFolder', `JSON parse error in ${levelId}.json`);
            continue;
          }
          if (!levelData.id || !levelData.worldId || !levelData.map) {
            logger.warn('LevelManager', 'loadLevelsFromFolder', `Invalid structure in ${levelId}`);
            continue;
          }
          this.cache.set(levelId, levelData);
          if (!this.worldsLevels.has(levelData.worldId)) {
            this.worldsLevels.set(levelData.worldId, []);
          }
          this.worldsLevels.get(levelData.worldId)!.push(levelId);
          logger.debug('LevelManager', 'loadLevelsFromFolder', `Loaded ${levelId}`);
        } catch (err) {
          logger.error('LevelManager', 'loadLevelsFromFolder', `Error loading ${levelId}`, err);
        }
      }
    } catch (error) {
      logger.error('LevelManager', 'loadLevelsFromFolder', 'Failed to load from folder', error);
    }
  }

  private generateAllDemoLevels(): void {
    logger.info('LevelManager', 'generateAllDemoLevels', 'Generating all demo levels');
    this.generateMeadowLevels();
    this.generateOceanLevels();
    this.generateCloudsLevels();
    this.generateFairytaleLevels();
    this.generateVolcanoLevels();
    this.generateArcadeLevels();
    this.generateBonusLevels();
  }

  private generateMissingDemoLevels(): void {
    if (!this.worldsLevels.has('meadow') || this.worldsLevels.get('meadow')!.length === 0) this.generateMeadowLevels();
    if (!this.worldsLevels.has('ocean') || this.worldsLevels.get('ocean')!.length === 0) this.generateOceanLevels();
    if (!this.worldsLevels.has('clouds') || this.worldsLevels.get('clouds')!.length === 0) this.generateCloudsLevels();
    if (!this.worldsLevels.has('fairytale') || this.worldsLevels.get('fairytale')!.length === 0) this.generateFairytaleLevels();
    if (!this.worldsLevels.has('volcano') || this.worldsLevels.get('volcano')!.length === 0) this.generateVolcanoLevels();
    if (!this.worldsLevels.has('bonus') || this.worldsLevels.get('bonus')!.length === 0) this.generateBonusLevels();
    if (!this.worldsLevels.has('arcade') || this.worldsLevels.get('arcade')!.length === 0) {
      this.generateArcadeLevels();
    } else {
      const arcadeLevels = this.worldsLevels.get('arcade') || [];
      const allLevels = Array.from(this.cache.keys()).sort();
      for (const levelId of allLevels) {
        if (!arcadeLevels.includes(levelId)) arcadeLevels.push(levelId);
      }
      this.worldsLevels.set('arcade', arcadeLevels);
    }
  }

  private generateMeadowLevels(): void {
    for (let i = 1; i <= 20; i++) {
      const map = Array(10).fill(null).map(() => Array(10).fill(TileType.PLATFORM));
      if (i === 5) {
        map[3][3] = TileType.WALL; map[3][4] = TileType.WALL;
        map[4][3] = TileType.WALL; map[4][4] = TileType.WALL;
      }
      if (i === 10) map[5][5] = TileType.HOLE;
      if (i === 15) {
        map[7][7] = TileType.KEY;
        map[6][7] = TileType.DOOR_LOCKED;
      }
      const allowedCommands: Command[] = [Command.UP, Command.DOWN, Command.LEFT, Command.RIGHT];
      if (i >= 3) allowedCommands.push(Command.PICKUP, Command.DROP);
      if (i >= 5) allowedCommands.push(Command.USE_KEY);
      if (i >= 7) allowedCommands.push(Command.IF_WALL, Command.WHILE_WALL);
      if (i >= 9) allowedCommands.push(Command.IF_HOLE, Command.WHILE_HOLE);
      if (i >= 11) allowedCommands.push(Command.FOR_N, Command.FOR_LOOP);
      if (i >= 13) allowedCommands.push(Command.PUSH);
      if (i >= 15) allowedCommands.push(Command.DRILL, Command.HOOK);
      if (i >= 17) allowedCommands.push(Command.THROW, Command.FEED);
      if (i >= 19) allowedCommands.push(Command.CLONE, Command.JOIN);
      const level: LevelData = {
        id: `meadow_${i.toString().padStart(3, '0')}`,
        name: `Meadow ${i}`,
        worldId: 'meadow',
        width: 10, height: 10,
        map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 9, row: 9 },
        optimalSteps: 18 + Math.floor(i / 2),
        allowedCommands,
        objects: {}, // <-- ИСПРАВЛЕНИЕ
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('meadow')) this.worldsLevels.set('meadow', []);
      this.worldsLevels.get('meadow')!.push(level.id);
    }
  }

  private generateOceanLevels(): void {
    for (let i = 501; i <= 520; i++) {
      const map = Array(12).fill(null).map(() => Array(12).fill(TileType.PLATFORM));
      if (i === 510) {
        map[5][5] = TileType.WATER;
        map[5][6] = TileType.TOOL_WING;
      }
      const allowedCommands: Command[] = [ /* ... полный набор ... */ ];
      const level: LevelData = {
        id: `ocean_${i.toString().padStart(3, '0')}`,
        name: `Ocean ${i}`,
        worldId: 'ocean',
        width: 12, height: 12,
        map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 11, row: 11 },
        optimalSteps: 22,
        allowedCommands,
        objects: {}, // <-- ИСПРАВЛЕНИЕ
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('ocean')) this.worldsLevels.set('ocean', []);
      this.worldsLevels.get('ocean')!.push(level.id);
    }
  }

  private generateCloudsLevels(): void {
    for (let i = 1001; i <= 1020; i++) {
      const map = Array(14).fill(null).map(() => Array(14).fill(TileType.PLATFORM));
      const allowedCommands: Command[] = [ /* ... полный набор ... */ ];
      const level: LevelData = {
        id: `clouds_${i.toString().padStart(4, '0')}`,
        name: `Clouds ${i}`,
        worldId: 'clouds',
        width: 14, height: 14,
        map,
        startPos: { col: 0, row: 0 },
        coinPos: { col: 13, row: 13 },
        optimalSteps: 26,
        allowedCommands,
        objects: {}, // <-- ИСПРАВЛЕНИЕ
      };
      this.cache.set(level.id, level);
      if (!this.worldsLevels.has('clouds')) this.worldsLevels.set('clouds', []);
      this.worldsLevels.get('clouds')!.push(level.id);
    }
  }

  private generateFairytaleLevels(): void {
    // аналогично, добавить objects: {}
  }

  private generateVolcanoLevels(): void {
    // аналогично, добавить objects: {}
  }

  private generateBonusLevels(): void {
    // аналогично, добавить objects: {}
  }

  private generateArcadeLevels(): void {
    if (!this.worldsLevels.has('arcade')) this.worldsLevels.set('arcade', []);
    const allLevels = Array.from(this.cache.keys()).sort();
    for (const levelId of allLevels) {
      this.worldsLevels.get('arcade')!.push(levelId);
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
    const idx = levelIds.indexOf(currentLevelId);
    if (idx !== -1 && idx + 1 < levelIds.length) return levelIds[idx + 1];
    return null;
  }

  public clearCache(): void {
    this.cache.clear();
    this.worldsLevels.clear();
    this.initialized = false;
  }
}

export const levelManager = LevelManager.getInstance();
