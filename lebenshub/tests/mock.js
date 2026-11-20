(()=>{const store={};const subs=[];const T=(f)=>setTimeout(f,5);
const depth=p=>p.split('/').length;
function notify(){subs.forEach(s=>s())}
function docRef(path){return{id:path.split('/').pop(),path,
 get:async()=>snapDoc(path),
 set:async d=>{store[path]=JSON.parse(JSON.stringify(d));T(notify)},
 update:async d=>{Object.assign(store[path],d);T(notify)},
 delete:async()=>{delete store[path];T(notify)},
 acquire:async()=>({acquired:true}),
 onSnapshot:(next,err)=>{const f=()=>next(snapDoc(path));subs.push(f);T(f);return()=>{}},
 collection:p=>colRef(path+'/'+p)}}
function snapDoc(path){const e=path in store;return{id:path.split('/').pop(),exists:e,data:()=>e?JSON.parse(JSON.stringify(store[path])):undefined,metadata:{fromCache:false,hasPendingWrites:false}}}
function colRef(path){const q={get:async()=>qs(),onSnapshot:(next)=>{const f=()=>next(qs());subs.push(f);T(f);return()=>{}},doc:id=>docRef(path+'/'+(id||Math.random().toString(36).slice(2))),add:async d=>{const r=docRef(path+'/'+Math.random().toString(36).slice(2));await r.set(d);return r}};
 function qs(){const docs=Object.keys(store).filter(k=>k.startsWith(path+'/')&&depth(k)===depth(path)+1).map(k=>snapDoc(k));return{docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}}}return q}
const db={doc:docRef,collection:colRef};
window.__store=store;window.__calls=[];
const sample=async(input,opts={})=>{window.__calls.push({input,opts:{tools:(opts.tools||[]).map(t=>t.name),images:opts.images?opts.images.length:0,modelTier:opts.modelTier}});
 if(opts.tools&&opts.tools.length){const t=opts.tools.find(x=>x.name==='add_entry');const r=await t.execute({list:'k',title:'comdirect Girokonto',note:'3.250 € (Stand 19.11.2026)',date:'2026-11-19'});
   if(opts.onText)opts.onText({text:'Trage ein …',delta:'Trage ein …'});return{text:'Girokonto mit 3.250 € eingetragen.',truncated:false,modelTierApplied:'default'}}
 return{text:'ok',truncated:false,modelTierApplied:'default'}};
sample.json=async(input,opts={})=>{if(/Antwort-Mail/.test(input))return{body:'Hallo Frau Müller, danke!'};if(/Sortiere meine ungelesenen Mails/.test(input))return{kurz:'1 wichtige Mail.',mails:[{nr:1,wichtig:true,kategorie:'Termin',aktion:'Termin eintragen',frist:'2026-11-24'}],eintraege:[{list:'t',title:'Physio-Termin',note:'Bestätigt per Mail',date:'2026-11-24'}]};window.__calls.push({json:true,len:input.length,images:opts.images?opts.images.length:0});return{title:'Kontoauszug comdirect',summary:'Stand Girokonto.',facts:[{label:'Saldo',value:'3.250 €'}],entries:[{list:'k',title:'comdirect Giro',note:'3.250 €',date:'2026-11-19'}]}};
sample.limits=async()=>({maxPromptBytes:262144,images:{maxCount:5,maxInputBytes:2e7,mediaTypes:['image/jpeg','image/png']},tools:{maxCount:20}});
const assets={upload:async b=>({id:'a'+Math.random().toString(36).slice(2,8),url:'/x',sizeBytes:b.size,contentType:b.type}),delete:async()=>({}),list:async()=>({assets:[]})};
const downloads={save:async r=>{window.__dl=r.filename;return{}}};
const mcp={callTool:async(server,tool,input)=>{window.__mcp=(window.__mcp||[]).concat([server+':'+tool]);if(server==='Gmail'&&tool==='search_threads')return{content:[],payload:{threads:[{id:'t1',messageCount:2,viewUrl:'https://mail.google.com/x',messages:[{id:'m2',sender:'anna@example.com',addressDisplayNames:[{displayName:'Anna Müller',emailAddress:'anna@example.com'}],subject:'Termin Physio',snippet:'Ihr Termin am 24.11. um 10 Uhr ist bestätigt',date:'2026-11-19'}]},{id:'t2',messages:[{id:'m9',sender:'news@shop.de',subject:'Angebot',snippet:'Rabatt'}]}]}};if(server==='Gmail'&&tool==='create_draft'){window.__draft=input;return{payload:{id:'d1'}}}if(tool==='search_files')return{content:[],payload:{files:[{id:'f1',title:'lebenshub-gesundheit-2026-11-20',modifiedTime:'2026-11-20T07:30:00Z'},{id:'f0',title:'lebenshub-gesundheit-2026-11-19',modifiedTime:'2026-11-19T07:30:00Z'}]}};return{content:[{type:'text',text:input.fileId==='f1'?'Lebenshub Gesundheit\nDatum: 2026-11-20\nSchlaf: 452\nRuhepuls: 54 bpm\nHRV: 61,5\nSchritte: 8.432\nAktivenergie: 512\nGewicht: 78,4':'Datum: 2026-11-19\nSchlaf: 6,4\nRuhepuls: \nSchritte: 12034'}]}}};
const M={db,sample,assets,downloads,mcp};window.claude={use:async n=>{await new Promise(r=>setTimeout(r,20));return M[n]||null}};
window.__seed=s=>{store['hub/state']={state:s,at:'x'}};})();
