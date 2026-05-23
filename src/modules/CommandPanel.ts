import { Scene } from 'phaser';

export type Command = 'up' | 'down' | 'left' | 'right';

export class CommandPanel {
  private scene: Scene;
  private commands: Command[] = [];
  private container: HTMLDivElement;
  private programListDiv: HTMLDivElement;
  private onRunCallback: (commands: Command[]) => void;
  private onClearCallback: () => void;
  private onSaveCallback: () => void;
  private onLoadCallback: () => void;

  constructor(
    scene: Scene,
    onRun: (commands: Command[]) => void,
    onClear: () => void,
    onSave: () => void,
    onLoad: () => void
  ) {
    this.scene = scene;
    this.onRunCallback = onRun;
    this.onClearCallback = onClear;
    this.onSaveCallback = onSave;
    this.onLoadCallback = onLoad;
    this.createPanel();
  }

  private createPanel(): void {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.bottom = '20px';
    this.container.style.left = '20px';
    this.container.style.right = '20px';
    this.container.style.backgroundColor = 'rgba(0,0,0,0.85)';
    this.container.style.borderRadius = '12px';
    this.container.style.padding = '10px';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '10px';
    this.container.style.fontFamily = 'monospace';
    this.container.style.zIndex = '1000';
    document.body.appendChild(this.container);

    // Ряд кнопок команд
    const buttonsRow = document.createElement('div');
    buttonsRow.style.display = 'flex';
    buttonsRow.style.gap = '10px';
    buttonsRow.style.justifyContent = 'center';

    const addButton = (label: string, cmd: Command) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.padding = '8px 16px';
      btn.style.fontSize = '18px';
      btn.style.backgroundColor = '#2a2a4a';
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.onclick = () => this.addCommand(cmd);
      buttonsRow.appendChild(btn);
    };

    addButton('↑ Up', 'up');
    addButton('↓ Down', 'down');
    addButton('← Left', 'left');
    addButton('→ Right', 'right');

    this.container.appendChild(buttonsRow);

    // Список команд программы
    this.programListDiv = document.createElement('div');
    this.programListDiv.id = 'command-list';
    this.programListDiv.style.backgroundColor = '#1e1e1e';
    this.programListDiv.style.borderRadius = '8px';
    this.programListDiv.style.minHeight = '60px';
    this.programListDiv.style.padding = '8px';
    this.programListDiv.style.display = 'flex';
    this.programListDiv.style.flexWrap = 'wrap';
    this.programListDiv.style.gap = '8px';
    this.container.appendChild(this.programListDiv);

    // Кнопки управления
    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '10px';
    actionsRow.style.justifyContent = 'center';

    const runBtn = document.createElement('button');
    runBtn.textContent = '▶ RUN';
    runBtn.style.padding = '8px 24px';
    runBtn.style.fontSize = '18px';
    runBtn.style.backgroundColor = '#00aa44';
    runBtn.style.color = 'white';
    runBtn.style.border = 'none';
    runBtn.style.borderRadius = '6px';
    runBtn.style.cursor = 'pointer';
    runBtn.onclick = () => this.onRunCallback(this.commands);
    actionsRow.appendChild(runBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑 CLEAR';
    clearBtn.style.padding = '8px 24px';
    clearBtn.style.fontSize = '18px';
    clearBtn.style.backgroundColor = '#aa4444';
    clearBtn.style.color = 'white';
    clearBtn.style.border = 'none';
    clearBtn.style.borderRadius = '6px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.onclick = () => this.clearProgram();
    actionsRow.appendChild(clearBtn);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 SAVE';
    saveBtn.style.padding = '8px 24px';
    saveBtn.style.fontSize = '18px';
    saveBtn.style.backgroundColor = '#4444aa';
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '6px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.onclick = () => this.onSaveCallback();
    actionsRow.appendChild(saveBtn);

    const loadBtn = document.createElement('button');
    loadBtn.textContent = '📂 LOAD';
    loadBtn.style.padding = '8px 24px';
    loadBtn.style.fontSize = '18px';
    loadBtn.style.backgroundColor = '#aa8844';
    loadBtn.style.color = 'white';
    loadBtn.style.border = 'none';
    loadBtn.style.borderRadius = '6px';
    loadBtn.style.cursor = 'pointer';
    loadBtn.onclick = () => this.onLoadCallback();
    actionsRow.appendChild(loadBtn);

    this.container.appendChild(actionsRow);
  }

  private addCommand(cmd: Command): void {
    this.commands.push(cmd);
    this.updateProgramList();
  }

  public clearProgram(): void {
    this.commands = [];
    this.updateProgramList();
    if (this.onClearCallback) this.onClearCallback();
  }

  public loadProgram(commands: Command[]): void {
    this.commands = [...commands];
    this.updateProgramList();
  }

  public getCommands(): Command[] {
    return [...this.commands];
  }

  private updateProgramList(): void {
    if (!this.programListDiv) return;
    this.programListDiv.innerHTML = '';
    this.commands.forEach((cmd, index) => {
      const cmdDiv = document.createElement('div');
      cmdDiv.style.backgroundColor = '#3a3a5a';
      cmdDiv.style.padding = '6px 12px';
      cmdDiv.style.borderRadius = '6px';
      cmdDiv.style.display = 'flex';
      cmdDiv.style.alignItems = 'center';
      cmdDiv.style.gap = '8px';

      const cmdText = document.createElement('span');
      let icon = '';
      if (cmd === 'up') icon = '↑';
      if (cmd === 'down') icon = '↓';
      if (cmd === 'left') icon = '←';
      if (cmd === 'right') icon = '→';
      cmdText.textContent = `${icon} ${cmd}`;
      cmdText.style.fontSize = '16px';
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
      };

      cmdDiv.appendChild(cmdText);
      cmdDiv.appendChild(removeBtn);
      this.programListDiv.appendChild(cmdDiv);
    });
  }

  public destroy(): void {
    if (this.container) this.container.remove();
  }
}
