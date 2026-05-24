export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.DEBUG;
  private moduleColors: Map<string, string> = new Map();

  private constructor() {
    // Генерируем случайные цвета для модулей
    const modules = [
      'LevelManager', 'ProgressManager', 'SaveManager', 'UnlockManager', 'SettingsManager',
      'GameScene', 'MainMenu', 'WorldMap', 'LevelSelect', 'VictoryScreen', 'Settings',
      'Stats', 'Paywall', 'SandboxScene', 'ArcadeBrowser',
      'Pathfinder', 'ExecutionEngine', 'CommandPanel', 'Player', 'LevelMap',
      'ExplorationMode', 'HintSystem', 'SandboxMaker', 'ProgramVisualizer'
    ];
    modules.forEach(module => {
      const hue = Math.random() * 360;
      this.moduleColors.set(module, `color: hsl(${hue}, 70%, 60%); font-weight: bold;`);
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  private formatMessage(module: string, method: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString().slice(11, 23);
    return `[${timestamp}] [${module}.${method}] ${message}`;
  }

  private log(level: LogLevel, module: string, method: string, message: string, data?: any): void {
    if (level < this.level) return;
    
    const color = this.moduleColors.get(module) || 'color: white;';
    const levelPrefix = level === LogLevel.DEBUG ? '🔍 DEBUG' : 
                        level === LogLevel.INFO ? 'ℹ️ INFO' : 
                        level === LogLevel.WARN ? '⚠️ WARN' : '❌ ERROR';
    
    const formatted = this.formatMessage(module, method, message, data);
    
    if (data !== undefined) {
      console.log(`%c${levelPrefix} %c${formatted}`, 'color: gray', color, data);
    } else {
      console.log(`%c${levelPrefix} %c${formatted}`, 'color: gray', color);
    }
  }

  public debug(module: string, method: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, module, method, message, data);
  }

  public info(module: string, method: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, module, method, message, data);
  }

  public warn(module: string, method: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, module, method, message, data);
  }

  public error(module: string, method: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, module, method, message, data);
  }
}

export const logger = Logger.getInstance();
