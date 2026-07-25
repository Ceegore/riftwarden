export type UiAudioCueId='ui_confirm'|'ui_back'|'ui_error'|'ui_focus'|'ui_modal_open';
export type UiHapticCueId='ui_light'|'ui_confirm'|'ui_warning';
export interface UiFeedbackPort { audio(id:UiAudioCueId):void; haptic(id:UiHapticCueId):void; }
export const noOpFeedback:UiFeedbackPort={audio(){/* no-op stub */},haptic(){/* no-op stub */}};
export async function commitWithFeedback<T>(commit:()=>Promise<T>,feedback:UiFeedbackPort):Promise<T>{const value=await commit();feedback.audio('ui_confirm');feedback.haptic('ui_confirm');return value;}
