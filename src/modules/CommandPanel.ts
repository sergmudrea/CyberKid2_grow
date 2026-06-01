// src/modules/CommandPanel.ts
// ============================================================================
// ПАНЕЛЬ КОМАНД (UI ДЛЯ ПРОГРАММИРОВАНИЯ) – С ПОДДЕРЖКОЙ ФИЛЬТРАЦИИ
// ============================================================================
// - Отображает только те команды, которые разрешены для текущего уровня (allowedCommands)
// - Если allowedCommands не указан или пуст, показывает все команды
// - Группы без разрешённых команд скрываются
// ============================================================================

import { Command } from '../types/index';

// Определение группы команд
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
  
  // Текущий список разрешённых команд (если пустой – показывать всё)
  private allowedCommands: Command[] = [];

  // Все возможные группы команд
  private readonly commandGroups: CommandGroup[] = [
    { title: 'MOVEMENT', commands: [Command.UP, Command.DOWN, Command.LEFT, Command.RIGHT] },
    { title: 'INVENTORY', commands: [Command.PUSH, Command.USE_KEY, Command.PICKUP, Command.DROP] },
    { title: 'TOOLS', commands: [Command.DRILL, Command.HOOK, Command.WING, Command.BAIT] },
    { title: 'COMBAT', commands: [Command.THROW, Command.FEED] },
    { title: 'TIME', commands: [Command.TIME_SLOW, Command.TIME_FAST, Command.WAIT] },
    { title: 'FUNCTIONS', commands: [Command.CALL, Command.RETURN, Command.PARAM] },
    { title: 'OOP', commands: [Command.CLASS, Command.NEW, Command.METHOD] },
    { title: 'PARALLELISM', commands: [Command.CLONE, Command.JOIN] },
    { title: 'INTERACTION', commands: [Command.SCAN, Command.RIDE] },
    { title: 'BLACK BOX', commands: [Command.BLACK_BOX] },
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
  // УСТАНОВИТЬ РАЗРЕШЁННЫЕ КОМАНДЫ (вызывается из GameScene при загрузке уровня)
  // --------------------------------------------------------------------------
  public setAllowedCommands(commands: Command[]): void {
    this.allowedCommands = commands || [];
    this.refreshPanel(); // пересоздаём панель с учётом фильтрации
  }

  // --------------------------------------------------------------------------
  // ПРОВЕРКА, РАЗРЕШЕНА ЛИ КОМАНДА
  // --------------------------------------------------------------------------
  private isCommandAllowed(cmd: Command): boolean {
    if (this.allowedCommands.length === 0) return true; // нет ограничений – показываем всё
    return this.allowedCommands.includes(cmd);
  }

  // --------------------------------------------------------------------------
  // ПОЛУЧИТЬ ТЕКСТ КНОПКИ ДЛЯ КОМАНДЫ
  // --------------------------------------------------------------------------
  private getButtonLabel(cmd: Command): string {
    const labels: Partial<Record<Command, string>> = {
      [Command.UP]: '↑ Up',
      [Command.DOWN]: '↓ Down',
      [Command.LEFT]: '← Left',
      [Command.RIGHT]: '→ Right',
      [Command.PUSH]: '📦 Push',
      [Command.USE_KEY]: '🔑 Use Key',
      [Command.PICKUP]: '📥 Pickup',
      [Command.DROP]: '🗑 Drop',
      [Command.DRILL]: '🔧 Drill',
      [Command.HOOK]: '🪝 Hook',
      [Command.WING]: '🪽 Wing',
      [Command.BAIT]: '🐟 Bait',
      [Command.THROW]: '🎯 Throw',
      [Command.FEED]: '🌽 Feed',
      [Command.TIME_SLOW]: '🐢 Time Slow',
      [Command.TIME_FAST]: '🐇 Time Fast',
      [Command.WAIT]: '⏳ Wait',
      [Command.CALL]: '📞 Call',
      [Command.RETURN]: '↩️ Return',
      [Command.PARAM]: '📥 Param',
      [Command.CLASS]: '🏛️ Class',
      [Command.NEW]: '✨ New',
      [Command.METHOD]: '⚙️ Method',
      [Command.CLONE]: '👥 Clone',
      [Command.JOIN]: '🤝 Join',
      [Command.SCAN]: '🔍 Scan',
      [Command.RIDE]: '🐎 Ride',
      [Command.BLACK_BOX]: '📦 Black Box',
    };
    return labels[cmd] || cmd;
  }

  // --------------------------------------------------------------------------
  // ПОЛУЧИТЬ ИКОНКУ ДЛЯ КОМАНДЫ (ДЛЯ СПИСКА ПРОГРАММЫ)
  // --------------------------------------------------------------------------
  private getIconForCommand(cmd: Command): string {
    const icons: Partial<Record<Command, string>> = {
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
    return icons[cmd] || cmd.slice(0, 2);
  }

  // --------------------------------------------------------------------------
  // ПЕРЕСОЗДАТЬ ПАНЕЛЬ (ПРИ ИЗМЕНЕНИИ allowedCommands)
  // --------------------------------------------------------------------------
  private refreshPanel(): void {
    // Сохраняем текущую программу
    const currentProgram = [...this.commands];
    
    // Полностью пересоздаём DOM-панель
    const oldContainer = this.container;
    const newContainer = document.createElement('div');
    newContainer.style.cssText = oldContainer.style.cssText;
    oldContainer.parentNode?.replaceChild(newContainer, oldContainer);
    this.container = newContainer;
    
    // Пересоздаём структуру
    this.createPanelContent();
    
    // Восстанавливаем программу
    this.commands = currentProgram;
    this.updateProgramList();
    this.onAddCommandCallback(this.commands);
  }

  // --------------------------------------------------------------------------
  // СОЗДАНИЕ СОДЕРЖИМОГО ПАНЕЛИ (С УЧЁТОМ ФИЛЬТРАЦИИ)
  // --------------------------------------------------------------------------
  private createPanelContent(): void {
    this.container.style.position = 'absolute';
    this.container.style.top = '50%';
    this.container.style.left = '20px';
    this.container.style.transform = 'translateY(-50%)';
    this.container.style.width = '200px';
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

    const title = document.createElement('div');
    title.textContent = 'COMMANDS';
    title.style.color = '#00ffcc';
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';
    title.style.marginBottom = '10px';
    this.container.appendChild(title);

    // Проходим по группам и добавляем только те, у которых есть разрешённые команды
    for (const group of this.commandGroups) {
      const enabledCommands = group.commands.filter(cmd => this.isCommandAllowed(cmd));
      if (enabledCommands.length === 0) continue; // группу пропускаем

      this.addGroupTitle(group.title);
      for (const cmd of enabledCommands) {
        this.addCommandButton(this.getButtonLabel(cmd), cmd);
      }
      this.addSeparator();
    }

    // Управляющие кнопки (RUN, CLEAR) добавляем всегда
    this.addGroupTitle('CONTROL');
    const runBtn = document.createElement('button');
    runBtn.textContent = '▶ RUN';
    runBtn.style.padding = '8px';
    runBtn.style.fontSize = '16px';
    runBtn.style.backgroundColor = '#00aa44';
    runBtn.style.color = 'white';
    runBtn.style.border = 'none';
    runBtn.style.borderRadius = '6px';
    runBtn.style.cursor = 'pointer';
    runBtn.style.marginTop = '5px';
    runBtn.onclick = () => this.onRunCallback(this.commands);
    this.container.appendChild(runBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑 CLEAR';
    clearBtn.style.padding = '8px';
    clearBtn.style.fontSize = '16px';
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

  private addGroupTitle(title: string): void {
    const groupTitle = document.createElement('div');
    groupTitle.textContent = title;
    groupTitle.style.color = '#ffaa00';
    groupTitle.style.fontSize = '12px';
    groupTitle.style.fontWeight = 'bold';
    groupTitle.style.marginTop = '8px';
    groupTitle.style.marginBottom = '4px';
    groupTitle.style.borderBottom = '1px solid #ffaa00';
    groupTitle.style.paddingBottom = '2px';
    this.container.appendChild(groupTitle);
  }

  private addCommandButton(label: string, cmd: Command): void {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.padding = '6px';
    btn.style.fontSize = '13px';
    btn.style.backgroundColor = '#2a2a4a';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.marginBottom = '4px';
    btn.style.textAlign = 'left';
    btn.onclick = () => {
      this.commands.push(cmd);
      this.updateProgramList();
      this.onAddCommandCallback(this.commands);
    };
    this.container.appendChild(btn);
  }

  private addSeparator(): void {
    const sep = document.createElement('hr');
    sep.style.margin = '4px 0';
    sep.style.borderColor = '#444';
    this.container.appendChild(sep);
  }

  // --------------------------------------------------------------------------
  // ПАНЕЛЬ ПРОГРАММЫ (список добавленных команд)
  // --------------------------------------------------------------------------
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
          const loadedCommands = JSON.parse(saved) as Command[];
          if (Array.isArray(loadedCommands)) {
            this.commands = loadedCommands;
            this.updateProgramList();
            this.onClearCallback();
            this.onAddCommandCallback(this.commands);
            alert('Program loaded!');
          } else {
            alert('Invalid program format');
          }
        } catch (e) {
          alert('Failed to load program');
        }
      } else {
        alert('No saved program found');
      }
    };
    programContainer.appendChild(loadBtn);
  }

  private updateProgramList(): void {
    if (!this.programListDiv) return;
    this.programListDiv.innerHTML = '';
    this.commandElements.clear();

    this.commands.forEach((cmd, index) => {
      const cmdDiv = document.createElement('div');
      cmdDiv.style.backgroundColor = '#3a3a5a';
      cmdDiv.style.padding = '6px 12px';
      cmdDiv.style.borderRadius = '6px';
      cmdDiv.style.display = 'flex';
      cmdDiv.style.alignItems = 'center';
      cmdDiv.style.justifyContent = 'space-between';

      const cmdText = document.createElement('span');
      const icon = this.getIconForCommand(cmd);
      cmdText.textContent = `${icon} ${cmd}`;
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
        this.commands.splice(index, 1);
        this.updateProgramList();
        this.onAddCommandCallback(this.commands);
      };

      cmdDiv.appendChild(cmdText);
      cmdDiv.appendChild(removeBtn);
      this.programListDiv.appendChild(cmdDiv);
      this.commandElements.set(index, cmdDiv);
    });
  }

  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЕ МЕТОДЫ (для взаимодействия с GameScene)
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

  private createPanel(): void {
    this.createPanelContent();
    this.createProgramPanel();
  }

  public destroy(): void {
    if (this.container) this.container.remove();
    const rightPanel = document.querySelector('div[style*="right: 20px"]');
    if (rightPanel) rightPanel.remove();
  }
}
