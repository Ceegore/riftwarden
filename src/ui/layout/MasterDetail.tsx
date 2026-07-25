import type { ReactNode } from 'react';
export function MasterDetail({master,detail}: {master:ReactNode;detail:ReactNode}){return <div className="rw-master-detail"><aside>{master}</aside><section>{detail}</section></div>;}
