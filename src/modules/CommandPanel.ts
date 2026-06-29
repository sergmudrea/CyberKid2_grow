// src/modules/CommandPanel.ts
// ============================================================================
// ПАНЕЛЬ КОМАНД – ПОЛНАЯ ВЕРСИЯ ПАТЧА 2.0
// ============================================================================
// - Добавлены новые кнопки для раздельного управления башней и корпусом
// - Поддержка SET_ANGLE, RELATIVE_TURN, SHOW_AIM, IF_ANGLE, WHILE_NOT_FACING
// - Динамическая фильтрация команд в зависимости от allowedCommands
// - Полная обратная совместимость
// ============================================================================

import { Command, ControlMode, LearningMode } from '../types/index';

interface CommandGroup {
  title: string;
  commands: Command[];
}

export class CommandPanel {
  private commands: Command[] = [];
  private container: HTMLDivElement;
  private programListDiv: HTMLDivElement;
  private onRunCallback: (commands: Command[]) => void;
  private onClearCallback: () => void;
  private onAddCommandCallback: (commands: Command[]) => void;
  private commandElements: Map<number, HTMLDivElement> = new Map();
  private allowedCommands: Command[] = [];
  private controlMode: ControlMode = ControlMode.SEPARATE; // по умолчанию новый режим
  private learningMode: LearningMode = 'scholar'; // режим обучения — влияет на вид меток

  private readonly allGroups: CommandGroup[] = [
    // ---------- НОВЫЕ ГРУППЫ ДЛЯ ПАТЧА 2.0 ----------
    { title: 'TURRET CONTROL', commands: [
      Command.TURN_LEFT,
      Command.TURN_RIGHT,
      Command.TURN_AROUND,
      Command.SYNC_BODY,
      Command.SET_ANGLE,
      Command.RELATIVE_TURN,
      Command.SHOW_AIM,
    ]},
    { title: 'MOVEMENT (NEW)', commands: [
      Command.MOVE_FORWARD,
      Command.MOVE_BACKWARD,
    ]},
    // ---------- СТАРЫЕ ГРУППЫ ----------
    { title: 'MOVEMENT (CLASSIC)', commands: [Command.UP, Command.DOWN, Command.LEFT, Command.RIGHT] },
    { title: 'INVENTORY', commands: [Command.PUSH, Command.USE_KEY, Command.PICKUP, Command.DROP] },
    { title: 'TOOLS', commands: [Command.DRILL, Command.HOOK, Command.WING, Command.BAIT] },
    { title: 'COMBAT', commands: [Command.THROW, Command.FEED] },
    { title: 'TIME', commands: [Command.TIME_SLOW, Command.TIME_FAST, Command.WAIT] },
    { title: 'FUNCTIONS', commands: [Command.CALL, Command.RETURN, Command.PARAM] },
    { title: 'OOP', commands: [Command.CLASS, Command.NEW, Command.METHOD] },
    { title: 'PARALLELISM', commands: [Command.CLONE, Command.JOIN] },
    { title: 'INTERACTION', commands: [Command.SCAN, Command.RIDE] },
    { title: 'BLACK BOX', commands: [Command.BLACK_BOX] },
    // ---------- НОВЫЕ УСЛОВНЫЕ КОНСТРУКЦИИ ----------
    { title: 'CONDITIONS (NEW)', commands: [Command.IF_ANGLE, Command.WHILE_NOT_FACING] },
  ];

  constructor(
    scene: any,
    onRun: (commands: Command[]) => void,
    onClear: () => void,
    onAddCommand: (commands: Command[]) => void
  ) {
    this.onRunCallback = onRun;
    this.onClearCallback = onClear;
    this.onAddCommandCallback = onAddCommand;
    this.createPanel();
  }

  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЕ МЕТОДЫ
  // --------------------------------------------------------------------------
  public getCommands(): Command[] {
    return [...this.commands];
  }

  public setCommands(commands: Command[]): void {
    this.commands = [...commands];
    this.updateProgramList();
    this.onAddCommandCallback(this.commands);
  }

  public highlightCommand(index: number, type: 'running' | 'error'): void {
    this.commandElements.forEach((element, idx) => {
      if (idx === index) {
        element.style.backgroundColor = type === 'running' ? '#00aa44' : '#ff0000';
        element.style.transition = 'background-color 0.1s';
      } else {
        element.style.backgroundColor = '#3a3a5a';
      }
    });
  }

  public clearHighlight(): void {
    this.commandElements.forEach((element) => {
      element.style.backgroundColor = '#3a3a5a';
    });
  }

  public setAllowedCommands(commands: Command[]): void {
    this.allowedCommands = commands || [];
    this.refreshPanel();
  }

  public setControlMode(mode: ControlMode): void {
    this.controlMode = mode;
    this.refreshPanel(); // перестроить панель (скрыть/показать группы)
  }

  // Режим обучения: kiddo (только иконки), scholar (иконка + текст),
  // dev_student / developer (иконка + текст + синтаксис Python).
  public setLearningMode(mode: LearningMode): void {
    this.learningMode = mode;
    this.refreshPanel();
  }

  // --------------------------------------------------------------------------
  // ПЕРЕСТРОЙКА ПАНЕЛИ
  // --------------------------------------------------------------------------
  private refreshPanel(): void {
    const currentProgram = [...this.commands];
    if (this.container) this.container.remove();
    this.createPanel();
    this.commands = currentProgram;
    this.updateProgramList();
    this.onAddCommandCallback(this.commands);
  }

  // --------------------------------------------------------------------------
  // СОЗДАНИЕ DOM-ПАНЕЛИ
  // --------------------------------------------------------------------------
  private createPanel(): void {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '50%';
    this.container.style.left = '20px';
    this.container.style.transform = 'translateY(-50%)';
    this.container.style.width = '220px';
    this.container.style.backgroundColor = 'rgba(0,0,0,0.85)';
    this.container.style.borderRadius = '12px';
    this.container.style.padding = '10px';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '8px';
    this.container.style.fontFamily = 'monospace';
    this.container.style.zIndex = '1000';
    this.container.style.maxHeight = '90vh';
    this.container.style.overflowY = 'auto';
    document.body.appendChild(this.container);

    const title = document.createElement('div');
    title.textContent = 'COMMANDS';
    title.style.color = '#00ffcc';
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';
    title.style.marginBottom = '10px';
    this.container.appendChild(title);

    // Отображаем группы в зависимости от режима управления
    for (const group of this.allGroups) {
      // Фильтрация: если это группа классического движения и controlMode = separate – не показываем
      if (group.title === 'MOVEMENT (CLASSIC)' && this.controlMode === ControlMode.SEPARATE) continue;
      if (group.title === 'MOVEMENT (NEW)' && this.controlMode === ControlMode.CLASSIC) continue;

      const enabledCmds = group.commands.filter(cmd => this.isCommandAllowed(cmd));
      if (enabledCmds.length === 0) continue;

      const groupDiv = document.createElement('div');
      groupDiv.style.marginBottom = '12px';
      const groupTitle = document.createElement('div');
      groupTitle.textContent = group.title;
      groupTitle.style.color = '#ffaa00';
      groupTitle.style.fontSize = '12px';
      groupTitle.style.fontWeight = 'bold';
      groupTitle.style.marginBottom = '4px';
      groupTitle.style.borderBottom = '1px solid #ffaa00';
      groupDiv.appendChild(groupTitle);

      for (const cmd of enabledCmds) {
        this.addCommandButtonToContainer(this.getButtonLabel(cmd), cmd, groupDiv);
      }
      this.container.appendChild(groupDiv);
    }

    // Кнопки RUN, CLEAR, SAVE, LOAD (остаются всегда)
    this.addControlButtons();
    this.createProgramPanel();
  }

  private isCommandAllowed(cmd: Command): boolean {
    if (this.allowedCommands.length === 0) return true;
    return this.allowedCommands.includes(cmd);
  }

  // Иконка (эмодзи) для каждой команды
  private static readonly CMD_ICON: Partial<Record<Command, string>> = {
    [Command.MOVE_FORWARD]: '⬆️',
    [Command.MOVE_BACKWARD]: '⬇️',
    [Command.TURN_LEFT]: '⬅️',
    [Command.TURN_RIGHT]: '➡️',
    [Command.TURN_AROUND]: '🔄',
    [Command.SYNC_BODY]: '🧭',
    [Command.SET_ANGLE]: '🎯',
    [Command.RELATIVE_TURN]: '🔁',
    [Command.SHOW_AIM]: '🎯',
    [Command.IF_ANGLE]: '❓',
    [Command.WHILE_NOT_FACING]: '🔄',
    [Command.UP]: '↑',
    [Command.DOWN]: '↓',
    [Command.LEFT]: '←',
    [Command.RIGHT]: '→',
    [Command.PUSH]: '📦',
    [Command.USE_KEY]: '🔑',
    [Command.PICKUP]: '📥',
    [Command.DROP]: '🗑',
    [Command.DRILL]: '🔧',
    [Command.HOOK]: '🪝',
    [Command.WING]: '🪽',
    [Command.BAIT]: '🐟',
    [Command.THROW]: '🎯',
    [Command.FEED]: '🌽',
    [Command.TIME_SLOW]: '🐢',
    [Command.TIME_FAST]: '🐇',
    [Command.WAIT]: '⏳',
    [Command.CALL]: '📞',
    [Command.RETURN]: '↩️',
    [Command.PARAM]: '📥',
    [Command.CLASS]: '🏛️',
    [Command.NEW]: '✨',
    [Command.METHOD]: '⚙️',
    [Command.CLONE]: '👥',
    [Command.JOIN]: '🤝',
    [Command.SCAN]: '🔍',
    [Command.RIDE]: '🐎',
    [Command.BLACK_BOX]: '📦',
  };

  // Текстовая подпись (RU/EN) для каждой команды
  private static readonly CMD_TEXT: Partial<Record<Command, string>> = {
    [Command.MOVE_FORWARD]: 'Move Forward',
    [Command.MOVE_BACKWARD]: 'Move Backward',
    [Command.TURN_LEFT]: 'Turn Turret Left',
    [Command.TURN_RIGHT]: 'Turn Turret Right',
    [Command.TURN_AROUND]: 'Turn Turret 180°',
    [Command.SYNC_BODY]: 'Sync Body',
    [Command.SET_ANGLE]: 'Set Angle',
    [Command.RELATIVE_TURN]: 'Relative Turn',
    [Command.SHOW_AIM]: 'Show Aim',
    [Command.IF_ANGLE]: 'IF Angle ==',
    [Command.WHILE_NOT_FACING]: 'WHILE not facing target',
    [Command.UP]: 'Up',
    [Command.DOWN]: 'Down',
    [Command.LEFT]: 'Left',
    [Command.RIGHT]: 'Right',
    [Command.PUSH]: 'Push',
    [Command.USE_KEY]: 'Use Key',
    [Command.PICKUP]: 'Pickup',
    [Command.DROP]: 'Drop',
    [Command.DRILL]: 'Drill',
    [Command.HOOK]: 'Hook',
    [Command.WING]: 'Wing',
    [Command.BAIT]: 'Bait',
    [Command.THROW]: 'Throw',
    [Command.FEED]: 'Feed',
    [Command.TIME_SLOW]: 'Time Slow',
    [Command.TIME_FAST]: 'Time Fast',
    [Command.WAIT]: 'Wait',
    [Command.CALL]: 'Call',
    [Command.RETURN]: 'Return',
    [Command.PARAM]: 'Param',
    [Command.CLASS]: 'Class',
    [Command.NEW]: 'New',
    [Command.METHOD]: 'Method',
    [Command.CLONE]: 'Clone',
    [Command.JOIN]: 'Join',
    [Command.SCAN]: 'Scan',
    [Command.RIDE]: 'Ride',
    [Command.BLACK_BOX]: 'Black Box',
  };

  // Python/JS синтаксис для продвинутых режимов
  private static readonly CMD_PY: Partial<Record<Command, string>> = {
    [Command.MOVE_FORWARD]: 'move_forward()',
    [Command.MOVE_BACKWARD]: 'move_backward()',
    [Command.TURN_LEFT]: 'turn_left()',
    [Command.TURN_RIGHT]: 'turn_right()',
    [Command.TURN_AROUND]: 'turn_around()',
    [Command.SYNC_BODY]: 'sync_body()',
    [Command.SET_ANGLE]: 'set_angle(deg)',
    [Command.RELATIVE_TURN]: 'relative_turn(deg)',
    [Command.SHOW_AIM]: 'show_aim()',
    [Command.IF_ANGLE]: 'if angle ==:',
    [Command.WHILE_NOT_FACING]: 'while not facing(target):',
    [Command.UP]: 'up()',
    [Command.DOWN]: 'down()',
    [Command.LEFT]: 'left()',
    [Command.RIGHT]: 'right()',
    [Command.PUSH]: 'push()',
    [Command.USE_KEY]: 'use_key()',
    [Command.PICKUP]: 'pickup()',
    [Command.DROP]: 'drop()',
    [Command.DRILL]: 'drill()',
    [Command.HOOK]: 'hook()',
    [Command.WING]: 'wing()',
    [Command.BAIT]: 'bait()',
    [Command.THROW]: 'throw()',
    [Command.FEED]: 'feed()',
    [Command.TIME_SLOW]: 'time_slow()',
    [Command.TIME_FAST]: 'time_fast()',
    [Command.WAIT]: 'wait()',
    [Command.CALL]: 'call(fn)',
    [Command.RETURN]: 'return',
    [Command.PARAM]: 'param(x)',
    [Command.CLASS]: 'class:',
    [Command.NEW]: 'new()',
    [Command.METHOD]: 'def method():',
    [Command.CLONE]: 'clone()',
    [Command.JOIN]: 'join()',
    [Command.SCAN]: 'scan()',
    [Command.RIDE]: 'ride()',
    [Command.BLACK_BOX]: 'black_box()',
  };

  private getButtonLabel(cmd: Command): string {
    const icon = CommandPanel.CMD_ICON[cmd] || '';
    const text = CommandPanel.CMD_TEXT[cmd] || cmd;
    const py = CommandPanel.CMD_PY[cmd] || '';

    switch (this.learningMode) {
      case 'kiddo':
        // Только иконки (3–5 лет)
        return icon || text;
      case 'developer':
        // Только синтаксис (15+), Script Mode
        return py || `${icon} ${text}`.trim();
      case 'dev_student':
        // Текст + синтаксис (10–14)
        return py ? `${icon} ${text}  · ${py}`.trim() : `${icon} ${text}`.trim();
      case 'scholar':
      default:
        // Иконки + текст (6–9)
        return `${icon} ${text}`.trim();
    }
  }

  private addCommandButtonToContainer(label: string, cmd: Command, container: HTMLDivElement): void {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.padding = '6px';
    btn.style.fontSize = '12px';
    btn.style.backgroundColor = '#2a2a4a';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.marginBottom = '4px';
    btn.style.textAlign = 'left';
    btn.style.width = '100%';
    btn.onclick = () => {
      // Для команд с числовым аргументом (SET_ANGLE, RELATIVE_TURN) – запросить значение
      if (cmd === Command.SET_ANGLE) {
        const angle = prompt('Введите угол (0, 90, 180, 270):', '0');
        if (angle !== null) {
          const num = parseInt(angle, 10);
          if (!isNaN(num)) {
            this.commands.push(cmd, num as any);
            this.updateProgramList();
            this.onAddCommandCallback(this.commands);
          }
        }
      } else if (cmd === Command.RELATIVE_TURN) {
        const delta = prompt('Введите относительный угол (например, +45):', '90');
        if (delta !== null) {
          const num = parseInt(delta, 10);
          if (!isNaN(num)) {
            this.commands.push(cmd, num as any);
            this.updateProgramList();
            this.onAddCommandCallback(this.commands);
          }
        }
      } else if (cmd === Command.IF_ANGLE) {
        const angle = prompt('Угол для условия (0, 90, 180, 270):', '0');
        if (angle !== null) {
          const num = parseInt(angle, 10);
          if (!isNaN(num)) {
            this.commands.push(cmd, num as any);
            this.commands.push(Command.END);
            this.updateProgramList();
            this.onAddCommandCallback(this.commands);
          }
        }
      } else {
        this.commands.push(cmd);
        this.updateProgramList();
        this.onAddCommandCallback(this.commands);
      }
    };
    container.appendChild(btn);
  }

  private addControlButtons(): void {
    const runBtn = document.createElement('button');
    runBtn.textContent = '▶ RUN';
    runBtn.style.padding = '8px';
    runBtn.style.fontSize = '14px';
    runBtn.style.backgroundColor = '#00aa44';
    runBtn.style.color = 'white';
    runBtn.style.border = 'none';
    runBtn.style.borderRadius = '6px';
    runBtn.style.cursor = 'pointer';
    runBtn.style.marginTop = '10px';
    runBtn.onclick = () => this.onRunCallback(this.commands);
    this.container.appendChild(runBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑 CLEAR';
    clearBtn.style.padding = '8px';
    clearBtn.style.fontSize = '14px';
    clearBtn.style.backgroundColor = '#aa4444';
    clearBtn.style.color = 'white';
    clearBtn.style.border = 'none';
    clearBtn.style.borderRadius = '6px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.marginTop = '5px';
    clearBtn.onclick = () => {
      this.commands = [];
      this.updateProgramList();
      this.onClearCallback();
    };
    this.container.appendChild(clearBtn);
  }

  private createProgramPanel(): void {
    const programContainer = document.createElement('div');
    programContainer.style.position = 'absolute';
    programContainer.style.top = '50%';
    programContainer.style.right = '20px';
    programContainer.style.transform = 'translateY(-50%)';
    programContainer.style.width = '260px';
    programContainer.style.backgroundColor = 'rgba(0,0,0,0.85)';
    programContainer.style.borderRadius = '12px';
    programContainer.style.padding = '10px';
    programContainer.style.display = 'flex';
    programContainer.style.flexDirection = 'column';
    programContainer.style.gap = '10px';
    programContainer.style.fontFamily = 'monospace';
    programContainer.style.zIndex = '1000';
    programContainer.style.maxHeight = '90vh';
    document.body.appendChild(programContainer);

    const title = document.createElement('div');
    title.textContent = 'PROGRAM';
    title.style.color = '#ffcc00';
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';
    title.style.marginBottom = '5px';
    programContainer.appendChild(title);

    this.programListDiv = document.createElement('div');
    this.programListDiv.style.backgroundColor = '#1e1e1e';
    this.programListDiv.style.borderRadius = '8px';
    this.programListDiv.style.minHeight = '200px';
    this.programListDiv.style.maxHeight = 'calc(90vh - 120px)';
    this.programListDiv.style.overflowY = 'auto';
    this.programListDiv.style.padding = '8px';
    this.programListDiv.style.display = 'flex';
    this.programListDiv.style.flexDirection = 'column';
    this.programListDiv.style.gap = '8px';
    programContainer.appendChild(this.programListDiv);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 SAVE';
    saveBtn.style.padding = '8px';
    saveBtn.style.fontSize = '14px';
    saveBtn.style.backgroundColor = '#4444aa';
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '6px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.onclick = () => {
      localStorage.setItem('saved_program', JSON.stringify(this.commands));
      alert('Program saved!');
    };
    programContainer.appendChild(saveBtn);

    const loadBtn = document.createElement('button');
    loadBtn.textContent = '📂 LOAD';
    loadBtn.style.padding = '8px';
    loadBtn.style.fontSize = '14px';
    loadBtn.style.backgroundColor = '#aa8844';
    loadBtn.style.color = 'white';
    loadBtn.style.border = 'none';
    loadBtn.style.borderRadius = '6px';
    loadBtn.style.cursor = 'pointer';
    loadBtn.onclick = () => {
      const saved = localStorage.getItem('saved_program');
      if (saved) {
        try {
          const loaded = JSON.parse(saved);
          if (Array.isArray(loaded)) {
            this.commands = loaded;
            this.updateProgramList();
            this.onClearCallback();
            this.onAddCommandCallback(this.commands);
            alert('Program loaded!');
          } else throw new Error();
        } catch (e) {
          alert('Failed to load program');
        }
      } else {
        alert('No saved program');
      }
    };
    programContainer.appendChild(loadBtn);
  }

  private updateProgramList(): void {
    if (!this.programListDiv) return;
    this.programListDiv.innerHTML = '';
    this.commandElements.clear();

    let i = 0;
    while (i < this.commands.length) {
      const cmd = this.commands[i];
      // Пропускаем служебный END
      if (cmd === Command.END) {
        i++;
        continue;
      }

      const cmdDiv = document.createElement('div');
      cmdDiv.style.backgroundColor = '#3a3a5a';
      cmdDiv.style.padding = '6px 12px';
      cmdDiv.style.borderRadius = '6px';
      cmdDiv.style.display = 'flex';
      cmdDiv.style.alignItems = 'center';
      cmdDiv.style.justifyContent = 'space-between';

      let displayText = this.getButtonLabel(cmd);
      // Если команда с аргументом (следующий элемент – число)
      if ((cmd === Command.SET_ANGLE || cmd === Command.RELATIVE_TURN || cmd === Command.IF_ANGLE) && i + 1 < this.commands.length) {
        const arg = this.commands[i + 1];
        if (typeof arg === 'number') {
          displayText += ` ${arg}`;
          i++; // пропускаем аргумент
        }
      }

      const cmdText = document.createElement('span');
      cmdText.textContent = displayText;
      cmdText.style.fontSize = '12px';
      cmdText.style.color = '#fff';

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✖';
      removeBtn.style.backgroundColor = '#aa4444';
      removeBtn.style.border = 'none';
      removeBtn.style.color = 'white';
      removeBtn.style.borderRadius = '4px';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.padding = '2px 6px';
      removeBtn.onclick = () => {
        // Удаляем команду (и аргумент, если есть)
        this.commands.splice(i, 1);
        if (cmd === Command.SET_ANGLE || cmd === Command.RELATIVE_TURN || cmd === Command.IF_ANGLE) {
          if (typeof this.commands[i] === 'number') this.commands.splice(i, 1);
        }
        this.updateProgramList();
        this.onAddCommandCallback(this.commands);
      };

      cmdDiv.appendChild(cmdText);
      cmdDiv.appendChild(removeBtn);
      this.programListDiv.appendChild(cmdDiv);
      this.commandElements.set(this.commandElements.size, cmdDiv);
      i++;
    }
  }

  public destroy(): void {
    if (this.container) this.container.remove();
    const rightPanel = document.querySelector('div[style*="right: 20px"]');
    if (rightPanel) rightPanel.remove();
  }
}
