// src/modules/execution/oop.ts
// ============================================================================
// ПОДДЕРЖКА ОБЪЕКТНО-ОРИЕНТИРОВАННОГО ПРОГРАММИРОВАНИЯ: CLASS, NEW, METHOD
// ============================================================================
// Реализует:
// - определение классов (CLASS имя ... END)
// - создание экземпляров (NEW имя ...)
// - вызов методов (METHOD имя ... END) — но фактически метод вызывается через экземпляр
// ============================================================================
// В текущей реализации классы хранят свойства и методы.
// Для вызова метода нужно создать экземпляр, затем вызвать метод через специальный синтаксис.
// ============================================================================

import { ASTNode, ClassDef, Instance, MethodDef } from './types';
import { Command } from '../../types/index';
import { logInfo, logError } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';

// MethodDef перенесён в ./types и реэкспортируется для обратной совместимости
export type { MethodDef };

export class OOPExecutor {
  private classDefinitions: Map<string, ClassDef> = new Map();
  private instances: Map<string, Instance> = new Map();
  private nextInstanceId: number = 1;

  // --------------------------------------------------------------------------
  // CLASS – определить класс
  // --------------------------------------------------------------------------
  public defineClass(className: string, body: ASTNode[]): void {
    const properties = new Map<string, any>();
    const methods = new Map<string, MethodDef>();

    // Проходим по телу класса и извлекаем свойства и методы
    for (const node of body) {
      if (node.type === 'method' && node.methodName) {
        // Метод: собираем параметры из детей (узлы типа PARAM)
        const paramNames: string[] = [];
        if (node.children) {
          for (const child of node.children) {
            if (child.type === 'command' && child.command === Command.PARAM && child.functionName) {
              paramNames.push(child.functionName);
            }
          }
        }
        methods.set(node.methodName, { nodes: node.children || [], paramNames });
      }
      if (node.type === 'command' && node.command === Command.PARAM && node.functionName) {
        // Свойство класса (объявленное как PARAM вне метода)
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

  // --------------------------------------------------------------------------
  // NEW – создать экземпляр класса
  // --------------------------------------------------------------------------
  public createInstance(className: string, constructorArgs: any[] = []): { instanceId: string; instance: Instance } | null {
    const classDef = this.classDefinitions.get(className);
    if (!classDef) {
      logError('OOPExecutor', 'createInstance', `Class '${className}' not defined`);
      return null;
    }

    // Копируем свойства и методы из класса в экземпляр
    const instanceId = `instance_${this.nextInstanceId++}_${Date.now()}`;
    const properties = new Map(classDef.properties);
    const methods = new Map(classDef.methods);

    const instance: Instance = {
      classId: className,
      properties,
      methods,
    };

    this.instances.set(instanceId, instance);
    logInfo('OOPExecutor', 'createInstance', `Created instance '${instanceId}' of class '${className}'`);
    eventBus.emit('INSTANCE_CREATED', { classId: className, instanceId, args: constructorArgs });
    return { instanceId, instance };
  }

  // --------------------------------------------------------------------------
  // METHOD – подготовить вызов метода на экземпляре
  // --------------------------------------------------------------------------
  public prepareMethodCall(
    instanceId: string,
    methodName: string,
    args: any[]
  ): { instance: Instance; methodDef: MethodDef; context: any } | null {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      logError('OOPExecutor', 'prepareMethodCall', `Instance '${instanceId}' not found`);
      return null;
    }

    const methodDef = instance.methods.get(methodName);
    if (!methodDef) {
      logError('OOPExecutor', 'prepareMethodCall', `Method '${methodName}' not found in instance '${instanceId}'`);
      return null;
    }

    logInfo('OOPExecutor', 'prepareMethodCall', `Calling method '${methodName}' on instance '${instanceId}' with args: ${args}`);
    eventBus.emit('METHOD_CALL', { instanceId, methodName, args });

    // Контекст this: предоставляет доступ к свойствам и методам экземпляра
    const context = {
      properties: instance.properties,
      methods: instance.methods,
      getProperty: (prop: string) => instance.properties.get(prop),
      setProperty: (prop: string, val: any) => instance.properties.set(prop, val),
    };
    return { instance, methodDef, context };
  }

  // --------------------------------------------------------------------------
  // Доступ к свойствам экземпляра
  // --------------------------------------------------------------------------
  public getProperty(instanceId: string, propName: string): any {
    const instance = this.instances.get(instanceId);
    if (!instance) return undefined;
    return instance.properties.get(propName);
  }

  public setProperty(instanceId: string, propName: string, value: any): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.properties.set(propName, value);
    }
  }

  // --------------------------------------------------------------------------
  // Получение определения класса или экземпляра
  // --------------------------------------------------------------------------
  public getClass(className: string): ClassDef | undefined {
    return this.classDefinitions.get(className);
  }

  public getInstance(instanceId: string): Instance | undefined {
    return this.instances.get(instanceId);
  }
}
