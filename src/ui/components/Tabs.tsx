import type { KeyboardEvent,ReactNode } from 'react';
export interface TabItem { id:string;label:ReactNode;disabled?:boolean; }
export function Tabs({items,activeId,onChange}: {items:readonly TabItem[];activeId:string;onChange:(id:string)=>void}){
 function key(e:KeyboardEvent<HTMLButtonElement>,index:number){const step=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!step)return;e.preventDefault();for(let n=1;n<=items.length;n++){const next=items[(index+step*n+items.length)%items.length];if(!next)continue;if(!next.disabled){onChange(next.id);break;}}}
 return <div className="rw-tabs" role="tablist">{items.map((item,index)=><button className="rw-button rw-focusable" key={item.id} role="tab" aria-selected={item.id===activeId} disabled={item.disabled} tabIndex={item.id===activeId?0:-1} onKeyDown={(e:KeyboardEvent<HTMLButtonElement>)=>{key(e,index);}} onClick={()=>{onChange(item.id);}}>{item.label}</button>)}</div>;
}
