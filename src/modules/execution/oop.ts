// src/modules/execution/oop.ts
// Команды ООП: CLASS, NEW, METHOD

import { ASTNode, ClassDef, Instance } from './types';
import { log, logInfo, logError } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';

export class OOPExecutor {
  private classDefinitions: Map<string, ClassDef> = new Map();
  private instances: Map<string, Instance> = new Map();
  private nextInstanceId: number = 1;

  /**
   * CLASS — определить класс
   */
  public defineClass(className: string, body: ASTNode[]): void {
    const properties = new Map<string, any>();
    const methods = new Map<string, ASTNode[]>();

    // Парсим тело класса: ищем METHOD узлы и PARAM команды для свойств
    for (const node of body) {
      if (node.type === 'method' && node.methodName) {
        methods.set(node.methodName, node.children || []);
      }
      if (node.type === 'command' && node.command === 'PARAM' && node.functionName) {
        properties.set(node.functionName, null);
      }
    }

    this.classDefinitions.set(className, {
      name: className,
      properties,
      methods,
    });

    logInfo('OOPExecutor', 'defineClass', `Class '${className}' defined with ${methods.size} methods and ${properties.size} properties`);
    eventBus.emit('CLASS_DEFINED', { name: className });
  }

  /**
   * NEW — создать экземпляр класса
   */
  public executeNew(className: string): 'ok' {
    const classDef = this.classDefinitions.get(className);
    if (!classDef) {
      logError('OOPExecutor', 'executeNew', `Class '${className}' not defined`);
      return 'ok';
    }

    const instanceId = `instance_${this.nextInstanceId++}_${Date.now()}`;
    const instance: Instance = {
      classId: className,
      properties: new Map(classDef.properties),
      methods: new Map(classDef.methods),
    };

    this.instances.set(instanceId, instance);
    logInfo('OOPExecutor', 'executeNew', `Created instance '${instanceId}' of class '${className}'`);
    eventBus.emit('INSTANCE_CREATED', { classId: className, instanceId });

    return 'ok';
  }

  /**
   * METHOD — вызвать метод объекта (упрощённо)
   */
  public executeMethod(instanceId: string, methodName: string, args: any[]): 'ok' {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      logError('OOPExecutor', 'executeMethod', `Instance '${instanceId}' not found`);
      return 'ok';
    }

    const methodBody = instance.methods.get(methodName);
    if (!methodBody) {
      logError('OOPExecutor', 'executeMethod', `Method '${methodName}' not found in instance '${instanceId}'`);
      return 'ok';
    }

    logInfo('OOPExecutor', 'executeMethod', `Calling method '${methodName}' on instance '${instanceId}'`);
    eventBus.emit('METHOD_CALL', { instanceId, methodName });

    // В реальности здесь нужно выполнить тело метода с контекстом (this)
    // Для упрощения — возвращаем ok
    return 'ok';
  }

  /**
   * Получить свойство экземпляра
   */
  public getProperty(instanceId: string, propName: string): any {
    const instance = this.instances.get(instanceId);
    if (!instance) return undefined;
    return instance.properties.get(propName);
  }

  /**
   * Установить свойство экземпляра
   */
  public setProperty(instanceId: string, propName: string, value: any): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.properties.set(propName, value);
    }
  }

  public getClass(className: string): ClassDef | undefined {
    return this.classDefinitions.get(className);
  }

  public getInstance(instanceId: string): Instance | undefined {
    return this.instances.get(instanceId);
  }
}
