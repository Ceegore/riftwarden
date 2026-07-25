import type { ReactNode } from 'react';
export function StatRow({label,value,delta,details}: {label:ReactNode;value:ReactNode;delta?:ReactNode;details?:ReactNode}){return <div className="rw-stat-row"><span>{label}{details}</span><span className="rw-type-numeric">{value}{delta}</span></div>;}
