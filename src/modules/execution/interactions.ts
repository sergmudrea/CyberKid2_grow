// src/modules/execution/interactions.ts
// ============================================================================
// ВЗАИМОДЕЙСТВИЕ С ОКРУЖЕНИЕМ – ПОЛНАЯ ВЕРСИЯ ПАТЧА 2.0
// ============================================================================
// Реализует команды:
// - PUSH – толкнуть кирпич (BRICK) в направлении башни
// - SCAN – сканировать область 3×3 вокруг игрока, выявить скрытые объекты
// - RIDE – оседлать приручённого монстра (если он стоит перед игроком)
// ============================================================================
// В патче 2.0 PUSH и RIDE используют направление башни, а не корпуса.
// ============================================================================

import { TileType, Point, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';

export class InteractionsExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private backdoorUsed: boolean;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.backdoorUsed = false;
  }

  // --------------------------------------------------------------------------
  // 1. PUSH – толкнуть кирпич (BRICK) в направлении башни
  // --------------------------------------------------------------------------
  public executePush(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    // Используем угол башни для направления толчка
    const turretAngle = this.player.getTurretAngle();
    let dx = 0, dy = 0;
    switch (turretAngle) {
      case 0:   dy = -1; break;
      case 90:  dx = 1;  break;
      case 180: dy = 1;  break;
      case 270: dx = -1; break;
      default:
        log('InteractionsExecutor', 'executePush', `Invalid turret angle ${turretAngle}`);
        return 'ok';
    }

    const playerPos = this.player.getPosition();
    const brickPos = {
      col: playerPos.col + dx,
      row: playerPos.row + dy,
    };
    const pushPos = {
      col: brickPos.col + dx,
      row: brickPos.row + dy,
    };

    const isBrick = this.level.map[brickPos.row]?.[brickPos.col] === TileType.BRICK;
    const isPushFree = this.level.map[pushPos.row]?.[pushPos.col] === TileType.PLATFORM;

    if (isBrick && isPushFree) {
      this.level.map[brickPos.row][brickPos.col] = TileType.PLATFORM;
      this.level.map[pushPos.row][pushPos.col] = TileType.BRICK;
      this.backdoorUsed = true;
      logInfo('InteractionsExecutor', 'executePush', `Pushed brick from (${brickPos.col},${brickPos.row}) to (${pushPos.col},${pushPos.row})`);
      eventBus.emit('BRICK_PUSHED', { from: brickPos, to: pushPos });
    } else {
      log('InteractionsExecutor', 'executePush', `Cannot push brick at (${brickPos.col},${brickPos.row})`);
    }

    return 'ok';
  }

  // --------------------------------------------------------------------------
  // 2. SCAN – сканировать область 3×3 вокруг игрока
  // --------------------------------------------------------------------------
  public executeScan(playerPos: Point): 'ok' {
    const objects: string[] = [];
    const width = this.level.width;
    const height = this.level.height;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const scanPos = { col: playerPos.col + dx, row: playerPos.row + dy };
        if (scanPos.col >= 0 && scanPos.col < width && scanPos.row >= 0 && scanPos.row < height) {
          const tile = this.level.map[scanPos.row][scanPos.col];
          if (tile === TileType.KEY) objects.push('key');
          else if (tile === TileType.CORN) objects.push('corn');
          else if (tile === TileType.CORE) objects.push('core');
          else if (tile === TileType.TOOL_DRILL) objects.push('drill');
          else if (tile === TileType.TOOL_HOOK) objects.push('hook');
          else if (tile === TileType.TOOL_WING) objects.push('wing');
          else if (tile === TileType.TOOL_BAIT) objects.push('bait');
          else if (tile === TileType.DOOR_LOCKED) objects.push('locked door');
          else if (tile === TileType.FAKE_WALL) objects.push('fake wall');
          else if (tile === TileType.TELEPORT_IN) objects.push('teleport');
          else if (tile === TileType.BRIDGE_ACTIVE) objects.push('active bridge');
          else if (tile === TileType.BLACK_BOX) objects.push('black box');
          else if (tile === TileType.MAGNET) objects.push('magnet');
          else if (tile === TileType.SLOW_FIELD) objects.push('slow field');
        }
      }
    }

    const hintText = `Scanned: ${objects.join(', ') || 'nothing'}`;
    logInfo('InteractionsExecutor', 'executeScan', hintText);
    eventBus.emit('HINT_SHOWN', { hintText, tier: 0 });
    eventBus.emit('SCAN_COMPLETE', { objects });
    return 'ok';
  }

  // --------------------------------------------------------------------------
  // 3. RIDE – оседлать приручённого монстра перед игроком (по направлению башни)
  // --------------------------------------------------------------------------
  public executeRide(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    const turretAngle = this.player.getTurretAngle();
    let dx = 0, dy = 0;
    switch (turretAngle) {
      case 0:   dy = -1; break;
      case 90:  dx = 1;  break;
      case 180: dy = 1;  break;
      case 270: dx = -1; break;
      default:
        log('InteractionsExecutor', 'executeRide', `Invalid turret angle ${turretAngle}`);
        return 'ok';
    }

    const targetPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };

    const monsters = this.level.objects?.monsters || [];
    const monster = monsters.find((m: any) =>
      m.position.col === targetPos.col && m.position.row === targetPos.row
    );

    if (monster && monster.isTamed && !monster.isRidden) {
      monster.isRidden = true;
      this.player.rideMonster(monster);
      this.backdoorUsed = true;
      logInfo('InteractionsExecutor', 'executeRide', `Riding monster at (${targetPos.col},${targetPos.row})`);
      eventBus.emit('MONSTER_RIDDEN', { monsterId: monster.id, pos: targetPos });
    } else {
      log('InteractionsExecutor', 'executeRide', `No tameable rideable monster at (${targetPos.col},${targetPos.row})`);
    }

    return 'ok';
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
