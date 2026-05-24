import { logger } from '../core/Logger';

export interface MovementRule {
  direction: string;
  delta: { col: number; row: number } | 'adaptive' | 'random';
  canMoveThrough: string[];
  blockedBy: string[];
  effects: string[];
  patrolPath?: boolean;
}

export interface Behavior {
  type: string;
  speed?: number;
  patrolSteps?: number;
  turnsAround?: boolean;
  range?: number;
  target?: string;
  randomness?: number;
}

export interface Interaction {
  onCollision?: string;
  onFeed?: string;
  feedItem?: string;
  afterTameBehavior?: string;
}

export interface UnitConfig {
  id: string;
  name: string;
  sprite: string;
  gridSize: number;
  commands: string[];
  movementRules: MovementRule[];
  behavior?: Behavior;
  deathConditions: string[];
  inventory?: {
    maxKeys: number;
    maxCorn: number;
    maxCores: number;
    maxTools: number;
  };
  interaction?: Interaction;
}

export class UnitLoader {
  private static instance: UnitLoader;
  private units: Map<string, UnitConfig> = new Map();

  private constructor() {}

  public static getInstance(): UnitLoader {
    if (!UnitLoader.instance) {
      UnitLoader.instance = new UnitLoader();
    }
    return UnitLoader.instance;
  }

  public async loadUnit(unitId: string): Promise<UnitConfig | null> {
    if (this.units.has(unitId)) {
      return this.units.get(unitId)!;
    }

    try {
      const response = await fetch(`/units/${unitId}.json`);
      if (!response.ok) {
        logger.warn('UnitLoader', 'loadUnit', `Unit ${unitId} not found`);
        return null;
      }
      const config: UnitConfig = await response.json();
      this.units.set(unitId, config);
      logger.info('UnitLoader', 'loadUnit', `Loaded unit: ${unitId} (${config.name})`);
      return config;
    } catch (error) {
      logger.error('UnitLoader', 'loadUnit', `Failed to load unit ${unitId}`, error);
      return null;
    }
  }

  public getUnit(unitId: string): UnitConfig | undefined {
    return this.units.get(unitId);
  }

  public getAllUnits(): UnitConfig[] {
    return Array.from(this.units.values());
  }
}

export const unitLoader = UnitLoader.getInstance();
