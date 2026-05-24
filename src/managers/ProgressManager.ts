import { PlayerProgress, LevelStats } from '../types/index';

const STORAGE_KEY = 'cyberkid_progress';

export class ProgressManager {
  private static instance: ProgressManager;
  private progress: PlayerProgress;

  private constructor() {
    this.progress = this.loadFromLocalStorage();
  }

  public static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }

  public get(): PlayerProgress {
    return this.progress;
  }

  public getLevelStats(levelId: string): LevelStats | undefined {
    return this.progress.levelStats[levelId];
  }

  public completeLevel(levelId: string, stars: number, stepsUsed: number): void {
    const existing = this.progress.levelStats[levelId];
    const stats: LevelStats = {
      stars: Math.max(stars, existing?.stars || 0),
      attempts: (existing?.attempts || 0) + 1,
      bestSteps: existing ? Math.min(stepsUsed, existing.bestSteps) : stepsUsed,
      completed: true,
      lastPlayed: Date.now(),
    };
    this.progress.levelStats[levelId] = stats;
    
    if (!this.progress.levelsCompleted.includes(levelId)) {
      this.progress.levelsCompleted.push(levelId);
    }
    
    // Пересчёт общих звёзд
    let totalStars = 0;
    for (const st of Object.values(this.progress.levelStats)) {
      totalStars += st.stars;
    }
    this.progress.totalStars = totalStars;
    
    this.saveToLocalStorage();
  }

  public unlockWorld(worldId: string): void {
    if (!this.progress.unlockedWorlds.includes(worldId)) {
      this.progress.unlockedWorlds.push(worldId);
      this.saveToLocalStorage();
    }
  }

  public isWorldUnlocked(worldId: string): boolean {
    return this.progress.unlockedWorlds.includes(worldId);
  }

  private loadFromLocalStorage(): PlayerProgress {
    const defaultProgress: PlayerProgress = {
      totalStars: 0,
      totalBlackStars: 0,
      levelsCompleted: [],
      perfectLevels: [],
      levelStats: {},
      totalAttempts: 0,
      totalDeaths: 0,
      deathsByType: {},
      totalPlayTimeSec: 0,
      explorationUsedCount: 0,
      backdoorsFound: 0,
      unlockedWorlds: ['meadow'],
      lastPlayedWorld: 'meadow',
      lastPlayedLevelId: '',
      achievements: [],
      settings: {} as any,
    };
    
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaultProgress, ...parsed, levelStats: parsed.levelStats || {} };
      }
    } catch (e) {
      console.error('Failed to load progress:', e);
    }
    return defaultProgress;
  }

  private saveToLocalStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
  }

  public resetAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.progress = this.loadFromLocalStorage();
  }
}

export const progressManager = ProgressManager.getInstance();
