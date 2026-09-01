import { LocalizedText } from '../../locales/LocalizedText.js';
export function Loading({phaseKey}: {phaseKey?:string}){return <div role="status" aria-live="polite">{phaseKey?<LocalizedText messageKey={phaseKey}/>:null}<span aria-hidden="true">…</span></div>;}
