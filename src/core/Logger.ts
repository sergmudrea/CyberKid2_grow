// src/core/Logger.ts
// ============================================================================
// СИСТЕМА ЛОГИРОВАНИЯ ДЛЯ ВСЕГО ПРОЕКТА
// ============================================================================
// Обеспечивает цветной вывод в консоль с указанием модуля, метода, уровня логирования.
// Позволяет отключать логи по уровням (DEBUG, INFO, WARN, ERROR, NONE).
// Все модули используют единый экземпляр Logger.
// ============================================================================

// Уровни логирования (чем больше число, тем важнее сообщения)
export enum LogLevel {
  DEBUG = 0,  // Подробная отладочная информация (только для разработки)
  INFO = 1,   // Общая информация (инициализация, загрузка уровней, прогресс)
  WARN = 2,   // Предупреждения (не критические ошибки, отсутствие файлов)
  ERROR = 3,  // Ошибки (исключения, падения, не найденные ресурсы)
  NONE = 4    // Полное отключение логов
}

export class Logger {
  private static instance: Logger;      // Singleton
  private level: LogLevel = LogLevel.DEBUG;  // Текущий уровень (можно изменить через setLevel)
  private moduleColors: Map<string, string> = new Map();  // Цвета для разных модулей

  // Приватный конструктор – запрещаем создание новых экземпляров
  private constructor() {
    // Список модулей, которые могут логировать. Каждому даём случайный цвет.
    const modules = [
      'LevelManager', 'ProgressManager', 'SaveManager', 'UnlockManager', 'SettingsManager',
      'GameScene', 'MainMenu', 'WorldMap', 'LevelSelect', 'VictoryScreen', 'Settings',
      'Stats', 'Paywall', 'SandboxScene', 'ArcadeBrowser',
      'Pathfinder', 'ExecutionEngine', 'CommandPanel', 'Player', 'LevelMap',
      'ExplorationMode', 'HintSystem', 'SandboxMaker', 'ProgramVisualizer'
    ];
    modules.forEach(module => {
      const hue = Math.random() * 360;
      // Сохраняем CSS-стиль для цвета текста
      this.moduleColors.set(module, `color: hsl(${hue}, 70%, 60%); font-weight: bold;`);
    });
  }

  // Получение единственного экземпляра
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Изменение уровня логирования (можно вызвать в консоли для отладки)
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  // Форматирование сообщения: [время] [Модуль.Метод] сообщение
  private formatMessage(module: string, method: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    return `[${timestamp}] [${module}.${method}] ${message}`;
  }

  // Внутренний метод вывода в консоль с цветом и префиксом
  private log(level: LogLevel, module: string, method: string, message: string, data?: any): void {
    if (level < this.level) return; // Если уровень ниже текущего – игнорируем

    const color = this.moduleColors.get(module) || 'color: white;';
    let levelPrefix = '';
    switch (level) {
      case LogLevel.DEBUG: levelPrefix = '🔍 DEBUG'; break;
      case LogLevel.INFO:  levelPrefix = 'ℹ️ INFO'; break;
      case LogLevel.WARN:  levelPrefix = '⚠️ WARN'; break;
      case LogLevel.ERROR: levelPrefix = '❌ ERROR'; break;
      default: levelPrefix = 'LOG';
    }

    const formatted = this.formatMessage(module, method, message, data);
    if (data !== undefined) {
      console.log(`%c${levelPrefix} %c${formatted}`, 'color: gray', color, data);
    } else {
      console.log(`%c${levelPrefix} %c${formatted}`, 'color: gray', color);
    }
  }

  // Публичные методы для использования в других модулях
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

// Экспортируем готовый синглтон для использования во всём проекте
export const logger = Logger.getInstance();
