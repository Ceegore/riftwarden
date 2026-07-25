import { Fragment, type ReactNode } from 'react';
import type { FormattedPart, MessageParameters } from './format/compiled-types';
import { formatMessageToParts } from './format/message-format';
import { useLocaleSnapshot } from './locale-hooks';

export interface RichTextBindings {
  readonly icons:Readonly<Record<string, ReactNode>>;
  readonly actions:Readonly<Record<string, () => void>>;
  readonly glossaries:Readonly<Record<string, () => void>>;
}

export interface RichTextProps {
  readonly messageKey:string;
  readonly params?:MessageParameters;
  readonly bindings:RichTextBindings;
}

export function RichText({ messageKey, params = {}, bindings }:RichTextProps) {
  const { bundle } = useLocaleSnapshot();
  const parts = formatMessageToParts(bundle, messageKey, params);
  return <>{renderParts(parts, bindings, messageKey)}</>;
}

function renderParts(parts:readonly FormattedPart[], bindings:RichTextBindings, keyPrefix:string):ReactNode[] {
  return parts.map((part, index) => {
    const key = `${keyPrefix}:${String(index)}`;
    if (part.type === 'text') return <Fragment key={key}>{part.value}</Fragment>;
    if (part.kind === 'icon' && part.mode === 'self') {
      const icon = bindings.icons[part.id];
      if (icon === undefined) throw new Error(`Missing code-owned icon binding: ${part.id}`);
      return <Fragment key={key}>{icon}</Fragment>;
    }
    if (part.mode !== 'paired') throw new Error(`Unsupported self-closing token: ${part.kind}`);
    const children = renderParts(part.children, bindings, key);
    if (part.kind === 'strong') return <strong key={key}>{children}</strong>;
    if (part.kind === 'action') {
      const action = bindings.actions[part.id];
      if (!action) throw new Error(`Missing code-owned action binding: ${part.id}`);
      return <button key={key} type="button" onClick={action}>{children}</button>;
    }
    if (part.kind === 'glossary') {
      const open = bindings.glossaries[part.id];
      if (!open) throw new Error(`Missing code-owned glossary binding: ${part.id}`);
      return <button key={key} type="button" onClick={open} aria-haspopup="dialog">{children}</button>;
    }
    throw new Error(`Unsupported paired RichText token: ${part.kind}`);
  });
}
