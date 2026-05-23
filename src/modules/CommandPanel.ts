import { Scene } from 'phaser';

export type Command = 'up' | 'down' | 'left' | 'right';

export class CommandPanel {
  private scene: Scene;
  private commands: Command[] = [];
  private container: HTMLDivElement;
  private onRunCallback: (commands: Command[]) => void;
  private onClearCallback: () => void;

  constructor(scene: Scene, onRun: (commands: Command[]) => void, onClear: () => void) {
    this.scene = scene;
    this.onRunCallback = onRun;
    this.onClearCallback = onClear;
    this.createPanel();
  }

  private createPanel(): void {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.bottom = '20px';
    this.container.style.left = '20px';
    this.container.style.right = '20px';
    this.container.style.backgroundColor = 'rgba(0,0,0,0.8)';
    this.container.style.borderRadius = '12px';
    this.container.style.padding = '10px';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '10px';
    this.container.style.fontFamily = 'monospace';
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
    const programList = document.createElement('div');
    programList.id = 'command-list';
    programList.style.backgroundColor = '#1e1e1e';
    programList.style.borderRadius = '8px';
    programList.style.minHeight = '60px';
    programList.style.padding = '8px';
    programList.style.display = 'flex';
    programList.style.flexWrap = 'wrap';
    programList.style.gap = '8px';
    this.container.appendChild(programList);

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

    this.container.appendChild(actionsRow);
  }

  private addCommand(cmd: Command): void {
    this.commands.push(cmd);
    this.updateProgramList();
  }

  private clearProgram(): void {
    this.commands = [];
    this.updateProgramList();
    if (this.onClearCallback) this.onClearCallback();
  }

  private updateProgramList(): void {
    const listDiv = document.getElementById('command-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
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
      listDiv.appendChild(cmdDiv);
    });
  }

  public destroy(): void {
    if (this.container) this.container.remove();
  }
}
