// src/managers/SettingsManager.ts
// ============================================================================
// МЕНЕДЖЕР НАСТРОЕК – ПОЛНАЯ ВЕРСИЯ ПАТЧА 2.0
// ============================================================================
// - Управление режимом обучения (Kiddo, Scholar, DevStudent, Developer)
// - Управление языком (ru/en)
// - Управление звуком и музыкой
// - Управление режимом управления башней (ControlMode: classic/separate)
// - Управление вибрацией, автоподсказками, туториалами
// - Режим разработчика (Developer Mode)
// ============================================================================

import { UserSettings, ControlMode, LearningMode } from '../types/index';
import { gameEvents } from '../core/EventBus';

const STORAGE_KEY = 'cyberkid_settings';
const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  soundEnabled: true,
  musicEnabled: true,
  controlMode: ControlMode.SEPARATE,   // по умолчанию новый режим (раздельное управление)
  learningMode: 'scholar' as LearningMode, // kiddo, scholar, dev_student, developer
  tutorialEnabled: true,
  autoHints: true,
  vibrationEnabled: true,
  developerMode: false,
};

export class SettingsManager {
  private static instance: SettingsManager;
  private settings: UserSettings;

  private constructor() {
    this.settings = this.loadFromLocalStorage();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  public get(): UserSettings {
    return { ...this.settings };
  }

  public set<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
    this.settings[key] = value;
    this.saveToLocalStorage();
    gameEvents.emit('SETTINGS_CHANGED', this.settings);
  }

  public setControlMode(mode: ControlMode): void {
    this.settings.controlMode = mode;
    this.saveToLocalStorage();
    gameEvents.emit('SETTINGS_CHANGED', this.settings);
    gameEvents.emit('CONTROL_MODE_CHANGED', mode);
  }

  public getControlMode(): ControlMode {
    return this.settings.controlMode;
  }

  public toggleControlMode(): void {
    const next = this.settings.controlMode === ControlMode.SEPARATE
      ? ControlMode.CLASSIC
      : ControlMode.SEPARATE;
    this.setControlMode(next);
  }

  // --- Режим обучения (Kiddo / Scholar / Dev Student / Developer) ---
  public getLearningMode(): LearningMode {
    return this.settings.learningMode;
  }

  public setLearningMode(mode: LearningMode): void {
    this.set('learningMode', mode);
  }

  // --- Язык ---
  public getLanguage(): string {
    return this.settings.language;
  }

  public setLanguage(lang: string): void {
    this.set('language', lang);
  }

  // --- Звук ---
  public isSoundEnabled(): boolean {
    return this.settings.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.set('soundEnabled', enabled);
  }

  // --- Музыка ---
  public isMusicEnabled(): boolean {
    return this.settings.musicEnabled;
  }

  public setMusicEnabled(enabled: boolean): void {
    this.set('musicEnabled', enabled);
  }

  private loadFromLocalStorage(): UserSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Обратная совместимость: если controlMode отсутствует, установить SEPARATE
        if (!parsed.controlMode) parsed.controlMode = ControlMode.SEPARATE;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings', e);
    }
  }

  public resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveToLocalStorage();
    gameEvents.emit('SETTINGS_CHANGED', this.settings);
  }
}

export const settingsManager = SettingsManager.getInstance();
