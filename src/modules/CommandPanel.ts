import { Scene } from 'phaser';
import { Command } from '../types/index';

export class CommandPanel {
  private commands: Command[] = [];
  private container: HTMLDivElement;
  private programListDiv: HTMLDivElement;
  private onRunCallback: (commands: Command[]) => void;
  private onClearCallback: () => void;
  private onAddCommandCallback: (commands: Command[]) => void;
  private commandElements: Map<number, HTMLDivElement> = new Map();

  constructor(
    scene: Scene,
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

  public highlightCommand(index: number, type: 'running' | 'error'): void {
    this.commandElements.forEach((element, idx) => {
      if (idx === index) {
        if (type === 'running') {
          element.style.backgroundColor = '#00aa44';
          element.style.transition = 'background-color 0.1s';
        } else if (type === 'error') {
          element.style.backgroundColor = '#ff0000';
          element.style.transition = 'background-color 0.1s';
        }
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

    // Группа: Движение
    this.addGroupTitle('MOVEMENT');
    this.addCommandButton('↑ Up', 'up');
    this.addCommandButton('↓ Down', 'down');
    this.addCommandButton('← Left', 'left');
    this.addCommandButton('→ Right', 'right');
    this.addSeparator();

    // Группа: Инвентарь и взаимодействие
    this.addGroupTitle('INVENTORY');
    this.addCommandButton('📦 Push', 'push');
    this.addCommandButton('🔑 Use Key', 'use_key');
    this.addCommandButton('📥 Pickup', 'pickup');
    this.addCommandButton('🗑 Drop', 'drop');
    this.addSeparator();

    // Группа: Инструменты
    this.addGroupTitle('TOOLS');
    this.addCommandButton('🔧 Drill', 'drill');
    this.addCommandButton('🪝 Hook', 'hook');
    this.addCommandButton('🪽 Wing', 'wing');
    this.addCommandButton('🐟 Bait', 'bait');
    this.addSeparator();

    // Группа: Бой
    this.addGroupTitle('COMBAT');
    this.addCommandButton('🎯 Throw', 'throw');
    this.addCommandButton('🌽 Feed', 'feed');
    this.addSeparator();

    // Группа: Время
    this.addGroupTitle('TIME');
    this.addCommandButton('🐢 Time Slow', 'time_slow');
    this.addCommandButton('🐇 Time Fast', 'time_fast');
    this.addCommandButton('⏳ Wait', 'wait');
    this.addSeparator();

    // Группа: Функции
    this.addGroupTitle('FUNCTIONS');
    this.addCommandButton('📞 Call', 'call');
    this.addCommandButton('↩️ Return', 'return');
    this.addCommandButton('📥 Param', 'param');
    this.addSeparator();

    // Группа: ООП
    this.addGroupTitle('OOP');
    this.addCommandButton('🏛️ Class', 'class');
    this.addCommandButton('✨ New', 'new');
    this.addCommandButton('⚙️ Method', 'method');
    this.addSeparator();

    // Группа: Параллелизм
    this.addGroupTitle('PARALLELISM');
    this.addCommandButton('👥 Clone', 'clone');
    this.addCommandButton('🤝 Join', 'join');
    this.addSeparator();

    // Группа: Взаимодействие
    this.addGroupTitle('INTERACTION');
    this.addCommandButton('🔍 Scan', 'scan');
    this.addCommandButton('🐎 Ride', 'ride');
    this.addSeparator();

    // Группа: Чёрный ящик
    this.addGroupTitle('BLACK BOX');
    this.addCommandButton('📦 Black Box', 'black_box');
    this.addSeparator();

    // Группа: Авторешение
    this.addGroupTitle('AUTO');
    this.addCommandButton('🤖 AUTO', 'auto');
    this.addSeparator();

    // Группа: Управление
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

    this.createProgramPanel();
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
        this.commands = JSON.parse(saved);
        this.updateProgramList();
        this.onClearCallback();
        this.onAddCommandCallback(this.commands);
        alert('Program loaded!');
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
      let icon = '';
      if (cmd === 'up') icon = '↑';
      else if (cmd === 'down') icon = '↓';
      else if (cmd === 'left') icon = '←';
      else if (cmd === 'right') icon = '→';
      else if (cmd === 'push') icon = '📦';
      else if (cmd === 'use_key') icon = '🔑';
      else if (cmd === 'pickup') icon = '📥';
      else if (cmd === 'drop') icon = '🗑';
      else if (cmd === 'drill') icon = '🔧';
      else if (cmd === 'hook') icon = '🪝';
      else if (cmd === 'wing') icon = '🪽';
      else if (cmd === 'bait') icon = '🐟';
      else if (cmd === 'throw') icon = '🎯';
      else if (cmd === 'feed') icon = '🌽';
      else if (cmd === 'time_slow') icon = '🐢';
      else if (cmd === 'time_fast') icon = '🐇';
      else if (cmd === 'wait') icon = '⏳';
      else if (cmd === 'call') icon = '📞';
      else if (cmd === 'return') icon = '↩️';
      else if (cmd === 'param') icon = '📥';
      else if (cmd === 'class') icon = '🏛️';
      else if (cmd === 'new') icon = '✨';
      else if (cmd === 'method') icon = '⚙️';
      else if (cmd === 'clone') icon = '👥';
      else if (cmd === 'join') icon = '🤝';
      else if (cmd === 'scan') icon = '🔍';
      else if (cmd === 'ride') icon = '🐎';
      else if (cmd === 'black_box') icon = '📦';
      else if (cmd === 'auto') icon = '🤖';
      else icon = cmd.slice(0,2);
      
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

  public destroy(): void {
    if (this.container) this.container.remove();
    const rightPanel = document.querySelector('div[style*="right: 20px"]');
    if (rightPanel) rightPanel.remove();
  }
}
