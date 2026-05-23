import { GameEvent } from '../types/index';
import Phaser from 'phaser';

type EventType = GameEvent['type'];
type EventPayload<T extends EventType> = Extract<GameEvent, { type: T }>['payload'];

export class EventBus {
  private static instance: EventBus;
  private emitter: Phaser.Events.EventEmitter;
  private debugMode: boolean = false;

  private constructor() {
    this.emitter = new Phaser.Events.EventEmitter();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public setDebug(enabled: boolean): void {
    this.debugMode = enabled;
  }

  public emit<T extends EventType>(type: T, payload?: EventPayload<T>): void {
    if (this.debugMode) console.log(`[EventBus] EMIT: ${type}`, payload);
    this.emitter.emit(type, payload);
  }

  public on<T extends EventType>(type: T, callback: (payload?: EventPayload<T>) => void, context?: any): void {
    this.emitter.on(type, callback, context);
  }

  public off<T extends EventType>(type: T, callback?: (payload?: EventPayload<T>) => void, context?: any): void {
    this.emitter.off(type, callback, context);
  }

  public once<T extends EventType>(type: T, callback: (payload?: EventPayload<T>) => void, context?: any): void {
    this.emitter.once(type, callback, context);
  }

  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

export const gameEvents = EventBus.getInstance();
