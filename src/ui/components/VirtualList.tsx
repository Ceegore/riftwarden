import type { ReactNode } from 'react';
export interface VirtualListProps<T>{items:readonly T[];getKey:(item:T)=>string;renderItem:(item:T,index:number)=>ReactNode;accessibleFallback?:boolean;}
export function VirtualList<T>({items,getKey,renderItem,accessibleFallback=false}:VirtualListProps<T>){const visible=accessibleFallback?items:items.slice(0,50);return <div role="list">{visible.map((item,index)=><div role="listitem" key={getKey(item)}>{renderItem(item,index)}</div>)}</div>;}
