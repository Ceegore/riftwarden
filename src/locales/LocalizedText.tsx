import type { MessageParameters } from './format/compiled-types';
import { formatMessageToString } from './format/message-format';
import { useLocaleSnapshot } from './locale-hooks';

export interface LocalizedTextProps {
  readonly messageKey:string;
  readonly params?:MessageParameters;
}

export function LocalizedText({ messageKey, params = {} }:LocalizedTextProps) {
  const { bundle } = useLocaleSnapshot();
  return <>{formatMessageToString(bundle, messageKey, params)}</>;
}
