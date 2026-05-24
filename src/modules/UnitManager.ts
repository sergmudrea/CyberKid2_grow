import { Scene } from 'phaser';
import { Point } from '../types/index';
import { UnitLoader, UnitConfig } from './UnitLoader';
import { UnitMovementEngine, MovementContext } from './UnitMovementEngine';
import { logger } from '../core/Logger';

interface UnitInstance {
  id: string;
  config: UnitConfig;
  position: Point;
  direction: string;
  sprite: Phaser.GameObjects.Sprite;
  movementEngine: UnitMovementEngine;
  isTamed: boolean;
  isAlive: boolean;
}

export class UnitManager {
  private static instance: UnitManager;
  private scene: Scene;
  private units: Map<string, UnitInstance> = new Map();
  private gridSize: number = 48;

  private constructor() {}

  public static getInstance(): UnitManager {
    if (!UnitManager.instance) {
      UnitManager.instance = new UnitManager();
    }
    return UnitManager.instance;
  }

  public init(scene: Scene, gridSize: number): void {
    this.scene = scene;
    this.gridSize = gridSize;
  }

  public async spawnUnit(
    unitId: string,
    position: Point,
    direction: string = 'right'
  ): Promise<string | null> {
    const config = await UnitLoader.getInstance().loadUnit(unitId);
    if (!config) {
      logger.error('UnitManager', 'spawnUnit', `Unknown unit: ${unitId}`);
      return null;
    }

    const instanceId = `${unitId}_${Date.now()}_${Math.random()}`;
    const sprite = this.scene.add.sprite(
      position.col * this.gridSize,
      position.row * this.gridSize,
      config.sprite
    );
    sprite.setOrigin(0, 0);
    sprite.setDisplaySize(this.gridSize, this.gridSize);

    const movementContext: MovementContext = {
      position: { ...position },
      direction,
      isBlocked: (col, row, unitId) => this.isPositionBlocked(col, row, unitId),
      getTileType: (col, row) => this.getTileType(col, row),
    };

    const movementEngine = new UnitMovementEngine(config, movementContext);

    const instance: UnitInstance = {
      id: instanceId,
      config,
      position: { ...position },
      direction,
      sprite,
      movementEngine,
      isTamed: false,
      isAlive: true,
    };

    this.units.set(instanceId, instance);
    logger.debug('UnitManager', 'spawnUnit', `Spawned ${unitId} at (${position.col},${position.row})`);
    
    return instanceId;
  }

  public updateUnit(instanceId: string, targetPosition?: Point): void {
    const instance = this.units.get(instanceId);
    if (!instance || !instance.isAlive) return;

    // Обновляем контекст движения
    const context: MovementContext = {
      position: instance.position,
      direction: instance.direction,
      targetPosition,
      isBlocked: (col, row, uid) => this.isPositionBlocked(col, row, uid),
      getTileType: (col, row) => this.getTileType(col, row),
    };
    
    // Пересоздаём движок с новым контекстом
    const newEngine = new UnitMovementEngine(instance.config, context);
    const nextPos = newEngine.getNextPosition();
    const effects = newEngine.getEffects();

    if (nextPos) {
      instance.position = nextPos;
      instance.sprite.setPosition(nextPos.col * this.gridSize, nextPos.row * this.gridSize);
      
      // Применяем эффекты
      this.applyEffects(instance, effects);
    }
  }

  private applyEffects(instance: UnitInstance, effects: string[]): void {
    for (const effect of effects) {
      if (effect === 'kill_player_on_collision' && !instance.isTamed) {
        // Сигнал о смерти игрока
        this.scene.events.emit('player_killed_by_monster', instance.id);
      }
    }
  }

  public tameUnit(instanceId: string): void {
    const instance = this.units.get(instanceId);
    if (instance && instance.config.interaction?.onFeed === 'tame') {
      instance.isTamed = true;
      logger.info('UnitManager', 'tameUnit', `Unit ${instanceId} is now tamed`);
    }
  }

  public killUnit(instanceId: string): void {
    const instance = this.units.get(instanceId);
    if (instance) {
      instance.isAlive = false;
      instance.sprite.destroy();
      this.units.delete(instanceId);
      logger.debug('UnitManager', 'killUnit', `Unit ${instanceId} destroyed`);
    }
  }

  private isPositionBlocked(col: number, row: number, excludeUnitId: string): boolean {
    for (const [id, instance] of this.units) {
      if (id !== excludeUnitId && instance.isAlive) {
        if (instance.position.col === col && instance.position.row === row) {
          return true;
        }
      }
    }
    return false;
  }

  private getTileType(col: number, row: number): string {
    // Заглушка — в реальности нужно получать тип тайла из LevelData
    return 'platform';
  }

  public getAllUnits(): UnitInstance[] {
    return Array.from(this.units.values());
  }

  public clear(): void {
    for (const instance of this.units.values()) {
      instance.sprite.destroy();
    }
    this.units.clear();
  }
}

export const unitManager = UnitManager.getInstance();
