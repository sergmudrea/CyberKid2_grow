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
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '50%';
    this.container.style.left = '20px';
    this.container.style.transform = 'translateY(-50%)';
    this.container.style.width = '160px';
    this.container.style.backgroundColor = 'rgba(0,0,0,0.85)';
    this.container.style.borderRadius = '12px';
    this.container.style.padding = '10px';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '8px';
    this.container.style.fontFamily = 'monospace';
    this.container.style.zIndex = '1000';
    document.body.appendChild(this.container);

    const title = document.createElement('div');
    title.textContent = 'COMMANDS';
    title.style.color = '#00ffcc';
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';
    title.style.marginBottom = '5px';
    this.container.appendChild(title);

    const addButton = (label: string, cmd: Command) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.padding = '8px';
      btn.style.fontSize = '16px';
      btn.style.backgroundColor = '#2a2a4a';
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.style.marginBottom = '5px';
      btn.onclick = () => {
        this.commands.push(cmd);
        this.updateProgramList();
        this.onAddCommandCallback(this.commands);
      };
      this.container.appendChild(btn);
    };

    addButton('↑ Up', 'up');
    addButton('↓ Down', 'down');
    addButton('← Left', 'left');
    addButton('→ Right', 'right');

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
    clearBtn.onclick = () => {
      this.commands = [];
      this.updateProgramList();
      this.onClearCallback();
    };
    this.container.appendChild(clearBtn);

    this.createProgramPanel();
  }

  private createProgramPanel(): void {
    const programContainer = document.createElement('div');
    programContainer.style.position = 'absolute';
    programContainer.style.top = '50%';
    programContainer.style.right = '20px';
    programContainer.style.transform = 'translateY(-50%)';
    programContainer.style.width = '200px';
    programContainer.style.backgroundColor = 'rgba(0,0,0,0.85)';
    programContainer.style.borderRadius = '12px';
    programContainer.style.padding = '10px';
    programContainer.style.display = 'flex';
    programContainer.style.flexDirection = 'column';
    programContainer.style.gap = '10px';
    programContainer.style.fontFamily = 'monospace';
    programContainer.style.zIndex = '1000';
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
    this.programListDiv.style.maxHeight = '400px';
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
      if (cmd === 'down') icon = '↓';
      if (cmd === 'left') icon = '←';
      if (cmd === 'right') icon = '→';
      cmdText.textContent = `${icon} ${cmd}`;
      cmdText.style.fontSize = '14px';
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
