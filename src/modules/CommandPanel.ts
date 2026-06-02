// src/modules/CommandPanel.ts
// ============================================================================
// ПАНЕЛЬ КОМАНД – ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================================================
// - Подсветка выполняемой команды: зелёным – success, красным – error
// - При уничтожении (destroy) полностью удаляет все DOM-элементы
// - Поддерживает динамическую фильтрацию команд (allowedCommands)
// ============================================================================

import { Command } from '../types/index';

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

  private readonly allGroups: CommandGroup[] = [
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

  public getCommands(): Command[] {
    return [...this.commands];
  }

  public setCommands(commands: Command[]): void {
    this.commands = [...commands];
    this.updateProgramList();
    this.onAddCommandCallback(this.commands);
  }

  // Подсветка команды в списке PROGRAM
  public highlightCommand(index: number, type: 'running' | 'error'): void {
    this.commandElements.forEach((element, idx) => {
      if (idx === index) {
        if (type === 'running') {
          element.style.backgroundColor = '#00aa44'; // зелёный – выполнение
        } else if (type === 'error') {
          element.style.backgroundColor = '#ff0000'; // красный – ошибка
        }
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

  private refreshPanel(): void {
    const currentProgram = [...this.commands];
    if (this.container) this.container.remove();
    this.createPanel();
    this.commands = currentProgram;
    this.updateProgramList();
    this.onAddCommandCallback(this.commands);
  }

  private createPanel(): void {
    this.container = document.createElement('div');
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
    document.body.appendChild(this.container);

    const title = document.createElement('div');
    title.textContent = 'COMMANDS';
    title.style.color = '#00ffcc';
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';
    title.style.marginBottom = '10px';
    this.container.appendChild(title);

    for (const group of this.allGroups) {
      const enabledCmds = group.commands.filter(cmd => this.isCommandAllowed(cmd));
      if (enabledCmds.length === 0) continue;
      const groupDiv = document.createElement('div');
      groupDiv.style.marginBottom = '8px';
      const groupTitle = document.createElement('div');
      groupTitle.textContent = group.title;
      groupTitle.style.color = '#ffaa00';
      groupTitle.style.fontSize = '12px';
      groupTitle.style.fontWeight = 'bold';
      groupTitle.style.marginBottom = '4px';
      groupDiv.appendChild(groupTitle);
      for (const cmd of enabledCmds) {
        this.addCommandButtonToContainer(this.getButtonLabel(cmd), cmd, groupDiv);
      }
      this.container.appendChild(groupDiv);
      this.addSeparator();
    }

    const runBtn = document.createElement('button');
    runBtn.textContent = '▶ RUN';
    runBtn.style.padding = '8px';
    runBtn.style.fontSize = '16px';
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

    this.createProgramPanel();
  }

  private isCommandAllowed(cmd: Command): boolean {
    if (this.allowedCommands.length === 0) return true;
    return this.allowedCommands.includes(cmd);
  }

  private getButtonLabel(cmd: Command): string {
    const labels: Partial<Record<Command, string>> = {
      [Command.UP]: '↑ Up', [Command.DOWN]: '↓ Down', [Command.LEFT]: '← Left', [Command.RIGHT]: '→ Right',
      [Command.PUSH]: '📦 Push', [Command.USE_KEY]: '🔑 Use Key', [Command.PICKUP]: '📥 Pickup', [Command.DROP]: '🗑 Drop',
      [Command.DRILL]: '🔧 Drill', [Command.HOOK]: '🪝 Hook', [Command.WING]: '🪽 Wing', [Command.BAIT]: '🐟 Bait',
      [Command.THROW]: '🎯 Throw', [Command.FEED]: '🌽 Feed', [Command.TIME_SLOW]: '🐢 Time Slow', [Command.TIME_FAST]: '🐇 Time Fast',
      [Command.WAIT]: '⏳ Wait', [Command.CALL]: '📞 Call', [Command.RETURN]: '↩️ Return', [Command.PARAM]: '📥 Param',
      [Command.CLASS]: '🏛️ Class', [Command.NEW]: '✨ New', [Command.METHOD]: '⚙️ Method', [Command.CLONE]: '👥 Clone',
      [Command.JOIN]: '🤝 Join', [Command.SCAN]: '🔍 Scan', [Command.RIDE]: '🐎 Ride', [Command.BLACK_BOX]: '📦 Black Box',
    };
    return labels[cmd] || cmd;
  }

  private addCommandButtonToContainer(label: string, cmd: Command, container: HTMLDivElement): void {
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
    btn.style.width = '100%';
    btn.onclick = () => {
      this.commands.push(cmd);
      this.updateProgramList();
      this.onAddCommandCallback(this.commands);
    };
    container.appendChild(btn);
  }

  private addSeparator(): void {
    const sep = document.createElement('hr');
    sep.style.margin = '8px 0';
    sep.style.borderColor = '#444';
    this.container.appendChild(sep);
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
    this.commands.forEach((cmd, index) => {
      const cmdDiv = document.createElement('div');
      cmdDiv.style.backgroundColor = '#3a3a5a';
      cmdDiv.style.padding = '6px 12px';
      cmdDiv.style.borderRadius = '6px';
      cmdDiv.style.display = 'flex';
      cmdDiv.style.alignItems = 'center';
      cmdDiv.style.justifyContent = 'space-between';
      const cmdText = document.createElement('span');
      cmdText.textContent = cmd;
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

  public destroy(): void {
    if (this.container) this.container.remove();
    const rightPanel = document.querySelector('div[style*="right: 20px"]');
    if (rightPanel) rightPanel.remove();
  }
}
