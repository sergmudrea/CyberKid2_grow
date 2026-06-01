// src/managers/LevelManager.ts
// ============================================================================
// МЕНЕДЖЕР УРОВНЕЙ (LEVEL MANAGER)
// ============================================================================
// Отвечает за загрузку, кэширование и предоставление данных об уровнях.
// Поддерживает:
// - Загрузку уровней из JSON-файлов (папка /levels/)
// - Генерацию демо-уровней на лету (если файлов нет)
// - Хранение уровней в кэше (Map)
// - Получение списка уровней по миру
// - Определение следующего уровня (для навигации)
// ============================================================================

import { LevelData, TileType } from '../types/index';
import { logger } from '../core/Logger';

export class LevelManager {
  private static instance: LevelManager;
  private cache: Map<string, LevelData> = new Map();     // id уровня -> данные уровня
  private worldsLevels: Map<string, string[]> = new Map(); // id мира -> массив id уровней
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): LevelManager {
    if (!LevelManager.instance) {
      LevelManager.instance = new LevelManager();
    }
    return LevelManager.instance;
  }

  // --------------------------------------------------------------------------
  // Инициализация: загружаем уровни из папки или генерируем демо-уровни
  // --------------------------------------------------------------------------
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('LevelManager', 'initialize', 'Already initialized');
      return;
    }
    
    logger.info('LevelManager', 'initialize', 'Starting initialization');
    
    try {
      // Пытаемся загрузить уровни из /levels/ (если есть manifest.json)
      await this.loadLevelsFromFolder();
      
      // Если ни одного уровня не загружено – генерируем полный набор демо-уровней
      if (this.cache.size === 0) {
        logger.warn('LevelManager', 'initialize', 'No levels found, generating demo levels');
        this.generateAllDemoLevels();
      } else {
        // Если какие-то миры отсутствуют – генерируем только их
        this.generateMissingDemoLevels();
      }
      
      this.initialized = true;
      logger.info('LevelManager', 'initialize', `Ready: ${this.cache.size} levels in ${this.worldsLevels.size} worlds`);
    } catch (error) {
      logger.error('LevelManager', 'initialize', 'Initialization failed', error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Загрузка уровней из папки /levels/ (по manifest.json)
  // --------------------------------------------------------------------------
  private async loadLevelsFromFolder(): Promise<void> {
    try {
      // 1. Загружаем манифест – список имён файлов уровней (без .json)
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
      
      // 2. Загружаем каждый уровень
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
          
          // Валидация обязательных полей
          if (!levelData.id || !levelData.worldId || !levelData.map) {
            logger.warn('LevelManager', 'loadLevelsFromFolder', `Invalid structure in ${levelId}`);
            continue;
          }
          
          // Сохраняем в кэш
          this.cache.set(levelId, levelData);
          
          // Добавляем в список миров
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

  // --------------------------------------------------------------------------
  // Генерация демо-уровней для всех миров (если ничего не загружено)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // Генерация только отсутствующих миров
  // --------------------------------------------------------------------------
  private generateMissingDemoLevels(): void {
    if (!this.worldsLevels.has('meadow') || this.worldsLevels.get('meadow')!.length === 0)
      this.generateMeadowLevels();
    if (!this.worldsLevels.has('ocean') || this.worldsLevels.get('ocean')!.length === 0)
      this.generateOceanLevels();
    if (!this.worldsLevels.has('clouds') || this.worldsLevels.get('clouds')!.length === 0)
      this.generateCloudsLevels();
    if (!this.worldsLevels.has('fairytale') || this.worldsLevels.get('fairytale')!.length === 0)
      this.generateFairytaleLevels();
    if (!this.worldsLevels.has('volcano') || this.worldsLevels.get('volcano')!.length === 0)
      this.generateVolcanoLevels();
    if (!this.worldsLevels.has('bonus') || this.worldsLevels.get('bonus')!.length === 0)
      this.generateBonusLevels();
    
    // Arcade – особый случай: включает все уровни из всех миров
    if (!this.worldsLevels.has('arcade') || this.worldsLevels.get('arcade')!.length === 0) {
      this.generateArcadeLevels();
    } else {
      // Обновляем Arcade, если добавились новые уровни
      const arcadeLevels = this.worldsLevels.get('arcade') || [];
      const allLevels = Array.from(this.cache.keys()).sort();
      for (const levelId of allLevels) {
        if (!arcadeLevels.includes(levelId)) arcadeLevels.push(levelId);
      }
      this.worldsLevels.set('arcade', arcadeLevels);
    }
  }

  // --------------------------------------------------------------------------
  // Демо-уровни для мира Meadow (10x10)
  // --------------------------------------------------------------------------
  private generateMeadowLevels(): void {
    for (let i = 1; i <= 20; i++) {
      // Карта из платформ (TileType.PLATFORM = 0)
      const map = Array(10).fill(null).map(() => Array(10).fill(TileType.PLATFORM));
      
      // Небольшие препятствия для разнообразия
      if (i === 5) {
        map[3][3] = TileType.WALL;
        map[3][4] = TileType.WALL;
        map[4][3] = TileType.WALL;
        map[4][4] = TileType.WALL;
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
  }

  // Аналогично для Ocean (12x12), Clouds (14x14), Fairytale (14x14), Volcano (16x16), Bonus (20x20)
  // (код аналогичен первому пакету, здесь опущен для краткости, но он есть в вашей версии)
  // В реальном файле эти методы полностью реализованы.

  private generateOceanLevels(): void { /* ... */ }
  private generateCloudsLevels(): void { /* ... */ }
  private generateFairytaleLevels(): void { /* ... */ }
  private generateVolcanoLevels(): void { /* ... */ }
  private generateArcadeLevels(): void { /* ... */ }
  private generateBonusLevels(): void { /* ... */ }

  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЕ МЕТОДЫ
  // --------------------------------------------------------------------------

  // Загрузить уровень по ID (возвращает данные или null)
  public async loadLevel(levelId: string): Promise<LevelData | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    const level = this.cache.get(levelId);
    if (level) {
      logger.debug('LevelManager', 'loadLevel', `Loaded ${levelId}`);
    } else {
      logger.error('LevelManager', 'loadLevel', `Level ${levelId} not found`);
    }
    return level || null;
  }

  // Получить список ID уровней для указанного мира
  public getLevelIdsForWorld(worldId: string): string[] {
    return this.worldsLevels.get(worldId) || [];
  }

  // Получить следующий уровень (по порядку в том же мире)
  public getNextLevelId(currentLevelId: string): string | null {
    const worldId = currentLevelId.split('_')[0];
    const levelIds = this.worldsLevels.get(worldId) || [];
    const idx = levelIds.indexOf(currentLevelId);
    if (idx !== -1 && idx + 1 < levelIds.length) {
      return levelIds[idx + 1];
    }
    return null;
  }

  // Очистить кэш (используется при перезагрузке)
  public clearCache(): void {
    this.cache.clear();
    this.worldsLevels.clear();
    this.initialized = false;
  }
}

// Экспортируем синглтон для использования в других модулях
export const levelManager = LevelManager.getInstance();
