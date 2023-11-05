import { CompiledEventExpression, EventExpressionCompiler, EventExpressionEngine, EventExpressionEvaluator } from '../event/expression';
import { VariableStore, VariableChangedEvent } from '../variableStore';
import { GuiBase } from './guiBase';
import { GameTextEngine } from './textEngine';

export interface GuiStatsBarItemUpdateTrigger {
  variables: string[];
}

export interface GuiStatsBarItemConditionalStyle {
  // An expression string that can be compiled by `EventExpressionCompiler`.
  // You can use the same conditions defined in `GameEvent` here.
  condition: string;
  // List of classes to be applied to the stats bar item when the condition is
  // met. If unset or empty, it effectively removes all classes.
  styleClasses?: string[];
}

export interface GuiStatsBarItemDefinition {
  // Localizible text to be displayed.
  text: string;
  // Determines if the item shows on the left or the right side.
  side?: 'left' | 'right';
  // If the rendering of `text` depends on any variables in `VariableStore`,
  // they need to listed here to the stats display can be updated properly once
  // the variables change.
  updateTrigger?: GuiStatsBarItemUpdateTrigger;
  // Optional list of conditional styles to be applied. If multiple conditions
  // are met, only the styles associated with the first one will be applied.
  // If none of the conditions are met, a default style (no class) will be
  // applied.
  conditionalStyles?: GuiStatsBarItemConditionalStyle[];
}

export interface GuiStatsBarDefinition {
  items?: GuiStatsBarItemDefinition[];
}

interface CompiledConditionalStyle {
  conditionExpression: CompiledEventExpression;
  classNames: string[];
}

class GuiStatsBarItem {

  private _container: HTMLElement;
  private _text: string;
  private _conditionalStyles: CompiledConditionalStyle[] = [];

  constructor(container: HTMLElement, exprCompiler: EventExpressionCompiler,
              definition: GuiStatsBarItemDefinition) {
    this._container = container;
    this._text = definition.text;
    if (definition.conditionalStyles) {
      for (const style of definition.conditionalStyles) {
        this._conditionalStyles.push({
          conditionExpression: exprCompiler.compile(style.condition),
          classNames: style.styleClasses ? [...style.styleClasses] : []
        });
      }
    }
  }

  update(textEngine: GameTextEngine, ee: EventExpressionEvaluator) {
    this._container.innerHTML = textEngine.localizeAndRender(this._text);
    let conditionMet = false;
    for (const style of this._conditionalStyles) {
      if (!!ee.eval(style.conditionExpression)) {
        this._container.className = style.classNames.join(' ');
        conditionMet = true;
        break;
      }
    }
    if (!conditionMet) {
      this._container.className = '';
    }
  }
  
}

// Displays various player stats at the very top of the screen.
export class GuiStatsBar extends GuiBase<HTMLElement> {

  private _itemsByTriggeringVariable: Record<string, GuiStatsBarItem[]> = {};
  private _expressionEvaluator: EventExpressionEvaluator;

  constructor(container: HTMLElement, textEngine: GameTextEngine,
              expressionEngine: EventExpressionEngine,
              definition?: GuiStatsBarDefinition) {
    super(container, textEngine);
    this._expressionEvaluator = expressionEngine;
    if (!definition || !definition.items) return;
    const leftContainer = this.createAndAddChild('div', 'stats_left');
    const rightContainer = this.createAndAddChild('div', 'stats_right');
    for (const itemDef of definition.items) {
      textEngine.getLocalizationDictionary().addRequiredKey(itemDef.text);
      const itemContainer = document.createElement('p');
      const item = new GuiStatsBarItem(itemContainer, expressionEngine,
                                       itemDef);
      if (!itemDef.side || itemDef.side === 'left') {
        leftContainer.appendChild(itemContainer);
      } else if (itemDef.side === 'right') {
        rightContainer.appendChild(itemContainer);
      } else {
        throw new Error(`Unknown side: ${itemDef.side}.`);
      }
      if (itemDef.updateTrigger) {
        for (const varName of itemDef.updateTrigger.variables) {
          if (varName in this._itemsByTriggeringVariable) {
            this._itemsByTriggeringVariable[varName].push(item);
          } else {
            this._itemsByTriggeringVariable[varName] = [item];
          }
        }
      }
    }
  }

  handleVariableUpdate(sender: VariableStore, e: VariableChangedEvent): void {
    if (e.clear) return;
    if (e.varName in this._itemsByTriggeringVariable) {
      for (const item of this._itemsByTriggeringVariable[e.varName]) {
        item.update(this._textEngine, this._expressionEvaluator);
      }
    }
  }
}