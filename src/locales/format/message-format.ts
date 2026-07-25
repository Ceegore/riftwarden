import type {
  CompiledBundle,
  CompiledMessage,
  CompiledNode,
  FormattedPart,
  MessageParameters,
  PrimitiveParameter,
} from './compiled-types';
import { LocaleRuntimeError } from './errors';

interface RenderContext {
  readonly locale:string;
  readonly params:MessageParameters;
  readonly numberFormat:Intl.NumberFormat;
  readonly pluralRules:Intl.PluralRules;
  readonly pluralValue:number | null;
}

function requireMessage(bundle:CompiledBundle, key:string):CompiledMessage {
  const message = bundle.messages[key];
  if (!message) throw new LocaleRuntimeError('L10N_RUNTIME_MISSING_KEY', `Missing localization key: ${key}`, { key });
  return message;
}

function validateParameters(message:CompiledMessage, key:string, params:MessageParameters):void {
  const expected = Object.keys(message.parameters).sort();
  const actual = Object.keys(params).sort();
  for (const name of expected) {
    if (!Object.hasOwn(params, name)) throw new LocaleRuntimeError('L10N_RUNTIME_MISSING_PARAMETER', `Missing parameter ${name} for ${key}`, { key, parameter:name });
    const kind = message.parameters[name];
    if (!kind) throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_BUNDLE', `Missing parameter kind for ${name}`, { key, parameter:name });
    const value = params[name];
    if (value === undefined) throw new LocaleRuntimeError('L10N_RUNTIME_MISSING_PARAMETER', `Missing parameter ${name} for ${key}`, { key, parameter:name });
    validateType(kind, value, key, name);
  }
  for (const name of actual) {
    if (!Object.hasOwn(message.parameters, name)) throw new LocaleRuntimeError('L10N_RUNTIME_EXTRA_PARAMETER', `Unexpected parameter ${name} for ${key}`, { key, parameter:name });
  }
}

function validateType(kind:string, value:PrimitiveParameter, key:string, name:string):void {
  if ((kind === 'number' || kind === 'plural') && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new LocaleRuntimeError('L10N_RUNTIME_PARAMETER_TYPE', `${name} for ${key} must be a finite number`, { key, parameter:name });
  }
  if (kind === 'string' && !['string','number','boolean'].includes(typeof value)) {
    throw new LocaleRuntimeError('L10N_RUNTIME_PARAMETER_TYPE', `${name} for ${key} must be primitive`, { key, parameter:name });
  }
  if (kind === 'select' && !['string','number','boolean'].includes(typeof value)) {
    throw new LocaleRuntimeError('L10N_RUNTIME_PARAMETER_TYPE', `${name} for ${key} must be select-compatible`, { key, parameter:name });
  }
}

function text(value:string):FormattedPart {
  return { type:'text', value };
}

function render(nodes:readonly CompiledNode[], context:RenderContext):FormattedPart[] {
  const parts:FormattedPart[] = [];
  const appendText = (value:string):void => {
    if (!value) return;
    const previous = parts.at(-1);
    if (previous?.type === 'text') parts[parts.length - 1] = text(previous.value + value);
    else parts.push(text(value));
  };

  for (const node of nodes) {
    if (node.t === 'text') appendText(node.v);
    else if (node.t === 'arg') appendText(String(context.params[node.n]));
    else if (node.t === 'number') appendText(context.numberFormat.format(context.params[node.n] as number));
    else if (node.t === 'pound') {
      if (context.pluralValue === null) throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_BUNDLE', '# outside plural in compiled bundle');
      appendText(context.numberFormat.format(context.pluralValue));
    } else if (node.t === 'select') {
      const label = String(context.params[node.n]);
      const branch = node.b[label] ?? node.b['other'];
      if (!branch) throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_BUNDLE', `Select ${node.n} lacks other branch`);
      parts.push(...render(branch, context));
    } else if (node.t === 'plural') {
      const value = context.params[node.n] as number;
      const exact = node.b[`=${String(value)}`];
      const branch = exact ?? node.b[context.pluralRules.select(value)] ?? node.b['other'];
      if (!branch) throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_BUNDLE', `Plural ${node.n} lacks other branch`);
      parts.push(...render(branch, { ...context, pluralValue:value }));
    } else if (node.mode === 'self') {
      parts.push({ type:'token', kind:node.k, id:node.id, mode:'self' });
    } else {
      parts.push({ type:'token', kind:node.k, id:node.id, mode:'paired', children:render(node.c, context) });
    }
  }
  return parts;
}

export function formatMessageToParts(bundle:CompiledBundle, key:string, params:MessageParameters = {}):readonly FormattedPart[] {
  const message = requireMessage(bundle, key);
  validateParameters(message, key, params);
  const locale = bundle.locale === 'qps-ploc' ? 'de' : bundle.locale;
  return render(message.ast, {
    locale,
    params,
    numberFormat:new Intl.NumberFormat(locale),
    pluralRules:new Intl.PluralRules(locale),
    pluralValue:null,
  });
}

export function formatMessageToString(bundle:CompiledBundle, key:string, params:MessageParameters = {}):string {
  const parts = formatMessageToParts(bundle, key, params);
  let result = '';
  const flatten = (items:readonly FormattedPart[]):void => {
    for (const part of items) {
      if (part.type === 'text') result += part.value;
      else if (part.mode === 'paired') flatten(part.children);
      else throw new LocaleRuntimeError('L10N_RUNTIME_RICH_TEXT_REQUIRED', `${key} contains a self-closing RichText token`, { key });
    }
  };
  flatten(parts);
  return result;
}
