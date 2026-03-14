/**
 * CONDITION EVALUATOR
 * Évalue les règles logiques pour le branchement des workflows.
 * Supporte la logique complexe (AND/OR) et l'accès sécurisé aux données.
 */

import type { FinalExecutionContext } from "../structured-types";

export interface Rule {
  field: string;
  operator: 'equals' | '==' | 'not_equals' | '!=' | 'greater_than' | '>' | 'less_than' | '<' | 'contains' | 'exists';
  value: unknown;
}

export interface ConditionGroup {
  logic: 'AND' | 'OR';
  rules: (Rule | ConditionGroup)[];
}

function isConditionGroup(obj: Rule | ConditionGroup): obj is ConditionGroup {
  return 'logic' in obj && Array.isArray((obj as ConditionGroup).rules);
}

export class ConditionEvaluator {
  /**
   * Évalue un ensemble de règles, un groupe de conditions, ou une condition string.
   * Supporte les conditions simples comme "field === 'value'" ou "score > 10"
   */
  evaluate(
    rules: Rule | ConditionGroup | (Rule | ConditionGroup)[] | string | null | undefined,
    context: FinalExecutionContext
  ): boolean {
    // Support pour les conditions string simples (ex: "field === 'value'")
    if (typeof rules === 'string') {
      return this.evaluateStringCondition(rules, context);
    }
    if (!rules) return false;

    if (!Array.isArray(rules) && isConditionGroup(rules)) {
      return this.evaluateGroup(rules, context);
    }

    if (Array.isArray(rules)) {
      return rules.some(rule => this.evaluateRuleOrGroup(rule, context));
    }

    if ('field' in rules && 'operator' in rules) {
      return this.evaluateRule(rules, context);
    }

    return false;
  }

  private evaluateRuleOrGroup(item: Rule | ConditionGroup, context: FinalExecutionContext): boolean {
    return isConditionGroup(item)
      ? this.evaluateGroup(item, context)
      : this.evaluateRule(item, context);
  }

  evaluateGroup(group: ConditionGroup, context: FinalExecutionContext): boolean {
    if (group.logic === 'AND') {
      return group.rules.every(rule => this.evaluateRuleOrGroup(rule, context));
    } else {
      return group.rules.some(rule => this.evaluateRuleOrGroup(rule, context));
    }
  }

  evaluateRule(rule: Rule, context: FinalExecutionContext): boolean {
    const value = this.getValueByPath(context, rule.field);
    const target = rule.value;

    switch (rule.operator) {
      case 'equals':
      case '==':
        return value == target;
      case 'not_equals':
      case '!=':
        return value != target;
      case 'greater_than':
      case '>':
        return Number(value) > Number(target);
      case 'less_than':
      case '<':
        return Number(value) < Number(target);
      case 'contains':
        return String(value).toLowerCase().includes(String(target).toLowerCase());
      case 'exists':
        return value !== undefined && value !== null && value !== '';
      default:
        return false;
    }
  }

  /**
   * Évalue une condition string simple (ex: "field === 'value'" ou "score > 10")
   * Remplace eval() de manière sécurisée
   */
  private evaluateStringCondition(condition: string, context: FinalExecutionContext): boolean {
    try {
      if (!condition || typeof condition !== 'string') return false;

      const trimmed = condition.trim();
      
      // Cas simple : booléen
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;

      // Vérifier qu'il n'y a pas de code dangereux
      const dangerous = ['eval', 'Function', 'constructor', 'prototype', '__proto__', 'require', 'import'];
      for (const keyword of dangerous) {
        if (trimmed.includes(keyword)) return false;
      }

      // Traiter les opérateurs logiques (&&, ||)
      if (trimmed.includes('||')) {
        return trimmed.split('||').some(part => 
          this.evaluateStringCondition(part.trim(), context)
        );
      }

      if (trimmed.includes('&&')) {
        return trimmed.split('&&').every(part => 
          this.evaluateStringCondition(part.trim(), context)
        );
      }

      // Traiter les opérateurs de comparaison
      const operators = ['===', '!==', '==', '!=', '<=', '>=', '<', '>'];
      for (const op of operators) {
        if (trimmed.includes(op)) {
          const [leftStr, rightStr] = trimmed.split(op).map(s => s.trim());
          if (!leftStr || !rightStr) return false;

          const left = this.parseStringValue(leftStr, context);
          const right = this.parseStringValue(rightStr, context);

          return this.compareValues(left, right, op);
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Parse une valeur string (variable du contexte ou littéral)
   */
  private parseStringValue(value: string, context: FinalExecutionContext): unknown {
    const trimmed = value.trim();

    // Littéral string (entre guillemets)
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Littéral number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Littéral booléen
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Variable du contexte
    return this.getValueByPath(context, trimmed);
  }

  /**
   * Compare deux valeurs avec un opérateur
   */
  private compareValues(left: unknown, right: unknown, operator: string): boolean {
    switch (operator) {
      case '===':
        return left === right;
      case '!==':
        return left !== right;
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '<':
        return (left as number) < (right as number);
      case '>':
        return (left as number) > (right as number);
      case '<=':
        return (left as number) <= (right as number);
      case '>=':
        return (left as number) >= (right as number);
      default:
        return false;
    }
  }

  private getValueByPath(obj: FinalExecutionContext, path: string): unknown {
    if (!path) return undefined;

    // On retire le préfixe 'context.' si présent pour la compatibilité
    const cleanPath = path.startsWith('context.') ? path.substring(8) : path;

    return cleanPath.split('.').reduce<unknown>((acc, part) => {
      if (acc === null || acc === undefined) return undefined;
      return (acc as Record<string, unknown>)[part];
    }, obj as unknown);
  }
}
