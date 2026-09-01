const typeOf=id=>id.slice(0,id.indexOf('_'));
export function validatePublishedIds(previous,next) {
 const d=[]; const nextMap=new Map((next.ids??[]).map(x=>[x.id,x])); const all=new Set();
 for(const x of next.ids??[]){ if(all.has(x.id))d.push({code:'P11_ID_COLLISION',path:x.id,message:'duplicate next id'}); all.add(x.id); }
 for(const old of previous.ids??[]){ const cur=nextMap.get(old.id); if(!cur){d.push({code:'P11_PUBLISHED_ID_REMOVED',path:old.id,message:'published id removed'});continue;}
  if(cur.type!==old.type)d.push({code:'P11_REPLACEMENT_INVALID',path:old.id,message:'type changed'});
  if(cur.status==='deprecated'){
   if(!cur.replacementId||cur.replacementId===cur.id)d.push({code:'P11_REPLACEMENT_INVALID',path:old.id,message:'invalid replacement'});
   else {const repl=nextMap.get(cur.replacementId);if(!repl||typeOf(repl.id)!==typeOf(cur.id))d.push({code:'P11_REPLACEMENT_INVALID',path:old.id,message:'replacement missing or namespace changed'});}
  }
 }
 for(const item of next.ids??[]){let seen=new Set(),cur=item;while(cur?.status==='deprecated'&&cur.replacementId){if(seen.has(cur.id)){d.push({code:'P11_REPLACEMENT_INVALID',path:item.id,message:'replacement cycle'});break;}seen.add(cur.id);cur=nextMap.get(cur.replacementId);}}
 return d;
}
