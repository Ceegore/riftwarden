import { useState } from 'react';
import { ScreenFrame,PanelGrid } from '@ui/layout';
import { Button,GameCard,Loading,Modal,ResourcePill,SegmentedControl,StatRow,Tabs,ToastRegion,Tooltip } from '@ui/components';
import { LocalizedText } from '@locales/LocalizedText';
import { LiveBattleOutboundPanel } from '@features/battle/outbound/LiveBattleOutboundPanel';
import type { LiveOutboundInput } from '@features/battle/outbound/phase21-outbound-presenter';

export interface GalleryControls { locale:'de'|'en'|'qps-ploc';layoutClass:'phone_compact'|'phone_standard'|'tablet'|'large'|'portrait_narrow';textScale:1|1.15|1.3|1.5|1.75|2;reduceMotion:boolean;reduceFlash:boolean;colorProfile:'default'|'deuteranopia'|'protanopia'|'tritanopia';interactionState:string; }

// §9 gallery fixture: a mid-descent boss battle's live outbound sense, so the
// mounted panel is inspectable on a real screen (same shape a launcher report
// or a future live battle would feed through the bridge).
const OUTBOUND_FIXTURE: LiveOutboundInput = Object.freeze({
  encounterId: 'encounter_fixture_boss_duo',
  objective: 'defeat_boss',
  tick: 92,
  phase: Object.freeze({ phase: 'ACTIVE', endReason: null }),
  bossPhase: Object.freeze({ phaseId: 'phase_duo_p3', visited: Object.freeze(['phase_duo_p1', 'phase_duo_p2', 'phase_duo_p3']), transition: false }),
  modifierHookLog: Object.freeze([
    Object.freeze({ modifierId: 'mod_fixture_frenzy', hook: 'on_battle_start', atTick: 0 }),
    Object.freeze({ modifierId: 'mod_fixture_frenzy', hook: 'on_phase_entry', atTick: 46 }),
    Object.freeze({ modifierId: 'mod_fixture_onslaught', hook: 'on_phase_entry', atTick: 92 }),
  ]),
  events: Object.freeze([
    Object.freeze({ type: 'PhaseTransitionPlanned', tick: 1, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p1', 'phase_duo_p2']) }),
    Object.freeze({ type: 'BossTelegraphStarted', tick: 1, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p2']) }),
    Object.freeze({ type: 'BossPhaseStarted', tick: 46, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p2']) }),
    Object.freeze({ type: 'PhaseTransitionPlanned', tick: 47, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p2', 'phase_duo_p3']) }),
    Object.freeze({ type: 'BossTelegraphStarted', tick: 47, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p3']) }),
    Object.freeze({ type: 'BossPhaseStarted', tick: 92, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p3']) }),
  ]),
});
export function ComponentGalleryScreen({controls}: {controls:GalleryControls}){
 const [modal,setModal]=useState(false); const [tab,setTab]=useState('one'); const [tip,setTip]=useState(false);
 const tabs=[{id:'one',label:<LocalizedText messageKey="ui.dev.component_gallery.tab_one"/>},{id:'two',label:<LocalizedText messageKey="ui.dev.component_gallery.tab_two"/>}];
 const scales=[{id:'one',label:<LocalizedText messageKey="ui.dev.component_gallery.scale_one"/>},{id:'two',label:<LocalizedText messageKey="ui.dev.component_gallery.scale_two"/>}] as const;
 return <ScreenFrame className="rw-gallery" labelledBy="gallery-title"><h1 id="gallery-title"><LocalizedText messageKey="ui.dev.component_gallery.title"/></h1><div aria-hidden="true" data-gallery-fixture={JSON.stringify(controls)}/><PanelGrid columns={controls.layoutClass==='tablet'||controls.layoutClass==='large'?3:1}><GameCard title={<LocalizedText messageKey="ui.dev.component_gallery.card_title"/>}><StatRow label={<LocalizedText messageKey="ui.common.level"/>} value="3"/><ResourcePill icon="◆" value={120} nameKey="ui.resource.gold"/></GameCard><section><Button variant="primary" labelKey="ui.common.confirm" onClick={()=>{setModal(true);}}/><Button labelKey="ui.common.cancel"/><Loading phaseKey="ui.dev.component_gallery.loading"/></section><section><Tabs items={tabs} activeId={tab} onChange={setTab}/><button onClick={()=>{setTip(!tip);}} aria-describedby="gallery-tip">?</button><Tooltip open={tip} onClose={()=>{setTip(false);}} closeLabelKey="ui.common.close"><span id="gallery-tip"><LocalizedText messageKey="ui.dev.component_gallery.tooltip"/></span></Tooltip></section></PanelGrid><Modal open={modal} titleId="gallery-modal-title" onRequestClose={()=>{setModal(false);}}><h2 id="gallery-modal-title"><LocalizedText messageKey="ui.dev.component_gallery.modal_title"/></h2><Button labelKey="ui.common.cancel" onClick={()=>{setModal(false);}}/></Modal><ToastRegion items={[]}/><SegmentedControl label={<LocalizedText messageKey="ui.dev.component_gallery.scale_label"/>} segments={scales} value="one" onChange={()=>{/* no-op gallery fixture */}}/><section aria-label="Phase 21 outbound panel fixture"><LiveBattleOutboundPanel input={OUTBOUND_FIXTURE}/></section></ScreenFrame>;
}
