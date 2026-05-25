import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { InventoryUI } from '../modules/InventoryUI';
import { LevelData, TileType, Inventory } from '../types/index';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { logger } from '../core/Logger';

export class GameScene extends Scene {
  private level: LevelData | null = null;
  private originalLevelData: LevelData | null = null;
  private levelId: string = '';
  private playerPos: { col: number; row: number };
  private coinPos: { col: number; row: number };
  private gridSize: number = 48;
  private playerSprite: Phaser.GameObjects.Sprite;
  private commandPanel: CommandPanel;
  private visualizer: ProgramVisualizer;
  private inventoryUI: InventoryUI;
  private isRunning: boolean = false;
  private isBroken: boolean = false;
  private isVictory: boolean = false;
  private gameContainer: Phaser.GameObjects.Container;
  private gameBounds: { width: number; height: number };
  private gameOffsetX: number = 0;
  private gameOffsetY: number = 0;
  private lastInputTime: number = 0;
  private isPlayerControlled: boolean = false;
  private currentCommandIndex: number = -1;
  private failedCommandIndex: number = -1;
  private needScroll: boolean = false;
  private scrollX: number = 0;
  private scrollY: number = 0;
  private inventory: Inventory = {
    keys: [],
    corn: 0,
    cores: 0,
    hasDrill: false,
    hasHook: false,
    hasWing: false,
    hasBait: false,
    tools: [],
  };
  private lastDirection: 'up' | 'down' | 'left' | 'right' = 'right';
  private timeMultiplier: number = 1;
  private speedLevel: number = 1;

  constructor() {
    super('GameScene');
  }

  async init(data: { levelId: string }): Promise<void> {
    logger.debug('GameScene', 'init', `Initializing with levelId: ${data.levelId}`);
    this.levelId = data.levelId;
    const loadedLevel = await levelManager.loadLevel(this.levelId);
    
    if (!loadedLevel) {
      logger.error('GameScene', 'init', `Level not found: ${this.levelId}`);
      this.scene.start('MainMenu');
      return;
    }
    
    this.originalLevelData = JSON.parse(JSON.stringify(loadedLevel));
    this.level = JSON.parse(JSON.stringify(loadedLevel));
    
    this.playerPos = { ...this.level.startPos };
    this.coinPos = { ...this.level.coinPos };
    this.isRunning = false;
    this.isBroken = false;
    this.isVictory = false;
    this.lastInputTime = 0;
    this.isPlayerControlled = false;
    this.currentCommandIndex = -1;
    this.failedCommandIndex = -1;
    this.scrollX = 0;
    this.scrollY = 0;
    this.inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
    this.lastDirection = 'right';
    this.timeMultiplier = 1;
    this.speedLevel = 1;
    
    logger.info('GameScene', 'init', `Level loaded: ${this.levelId} (${this.level.name}), coin at (${this.coinPos.col},${this.coinPos.row})`);
    this.createScene();
  }

  private resetLevel(): void {
    if (!this.originalLevelData) return;
    this.level = JSON.parse(JSON.stringify(this.originalLevelData));
    this.playerPos = { ...this.level.startPos };
    this.coinPos = { ...this.level.coinPos };
    this.isBroken = false;
    this.isVictory = false;
    this.currentCommandIndex = -1;
    this.failedCommandIndex = -1;
    this.inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
    this.lastDirection = 'right';
    this.timeMultiplier = 1;
    this.speedLevel = 1;
    
    if (this.inventoryUI) {
      this.inventoryUI.updateInventory(this.inventory);
    }
    
    this.gameContainer.removeAll(true);
    this.drawGrid();
    this.drawPlayer();
  }

  private createScene(): void {
    if (!this.level) {
      logger.error('GameScene', 'createScene', 'No level data');
      return;
    }
    
    this.gameContainer = this.add.container(0, 0);
    
    this.gameBounds = {
      width: this.level.width * this.gridSize,
      height: this.level.height * this.gridSize
    };
    
    this.gameOffsetX = (this.cameras.main.width - this.gameBounds.width) / 2;
    this.gameOffsetY = (this.cameras.main.height - this.gameBounds.height) / 2;
    
    logger.debug('GameScene', 'createScene', `Game offset X: ${this.gameOffsetX}, Y: ${this.gameOffsetY}`);
    
    this.gameContainer.setPosition(this.gameOffsetX, this.gameOffsetY);
    
    this.drawGrid();
    this.drawPlayer();

    this.needScroll = this.gameBounds.width > this.cameras.main.width || this.gameBounds.height > this.cameras.main.height;
    
    if (this.needScroll) {
      this.gameContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.gameBounds.width, this.gameBounds.height), Phaser.Geom.Rectangle.Contains);
      this.input.setDraggable(this.gameContainer);
      this.input.on('drag', (pointer: any, gameObject: any, dragX: number, dragY: number) => {
        this.scrollX = dragX;
        this.scrollY = dragY;
        this.updateContainerPosition();
      });
      
      this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
        this.scrollX -= deltaX;
        this.scrollY -= deltaY;
        this.updateContainerPosition();
      });
      
      this.input.keyboard?.on('keydown-LEFT', () => {
        this.scrollX += 30;
        this.updateContainerPosition();
      });
      this.input.keyboard?.on('keydown-RIGHT', () => {
        this.scrollX -= 30;
        this.updateContainerPosition();
      });
      this.input.keyboard?.on('keydown-UP', () => {
        this.scrollY += 30;
        this.updateContainerPosition();
      });
      this.input.keyboard?.on('keydown-DOWN', () => {
        this.scrollY -= 30;
        this.updateContainerPosition();
      });
    }

    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => {
        this.resetLevel();
        this.visualizer.clear();
        this.isBroken = false;
        this.isVictory = false;
        this.currentCommandIndex = -1;
        this.failedCommandIndex = -1;
        this.commandPanel.clearHighlight();
        this.updateVisualizer();
        this.resetScroll();
      },
      (commands: Command[]) => {
        this.updateVisualizer();
      }
    );

    this.visualizer = new ProgramVisualizer(this, this.gridSize);
    this.updateVisualizer();
    
    this.inventoryUI = new InventoryUI(this, this.inventory);

    const autoSolveButton = this.add.text(10, 60, '🤖 AUTO', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#aa8844',
      padding: { x: 12, y: 6 },
      depth: 100,
    }).setInteractive({ useHandCursor: true });
    autoSolveButton.on('pointerdown', () => {
      if (!this.level) return;
      const commands: Command[] = [];
      for (let i = 0; i < this.level.coinPos.col; i++) commands.push('right');
      for (let i = 0; i < this.level.coinPos.row; i++) commands.push('down');
      this.commandPanel.setCommands(commands);
      this.updateVisualizer();
      logger.info('GameScene', 'autoSolve', `Auto-solve program created: ${commands.length} commands`);
    });
    autoSolveButton.setScrollFactor(0);
    autoSolveButton.setDepth(100);

    // Кнопки управления временем
    const timeSlowButton = this.add.text(10, 100, '🐢 TIME SLOW', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 8, y: 4 },
      depth: 100,
    }).setInteractive({ useHandCursor: true });
    timeSlowButton.on('pointerdown', () => {
      this.timeMultiplier = 0.5;
      logger.info('GameScene', 'timeSlow', 'Time slowed down');
    });
    timeSlowButton.setScrollFactor(0);
    timeSlowButton.setDepth(100);

    const timeFastButton = this.add.text(10, 135, '🐇 TIME FAST', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 8, y: 4 },
      depth: 100,
    }).setInteractive({ useHandCursor: true });
    timeFastButton.on('pointerdown', () => {
      this.timeMultiplier = 2;
      logger.info('GameScene', 'timeFast', 'Time sped up');
    });
    timeFastButton.setScrollFactor(0);
    timeFastButton.setDepth(100);

    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
      depth: 100,
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.inventoryUI.destroy();
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    });
    backButton.setScrollFactor(0);
    backButton.setDepth(100);
  }
  
  private updateContainerPosition(): void {
    const minX = this.cameras.main.width - this.gameBounds.width;
    const minY = this.cameras.main.height - this.gameBounds.height;
    const maxX = this.gameOffsetX;
    const maxY = this.gameOffsetY;
    
    let newX = this.gameOffsetX + this.scrollX;
    let newY = this.gameOffsetY + this.scrollY;
    
    newX = Math.max(Math.min(newX, maxX), minX);
    newY = Math.max(Math.min(newY, maxY), minY);
    
    this.gameContainer.setPosition(newX, newY);
  }
  
  private resetScroll(): void {
    this.scrollX = 0;
    this.scrollY = 0;
    this.gameContainer.setPosition(this.gameOffsetX, this.gameOffsetY);
  }

  private updateVisualizer(): void {
    if (!this.level) return;
    const commands = this.commandPanel.getCommands();
    this.visualizer.updateVisuals(
      commands,
      this.level.startPos.col,
      this.level.startPos.row,
      this.level.width,
      this.level.height,
      this.gridSize,
      this.gameOffsetX,
      this.gameOffsetY
    );
  }

  private runProgram(commands: Command[]): void {
    if (this.isRunning) return;
    if (this.isVictory) {
      alert('You already won! Start a new game.');
      return;
    }
    this.resetLevel();
    this.isRunning = true;
    this.isBroken = false;
    this.currentCommandIndex = -1;
    this.failedCommandIndex = -1;
    this.commandPanel.clearHighlight();
    this.executeCommands(commands, 0);
  }

  private async applyConveyorEffect(col: number, row: number): Promise<{ newCol: number; newRow: number; moved: boolean }> {
    if (!this.level) return { newCol: col, newRow: row, moved: false };
    const tile = this.level.map[row]?.[col];
    let dx = 0, dy = 0;
    
    if (tile === TileType.CONVEYOR_UP) dy = -1;
    else if (tile === TileType.CONVEYOR_DOWN) dy = 1;
    else if (tile === TileType.CONVEYOR_LEFT) dx = -1;
    else if (tile === TileType.CONVEYOR_RIGHT) dx = 1;
    else return { newCol: col, newRow: row, moved: false };
    
    const newCol = col + dx;
    const newRow = row + dy;
    const targetTile = this.level.map[newRow]?.[newCol];
    const isBlocked = targetTile === TileType.WALL || targetTile === TileType.HOLE || targetTile === TileType.BRICK;
    
    if (!isBlocked && newCol >= 0 && newCol < this.level.width && newRow >= 0 && newRow < this.level.height) {
      this.playerPos = { col: newCol, row: newRow };
      this.drawPlayer();
      logger.debug('GameScene', 'applyConveyorEffect', `Conveyor moved player to (${newCol},${newRow})`);
      return this.applyConveyorEffect(newCol, newRow);
    }
    
    return { newCol: col, newRow: row, moved: false };
  }

  private async applyTeleportEffect(col: number, row: number): Promise<{ newCol: number; newRow: number; teleported: boolean }> {
    if (!this.level || !this.level.objects.teleports) return { newCol: col, newRow: row, teleported: false };
    
    const teleport = this.level.objects.teleports.find(t => t.entry.col === col && t.entry.row === row);
    if (teleport) {
      const exitTile = this.level.map[teleport.exit.row]?.[teleport.exit.col];
      const isExitBlocked = exitTile === TileType.WALL || exitTile === TileType.HOLE || exitTile === TileType.BRICK;
      
      if (!isExitBlocked) {
        this.playerPos = { col: teleport.exit.col, row: teleport.exit.row };
        this.drawPlayer();
        logger.info('GameScene', 'applyTeleportEffect', `Teleported from (${col},${row}) to (${teleport.exit.col},${teleport.exit.row})`);
        return { newCol: teleport.exit.col, newRow: teleport.exit.row, teleported: true };
      }
    }
    return { newCol: col, newRow: row, teleported: false };
  }

  private async applySpringEffect(col: number, row: number, direction: 'up' | 'down' | 'left' | 'right'): Promise<{ newCol: number; newRow: number; jumped: boolean }> {
    if (!this.level) return { newCol: col, newRow: row, jumped: false };
    const tile = this.level.map[row]?.[col];
    if (tile !== TileType.SPRING) return { newCol: col, newRow: row, jumped: false };
    
    let dx = 0, dy = 0;
    const jumpForce = 3;
    
    if (direction === 'up') dy = -jumpForce;
    else if (direction === 'down') dy = jumpForce;
    else if (direction === 'left') dx = -jumpForce;
    else if (direction === 'right') dx = jumpForce;
    
    const newCol = Math.max(0, Math.min(col + dx, this.level.width - 1));
    const newRow = Math.max(0, Math.min(row + dy, this.level.height - 1));
    const targetTile = this.level.map[newRow]?.[newCol];
    const isBlocked = targetTile === TileType.WALL || targetTile === TileType.HOLE || targetTile === TileType.BRICK;
    
    if (!isBlocked) {
      this.playerPos = { col: newCol, row: newRow };
      this.drawPlayer();
      logger.info('GameScene', 'applySpringEffect', `Spring launched player to (${newCol},${newRow})`);
      return { newCol: newCol, newRow: newRow, jumped: true };
    }
    
    return { newCol: col, newRow: row, jumped: false };
  }

  private async executeCommands(commands: Command[], index: number): Promise<void> {
    if (!this.level) return;
    
    if (this.isVictory) {
      this.isRunning = false;
      return;
    }
    if (this.isBroken) {
      this.isRunning = false;
      this.commandPanel.highlightCommand(this.failedCommandIndex, 'error');
      this.showBrokenMessage();
      return;
    }
    if (index >= commands.length) {
      this.isRunning = false;
      this.commandPanel.clearHighlight();
      if (!this.isVictory && !this.isBroken) {
        this.checkVictory();
      }
      return;
    }

    this.currentCommandIndex = index;
    this.commandPanel.highlightCommand(index, 'running');

    const cmd = commands[index];
    
    // Обработка специальных команд
    if (cmd === 'push') {
      this.executePush();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'use_key') {
      this.executeUseKey();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'pickup') {
      this.executePickup();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'drill') {
      this.executeDrill();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'hook') {
      this.executeHook();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'wing') {
      this.executeWing();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'bait') {
      this.executeBait();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'throw') {
      this.executeThrow();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'feed') {
      this.executeFeed();
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'time_slow') {
      this.timeMultiplier = 0.5;
      await this.delay(80);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'time_fast') {
      this.timeMultiplier = 2;
      await this.delay(80);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    if (cmd === 'wait') {
      await this.delay(1000 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    // Движение
    let dx = 0, dy = 0;
    if (cmd === 'up') { dy = -1; this.lastDirection = 'up'; }
    if (cmd === 'down') { dy = 1; this.lastDirection = 'down'; }
    if (cmd === 'left') { dx = -1; this.lastDirection = 'left'; }
    if (cmd === 'right') { dx = 1; this.lastDirection = 'right'; }

    const targetCol = this.playerPos.col + dx;
    const targetRow = this.playerPos.row + dy;
    const collisionCell = { col: targetCol, row: targetRow };
    
    const tile = this.level.map[targetRow]?.[targetCol];
    const isWall = tile === TileType.WALL;
    const isHole = tile === TileType.HOLE;
    const isBrick = tile === TileType.BRICK;
    const isDoorLocked = tile === TileType.DOOR_LOCKED;
    const isKey = tile === TileType.KEY;
    const isCorn = tile === TileType.CORN;
    const isCore = tile === TileType.CORE;
    const isDrill = tile === TileType.TOOL_DRILL;
    const isHook = tile === TileType.TOOL_HOOK;
    const isWing = tile === TileType.TOOL_WING;
    const isBait = tile === TileType.TOOL_BAIT;
    const isLava = tile === TileType.LAVA;
    const isWater = tile === TileType.WATER;
    const isOutOfBounds = targetCol < 0 || targetCol >= this.level.width || targetRow < 0 || targetRow >= this.level.height;

    logger.debug('GameScene', 'executeCommands', `Step ${index + 1}/${commands.length}: ${cmd} from (${this.playerPos.col},${this.playerPos.row}) to (${targetCol},${targetRow})`);

    // Проверка на лаву/воду (смерть)
    if ((isLava || isWater) && !this.inventory.hasWing && !this.isPlayerControlled) {
      logger.info('GameScene', 'executeCommands', `💀 Player died in ${tile === TileType.LAVA ? 'lava' : 'water'} at (${targetCol},${targetRow})`);
      this.isBroken = true;
      this.failedCommandIndex = index;
      this.commandPanel.highlightCommand(index, 'error');
      this.showGhostAt(collisionCell);
      this.showBrokenMessage();
      this.isRunning = false;
      return;
    }
    
    // Проверка на яму (смерть)
    if (isHole && !this.inventory.hasWing && !this.isPlayerControlled) {
      logger.info('GameScene', 'executeCommands', `💀 Player fell into hole at (${targetCol},${targetRow})`);
      this.isBroken = true;
      this.failedCommandIndex = index;
      this.commandPanel.highlightCommand(index, 'error');
      this.showGhostAt(collisionCell);
      this.showBrokenMessage();
      this.isRunning = false;
      return;
    }
    
    // Проверка на закрытую дверь
    if (isDoorLocked && this.inventory.keys.length === 0) {
      logger.debug('GameScene', 'executeCommands', `Locked door at (${targetCol},${targetRow}), need key`);
      this.isBroken = true;
      this.failedCommandIndex = index;
      this.commandPanel.highlightCommand(index, 'error');
      this.showGhostAt(collisionCell);
      this.showBrokenMessage();
      this.isRunning = false;
      return;
    }
    
    // Сбор предметов при движении
    if (isKey) {
      this.inventory.keys.push(`key_${targetCol}_${targetRow}`);
      this.level.map[targetRow][targetCol] = TileType.PLATFORM;
      this.redrawCell(targetCol, targetRow);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeCommands', `Picked up key, total keys: ${this.inventory.keys.length}`);
      this.showPickupEffect(targetCol, targetRow);
    }
    
    if (isCorn) {
      this.inventory.corn++;
      this.level.map[targetRow][targetCol] = TileType.PLATFORM;
      this.redrawCell(targetCol, targetRow);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeCommands', `Picked up corn, total: ${this.inventory.corn}`);
      this.showPickupEffect(targetCol, targetRow);
    }
    
    if (isCore) {
      this.inventory.cores++;
      this.level.map[targetRow][targetCol] = TileType.PLATFORM;
      this.redrawCell(targetCol, targetRow);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeCommands', `Picked up core, total: ${this.inventory.cores}`);
      this.showPickupEffect(targetCol, targetRow);
    }
    
    if (isDrill) {
      this.inventory.hasDrill = true;
      this.inventory.tools.push('drill');
      this.level.map[targetRow][targetCol] = TileType.PLATFORM;
      this.redrawCell(targetCol, targetRow);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeCommands', `Picked up drill`);
      this.showPickupEffect(targetCol, targetRow);
    }
    
    if (isHook) {
      this.inventory.hasHook = true;
      this.inventory.tools.push('hook');
      this.level.map[targetRow][targetCol] = TileType.PLATFORM;
      this.redrawCell(targetCol, targetRow);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeCommands', `Picked up hook`);
      this.showPickupEffect(targetCol, targetRow);
    }
    
    if (isWing) {
      this.inventory.hasWing = true;
      this.inventory.tools.push('wing');
      this.level.map[targetRow][targetCol] = TileType.PLATFORM;
      this.redrawCell(targetCol, targetRow);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeCommands', `Picked up wing`);
      this.showPickupEffect(targetCol, targetRow);
    }
    
    if (isBait) {
      this.inventory.hasBait = true;
      this.inventory.tools.push('bait');
      this.level.map[targetRow][targetCol] = TileType.PLATFORM;
      this.redrawCell(targetCol, targetRow);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeCommands', `Picked up bait`);
      this.showPickupEffect(targetCol, targetRow);
    }

    if (!isWall && !isHole && !isBrick && !isOutOfBounds && !isLava && !isWater) {
      this.playerPos = { col: targetCol, row: targetRow };
      this.drawPlayer();
      
      // Применяем эффект телепорта
      const teleportResult = await this.applyTeleportEffect(this.playerPos.col, this.playerPos.row);
      if (teleportResult.teleported) {
        this.drawPlayer();
      }
      
      // Применяем эффект конвейера
      const conveyorResult = await this.applyConveyorEffect(this.playerPos.col, this.playerPos.row);
      if (conveyorResult.moved) {
        this.drawPlayer();
      }
      
      // Применяем эффект пружины (если направление задано)
      const springResult = await this.applySpringEffect(this.playerPos.col, this.playerPos.row, this.lastDirection);
      if (springResult.jumped) {
        this.drawPlayer();
      }
      
      if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
        logger.info('GameScene', 'executeCommands', `🏆 VICTORY! Reached coin at (${this.playerPos.col},${this.playerPos.row})`);
        this.isVictory = true;
        this.isRunning = false;
        this.commandPanel.clearHighlight();
        
        const stars = this.calculateStars();
        const steps = this.currentCommandIndex + 1;
        progressManager.completeLevel(this.levelId, stars, steps);
        
        this.showVictoryMessage();
        return;
      }
      
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
    } else if (isBrick) {
      logger.debug('GameScene', 'executeCommands', `Brick at (${targetCol},${targetRow}), use PUSH command to move it`);
      this.isBroken = true;
      this.failedCommandIndex = index;
      this.commandPanel.highlightCommand(index, 'error');
      this.showGhostAt(collisionCell);
      this.showBrokenMessage();
      this.isRunning = false;
    } else if (isDoorLocked && this.inventory.keys.length > 0) {
      // Открываем дверь при движении, если есть ключ
      this.level.map[targetRow][targetCol] = TileType.DOOR_UNLOCKED;
      this.redrawCell(targetCol, targetRow);
      logger.info('GameScene', 'executeCommands', `Door unlocked at (${targetCol},${targetRow})`);
      this.playerPos = { col: targetCol, row: targetRow };
      this.drawPlayer();
      
      const teleportResult = await this.applyTeleportEffect(this.playerPos.col, this.playerPos.row);
      if (teleportResult.teleported) this.drawPlayer();
      
      const conveyorResult = await this.applyConveyorEffect(this.playerPos.col, this.playerPos.row);
      if (conveyorResult.moved) this.drawPlayer();
      
      await this.delay(80 / this.timeMultiplier);
      this.executeCommands(commands, index + 1);
    } else {
      logger.warn('GameScene', 'executeCommands', `💥 Collision at step ${index + 1}: ${cmd} to (${targetCol},${targetRow})`);
      this.isBroken = true;
      this.failedCommandIndex = index;
      this.commandPanel.highlightCommand(index, 'error');
      this.showGhostAt(collisionCell);
      this.showBrokenMessage();
      this.isRunning = false;
    }
  }

  private executePush(): void {
    if (!this.level) return;
    let dx = 0, dy = 0;
    if (this.lastDirection === 'up') dy = -1;
    if (this.lastDirection === 'down') dy = 1;
    if (this.lastDirection === 'left') dx = -1;
    if (this.lastDirection === 'right') dx = 1;
    
    const brickCol = this.playerPos.col + dx;
    const brickRow = this.playerPos.row + dy;
    const pushCol = brickCol + dx;
    const pushRow = brickRow + dy;
    
    const isBrick = this.level.map[brickRow]?.[brickCol] === TileType.BRICK;
    const isPushFree = this.level.map[pushRow]?.[pushCol] === TileType.PLATFORM;
    
    if (isBrick && isPushFree) {
      this.level.map[brickRow][brickCol] = TileType.PLATFORM;
      this.level.map[pushRow][pushCol] = TileType.BRICK;
      this.redrawCell(brickCol, brickRow);
      this.redrawCell(pushCol, pushRow);
      logger.info('GameScene', 'executePush', `Pushed brick from (${brickCol},${brickRow}) to (${pushCol},${pushRow})`);
    }
  }

  private executeUseKey(): void {
    if (!this.level) return;
    let dx = 0, dy = 0;
    if (this.lastDirection === 'up') dy = -1;
    if (this.lastDirection === 'down') dy = 1;
    if (this.lastDirection === 'left') dx = -1;
    if (this.lastDirection === 'right') dx = 1;
    
    const doorCol = this.playerPos.col + dx;
    const doorRow = this.playerPos.row + dy;
    const tile = this.level.map[doorRow]?.[doorCol];
    
    if (tile === TileType.DOOR_LOCKED && this.inventory.keys.length > 0) {
      this.level.map[doorRow][doorCol] = TileType.DOOR_UNLOCKED;
      this.redrawCell(doorCol, doorRow);
      this.inventory.keys.pop();
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeUseKey', `Door unlocked at (${doorCol},${doorRow})`);
      this.showPickupEffect(doorCol, doorRow);
    }
  }

  private executePickup(): void {
    if (!this.level) return;
    const tile = this.level.map[this.playerPos.row][this.playerPos.col];
    
    if (tile === TileType.KEY) {
      this.inventory.keys.push(`key_${this.playerPos.col}_${this.playerPos.row}`);
      this.level.map[this.playerPos.row][this.playerPos.col] = TileType.PLATFORM;
      this.redrawCell(this.playerPos.col, this.playerPos.row);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executePickup', `Picked up key`);
      this.showPickupEffect(this.playerPos.col, this.playerPos.row);
    } else if (tile === TileType.CORN) {
      this.inventory.corn++;
      this.level.map[this.playerPos.row][this.playerPos.col] = TileType.PLATFORM;
      this.redrawCell(this.playerPos.col, this.playerPos.row);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executePickup', `Picked up corn`);
      this.showPickupEffect(this.playerPos.col, this.playerPos.row);
    } else if (tile === TileType.CORE) {
      this.inventory.cores++;
      this.level.map[this.playerPos.row][this.playerPos.col] = TileType.PLATFORM;
      this.redrawCell(this.playerPos.col, this.playerPos.row);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executePickup', `Picked up core`);
      this.showPickupEffect(this.playerPos.col, this.playerPos.row);
    } else if (tile === TileType.TOOL_DRILL) {
      this.inventory.hasDrill = true;
      this.inventory.tools.push('drill');
      this.level.map[this.playerPos.row][this.playerPos.col] = TileType.PLATFORM;
      this.redrawCell(this.playerPos.col, this.playerPos.row);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executePickup', `Picked up drill`);
      this.showPickupEffect(this.playerPos.col, this.playerPos.row);
    } else if (tile === TileType.TOOL_HOOK) {
      this.inventory.hasHook = true;
      this.inventory.tools.push('hook');
      this.level.map[this.playerPos.row][this.playerPos.col] = TileType.PLATFORM;
      this.redrawCell(this.playerPos.col, this.playerPos.row);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executePickup', `Picked up hook`);
      this.showPickupEffect(this.playerPos.col, this.playerPos.row);
    } else if (tile === TileType.TOOL_WING) {
      this.inventory.hasWing = true;
      this.inventory.tools.push('wing');
      this.level.map[this.playerPos.row][this.playerPos.col] = TileType.PLATFORM;
      this.redrawCell(this.playerPos.col, this.playerPos.row);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executePickup', `Picked up wing`);
      this.showPickupEffect(this.playerPos.col, this.playerPos.row);
    } else if (tile === TileType.TOOL_BAIT) {
      this.inventory.hasBait = true;
      this.inventory.tools.push('bait');
      this.level.map[this.playerPos.row][this.playerPos.col] = TileType.PLATFORM;
      this.redrawCell(this.playerPos.col, this.playerPos.row);
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executePickup', `Picked up bait`);
      this.showPickupEffect(this.playerPos.col, this.playerPos.row);
    }
  }

  private executeDrill(): void {
    if (!this.level || !this.inventory.hasDrill) return;
    let dx = 0, dy = 0;
    if (this.lastDirection === 'up') dy = -1;
    if (this.lastDirection === 'down') dy = 1;
    if (this.lastDirection === 'left') dx = -1;
    if (this.lastDirection === 'right') dx = 1;
    
    const wallCol = this.playerPos.col + dx;
    const wallRow = this.playerPos.row + dy;
    const tile = this.level.map[wallRow]?.[wallCol];
    
    if (tile === TileType.WALL || tile === TileType.FAKE_WALL) {
      this.level.map[wallRow][wallCol] = TileType.PLATFORM;
      this.redrawCell(wallCol, wallRow);
      this.inventory.hasDrill = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'drill');
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeDrill', `Wall destroyed at (${wallCol},${wallRow})`);
      this.showPickupEffect(wallCol, wallRow);
    }
  }

  private executeHook(): void {
    if (!this.level || !this.inventory.hasHook) return;
    let dx = 0, dy = 0;
    if (this.lastDirection === 'up') dy = -1;
    if (this.lastDirection === 'down') dy = 1;
    if (this.lastDirection === 'left') dx = -1;
    if (this.lastDirection === 'right') dx = 1;
    
    // Ищем стену в направлении взгляда на расстоянии до 3 клеток
    let wallCol = this.playerPos.col;
    let wallRow = this.playerPos.row;
    let found = false;
    
    for (let i = 1; i <= 3; i++) {
      const checkCol = this.playerPos.col + dx * i;
      const checkRow = this.playerPos.row + dy * i;
      const tile = this.level.map[checkRow]?.[checkCol];
      if (tile === TileType.WALL || tile === TileType.FAKE_WALL) {
        wallCol = checkCol;
        wallRow = checkRow;
        found = true;
        break;
      }
    }
    
    if (found && (wallCol !== this.playerPos.col || wallRow !== this.playerPos.row)) {
      this.playerPos = { col: wallCol, row: wallRow };
      this.drawPlayer();
      this.inventory.hasHook = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'hook');
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeHook', `Hooked to wall at (${wallCol},${wallRow})`);
      this.showPickupEffect(wallCol, wallRow);
    }
  }

  private executeWing(): void {
    if (!this.inventory.hasWing) return;
    this.inventory.hasWing = false;
    this.inventory.tools = this.inventory.tools.filter(t => t !== 'wing');
    this.inventoryUI.updateInventory(this.inventory);
    logger.info('GameScene', 'executeWing', 'Wings activated (can fly over holes/lava)');
    // Эффект крыльев уже учтён в проверках isHole и isLava/isWater
  }

  private executeBait(): void {
    if (!this.inventory.hasBait) return;
    this.inventory.hasBait = false;
    this.inventory.tools = this.inventory.tools.filter(t => t !== 'bait');
    this.inventoryUI.updateInventory(this.inventory);
    logger.info('GameScene', 'executeBait', 'Bait used (monsters distracted)');
    // В реальности здесь нужно отвлечь монстров
    this.showPickupEffect(this.playerPos.col, this.playerPos.row);
  }

  private executeThrow(): void {
    if (!this.level || this.inventory.cores === 0) return;
    let dx = 0, dy = 0;
    if (this.lastDirection === 'up') dy = -1;
    if (this.lastDirection === 'down') dy = 1;
    if (this.lastDirection === 'left') dx = -1;
    if (this.lastDirection === 'right') dx = 1;
    
    const targetCol = this.playerPos.col + dx;
    const targetRow = this.playerPos.row + dy;
    
    // Проверяем, есть ли монстр на целевой клетке
    const monsterIndex = this.level.objects.monsters?.findIndex(m => m.position.col === targetCol && m.position.row === targetRow);
    if (monsterIndex !== undefined && monsterIndex !== -1 && this.level.objects.monsters) {
      this.level.objects.monsters.splice(monsterIndex, 1);
      this.inventory.cores--;
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeThrow', `Core thrown at monster at (${targetCol},${targetRow})`);
      this.showPickupEffect(targetCol, targetRow);
    }
  }

  private executeFeed(): void {
    if (!this.level || this.inventory.corn === 0) return;
    let dx = 0, dy = 0;
    if (this.lastDirection === 'up') dy = -1;
    if (this.lastDirection === 'down') dy = 1;
    if (this.lastDirection === 'left') dx = -1;
    if (this.lastDirection === 'right') dx = 1;
    
    const targetCol = this.playerPos.col + dx;
    const targetRow = this.playerPos.row + dy;
    
    const monster = this.level.objects.monsters?.find(m => m.position.col === targetCol && m.position.row === targetRow);
    if (monster && monster.type === 'tameable') {
      monster.isTamed = true;
      this.inventory.corn--;
      this.inventoryUI.updateInventory(this.inventory);
      logger.info('GameScene', 'executeFeed', `Monster tamed at (${targetCol},${targetRow})`);
      this.showPickupEffect(targetCol, targetRow);
    }
  }

  private showPickupEffect(col: number, row: number): void {
    const x = this.gameOffsetX + col * this.gridSize;
    const y = this.gameOffsetY + row * this.gridSize;
    const effect = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0xffcc00, 0.7);
    this.time.delayedCall(200, () => effect.destroy());
  }

  private redrawCell(col: number, row: number): void {
    const x = col * this.gridSize;
    const y = row * this.gridSize;
    const tile = this.level.map[row][col];
    let textureKey = 'tile_platform';
    
    switch (tile) {
      case TileType.PLATFORM: textureKey = 'tile_platform'; break;
      case TileType.WALL: textureKey = 'tile_wall'; break;
      case TileType.HOLE: textureKey = 'tile_hole'; break;
      case TileType.BRICK: textureKey = 'tile_brick'; break;
      case TileType.GOAL: textureKey = 'tile_coin'; break;
      case TileType.KEY: textureKey = 'tile_key'; break;
      case TileType.DOOR_LOCKED: textureKey = 'tile_door_locked'; break;
      case TileType.DOOR_UNLOCKED: textureKey = 'tile_door_unlocked'; break;
      case TileType.CORN: textureKey = 'tile_corn'; break;
      case TileType.CORE: textureKey = 'tile_core'; break;
      case TileType.TOOL_DRILL: textureKey = 'tile_drill'; break;
      case TileType.TOOL_HOOK: textureKey = 'tile_hook'; break;
      case TileType.TOOL_WING: textureKey = 'tile_wing'; break;
      case TileType.TOOL_BAIT: textureKey = 'tile_bait'; break;
      case TileType.CONVEYOR_UP: textureKey = 'tile_conveyor_up'; break;
      case TileType.CONVEYOR_DOWN: textureKey = 'tile_conveyor_down'; break;
      case TileType.CONVEYOR_LEFT: textureKey = 'tile_conveyor_left'; break;
      case TileType.CONVEYOR_RIGHT: textureKey = 'tile_conveyor_right'; break;
      case TileType.SPRING: textureKey = 'tile_spring'; break;
      case TileType.TELEPORT_IN: textureKey = 'tile_teleport_in'; break;
      case TileType.TELEPORT_OUT: textureKey = 'tile_teleport_out'; break;
      case TileType.LAVA: textureKey = 'tile_lava'; break;
      case TileType.WATER: textureKey = 'tile_water'; break;
      default: textureKey = 'tile_platform';
    }
    
    const children = this.gameContainer.getAll();
    for (const child of children) {
      if (child.x === x && child.y === y) {
        child.destroy();
        break;
      }
    }
    
    const newTile = this.add.image(x, y, textureKey);
    newTile.setOrigin(0, 0);
    newTile.setDisplaySize(this.gridSize, this.gridSize);
    this.gameContainer.add(newTile);
  }

  private calculateStars(): number {
    if (!this.level) return 1;
    const optimalSteps = this.level.optimalSteps || 18;
    const stepsUsed = this.currentCommandIndex + 1;
    
    if (stepsUsed <= optimalSteps) return 3;
    if (stepsUsed <= optimalSteps * 1.5) return 2;
    return 1;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  private showGhostAt(cell: { col: number; row: number }): void {
    const x = this.gameOffsetX + cell.col * this.gridSize;
    const y = this.gameOffsetY + cell.row * this.gridSize;
    const ghost = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x00ff00, 0.3).setOrigin(0, 0);
    this.time.delayedCall(500, () => ghost.destroy());
  }

  private showBrokenMessage(): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, '💥 ROBOT BROKEN! 💥', {
      fontSize: '24px',
      color: '#ff0000',
      backgroundColor: '#000000aa',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
    
    if (this.playerSprite) {
      this.tweens.add({
        targets: this.playerSprite,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 3,
      });
    }
  }

  private showVictoryMessage(): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, '🏆 VICTORY! 🏆', {
      fontSize: '28px',
      color: '#ffcc00',
      backgroundColor: '#000000aa',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
    
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * this.cameras.main.width;
      const y = Math.random() * 100;
      const color = [0xff0000, 0x00ff00, 0x0000ff, 0xffcc00, 0xff00cc][Math.floor(Math.random() * 5)];
      const particle = this.add.rectangle(x, y, 4, 4, color);
      particle.setScrollFactor(0);
      this.tweens.add({
        targets: particle,
        y: y + 200,
        alpha: 0,
        duration: 1000 + Math.random() * 1000,
        onComplete: () => particle.destroy(),
      });
    }
    
    this.time.delayedCall(500, () => {
      this.inventoryUI.destroy();
      this.commandPanel.destroy();
      this.scene.start('VictoryScreen', { 
        levelId: this.levelId, 
        stars: this.calculateStars(), 
        stepsUsed: this.currentCommandIndex + 1 
      });
    });
  }

  private drawGrid(): void {
    if (!this.level) return;
    const { width, height, map } = this.level;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * this.gridSize;
        const y = row * this.gridSize;
        let textureKey = 'tile_platform';
        
        switch (map[row][col]) {
          case TileType.PLATFORM: textureKey = 'tile_platform'; break;
          case TileType.WALL: textureKey = 'tile_wall'; break;
          case TileType.HOLE: textureKey = 'tile_hole'; break;
          case TileType.BRICK: textureKey = 'tile_brick'; break;
          case TileType.GOAL: textureKey = 'tile_coin'; break;
          case TileType.KEY: textureKey = 'tile_key'; break;
          case TileType.DOOR_LOCKED: textureKey = 'tile_door_locked'; break;
          case TileType.DOOR_UNLOCKED: textureKey = 'tile_door_unlocked'; break;
          case TileType.CORN: textureKey = 'tile_corn'; break;
          case TileType.CORE: textureKey = 'tile_core'; break;
          case TileType.TOOL_DRILL: textureKey = 'tile_drill'; break;
          case TileType.TOOL_HOOK: textureKey = 'tile_hook'; break;
          case TileType.TOOL_WING: textureKey = 'tile_wing'; break;
          case TileType.TOOL_BAIT: textureKey = 'tile_bait'; break;
          case TileType.CONVEYOR_UP: textureKey = 'tile_conveyor_up'; break;
          case TileType.CONVEYOR_DOWN: textureKey = 'tile_conveyor_down'; break;
          case TileType.CONVEYOR_LEFT: textureKey = 'tile_conveyor_left'; break;
          case TileType.CONVEYOR_RIGHT: textureKey = 'tile_conveyor_right'; break;
          case TileType.SPRING: textureKey = 'tile_spring'; break;
          case TileType.TELEPORT_IN: textureKey = 'tile_teleport_in'; break;
          case TileType.TELEPORT_OUT: textureKey = 'tile_teleport_out'; break;
          case TileType.LAVA: textureKey = 'tile_lava'; break;
          case TileType.WATER: textureKey = 'tile_water'; break;
          default: textureKey = 'tile_platform';
        }
        
        const tile = this.add.image(x, y, textureKey);
        tile.setOrigin(0, 0);
        tile.setDisplaySize(this.gridSize, this.gridSize);
        this.gameContainer.add(tile);
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) this.playerSprite.destroy();
    if (!this.level) return;
    const x = this.playerPos.col * this.gridSize;
    const y = this.playerPos.row * this.gridSize;
    const texture = 'player_right';
    
    this.playerSprite = this.add.sprite(x, y, texture);
    this.playerSprite.setOrigin(0, 0);
    this.playerSprite.setDisplaySize(this.gridSize, this.gridSize);
    this.gameContainer.add(this.playerSprite);
  }

  private checkVictory(): void {
    if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
      this.isVictory = true;
      const stars = this.calculateStars();
      const steps = this.currentCommandIndex + 1;
      progressManager.completeLevel(this.levelId, stars, steps);
      this.showVictoryMessage();
    }
  }
}
