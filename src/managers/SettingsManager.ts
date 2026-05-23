import { UserSettings } from '../types/index';
import { gameEvents } from '../core/EventBus';

const STORAGE_KEY = 'cyberkid_settings';
const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  soundEnabled: true,
  musicEnabled: true,
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

  private loadFromLocalStorage(): UserSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  }

  private saveToLocalStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }
}

export const settingsManager = SettingsManager.getInstance();
