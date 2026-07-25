import { uiTokens } from '../tokens/generated/tokens';
export type MotionName='instant'|'fast'|'standard'|'emphasis'|'scene';
const map:Record<MotionName,string>={instant:uiTokens['motion.instant'],fast:uiTokens['motion.fast'],standard:uiTokens['motion.standard'],emphasis:uiTokens['motion.emphasis'],scene:uiTokens['motion.scene-min']};
export function motionDuration(name:MotionName,reduceMotion:boolean){return reduceMotion?uiTokens['motion.fast']:map[name];}
export function decorativeLoopAllowed(reduceMotion:boolean,documentHidden:boolean){return !reduceMotion&&!documentHidden;}
