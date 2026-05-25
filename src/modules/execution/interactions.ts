// src/modules/execution/interactions.ts
// Команды взаимодействия: PUSH, SCAN, RIDE

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

  /**
   * PUSH — толкнуть кирпич в направлении взгляда
   */
  public executePush(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    const brickPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
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

  /**
   * SCAN — сканировать область 3x3 вокруг игрока, выдать информацию о скрытых объектах
   */
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
          if (tile === TileType.CORN) objects.push('corn');
          if (tile === TileType.CORE) objects.push('core');
          if (tile === TileType.TOOL_DRILL) objects.push('drill');
          if (tile === TileType.TOOL_HOOK) objects.push('hook');
          if (tile === TileType.TOOL_WING) objects.push('wing');
          if (tile === TileType.TOOL_BAIT) objects.push('bait');
          if (tile === TileType.DOOR_LOCKED) objects.push('locked door');
          if (tile === TileType.FAKE_WALL) objects.push('fake wall');
          if (tile === TileType.TELEPORT_IN) objects.push('teleport');
        }
      }
    }

    const hintText = `Scanned: ${objects.join(', ') || 'nothing'}`;
    logInfo('InteractionsExecutor', 'executeScan', hintText);
    eventBus.emit('HINT_SHOWN', { hintText, tier: 0 });
    eventBus.emit('SCAN_COMPLETE', { objects });

    return 'ok';
  }

  /**
   * RIDE — оседлать приручённого монстра перед игроком
   */
  public executeRide(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    const targetPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };

    const monster = this.level.objects.monsters?.find((m: any) =>
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
