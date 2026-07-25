export interface ToastItem{id:string;message:string;tone?:'info'|'success'|'warning'|'danger';}
export function ToastRegion({items}: {items:readonly ToastItem[]}){return <div className="rw-toast-region" aria-live="polite" aria-atomic="false">{items.map((item)=><div key={item.id} role={item.tone==='danger'?'alert':'status'} data-tone={item.tone}>{item.message}</div>)}</div>;}
