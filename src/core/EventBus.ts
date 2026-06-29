// src/core/EventBus.ts
// ============================================================================
// ЦЕНТРАЛЬНАЯ ШИНА СОБЫТИЙ (EVENT BUS)
// ============================================================================
// Обеспечивает коммуникацию между различными частями игры (сцены, менеджеры, движок)
// без жёстких связей. Любой модуль может отправлять события, и любой другой модуль
// может на них подписываться.
// ============================================================================
// Используется внутренний Phaser Events.Emitter (быстрый и надёжный).
// ============================================================================

import { GameEvent } from '../types/index';
import Phaser from 'phaser';

// Вспомогательные типы для строгой типизации событий (опционально)
// GameEvent.type — это string, поэтому тип события строковый, а payload — произвольные данные.
// Извлечение payload через Extract<GameEvent, {type: T}> давало бы never для строковых литералов,
// поэтому payload типизируется как любой объект/значение события.
type EventType = string;
type EventPayload = GameEvent['payload'];

export class EventBus {
  private static instance: EventBus;
  private emitter: Phaser.Events.EventEmitter;
  private debugMode: boolean = false;   // Включать только для отладки, иначе спамит консоль

  private constructor() {
    this.emitter = new Phaser.Events.EventEmitter();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // Включить/выключить отладочный вывод всех событий
  public setDebug(enabled: boolean): void {
    this.debugMode = enabled;
  }

  // Отправить событие (оповещает всех подписчиков)
  // Тип события – строка, payload – любые данные (обычно объект)
  public emit<T extends EventType>(type: T, payload?: EventPayload): void {
    if (this.debugMode) console.log(`[EventBus] EMIT: ${type}`, payload);
    this.emitter.emit(type, payload);
  }

  // Подписаться на событие (callback будет вызываться при каждом emit)
  // Можно передать контекст (this) для правильной привязки
  public on<T extends EventType>(
    type: T,
    callback: (payload?: EventPayload) => void,
    context?: any
  ): void {
    this.emitter.on(type, callback, context);
  }

  // Отписаться от события (если передан callback – удалить конкретный, иначе все)
  public off<T extends EventType>(
    type: T,
    callback?: (payload?: EventPayload) => void,
    context?: any
  ): void {
    this.emitter.off(type, callback, context);
  }

  // Подписаться, но только на одно срабатывание (автоотписка после первого вызова)
  public once<T extends EventType>(
    type: T,
    callback: (payload?: EventPayload) => void,
    context?: any
  ): void {
    this.emitter.once(type, callback, context);
  }

  // Удалить всех подписчиков (используется при перезагрузке игры или уничтожении сцены)
  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

// Экспортируем готовый синглтон для использования во всём проекте
export const gameEvents = EventBus.getInstance();
