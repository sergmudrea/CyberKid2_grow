import { Point } from '../types/index';
import { UnitConfig, MovementRule } from './UnitLoader';
import { logger } from '../core/Logger';

export interface MovementContext {
  position: Point;
  direction: string;
  targetPosition?: Point;
  isBlocked: (col: number, row: number, unitId: string) => boolean;
  getTileType: (col: number, row: number) => string;
}

export class UnitMovementEngine {
  private config: UnitConfig;
  private context: MovementContext;
  private patrolIndex: number = 0;
  private patrolDirection: number = 1;

  constructor(config: UnitConfig, context: MovementContext) {
    this.config = config;
    this.context = context;
  }

  public getNextPosition(): Point | null {
    const rule = this.getMovementRule();
    if (!rule) return null;

    let delta: { col: number; row: number };

    if (rule.delta === 'adaptive') {
      delta = this.getAdaptiveDelta();
    } else if (rule.delta === 'random') {
      delta = this.getRandomDelta();
    } else {
      delta = rule.delta;
    }

    const newPos = {
      col: this.context.position.col + delta.col,
      row: this.context.position.row + delta.row,
    };

    if (this.canMoveTo(newPos, rule)) {
      return newPos;
    }

    if (rule.patrolPath) {
      return this.getPatrolNextPosition();
    }

    return null;
  }

  private getMovementRule(): MovementRule | null {
    if (this.config.behavior?.type === 'patrol') {
      return this.config.movementRules.find(r => r.direction === 'patrol') || null;
    }
    if (this.config.behavior?.type === 'chase') {
      return this.config.movementRules.find(r => r.direction === 'chase') || null;
    }
    if (this.config.behavior?.type === 'wander') {
      return this.config.movementRules.find(r => r.direction === 'wander') || null;
    }
    return this.config.movementRules[0] || null;
  }

  private getAdaptiveDelta(): { col: number; row: number } {
    if (!this.context.targetPosition) return { col: 0, row: 0 };
    
    const dx = Math.sign(this.context.targetPosition.col - this.context.position.col);
    const dy = Math.sign(this.context.targetPosition.row - this.context.position.row);
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return { col: dx, row: 0 };
    }
    return { col: 0, row: dy };
  }

  private getRandomDelta(): { col: number; row: number } {
    const dirs = [
      { col: 0, row: -1 },
      { col: 0, row: 1 },
      { col: -1, row: 0 },
      { col: 1, row: 0 },
    ];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }

  private getPatrolNextPosition(): Point | null {
    const rule = this.config.movementRules.find(r => r.patrolPath);
    if (!rule) return null;

    const steps = this.config.behavior?.patrolSteps || 2;
    const delta = rule.delta as { col: number; row: number };
    
    const newPos = {
      col: this.context.position.col + delta.col * this.patrolDirection,
      row: this.context.position.row + delta.row * this.patrolDirection,
    };

    this.patrolIndex++;
    if (this.patrolIndex >= steps) {
      this.patrolIndex = 0;
      this.patrolDirection *= -1;
    }

    if (this.canMoveTo(newPos, rule)) {
      return newPos;
    }
    return null;
  }

  private canMoveTo(pos: Point, rule: MovementRule): boolean {
    const tileType = this.context.getTileType(pos.col, pos.row);
    
    if (!rule.canMoveThrough.includes(tileType)) {
      return false;
    }
    
    if (this.context.isBlocked(pos.col, pos.row, this.config.id)) {
      return false;
    }
    
    return true;
  }

  public getEffects(): string[] {
    const rule = this.getMovementRule();
    return rule?.effects || [];
  }
}
