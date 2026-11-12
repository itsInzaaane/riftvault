'use strict';
/* RiftVault: all collection and deck allocation records are stored locally. */
const DATA_KEY = 'riftvault-local-v1';
const CARD_CACHE_KEY = 'riftvault-cardcatalogue-v1';
const CARD_URL = 'https://raw.githubusercontent.com/slimtreble/Riftbound-card-data/main/cards.json';
const PRICE_CARDS_URL = 'https://api.rifthunt.com/bulk/cards';
const RUNE_CATALOG_KEY = 'riftvault-rune-catalogue-v111';
// Cache for complete RiftHunt printings, including the latest Radiance set.
const RH_CATALOG_KEY = 'riftvault-rifthunt-catalogue-v113';
const PRICE_QUOTES_URL = 'https://api.rifthunt.com/bulk/prices';
const PRICE_CACHE_KEY = 'riftvault-price-feed-v120-signature';
const PRICE_PREF_KEY = 'riftvault-market-preference-v13';
const PRICE_CACHE_AGE = 24*60*60*1000;
const SCAN_SPEED_KEY = 'riftvault-scan-speed-v15';
const BILGEWATER_PRICE_KEY = 'riftvault-bilgewater-prices-v17';
const BILGEWATER_URL = 'https://bilgewatermarket.com/cards';

const SECTIONS = ['Legend','Champion','MainDeck','Battlefields','Runes','Sideboard'];
const SECTION_LABEL = { Legend:'Legend',Champion:'Champion',MainDeck:'Main deck',Battlefields:'Battlefields',Runes:'Runes',Sideboard:'Sideboard' };
const NAV = [{id:'overview',icon:'▦',name:'Overview'},{id:'search',icon:'⌕',name:'Search cards'},{id:'scan',icon:'▣',name:'Auto scanner'},{id:'decks',icon:'▤',name:'My decks'},{id:'inventory',icon:'▥',name:'Inventory'},{id:'wishlist',icon:'♡',name:'Wishlist'},{id:'locations',icon:'▣',name:'Storage'},{id:'history',icon:'↺',name:'Scan history'}];
const JINX_EXAMPLE = `Legend:
1 Jinx, Loose Cannon

Champion:
1 Jinx, Demolitionist

MainDeck:
2 Blazing Scorcher
3 Brazen Buccaneer
2 Cemetery Attendant
3 Chemtech Enforcer
2 Fading Memories
3 Flame Chompers
2 Get Excited!
3 Gust
1 Magma Wurm
3 Raging Soul
1 Rhasa the Sunderer
3 Ride the Wind
3 Star-Crossed
3 Traveling Merchant
2 Undercover Agent
1 Vi, Destructive
2 Void Seeker

Battlefields:
1 Ripper's Bay
1 Targon's Peak
1 Zaun Warrens

Runes:
6 Chaos Rune
6 Fury Rune

Sideboard:
1 Hard Bargain
1 Jinx, Rebel
1 Super Mega Death Rocket!
1 Unlicensed Armory`;
// Basic verified printings while the full online catalogue downloads.
const FALLBACK_CARDS = [
 ['ogn-001-298','OGN-001','Blazing Scorcher','Common','Unit'],
 ['ogn-002-298','OGN-002','Brazen Buccaneer','Common','Unit'],
 ['ogn-003-298','OGN-003','Chemtech Enforcer','Common','Unit'],
 ['ogn-006-298','OGN-006','Flame Chompers','Common','Unit'],
 ['ogn-007-298','OGN-007','Fury Rune','Common','Rune'],
 ['ogn-008-298','OGN-008','Get Excited!','Common','Spell'],
 ['ogn-251-298','OGN-251','Jinx, Loose Cannon','Legend','Legend']
].map(([id,code,name,rarity,type])=>({id,code,publicCode:code+'/298',name,rarity,type,set:'OGN',setName:'Origins',imageUrl:'',isVariant:false,isAltArt:false}));
// A compact offline seed for Radiance's six rune types and their alternate arts.
// Updated artwork is supplied by RiftHunt's full catalogue when online.
const RUNE_NAMES = ['Fury Rune','Calm Rune','Mind Rune','Body Rune','Chaos Rune','Order Rune'];
const RUNE_SEED = RUNE_NAMES.flatMap((name,index)=>[false,true].map(alt=>{
 const num='R'+String(index+1).padStart(2,'0'), suffix=alt?'a':'';
 return {id:`rad-${num.toLowerCase()}${suffix}`,code:`RAD-${num}${suffix}`,
 publicCode:`RAD-${num}${suffix}`,name,rarity:alt?'Showcase':'Common',type:'Rune',
 set:'RAD',setName:'Radiance',imageUrl:'',isVariant:alt,isAltArt:alt,
 domains:[name.split(' ')[0]],supertype:'Basic'};
}));
// Printed rune collectors differ by set: Origins uses 007/042/089/126/166/214,
// while later sets use R01-R06. The suffix a is a foil-only Showcase art printing.
const ORIGINS_RUNE_NUMBERS = ['007','042','089','126','166','214'];
const OFFLINE_RUNE_PRINTINGS = [
 ...RUNE_NAMES.flatMap((name,i)=>[false,true].map(alt=>{
  const collector=ORIGINS_RUNE_NUMBERS[i]+(alt?'a':'');
  return {id:'ogn-'+collector.toLowerCase()+'-298',code:'OGN-'+collector,publicCode:'OGN-'+collector+'/298',
   name,set:'OGN',setName:'Origins',rarity:alt?'Showcase':'Common',type:'Rune',supertype:'Basic',
   isVariant:alt,isAltArt:alt,finishes:alt?['foil']:['normal','foil'],imageUrl:'',domains:[name.split(' ')[0]]};
 })),
 ...['SFD','UNL','VEN'].flatMap((set)=>RUNE_NAMES.flatMap((name,i)=>[false,true].map(alt=>{
  const collector='R'+String(i+1).padStart(2,'0')+(alt?'a':'');
  return {id:set.toLowerCase()+'-'+collector.toLowerCase(),code:set+'-'+collector,publicCode:set+'-'+collector,
   name,set,setName:({SFD:'Spiritforged',UNL:'Unleashed',VEN:'Vendetta'})[set],
   rarity:alt?'Showcase':'Common',type:'Rune',supertype:'Basic',
   isVariant:alt,isAltArt:alt,finishes:alt?['foil']:['normal','foil'],imageUrl:'',domains:[name.split(' ')[0]]};
 })))
];
function dedupePrintings(items){
 const keys=new Set();return items.filter(p=>{const code=normalizedCode(p.code||p.publicCode||'');
  if(!code||keys.has(code))return false;keys.add(code);return true;});
}
// The same physical card MUST retain the same local id after a catalogue refresh.
function runeFromRiftHunt(r){
 if(String(r.type||'').toLowerCase()!=='rune')return null;
 const set=String(r.set||'').toUpperCase();
 if(!/^[A-Z0-9]{2,5}$/.test(set))return null;
 // Some older rune cards (e.g. Origins) use ordinary collector numbers;
 // do not manufacture an R prefix for those cards.
 const sources=[r.collector_number,r.collectorNumber,r.code,r.riftboundId,r.id];
 let found=null;
 for(const source of sources){
  const m=String(source||'').match(/(?:^|[-_])R0?([1-6])([a-z])?(?=$|[-_\/])/i);
  if(m){found=m;break;}
 }
 if(!found&&set==='OGN')return null;
 const num=found?Number(found[1]):Number(r.num);
 if(!Number.isInteger(num)||num<1||num>6)return null;
 const suffix=found?.[2]?.toLowerCase()||(r.alt?'a':'');
 const collector='R'+String(num).padStart(2,'0')+suffix;
 const code=set+'-'+collector;
 return createMeta({id:code.toLowerCase(),code,publicCode:code,
  name:String(r.cleanName||r.name||RUNE_NAMES[num-1]||'Rune'),set,setName:String(r.setName||set),
  rarity:String(r.rarity||'Common'),type:'Rune',supertype:'Basic',
  imageUrl:String(r.imgUrl||r.imageUrl||''),isAltArt:!!r.alt||suffix==='a',isVariant:!!suffix||!!r.alt||!!r.sig||!!r.over,
  domains:Array.isArray(r.domains)?r.domains:[]});
}
function mergeRunePrintings(base,extra){
 const results=[...base];const byCode=new Map(results.map((p,i)=>[normalizedCode(p.code),i]));
 for(const p of extra){if(!p)continue;const k=normalizedCode(p.code);const i=byCode.get(k);
  if(i===undefined){byCode.set(k,results.length);results.push(p);}
  else { // If a previous catalogue has the correct local ID, preserve it.
   results[i]={...results[i],...p,id:results[i].id,
    imageUrl:p.imageUrl||results[i].imageUrl};
  }
 }
 return results;
}
let cachedRunes=[];
try{const saved=JSON.parse(localStorage.getItem(RUNE_CATALOG_KEY));if(Array.isArray(saved)&&saved.length>10)cachedRunes=saved.map(createMeta);}catch(e){}
let catalog = mergeRunePrintings(FALLBACK_CARDS.slice(),mergeRunePrintings([...OFFLINE_RUNE_PRINTINGS,...RUNE_SEED],cachedRunes));
let catalogReady = false;
try{const cache=JSON.parse(localStorage.getItem(CARD_CACHE_KEY));if(Array.isArray(cache)&&cache.length>100){catalog=mergeRunePrintings(cache,cachedRunes.length?cachedRunes:RUNE_SEED);catalogReady=true;}}catch(e){}
try{const fresh=JSON.parse(localStorage.getItem(RH_CATALOG_KEY));if(Array.isArray(fresh)&&fresh.length>200){catalog=mergeRunePrintings(catalog,fresh.map(createMeta));catalogReady=true;}}catch(e){}
let loadedAt = null;
let currentPrintings = new Map();
let allPrintings = new Map();
let nameIndex = new Map();
let codeIndex = new Map();
let state = loadState();
let ui = {tab:'overview',query:'',ownedOnly:false,setFilter:'all',inventoryQuery:'',deckId:null,modal:null,importText:'',importName:'Jinx Deck',variantFinish:'Normal',addCardQuery:'',addCardQuantity:1,addCardSection:'MainDeck',selectedSet:'all'};
let priceState = {status:'loading', fetchedAt:null, checkedAt:null, entries:[], byLegacy:new Map(), byCode:new Map(), byPrinting:new Map(), error:'', market:'tcgplayer', cached:false};
try { const pc=JSON.parse(localStorage.getItem(PRICE_CACHE_KEY));if(pc && Array.isArray(pc.entries) && pc.entries.length>200){priceState.entries=pc.entries;priceState.fetchedAt=pc.fetchedAt;priceState.checkedAt=pc.checkedAt||pc.fetchedAt;priceState.cached=true;priceState.status='ready';} }catch(e){}
// The Recent Scans panel is for the current app visit, not the saved history.
// Keep only activity IDs in RAM; scanned cards and full history remain in localStorage.
let recentVisitIds = new Set();
let appWasHidden = false;
function resetRecentVisit(){
 recentVisitIds.clear();
 scanner.sessionCount=0;
 scanner.lastSuccess=null;
 if(ui.tab==='scan'){
  const counter=document.getElementById('scan-counter');if(counter)counter.textContent='0';
  const last=document.getElementById('scan-last');if(last){last.classList.remove('is-success');last.textContent='Ready for new scans. Your previous scans are still in Full history.';}
  const panel=document.getElementById('scan-history');
  if(panel)panel.innerHTML=renderRecentScans();
 }
}
function scanThumbnail(activity){
 if(!activity?.key)return '<span class="scan-thumb"><span class="placeholder-art" aria-hidden="true">✦</span></span>';
 const meta=getMeta(unpackKey(activity.key).id);
 return `<span class="scan-thumb" aria-label="${escapeHtml(meta.name)} artwork">${cardArt(meta)}</span>`;
}
let scanner = {running:false,starting:false,deckNotice:false,stream:null,worker:null,video:null,loopToken:0,latchedCode:null,lastCandidate:null,stable:0,missed:0,sessionCount:0,finish:'Normal',finishMode:'auto',lastRecognized:'',busy:false,foilTimer:null,foilCode:null,foilSamples:[],pending:null,acceptedHash:null,speed:localStorage.getItem(SCAN_SPEED_KEY)==='steady'?'steady':'fast',ocrCycles:0,cropCanvas:null,hashCanvas:null,flashTimeout:null,lastSuccess:null};

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function normalizeName(str){return String(str||'').normalize('NFKD').toLowerCase().replace(/[’‘]/g,"'").replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();}
function normalizedCode(str){
 // The star is meaningful: OGN-301* (Signature) is NOT OGN-301 (unsigned).
 // Older API exports used an s suffix, which is an alias for Signature.
 return String(str||'').toUpperCase().replace(/\/[0-9]+.*/,'').replace(/[^A-Z0-9*]/g,'')
  .replace(/^([A-Z0-9]{2,5}[0-9]{3})S$/,'$1*');
}
function isSignaturePrinting(meta){return !!meta && (!!meta.isSignature || /\*$/.test(normalizedCode(meta.code||meta.publicCode||'')) || /signature/i.test(String(meta.rarity||'')));}
function isOvernumberedPrinting(meta){return !!meta && (!!meta.isOvernumbered || /overnumbered/i.test(String(meta.rarity||'')) || isSignaturePrinting(meta));}
function uid(){return (typeof crypto!=='undefined' && crypto.randomUUID)?crypto.randomUUID():'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
function keyFor(cardId,finish){return String(cardId)+'~~'+(finish||'Normal');}
function unpackKey(key){const pos=key.lastIndexOf('~~');return pos<0?{id:key,finish:'Normal'}:{id:key.slice(0,pos),finish:key.slice(pos+2)};}
function blankState(){return {version:1,stock:{},printings:{},decks:[],activity:[],extraLocations:{},locationNames:[],manualWishlist:{}};}
function loadState(){try{let raw=JSON.parse(localStorage.getItem(DATA_KEY));if(!raw||!raw.stock||!Array.isArray(raw.decks)||!raw.printings)return blankState();return {...blankState(),...raw,activity:Array.isArray(raw.activity)?raw.activity:[],extraLocations:raw.extraLocations&&typeof raw.extraLocations==='object'?raw.extraLocations:{},locationNames:Array.isArray(raw.locationNames)?raw.locationNames:[],manualWishlist:raw.manualWishlist&&typeof raw.manualWishlist==='object'?raw.manualWishlist:{}};}catch(e){return blankState();}}
function save(){try{localStorage.setItem(DATA_KEY,JSON.stringify(state));return true;}catch(e){toast('Unable to save locally. Export your JSON backup and check browser storage.',true);return false;}}
function logActivity(message,key=null,kind='change'){state.activity.unshift({id:uid(),message,key,kind,at:new Date().toISOString()});state.activity=state.activity.slice(0,500);}
function toast(message,error=false){const root=document.getElementById('toast-container');const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=message;root.appendChild(el);setTimeout(()=>el.remove(),4200);}
// Legends have a champion name AND a title. Riot's gallery dataset sometimes
// contains only the title (e.g. "Chem-Baroness"), while the card's full name is
// "Renata Glasc, Chem-Baroness". Keep the collector code / printing id unchanged.
// This offline list is from RiftHunt's published Legend directory. The daily
// RiftHunt bulk catalogue can supply newer names as future sets arrive.
const KNOWN_LEGENDS = `Ahri, Nine-Tailed Fox
Akali, Rogue Assassin
Ambessa, Matriarch of War
Annie, Dark Child
Azir, Emperor of the Sands
Darius, Hand of Noxus
Diana, Scorn of the Moon
Draven, Glorious Executioner
Ekko, Boy Who Shattered Time
Evelynn, Agony's Embrace
Ezreal, Prodigal Explorer
Fiora, Grand Duelist
Garen, Might of Demacia
Irelia, Blade Dancer
Ivern, Green Father
Jarvan IV, Exemplar of Demacia
Jax, Grandmaster At Arms
Jayce, Defender of Tomorrow
Jhin, Virtuoso
Jinx, Loose Cannon
K'Sante, Pride of Nazumah
Kai'Sa, Daughter of the Void
Kennen, Heart of the Tempest
Kha'Zix, Voidreaver
LeBlanc, Deceiver
Lee Sin, Blind Monk
Leona, Radiant Dawn
Lillia, Bashful Bloom
Lucian, Purifier
Lux, Lady of Luminosity
Master Yi, Wuju Bladesman
Master Yi, Wuju Master
Mel, Soul's Reflection
Miss Fortune, Bounty Hunter
Mordekaiser, Iron Revenant
Nasus, Curator of the Sands
Orianna, Lady of Clockwork
Ornn, Fire Below the Mountain
Poppy, Keeper of the Hammer
Pyke, Bloodharbor Ripper
Rek'Sai, Void Burrower
Renata Glasc, Chem-Baroness
Renekton, Butcher of the Sands
Rengar, Pridestalker
Riven, The Exile
Rumble, Mechanized Menace
Seraphine, Starry-Eyed Songstress
Sett, The Boss
Shen, Eye of Twilight
Sivir, Battle Mistress
Teemo, Swift Scout
Vex, Gloomist
Vi, Piltover Enforcer
Viktor, Herald of the Arcane
Volibear, Relentless Storm
Yasuo, Unforgiven
Zed, Master of Shadows
Ziggs, Hexplosives Expert`.split('\n');
const LEGEND_BY_TITLE = new Map(KNOWN_LEGENDS.map(name=>[normalizeName(name.slice(name.indexOf(',')+1)),name]));
function officialCardName(sourceName,cardCode,cardType){
 const source=String(sourceName||'Unknown card').trim();
 if(normalizeName(cardType)!=='legend'||source.includes(', '))return source;
 const candidates=priceState?.byCode?.get(normalizedCode(cardCode))||[];
 // Accept an exact printing match only; a different card with a similar
 // substring must never rename a scanned card.
 const matches=candidates.filter(c=>normalizeName(c.type)==='legend')
  .map(c=>String(c.cleanName||c.name||'').trim())
  .filter(name=>normalizeName(name).endsWith(', '+normalizeName(source)));
 if(matches.length&&new Set(matches.map(normalizeName)).size===1)return matches[0];
 return LEGEND_BY_TITLE.get(normalizeName(source))||source;
}
function createMeta(raw){
 const type=String(raw.type||raw.cardType||'');
 const supplied=String(raw.name||raw.fullName||'Unknown card');
 const shortName=String(raw.shortName||(normalizeName(type)==='legend'&&supplied.includes(', ')?supplied.slice(supplied.indexOf(', ')+2):supplied));
 const code=String(raw.code||raw.publicCode||raw.cardCode||'');
 return {id:String(raw.id||raw.cardCode||''),code,publicCode:String(raw.publicCode||raw.code||''),
  name:officialCardName(shortName,code,type),shortName,
  set:String(raw.set||raw.setCode||''),setName:String(raw.setName||raw.cardSet||''),
  rarity:String(raw.rarity||''),type,imageUrl:String(raw.imageUrl||''),isVariant:!!raw.isVariant,
  isAltArt:!!raw.isAltArt||/^[A-Z0-9]{2,5}(?:[RST]?[0-9]{2,3})A$/.test(normalizedCode(code)),isSignature:!!raw.isSignature||!!raw.sig||/\*$/.test(normalizedCode(code)),isOvernumbered:!!raw.isOvernumbered||!!raw.over,domains:Array.isArray(raw.domains)?raw.domains:[],
  supertype:String(raw.supertype||''),tags:Array.isArray(raw.tags)?raw.tags:[],
  printingId:String(raw.printingId||raw.printing_id||''),
  finishes:Array.isArray(raw.finishes)?raw.finishes:[]};
}
function rebuildIndexes(){
 allPrintings=new Map();nameIndex=new Map();codeIndex=new Map();
 for(const raw of [...catalog,...Object.values(state.printings)]){
  const p=createMeta(raw);if(!p.id)continue;
  if(!allPrintings.has(p.id))allPrintings.set(p.id,p);
 }
 for(const p of allPrintings.values()){
  // Full name and original short title are aliases for THE SAME printing.
  for(const name of new Set([p.name,p.shortName])){
   const n=normalizeName(name);if(!n)continue;
   if(!nameIndex.has(n))nameIndex.set(n,[]);
   if(!nameIndex.get(n).some(q=>q.id===p.id))nameIndex.get(n).push(p);
  }
  for(const c of [p.code,p.publicCode,p.id]){
   const k=normalizedCode(c);if(k&&!codeIndex.has(k))codeIndex.set(k,p);
  }
 }
 for(const arr of nameIndex.values())arr.sort((a,b)=>Number(a.isVariant)-Number(b.isVariant)||Number(a.isAltArt)-Number(b.isAltArt)||a.set.localeCompare(b.set));
}
// A suffix such as SFD-088a identifies a distinct physical printing, not a foil finish.
function siblingPrintings(card){
 if(!card)return [];
 const m=String(card.code||'').match(/^([A-Z0-9]{2,5})-([RST]?\d{1,3})[A-Z*]?$/i);
 if(!m)return [card];
 const prefix=normalizedCode(m[1]),num=m[2].replace(/^([RST]?)0+(?=\d)/i,'$1').toUpperCase();
 return printingsFor(card.name).filter(p=>{
  const cm=String(p.code||'').match(/^([A-Z0-9]{2,5})-([RST]?\d{1,3})[A-Z*]?$/i);
  return cm&&normalizedCode(cm[1])===prefix&&cm[2].replace(/^([RST]?)0+(?=\d)/i,'$1').toUpperCase()===num;
 }).sort((a,b)=>Number(a.isAltArt)-Number(b.isAltArt)||a.code.localeCompare(b.code));
}
function printingFamilyCode(code){const c=normalizedCode(code);const m=c.match(/^([A-Z0-9]{2,5})([RST]?\d{2,3})[A-Z*]?$/);return m?m[1]+m[2]:c;}
function needsArtworkReview(card){return !!card&&!card.isAltArt&&!isSignaturePrinting(card)&&siblingPrintings(card).some(p=>p.isAltArt||isSignaturePrinting(p)||(!card.isVariant&&p.isVariant));}
function isFoilOnlyAlternate(card){
 if(!card)return false;
 const collector=normalizedCode(card.code||card.publicCode||'');
 return !!card.isAltArt || isSignaturePrinting(card) || /^[A-Z0-9]{2,5}(?:[RST]?[0-9]{2,3})A$/.test(collector);
}
function knownPrintingFinish(card){
 if(isFoilOnlyAlternate(card))return 'Foil';
 const row=priceRecord(card);
 if(!row||!Array.isArray(row.allowedFinishes)||row.allowedFinishes.length!==1)return null;
 return row.allowedFinishes[0]==='foil'?'Foil':row.allowedFinishes[0]==='normal'?'Normal':null;
}
function printingLabel(card){return isSignaturePrinting(card)?'Signature Overnumbered':isOvernumberedPrinting(card)?'Overnumbered':card.isAltArt?'Alternate Art':card.isVariant?'Special Printing':'Regular Art';}
function getMeta(id){return allPrintings.get(id)||state.printings[id]||{id,name:id,code:id,setName:'Unknown',rarity:'',type:'',imageUrl:''};}
function printingsFor(name){return nameIndex.get(normalizeName(name))||[];}
function isBasicRuneName(name){return RUNE_NAMES.some(r=>normalizeName(r)===normalizeName(name));}
function eligiblePrintings(entry){const arr=printingsFor(entry.name);if(entry.section==='Runes'&&isBasicRuneName(entry.name))return arr;if(!entry.code)return arr;const match=normalizedCode(entry.code);const filtered=arr.filter(p=>normalizedCode(p.code)===match||normalizedCode(p.publicCode)===match);return filtered.length?filtered:arr;}
function assignedQty(key,excludeDeckId=null){let count=0;for(const deck of state.decks){if(deck.id===excludeDeckId)continue;for(const alloc of Object.values(deck.allocations||{}))count+=Math.max(0,Number(alloc[key]||0));}return count;}
function ownedQty(key){return Math.max(0,Number(state.stock[key]||0));}
function storageQty(key){return Object.values(state.extraLocations?.[key]||{}).reduce((a,n)=>a+Math.max(0,Number(n||0)),0);}
function bulkQty(key){return Math.max(0,ownedQty(key)-assignedQty(key)-storageQty(key));}
function moveToStorage(key,location){if(!state.locationNames.includes(location)||bulkQty(key)<1)return false;state.extraLocations[key]??={};state.extraLocations[key][location]=(state.extraLocations[key][location]||0)+1;logActivity('Moved '+getMeta(unpackKey(key).id).name+' from Bulk to '+location,key,'move');save();return true;}
function returnFromStorage(key,location){const bucket=state.extraLocations?.[key];if(!bucket||!bucket[location])return false;bucket[location]--;if(!bucket[location])delete bucket[location];if(!Object.keys(bucket).length)delete state.extraLocations[key];logActivity('Returned '+getMeta(unpackKey(key).id).name+' from '+location+' to Bulk',key,'return');save();return true;}
function totalStorage(){return Object.keys(state.stock).reduce((s,k)=>s+storageQty(k),0);}
function stockForName(name,onlyBulk=false){let sum=0;const ids=new Set(printingsFor(name).map(p=>p.id));for(const [key,q] of Object.entries(state.stock)){if(ids.has(unpackKey(key).id))sum+=onlyBulk?bulkQty(key):Number(q||0);}return sum;}
function cardArtPriority(card){
 // Collector suffix a (and catalogue alt-art markers) always means a special
 // printing. Do not confuse an artwork variant with a foil finish.
 return Number(Boolean(card.isAltArt||card.isVariant||/^[A-Z0-9]{2,5}-[RST]?\d{1,3}[a-z]$/i.test(card.code||'')));
}
function ownedKeysByName(name,code='',section=''){
 const isRune=section==='Runes'&&isBasicRuneName(name);
 const pids=new Set(eligiblePrintings({name,code,section}).map(p=>p.id));
 return Object.keys(state.stock).filter(k=>pids.has(unpackKey(k).id)&&ownedQty(k)>0).sort((a,b)=>{
  const ca=getMeta(unpackKey(a).id),cb=getMeta(unpackKey(b).id);
  const fa=Number(unpackKey(a).finish==='Foil'),fb=Number(unpackKey(b).finish==='Foil');
  if(isRune)return cardArtPriority(ca)-cardArtPriority(cb)||fa-fb||ca.code.localeCompare(cb.code);
  return fa-fb||cardArtPriority(ca)-cardArtPriority(cb)||ca.code.localeCompare(cb.code);
 });
}
function ownedEntries(){return Object.entries(state.stock).filter(([,q])=>q>0).map(([key,q])=>({key,qty:Number(q),bulk:bulkQty(key),stored:storageQty(key),card:getMeta(unpackKey(key).id),finish:unpackKey(key).finish})).sort((a,b)=>a.card.name.localeCompare(b.card.name)||a.card.code.localeCompare(b.card.code));}
function totalOwned(){return Object.values(state.stock).reduce((s,n)=>s+Number(n||0),0);}
function totalBulk(){return Object.keys(state.stock).reduce((s,k)=>s+bulkQty(k),0);}
function uniqueOwned(){return new Set(ownedEntries().map(e=>normalizeName(e.card.name))).size;}
function entryAssigned(deck,entry){return Object.values((deck.allocations||{})[entry.id]||{}).reduce((a,b)=>a+Number(b||0),0);}
function entriesNeeded(deck){return deck.entries.reduce((s,e)=>s+Number(e.required||0),0);}
function entriesAssigned(deck){return deck.entries.reduce((s,e)=>s+entryAssigned(deck,e),0);}
function entryBulk(entry){return ownedKeysByName(entry.name,entry.code,entry.section).reduce((s,k)=>s+bulkQty(k),0);}
function entryElsewhere(entry,currentDeck){let sum=0;for(const key of ownedKeysByName(entry.name,entry.code,entry.section)){for(const d of state.decks){if(d.id===currentDeck.id)continue;for(const alloc of Object.values(d.allocations||{}))sum+=Number(alloc[key]||0);}}return sum;}
function addBulkByKey(key,qty=1){let id=unpackKey(key).id;const p=getMeta(id);if(isFoilOnlyAlternate(p))key=keyFor(id,'Foil');if(!p||!p.id)throw new Error('Card not found');state.printings[id]=createMeta(p);state.stock[key]=ownedQty(key)+qty;logActivity('Added '+qty+' × '+p.name+' to Bulk',key,'add');save();}
function removeBulkByKey(key,qty=1){if(bulkQty(key)<qty)return false;state.stock[key]=ownedQty(key)-qty;if(state.stock[key]===0)delete state.stock[key];logActivity('Removed '+qty+' × '+getMeta(unpackKey(key).id)+' from Bulk',key,'remove');save();return true;}
function locationSummary(name){const rows=[];const matchingIds=new Set(printingsFor(name).map(p=>p.id));const keys=Object.keys(state.stock).filter(k=>matchingIds.has(unpackKey(k).id));for(const key of keys){let bulk=bulkQty(key),p=getMeta(unpackKey(key).id),finish=unpackKey(key).finish;if(bulk>0)rows.push({name:'Bulk',qty:bulk,description:(p.code||'')+' • '+finish});for(const [storage,count] of Object.entries(state.extraLocations?.[key]||{}))if(count>0)rows.push({name:storage,qty:count,description:(p.code||'')+' • '+finish});for(const d of state.decks){let inDeck=0;for(const a of Object.values(d.allocations||{}))inDeck+=Number(a[key]||0);if(inDeck)rows.push({name:d.name,qty:inDeck,description:(p.code||'')+' • '+finish});}}return rows;}
function findDeck(id){return state.decks.find(d=>d.id===id);}
function setTab(tab){if(scanner.running||scanner.starting)stopScanner();ui.tab=tab;ui.deckId=null;ui.modal=null;render();window.scrollTo(0,0);}
function download(name,content,type){let blob=new Blob([content],{type:type||'application/octet-stream'});let url=URL.createObjectURL(blob);let a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function cardArt(p,cl=''){return p&&p.imageUrl?`<img class="${cl}" loading="lazy" src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)} card art" onerror="this.style.display='none'"/>`:`<span class="placeholder-art">✦</span>`;}
function fmt(n){return new Intl.NumberFormat('en-US').format(n||0);}
function shortDate(date){try{return new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'});}catch(e){return '';}}
function statusNote(){return catalogReady?`${catalog.length.toLocaleString()} printings loaded`:`${catalog.length} starter printings • online catalogue pending`;}

// Use the old gallery data as a fallback, not the primary authority. Its release
// catalogue can lag behind RAD and must never replace newer RiftHunt printings.
async function loadCatalogue(){try{
 const response=await fetch(CARD_URL,{cache:'no-cache'});
 if(!response.ok)throw new Error('HTTP '+response.status);
 const raw=await response.json();
 if(!Array.isArray(raw)||raw.length<100)throw new Error('Unexpected legacy catalogue');
 // Preserve the IDs already used by v1-v1.12 inventory wherever codes match.
 // Add missing older printings without displacing the newer catalogue's
 // stable printing IDs, artwork, variant codes or card names.
 const oldByCode=new Set(catalog.map(p=>normalizedCode(p.code)));
 for(const p of raw.filter(p=>p.id&&p.name).map(createMeta)){
  const key=normalizedCode(p.code);if(!key||oldByCode.has(key))continue;
  oldByCode.add(key);catalog.push(p);
 }
 catalogReady=true;loadedAt=new Date();
 try{localStorage.setItem(CARD_CACHE_KEY,JSON.stringify(catalog));}catch(e){}
 rebuildIndexes();render();
}catch(e){console.warn('Older gallery catalogue unavailable; keeping current printings:',e);rebuildIndexes();render();}}

// RiftHunt /bulk/cards is up-to-date and includes ordinary RAD cards, runes,
// promo SP numbers, alternate art, overnumbered and signature variants.
// It provides an explicit printing_id and an individual collector for each printing.
let rhCardsPromise=null;
function getRiftHuntCards(){
 if(!rhCardsPromise)rhCardsPromise=fetch(PRICE_CARDS_URL,{cache:'no-cache'})
  .then(response=>{if(!response.ok)throw new Error('RiftHunt HTTP '+response.status);return response.json();})
  .then(payload=>{if(!Array.isArray(payload.cards)||payload.cards.length<200)throw new Error('Unexpected RiftHunt card export');return payload;})
  .catch(e=>{rhCardsPromise=null;throw e;});
 return rhCardsPromise;
}
function collectorFromRiftHunt(row){
 const set=String(row.set||'').toUpperCase();if(!/^[A-Z0-9]{2,5}$/.test(set))return '';
 // The bulk price rows include the authoritative printed collector; use it
 // if present. When unavailable, read the official riftboundId and type.
 const direct=String(row.collector||row.collector_number||row.collectorNumber||'').trim();
 const official=String(row.riftboundId||'');
 const match=official.match(new RegExp('(?:^|[-_])'+set+'[-_]((?:SP\\d{1,2}|[RST]\\d{1,3}(?:[-_]SC)?|\\d{1,3})[a-z*]?)','i'));
 let collector=direct || (match?.[1]||'');
 // Rune collectors are letter-prefixed (R03a), not the number 003.
 if(String(row.type||'').toLowerCase()==='rune'){
  const runeN=Number(row.num);
  if(/^[0-9]{1,3}$/.test(collector)&&runeN>=1&&runeN<=6)collector='R'+String(runeN).padStart(2,'0');
  if(!collector&&Number.isInteger(runeN)&&runeN>=1&&runeN<=6)collector='R'+String(runeN).padStart(2,'0');
 }
 if(!collector&&Number.isInteger(Number(row.num))&&Number(row.num)>=0)
  collector=String(row.num).padStart(3,'0');
 collector=collector.replace(/\s/g,'').replace(/\/$/,'');
 if(/^[0-9]{1,3}[a-z*]?$/i.test(collector))collector=collector.replace(/^([0-9]{1,3})/,digits=>digits.padStart(3,'0'));
 if(/^[RrTtSs][0-9]{1,2}[a-z]?$/i.test(collector))collector=collector[0].toUpperCase()+collector.slice(1).replace(/^([0-9]{1,2})/,digits=>digits.padStart(2,'0'));
 collector=collector.replace(/^sp/i,'SP').replace(/-sc$/i,'-SC');
 collector=collector.replace(/^([rst])/i,m=>m.toUpperCase());
 // Newer bulk exports use alt and sig flags, while their printed code may
 // omit the suffix. Never fold the two physical art variants together.
 if(row.alt&&!/a$/i.test(collector)&&!/^SP/i.test(collector))collector+='a';
 if(row.sig&&!/[s*]$/i.test(collector)&&!/^SP/i.test(collector))collector+='*';
 if(row.sig&&/s$/i.test(collector)&&!/^SP/i.test(collector))collector=collector.slice(0,-1)+'*';
 return /^(?:[0-9]{3}|[RST][0-9]{2,3}|SP[0-9]{1,2})(?:[a-z*]|-SC)?$/i.test(collector)?collector:'';
}
function metaFromRiftHunt(row){
 if(!row?.printing_id||!row.set)return null;
 const set=String(row.set).toUpperCase(),collector=collectorFromRiftHunt(row);
 if(!collector)return null;
 const code=set+'-'+collector;
 let name=String(row.cleanName||row.name||'').trim();
 if(!name)return null;
 if(String(row.type||'').toLowerCase()==='rune'){
  name=name.replace(/\s*\((?:Alternate Art|Alt Art|Showcase|Foil)\)\s*$/i,'').trim();
  const actual=RUNE_NAMES.find(n=>normalizeName(n)===normalizeName(name));if(actual)name=actual;
  // For Rune deck requirements always share the same name across variants.
  const runeIndex=Number(String(collector).match(/^R0?([1-6])/i)?.[1]);
  if(set==='RAD'&&runeIndex>=1&&runeIndex<=6)name=RUNE_NAMES[runeIndex-1];
 }
 return createMeta({id:'rh-'+row.printing_id,printingId:row.printing_id,
  code,publicCode:code,name,set,setName:row.setName||set,type:row.type||'',
  rarity:row.rarity||'',supertype:row.supertype||'',domains:row.domains||[],
  tags:row.tags||[],imageUrl:row.imgUrl||'',finishes:row.finishes,
  isAltArt:!!row.alt||/a$/i.test(collector),
  isVariant:!!(row.alt||row.sig||row.over||/a$/i.test(collector)||/\(Metal\)/i.test(row.name||'')),isSignature:!!row.sig||/\*$/.test(collector),isOvernumbered:!!row.over});
}
function integrateRiftHuntCatalogue(raw,{cache=true}={}){
 const rows=Array.isArray(raw)?raw:Array.isArray(raw?.cards)?raw.cards:[];
 const fresh=rows.map(metaFromRiftHunt).filter(Boolean);
 const rad=fresh.filter(c=>c.set==='RAD');
 if(fresh.length<200||rad.length<160)throw new Error('RAD catalogue incomplete: received '+rad.length+' printings');
 // For previously scanned cards, use the existing stock/deck ID rather than
 // creating a second inventory row with the new API printing UUID.
 const ids=new Map();
 for(const p of [...catalog,...Object.values(state.printings)]){
  const key=normalizedCode(p.code||p.publicCode);
  if(key&&!ids.has(key))ids.set(key,String(p.id));
 }
 for(const p of fresh){const old=ids.get(normalizedCode(p.code));if(old)p.id=old;}
 catalog=mergeRunePrintings(catalog,fresh);
 cachedRunes=catalog.filter(c=>c.type==='Rune');
 catalogReady=true;loadedAt=new Date();
 if(cache){try{localStorage.setItem(RH_CATALOG_KEY,JSON.stringify(fresh));}catch(e){console.warn('Full catalogue cache unavailable:',e);}}
 rebuildIndexes();migrateAltArtNonfoilRecords();render();
 return {total:fresh.length,radiance:rad.length};
}
async function loadRuneCatalogue(){
 try{const data=await getRiftHuntCards();integrateRiftHuntCatalogue(data);}
 catch(e){console.warn('RiftHunt catalogue download failed; retaining cached cards:',e);
  if(!catalog.some(c=>c.set==='RAD'&&!/^RAD-R0[1-6]a?$/i.test(c.code||'')))
   toast('Radiance cards need the online catalogue. Check your internet connection, then reopen RiftVault.',true);
 }
}
function indexPrices(){
 priceState.byLegacy=new Map();priceState.byCode=new Map();priceState.byPrinting=new Map();
 for(const record of priceState.entries){
  if(record.printingId){priceState.byPrinting.set(record.printingId,record);}
  for(const [map,value] of [[priceState.byLegacy,record.legacyId],[priceState.byCode,record.code]]){
   const key=normalizedCode(value);if(!key)continue;
   if(!map.has(key))map.set(key,[]);
   map.get(key).push(record);
  }
 }
}
function priceRecord(meta){
 if(!meta||!priceState.entries.length)return null;
 // Authoritative source: immutable RiftHunt printing UUID. Never fall back to
 // an unsigned sibling if this specific signed printing has no price.
 if(meta.printingId)return priceState.byPrinting.get(meta.printingId)||null;
 const code=normalizedCode(meta.code||meta.publicCode);
 const candidates=(priceState.byCode.get(code)||[]).filter(row=>
   isSignaturePrinting(row)===isSignaturePrinting(meta) &&
   !!row.alt===!!meta.isAltArt &&
   (!!row.isVariant===!!meta.isVariant || isOvernumberedPrinting(row)));
 const matchingName=candidates.filter(row=>normalizeName(row.name)===normalizeName(meta.name)||normalizeName(row.cleanName)===normalizeName(meta.name));
 const final=matchingName.length?matchingName:candidates;
 return final.length===1?final[0]:null;
}
// Bilgewater Market does not offer a verified, browser-readable public price API.
// The app records quotes that the user copies from Bilgewater. Never rebrand
// another provider's prices as Bilgewater quotes; missing entries stay N/A.
let bilgewaterPrices={};
try{const raw=JSON.parse(localStorage.getItem(BILGEWATER_PRICE_KEY)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))bilgewaterPrices=raw;}catch(e){}
function bwPriceKey(meta,finish){return normalizedCode(meta?.code||'')+'~~'+(finish==='Foil'?'Foil':'Normal');}
function bilgewaterLink(meta){
 const code=String(meta?.code||'').trim();
 // Normal print pages use their collector numbers; variant routes are not verified.
 return /^[A-Z]{2,5}-\d{3}$/i.test(code)?BILGEWATER_URL+'/'+encodeURIComponent(code):BILGEWATER_URL;
}
function bilgewaterQuoteFor(meta,finish='Normal'){
 if(!meta?.code)return null;
 const item=bilgewaterPrices[bwPriceKey(meta,finish)];
 if(!item||!Number.isFinite(Number(item.usd))||Number(item.usd)<=0)return null;
 return {amount:Number(item.usd),updatedAt:item.recordedAt||null,link:bilgewaterLink(meta),source:'bilgewater-manual'};
}
// Main valuation: TCGplayer market USD supplied by RiftHunt's daily feed.
// Never interpret a foil-only card's null normal entry as a $0 price.
function quoteFor(meta,finish='Normal'){
 const record=priceRecord(meta);
 if(isSignaturePrinting(meta)&&finish!=='Foil')return null;
 if(!record)return null;
 const key=finish==='Foil'?'foil':'normal';
 if(Array.isArray(record.allowedFinishes)&&!record.allowedFinishes.includes(key))return null;
 const market=record.usd?.[key]?.market;
 if(typeof market!=='number'||!Number.isFinite(market)||market<=0)return null;
 return {amount:market,updatedAt:record.usd.updatedAt||priceState.fetchedAt||null,
    link:safePriceLink(record.usd.purchaseUri)||'',source:'tcgplayer-via-rifthunt',
    printingId:record.printingId,finish:key,cached:priceState.cached};
}
function priceNum(amount){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',currencyDisplay:'narrowSymbol',minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);}
function priceText(quote){if(!quote)return 'N/A';return 'USD '+priceNum(quote.amount);}
function priceHtml(quote){return `<span class="price-figure ${quote?'':'muted'}">${escapeHtml(priceText(quote))}</span>`;}
function saveBilgewaterPrices(){try{localStorage.setItem(BILGEWATER_PRICE_KEY,JSON.stringify(bilgewaterPrices));return true;}catch(e){toast('Could not save pricing locally. Back up your collection.',true);return false;}}
function storedBilgewaterDate(){const dates=Object.values(bilgewaterPrices).map(x=>Date.parse(x?.recordedAt)).filter(Number.isFinite);return dates.length?new Date(Math.max(...dates)).toLocaleString():null;}
function importBilgewaterRows(raw){
 const lines=String(raw||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 if(!lines.length)throw new Error('Paste at least one CSV row.');
 const rows=[];
 for(const line of lines){
   const cols=line.includes('\t')?line.split('\t'):line.match(/(?:"(?:[^"]|"")*"|[^,])+/g)||[];
   rows.push(cols.map(c=>c.trim().replace(/^"|"$/g,'').replace(/""/g,'"')));
 }
 const start=/^(code|card\s*code|collector)/i.test(rows[0][0])?1:0;
 const entries={},now=new Date().toISOString(),issues=[];
 for(let i=start;i<rows.length;i++){
   let [code,finish,amount]=rows[i];
   code=normalizedCode(code);finish=String(finish||'').toLowerCase().replace(/[\s-]/g,'');
   finish=(finish==='foil'?'Foil':(['normal','nonfoil','nonholo'].includes(finish)?'Normal':null));
   amount=String(amount||'').replace(/^\s*(?:USD|US\$|\$)\s*/i,'').replace(/,/g,'');
   const value=Number(amount);
   if(!/^[A-Z]{2,5}(?:[RST]\d{2}|\d{3})[A-Z]?$/.test(code)||!finish||!Number.isFinite(value)||value<=0||value>1000000){issues.push(`Line ${i+1}: expected code, finish and positive USD price`);continue;}
   entries[code+'~~'+finish]={usd:value,recordedAt:now};
 }
 if(issues.length)throw new Error(issues.slice(0,3).join('; ')+(issues.length>3?` (+${issues.length-3} more)` :''));
 if(!Object.keys(entries).length)throw new Error('No prices found. Use one row per card and finish.');
 Object.assign(bilgewaterPrices,entries);saveBilgewaterPrices();return Object.keys(entries).length;
}
function exportBilgewaterTemplate(){
 const seen=new Set(),rows=[['Code','Finish','USD']];
 for(const entry of ownedEntries()){
  const k=bwPriceKey(entry.card,entry.finish);if(seen.has(k))continue;seen.add(k);
  rows.push([entry.card.code,entry.finish,bilgewaterPrices[k]?.usd??'']);
 }
 if(rows.length===1)rows.push(['SFD-088a','Foil','']);
 download('RiftVault-Bilgewater-price-template.csv','\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
function safePriceLink(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:'';}catch(e){return '';}}
function priceQuoteByKey(key){const {id,finish}=unpackKey(key);return quoteFor(getMeta(id),finish);}
function priceSummary(keys){let total=0,priced=0,unpriced=0;for(const [key,qty] of keys){if(qty<=0)continue;const q=priceQuoteByKey(key);if(q){total+=q.amount*qty;priced+=qty;}else unpriced+=qty;}return {total,priced,unpriced};}
function collectionPrice(){return priceSummary(Object.entries(state.stock));}
function deckPrice(deck){const items=[];for(const a of Object.values(deck.allocations||{}))for(const [k,q] of Object.entries(a))items.push([k,Number(q)]);return priceSummary(items);}
function deckMissingPrice(deck){let known=0,knownCards=0,unpriced=0;for(const e of deck.entries){const need=Math.max(0,e.required-entryAssigned(deck,e)-entryBulk(e));if(!need)continue;const candidates=eligiblePrintings(e).filter(p=>!p.isVariant && !p.isAltArt).map(p=>quoteFor(p,'Normal')||quoteFor(p,'Foil')).filter(Boolean);if(!candidates.length){unpriced+=need;continue;}const minimum=Math.min(...candidates.map(q=>q.amount));known+=minimum*need;knownCards+=need;}return {known,knownCards,unpriced};}
function readablePriceDate(value){
 const ms=Date.parse(value||'');return Number.isFinite(ms)?new Date(ms).toLocaleString():'Unknown';
}
function priceUpdatedLabel(){
 if(priceState.status==='loading'&&!priceState.entries.length)return 'Loading TCGplayer market prices…';
 if(!priceState.entries.length)return 'Prices unavailable — connect to the internet and retry';
 const date=readablePriceDate(priceState.fetchedAt);
 return 'RiftHunt price feed '+date+(priceState.cached?' · cached/offline':' · checked automatically');
}
let priceFetchInFlight=null;
async function loadPrices(force=false){
 if(priceFetchInFlight)return priceFetchInFlight;
 const recent=priceState.checkedAt&&Number.isFinite(Date.parse(priceState.checkedAt))&&Date.now()-Date.parse(priceState.checkedAt)<PRICE_CACHE_AGE;
 if(!force&&recent&&priceState.entries.length){priceState.status='ready';indexPrices();render();return;}
 priceState.status=priceState.entries.length?'ready':'loading';priceState.error='';
 render();
 priceFetchInFlight=(async()=>{
 try{
  // One daily bulk request per source, rather than polling individual cards.
  const [cards,pr]=await Promise.all([
   getRiftHuntCards(),
   fetch(PRICE_QUOTES_URL,{cache:'no-cache'})
  ]);
  if(!pr.ok)throw new Error(`Price feed HTTP ${pr.status}`);
  const prices=await pr.json();
  if(!Array.isArray(cards.cards)||!Array.isArray(prices.prices))throw new Error('Unexpected RiftHunt feed structure');
  if(prices.source&&prices.source!=='tcgplayer')throw new Error('Unexpected market source');
  const quotes=new Map(prices.prices.filter(r=>r.printing_id).map(r=>[r.printing_id,r]));
  // Price records carry the printed collector number even for promotional
  // and signature products whose Riot riftboundId is not unique.
  try{integrateRiftHuntCatalogue(cards.cards.map(c=>({...c,collector:quotes.get(c.printing_id)?.collector||c.collector||''})));}
  catch(e){console.warn('Price collector refresh unavailable:',e);}
  const rows=cards.cards.filter(c=>c.printing_id&&c.set&&c.num!==undefined).map(c=>{
    const u=quotes.get(c.printing_id);
    const printed=collectorFromRiftHunt({...c,collector:u?.collector||c.collector||''});
    const code=String(c.set).toUpperCase()+'-'+printed;
    return {printingId:c.printing_id,legacyId:c.riftboundId||'',code,
      name:c.name,cleanName:c.cleanName||c.name,alt:!!c.alt||/a$/i.test(printed),sig:!!c.sig||/\*$/.test(printed),over:!!c.over,
      isVariant:!!(c.alt||c.sig||c.over||/[a-z*]$/i.test(printed)||/\(Metal\)/i.test(c.name)),
      allowedFinishes:c.finishes,domains:c.domains||[],supertype:c.supertype||'',
      type:c.type||'',tags:c.tags||[],set:c.set||'',rarity:c.rarity||'',
      usd:u?{normal:u.finishes?.normal||null,foil:u.finishes?.foil||null,
        updatedAt:u.updatedAt,purchaseUri:u.purchaseUri}:null};
  });
  if(rows.length<200)throw new Error('Too few printings received');
  priceState.entries=rows;
  priceState.fetchedAt=prices.fetched||new Date().toISOString();
  priceState.checkedAt=new Date().toISOString();
  priceState.status='ready';priceState.cached=false;priceState.error='';
  indexPrices();
  try{localStorage.setItem(PRICE_CACHE_KEY,JSON.stringify({entries:rows,
     fetchedAt:priceState.fetchedAt,checkedAt:priceState.checkedAt}));}catch(e){console.warn('Price cache could not be saved',e);}
  render();if(force)toast('TCGplayer market estimates refreshed from RiftHunt.');
 }catch(e){
  priceState.error=String(e?.message||e);
  priceState.cached=!!priceState.entries.length;
  priceState.status=priceState.cached?'ready':'unavailable';
  indexPrices();render();
  if(force)toast('Price refresh failed. '+(priceState.cached?'Using cached quotes.':'Quotes unavailable.'),true);
  console.warn('RiftHunt pricing unavailable:',e);
 }finally{priceFetchInFlight=null;}
 })();
 return priceFetchInFlight;
}
function wishlistRows(){const group=new Map();for(const deck of state.decks)for(const e of deck.entries){const k=normalizeName(e.name);if(!k)continue;let row=group.get(k);if(!row){row={name:e.name,required:0,decks:new Set(),code:e.code};group.set(k,row);}const n=Math.max(0,e.required-entryAssigned(deck,e));if(n){row.required+=n;row.decks.add(deck.name);}}return [...group.values()].map(r=>({...r,bulk:stockForName(r.name,true),missing:Math.max(0,r.required-stockForName(r.name,true))})).filter(r=>r.missing>0).sort((a,b)=>b.missing-a.missing||a.name.localeCompare(b.name));}
function checkDeck(deck){const issues=[],counts=Object.fromEntries(SECTIONS.map(s=>[s,deck.entries.filter(e=>e.section===s).reduce((a,b)=>a+b.required,0)]));if(counts.Legend!==1)issues.push(`Legend: ${counts.Legend}; expected 1`);if(counts.Champion!==1)issues.push(`Chosen Champion: ${counts.Champion}; expected 1`);if(counts.MainDeck+counts.Champion<40)issues.push(`Main Deck + chosen Champion: ${counts.MainDeck+counts.Champion}; minimum 40`);if(counts.Runes!==12)issues.push(`Runes: ${counts.Runes}; expected 12`);if(counts.Battlefields!==3)issues.push(`Battlefields: ${counts.Battlefields}; expected 3`);if(counts.Sideboard>10)issues.push(`Sideboard: ${counts.Sideboard}; maximum 10`);const b=deck.entries.filter(e=>e.section==='Battlefields');if(new Set(b.map(e=>normalizeName(e.name))).size!==b.length||b.some(e=>e.required!==1))issues.push('Battlefield names must be different');const cardCounts=new Map();for(const e of deck.entries.filter(e=>['MainDeck','Champion','Sideboard'].includes(e.section))){const k=normalizeName(e.name);cardCounts.set(k,(cardCounts.get(k)||0)+e.required);}for(const [k,n] of cardCounts)if(n>3&&k!=='spiderling')issues.push(`More than 3 copies of ${k} across main/champion/sideboard`);for(const e of deck.entries)if(banStatus(requirementName(e),'standard'))issues.push(`${requirementName(e)} is banned in Standard Constructed (official list September 2026)`);return {issues,pass:issues.length===0};}

function getNamesForSearch(){const grouped=new Map();for(const original of catalog){const p=getMeta(original.id);let k=normalizeName(p.name);let group=grouped.get(k);if(!group){group={name:p.name,defaultPrint:p,printings:[]};grouped.set(k,group);}group.printings.push(p);if(group.defaultPrint.isVariant && !p.isVariant)group.defaultPrint=p;}
for(const {card} of ownedEntries()){const k=normalizeName(card.name);if(!grouped.has(k))grouped.set(k,{name:card.name,defaultPrint:card,printings:[card]});}return [...grouped.values()];}

// RiftAtlas sectioned TXT importer; it deliberately retains unknown names as requirements.
function canonicalSection(raw){const s=normalizeName(raw).replace(/[^a-z]/g,'');if(s==='legend'||s==='legends')return 'Legend';if(['champion','chosenchampion','champions'].includes(s))return 'Champion';if(['main','maindeck','deck'].includes(s))return 'MainDeck';if(['battlefield','battlefields'].includes(s))return 'Battlefields';if(['rune','runes','runedeck'].includes(s))return 'Runes';if(['sideboard','side'].includes(s))return 'Sideboard';return null;}
function parseDeckText(txt){const entries=[];const errors=[];let section=null;let suggestedName='';const lines=String(txt||'').replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n');for(let i=0;i<lines.length;i++){const line=lines[i].trim();if(!line||line.startsWith('#')||line.startsWith('//'))continue;const heading=line.match(/^([A-Za-z][A-Za-z\s_-]*?)(?:\s*\(\d+\))?\s*:?$/);const sect=heading&&canonicalSection(heading[1]);if(sect){section=sect;continue;}const match=line.match(/^(\d+)\s*x?\s+(.+)$/i)||line.match(/^(\d+)x\s*(.+)$/i);if(!match){if(!section&&!suggestedName&&!/\d/.test(line)){suggestedName=line;continue;}errors.push(`Line ${i+1}: ${line}`);continue;}if(!section){errors.push(`Line ${i+1}: place this card under a section`);continue;}const required=Number(match[1]);if(!Number.isInteger(required)||required<1||required>500){errors.push(`Line ${i+1}: invalid quantity`);continue;}let name=match[2].trim();let code='';let cm=name.match(/\s*\(([A-Z]{2,5}[\s-]?(?:SP\d{1,2}|[RTS]?\d{1,3}[a-z]?)(?:\s*\/\s*\d{2,3})?)\)\s*$/i);if(cm){code=cm[1];name=name.slice(0,cm.index).trim();}if(!name){errors.push(`Line ${i+1}: missing card name`);continue;}const existing=entries.find(e=>e.section===section&&normalizeName(e.name)===normalizeName(name)&&normalizedCode(e.code)===normalizedCode(code));if(existing)existing.required+=required;else entries.push({id:uid(),section,name,code,required});}return {entries,errors,suggestedName,total:entries.reduce((s,e)=>s+e.required,0)};}
function createDeck(name,entries=[]){const deck={id:uid(),name:String(name||'Untitled deck').trim()||'Untitled deck',createdAt:new Date().toISOString(),entries:entries.map(e=>({...e,id:uid()})),allocations:{}};state.decks.push(deck);logActivity('Created deck: '+deck.name,null,'deck');save();return deck;}
function assignOne(deck,entry,preferredKey=null){const remaining=entry.required-entryAssigned(deck,entry);if(remaining<=0)return false;const possible=ownedKeysByName(entry.name,entry.code,entry.section).filter(k=>bulkQty(k)>0);if(preferredKey && possible.includes(preferredKey))possible.unshift(possible.splice(possible.indexOf(preferredKey),1)[0]);const key=possible[0];if(!key)return false;if(!deck.allocations[entry.id])deck.allocations[entry.id]={};deck.allocations[entry.id][key]=(deck.allocations[entry.id][key]||0)+1;save();return true;}
function unassignOne(deck,entry){const entries=Object.entries(deck.allocations[entry.id]||{}).filter(([,n])=>n>0);if(!entries.length)return false;const key=entries[entries.length-1][0];deck.allocations[entry.id][key]--;if(deck.allocations[entry.id][key]<=0)delete deck.allocations[entry.id][key];save();return true;}
function autoAssign(deck){let assigned=0;for(const e of deck.entries){while(entryAssigned(deck,e)<e.required){if(!assignOne(deck,e))break;assigned++;}}if(assigned)logActivity(`Assigned ${assigned} available card${assigned===1?'':'s'} to ${deck.name}`,null,'assign');save();return assigned;}
function runeCount(deck,name){return deck.entries.filter(e=>e.section==='Runes'&&normalizeName(e.name)===normalizeName(name)).reduce((n,e)=>n+Math.max(0,Number(e.required)||0),0);}
function setRuneCounts(deck,counts){
 const values=RUNE_NAMES.map(name=>({name,qty:Number(counts[name])}));
 if(values.some(x=>!Number.isInteger(x.qty)||x.qty<0||x.qty>99))return {ok:false,error:'Enter a whole number from 0 to 99 for each Rune.'};
 for(const {name,qty} of values){
  const group=deck.entries.filter(e=>e.section==='Runes'&&normalizeName(e.name)===normalizeName(name));
  const primary=group[0];
  if(!qty){for(const e of group){delete deck.allocations[e.id];deck.entries=deck.entries.filter(r=>r.id!==e.id);}continue;}
  if(!primary){deck.entries.push({id:uid(),section:'Runes',name,required:qty,code:''});continue;}
  // Consolidate duplicate imported lines for the same rune, without losing
  // physical allocations. The requirements are set-independent by design.
  primary.name=name;primary.code='';primary.required=qty;
  const alloc=deck.allocations[primary.id]||(deck.allocations[primary.id]={});
  for(const duplicate of group.slice(1)){
   for(const [key,n] of Object.entries(deck.allocations[duplicate.id]||{}))alloc[key]=(alloc[key]||0)+Number(n||0);
   delete deck.allocations[duplicate.id];
   deck.entries=deck.entries.filter(r=>r.id!==duplicate.id);
  }
  let surplus=entryAssigned(deck,primary)-qty;
  if(surplus>0){
   // Return alternate-art and foil copies first, preserving normal cards in deck.
   const keys=Object.keys(alloc).filter(k=>alloc[k]>0).sort((a,b)=>{
    const ca=getMeta(unpackKey(a).id),cb=getMeta(unpackKey(b).id);
    return cardArtPriority(cb)-cardArtPriority(ca)||Number(unpackKey(b).finish==='Foil')-Number(unpackKey(a).finish==='Foil');
   });
   for(const k of keys){if(!surplus)break;const r=Math.min(surplus,alloc[k]);alloc[k]-=r;surplus-=r;if(!alloc[k])delete alloc[k];}
  }
  if(!Object.keys(alloc).length)delete deck.allocations[primary.id];
 }
 logActivity('Updated rune quantities in '+deck.name,null,'deck');save();
 return {ok:true,total:values.reduce((n,x)=>n+x.qty,0)};
}
function renderRuneSetup(deck){
 const total=RUNE_NAMES.reduce((sum,name)=>sum+runeCount(deck,name),0);
 return `<section class="panel rune-setup mb18"><div class="row-between wrap"><div><div class="eyebrow">RUNE CONFIGURATION</div><h3>Choose your rune quantities</h3></div><span class="badge ${total===12?'badge-success':'badge-warning'}">${total} / 12 runes</span></div><p class="muted small">Enter how many of each Rune your deck needs. Auto-assign uses copies in Bulk <strong>from any set</strong>, choosing regular artwork before alternate art (and non-foil first within each artwork type).</p><div class="rune-count-grid">${RUNE_NAMES.map(name=>{
  const avail=ownedKeysByName(name,'','Runes').reduce((sum,k)=>sum+bulkQty(k),0);
  return `<label class="rune-count-item"><span class="rune-label">${escapeHtml(name)}</span><span class="muted micro">${avail} in Bulk across all sets</span><input class="input rune-qty-input" type="number" inputmode="numeric" min="0" max="99" step="1" data-rune-name="${escapeHtml(name)}" aria-label="Required ${escapeHtml(name)}" value="${runeCount(deck,name)}" /></label>`;
 }).join('')}</div><div class="row-between wrap mt16"><span class="muted micro">Save the counts, then tap Auto-assign available copies. The usual Constructed target is 12 runes.</span><button class="btn btn-primary" data-action="save-rune-counts">Save rune quantities</button></div></section>`;
}
function deckAllocationBreakdown(deck,entry){
 const rows=Object.entries(deck.allocations?.[entry.id]||{}).filter(([,qty])=>Number(qty)>0);
 if(!rows.length)return '';
 return `<div class="deck-assigned-printings"><span class="muted micro">Currently assigned:</span>${rows.map(([key,qty])=>{
  const meta=getMeta(unpackKey(key).id),finish=unpackKey(key).finish;
  return `<span class="deck-print-pill">${escapeHtml(meta.code||meta.id)} · ${escapeHtml(meta.isAltArt?'Alt art':'Regular')} · ${escapeHtml(finish)} ×${Number(qty)}</span>`;
 }).join('')}<button class="btn btn-small btn-ghost" data-action="swap-open" data-entry="${escapeHtml(entry.id)}">↔ Swap printing / finish</button></div>`;
}
function swapDeckCopy(deck,entry,fromKey,toKey){
 if(!deck||!entry||!fromKey||!toKey||fromKey===toKey)return false;
 const alloc=deck.allocations?.[entry.id];
 if(!alloc||Number(alloc[fromKey]||0)<1||bulkQty(toKey)<1)return false;
 // Deliberately accept any printing of the same named card; this enables a
 // regular-art to alternate-art swap even with a code-pinned TXT requirement.
 const candidates=new Set(ownedKeysByName(entry.name,'',entry.section));
 if(!candidates.has(toKey))return false;
 alloc[fromKey]--;
 if(!alloc[fromKey])delete alloc[fromKey];
 alloc[toKey]=(alloc[toKey]||0)+1;
 logActivity(`Swapped ${getMeta(unpackKey(fromKey).id).code} ${unpackKey(fromKey).finish} → ${getMeta(unpackKey(toKey).id).code} ${unpackKey(toKey).finish} in ${deck.name}`,toKey,'assign');
 save();return true;
}
function addRequirement(deck,section,name,required){name=String(name||'').trim();if(!name)return false;let existing=deck.entries.find(e=>e.section===section&&normalizeName(e.name)===normalizeName(name)&&!e.code);if(existing)existing.required+=required;else deck.entries.push({id:uid(),section,name,required,code:''});save();return true;}
function listVariantLabel(p,finish){return `${p.code||p.id} • ${p.setName||'Unknown set'}${p.isAltArt?' • Alt art':''} • ${finish}`;}
function renderNav(){const title = NAV.find(n=>n.id===ui.tab)?.name||'Overview';document.getElementById('page-title').textContent=title;document.getElementById('breadcrumb').textContent=title.toUpperCase();document.getElementById('side-nav').innerHTML=NAV.map(n=>`<button class="nav-item ${ui.tab===n.id?'active':''}" data-nav="${n.id}"><span class="nav-icon">${n.icon}</span>${n.name}</button>`).join('')+`<button class="nav-item" data-nav="settings"><span class="nav-icon">⚙</span>Settings & backup</button>`;document.getElementById('bottom-nav').innerHTML=NAV.slice(0,5).map(n=>`<button data-nav="${n.id}" class="${ui.tab===n.id?'active':''}"><span class="nav-icon">${n.icon}</span><span>${n.name.replace(' cards','').replace('Auto ','').replace('My ','')}</span></button>`).join('')+`<button data-action="mobile-more" class="${['wishlist','locations','sets','history','rules','banned','settings'].includes(ui.tab)?'active':''}"><span class="nav-icon">☰</span><span>More</span></button>`;const status=statusNote();document.getElementById('catalog-badge').textContent=catalogReady?'● '+fmt(catalog.length)+' cards':'◌ Catalogue pending';document.getElementById('catalog-status-side').textContent=status;}
function render(){rebuildIndexes();renderNav();let html='';switch(ui.tab){case'overview':html=renderOverview();break;case'search':html=renderSearch();break;case'inventory':html=renderInventory();break;case'decks':html=renderDecks();break;case'scan':html=renderScan();break;case'settings':html=renderSettings();break;case'wishlist':html=renderWishlist();break;case'locations':html=renderLocations();break;case'sets':html=renderSets();break;case'history':html=renderScanHistory();break;case'rules':html=renderRules();break;default:html=renderOverview();}document.getElementById('main').innerHTML=html;renderModal();}
function renderOverview(){const assigned=totalOwned()-totalBulk()-totalStorage();const last=state.activity.slice(0,6);return `<section class="hero"><div><div class="eyebrow">YOUR PERSONAL RIFTBOUND HUB</div><h2>Every card accounted for.<br />Every deck ready.</h2><p>Keep track of your physical collection, search card locations and assign copies to your decks. Start with a card scan or import a TXT decklist.</p><div class="hero-actions"><button class="btn btn-primary" data-nav="scan">▣ &nbsp; Start scanning</button><button class="btn btn-ghost" data-action="open-import">＋ &nbsp; Import a deck</button></div></div><div class="hero-art" aria-hidden="true">✦</div></section>
<div class="stats"><div class="stat-card"><div class="stat-top">TOTAL COPIES <span class="stat-icon">▥</span></div><div class="stat-value">${fmt(totalOwned())}</div><div class="stat-sub">Physical cards recorded</div></div><div class="stat-card"><div class="stat-top">UNIQUE CARDS <span class="stat-icon">◇</span></div><div class="stat-value">${fmt(uniqueOwned())}</div><div class="stat-sub">Distinct card names</div></div><div class="stat-card"><div class="stat-top">AVAILABLE IN BULK <span class="stat-icon">▣</span></div><div class="stat-value">${fmt(totalBulk())}</div><div class="stat-sub">Unassigned copies</div></div><div class="stat-card"><div class="stat-top">ASSIGNED TO DECKS <span class="stat-icon">▤</span></div><div class="stat-value">${fmt(assigned)}</div><div class="stat-sub">Across ${state.decks.length} deck${state.decks.length===1?'':'s'}</div></div></div>
<div class="two-col"><div class="panel"><div class="panel-heading"><h3>Quick actions</h3><span class="muted small">GET STARTED</span></div><div class="quick-links"><button class="quick-card" data-nav="search"><span style="font-size:23px;color:var(--accent)">⌕</span><strong>Find a card</strong><span>Search by name or collector code</span></button><button class="quick-card" data-nav="scan"><span style="font-size:23px;color:var(--accent)">▣</span><strong>Scan into Bulk</strong><span>Live camera with automatic OCR</span></button><button class="quick-card" data-action="open-import"><span style="font-size:23px;color:var(--accent)">▤</span><strong>Import a deck</strong><span>Upload your RiftAtlas-style TXT</span></button><button class="quick-card" data-action="excel"><span style="font-size:23px;color:var(--accent)">↧</span><strong>Export Excel</strong><span>Workbook with inventory and decks</span></button></div></div><div class="panel"><div class="panel-heading"><h3>Recent activity</h3><span class="muted small">LATEST CHANGES</span></div>${last.length?last.map(a=>`<div class="activity-item"><div class="activity-dot">✓</div><div><strong>${escapeHtml(a.kind==='scan'?scanActivityLabel(a):a.message)}</strong><span>${escapeHtml(shortDate(a.at))}</span></div></div>`).join(''):`<div class="empty" style="border:0;padding:30px 10px"><div class="empty-icon">✦</div><h3>A fresh collection</h3><p>Your inventory history will appear here after you add cards or build a deck.</p></div>`}</div></div>${!catalogReady?`<div class="info-note mt24"><strong>Catalogue connection:</strong> The full card list loads from an online community dataset. Until it connects, a small set of verified starter cards is available. <button class="btn btn-small btn-ghost" data-action="refresh-catalog">Retry</button></div>`:''}`;}
function searchGroups(){let groups=getNamesForSearch();const q=normalizeName(ui.query),filter=ui.setFilter;groups=groups.filter(g=>(!q||normalizeName(g.name).includes(q)||g.printings.some(p=>normalizeName(p.shortName).includes(q))||g.printings.some(p=>normalizedCode(p.code).includes(normalizedCode(q))||normalizeName(p.setName).includes(q)))&&(filter==='all'||g.printings.some(p=>p.set===filter))&&(!ui.ownedOnly||stockForName(g.name)>0));groups.sort((a,b)=>{if(q){const as=normalizeName(a.name).startsWith(q)?0:1,bs=normalizeName(b.name).startsWith(q)?0:1;if(as!==bs)return as-bs;}return a.name.localeCompare(b.name);});return groups;}
function renderSearch(){const all=searchGroups(),groups=all.slice(0,60);const sets=[...new Map(catalog.map(c=>[c.set,c.setName])).entries()].filter(([k])=>k).sort((a,b)=>a[0].localeCompare(b[0]));return `<div class="row-between mb18 wrap"><div><h2>Find your Riftbound cards</h2><p class="muted small" style="margin:4px 0">Browse card artwork, see quantities and find which deck holds each copy.</p></div><span class="pill">${fmt(all.length)} card names</span></div><div class="toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input id="card-search" class="input input-search" autocomplete="off" placeholder="Search name, set or code (e.g. Jinx / OGN-001)" value="${escapeHtml(ui.query)}" /></div><select id="set-filter" class="select"><option value="all">All sets</option>${sets.map(([k,v])=>`<option value="${escapeHtml(k)}" ${ui.setFilter===k?'selected':''}>${escapeHtml(v||k)}</option>`).join('')}</select><label class="checkbox-line"><input id="owned-only" type="checkbox" ${ui.ownedOnly?'checked':''}/> Owned only</label></div>${groups.length?`<div class="card-grid">${groups.map(g=>{const p=g.defaultPrint,q=stockForName(g.name);return `<button class="collection-card" data-action="card-detail" data-name="${escapeHtml(g.name)}" data-id="${escapeHtml(p.id)}"><div class="card-art">${cardArt(p)}${q>0?`<span class="owned-chip">×${q} owned</span>`:''}</div><div class="card-meta"><strong title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</strong><div class="card-sub"><span>${escapeHtml(p.setName||'Riftbound')}</span><span>${g.printings.length} print${g.printings.length===1?'':'s'}</span></div><div class="card-price-tag">TCGplayer daily estimate: ${priceHtml(quoteFor(p,'Normal')||quoteFor(p,'Foil'))}</div></div></button>`}).join('')}</div>${all.length>60?`<p class="muted small text-center mt16">Showing first 60 results. Search to narrow your results.</p>`:''}`:`<div class="empty"><div class="empty-icon">⌕</div><h3>No matching cards</h3><p>Try a shorter name or another set. The full card catalogue also requires an internet connection.</p></div>`}`;}
function renderInventory(){let entries=ownedEntries();const q=normalizeName(ui.inventoryQuery);if(q)entries=entries.filter(e=>normalizeName(e.card.name).includes(q)||normalizeName(e.card.code).includes(q)||normalizeName(e.finish).includes(q));let regular=entries.filter(e=>e.bulk>0);return `<div class="row-between wrap mb24"><div><h2>Your physical inventory</h2><p class="muted small" style="margin:5px 0">The total includes cards in Bulk and in decks. Only Bulk copies can be removed.</p></div><div class="row wrap"><button class="btn btn-ghost" data-action="excel">↧ Export Excel</button><button class="btn btn-primary" data-nav="scan">▣ Scan cards</button></div></div><div class="stats"><div class="stat-card"><div class="stat-top">TOTAL COPIES</div><div class="stat-value">${fmt(totalOwned())}</div></div><div class="stat-card"><div class="stat-top">AVAILABLE IN BULK</div><div class="stat-value">${fmt(totalBulk())}</div></div><div class="stat-card"><div class="stat-top">IN DECKS</div><div class="stat-value">${fmt(totalOwned()-totalBulk())}</div></div><div class="stat-card"><div class="stat-top">UNIQUE NAMES</div><div class="stat-value">${fmt(uniqueOwned())}</div></div></div><div class="panel"><div class="toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input id="inventory-search" class="input input-search" placeholder="Filter owned cards..." value="${escapeHtml(ui.inventoryQuery)}" /></div><span class="muted small">${entries.length} printings / finishes</span></div>${entries.length?entries.map(e=>`<div class="list-row"><div class="thumb">${cardArt(e.card)}</div><div class="item-main"><strong>${escapeHtml(e.card.name)}</strong><small>${escapeHtml(e.card.code||'')} · ${escapeHtml(e.card.setName||'')} · ${escapeHtml(e.finish)}</small><small>Owned ${e.qty} · Bulk ${e.bulk} · Decks ${e.qty-e.bulk}</small></div><div class="quantity-controls"><button class="btn btn-small btn-icon" data-action="bulk-remove" data-key="${escapeHtml(e.key)}" title="Remove one from Bulk" ${e.bulk<1?'disabled':''}>−</button><span class="num">${e.bulk}</span><button class="btn btn-small btn-icon btn-green-outline" data-action="bulk-add" data-key="${escapeHtml(e.key)}" title="Add one to Bulk">＋</button></div><button class="btn btn-small btn-ghost" data-action="card-detail" data-name="${escapeHtml(e.card.name)}" data-id="${escapeHtml(e.card.id)}" title="See locations">›</button></div>`).join(''):`<div class="empty"><div class="empty-icon">▥</div><h3>${q?'No inventory matches':'No cards recorded yet'}</h3><p>Go to Search cards to add your first copies, or use the automatic scanner.</p><button class="btn btn-primary" data-nav="search">Search cards</button></div>`}</div>`;}
function renderDecks(){const active=ui.deckId&&findDeck(ui.deckId);if(active)return renderDeckDetail(active);return `<div class="row-between wrap mb24"><div><h2>Deck library</h2><p class="muted small" style="margin:5px 0">Import a decklist, choose rune quantities, allocate owned cards and swap printings or foil finishes later.</p></div><div class="row wrap"><button class="btn btn-ghost" data-action="new-empty-deck">＋ Empty deck</button><button class="btn btn-primary" data-action="open-import">↥ Import TXT</button></div></div>${state.decks.length?`<div class="deck-cards">${state.decks.map((d,i)=>{let required=entriesNeeded(d),assigned=entriesAssigned(d),missing=Math.max(0,required-assigned);return `<button class="deck-card" data-action="open-deck" data-id="${escapeHtml(d.id)}"><div class="deck-cover">${deckLegendArt(d)}<div><div class="eyebrow">DECK ${String(i+1).padStart(2,'0')}</div><strong style="font-size:19px">${escapeHtml(d.name)}</strong></div><div class="deck-symbol">✦</div></div><strong>${escapeHtml(d.name)}</strong><div class="progress-track"><div class="progress-fill" style="width:${required?100*assigned/required:0}%"></div></div><div class="muted micro">${required?Math.round(100*assigned/required):0}% assigned from collection</div><div class="deck-metrics"><div><strong>${assigned}</strong><span>Assigned</span></div><div><strong>${required}</strong><span>Required</span></div><div><strong>${missing}</strong><span>Missing</span></div></div></button>`}).join('')}</div>`:`<div class="empty"><div class="empty-icon">▤</div><h3>No decks yet</h3><p>Create an empty deck, or upload the RiftAtlas TXT format to see required cards and what you already own.</p><div class="row wrap" style="justify-content:center"><button class="btn btn-primary" data-action="open-import">↥ Import a TXT deck</button><button class="btn btn-ghost" data-action="new-empty-deck">＋ Create empty deck</button></div></div>`}`;}
function deckStats(deck){return {need:entriesNeeded(deck),assigned:entriesAssigned(deck),missing:Math.max(0,entriesNeeded(deck)-entriesAssigned(deck))};}
// v1.16: choose the actual reserved printing first so alternate art and foil
// assigned to a deck are represented by their own thumbnail when available.
function deckEntryArt(deck, entry){
 const assigned=Object.entries(deck.allocations?.[entry.id]||{}).filter(([,n])=>Number(n)>0).sort((a,b)=>b[1]-a[1]);
 const chosen=assigned.map(([key])=>({card:getMeta(unpackKey(key).id),finish:unpackKey(key).finish}));
 const options=eligiblePrintings(entry);
 const fallback=printingsFor(requirementName(entry));
 const preferred=chosen.find(x=>x.card.imageUrl)||chosen[0];
 const card=preferred?.card||options.find(p=>p.imageUrl&&!p.isAltArt)||options.find(p=>p.imageUrl)||fallback.find(p=>p.imageUrl)||options[0]||fallback[0];
 if(!card)return `<span class="deck-entry-thumb" aria-label="No artwork available"><span class="placeholder-art">✦</span></span>`;
 const finish=preferred?.card?.id===card.id?preferred.finish:(isFoilOnlyAlternate(card)?'Foil':null);
 return `<button type="button" class="deck-entry-thumb card-zoom-trigger" data-action="image-preview" data-id="${escapeHtml(card.id)}" data-finish="${escapeHtml(finish||'')}" title="Enlarge ${escapeHtml(card.name)} card art" aria-label="Enlarge ${escapeHtml(card.name)} ${escapeHtml(card.code)} card art">${cardArt(card)}</button>`;
}

function renderDeckDetail(deck){const stat=deckStats(deck);const runePanel=renderRuneSetup(deck);const rows=SECTIONS.map(section=>{const group=deck.entries.filter(e=>e.section===section);if(!group.length)return '';const subtotal=group.reduce((s,e)=>s+e.required,0);return `<div class="section-bar">${escapeHtml(SECTION_LABEL[section])} <span class="subtle" style="float:right">${subtotal} cards</span></div><table class="deck-table"><thead><tr><th>Card / location</th><th class="qty-col">Need</th><th class="qty-col">Assigned</th><th class="qty-col">Bulk</th><th class="actions-col">Move from Bulk</th></tr></thead><tbody>${group.map(e=>{let count=entryAssigned(deck,e),available=entryBulk(e),other=entryElsewhere(e,deck),opts=ownedKeysByName(e.name,e.code,e.section).filter(k=>bulkQty(k)>0);return `<tr class="deck-list-row"><td><div class="deck-entry-head">${deckEntryArt(deck,e)}<div class="deck-entry-text"><strong class="deck-entry-name">${escapeHtml(requirementName(e))}</strong>${banBadge(requirementName(e))}${e.code?` <span class="subtle micro">${escapeHtml(e.code)}</span>`:''}<span class="allocation-note">${other?`${other} in other deck${other===1?'':'s'} · `:''}${Math.max(0,e.required-count-available)?`Short ${Math.max(0,e.required-count-available)} copies`:'Available to complete'}</span>${deckAllocationBreakdown(deck,e)}<button class="btn btn-small btn-ghost" style="padding:3px 0;font-size:10px" data-action="edit-requirement" data-entry="${escapeHtml(e.id)}">Edit requirement</button></div></div></td><td class="qty-col">${e.required}</td><td class="qty-col"><span class="badge ${count===e.required?'badge-success':count?'badge-warning':'badge-danger'}">${count}</span></td><td class="qty-col">${available}</td><td class="actions-col"><div class="row" style="justify-content:flex-end;gap:5px"><button class="btn btn-small btn-icon" data-action="unassign" data-entry="${escapeHtml(e.id)}" title="Return one to Bulk" ${count<=0?'disabled':''}>−</button><button class="btn btn-small btn-icon btn-green-outline" data-action="assign" data-entry="${escapeHtml(e.id)}" title="Assign one available copy" ${available<1||count>=e.required?'disabled':''}>＋</button></div>${opts.length>1?`<select class="mini-select" data-variant-entry="${escapeHtml(e.id)}" aria-label="Preferred printing for ${escapeHtml(e.name)}"><option value="">Auto choose</option>${opts.map(k=>{const p=getMeta(unpackKey(k).id);return `<option value="${escapeHtml(k)}">${escapeHtml(p.code)} ${escapeHtml(unpackKey(k).finish)}</option>`}).join('')}</select>`:''}</td></tr>`}).join('')}</tbody></table>`}).join('');return `<button class="btn btn-ghost btn-small mb18" data-action="back-to-decks">← All decks</button><div class="deck-head"><div><div class="eyebrow">DECK MANAGER</div><h2>${escapeHtml(deck.name)}</h2><div class="muted small">Created ${escapeHtml(shortDate(deck.createdAt))} · Cards are physically allocated from Bulk.</div></div><div class="row wrap" style="justify-content:flex-end"><button class="btn btn-ghost btn-small" data-action="rename-deck">Rename</button><button class="btn btn-danger btn-small" data-action="delete-deck">Delete</button></div></div><div class="stats deck-kpis"><div class="stat-card"><div class="stat-top">REQUIRED</div><div class="stat-value">${stat.need}</div></div><div class="stat-card"><div class="stat-top">ASSIGNED</div><div class="stat-value">${stat.assigned}</div></div><div class="stat-card"><div class="stat-top">STILL MISSING</div><div class="stat-value">${stat.missing}</div></div><div class="stat-card"><div class="stat-top">DECK SECTIONS</div><div class="stat-value">${new Set(deck.entries.map(e=>e.section)).size}</div></div></div>${runePanel}<div class="row wrap mb18"><button class="btn btn-primary" data-action="auto-assign">✓ Auto-assign available copies</button><button class="btn" data-action="open-add-card">＋ Add required card</button><button class="btn btn-ghost" data-action="open-import-into">↥ Replace requirements via TXT</button><button class="btn btn-ghost" data-action="deck-txt">↧ Export TXT</button></div><div class="info-note mb18"><strong>Ownership protection:</strong> Importing a deck never removes cards from Bulk. Use + or Auto-assign to move available copies. Runes use any set, regular artwork first. Swap an assigned card to another owned printing or finish without changing total ownership. Removing a deck returns its allocated copies to Bulk.</div><div class="panel" style="padding:13px 18px">${rows||`<div class="empty"><div class="empty-icon">◇</div><h3>Start building this deck</h3><p>Add cards manually or import a TXT decklist to define what the deck needs.</p><button class="btn btn-primary" data-action="open-add-card">Add a card</button></div>`}</div>${stat.need?`<div class="row-between mt16 wrap"><span class="muted small">${stat.assigned} of ${stat.need} cards currently assigned</span><button class="btn btn-ghost btn-small" data-action="return-all">Return all assigned cards to Bulk</button></div>`:''}`;}
function renderScan(){return `<div class="row-between wrap mb24"><div><h2>Hands-free card scanner</h2><p class="muted small" style="margin:5px 0">Continuous OCR with experimental foil detection from live reflections.</p></div><span class="pill" id="scan-running-badge">● Camera off</span></div><div class="scanner-layout"><div><div class="camera-box" id="camera-box"><div class="camera-placeholder" id="camera-placeholder"><span class="cam-symbol">▣</span><strong>Ready to scan your cards</strong><p>Place any Riftbound card, including Runes, in front of your phone camera. Start scanning to recognise the printed collector code.</p></div><video id="scan-video" autoplay playsinline muted></video><div class="scan-guide"><span class="scan-code-hint">COLLECTOR CODE ↓</span></div><div class="scan-capture-flash" aria-hidden="true">✓ Captured</div></div><div id="scan-label" class="scan-label" role="status" aria-live="polite">Tap Start scanning to begin</div><div id="scan-last" class="scan-last" aria-live="polite">Aim your card inside the green frame. OCR reads the lower code.</div><div class="row wrap mt16"><button id="scan-start" class="btn btn-primary" data-action="scan-start">▣ Start scanning</button><button id="scan-stop" class="btn btn-ghost" data-action="scan-stop" disabled>■ Stop</button><button class="btn btn-ghost" data-action="scan-next" id="scan-next" disabled>↻ Next identical card</button></div><div class="scanner-controls mt16"><label class="form-field"><span>Scanning speed</span><select class="select" id="scan-speed"><option value="fast" ${scanner.speed==='fast'?'selected':''}>Fast · quicker recognition</option><option value="steady" ${scanner.speed==='steady'?'selected':''}>Steady · double-check codes</option></select></label><label class="form-field"><span>Finish detection</span><select class="select" id="scan-finish-mode"><option value="auto" ${scanner.finishMode==='auto'?'selected':''}>Auto-detect (review when uncertain)</option><option value="manual" ${scanner.finishMode==='manual'?'selected':''}>Manual finish</option></select></label><label class="form-field" id="scan-manual-finish" style="${scanner.finishMode==='manual'?'':'display:none'}"><span>Add each scan as</span><select class="select" id="scan-finish"><option value="Normal" ${scanner.finish==='Normal'?'selected':''}>Non-foil</option><option value="Foil" ${scanner.finish==='Foil'?'selected':''}>Foil</option></select></label></div><div id="scan-review" aria-live="polite"></div><p class="help-copy mt16"><strong>Scan tips:</strong> Put the bottom-left code inside the guide and keep the card sharp and close enough to read the tiny letters. If the code includes <b>a</b>, it will be recorded as Foil automatically. <strong>Other foil tips:</strong> Keep the card inside the outline and gently tilt it left and right under steady light. Fast mode accepts high-confidence collector-code matches sooner, while Steady mode requires two readings. If the card has an alternate-art code, the app will ask you to choose the correct artwork when OCR cannot see the tiny letter. The scanner looks for changing colourful reflections, not just brightness. Sleeves and glare can mislead detection; any uncertain finish needs your confirmation. Move each card away before showing the next identical copy.</p></div><aside><div class="scanner-counter mb18"><div><div class="muted small">CARDS THIS SESSION</div><strong id="scan-counter">${scanner.sessionCount}</strong></div><span style="font-size:25px;color:var(--accent)">✓</span></div><div class="panel mb18"><div class="panel-heading"><div><h3>Recent scans</h3><span class="muted micro">This visit · clears when the app is reopened</span></div><button class="btn btn-small btn-ghost" data-nav="history">Full history ↗</button></div><div id="scan-history" class="scan-history-list">${renderRecentScans()}</div></div><div class="panel"><h3>How it works</h3><div class="scan-step"><b>1</b><span>Keep the camera pointed at one card at a time.</span></div><div class="scan-step"><b>2</b><span>OCR reads standard codes and Rune codes (such as RAD-R03a), then checks reflected colours as you tilt.</span></div><div class="scan-step"><b>3</b><span>Clear results add a copy; uncertain finishes require a one-tap choice.</span></div><div class="scan-step"><b>4</b><span>Remove the card before presenting the next copy. Review Recent scans to Undo.</span></div></div></aside></div>${!catalogReady?`<div class="warning-list mt16"><strong>Full catalogue not loaded.</strong> A starter catalogue is available, including Radiance runes; refresh online for complete card artwork. Connect to the internet, then <button class="btn btn-small" data-action="refresh-catalog">refresh card data</button> before scanning.</div>`:''}<div class="info-note mt16"><strong>Experimental feature:</strong> Foil suggestions use an on-device visual heuristic, not a trained card classifier. It may confuse glossy sleeves, glare and foil treatments. Check the finish shown after every scan. The camera requires HTTPS or localhost; frames are not uploaded by RiftVault.</div>`;}
function renderRecentScans(){
 const scans=state.activity.filter(a=>a.kind==='scan'&&recentVisitIds.has(a.id)).slice(0,7);
 return scans.length?scans.map(a=>{
  const info=a.key?unpackKey(a.key):{id:'',finish:'Normal'};
  const card=getMeta(info.id),finish=info.finish;
  const changeTo=finish==='Foil'?'Non-foil':'Foil';
  const canEdit=!!a.key&&bulkQty(a.key)>0;
  return `<div class="scan-history-item">
    ${scanThumbnail(a)}
    <div class="item-main">
      <strong>${escapeHtml(card.name)}</strong>
      <small>${escapeHtml(card.code)} · ${escapeHtml(finish==='Foil'?'Foil':'Non-foil')}${card.isAltArt?' · Alt art':''} · ${escapeHtml(new Date(a.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</small>
      <div class="row wrap mt8 scan-history-buttons">
        <button class="btn btn-small btn-ghost" data-action="correct-scan-printing" data-activity="${escapeHtml(a.id)}" ${canEdit?'':'disabled'}>↔ Artwork</button>
        <button class="btn btn-small btn-ghost" data-action="correct-scan-finish" data-activity="${escapeHtml(a.id)}" ${canEdit?'':'disabled'}>↔ ${changeTo}</button>
        <button class="btn btn-small btn-ghost" data-action="undo-scan" data-activity="${escapeHtml(a.id)}" ${canEdit?'':'disabled'}>Undo</button>
      </div>
    </div>
  </div>`;
 }).join(''):`<div class="recent-empty"><span aria-hidden="true">▣</span><strong>Ready for a fresh session</strong><small>New scans appear here with their card images. Older scans are safely kept in Full history.</small></div>`;
}
function renderSettings(){return `<div class="mb24"><h2>Settings, exports & backups</h2><p class="muted small">Keep a second copy of your collection before clearing browser data or changing devices.</p></div><div class="settings-grid"><div class="settings-box"><div class="eyebrow">SPREADSHEET EXPORT</div><h3>Export to Excel</h3><p>Download a real .xlsx workbook containing inventory, physical locations, deck requirements and a collection summary.</p><button class="btn btn-primary" data-action="excel">↧ Download .xlsx</button></div><div class="settings-box"><div class="eyebrow">COMPLETE BACKUP</div><h3>Back up your full app</h3><p>A JSON backup saves cards, storage, decks and your recorded Bilgewater price snapshots for restoring later.</p><div class="row wrap"><button class="btn btn-primary" data-action="backup">↧ Download JSON</button><button class="btn" data-action="restore">↥ Restore JSON</button></div></div><div class="settings-box"><div class="eyebrow">CARD DATABASE</div><h3>Riftbound card catalogue</h3><p>${escapeHtml(statusNote())}. The app retrieves card names, printing numbers, rarity and images from a public community dataset.</p><button class="btn" data-action="refresh-catalog">↻ Refresh card catalogue</button><p class="micro">Source: <a href="https://github.com/slimtreble/Riftbound-card-data" target="_blank" rel="noopener noreferrer">Riftbound-card-data (GitHub)</a>.</p></div><div class="settings-box"><div class="eyebrow">PRIVACY & DEVICE</div><h3>How your cards are stored</h3><p>Your inventory lives in this browser's local storage, not in an online account. It will not automatically sync to your other devices or update an Excel file on OneDrive.</p><p>OCR uses the camera and an OCR library loaded from a CDN when you start scanning. Clear browser/site data may erase the collection. Export JSON backups regularly.</p></div></div><div class="panel mt24"><h3>Data management</h3><p class="muted small">Reset removes all inventories and decks from this browser. Export a JSON backup first if needed.</p><button class="btn btn-danger" data-action="reset-data">Reset collection and decks</button></div>`;}
function modalShell(title,subtitle,body,footer='',wide=false){return `<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-head"><div><h2>${escapeHtml(title)}</h2>${subtitle?`<div class="muted small">${escapeHtml(subtitle)}</div>`:''}</div><button class="btn btn-icon btn-ghost" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-content">${body}</div>${footer?`<div class="modal-foot">${footer}</div>`:''}</section></div>`;}
function renderModal(){const root=document.getElementById('modal-root');if(!ui.modal){root.innerHTML='';return;}let html='';if(ui.modal.type==='card'){const name=ui.modal.name;const prints=printingsFor(name),p=prints.find(x=>x.id===ui.modal.printingId)||prints[0]||getNamesForSearch().find(x=>normalizeName(x.name)===normalizeName(name))?.defaultPrint;const locations=locationSummary(name);const rows=prints.length?prints.map(v=>{let normal=keyFor(v.id,'Normal'),foil=keyFor(v.id,'Foil');return `<div class="variant-row"><div class="variant-info"><strong>${escapeHtml(v.code||v.id)} · ${escapeHtml(v.setName)}${v.isAltArt?' · Alt art':''}</strong><span>${escapeHtml(v.rarity)} · Normal ${ownedQty(normal)} / Foil ${ownedQty(foil)} owned</span></div><div class="variant-actions"><select class="mini-select" data-card-finish="${escapeHtml(v.id)}">${isFoilOnlyAlternate(v)?'<option value="Foil">Foil only</option>':'<option value="Normal">Normal</option><option value="Foil">Foil</option>'}</select><button class="btn btn-small btn-green-outline" data-action="add-from-detail" data-id="${escapeHtml(v.id)}">＋ Bulk</button></div></div>`}).join(''):'<p class="muted small">No known printings found in the catalogue.</p>';html=modalShell(name,`${stockForName(name)} owned • ${stockForName(name,true)} in Bulk`, `<div class="detail-layout"><div class="detail-image" style="display:grid;place-items:center">${cardArt(p||{})}</div><div><div class="eyebrow">WHERE ARE MY CARDS?</div><div class="mt16">${locations.length?locations.map(r=>`<div class="location-row"><div><strong>${escapeHtml(r.name)}</strong><div class="muted micro">${escapeHtml(r.description)}</div></div><strong>${r.qty}</strong></div>`).join(''):`<div class="muted small">None owned yet. Add a printing below to start your inventory.</div>`}</div></div></div><h3 class="mt24">Add a specific printing to Bulk</h3><p class="muted small">Select normal or foil before adding. Separate printings are tracked independently.</p>${rows}`,`<button class="btn" data-action="close-modal">Close</button>`,true);}
else if(ui.modal.type==='import'){const parsed=parseDeckText(ui.importText);const bySection=SECTIONS.map(s=>[s,parsed.entries.filter(e=>e.section===s).reduce((sum,e)=>sum+e.required,0)]).filter(([,q])=>q);html=modalShell(ui.modal.into?'Replace deck requirements':'Import a TXT decklist','RiftAtlas-style Legend / Champion / MainDeck / Battlefields / Runes / Sideboard',`<label class="form-field"><span>Deck name</span><input id="import-deck-name" class="input" value="${escapeHtml(ui.importName)}" placeholder="e.g. Jinx Aggro" /></label><div class="form-field"><span>Upload a .txt file</span><div class="upload-area"><input id="deck-file" class="file-input" type="file" accept=".txt,text/plain" /></div></div><label class="form-field"><span>Or paste your decklist here</span><textarea id="import-deck-text" class="textarea" rows="10" spellcheck="false" placeholder="Legend:&#10;1 Jinx, Loose Cannon&#10;...">${escapeHtml(ui.importText)}</textarea></label><div class="row-between mb12 wrap"><span class="muted small">${parsed.entries.length} card lines recognised • ${parsed.total} copies required</span><button class="btn btn-small btn-ghost" data-action="sample-txt">Use Jinx example</button></div>${bySection.length?`<div class="import-preview">${bySection.map(([s,n])=>`<strong>${escapeHtml(SECTION_LABEL[s])}</strong> — ${n} copies`).join('<br>')}</div>`:''}${parsed.errors.length?`<div class="warning-list mt16"><strong>${parsed.errors.length} unrecognised line(s):</strong><ul>${parsed.errors.slice(0,6).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}${ui.modal.into?`<div class="warning-list mt16">Replacing requirements will return currently allocated cards for this deck to Bulk. The new TXT will not auto-assign them.</div>`:''}`,`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-import" ${!parsed.entries.length?'disabled':''}>${ui.modal.into?'Replace requirements':'Create deck'} · ${parsed.total} cards</button>`,true);}
else if(ui.modal.type==='add-card'){const candidates=getNamesForSearch();html=modalShell('Add a card to your deck',findDeck(ui.deckId)?.name||'',`<label class="form-field"><span>Card name</span><input id="add-card-name" class="input" value="${escapeHtml(ui.addCardQuery)}" list="all-card-names" placeholder="e.g. Flame Chompers" autocomplete="off"/><datalist id="all-card-names">${candidates.slice(0,2000).map(g=>`<option value="${escapeHtml(g.name)}"></option>`).join('')}</datalist><div class="form-hint">You can type any card name, even if it is not in the local catalogue.</div></label><div class="row mb12"><label class="form-field" style="flex:1"><span>Deck section</span><select id="add-card-section" class="select w100">${SECTIONS.map(s=>`<option value="${s}" ${ui.addCardSection===s?'selected':''}>${escapeHtml(SECTION_LABEL[s])}</option>`).join('')}</select></label><label class="form-field" style="width:100px"><span>Quantity</span><input id="add-card-qty" class="input" type="number" min="1" max="99" value="${ui.addCardQuantity}" /></label></div>`,`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-add-card">Add requirement</button>`);}
else if(ui.modal.type==='edit-entry'){const deck=findDeck(ui.deckId);const e=deck?.entries.find(e=>e.id===ui.modal.entryId);if(e){html=modalShell('Edit deck requirement',deck.name,`<label class="form-field"><span>Card name</span><input id="edit-card-name" class="input" value="${escapeHtml(requirementName(e))}" /></label><div class="row mb12"><label class="form-field" style="flex:1"><span>Deck section</span><select id="edit-card-section" class="select w100">${SECTIONS.map(sec=>`<option value="${sec}" ${e.section===sec?'selected':''}>${escapeHtml(SECTION_LABEL[sec])}</option>`).join('')}</select></label><label class="form-field" style="width:100px"><span>Quantity needed</span><input id="edit-card-qty" class="input" type="number" min="1" max="500" value="${e.required}" /></label></div><p class="help-copy">If you change the card name, allocated copies will return to Bulk. Reducing the quantity will return any surplus allocated copies.</p>`,`<button class="btn btn-danger" data-action="remove-requirement">Remove</button><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-requirement">Save changes</button>`);}}
else if(ui.modal.type==='swap-deck'){
  const deck=findDeck(ui.modal.deckId),entry=deck?.entries.find(e=>e.id===ui.modal.entryId);
  if(deck&&entry){
   const sources=Object.entries(deck.allocations?.[entry.id]||{}).filter(([,qty])=>Number(qty)>0);
   const destinations=ownedKeysByName(entry.name,'',entry.section).filter(key=>bulkQty(key)>0);
   const option=(key,qty)=>{const meta=getMeta(unpackKey(key).id);return `${meta.code||meta.id} · ${meta.isAltArt?'Alt art':'Regular'} · ${unpackKey(key).finish}${qty!==null?' · '+qty+' available':''}`;};
   html=modalShell('Swap assigned card',`${deck.name} · ${requirementName(entry)}`,`<p class="muted small">Exchange one assigned physical copy for another copy of the same card <strong>already in Bulk</strong>. Choose a different foil finish, artwork or set. Total ownership stays unchanged.</p><label class="form-field"><span>Return this assigned copy to Bulk</span><select id="deck-swap-from" class="select w100">${sources.map(([key,qty])=>`<option value="${escapeHtml(key)}">${escapeHtml(option(key,null))} ×${Number(qty)} in deck</option>`).join('')}</select></label><label class="form-field"><span>Assign this available copy instead</span><select id="deck-swap-to" class="select w100">${destinations.map(key=>`<option value="${escapeHtml(key)}">${escapeHtml(option(key,bulkQty(key)))}</option>`).join('')}</select></label>${destinations.length?'':'<div class="info-note">No other copies of this card are available in Bulk. Return a copy from another deck or scan one first.</div>'}`,`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="swap-deck-save" ${destinations.length?'':'disabled'}>Swap one copy</button>`);
  }
 }
 else if(ui.modal.type==='confirm'){html=modalShell(ui.modal.title||'Are you sure?',ui.modal.subtitle||'',`<p class="help-copy">${escapeHtml(ui.modal.message)}</p>`,`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-danger" data-action="confirm-danger">${escapeHtml(ui.modal.button||'Confirm')}</button>`);}
else if(ui.modal.type==='correct-printing'){
 const oldKey=ui.modal.key,old=unpackKey(oldKey),source=getMeta(old.id),opts=siblingPrintings(source);
 html=modalShell('Correct card printing',`${source.name} · ${old.finish}`,`<p class="muted small">Move <strong>one available Bulk copy</strong> to the correct artwork. Other copies, decks and storage remain unchanged.</p><div class="printing-choices">${opts.map(card=>`<button class="printing-choice" data-action="save-correct-printing" data-id="${escapeHtml(card.id)}" ${card.id===old.id?'disabled':''}>${cardArt(card)}<span><strong>${escapeHtml(card.code)}</strong><small>${escapeHtml(printingLabel(card))} · ${escapeHtml(card.rarity)}</small></span></button>`).join('')}</div>`,`<button class="btn" data-action="close-modal">Cancel</button>`);
}
root.innerHTML=html;}

function correctPrintingOne(oldKey,newId,activityId=null){
 const old=unpackKey(oldKey),source=getMeta(old.id),target=getMeta(newId);
 if(!target?.id||!source?.id||normalizeName(source.name)!==normalizeName(target.name)||source.set!==target.set||bulkQty(oldKey)<1)return false;
 const targetFinish=isFoilOnlyAlternate(target)?'Foil':old.finish;
 const targetKey=keyFor(target.id,targetFinish);
 if(targetKey===oldKey)return false;
 state.stock[oldKey]=ownedQty(oldKey)-1;
 if(!state.stock[oldKey])delete state.stock[oldKey];
 state.stock[targetKey]=ownedQty(targetKey)+1;
 state.printings[target.id]=createMeta(target);
 let activity=activityId?state.activity.find(x=>x.id===activityId&&x.kind==='scan'):null;
 if(activity){activity.key=targetKey;activity.message=`Scanned ${target.name} (${target.code})${target.isAltArt?' [Alternate Art]':''} • ${targetFinish==='Foil'?'Foil':'Non-foil'} [printing corrected]`;}
 logActivity(`Corrected 1 × ${source.name}: ${source.code} → ${target.code}`,targetKey,'correction');
 save();return true;
}
function showModal(type,extra={}){ui.modal={type,...extra};renderModal();}
function closeModal(){scanner.deckNotice=false;ui.modal=null;renderModal();}
function requirementName(entry){const p=eligiblePrintings(entry).find(p=>entry.section!=='Legend'||normalizeName(p.type)==='legend');return p?.name||entry.name;}
function deckText(deck){return SECTIONS.filter(s=>deck.entries.some(e=>e.section===s)).map(s=>`${s}:\n${deck.entries.filter(e=>e.section===s).map(e=>`${e.required} ${requirementName(e)}${e.code?' ('+e.code+')':''}`).join('\n')}`).join('\n\n')+'\n';}
// Lightweight native XLSX writer: four sheets, no online spreadsheet dependency.
const enc=new TextEncoder();
function xml(s){return escapeHtml(String(s??''));}
function colName(n){let out='';for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;}
function sheetXml(rows){let cols=Math.max(1,...rows.map(r=>r.length));let body=rows.map((r,ri)=>`<row r="${ri+1}">${r.map((value,ci)=>{if(value===null||value===undefined||value==='')return '';let cell=colName(ci)+(ri+1);if(typeof value==='number'&&Number.isFinite(value))return `<c r="${cell}"><v>${value}</v></c>`;return `<c r="${cell}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('');return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${colName(cols-1)}${Math.max(1,rows.length)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="17"/><sheetData>${body}</sheetData></worksheet>`;}
let crcTable=null;
function crc32(bytes){if(!crcTable){crcTable=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=(n&1)?(0xedb88320^(n>>>1)):(n>>>1);return n>>>0;});}let c=0xffffffff;for(let b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function uint16(b,o,v){b[o]=v&255;b[o+1]=(v>>>8)&255;}
function uint32(b,o,v){uint16(b,o,v);uint16(b,o+2,v>>>16);}
function zipStore(files){const chunks=[],central=[];let offset=0;const write=(bytes)=>{chunks.push(bytes);offset+=bytes.length;};for(const [fileName,data] of files){const name=enc.encode(fileName),bytes=enc.encode(data),crc=crc32(bytes),localOff=offset;const header=new Uint8Array(30+name.length);uint32(header,0,0x04034b50);uint16(header,4,20);uint16(header,6,0x800);uint16(header,8,0);uint32(header,14,crc);uint32(header,18,bytes.length);uint32(header,22,bytes.length);uint16(header,26,name.length);header.set(name,30);write(header);write(bytes);const c=new Uint8Array(46+name.length);uint32(c,0,0x02014b50);uint16(c,4,20);uint16(c,6,20);uint16(c,8,0x800);uint16(c,10,0);uint32(c,16,crc);uint32(c,20,bytes.length);uint32(c,24,bytes.length);uint16(c,28,name.length);uint32(c,42,localOff);c.set(name,46);central.push(c);}const centralStart=offset;for(const c of central)write(c);const end=new Uint8Array(22);uint32(end,0,0x06054b50);uint16(end,8,central.length);uint16(end,10,central.length);uint32(end,12,offset-centralStart);uint32(end,16,centralStart);write(end);return new Blob(chunks,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
function xlsxBlob(sheets){const files=[];const ct=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;files.push(['[Content_Types].xml',ct]);files.push(['_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);files.push(['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`]);files.push(['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`]);sheets.forEach((s,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,sheetXml(s.rows)]));return zipStore(files);}
function exportExcel(){const inventory=[['Card code','Card name','Set','Rarity','Finish','Total owned','Bulk','Assigned to decks']];for(const e of ownedEntries())inventory.push([e.card.code,e.card.name,e.card.setName,e.card.rarity,e.finish,e.qty,e.bulk,e.qty-e.bulk]);const locations=[['Card code','Card name','Finish','Location','Copies','Section']];for(const e of ownedEntries()){if(e.bulk)locations.push([e.card.code,e.card.name,e.finish,'Bulk',e.bulk,'']);for(const d of state.decks){for(const entry of d.entries){const qty=Number(d.allocations?.[entry.id]?.[e.key]||0);if(qty)locations.push([e.card.code,e.card.name,e.finish,d.name,qty,SECTION_LABEL[entry.section]]);}}}const requirements=[['Deck','Section','Card name','Collector code (if specified)','Required','Assigned','Still missing','Available in Bulk','In other decks']];for(const d of state.decks)for(const e of d.entries)requirements.push([d.name,SECTION_LABEL[e.section],e.name,e.code||'',e.required,entryAssigned(d,e),Math.max(0,e.required-entryAssigned(d,e)),entryBulk(e),entryElsewhere(e,d)]);const summary=[['RiftVault collection summary','Value'],['Exported at',new Date().toISOString()],['Total owned copies',totalOwned()],['Unique card names',uniqueOwned()],['Copies in Bulk',totalBulk()],['Copies in decks',totalOwned()-totalBulk()-totalStorage()],['Saved decks',state.decks.length],[],['Notes','Assignments are included in Total owned, not additional copies.'],['Notes','Imported deck requirements do not imply ownership.'],['Notes','Source: https://github.com/slimtreble/Riftbound-card-data']];const blob=xlsxBlob([{name:'Summary',rows:summary},{name:'Inventory',rows:inventory},{name:'Locations',rows:locations},{name:'Deck requirements',rows:requirements}]);download('RiftVault-Inventory-'+new Date().toISOString().slice(0,10)+'.xlsx',blob,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('Excel workbook exported: Inventory, Locations, Deck requirements & Summary.');}
function exportBackup(){download('RiftVault-Backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({type:'RiftVaultBackup',exportedAt:new Date().toISOString(),data:state,bilgewaterPrices:bilgewaterPrices},null,2),'application/json');localStorage.setItem('riftvault-last-backup',new Date().toISOString());toast('Full collection backup exported.');render();}
async function restoreJson(file){if(!file)return;let raw;try{raw=JSON.parse(await file.text());let s=raw.type==='RiftVaultBackup'?raw.data:raw;if(!s||!s.stock||!s.printings||!Array.isArray(s.decks)||typeof s.stock!=='object'||typeof s.printings!=='object')throw new Error('Not a RiftVault backup');if(!confirm('Replace your current collection and all decks with this backup?'))return;if(raw.type==='RiftVaultBackup'&&raw.bilgewaterPrices&&typeof raw.bilgewaterPrices==='object'&&!Array.isArray(raw.bilgewaterPrices)){bilgewaterPrices=raw.bilgewaterPrices;saveBilgewaterPrices();}state={...blankState(),...s,locationNames:Array.isArray(s.locationNames)?s.locationNames:[],extraLocations:s.extraLocations&&typeof s.extraLocations==='object'?s.extraLocations:{},manualWishlist:s.manualWishlist&&typeof s.manualWishlist==='object'?s.manualWishlist:{}};save();rebuildIndexes();render();toast('Backup restored successfully.');}catch(e){toast('Could not restore JSON: '+e.message,true);}}

// Hands-free OCR. Video and OCR remain local to the browser; images are not uploaded by this code.
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function setScanStatus(message,badge){const label=document.getElementById('scan-label'),b=document.getElementById('scan-running-badge');if(label)label.textContent=message;if(b&&badge)b.textContent=badge;}
function updateScanUI(){const start=document.getElementById('scan-start'),stop=document.getElementById('scan-stop'),next=document.getElementById('scan-next'),counter=document.getElementById('scan-counter'),history=document.getElementById('scan-history'),box=document.getElementById('camera-box'),placeholder=document.getElementById('camera-placeholder'),review=document.getElementById('scan-review');if(start){start.disabled=scanner.running||scanner.starting;start.textContent=scanner.starting?'Starting camera...':'▣ Start scanning';}if(stop)stop.disabled=!(scanner.running||scanner.starting);if(next)next.disabled=!scanner.running||!!scanner.pending;if(counter)counter.textContent=scanner.sessionCount;if(history)history.innerHTML=renderRecentScans();if(box)box.classList.toggle('active',scanner.running);if(placeholder)placeholder.style.display=scanner.running?'none':'';if(review){
 const p=scanner.pending;
 if(!p){review.innerHTML='';}
 else if(p.reviewType==='printing'){
  review.innerHTML=`<section class="finish-review" role="group" aria-label="Confirm artwork printing"><div class="eyebrow">CHECK PRINTING</div><h3>${escapeHtml(p.card.name)}</h3><p class="small">OCR read ${escapeHtml(p.card.code)}, but the small letter after the number can be missed. Look at the bottom-left printed code and choose the matching artwork.</p><div class="printing-choices">${p.choices.map(card=>`<button class="printing-choice" data-action="choose-printing" data-id="${escapeHtml(card.id)}">${cardArt(card)}<span><strong>${escapeHtml(card.code)}</strong><small>${escapeHtml(printingLabel(card))} · ${escapeHtml(card.rarity)}</small></span></button>`).join('')}</div><button class="btn btn-ghost btn-small mt12" data-action="finish-skip">Skip card</button></section>`;
 }else{
  review.innerHTML=`<section class="finish-review" role="group" aria-label="Confirm scanned card finish"><div class="eyebrow">FINISH NEEDS CONFIRMATION</div><h3>${escapeHtml(p.card.name)}</h3><p class="muted small">${escapeHtml(p.card.code)}${p.card.isAltArt?' · Alternate Art':''} • ${escapeHtml(p.reason)}</p><p class="small"><strong>Suggested:</strong> ${escapeHtml(p.guess==='Foil'?'Foil':'Non-foil')} · Not reliable enough to add automatically.</p><div class="row wrap"><button class="btn btn-primary" data-action="finish-confirm-normal">✓ Non-foil</button><button class="btn btn-green-outline" data-action="finish-confirm-foil">✦ Foil</button><button class="btn btn-ghost" data-action="finish-skip">Skip card</button></div></section>`;
 }
}}
function loadScript(url){return new Promise((resolve,reject)=>{if(window.Tesseract)return resolve();let script=document.createElement('script');script.src=url;script.onload=()=>window.Tesseract?resolve():reject(new Error('OCR library did not initialise'));script.onerror=()=>reject(new Error('OCR library download failed; internet connection required'));document.head.appendChild(script);});}
async function startScanner(){if(scanner.running||scanner.starting)return;if(!navigator.mediaDevices?.getUserMedia){toast('This browser cannot access the camera. Open the app using HTTPS or localhost.',true);return;}scanner.starting=true;const startToken=++scanner.loopToken;scanner.sessionCount=0;scanner.sessionId=uid();scanner.latchedCode=null;scanner.lastCandidate=null;scanner.stable=0;scanner.missed=0;scanner.pending=null;scanner.deckNotice=false;scanner.foilCode=null;scanner.foilSamples=[];scanner.acceptedHash=null;scanner.ocrCycles=0;scanner.lastSuccess=null;const last=document.getElementById('scan-last');if(last){last.classList.remove('is-success');last.textContent='Reading the bottom-left code (including tiny a suffix)';}updateScanUI();setScanStatus('Requesting rear camera…','● Starting');let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}}});if(startToken!==scanner.loopToken){stream.getTracks().forEach(t=>t.stop());return;}scanner.stream=stream;const video=document.getElementById('scan-video');if(!video)throw new Error('Scanner closed');scanner.video=video;video.srcObject=stream;await video.play();if(startToken!==scanner.loopToken)return;setScanStatus('Loading OCR recognition engine…','● Preparing');await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');if(startToken!==scanner.loopToken)return;const worker=await Tesseract.createWorker('eng',1,{logger:()=>{}});if(startToken!==scanner.loopToken){await worker.terminate();return;}scanner.worker=worker;await scanner.worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- /•.*'});if(startToken!==scanner.loopToken)return;scanner.starting=false;scanner.running=true;scanner.foilTimer=setInterval(()=>{if(!scanner.running||scanner.loopToken!==startToken||!scanner.foilCode||scanner.pending||scanner.latchedCode)return;try{const sample=readFoilFrame();if(sample){scanner.foilSamples.push(sample);if(scanner.foilSamples.length>30)scanner.foilSamples.shift();}}catch(e){}},135);updateScanUI();setScanStatus('Hold card steady and tilt gently to reveal the finish','● Live OCR active');scanLoop(startToken);}catch(e){if(startToken!==scanner.loopToken)return;console.error(e);toast('Scanner could not start: '+e.message,true);await stopScanner();}}
async function stopScanner(){scanner.running=false;scanner.starting=false;scanner.loopToken++;if(scanner.foilTimer){clearInterval(scanner.foilTimer);scanner.foilTimer=null;}if(scanner.flashTimeout){clearTimeout(scanner.flashTimeout);scanner.flashTimeout=null;}document.getElementById('camera-box')?.classList.remove('scan-succeeded');scanner.pending=null;scanner.foilCode=null;scanner.foilSamples=[];if(scanner.stream){for(const track of scanner.stream.getTracks())track.stop();scanner.stream=null;}if(scanner.video){scanner.video.srcObject=null;scanner.video=null;}if(scanner.worker){const w=scanner.worker;scanner.worker=null;try{await w.terminate();}catch(e){}}scanner.latchedCode=null;scanner.lastCandidate=null;scanner.stable=0;updateScanUI();setScanStatus('Scanner stopped','● Camera off');}
// Convert the *visible* card guide into source-video pixels. CSS uses object-fit: cover,
// so assuming a fixed camera crop would scan the wrong area on portrait phones.
function guideSourceRect(){
 const v=scanner.video, box=document.getElementById('camera-box'),guide=box?.querySelector('.scan-guide');
 if(!v||!v.videoWidth||!v.videoHeight||!box||!guide)throw new Error('Camera warming up');
 const vw=v.videoWidth,vh=v.videoHeight,bw=box.clientWidth,bh=box.clientHeight;
 const scale=Math.max(bw/vw,bh/vh),offX=(bw-vw*scale)/2,offY=(bh-vh*scale)/2;
 const br=box.getBoundingClientRect(),gr=guide.getBoundingClientRect();
 const x=(gr.left-br.left-offX)/scale,y=(gr.top-br.top-offY)/scale,w=gr.width/scale,h=gr.height/scale;
 return {x:Math.max(0,Math.min(vw-1,x)),y:Math.max(0,Math.min(vh-1,y)),w:Math.max(1,Math.min(vw-x,w)),h:Math.max(1,Math.min(vh-y,h))};
}
function reuseScanCanvas(kind,w,h){
 const key=kind==='fp'?'hashCanvas':'cropCanvas';const canvas=scanner[key]||(scanner[key]=document.createElement('canvas'));
 if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;return canvas;
}
function guideFingerprint(bounds){
 const c=reuseScanCanvas('fp',16,16),ctx=c.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(scanner.video,bounds.x,bounds.y,bounds.w,bounds.h,0,0,16,16);
 const data=ctx.getImageData(0,0,16,16).data,fp=[];
 for(let i=0;i<data.length;i+=4)fp.push((data[i]+data[i+1]+data[i+2])/765);
 return fp;
}
function frameForOCR(mode='code'){
 // The collector ID is very small in the lower-left corner; crop that region
 // at higher resolution rather than wasting OCR work on illustration and card text.
 const bounds=guideSourceRect();
 const wide=mode===true||mode==='wide';
 const invert=mode==='invert';
 const band=wide?{left:0,top:.62,width:1,height:.38}:{left:0,top:.805,width:.79,height:.19};
 const sx=bounds.x+bounds.w*band.left,sy=bounds.y+bounds.h*band.top,
       sw=bounds.w*band.width,sh=bounds.h*band.height;
 const zoom=Math.max(1.5,Math.min(wide?2.6:4.0,1040/sw,320/sh));
 const pad=16,tw=Math.max(160,Math.round(sw*zoom)),th=Math.max(44,Math.round(sh*zoom));
 const canvas=reuseScanCanvas('ocr',tw+pad*2,th+pad*2),ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.save();ctx.fillStyle=invert?'#0a0a0a':'#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.filter=invert?'grayscale(1) invert(1) contrast(2.05)':'grayscale(1) contrast(1.8) brightness(1.2)';
 ctx.drawImage(scanner.video,sx,sy,sw,sh,pad,pad,tw,th);ctx.restore();
 return {canvas,fp:guideFingerprint(bounds)};
}
function diffHash(a,b){if(!a||!b||a.length!==b.length)return 0;let diff=0;for(let i=0;i<a.length;i++)diff+=Math.abs(a[i]-b[i]);return diff/a.length;}
function matchOCR(text){
 const upper=String(text||'').toUpperCase().replace(/[|]/g,'/').replace(/[•·]/g,' ');
 // RAD promo collectors SP1..SP5 and tokens T01 must be scanned as their
 // own printings, never confused with a regular 001/167 card.
 const specialRx=/\b([A-Z]{3,5})[\s.:-]*((?:SP[\s.:-]*[0-9]{1,2}|T[\s.:-]*[0-9]{1,2}(?:[\s.:-]*SC)?))[\s.:-]*([A-Z])?(?![A-Z0-9])/g;
 let special;
 while((special=specialRx.exec(upper))){
  const collector=special[2].replace(/[\s.:-]/g,'').replace(/^T([0-9])(?![0-9])/,'T0$1');
  const k=special[1]+collector+(special[3]||'');
  if(codeIndex.has(k))return codeIndex.get(k);
  if(codeIndex.has(special[1]+collector))return codeIndex.get(special[1]+collector);
 }
 // Rune collector numbers are R01...R06, optionally followed by the alt-art letter.
 // Printed formats include RAD • R03 • EN and RAD • R03a • EN.
 const runeRx=/\b([A-Z]{3,5})[\s.:-]*[Rr][\s.:-]*0?([1-6])\s*([A-Z])?(?![A-Z0-9])/g;
 let rm;const runeMatches=[];
 while((rm=runeRx.exec(upper))){
  const code=rm[1]+'R0'+rm[2]+(rm[3]||'');
  const match=codeIndex.get(code);
  if(match&&normalizeName(match.type)==='rune')runeMatches.push({card:match,exact:!!rm[3]});
 }
 if(runeMatches.length){runeMatches.sort((a,b)=>Number(b.exact)-Number(a.exact));return runeMatches[0].card;}
 const rx=/\b([A-Z0-9]{2,5})[\s.:-]*([0-9]{1,3})(?:\s*([A-Z*]))?\s*(?:\/\s*\d{2,4})?/g;
 let m;const matches=[];
 while((m=rx.exec(upper))){
  const set=m[1].replace(/^0GN$/,'OGN'),num=m[2].padStart(3,'0'),suffix=m[3]||'';
  const precise=codeIndex.get(set+num+suffix);
  // If OCR claims a suffix that does not exist, do not silently believe it.
  const base=codeIndex.get(set+num);
  const p=precise||(!suffix?base:null);
  if(p)matches.push({card:p,explicitSuffix:Boolean(suffix&&precise)});
 }
 // OCR occasionally joins the set and number (e.g. SFD088A/221).
 if(!matches.length){
  const joined=/(?:^|[^A-Z0-9])([A-Z]{3})([0-9]{3})([A-Z*]?)/g;
  let compact;
  while((compact=joined.exec(upper))){
   const exact=codeIndex.get(compact[1]+compact[2]+(compact[3]||''));
   if(exact)matches.push({card:exact,explicitSuffix:Boolean(compact[3])});
  }
 }
 matches.sort((a,b)=>Number(b.explicitSuffix)-Number(a.explicitSuffix));
 return matches[0]?.card||null;
}

function beep(){try{let AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;let ctx=new AC(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=780;osc.type='sine';gain.gain.setValueAtTime(.06,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.16);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.17);osc.onended=()=>ctx.close();}catch(e){}try{navigator.vibrate?.(70);}catch(e){}}
// Experimental foil detection uses brightness-normalised RGB changes inside the card art.
// It is deliberately conservative: ambiguous results pause for an explicit finish choice.
function readFoilFrame(){const v=scanner.video;if(!v||!v.videoWidth||!v.videoHeight)return null;const c=document.createElement('canvas');c.width=24;c.height=36;const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)return null;const r=guideSourceRect();ctx.drawImage(v,r.x+r.w*.22,r.y+r.h*.18,r.w*.56,r.h*.55,0,0,c.width,c.height);const data=ctx.getImageData(0,0,c.width,c.height).data;const chroma=[],brightness=[],saturation=[];let mean=0,colouredBright=0,highlights=0;for(let i=0;i<data.length;i+=4){const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),v=.2126*r+.7152*g+.0722*b,s=hi>0?(hi-lo)/hi:0;brightness.push(v);saturation.push(s);chroma.push(r-g,g-b);mean+=v;if(hi>.72&&s>.19)colouredBright++;if(v>.79)highlights++;}return {at:Date.now(),mean:mean/brightness.length,brightness,chroma,saturation,colouredBright:colouredBright/brightness.length,highlights:highlights/brightness.length};}
function evaluateFoilSamples(samples){if(!Array.isArray(samples)||samples.length<8)return {finish:null,confidence:'low',guess:'Normal',reason:'Not enough camera samples yet'};const picked=samples.filter((_,i)=>i%2===0),duration=samples[samples.length-1].at-samples[0].at;if(duration<700)return {finish:null,confidence:'low',guess:'Normal',reason:'Tilt the card gently for a moment'};let vivid=0,hotspots=0,chromatic=0,motion=0,pairs=0;const N=picked[0].brightness.length;for(let j=1;j<picked.length;j++){const a=picked[j-1],b=picked[j];let c=0,m=0,spots=0;for(let i=0;i<N;i++){const dc=Math.abs((b.chroma[2*i]-a.chroma[2*i]))+Math.abs((b.chroma[2*i+1]-a.chroma[2*i+1]));const db=Math.abs((b.brightness[i]-b.mean)-(a.brightness[i]-a.mean));c+=dc;if(dc>.26&&db>.08&&Math.max(a.saturation[i],b.saturation[i])>.19)spots++;m+=db;}chromatic+=c/(N*2);motion+=m/N;vivid+=spots/N;hotspots+=Math.abs(a.colouredBright-b.colouredBright);pairs++;}chromatic/=pairs;motion/=pairs;vivid/=pairs;hotspots/=pairs;const meanBright=picked.reduce((sum,f)=>sum+f.colouredBright,0)/picked.length;const shimmer=chromatic*1.7+vivid*2.5+hotspots*.7;
// Requires *colour-changing* highlights, not simple exposure shifts or white sleeve glare.
if(shimmer>.22&&vivid>.026&&meanBright>.012&&motion>.026)return {finish:'Foil',confidence:'high',guess:'Foil',reason:'Changing colourful reflections detected'};
// Low-shimmer evidence can suggest normal, but should not auto-classify: a foil card
// under flat lighting, a sleeve or an unsteady camera may appear identical to normal.
return {finish:null,confidence:'uncertain',guess:shimmer>.115&&vivid>.008?'Foil':'Normal',reason:shimmer>.115?'Possible foil reflections; please verify':'Foil reflections not conclusive; choose the finish'};}
function showScanSuccess(card,finish){
 const box=document.getElementById('camera-box'),last=document.getElementById('scan-last');
 if(last){last.textContent=`✓ ${card.name} • ${card.code} ${card.isAltArt?'• Alternate Art ':''}• ${finish==='Foil'?'Foil':'Non-foil'} added to Bulk`;last.classList.add('is-success');}
 if(box){box.classList.remove('scan-succeeded');void box.offsetWidth;box.classList.add('scan-succeeded');}
 if(scanner.flashTimeout)clearTimeout(scanner.flashTimeout);
 scanner.flashTimeout=setTimeout(()=>box?.classList.remove('scan-succeeded'),670);
}
function commitScan(card,finish,fp,source='manual',detectedCode=''){
 if(isFoilOnlyAlternate(card))finish='Foil';
 if(!['Foil','Normal'].includes(finish))return;
 const key=keyFor(card.id,finish);addBulkByKey(key,1);const a=state.activity[0];
 recentVisitIds.add(a.id);a.kind='scan';a.session=scanner.sessionId||'legacy';a.message=`Scanned ${card.name} (${card.code})${card.isAltArt?' [Alternate Art]':''} • ${finish==='Foil'?'Foil':'Non-foil'}${source==='auto'?' [auto]':''}`;
 save();scanner.sessionCount++;scanner.latchedCode=detectedCode||scanner.pending?.detectedCode||normalizedCode(card.code);scanner.acceptedHash=fp||scanner.acceptedHash;
 scanner.pending=null;scanner.foilCode=null;scanner.foilSamples=[];
 beep();showScanSuccess(card,finish);updateScanUI();setScanStatus(`✓ ${card.name} captured. Show the next card.`,'● Card captured');
 notifyDecksAfterScan(card,finish);
}
async function scanLoop(token){
 while(scanner.running&&scanner.loopToken===token){
  if(scanner.pending||scanner.deckNotice){await delay(150);continue;}
  let observed=null,fp=null,confidence=0,primaryMatch=false;
  try{
   const frame=frameForOCR();fp=frame.fp;scanner.ocrCycles++;
   const out=await scanner.worker.recognize(frame.canvas);
   observed=matchOCR(out?.data?.text||'');confidence=Number(out?.data?.confidence)||0;scanner.lastOcrConfidence=confidence;
   primaryMatch=!!observed;
   // Occasional wider pass rescues codes that fall outside the tight text strip.
   if(!observed&&!scanner.latchedCode&&scanner.ocrCycles%2===0&&scanner.running&&scanner.loopToken===token){
    const wide=frameForOCR(scanner.ocrCycles%4===0?'invert':'wide');const alternate=await scanner.worker.recognize(wide.canvas);
    observed=matchOCR(alternate?.data?.text||'');confidence=Number(alternate?.data?.confidence)||0;
   }
  }catch(e){if(scanner.running)console.warn('OCR frame failed:',e);}
  if(!scanner.running||scanner.loopToken!==token)return;
  const code=observed?normalizedCode(observed.code):'';
  if(code){
   scanner.missed=0;
   if(scanner.lastCandidate===code)scanner.stable++;else{scanner.lastCandidate=code;scanner.stable=1;scanner.foilCode=code;scanner.foilSamples=[];}
   if(scanner.latchedCode&&printingFamilyCode(scanner.latchedCode)===printingFamilyCode(code)){setScanStatus('Already counted. Remove the card before scanning another copy.','● Waiting for next card');}
   else {
    const requiredReads=needsArtworkReview(observed)?3:(observed.isAltArt||observed.isVariant)?2:(scanner.speed==='fast'&&primaryMatch&&confidence>=85?1:2);
    const enough=scanner.stable>=requiredReads;
    if(enough){
     if(needsArtworkReview(observed)){
      // OCR sometimes drops the tiny 'a'. A base code that has an alternate
      // printing must be reviewed, rather than counted as the wrong artwork.
      scanner.pending={card:observed,choices:siblingPrintings(observed),reviewType:'printing',detectedCode:code,fp};
      scanner.latchedCode=code;scanner.acceptedHash=fp;
      updateScanUI();setScanStatus('Check the printed number: regular or alternate art?','● Artwork confirmation');
     }else if(scanner.finishMode==='manual')commitScan(observed,scanner.finish,fp,'manual',code);
     else if(knownPrintingFinish(observed))commitScan(observed,knownPrintingFinish(observed),fp,'catalogue',code);
     else {
      const samples=scanner.foilSamples,result=evaluateFoilSamples(samples);
      if(result.confidence==='high')commitScan(observed,result.finish,fp,'auto',code);
      else if(samples.length>=9&&samples[samples.length-1].at-samples[0].at>=800){
       scanner.pending={card:observed,guess:result.guess,reason:result.reason,reviewType:'finish',detectedCode:code,fp};scanner.latchedCode=code;
       scanner.acceptedHash=fp;updateScanUI();setScanStatus('Choose Foil or Non-foil to count this card','● Finish confirmation');
      }else setScanStatus('Found '+observed.name+'. Tilt gently to check foil…','● Checking finish');
     }
    }else setScanStatus('Reading '+observed.code+'… confirm the code','● Recognising');
   }
  }else{
   scanner.lastCandidate=null;scanner.stable=0;scanner.missed++;
   if(!scanner.latchedCode){scanner.foilCode=null;scanner.foilSamples=[];}
   const change=diffHash(fp,scanner.acceptedHash);
   if(scanner.latchedCode&&scanner.missed>=2&&change>.16){
    scanner.latchedCode=null;scanner.acceptedHash=null;scanner.foilCode=null;scanner.foilSamples=[];
    setScanStatus('Card removed. Ready for the next one.','● Ready');
   }else if(!scanner.latchedCode)setScanStatus('Point at the card; keep the lower collector code visible','● Searching');
   else setScanStatus('Remove the card to unlock the next scan','● Waiting for removal');
  }
  // OCR itself takes most of the time. Avoid an unnecessary 350ms pause after every frame.
  await delay(scanner.speed==='fast'?70:170);
 }
}

// Event delegation.
document.addEventListener('click',async event=>{const nav=event.target.closest('[data-nav]');if(nav){setTab(nav.dataset.nav);return;}const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='close-modal-backdrop'&&event.target!==button)return;const active=ui.deckId&&findDeck(ui.deckId);const entry=active?.entries.find(e=>e.id===button.dataset.entry);const key=button.dataset.key;switch(action){
 case'card-detail':showModal('card',{name:button.dataset.name,printingId:button.dataset.id||null});break;
 case'bulk-add':addBulkByKey(key);render();toast('Added one copy to Bulk.');break;
 case'bulk-remove':if(removeBulkByKey(key)){render();toast('Removed one Bulk copy.');}else toast('This copy is currently assigned to a deck.',true);break;
 case'add-from-detail':{const id=button.dataset.id,sel=document.querySelector(`select[data-card-finish="${CSS.escape(id)}"]`);addBulkByKey(keyFor(id,sel?.value||'Normal'));render();toast('Added one '+(sel?.value||'Normal')+' copy to Bulk.');break;}
 case'open-deck':ui.deckId=button.dataset.id;render();break;
 case'back-to-decks':ui.deckId=null;render();break;
 case'new-empty-deck':{const name=prompt('Name your new deck:','My Riftbound Deck');if(name?.trim()){const d=createDeck(name);ui.tab='decks';ui.deckId=d.id;render();toast('New deck created.');}break;}
 case'open-import':ui.importText='';ui.importName='New Riftbound Deck';ui.tab='decks';ui.deckId=null;render();showModal('import');break;
 case'open-import-into':if(active){ui.importText=deckText(active);ui.importName=active.name;showModal('import',{into:active.id});}break;
 case'sample-txt':ui.importText=JINX_EXAMPLE;ui.importName='Jinx Deck';renderModal();break;
 case'save-import':{const p=parseDeckText(ui.importText);if(!p.entries.length){toast('Paste or upload a valid decklist first.',true);break;}if(p.errors.length&&!confirm(p.errors.length+' line(s) could not be recognised. Import recognised entries anyway?'))break;if(ui.modal?.into){const d=findDeck(ui.modal.into);if(d){d.name=ui.importName.trim()||d.name;d.entries=p.entries.map(e=>({...e,id:uid()}));d.allocations={};logActivity('Replaced requirements in '+d.name,null,'deck');save();ui.deckId=d.id;}}else{const d=createDeck(ui.importName||p.suggestedName||'Imported deck',p.entries);ui.deckId=d.id;}ui.tab='decks';closeModal();render();toast(`Imported ${p.entries.length} card lines (${p.total} copies required).`);break;}
 case'save-rune-counts':{
   if(!active)break;
   const counts={};for(const input of document.querySelectorAll('[data-rune-name]'))counts[input.dataset.runeName]=input.value;
   const result=setRuneCounts(active,counts);
   if(!result.ok){toast(result.error,true);break;}
   render();toast(`Rune requirements saved (${result.total}/12). Existing physical copies retained where possible.`);break;
  }
  case'swap-open':{
   if(active&&entry&&entryAssigned(active,entry)>0)showModal('swap-deck',{deckId:active.id,entryId:entry.id});
   break;
  }
  case'swap-deck-save':{
   const m=ui.modal,d=m?.deckId&&findDeck(m.deckId),e=d?.entries.find(e=>e.id===m.entryId);
   const from=document.getElementById('deck-swap-from')?.value,to=document.getElementById('deck-swap-to')?.value;
   if(!swapDeckCopy(d,e,from,to)){toast('Swap unavailable: choose a different printing/finish with a copy in Bulk.',true);break;}
   closeModal();render();toast('Swapped one assigned card. The previous copy is now in Bulk.');break;
  }
  case'auto-assign':if(active){let n=autoAssign(active);render();toast(n?n+' card copies moved from Bulk to '+active.name+'.':'No additional available Bulk copies to assign.');}break;
 case'assign':if(active&&entry){const pref=document.querySelector(`select[data-variant-entry="${CSS.escape(entry.id)}"]`)?.value;if(assignOne(active,entry,pref)){logActivity('Assigned 1 × '+entry.name+' to '+active.name,null,'assign');save();render();}else toast('No available Bulk copies or requirement already met.',true);}break;
 case'unassign':if(active&&entry){if(unassignOne(active,entry)){logActivity('Returned 1 × '+entry.name+' to Bulk',null,'return');save();render();}}break;
 case'return-all':if(active){active.allocations={};logActivity('Returned all '+active.name+' cards to Bulk',null,'return');save();render();toast('All deck assignments returned to Bulk.');}break;
 case'open-add-card':ui.addCardQuery='';ui.addCardQuantity=1;ui.addCardSection='MainDeck';showModal('add-card');break;
 case'save-add-card':{if(!active)break;const q=Math.max(1,Math.min(99,Number(ui.addCardQuantity)||1));if(!ui.addCardQuery.trim()){toast('Enter a card name.',true);break;}addRequirement(active,ui.addCardSection,ui.addCardQuery,q);closeModal();render();toast('Card requirement added. Assign copies from Bulk when available.');break;}
 case'edit-requirement':if(active&&entry)showModal('edit-entry',{entryId:entry.id});break;
 case'save-requirement':{const d=findDeck(ui.deckId),e=d?.entries.find(e=>e.id===ui.modal?.entryId);if(!e)break;const name=document.getElementById('edit-card-name')?.value.trim()||'',section=document.getElementById('edit-card-section')?.value,needed=Math.floor(Number(document.getElementById('edit-card-qty')?.value));if(!name||!SECTIONS.includes(section)||!Number.isInteger(needed)||needed<1||needed>500){toast('Enter a valid card, section and quantity.',true);break;}if(normalizeName(e.name)!==normalizeName(name)){d.allocations[e.id]={};}e.name=name;e.section=section;e.required=needed;while(entryAssigned(d,e)>needed)unassignOne(d,e);save();closeModal();render();toast('Deck requirement updated.');break;}
 case'remove-requirement':{const d=findDeck(ui.deckId),e=d?.entries.find(e=>e.id===ui.modal?.entryId);if(!e)break;delete d.allocations[e.id];d.entries=d.entries.filter(row=>row.id!==e.id);save();closeModal();render();toast('Requirement removed. Any assigned copies were returned to Bulk.');break;}
 case'rename-deck':if(active){const n=prompt('Rename deck:',active.name);if(n?.trim()){active.name=n.trim();save();render();}}break;
 case'delete-deck':if(active)showModal('confirm',{title:'Delete this deck?',message:`Delete "${active.name}"? All its assigned copies will return to Bulk. The physical cards remain owned.`,button:'Delete deck',command:'delete-deck',id:active.id});break;
 case'confirm-danger':{const c=ui.modal;if(!c)break;if(c.command==='delete-deck'){const name=findDeck(c.id)?.name||'Deck';state.decks=state.decks.filter(d=>d.id!==c.id);ui.deckId=null;logActivity('Deleted '+name+' and returned assigned copies to Bulk',null,'return');save();}else if(c.command==='reset'){recentVisitIds.clear();state=blankState();save();bilgewaterPrices={};saveBilgewaterPrices();ui.deckId=null;}closeModal();render();toast(c.command==='reset'?'Local collection reset.':'Deck deleted; assigned copies returned to Bulk.');break;}
 case'deck-txt':if(active){download(active.name.replace(/[^a-z0-9._-]/gi,'_')+'.txt',deckText(active),'text/plain');toast('Deck TXT downloaded.');}break;
 case'excel':exportExcel();break;
 case'backup':exportBackup();break;
 case'restore':document.getElementById('restore-input').click();break;
 case'reset-data':showModal('confirm',{title:'Reset all local data?',message:'This permanently deletes all collection counts, saved decks, allocations, scan history and saved Bilgewater comparison notes in this browser. Back up your data first.',button:'Erase local data',command:'reset'});break;
 case'refresh-catalog':if(scanner.running||scanner.starting)await stopScanner();toast('Refreshing card catalogue…');await loadCatalogue();break;
 case'close-modal':case'close-modal-backdrop':closeModal();break;
 case'scan-code-lookup':{
  const typed=String(document.getElementById('scan-collector-input')?.value||'').trim();
  const card=codeIndex.get(normalizedCode(typed))||matchOCR(typed);
  if(!card){toast('Code not found. Check the printed set and letter, or refresh the card catalogue.',true);break;}
  scanner.pending=null;
  const finish=knownPrintingFinish(card);
  if(finish)commitScan(card,finish,null,'typed',normalizedCode(card.code));
  else {scanner.pending={card,reviewType:'finish',guess:'Normal',reason:'Select the correct finish for this printing',fp:null,detectedCode:normalizedCode(card.code)};updateScanUI();setScanStatus('Select foil or normal finish','● Finish confirmation');}
  break;
 }
 case'scan-start':await startScanner();break;
 case'scan-stop':await stopScanner();break;
 case'choose-printing':{
  const p=scanner.pending,choice=p?.choices?.find(x=>x.id===button.dataset.id);
  if(!p||p.reviewType!=='printing'||!choice)break;
  const finish=knownPrintingFinish(choice)||(scanner.finishMode==='manual'?scanner.finish:null);
  if(finish){commitScan(choice,finish,p.fp,'confirmed',p.detectedCode);break;}
  const result=evaluateFoilSamples(scanner.foilSamples);
  scanner.pending={card:choice,reviewType:'finish',guess:result.guess,reason:'Artwork confirmed. Please confirm foil finish.',fp:p.fp,detectedCode:p.detectedCode};
  updateScanUI();setScanStatus('Choose the finish for '+choice.code,'● Finish confirmation');break;
 }
 case'finish-confirm-foil':case'finish-confirm-normal':{const p=scanner.pending;if(!p||p.reviewType==='printing')break;commitScan(p.card,action==='finish-confirm-foil'?'Foil':'Normal',p.fp,'confirmed',p.detectedCode);break;}
 case'finish-skip':{if(scanner.pending){scanner.pending=null;scanner.foilCode=null;scanner.foilSamples=[];updateScanUI();setScanStatus('Card skipped; remove it before continuing.','● Skipped');}break;}
 case'scan-next':scanner.latchedCode=null;scanner.lastCandidate=null;scanner.stable=0;scanner.acceptedHash=null;scanner.missed=0;scanner.foilCode=null;scanner.foilSamples=[];setScanStatus('Ready for next identical card. Present it now.','● Ready');break;
 case'correct-scan-printing':{
  const a=state.activity.find(a=>a.id===button.dataset.activity&&a.kind==='scan');
  if(!a?.key||bulkQty(a.key)<1){toast('This scan is no longer in Bulk.',true);break;}
  showModal('correct-printing',{key:a.key,activityId:a.id});break;
 }
 case'correct-stock-printing':{
  if(!key||bulkQty(key)<1){toast('No available Bulk copy to correct.',true);break;}
  showModal('correct-printing',{key});break;
 }
 case'save-correct-printing':{
  const m=ui.modal;
  if(m?.type!=='correct-printing'||!m.key)break;
  if(!correctPrintingOne(m.key,button.dataset.id,m.activityId)){toast('Unable to change printing. Check available Bulk quantity.',true);break;}
  closeModal();render();toast('Printing corrected. Reference price and artwork will now use the selected code.');break;
 }
 case'correct-scan-finish':{const a=state.activity.find(a=>a.id===button.dataset.activity&&a.kind==='scan');if(a?.key&&isFoilOnlyAlternate(getMeta(unpackKey(a.key).id))){toast('Alternate-art printings are foil-only.',true);break;}if(!a||!a.key||bulkQty(a.key)<1){toast('This copy is no longer available in Bulk for correction.',true);break;}const old=a.key,info=unpackKey(old),newFinish=info.finish==='Foil'?'Normal':'Foil',next=keyFor(info.id,newFinish);state.stock[old]=ownedQty(old)-1;if(state.stock[old]===0)delete state.stock[old];state.stock[next]=ownedQty(next)+1;a.key=next;a.message=`Scanned ${getMeta(info.id).name} (${getMeta(info.id).code}) • ${newFinish==='Foil'?'Foil':'Non-foil'} [corrected]`;save();if(ui.tab==='scan')updateScanUI();else render();toast('Finish corrected to '+(newFinish==='Foil'?'Foil':'Non-foil')+'.');break;}
 case'undo-scan':{const i=state.activity.findIndex(a=>a.id===button.dataset.activity&&a.kind==='scan');if(i<0)break;const a=state.activity[i];if(!a.key||bulkQty(a.key)<1){toast('Cannot undo: copy no longer in Bulk.',true);break;}state.stock[a.key]=ownedQty(a.key)-1;if(!state.stock[a.key])delete state.stock[a.key];state.activity.splice(i,1);recentVisitIds.delete(a.id);logActivity('Undid a scan of '+getMeta(unpackKey(a.key).id).name,null,'undo');save();if(ui.tab==='scan')updateScanUI();else render();toast('Scan undone.');break;}
 }});
document.addEventListener('input',event=>{const t=event.target;if(t.id==='card-search'||t.id==='inventory-search'){if(t.id==='card-search')ui.query=t.value;else ui.inventoryQuery=t.value;const id=t.id,position=t.selectionStart;render();const e=document.getElementById(id);if(e){e.focus();try{e.setSelectionRange(position,position);}catch(_){}}}else if(t.id==='import-deck-text'){ui.importText=t.value;const b=document.querySelector('[data-action="save-import"]');if(b){const p=parseDeckText(ui.importText);b.disabled=!p.entries.length;b.textContent=(ui.modal?.into?'Replace requirements':'Create deck')+' · '+p.total+' cards';}}else if(t.id==='import-deck-name')ui.importName=t.value;else if(t.id==='add-card-name')ui.addCardQuery=t.value;else if(t.id==='add-card-qty')ui.addCardQuantity=Number(t.value);});
document.addEventListener('change',async event=>{const t=event.target;if(t.id==='set-filter'){ui.setFilter=t.value;render();}else if(t.id==='owned-only'){ui.ownedOnly=t.checked;render();}else if(t.id==='deck-file'){const file=t.files?.[0];if(file){if(file.size>200000){toast('Decklist file is too large.',true);return;}ui.importText=await file.text();ui.importName=(file.name.replace(/\.txt$/i,'').trim()||ui.importName);renderModal();toast('TXT file loaded. Review the requirements, then create the deck.');}}else if(t.id==='restore-input'){await restoreJson(t.files?.[0]);t.value='';}else if(t.id==='add-card-section')ui.addCardSection=t.value;else if(t.id==='scan-finish')scanner.finish=t.value;else if(t.id==='scan-speed'){scanner.speed=t.value==='steady'?'steady':'fast';localStorage.setItem(SCAN_SPEED_KEY,scanner.speed);toast(scanner.speed==='fast'?'Fast recognition selected; please review scanned codes.':'Steady recognition selected; codes require two matching reads.');}else if(t.id==='scan-finish-mode'){scanner.finishMode=t.value==='manual'?'manual':'auto';const row=document.getElementById('scan-manual-finish');if(row)row.style.display=scanner.finishMode==='manual'?'':'none';scanner.foilSamples=[];scanner.foilCode=null;toast(scanner.finishMode==='auto'?'Automatic foil assessment enabled; uncertain finishes will need confirmation.':'Manual finish mode enabled.');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.modal)closeModal();});
window.addEventListener('pagehide',()=>{if(scanner.stream)scanner.stream.getTracks().forEach(t=>t.stop());});

// ---- RiftVault v1.3: integrated inventory insights, prices and deck tools ----
const BACKUP_TIME_KEY='riftvault-last-backup';
function backupReminder(){if(totalOwned()===0&&state.decks.length===0)return '';const last=Date.parse(localStorage.getItem(BACKUP_TIME_KEY)||'');const days=Number.isFinite(last)?Math.floor((Date.now()-last)/86400000):null;if(days!==null&&days<7)return '';return `<div class="warning-list mb18" role="status"><strong>Back up your collection.</strong> ${days===null?'No JSON backup is recorded for this browser.':`Your last recorded backup was ${days} days ago.`} <button class="btn btn-small btn-primary" data-action="backup">Download JSON backup</button> <span class="muted micro">Browser storage is not a cloud backup.</span></div>`;}
function priceSourceBlock(){
 const summary=collectionPrice();
 const value=summary.priced?priceText({amount:summary.total}):'N/A';
 const stale=priceState.cached||priceState.status==='unavailable';
 const status=priceState.status==='loading'?'Loading…':priceState.status==='unavailable'?'Unavailable':stale?'Cached':'Daily feed';
 return `<section class="market-banner panel"><div class="row-between wrap"><div>
   <div class="eyebrow">ESTIMATED COLLECTION VALUE · TCGPLAYER (VIA RIFTHUNT)</div>
   <div class="market-big">${escapeHtml(value)}</div>
   <p class="muted small">${summary.priced} priced copies · ${summary.unpriced} unpriced copies</p>
  </div><div class="bw-toolbar">
   <span class="badge">${escapeHtml(status)}</span>
   <button class="btn btn-small btn-primary" data-action="refresh-prices" ${priceFetchInFlight?'disabled':''}>↻ Refresh prices</button>
   <a class="btn btn-small btn-ghost" href="${BILGEWATER_URL}" target="_blank" rel="noopener noreferrer">Compare on Bilgewater ↗</a>
   <button class="btn btn-small btn-ghost" data-action="bw-import-open">Import Bilgewater notes</button>
   <button class="btn btn-small btn-ghost" data-action="bw-template">Comparison CSV</button>
  </div></div>
  <p class="muted micro">${escapeHtml(priceUpdatedLabel())}. Prices are daily USD market estimates, not real-time transactions. An unmatched printing or finish is shown as N/A. Saved manual Bilgewater notes remain available in card details, without changing valuations. <a href="https://rifthunt.com/api/" target="_blank" rel="noopener noreferrer">Source & methodology ↗</a></p>
  ${priceState.error?`<p class="muted micro">Automatic refresh issue: ${escapeHtml(priceState.error)}</p>`:''}
 </section>`;
}
function numPrice(v){return Number.isFinite(v)?priceText({amount:v}):'N/A';}
function copyValueRow(count){return count>0?`${count} ${count===1?'copy':'copies'}`:'None';}
function selectedPriceForName(name,finish){const p=printingsFor(name);const q=p.map(x=>quoteFor(x,finish)).filter(Boolean);if(!q.length)return null;return q.reduce((a,b)=>a.amount<=b.amount?a:b);}
function quoteForWishlist(name){return selectedPriceForName(name,'Normal')||selectedPriceForName(name,'Foil');}
function smartWishlist(){const rows=new Map();for(const d of state.decks){for(const e of d.entries){const cardName=requirementName(e),key=normalizeName(cardName);if(!key)continue;let row=rows.get(key);if(!row){row={name:cardName,openNeeded:0,decks:new Set(),manual:0};rows.set(key,row);}const open=Math.max(0,e.required-entryAssigned(d,e));row.openNeeded+=open;if(open)row.decks.add(d.name);}}for(const [key,r] of Object.entries(state.manualWishlist||{})){if(!r||!r.name)continue;const canonical=requirementName({name:r.name,section:'Legend'}),resolvedKey=normalizeName(canonical);let row=rows.get(resolvedKey);if(!row){row={name:canonical,openNeeded:0,decks:new Set(),manual:0};rows.set(resolvedKey,row);}row.manual=Math.max(0,Number(r.target)||0);}return [...rows.values()].map(r=>{const bulk=stockForName(r.name,true),owned=stockForName(r.name),deckShort=Math.max(0,r.openNeeded-bulk),wishShort=Math.max(0,r.manual-owned),short=Math.max(deckShort,wishShort);return {...r,bulk,owned,deckShort,wishShort,short,quote:quoteForWishlist(r.name)};}).filter(r=>r.short>0).sort((a,b)=>b.short-a.short||a.name.localeCompare(b.name));}
function renderWishlist(){const rows=smartWishlist(),cost=rows.reduce((t,r)=>t+(r.quote?r.short*r.quote.amount:0),0),uncosted=rows.filter(r=>!r.quote).reduce((t,r)=>t+r.short,0);return `<div class="row-between wrap mb18"><div><h2>Smart wishlist</h2><p class="muted small">Missing copies from your saved decklists and optional personal wishlist. Bulk is counted once across decks.</p></div><span class="pill">${rows.reduce((t,r)=>t+r.short,0)} copies to find</span></div><div class="stats"><div class="stat-card"><div class="stat-top">MISSING COPIES</div><div class="stat-value">${rows.reduce((t,r)=>t+r.short,0)}</div></div><div class="stat-card"><div class="stat-top">DISTINCT CARDS</div><div class="stat-value">${rows.length}</div></div><div class="stat-card"><div class="stat-top">KNOWN COST ESTIMATE</div><div class="stat-value value-small">${cost?priceText({amount:cost}):'N/A'}</div><div class="stat-sub">${uncosted} unpriced missing copies</div></div></div><div class="panel mb18"><h3>Add a personal wishlist item</h3><div class="row wrap"><input id="wish-name" class="input grow-field" list="wish-names" placeholder="Card name (e.g. Flame Chompers)" autocomplete="off"/><datalist id="wish-names">${getNamesForSearch().slice(0,1800).map(g=>`<option value="${escapeHtml(g.name)}"></option>`).join('')}</datalist><label class="form-field mini-qty"><span>Target owned</span><input id="wish-qty" class="input" type="number" min="1" max="999" value="3" /></label><button class="btn btn-primary" data-action="wish-add">＋ Add goal</button></div><p class="muted micro">Personal goal quantities refer to total owned copies, not additional copies beyond deck requirements.</p></div><div class="panel"><div class="panel-heading"><h3>Cards to acquire</h3><span class="muted micro">${escapeHtml('USD · TCGplayer via RiftHunt (daily)')}</span></div>${rows.length?rows.map(r=>{const m=Object.values(state.manualWishlist||{}).find(w=>normalizeName(requirementName({name:w.name,section:'Legend'}))===normalizeName(r.name));return `<div class="list-row"><div class="item-main"><strong>${escapeHtml(r.name)}</strong><small>Need ${r.openNeeded} unassigned for ${r.decks.size} deck${r.decks.size===1?'':'s'} · Bulk ${r.bulk} · Owned ${r.owned}${m?' · Personal target '+m.target:''}</small><small>${[...r.decks].map(escapeHtml).join(', ')||'Personal wishlist'}</small></div><div class="val-column"><strong class="price-figure">${escapeHtml(r.quote?priceText(r.quote):'N/A')}</strong><span class="muted micro">Estimate each</span></div><span class="badge badge-warning">Short ${r.short}</span><div class="row wrap"><button class="btn btn-small btn-ghost" data-action="card-detail" data-name="${escapeHtml(r.name)}">View</button>${m?`<button class="btn btn-small btn-ghost" data-action="wish-remove" data-name="${escapeHtml(r.name)}">Remove goal</button>`:''}</div></div>`;}).join(''):`<div class="empty"><h3>No missing cards</h3><p>Import a deck to calculate shortages, or set a personal wishlist target.</p></div>`}</div><p class="muted micro mt16">Estimate uses an available quoted printing, not a promise of stock or the exact version you want. Unpriced copies are excluded.</p>`;}
function renderLocations(){const names=state.locationNames||[],stored=totalStorage(),items=ownedEntries();return `<div class="row-between wrap mb24"><div><h2>Physical storage</h2><p class="muted small">Create binders or boxes, then move physical cards to them. Deck allocations stay separate.</p></div><span class="pill">${stored} copies in ${names.length} custom locations</span></div><div class="panel mb18"><h3>Add a location</h3><div class="row wrap"><input id="location-name" class="input grow-field" placeholder="e.g. Trade Binder, Box 1, Foil Binder" maxlength="60"/><button class="btn btn-primary" data-action="location-add">＋ Create location</button></div><div class="row wrap mt16">${names.map(n=>{const qty=items.reduce((a,i)=>a+Number(state.extraLocations?.[i.key]?.[n]||0),0);return `<span class="location-pill"><strong>${escapeHtml(n)}</strong> · ${qty} <button class="btn btn-small btn-ghost" data-action="location-delete" data-location="${escapeHtml(n)}" title="Delete empty location" ${qty?'disabled':''}>×</button></span>`;}).join('')||'<span class="muted small">No custom locations yet. Your cards start in Bulk.</span>'}</div></div><div class="panel"><div class="panel-heading"><h3>Move cards between Bulk and storage</h3><span class="muted small">1 copy per tap</span></div>${items.length?items.map(e=>{const placed=Object.entries(state.extraLocations?.[e.key]||{}).filter(([,n])=>n>0);return `<div class="list-row"><div class="thumb">${cardArt(e.card)}</div><div class="item-main"><strong>${escapeHtml(e.card.name)}</strong><small>${escapeHtml(e.card.code)} · ${escapeHtml(e.finish)} · Bulk ${e.bulk} · Stored ${e.stored}</small>${placed.length?`<div class="row wrap mt8">${placed.map(([n,v])=>`<span class="location-pill">${escapeHtml(n)}: ${v}<button class="btn btn-small btn-ghost" data-action="location-return" data-key="${escapeHtml(e.key)}" data-location="${escapeHtml(n)}">↶ 1</button></span>`).join('')}</div>`:''}</div><div class="row wrap">${names.length?`<select class="mini-select" data-store-select="${escapeHtml(e.key)}" aria-label="Storage destination for ${escapeHtml(e.card.name)}">${names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}</select><button class="btn btn-small btn-green-outline" data-action="location-move" data-key="${escapeHtml(e.key)}" ${e.bulk?'':'disabled'}>Move 1</button>`:'<span class="muted micro">Create a location first</span>'}</div></div>`;}).join(''):`<div class="empty"><h3>No owned cards yet</h3><p>Scan your first cards or add them from Search.</p></div>`}</div>`;}
function setGroups(){const by=new Map();for(const source of catalog){const p=getMeta(source.id);const set=p.set||'Unknown';if(!set)continue;let r=by.get(set);if(!r){r={set,setName:p.setName||set,names:new Set(),foilPrints:new Set(),normalPrints:new Set(),haveNames:new Set(),haveFoil:new Set(),haveNormal:new Set()};by.set(set,r);}const n=normalizeName(p.name);r.names.add(n);if(priceState.entries.length){const quote=priceRecord(p);if(quote?.allowedFinishes?.includes('foil'))r.foilPrints.add(p.id);if(quote?.allowedFinishes?.includes('normal'))r.normalPrints.add(p.id);}}
 for(const e of ownedEntries()){const set=e.card.set||'Unknown',r=by.get(set);if(!r)continue;if(r.names.has(normalizeName(e.card.name)))r.haveNames.add(normalizeName(e.card.name));if(e.finish==='Foil')r.haveFoil.add(e.card.id);else r.haveNormal.add(e.card.id);}return [...by.values()].sort((a,b)=>{const main=['OGN','SFD','UNL','VEN','RAD'];const ai=main.indexOf(a.set),bi=main.indexOf(b.set);return (ai<0?999:ai)-(bi<0?999:bi)||a.setName.localeCompare(b.setName);});}
function renderSets(){const groups=setGroups();return `<div class="row-between wrap mb24"><div><h2>Set completion</h2><p class="muted small">Progress by distinct card name. Foil and non-foil printing tracking is shown separately where catalogue data is available.</p></div><span class="pill">${groups.length} sets</span></div><div class="set-grid">${groups.map(r=>{const pct=r.names.size?Math.round(r.haveNames.size/r.names.size*100):0;return `<div class="panel set-tile"><div class="eyebrow">${escapeHtml(r.set)}</div><h3>${escapeHtml(r.setName)}</h3><div class="row-between"><strong>${r.haveNames.size} / ${r.names.size} Cards</strong><span class="muted">${pct}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="set-printings"><span>Foil printings <b>${r.haveFoil.size}${r.foilPrints.size?` / ${r.foilPrints.size}`:''}</b></span><span>Non-foil printings <b>${r.haveNormal.size}${r.normalPrints.size?` / ${r.normalPrints.size}`:''}</b></span></div><button class="btn btn-small btn-ghost" data-action="set-view" data-set="${escapeHtml(r.set)}">Browse set cards →</button></div>`}).join('')}</div>${!catalogReady?`<div class="info-note mt16">The full card catalogue has not loaded. Completion percentages are incomplete until you connect and refresh the catalogue.</div>`:''}<p class="muted micro mt16">Completion depends on available catalogue data; special promos and duplicate printing names can affect denominators. Owned foil counts may include versions not sold in that finish; review scanned finishes.</p>`;}
function deckLegalReview(deck){const basic=checkDeck(deck),issues=basic.issues.slice(),checks=[];const legend=deck.entries.find(e=>e.section==='Legend'),champion=deck.entries.find(e=>e.section==='Champion');let verified=0,unknown=0;
 const legendMeta=legend?printingsFor(legend.name)[0]:null;const legendPrice=legendMeta?priceRecord(legendMeta):null;const domains=legendPrice?.domains?.length?legendPrice.domains:legendMeta?.domains||[];
 if(legend&&domains.length){for(const e of deck.entries.filter(e=>['MainDeck','Champion','Runes','Sideboard'].includes(e.section))){const p=printingsFor(e.name)[0];const pm=p?priceRecord(p):null;const cardDomains=(pm?.domains?.length?pm.domains:p?.domains||[]).filter(d=>String(d).toLowerCase()!=='colorless');if(!cardDomains.length){unknown++;continue;}verified++;if(cardDomains.some(d=>!domains.some(l=>normalizeName(l)===normalizeName(d))))issues.push(`${e.name} has a domain outside your Legend's domains (${domains.join(' / ')})`);}}
 else if(legend)checks.push('Legend domain information unavailable; domain legality was not checked.');
 if(unknown)checks.push(`${unknown} card line(s) lacked domain metadata and were not verified.`);
 const signatureRows=deck.entries.filter(e=>['MainDeck','Sideboard','Champion'].includes(e.section)).filter(e=>{const p=printingsFor(e.name)[0];return normalizeName(priceRecord(p)?.supertype||p?.supertype)==='signature';});const sigTotal=signatureRows.reduce((a,e)=>a+e.required,0);if(sigTotal>3)issues.push(`Signature limit exceeded: ${sigTotal} copies (maximum 3).`);
 if(champion&&legend&&priceState.entries.length){checks.push('Confirm chosen champion matches the Legend; special card interactions may require a judge.');}
 checks.push('Banned-card list based on the official September 18, 2026 Constructed update. Recheck before events.');return {issues:[...new Set(issues)],notes:checks,verified,domains};}
function deckReviewPanel(deck){const a=deckStats(deck),bulkPossible=deck.entries.reduce((sum,e)=>sum+Math.min(Math.max(0,e.required-entryAssigned(deck,e)),entryBulk(e)),0),shortAfter=Math.max(0,a.need-a.assigned-bulkPossible),price=deckPrice(deck),missing=deckMissingPrice(deck),review=deckLegalReview(deck);return `<div class="panel mb18"><div class="row-between wrap"><h3>Deck completion & market value</h3><span class="badge ${review.issues.length?'badge-warning':'badge-success'}">${review.issues.length?'Review needed':'Basic checks pass'}</span></div><div class="review-metrics"><div><span class="muted micro">Currently allocated</span><strong>${a.assigned} / ${a.need}</strong></div><div><span class="muted micro">Can fill from Bulk</span><strong>${bulkPossible}</strong></div><div><span class="muted micro">Still short after Bulk</span><strong>${shortAfter}</strong></div><div><span class="muted micro">Assigned market value</span><strong>${price.priced?escapeHtml(priceText({amount:price.total})):'N/A'}</strong></div><div><span class="muted micro">Unfilled-card estimate</span><strong>${missing.knownCards?escapeHtml(priceText({amount:missing.known})):'N/A'}</strong><span class="muted micro">${missing.unpriced} unpriced</span></div></div><div class="progress-track mt16"><div class="progress-fill" style="width:${a.need?100*a.assigned/a.need:0}%"></div></div><div class="rule-panel"><strong>Constructed deck checklist</strong>${review.issues.length?`<ul>${review.issues.map(x=>`<li class="rule-issue">${escapeHtml(x)}</li>`).join('')}</ul>`:'<p class="muted small">Deck-size, basic copy limits and known banned cards passed.</p>'}${review.notes.map(x=>`<p class="muted micro">${escapeHtml(x)}</p>`).join('')}<div class="row wrap" style="margin-top:10px"><button class="btn btn-small btn-ghost" data-action="deck-rules">⚖ Search Rules Library</button><a href="https://playriftbound.com/en-us/rules-hub/" target="_blank" rel="noopener noreferrer">Official rules &amp; banlist ↗</a></div></div></div>`;}
function scanActivityLabel(a){
 if(!a?.key)return a?.message||'Scan';
 const {id,finish}=unpackKey(a.key),p=getMeta(id);
 const corrected=/\[corrected\]/i.test(a.message||'')?' [corrected]':'';
 return `Scanned ${p.name} (${p.code}) • ${finish==='Foil'?'Foil':'Non-foil'}${corrected}`;
}
function renderScanHistory(){const scans=state.activity.filter(a=>a.kind==='scan').slice(0,200);return `<div class="row-between wrap mb24"><div><h2>Scanning history</h2><p class="muted small">Review and correct recorded scans. Undo works when the scanned copy is still in Bulk.</p></div><div class="row wrap"><span class="pill">${scans.length} recorded</span><button class="btn btn-ghost" data-action="history-export">↧ Export CSV</button></div></div>${backupReminder()}<div class="panel mb18"><div class="row-between wrap"><h3>Session review</h3><button class="btn btn-small btn-ghost" data-action="history-undo-session" ${!scans.length?'disabled':''}>Undo latest session</button></div><p class="muted small">A session groups scans between starting and stopping the camera. The batch undo will not run if any of its cards are no longer available in Bulk.</p></div><div class="panel">${scans.length?scans.map(a=>{const key=a.key,can=a.key&&bulkQty(a.key)>0;return `<div class="list-row scan-full-history-row">${scanThumbnail(a)}<div class="item-main"><strong>${escapeHtml(scanActivityLabel(a))}</strong><small>${escapeHtml(new Date(a.at).toLocaleString())} · ${escapeHtml(a.session?'Session '+String(a.session).slice(0,8):'Legacy scan')}</small></div><div class="row wrap"><button class="btn btn-small btn-ghost" data-action="correct-scan-printing" data-activity="${escapeHtml(a.id)}" ${can?'':'disabled'}>↔ Artwork</button><button class="btn btn-small btn-ghost" data-action="correct-scan-finish" data-activity="${escapeHtml(a.id)}" ${can?'':'disabled'}>↔ Finish</button><button class="btn btn-small btn-ghost" data-action="undo-scan" data-activity="${escapeHtml(a.id)}" ${can?'':'disabled'}>Undo</button></div></div>`}).join(''):`<div class="empty"><h3>No scans recorded yet</h3><p>Open Auto scanner to record your next batch.</p><button class="btn btn-primary" data-nav="scan">Open scanner</button></div>`}</div>`;}
function csvEscape(v){return '"'+String(v??'').replaceAll('"','""')+'"';}
function exportHistoryCSV(){const rows=[['Date','Card','Set code','Finish','Session','Description'],...state.activity.filter(a=>a.kind==='scan').map(a=>[a.at,a.key?getMeta(unpackKey(a.key).id).name:'',a.key?getMeta(unpackKey(a.key).id).code:'',a.key?unpackKey(a.key).finish:'',a.session||'',scanActivityLabel(a)])];download('RiftVault-Scans-'+new Date().toISOString().slice(0,10)+'.csv','\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
function undoLastSession(){const scans=state.activity.filter(a=>a.kind==='scan');if(!scans.length)return toast('No scan session to undo.',true);const latest=scans[0].session||scans[0].id;const list=scans.filter(a=>(a.session||a.id)===latest);const sums=new Map();for(const a of list)if(a.key)sums.set(a.key,(sums.get(a.key)||0)+1);for(const [k,q] of sums)if(bulkQty(k)<q)return toast('Cannot undo this session: some scanned copies were already moved or removed.',true);if(!confirm(`Undo all ${list.length} scan(s) from the latest session?`))return;for(const [k,q] of sums){state.stock[k]=ownedQty(k)-q;if(!state.stock[k])delete state.stock[k];}const ids=new Set(list.map(a=>a.id));for(const id of ids)recentVisitIds.delete(id);state.activity=state.activity.filter(a=>!ids.has(a.id));logActivity(`Undid ${list.length} scans from a session`,null,'undo');save();render();toast(`${list.length} scan(s) undone.`);}
const _rvRenderOverview=renderOverview;
renderOverview=function(){return _rvRenderOverview().replace('<div class="stats">',backupReminder()+priceSourceBlock()+'<div class="stats">').replace('ASSIGNED TO DECKS','ASSIGNED TO DECKS').replace('Across ${state.decks.length}', 'Across ${state.decks.length}');};
const _rvRenderDeckDetail=renderDeckDetail;
renderDeckDetail=function(deck){return _rvRenderDeckDetail(deck).replace('<div class="panel" style="padding:13px 18px">',deckReviewPanel(deck)+'<div class="panel" style="padding:13px 18px">');};
const _rvRenderSettings=renderSettings;
renderSettings=function(){return _rvRenderSettings().replace('<div class="settings-grid">',backupReminder()+priceSourceBlock()+'<div class="settings-grid">');};
const _rvRenderScan=renderScan;
renderScan=function(){
 const count=catalog.filter(c=>c.set==='RAD').length;
 const message=count>=160
  ?`<div class="info-note mb12">✓ Radiance catalogue ready: ${count} printings available for scanning, including regular cards, Runes and variants.</div>`
  :`<div class="warning-list mb12">Radiance card data not ready (${count} starter entries). Connect to the internet and reopen RiftVault to download the full RAD catalogue.</div>`;
 return _rvRenderScan().replace('<div class="scanner-layout">',
  '<div class="row wrap mb18"><button class="btn btn-ghost btn-small" data-nav="history">↺ Full scan history & batch review</button></div>'+message+'<div class="scanner-layout">');
};
const _rvRenderDecks=renderDecks;
renderDecks=function(){return _rvRenderDecks().replace('<div class="deck-cards">','<div class="info-note mb18">Decks reserve physical copies, and are valued using the assigned printing and foil finish. Open a deck for completion, missing-card estimate and legality checks.</div><div class="deck-cards">');};
const _rvRenderSearch=renderSearch;
renderSearch=function(){const html=_rvRenderSearch();return html.replaceAll('</span></div></div></button>','</span></div></div></button>');};
const _rvRenderInventory=renderInventory;
renderInventory=function(){
 const entries=ownedEntries().filter(e=>!ui.inventoryQuery||normalizeName(e.card.name+' '+e.card.code+' '+e.finish).includes(normalizeName(ui.inventoryQuery)));
 return `<div class="row-between wrap mb24"><div><h2>Your physical inventory</h2><p class="muted small">Physical copies, split by finish, decks and named storage. Prices show TCGplayer USD market estimates via RiftHunt.</p></div><div class="row wrap"><button class="btn btn-ghost" data-action="excel">↧ Export Excel</button><button class="btn btn-primary" data-nav="scan">▣ Scan cards</button></div></div><div class="stats"><div class="stat-card"><div class="stat-top">TOTAL COPIES</div><div class="stat-value">${fmt(totalOwned())}</div></div><div class="stat-card"><div class="stat-top">BULK</div><div class="stat-value">${fmt(totalBulk())}</div></div><div class="stat-card"><div class="stat-top">IN DECKS</div><div class="stat-value">${fmt(totalOwned()-totalBulk()-totalStorage())}</div></div><div class="stat-card"><div class="stat-top">IN STORAGE</div><div class="stat-value">${fmt(totalStorage())}</div></div></div>${priceSourceBlock()}<div class="panel inventory-panel"><div class="toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input id="inventory-search" class="input input-search" placeholder="Filter inventory..." value="${escapeHtml(ui.inventoryQuery)}"/></div><span class="muted small">${entries.length} printing / finish rows</span></div>${entries.length?`<div class="inventory-list">${entries.map(e=>{
  const quote=priceQuoteByKey(e.key), decks=e.qty-e.bulk-e.stored;
  return `<article class="inventory-row"><button type="button" class="inventory-thumb card-zoom-trigger" data-action="image-preview" data-id="${escapeHtml(e.card.id)}" data-finish="${escapeHtml(e.finish)}" aria-label="Enlarge ${escapeHtml(e.card.name)} card art">${cardArt(e.card)}</button><div class="inventory-main"><strong>${escapeHtml(e.card.name)}</strong>${banBadge(e.card.name)}<span class="inventory-sub">${escapeHtml(e.card.code||'Unknown code')} · ${escapeHtml(e.card.setName||'Unknown set')}</span><span class="inventory-finish">${escapeHtml(e.finish)}</span><div class="inventory-location">Owned ${e.qty} <span>·</span> Bulk ${e.bulk} <span>·</span> Decks ${decks} <span>·</span> Storage ${e.stored}</div></div><div class="inventory-price"><span class="inventory-price-label">TCGplayer market (USD)</span><strong>${priceHtml(quote)}</strong><span class="muted micro">${quote?`Est. total ${escapeHtml(priceText({amount:quote.amount*e.qty}))}`:'No exact TCGplayer quote'}</span><button class="bw-inline" data-action="bw-price-open" data-id="${escapeHtml(e.card.id)}" data-finish="${escapeHtml(e.finish)}">Bilgewater note</button></div><div class="inventory-actions"><div class="quantity-controls"><span class="inventory-bulk-label">Bulk</span><button class="btn btn-small btn-icon" data-action="bulk-remove" data-key="${escapeHtml(e.key)}" ${e.bulk?'':'disabled'} title="Remove one from Bulk" aria-label="Remove one ${escapeHtml(e.card.name)} from Bulk">−</button><span class="num">${e.bulk}</span><button class="btn btn-small btn-icon btn-green-outline" data-action="bulk-add" data-key="${escapeHtml(e.key)}" title="Add one to Bulk" aria-label="Add one ${escapeHtml(e.card.name)} to Bulk">＋</button></div>${siblingPrintings(e.card).length>1?`<button class="btn btn-small btn-ghost inventory-art-btn" data-action="correct-stock-printing" data-key="${escapeHtml(e.key)}" ${e.bulk?'':'disabled'}>↔ Artwork</button>`:''}<button class="btn btn-small btn-ghost inventory-detail-btn" data-action="card-detail" data-name="${escapeHtml(e.card.name)}" data-id="${escapeHtml(e.card.id)}">Details ›</button></div></article>`;
 }).join('')}</div>`:`<div class="empty"><h3>No matching inventory</h3><p>Scan or search for a card to add physical copies.</p></div>`}</div>`;
};
const _rvRenderModal=renderModal;
renderModal=function(){if(ui.modal?.type==='bilgewater-price'){
 const meta=getMeta(ui.modal.cardId),finish=ui.modal.finish==='Foil'?'Foil':'Normal',quote=bilgewaterQuoteFor(meta,finish),link=bilgewaterLink(meta);
 const body=`<div class="bw-price-edit"><p><strong>${escapeHtml(meta.name)}</strong> · ${escapeHtml(meta.code||meta.id)} · ${escapeHtml(finish)}</p><p class="muted small">This is an optional comparison note, separate from automatic TCGplayer valuations. Open Bilgewater Market, verify the exact printing and finish, then copy its USD reference price here. Alternate-art links open the catalogue so you can select the correct variation.</p><a class="btn btn-primary" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Check Bilgewater price ↗</a><label class="form-field mt16"><span>USD price per copy</span><input id="bw-usd" class="input" type="number" inputmode="decimal" step="0.01" min="0.01" max="1000000" placeholder="e.g. 12.50" value="${quote?escapeHtml(quote.amount):''}"/></label>${quote?`<p class="muted micro">Saved ${escapeHtml(new Date(quote.updatedAt).toLocaleString())}</p>`:''}</div>`;
 document.getElementById('modal-root').innerHTML=modalShell('Bilgewater price',`${meta.code} · ${finish}`,body,`<button class="btn" data-action="close-modal">Cancel</button>${quote?'<button class="btn btn-ghost" data-action="bw-delete-price">Clear price</button>':''}<button class="btn btn-primary" data-action="bw-save-price">Save USD price</button>`);return;
}
if(ui.modal?.type==='bilgewater-import'){
 const body=`<p class="muted small">Import USD reference prices copied from <a href="${BILGEWATER_URL}" target="_blank" rel="noopener noreferrer">Bilgewater Market</a>. This does not automatically fetch the site. Enter one printing and finish per line. Existing prices for the same code/finish will be updated; unrelated prices remain unchanged.</p><p class="muted micro">Format: Code,Finish,USD. Keep suffixes such as <b>SFD-088a</b> to avoid mixing alternate artwork with normal prints.</p><textarea id="bw-csv" class="textarea input bw-csv" rows="8" spellcheck="false" placeholder="Code,Finish,USD&#10;SFD-088a,Foil,12.50&#10;SFD-088,Foil,0.85"></textarea><label class="form-field mt16"><span>Or load a completed CSV file</span><input type="file" id="bw-csv-file" class="file-input" accept=".csv,text/csv,text/plain,.txt" /></label><div class="row wrap mt16"><button class="btn btn-ghost" data-action="bw-template">Download inventory CSV template</button><a class="btn btn-ghost" href="${BILGEWATER_URL}" target="_blank" rel="noopener noreferrer">Browse Bilgewater ↗</a></div><p class="muted micro mt16">Only enter values you have checked on Bilgewater. Imported prices are snapshots; the app cannot verify them or keep them live without an authorised feed.</p>`;
 document.getElementById('modal-root').innerHTML=modalShell('Import Bilgewater prices','USD reference prices • manual copy or CSV',body,`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="bw-import-save">Import prices</button>`);return;
}
if(ui.modal?.type==='menu'){document.getElementById('modal-root').innerHTML=modalShell('More workspaces','Select where to go',`<div class="mobile-menu-list">${[{id:'wishlist',name:'Smart wishlist',icon:'♡'},{id:'locations',name:'Storage locations',icon:'▣'},{id:'history',name:'Scan history',icon:'↺'},{id:'rules',name:'Rules library',icon:'⚖'},{id:'settings',name:'Settings & backup',icon:'⚙'}].map(n=>`<button class="btn btn-ghost" data-nav="${n.id}">${n.icon} &nbsp; ${n.name}</button>`).join('')}</div>`,`<button class="btn" data-action="close-modal">Close</button>`);return;}_rvRenderModal();if(ui.modal?.type!=='card')return;const root=document.getElementById('modal-root'),target=root.querySelector('.modal');if(!target)return;const name=ui.modal.name;const rows=printingsFor(name);const html=`<div class="panel price-in-modal"><div class="row-between wrap"><h3>TCGplayer market prices via RiftHunt</h3><span class="muted micro">USD · updated daily</span></div>${rows.length?rows.map(p=>{const normal=quoteFor(p,'Normal'),foil=quoteFor(p,'Foil'),savedNormal=bilgewaterQuoteFor(p,'Normal'),savedFoil=bilgewaterQuoteFor(p,'Foil'),link=bilgewaterLink(p);return `<div class="list-row"><div class="item-main"><strong>${escapeHtml(p.code||p.id)}</strong><small>${escapeHtml(p.setName)} ${p.isAltArt?'· Alternate art':''}</small></div><div class="price-split"><span>Non-foil: ${priceHtml(normal)}${normal?.link?` <a class="bw-inline" href="${escapeHtml(normal.link)}" target="_blank" rel="noopener noreferrer">TCGplayer ↗</a>`:''} <button class="bw-inline" data-action="bw-price-open" data-id="${escapeHtml(p.id)}" data-finish="Normal">Bilgewater: ${escapeHtml(priceText(savedNormal))} · Edit</button></span><span>Foil: ${priceHtml(foil)}${foil?.link?` <a class="bw-inline" href="${escapeHtml(foil.link)}" target="_blank" rel="noopener noreferrer">TCGplayer ↗</a>`:''} <button class="bw-inline" data-action="bw-price-open" data-id="${escapeHtml(p.id)}" data-finish="Foil">Bilgewater: ${escapeHtml(priceText(savedFoil))} · Edit</button></span></div><a class="btn btn-small btn-ghost" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Bilgewater ↗</a></div>`;}).join(''):'<p class="muted">No catalogue printing available.</p>'}<p class="muted micro">TCGplayer prices are daily estimates, not live sales or guaranteed offers. Bilgewater figures are optional manual comparison notes, never used for automatic collection totals. ${escapeHtml(priceUpdatedLabel())}.</p></div>`;const content=target.querySelector('.modal-content');if(content)content.insertAdjacentHTML('beforeend',html);};

// Extend the normal event delegation, without changing the existing scanner/deck controls.
document.addEventListener('click',async event=>{const btn=event.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;
 if(action==='bw-import-open'){showModal('bilgewater-import');return;}
 if(action==='bw-template'){exportBilgewaterTemplate();return;}
 if(action==='bw-price-open'){showModal('bilgewater-price',{cardId:btn.dataset.id,finish:btn.dataset.finish});return;}
 if(action==='bw-save-price'){
  const meta=getMeta(ui.modal?.cardId),finish=ui.modal?.finish,amount=Number(document.getElementById('bw-usd')?.value);
  if(!meta?.code||!['Foil','Normal'].includes(finish)||!Number.isFinite(amount)||amount<=0||amount>1000000)return toast('Enter a positive USD price up to $1,000,000.',true);
  bilgewaterPrices[bwPriceKey(meta,finish)]={usd:amount,recordedAt:new Date().toISOString()};saveBilgewaterPrices();closeModal();render();toast('Bilgewater price snapshot saved.');return;
 }
 if(action==='bw-delete-price'){
  const meta=getMeta(ui.modal?.cardId),finish=ui.modal?.finish;if(!meta?.code)return;
  delete bilgewaterPrices[bwPriceKey(meta,finish)];saveBilgewaterPrices();closeModal();render();toast('Saved price removed.');return;
 }
 if(action==='bw-import-save'){
  try{const n=importBilgewaterRows(document.getElementById('bw-csv')?.value);closeModal();render();toast('Imported '+n+' Bilgewater quote(s).');}catch(e){toast(e.message,true);}return;
 }
 if(action==='mobile-more'){showModal('menu');return;}
 if(action==='refresh-prices'){await loadPrices(true);return;}
 if(action==='wish-add'){const n=document.getElementById('wish-name')?.value.trim(),t=Number(document.getElementById('wish-qty')?.value);if(!n||!Number.isInteger(t)||t<1||t>999)return toast('Enter a card name and a goal between 1 and 999.',true);state.manualWishlist??={};const official=requirementName({name:n,section:'Legend'});for(const [k,w] of Object.entries(state.manualWishlist)){if(normalizeName(requirementName({name:w.name,section:'Legend'}))===normalizeName(official))delete state.manualWishlist[k];}state.manualWishlist[normalizeName(official)]={name:official,target:t};save();render();toast('Wishlist target saved.');return;}
 if(action==='wish-remove'){for(const [k,w] of Object.entries(state.manualWishlist||{})){if(normalizeName(requirementName({name:w.name,section:'Legend'}))===normalizeName(btn.dataset.name))delete state.manualWishlist[k];}save();render();toast('Personal wishlist goal removed.');return;}
 if(action==='location-add'){const n=document.getElementById('location-name')?.value.trim();if(!n||n.length>60||normalizeName(n)==='bulk'||state.locationNames.some(x=>normalizeName(x)===normalizeName(n)))return toast('Choose a unique location name (not Bulk).',true);state.locationNames.push(n);save();render();toast('Storage location created.');return;}
 if(action==='location-delete'){const n=btn.dataset.location;if(ownedEntries().some(e=>Number(state.extraLocations?.[e.key]?.[n]||0)>0))return toast('Return the stored cards before deleting this location.',true);state.locationNames=state.locationNames.filter(x=>x!==n);save();render();return;}
 if(action==='location-move'){const key=btn.dataset.key,n=document.querySelector(`select[data-store-select="${CSS.escape(key)}"]`)?.value;if(!n||!moveToStorage(key,n))return toast('Only Bulk cards can be moved to an existing location.',true);render();toast('Moved 1 to '+n+'.');return;}
 if(action==='location-return'){if(!returnFromStorage(btn.dataset.key,btn.dataset.location))return toast('That location has no available copy.',true);render();toast('Returned 1 to Bulk.');return;}
 if(action==='set-view'){ui.setFilter=btn.dataset.set;ui.query='';ui.tab='search';render();return;}
 if(action==='history-export'){exportHistoryCSV();return;}
 if(action==='history-undo-session'){undoLastSession();return;}
});


document.addEventListener('change',async event=>{if(event.target?.id==='bw-csv-file'){
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>2000000)return toast('CSV file must be smaller than 2 MB.',true);
 try{const text=await file.text();const field=document.getElementById('bw-csv');if(field)field.value=text;toast('CSV file loaded. Review its prices, then tap Import prices.');}catch(e){toast('Could not read CSV file.',true);}
}});

// Excel report: all physical locations, deck needs, price source, wishlist and scan history.
exportExcel=function(){const curr='USD',source='TCGplayer market via RiftHunt (daily estimate)';const summary=collectionPrice();const inventory=[['Card code','Card name','Set','Rarity','Finish','Total owned','Bulk','In decks','In storage','Unit price ('+curr+')','Est. total ('+curr+')','Price source']];for(const e of ownedEntries()){const q=priceQuoteByKey(e.key);inventory.push([e.card.code,e.card.name,e.card.setName,e.card.rarity,e.finish,e.qty,e.bulk,e.qty-e.bulk-e.stored,e.stored,q?.amount??'',q?q.amount*e.qty:'',q?source:'N/A']);}
 const locations=[['Card code','Card name','Finish','Location','Copies','Deck section']];for(const e of ownedEntries()){if(e.bulk)locations.push([e.card.code,e.card.name,e.finish,'Bulk',e.bulk,'']);for(const [n,count] of Object.entries(state.extraLocations?.[e.key]||{}))if(count)locations.push([e.card.code,e.card.name,e.finish,n,count,'']);for(const d of state.decks)for(const en of d.entries){const qty=Number(d.allocations?.[en.id]?.[e.key]||0);if(qty)locations.push([e.card.code,e.card.name,e.finish,d.name,qty,SECTION_LABEL[en.section]]);}}
 const requirements=[['Deck','Section','Card name','Collector code','Required','Assigned','Unassigned requirement','Available Bulk','Other decks']];for(const d of state.decks)for(const en of d.entries)requirements.push([d.name,SECTION_LABEL[en.section],requirementName(en),en.code||'',en.required,entryAssigned(d,en),Math.max(0,en.required-entryAssigned(d,en)),entryBulk(en),entryElsewhere(en,d)]);
 const wishes=[['Card','Decks needing card','Unassigned deck requirements','Bulk','Total owned','Personal goal','Still missing','Unit estimate ('+curr+')','Cost estimate ('+curr+')']];for(const r of smartWishlist())wishes.push([r.name,[...r.decks].join(', '),r.openNeeded,r.bulk,r.owned,r.manual||'',r.short,r.quote?.amount??'',r.quote?r.quote.amount*r.short:'']);
 const decks=[['Deck','Required copies','Assigned copies','Could assign from Bulk','Missing after Bulk','Assigned value ('+curr+')','Priced copies','Unpriced copies','Legality basic issues']];for(const d of state.decks){const n=deckStats(d),b=d.entries.reduce((v,e)=>v+Math.min(Math.max(0,e.required-entryAssigned(d,e)),entryBulk(e)),0),value=deckPrice(d);decks.push([d.name,n.need,n.assigned,b,Math.max(0,n.need-n.assigned-b),value.priced?value.total:'',value.priced,value.unpriced,deckLegalReview(d).issues.join('; ')]);}
 const history=[['Timestamp','Card name','Card code','Finish','Session','Description']];for(const a of state.activity.filter(x=>x.kind==='scan'))history.push([a.at,a.key?getMeta(unpackKey(a.key).id).name:'',a.key?getMeta(unpackKey(a.key).id).code:'',a.key?unpackKey(a.key).finish:'',a.session||'',scanActivityLabel(a)]);
 const overview=[['RiftVault Collection Report','Value'],['Exported at',new Date().toISOString()],['Owned copies',totalOwned()],['Unique card names',uniqueOwned()],['Copies in Bulk',totalBulk()],['Copies assigned to decks',totalOwned()-totalBulk()-totalStorage()],['Copies in named storage',totalStorage()],['Saved decks',state.decks.length],['Missing wishlist copies',smartWishlist().reduce((a,r)=>a+r.short,0)],['Market source',source],['Currency',curr],['Latest feed update',priceState.fetchedAt||'Unavailable'],['Known collection market estimate',summary.priced?summary.total:'N/A'],['Priced copies',summary.priced],['Unpriced copies',summary.unpriced],[],['Notes','Ownership includes Bulk + Decks + Storage once each.'],['Notes','Reference prices are estimates, not guaranteed selling prices.'],['Notes','Unpriced values are excluded, not zero.'],['Notes','Auto price feed: https://rifthunt.com/api/'],['Notes','Daily TCGplayer market estimates; refresh on app open when cache is due'],['Notes','Card catalogue: https://github.com/slimtreble/Riftbound-card-data']];const sheets=[{name:'Summary',rows:overview},{name:'Inventory',rows:inventory},{name:'Locations',rows:locations},{name:'Decks',rows:decks},{name:'Deck requirements',rows:requirements},{name:'Wishlist',rows:wishes},{name:'Scan history',rows:history}];download('RiftVault-Inventory-'+new Date().toISOString().slice(0,10)+'.xlsx',xlsxBlob(sheets),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('Excel exported: 7 sheets using TCGplayer daily market estimates.');};

// Print-code fallback for cameras that cannot focus on miniature collector text.
const scanViewBeforeCodeEntry=renderScan;
renderScan=function(){return scanViewBeforeCodeEntry().replace('<div id="scan-review"',
 `<div class="panel manual-code-panel mt12 mb12"><div class="eyebrow">IF THE CAMERA CANNOT READ THE CODE</div><p class="muted small">Enter the printed collector code (for example OGN-042a or SFD-R02a). This still adds the exact physical printing, without taking a photo.</p><div class="row wrap"><input id="scan-collector-input" class="input" style="flex:1;min-width:145px" autocomplete="off" autocapitalize="characters" placeholder="OGN-042a / SFD-R02a" aria-label="Printed collector code"><button class="btn btn-ghost" data-action="scan-code-lookup">Identify code</button></div></div><div id="scan-review"`);
};
function migrateAltArtNonfoilRecords(){
 const changes=[];
 for(const key of Object.keys(state.stock)){
  const {id,finish}=unpackKey(key),card=getMeta(id);
  if(finish==='Normal'&&isFoilOnlyAlternate(card)&&ownedQty(key)>0)changes.push([key,keyFor(id,'Foil')]);
 }
 if(!changes.length)return 0;
 // Preserve a copy of the pre-migration state as an additional recovery measure.
 try{localStorage.setItem('riftvault-pre-foil-only-migration-v114',JSON.stringify({at:new Date().toISOString(),state}));}catch(e){}
 for(const [oldKey,newKey] of changes){
  state.stock[newKey]=ownedQty(newKey)+ownedQty(oldKey);delete state.stock[oldKey];
  const stored=state.extraLocations?.[oldKey];
  if(stored){state.extraLocations[newKey]??={};for(const [location,count] of Object.entries(stored))state.extraLocations[newKey][location]=(state.extraLocations[newKey][location]||0)+Number(count||0);delete state.extraLocations[oldKey];}
  for(const deck of state.decks)for(const allocation of Object.values(deck.allocations||{}))if(allocation[oldKey]){allocation[newKey]=(allocation[newKey]||0)+allocation[oldKey];delete allocation[oldKey];}
  for(const activity of state.activity)if(activity.key===oldKey){activity.key=newKey;if(activity.kind==='scan')activity.message=String(activity.message||'').replace(/Non-foil/g,'Foil')+' [finish corrected]';}
 }
 logActivity(`Corrected ${changes.length} foil-only alternate-art inventory printing(s) while preserving allocations`,null,'correction');save();
 return changes.length;
}
indexPrices();rebuildIndexes();const foilFixed=migrateAltArtNonfoilRecords();render();loadCatalogue();loadRuneCatalogue();loadPrices();
if(foilFixed)toast(`Corrected ${foilFixed} alternate-art printing(s) to foil-only. Inventory counts were preserved.`);


// App resume: each fresh visit starts with an empty Recent Scans panel.
// This intentionally DOES NOT clear the durable Scan history or your inventory.
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden'){appWasHidden=true;if(scanner.running||scanner.starting)stopScanner();}
 else if(document.visibilityState==='visible'&&appWasHidden){appWasHidden=false;resetRecentVisit();}
});
window.addEventListener('pageshow',event=>{if(event.persisted){appWasHidden=false;resetRecentVisit();}});

/* v1.15 — unified Inventory / Sets, sorting in search and each set,
   and art-led deck covers. All controls are view-only: DATA_KEY stays unchanged. */
const SORT_OPTIONS = [
 ['number-asc','Card number (ascending)'],
 ['number-desc','Card number (descending)'],
 ['name-asc','Name (A–Z)'],
 ['name-desc','Name (Z–A)'],
 ['price-desc','Highest price'],
 ['price-asc','Lowest price'],
 ['qty-desc','Most copies owned'],
 ['qty-asc','Fewest copies owned']
];
const SORT_PREFS_KEY = 'riftvault-ui-sorts-v115';
let savedSorts = {};
try { savedSorts=JSON.parse(localStorage.getItem(SORT_PREFS_KEY)||'{}')||{}; }catch(e){}
for (const [field,fallback] of [['searchSort','number-asc'],['setSort','number-asc'],['inventorySort','name-asc']]) {
 ui[field] = SORT_OPTIONS.some(x=>x[0]===savedSorts[field])?savedSorts[field]:fallback;
}
ui.inventorySet=null;
ui.inventoryQuery='';
ui.inventoryBrowseOwned=false;
ui.setQuery='';
ui.setOwnedOnly=false;
function persistSorts(){
 try {localStorage.setItem(SORT_PREFS_KEY,JSON.stringify({searchSort:ui.searchSort,setSort:ui.setSort,inventorySort:ui.inventorySort}));}catch(e){}
}
function sortWidget(id,value){
 return `<label class="sort-control" for="${id}"><span>Sort by</span><select id="${id}" class="select" aria-label="Sort cards">${SORT_OPTIONS.map(([key,label])=>`<option value="${key}" ${value===key?'selected':''}>${label}</option>`).join('')}</select></label>`;
}
function naturalCodeCompare(a,b){
 const aa=String(a?.code||''),bb=String(b?.code||'');
 if(!aa&&!bb)return 0;if(!aa)return 1;if(!bb)return -1;
 return aa.localeCompare(bb,undefined,{numeric:true,sensitivity:'base'});
}
function printingOwned(p){return ownedQty(keyFor(p.id,'Normal'))+ownedQty(keyFor(p.id,'Foil'));}
function printingMarket(p){
 const a=quoteFor(p,'Normal')?.amount, b=quoteFor(p,'Foil')?.amount;
 const prices=[a,b].filter(x=>typeof x==='number'&&Number.isFinite(x)&&x>0);
 return prices.length?Math.max(...prices):null;
}
function displayPrintingMarket(p){
 const n=quoteFor(p,'Normal'),f=quoteFor(p,'Foil');
 const q=n&&f?(n.amount>=f.amount?n:f):(n||f);
 return q?`<span class="card-price-label">TCGplayer${n&&f?' · up to':''}</span> <strong>${priceHtml(q)}</strong>`:`<span class="card-price-label">TCGplayer</span> <strong>N/A</strong>`;
}
function groupForSet(g,set){
 const prints=set==='all'?g.printings:g.printings.filter(p=>p.set===set);
 return {name:g.name,printings:prints,defaultPrint:prints.find(p=>!p.isVariant&&!p.isAltArt)||prints[0]||g.defaultPrint};
}
function sortEntries(list,key,details){
 const price=details.price,qty=details.qty,card=details.card,name=details.name;
 return [...list].sort((a,b)=>{
  let primary=0;
  if(key.startsWith('price-')){
   const av=price(a),bv=price(b);
   // Missing prices always sort AFTER quoted cards in either direction.
   if(av==null&&bv!=null)return 1;
   if(bv==null&&av!=null)return -1;
   primary=av==null?0:(key==='price-desc'?bv-av:av-bv);
  }else if(key.startsWith('qty-')) primary=key==='qty-desc'?qty(b)-qty(a):qty(a)-qty(b);
  else if(key.startsWith('name-')) primary=key==='name-desc'?name(b).localeCompare(name(a)):name(a).localeCompare(name(b));
  else primary=key==='number-desc'?naturalCodeCompare(card(b),card(a)):naturalCodeCompare(card(a),card(b));
  return primary||naturalCodeCompare(card(a),card(b))||name(a).localeCompare(name(b));
 });
}
function sortSearchGroup(groups,field){
 return sortEntries(groups,field,{
  price:g=>{const p=g.printings.map(printingMarket).filter(v=>v!=null);return p.length?Math.max(...p):null;},
  qty:g=>g.printings.reduce((n,p)=>n+printingOwned(p),0),card:g=>g.defaultPrint,name:g=>g.name
 });
}
function sortedPrintings(prints,field){return sortEntries(prints,field,{
 price:printingMarket,qty:printingOwned,card:p=>p,name:p=>p.name
});}
function setPrintings(set){
 // Multiple distinct catalogue printing IDs can share a collector-number label.
 // Keep them distinct; the rendering layer displays their actual artwork/rarity.
 return [...allPrintings.values()].filter(p=>p.set===set && p.id && p.code);
}

function setLogoLabel(set,name){
 const known={OGN:'ORIGINS',SFD:'SPIRITFORGED',UNL:'UNLEASHED',VEN:'VENDETTA',RAD:'RADIANCE'};
 return `<div class="set-emblem set-emblem-${escapeHtml(set.toLowerCase())}"><span class="set-emblem-sigil">✦</span><span class="set-emblem-name">${escapeHtml(known[set]||name||set)}</span><span class="set-emblem-line"></span></div>`;
}
function deckLegendArt(deck){
 const legend=deck.entries.find(e=>e.section==='Legend');
 if(!legend)return `<div class="deck-cover-art deck-cover-fallback" aria-hidden="true">✧</div>`;
 let options=eligiblePrintings(legend);
 if(!options.length)options=printingsFor(legend.name);
 // Prefer actually assigned artwork; otherwise use a standard matching Legend.
 const allocated=Object.keys(deck.allocations?.[legend.id]||{}).find(k=>Number(deck.allocations[legend.id][k])>0);
 const selected=(allocated?getMeta(unpackKey(allocated).id):null)||options.find(p=>!p.isAltArt&&p.imageUrl)||options.find(p=>p.imageUrl)||options[0];
 return selected?.imageUrl?`<img class="deck-cover-art" src="${escapeHtml(selected.imageUrl)}" alt="${escapeHtml(legend.name)} legend art" loading="lazy" onerror="this.style.display='none'"/>`:`<div class="deck-cover-art deck-cover-fallback" aria-hidden="true">✧</div>`;
}
// v1.17: search individual physical printings, never a grouped card name.
function matchingSearchPrintings(){
 const text=normalizeName(ui.query),code=normalizedCode(ui.query);
 let found=[...allPrintings.values()].filter(p=>{
  if(!p.id || !p.code)return false;
  if(ui.setFilter!=='all' && p.set!==ui.setFilter)return false;
  if(ui.ownedOnly && printingOwned(p)===0)return false;
  return !text || normalizeName(p.name).includes(text) || normalizeName(p.shortName).includes(text) ||
   normalizeName(p.setName).includes(text) || (code && normalizedCode(p.code).includes(code)) ||
   (code && normalizedCode(p.publicCode).includes(code));
 });
 // Exact/full-name matches appear first with the default sort only; otherwise the
 // selected collector number / price / quantity order is always respected.
 return sortedPrintings(found,ui.searchSort);
}
renderSearch=function(){
 const all=matchingSearchPrintings(),shown=all.slice(0,96);
 const sets=[...new Map(catalog.map(c=>[c.set,c.setName])).entries()].filter(([s])=>s).sort((a,b)=>a[1].localeCompare(b[1]));
 return `<div class="row-between mb18 wrap"><div><h2>Search Riftbound cards</h2><p class="muted small">Every printing is a separate card. Search by name, set or collector number to find the exact artwork.</p></div><span class="pill">${fmt(all.length)} printings</span></div>
 <div class="toolbar sort-toolbar">
  <div class="search-wrap"><span class="search-icon">⌕</span><input id="card-search" class="input input-search" autocomplete="off" placeholder="Search a card name, code or set…" value="${escapeHtml(ui.query)}" /></div>
  <select id="set-filter" class="select" aria-label="Filter by set"><option value="all">All sets</option>${sets.map(([s,n])=>`<option value="${escapeHtml(s)}" ${ui.setFilter===s?'selected':''}>${escapeHtml(n||s)}</option>`).join('')}</select>
  <label class="checkbox-line"><input id="owned-only" type="checkbox" ${ui.ownedOnly?'checked':''}/> Owned only</label>${sortWidget('search-sort',ui.searchSort)}
 </div>
 ${shown.length?`<div class="card-grid">${shown.map(p=>{const owned=printingOwned(p);return `<button type="button" class="collection-card" data-action="card-detail" data-name="${escapeHtml(p.name)}" data-id="${escapeHtml(p.id)}" aria-label="View ${escapeHtml(p.name)}, ${escapeHtml(p.code)}"><div class="card-art" title="Tap artwork to enlarge">${cardArt(p)}${owned?`<span class="owned-chip">×${owned} owned</span>`:''}</div><div class="card-meta"><strong title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</strong>${banBadge(p.name)}<div class="card-sub"><span>${escapeHtml(p.code||p.id)}</span><span>${escapeHtml(isOvernumberedPrinting(p)?printingLabel(p):p.isAltArt?'Alternate art':p.rarity||'Printing')}</span></div><div class="card-printing-set">${escapeHtml(p.setName||p.set)}</div><div class="card-price-tag">${displayPrintingMarket(p)}</div></div></button>`}).join('')}</div>${all.length>shown.length?`<p class="muted small text-center mt16">Showing ${shown.length} of ${all.length} printings. Search to narrow your list.</p>`:''}`:`<div class="empty"><h3>No matching printings</h3><p>Try a shorter name or collector number. Online catalogue data may be needed.</p></div>`}`;
};

function setTileHTML(r){
 const count=r.names.size,pct=count?Math.round(r.haveNames.size/count*100):0;
 return `<button class="set-collection-tile" data-action="inventory-open-set" data-set="${escapeHtml(r.set)}" aria-label="Browse ${escapeHtml(r.setName)} set">
  <div class="set-brand-surface">${setLogoLabel(r.set,r.setName)}<span class="set-code-tag">${escapeHtml(r.set)}</span></div>
  <div class="set-collection-info"><div class="row-between"><strong>${escapeHtml(r.setName)}</strong><span class="muted micro">${pct}%</span></div>
   <div class="set-count"><span>${r.haveNames.size} / ${count} Cards</span><span>Browse →</span></div>
   <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
  </div></button>`;
}
function inventorySummary(){return `<div class="stats"><div class="stat-card"><div class="stat-top">TOTAL COPIES</div><div class="stat-value">${fmt(totalOwned())}</div></div><div class="stat-card"><div class="stat-top">BULK</div><div class="stat-value">${fmt(totalBulk())}</div></div><div class="stat-card"><div class="stat-top">IN DECKS</div><div class="stat-value">${fmt(totalOwned()-totalBulk()-totalStorage())}</div></div><div class="stat-card"><div class="stat-top">STORAGE</div><div class="stat-value">${fmt(totalStorage())}</div></div></div>`;}
function ownedRowView(entries){
 return entries.length?`<div class="inventory-list">${entries.slice(0,120).map(e=>{
  const quote=priceQuoteByKey(e.key),decks=e.qty-e.bulk-e.stored;
  return `<article class="inventory-row"><button type="button" class="inventory-thumb card-zoom-trigger" data-action="image-preview" data-id="${escapeHtml(e.card.id)}" data-finish="${escapeHtml(e.finish)}" aria-label="Enlarge ${escapeHtml(e.card.name)} card art">${cardArt(e.card)}</button><div class="inventory-main"><strong>${escapeHtml(e.card.name)}</strong><span class="inventory-sub">${escapeHtml(e.card.code)} · ${escapeHtml(e.card.setName)}</span><span class="inventory-finish">${escapeHtml(e.finish)}</span><div class="inventory-location">Owned ${e.qty} · Bulk ${e.bulk} · Decks ${decks} · Storage ${e.stored}</div></div><div class="inventory-price"><span class="inventory-price-label">TCGplayer daily estimate</span><strong>${priceHtml(quote)}</strong><span class="muted micro">${quote?`Total ${escapeHtml(priceText({amount:quote.amount*e.qty}))}`:'No exact price quote'}</span></div><div class="inventory-actions"><div class="quantity-controls"><span class="inventory-bulk-label">Bulk</span><button class="btn btn-small btn-icon" data-action="bulk-remove" data-key="${escapeHtml(e.key)}" ${e.bulk?'':'disabled'}>−</button><span class="num">${e.bulk}</span><button class="btn btn-small btn-icon btn-green-outline" data-action="bulk-add" data-key="${escapeHtml(e.key)}">＋</button></div><button class="btn btn-small btn-ghost" data-action="card-detail" data-name="${escapeHtml(e.card.name)}" data-id="${escapeHtml(e.card.id)}">Details ›</button></div></article>`;
 }).join('')}</div>${entries.length>120?`<p class="muted small">Showing 120 of ${entries.length} matches. Refine your search.</p>`:''}`:`<div class="empty"><h3>No owned copies match</h3><p>Try another search, or open a set to browse its complete catalogue.</p></div>`;
}
function renderSetBrowser(){
 const set=ui.inventorySet, meta=setGroups().find(x=>x.set===set);
 const setName=meta?.setName||set;
 let prints=setPrintings(set);
 const q=normalizeName(ui.setQuery),codeQuery=normalizedCode(ui.setQuery);
 if(q)prints=prints.filter(p=>normalizeName(p.name).includes(q)||(codeQuery&&normalizedCode(p.code).includes(codeQuery)));
 if(ui.setOwnedOnly)prints=prints.filter(p=>printingOwned(p)>0);
 prints=sortedPrintings(prints,ui.setSort);
 const shown=prints.slice(0,84);
 return `<button class="btn btn-ghost btn-small mb18" data-action="inventory-back-sets">← All sets</button>
 <div class="set-view-banner set-theme-${escapeHtml(set.toLowerCase())}">${setLogoLabel(set,setName)}<div class="set-banner-stats"><strong>${meta?.haveNames.size||0} / ${meta?.names.size||prints.length} Cards</strong><span>${escapeHtml(set)} · Collection completion</span></div></div>
 <div class="row-between mb18 wrap"><div><h2>${escapeHtml(setName)} cards</h2><p class="muted small">Browse individual printings, including alternate art, foil market references and collector numbers.</p></div><span class="pill">${fmt(prints.length)} printings</span></div>
 <div class="toolbar sort-toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input id="set-card-search" class="input input-search" placeholder="Search this set…" value="${escapeHtml(ui.setQuery)}" /></div><label class="checkbox-line"><input id="set-owned-only" type="checkbox" ${ui.setOwnedOnly?'checked':''}/> Owned only</label>${sortWidget('set-sort',ui.setSort)}</div>
 ${shown.length?`<div class="card-grid">${shown.map(p=>{const count=printingOwned(p);return `<button class="collection-card" data-action="card-detail" data-name="${escapeHtml(p.name)}" data-id="${escapeHtml(p.id)}"><div class="card-art">${cardArt(p)}${count?`<span class="owned-chip">×${count} owned</span>`:''}</div><div class="card-meta"><strong title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</strong>${banBadge(p.name)}<div class="card-sub"><span>${escapeHtml(p.code)}</span><span>${escapeHtml(isOvernumberedPrinting(p)?printingLabel(p):p.isAltArt?'Alt art':p.rarity)}</span></div><div class="card-price-tag">${displayPrintingMarket(p)}</div></div></button>`;}).join('')}</div>${prints.length>shown.length?`<p class="muted small text-center mt16">Showing ${shown.length} of ${prints.length} printings. Search to narrow the set.</p>`:''}`:`<div class="empty"><h3>No cards matched</h3><p>Try another name or collector number.</p></div>`}`;
}
renderInventory=function(){
 if(ui.inventorySet)return renderSetBrowser();
 const q=normalizeName(ui.inventoryQuery);
 const matched=ownedEntries().filter(e=>!q||normalizeName(e.card.name+' '+e.card.code+' '+e.finish+' '+e.card.setName).includes(q));
 const entries=sortEntries(matched,ui.inventorySort,{
  price:e=>priceQuoteByKey(e.key)?.amount??null,qty:e=>e.qty,card:e=>e.card,name:e=>e.card.name
 });
 const showOwned=!!q||ui.inventoryBrowseOwned;
 return `<div class="row-between wrap mb24"><div><h2>Inventory & sets</h2><p class="muted small">Choose a set to browse its cards, or search your owned collection. Physical copies stay tracked by printing and finish.</p></div><div class="row wrap"><button class="btn btn-ghost" data-action="excel">↧ Export Excel</button><button class="btn btn-primary" data-nav="scan">▣ Scan cards</button></div></div>${inventorySummary()}${priceSourceBlock()}
 <div class="panel inventory-lookup"><div class="row-between wrap mb12"><h3>Find cards you own</h3><button class="btn btn-small btn-ghost" data-action="inventory-toggle-owned">${ui.inventoryBrowseOwned?'Hide owned list':'Browse all owned copies'}</button></div><div class="toolbar sort-toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input id="inventory-search" class="input input-search" placeholder="Search your inventory…" value="${escapeHtml(ui.inventoryQuery)}" /></div>${sortWidget('inventory-sort',ui.inventorySort)}</div>${showOwned?ownedRowView(entries):`<p class="muted small" style="margin:0">Your collection stays organised by set below. Search above to see owned copies and quantity controls.</p>`}</div>
 <div class="section-title"><h2>Browse by set</h2><span class="pill">${setGroups().length} sets</span></div><div class="set-collection-grid">${setGroups().map(setTileHTML).join('')}</div>${!catalogReady?`<p class="info-note mt16">Set completion depends on catalogue data. Connect to the internet and refresh if some cards are missing.</p>`:''}`;
};
// Old navigation references and older deep-linked "Sets" pages now use Inventory.
const _setTabBeforeV115=setTab;
setTab=function(tab){if(tab==='sets')tab='inventory';if(tab==='inventory')ui.inventorySet=null;_setTabBeforeV115(tab);};
// Sort / set controls use dedicated IDs to preserve the existing scanner and deck listeners.
document.addEventListener('change',event=>{
 const t=event.target;
 const fields={'search-sort':'searchSort','set-sort':'setSort','inventory-sort':'inventorySort'};
 if(fields[t.id]){ui[fields[t.id]]=t.value;persistSorts();render();}
 else if(t.id==='set-owned-only'){ui.setOwnedOnly=t.checked;render();}
});
document.addEventListener('input',event=>{
 if(event.target.id!=='set-card-search')return;
 const t=event.target;ui.setQuery=t.value;
 const pos=t.selectionStart;render();const el=document.getElementById('set-card-search');
 if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch(e){}}
});
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-action]');if(!btn)return;
 switch(btn.dataset.action){
  case 'inventory-open-set':ui.tab='inventory';ui.inventorySet=btn.dataset.set;ui.setQuery='';ui.setOwnedOnly=false;render();window.scrollTo(0,0);break;
  case 'inventory-back-sets':ui.inventorySet=null;ui.setQuery='';render();window.scrollTo(0,0);break;
  case 'inventory-toggle-owned':ui.inventoryBrowseOwned=!ui.inventoryBrowseOwned;render();break;
 }
});
// Initialise the new view without touching persistent inventory/deck records.


// ----- v1.16 Searchable Rules Library -----------------------------------
// These are brief navigation summaries, NOT a full copy of Riot's official
// rulebook. The links below always lead to the primary source.
const OFFICIAL_RULES_HUB='https://playriftbound.com/en-us/rules-hub/';
const OFFICIAL_CORE_RULES='https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/5c7946f7c3b8c6e0faff85ab6dadc6d2e721ea94.pdf';
const OFFICIAL_TOURNAMENT_RULES='https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/861752822d217edf37d9febaeaf77a7d924c1bb6.pdf';
const RULES_CATEGORIES=['All topics','Deck building','Gameplay','Keywords','Tournament','Errata'];
// Search by name, everyday-language description, synonyms or numbered section.
const RULES_TOPICS=[
 {cat:'Deck building',title:'Deck construction',ref:'103',summary:'A deck uses a Champion Legend, a Main Deck, a separate 12-card Rune Deck and battlefields chosen for the play mode. The Chosen Champion is included in the Main Deck total.',tags:'build size deck legal 40 champion'},
 {cat:'Deck building',title:'Main Deck size',ref:'103.3',summary:'Your Main Deck has at least 40 cards including a Chosen Champion Unit. Some formats or events add their own requirements.',tags:'40 cards minimum chosen champion deck count'},
 {cat:'Deck building',title:'Champion Legend and Chosen Champion',ref:'103.2–103.3',summary:'Your Legend establishes domain identity. Your Chosen Champion must be a Champion Unit whose champion tag matches the Legend.',tags:'legend champion match tag'},
 {cat:'Deck building',title:'Domain identity',ref:'103.2.b',summary:'Deck contents must comply with the domains shown on your Champion Legend, unless a special rule or effect permits otherwise.',tags:'colour color domains deck identity'},
 {cat:'Deck building',title:'Three-copy limit',ref:'103.3.b',summary:'Your Main Deck can contain up to three copies of the same named card, counting the Chosen Champion copy where relevant.',tags:'max copies duplicate 3'},
 {cat:'Deck building',title:'Signature card limit',ref:'103.3.d',summary:'Main Deck signature cards share a combined three-card limit and must match the Champion Legend tag.',tags:'signature cards champion total'},
 {cat:'Deck building',title:'Rune Deck rules',ref:'103.4',summary:'Your Rune Deck has 12 cards, is kept separate from the Main Deck, and must follow your Legend’s domain identity.',tags:'12 runes mana power'},
 {cat:'Deck building',title:'Battlefield selection',ref:'103.5',summary:'The game mode determines how many battlefields are used; when you supply multiple, they cannot repeat the same battlefield name.',tags:'3 battlefield unique locations'},
 {cat:'Gameplay',title:'Golden Rule',ref:'002',summary:'If a card’s text directly contradicts a general rule, follow the card’s instruction. Other restrictions can still apply.',tags:'priority contradictory exception card text'},
 {cat:'Gameplay',title:'Can’t beats can',ref:'054',summary:'When one applicable effect prohibits something and another permits it, the prohibition generally wins.',tags:'cannot forbidden prohibition conflicts'},
 {cat:'Gameplay',title:'Turn phases',ref:'301',summary:'Turns follow a defined phase sequence. Look up Channel, Main and End phase details before resolving timing questions.',tags:'turn order timing phase channel main action'},
 {cat:'Gameplay',title:'Playing a card',ref:'349',summary:'Playing a card follows rules for legality, choices, costs and resolution. Reaction timing and targeting are handled here too.',tags:'spell unit gear cost energy power'},
 {cat:'Gameplay',title:'Chain and priority',ref:'327',summary:'Cards and abilities can be processed on the Chain. Priority determines when players may respond, and chain items resolve in order.',tags:'respond response stack reaction timing'},
 {cat:'Gameplay',title:'Combat',ref:'461',summary:'Combat has defined steps for attacking, defending, damage and related effects. Check the official sequence for contested battlefields.',tags:'attack fight defenders battle'},
 {cat:'Gameplay',title:'Scoring and victory',ref:'193, 469',summary:'Points can come from holding or conquering battlefields and card effects. Winning also requires meeting the victory condition at cleanup.',tags:'score hold conquer win 8 points'},
 {cat:'Gameplay',title:'Ready and exhausted',ref:'143',summary:'Units ordinarily enter exhausted unless an effect changes this. Ready/exhausted status affects actions and movement.',tags:'tap untap accelerate ready exhausted'},
 {cat:'Gameplay',title:'Rune resources and costs',ref:'200–299',summary:'The rules distinguish Energy, Power, domains and costs. Consult the detailed resource rules when paying for cards and abilities.',tags:'channel rune mana power energy cost'},
 {cat:'Gameplay',title:'Moving and recalling',ref:'450–460',summary:'Move and Recall are distinct game actions. Recalling returns a permanent to base and does not count as a Move.',tags:'move base battlefield teleport recall ganking'},
 {cat:'Gameplay',title:'Showdowns',ref:'341',summary:'Showdowns cover interactions at battlefields and have their own timing rules. Some keywords permit cards to be played during them.',tags:'action reaction battle showdown'},
 {cat:'Keywords',title:'Accelerate',ref:'805',summary:'A unit with Accelerate may pay an additional cost as it is played so it enters ready instead of exhausted.',tags:'fast ready haste'},
 {cat:'Keywords',title:'Action',ref:'806',summary:'Action grants permission to play a card or activate an ability during showdowns, subject to the other normal restrictions.',tags:'timing instant showdown'},
 {cat:'Keywords',title:'Assault',ref:'807',summary:'Assault grants extra Might while that unit is an attacker. The number on the keyword is its bonus.',tags:'might attack bonus'},
 {cat:'Keywords',title:'Deathknell',ref:'808',summary:'Deathknell is a triggered ability tied to a permanent dying. The printed effect tells you what it does.',tags:'death die killed trash'},
 {cat:'Keywords',title:'Deflect',ref:'809',summary:'Deflect adds a Power cost when an opponent targets the protected object with spells or abilities.',tags:'protection target extra cost'},
 {cat:'Keywords',title:'Ganking',ref:'810',summary:'Ganking permits a unit to make a standard move from one battlefield to another battlefield.',tags:'move battlefield travel'},
 {cat:'Keywords',title:'Hidden',ref:'811',summary:'Hidden permits placing eligible cards facedown at a controlled battlefield under its specific conditions, with later play permissions.',tags:'face down hide surprise'},
 {cat:'Keywords',title:'Reaction',ref:'800',summary:'Reaction is a timing keyword. Refer to its current glossary entry to determine exactly when a card can be played.',tags:'respond stack counter timing'},
 {cat:'Keywords',title:'Backline',ref:'800',summary:'Backline affects combat damage assignment. See its official keyword entry for ordering and exceptions.',tags:'defend protect damage'},
 {cat:'Keywords',title:'Temporary',ref:'800',summary:'Temporary modifies how long a game object remains available. Consult the official wording for when it is removed.',tags:'expire token cleanup'},
 {cat:'Keywords',title:'Repeat',ref:'800',summary:'Repeat can modify how a spell is paid for or executed. Check its official keyword definition for payment and limits.',tags:'cast multiple extra cost'},
 {cat:'Tournament',title:'Constructed legality and bans',ref:'Rules Hub',summary:'The official Rules Hub keeps the current sanctioned-format legality and ban lists. Recheck it before an event: restrictions can change.',tags:'banned prohibited legal standard cards battlefield'},
 {cat:'Tournament',title:'Tournament policy',ref:'Tournament Rules',summary:'The official Tournament Rules cover event procedures, player responsibilities, tournament matches and penalties.',tags:'judges event timed match sideboard penalties'},
 {cat:'Tournament',title:'Formats and sideboards',ref:'Tournament Rules',summary:'Game modes and tournament formats can change required battlefields, match structure and sideboard procedures.',tags:'best of 3 sideboard 1v1 2v2'},
 {cat:'Errata',title:'Card errata',ref:'Rules Hub',summary:'Card errata update printed wording. If a card’s wording is disputed, check the latest official errata for that set.',tags:'updated wording correction card text'},
 {cat:'Errata',title:'Rules patch notes',ref:'Rules Hub',summary:'The Rules Hub links patch notes that explain rulebook revisions and common clarifications for each set.',tags:'faq changes updates clarifications'},
];
ui.rulesQuery='';ui.rulesCategory='All topics';ui.rulesReturnDeckId=null;
NAV.push({id:'rules',icon:'⚖',name:'Rules library'});
function rulesSource(topic){return topic.cat==='Tournament'?'Tournament Rules':topic.cat==='Errata'?'Rules Hub':'Core Rules';}
function rulesLink(topic){return topic.cat==='Tournament'?OFFICIAL_TOURNAMENT_RULES:topic.cat==='Errata'||topic.ref==='Rules Hub'?OFFICIAL_RULES_HUB:OFFICIAL_CORE_RULES;}
function renderRules(){
 const cat=ui.rulesCategory;
 return `<div class="rules-view">
 ${ui.rulesReturnDeckId&&findDeck(ui.rulesReturnDeckId)?'<button class="btn btn-small btn-ghost mb18" data-action="rules-back-deck">← Back to my deck</button>':''}
 <div class="rules-hero"><div class="eyebrow">RIFTBOUND REFERENCE</div><h2>Rules Library</h2><p>Search gameplay, deck construction and keyword explanations. Each result links to Riot’s official source.</p><div class="rules-release">Official Core & Tournament Rules: 9 October 2026 · Summaries are offline, not live rulings</div></div>
 <div class="rules-quicklinks"><a class="btn btn-ghost" href="${OFFICIAL_RULES_HUB}" target="_blank" rel="noopener noreferrer">↗ Official Rules Hub</a><a class="btn btn-ghost" href="${OFFICIAL_CORE_RULES}" target="_blank" rel="noopener noreferrer">↗ Core Rules PDF</a><a class="btn btn-ghost" href="${OFFICIAL_TOURNAMENT_RULES}" target="_blank" rel="noopener noreferrer">↗ Tournament PDF</a><a class="btn btn-ghost" href="https://riftbound.gg/rules/core-rules/" target="_blank" rel="noopener noreferrer" title="Unofficial searchable copy; verify with Riot">↗ Search full rulebook (third-party)</a></div>
 <div class="panel rules-browser"><label for="rules-search" class="filter-label">SEARCH RULES & KEYWORDS</label><div class="search-wrap rules-search-wrap"><span class="search-icon">⌕</span><input type="search" class="input input-search" id="rules-search" autocomplete="off" placeholder="Try Deflect, combat, runes, deck size…" value="${escapeHtml(ui.rulesQuery)}" /></div>
 <div class="rules-filters" role="group" aria-label="Rules category">${RULES_CATEGORIES.map(c=>`<button class="rules-filter ${cat===c?'is-active':''}" data-action="rules-category" data-category="${escapeHtml(c)}" aria-pressed="${cat===c?'true':'false'}">${escapeHtml(c)}</button>`).join('')}</div>
 <div class="row-between rules-results-label"><strong id="rules-count">${RULES_TOPICS.length} topics</strong><span class="muted micro">Tap a topic to open the official source ↗</span></div>
 <div id="rules-results" class="rules-topic-list">${RULES_TOPICS.map(t=>`<article class="rules-topic" data-rule-cat="${escapeHtml(t.cat)}" data-rule-keywords="${escapeHtml((t.title+' '+t.ref+' '+t.summary+' '+t.tags).toLowerCase())}"><div class="rules-topic-top"><span class="rules-topic-type">${escapeHtml(t.cat)}</span><span class="rules-reference">${escapeHtml(t.ref)}</span></div><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.summary)}</p><a href="${rulesLink(t)}" target="_blank" rel="noopener noreferrer" class="rules-official-link">Read ${escapeHtml(rulesSource(t))} ↗</a></article>`).join('')}</div>
 <div id="rules-empty" class="empty" hidden><h3>No rules matched</h3><p>Try another keyword or open the official PDF for the complete rulebook.</p></div>
 </div><p class="muted small rules-disclaimer">Short explanations are for quick reference, not a replacement for official numbered rules, tournament policy, new errata or judge rulings. Always check Riot’s Rules Hub for the newest document.</p></div>`;
}
function filterRulesView(){
 const q=normalizeName(ui.rulesQuery||'');let n=0;
 document.querySelectorAll('#rules-results .rules-topic').forEach(el=>{
  const match=(ui.rulesCategory==='All topics'||el.dataset.ruleCat===ui.rulesCategory)&&(!q||normalizeName(el.dataset.ruleKeywords).includes(q));
  el.hidden=!match;if(match)n++;
 });
 const count=document.getElementById('rules-count');if(count)count.textContent=`${n} topic${n===1?'':'s'}`;
 const empty=document.getElementById('rules-empty');if(empty)empty.hidden=n!==0;
}
document.addEventListener('input',event=>{
 if(event.target.id==='rules-search'){ui.rulesQuery=event.target.value;filterRulesView();}
});
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el)return;
 if(el.dataset.action==='rules-category'){
  ui.rulesCategory=el.dataset.category;document.querySelectorAll('.rules-filter').forEach(b=>{const selected=b.dataset.category===ui.rulesCategory;b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected));});filterRulesView();
 }
 if(el.dataset.action==='deck-rules'){
  ui.rulesReturnDeckId=ui.deckId;ui.rulesCategory='Deck building';ui.rulesQuery='';setTab('rules');filterRulesView();
 }
 if(el.dataset.action==='rules-back-deck'){
  const id=ui.rulesReturnDeckId;ui.rulesReturnDeckId=null;setTab('decks');if(id&&findDeck(id)){ui.deckId=id;render();}
 }
});

// ---- v1.17: exact-printing details and full-screen artwork viewer --------
// No changes to localStorage schemas: stock keys, allocations, saved decks and
// quotes continue to be keyed by immutable catalogue printing ID and finish.
function printingLocations(card){
 const keys=Object.keys(state.stock).filter(key=>unpackKey(key).id===card.id && ownedQty(key)>0);
 const rows=[];
 for(const key of keys){
  const finish=unpackKey(key).finish,bulk=bulkQty(key);
  if(bulk)rows.push({label:'Bulk',finish,quantity:bulk});
  for(const [location,amount] of Object.entries(state.extraLocations?.[key]||{}))if(amount>0)rows.push({label:location,finish,quantity:amount});
  for(const deck of state.decks){
   const amount=Object.values(deck.allocations||{}).reduce((n,allocation)=>n+Number(allocation[key]||0),0);
   if(amount>0)rows.push({label:deck.name,finish,quantity:amount});
  }
 }
 return rows;
}
function modalPrintingDetail(){
 const p=getMeta(ui.modal.id);if(!p?.id)return modalShell('Card unavailable','','<p class="muted">Refresh the catalogue to load this printing.</p>');
 const normal=keyFor(p.id,'Normal'),foil=keyFor(p.id,'Foil'),locations=printingLocations(p);
 const count=ownedQty(normal)+ownedQty(foil),finishOnly=isFoilOnlyAlternate(p);
 const label=printingLabel(p);
 const quoteNormal=quoteFor(p,'Normal'),quoteFoil=quoteFor(p,'Foil');
 const locationRows=locations.length?locations.map(r=>`<div class="location-row"><div><strong>${escapeHtml(r.label)}</strong><div class="muted micro">${escapeHtml(r.finish)}</div></div><strong>${r.quantity}</strong></div>`).join(''):'<p class="muted small">No copies of this printing recorded yet.</p>';
 return modalShell(p.name,`${p.code||p.id} · ${p.setName||p.set} · ${label} · ${count} owned`,
 `<div class="printing-detail-layout"><button type="button" class="printing-detail-art card-zoom-trigger" data-action="image-preview" data-id="${escapeHtml(p.id)}" title="Enlarge artwork" aria-label="Enlarge ${escapeHtml(p.name)} artwork">${cardArt(p)}<span class="zoom-hint">⌕ Tap to enlarge</span></button><div class="printing-detail-side">${banDetailNotice(p.name)}<div class="eyebrow">WHERE ARE MY CARDS?</div><div class="mt16">${locationRows}</div><div class="printing-qty-breakdown"><span>Non-foil <strong>${ownedQty(normal)}</strong></span><span>Foil <strong>${ownedQty(foil)}</strong></span></div><h3>Add this printing to Bulk</h3><p class="muted small">Adds one copy of ${escapeHtml(p.code)} only — not another artwork.</p><div class="row wrap"><select class="select" data-card-finish="${escapeHtml(p.id)}" aria-label="Finish for ${escapeHtml(p.code)}">${finishOnly?'<option value="Foil">Foil only</option>':'<option value="Normal">Non-foil</option><option value="Foil">Foil</option>'}</select><button class="btn btn-green-outline" data-action="add-from-detail" data-id="${escapeHtml(p.id)}">＋ Add to Bulk</button></div></div></div>
 <div class="panel printing-detail-prices"><div class="row-between wrap"><h3>TCGplayer market prices</h3><span class="muted micro">USD · RiftHunt daily estimates</span></div><div class="printing-price-grid"><div><span>Non-foil</span><strong>${priceHtml(quoteNormal)}</strong></div><div><span>Foil</span><strong>${priceHtml(quoteFoil)}</strong></div></div><div class="row wrap mt16"><a class="btn btn-small btn-ghost" href="${escapeHtml(bilgewaterLink(p))}" target="_blank" rel="noopener noreferrer">Bilgewater Market ↗</a><button class="btn btn-small btn-ghost" data-action="bw-price-open" data-id="${escapeHtml(p.id)}" data-finish="${finishOnly?'Foil':'Normal'}">Bilgewater note</button></div></div>`,
 '<button class="btn" data-action="close-modal">Close</button>',true);
}
function modalImagePreview(){
 const p=getMeta(ui.modal.id),finish=ui.modal.finish|| (isFoilOnlyAlternate(p)?'Foil':'');
 const artwork=p.imageUrl?`<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)} ${escapeHtml(p.code)} full artwork" draggable="false" onerror="this.style.display='none';this.parentElement.classList.add('artwork-unavailable')" />`:'<p class="muted">No high-resolution artwork available for this printing.</p>';
 return `<div class="art-preview-backdrop" data-action="art-preview-close"><section class="art-preview-dialog" role="dialog" aria-modal="true" aria-label="Card artwork for ${escapeHtml(p.name)}" tabindex="-1"><div class="art-preview-header"><div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.code||p.id)} · ${escapeHtml(p.setName||p.set||'')}${finish?' · '+escapeHtml(finish):''}</span></div><div class="row"><button type="button" class="btn btn-small btn-ghost" data-action="art-preview-zoom" aria-label="Zoom artwork">Zoom ＋</button><button type="button" class="btn btn-icon btn-ghost" data-action="art-preview-close" aria-label="Close artwork preview">×</button></div></div><div class="art-preview-scroll" id="art-preview-scroll">${artwork}</div><div class="art-preview-footer">Pinch to zoom on your phone, or use Zoom + to enlarge card text.</div></section></div>`;
}
const renderModalBeforeV117=renderModal;
renderModal=function(){
 if(ui.modal?.type==='printing-detail'){
  document.getElementById('modal-root').innerHTML=modalPrintingDetail();return;
 }
 if(ui.modal?.type==='image-preview'){
  document.getElementById('modal-root').innerHTML=modalImagePreview();
  document.querySelector('.art-preview-dialog')?.focus({preventScroll:true});return;
 }
 return renderModalBeforeV117();
};
function openArtworkPreview(id,finish=''){
 const p=getMeta(id);if(!p?.imageUrl){toast('Artwork unavailable for this printing.',true);return;}
 ui.previewReturn=ui.modal&&ui.modal.type!=='image-preview'?{...ui.modal}:null;
 ui.modal={type:'image-preview',id,finish};renderModal();
}
function closeArtworkPreview(){
 ui.modal=ui.previewReturn||null;ui.previewReturn=null;renderModal();
}
// Capture the click before the legacy card-detail handler on collection-card
// buttons so tapping the art zooms, while tapping the text opens that printing.
document.addEventListener('click',event=>{
 const image=event.target.closest('[data-action="image-preview"]');
 const cardArtTarget=event.target.closest('.collection-card .card-art');
 if(image||cardArtTarget){
  const el=image||(cardArtTarget.closest('.collection-card'));
  if(el?.dataset.id){event.preventDefault();event.stopImmediatePropagation();openArtworkPreview(el.dataset.id,el.dataset.finish||'');}
  return;
 }
 const previewButton=event.target.closest('[data-action="art-preview-close"],[data-action="art-preview-zoom"]');
 if(previewButton){
  event.preventDefault();event.stopImmediatePropagation();
  if(previewButton.dataset.action==='art-preview-zoom'){
   const area=document.getElementById('art-preview-scroll');
   if(area){const zoom=!area.classList.contains('is-zoomed');area.classList.toggle('is-zoomed',zoom);previewButton.textContent=zoom?'Reset zoom':'Zoom ＋';}
  }else if(event.target===previewButton||previewButton.tagName==='BUTTON')closeArtworkPreview();
  return;
 }
 const printing=event.target.closest('[data-action="card-detail"]');
 if(printing?.dataset.id){event.preventDefault();event.stopImmediatePropagation();showModal('printing-detail',{id:printing.dataset.id});return;}
},true);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&ui.modal?.type==='image-preview'){
  event.preventDefault();event.stopImmediatePropagation();closeArtworkPreview();
 }
},true);



// ---- v1.18: official-format ban list and user-supplied Riftbound set logos ---
// The user-supplied transparent PNGs are shipped locally with the app shell.
// They do not change the card catalogue or localStorage schemas.
const RIFTVAULT_SET_LOGOS={OGN:'set-origins.png',SFD:'set-spiritforged.png',UNL:'set-unleashed.png',VEN:'set-vendetta.png',RAD:'set-radiance.png'};
const previousSetLogoLabel=setLogoLabel;
setLogoLabel=function(set,name){
 const logo=RIFTVAULT_SET_LOGOS[set];
 if(!logo)return previousSetLogoLabel(set,name);
 return `<div class="set-emblem set-image-emblem set-emblem-${escapeHtml(set.toLowerCase())}"><img class="set-logo-asset" src="${logo}" alt="${escapeHtml(name||set)} set logo" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/><span class="set-logo-fallback" hidden>${escapeHtml(name||set)}</span></div>`;
};

// Official Rules Hub: 12 banned entries for Standard, plus one 2v2 Legend.
// Snapshot last checked 11 November 2026, official ban update effective 18 September 2026.
const BAN_LIST_VERIFIED='11 Nov 2026';
const BAN_LIST_EFFECTIVE='18 Sep 2026';
const BAN_DATA=[
 {name:'Called Shot',category:'Card',date:'31 Mar 2026'},
 {name:'Draven, Vanquisher',category:'Card',date:'31 Mar 2026'},
 {name:'Fight or Flight',category:'Card',date:'31 Mar 2026'},
 {name:'Scrapheap',category:'Card',date:'31 Mar 2026'},
 {name:'The Dreaming Tree',category:'Battlefield',date:'31 Mar 2026',aliases:['Dreaming Tree']},
 {name:'Obelisk of Power',category:'Battlefield',date:'31 Mar 2026'},
 {name:'Reaver\'s Row',category:'Battlefield',date:'31 Mar 2026'},
 {name:'Stealthy Pursuer',category:'Card',date:'24 Jul 2026'},
 {name:'The Arena\'s Greatest',category:'Battlefield',date:'24 Jul 2026'},
 {name:'Aspirant\'s Climb',category:'Battlefield',date:'24 Jul 2026'},
 {name:'Ekko, Recurrent',category:'Card',date:'18 Sep 2026'},
 {name:'Stacked Deck',category:'Card',date:'18 Sep 2026'},
 {name:'Master Yi, Wuju Bladesman',category:'Legend',date:'24 Jul 2026',formats:['2v2'],aliases:['Wuju Bladesman']},
];
function banMatchKey(v){
 return normalizeName(v).replace(/[^a-z0-9]+/g,' ').replace(/^the /,'').replace(/\s+/g,' ').trim();
}
function banStatus(name,format='standard'){
 const key=banMatchKey(name);
 if(!key)return null;
 const entry=BAN_DATA.find(row=>[row.name,...(row.aliases||[])].some(alias=>banMatchKey(alias)===key));
 if(!entry)return null;
 const formats=entry.formats||['standard','2v2'];
 return formats.includes(format)?entry:null;
}
function banBadge(name){
 const standard=banStatus(name,'standard'),duo=banStatus(name,'2v2');
 if(standard)return '<span class="ban-badge" title="Banned in Standard and 2v2 Constructed">⊘ BANNED · Standard & 2v2</span>';
 if(duo)return '<span class="ban-badge ban-badge-duo" title="Banned in 2v2 Constructed only">⊘ BANNED · 2v2 only</span>';
 return '';
}
function banDetailNotice(name){
 const standard=banStatus(name,'standard'),duo=banStatus(name,'2v2');
 if(!standard&&!duo)return '';
 return `<div class="ban-detail-alert">${banBadge(name)}<span>${standard?'Not legal in sanctioned Standard or 2v2 Constructed.':'Not legal in sanctioned 2v2 Constructed; still legal in Standard.'} <a href="${OFFICIAL_RULES_HUB}" target="_blank" rel="noopener noreferrer">Official rules ↗</a></span></div>`;
}
ui.banFormat='standard';ui.banQuery='';
NAV.push({id:'banned',icon:'⊘',name:'Banned cards'});
function bannedListMarkup(){
 const list=BAN_DATA.filter(row=>(row.formats||['standard','2v2']).includes(ui.banFormat));
 const cards=[...allPrintings.values()];
 return list.map(row=>{
  const card=cards.find(p=>banMatchKey(p.name)===banMatchKey(row.name))||cards.find(p=>row.aliases?.some(a=>banMatchKey(p.name)===banMatchKey(a)));
  const artwork=card?.imageUrl?`<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(row.name)} card" loading="lazy" onerror="this.style.display='none'">`:'<span class="ban-art-fallback">⊘</span>';
  const code=card?.code||'See official list';
  const details=card?`<button type="button" class="btn btn-small btn-ghost" data-action="card-detail" data-id="${escapeHtml(card.id)}" data-name="${escapeHtml(card.name)}">View printing ↗</button>`:'';
  return `<article class="ban-row" data-ban-keywords="${escapeHtml((row.name+' '+row.category+' '+code).toLowerCase())}">
    <div class="ban-card-art">${artwork}</div><div class="ban-card-info"><strong>${escapeHtml(row.name)}</strong><div class="ban-row-tags"><span class="ban-badge">⊘ BANNED</span><span class="muted micro">${escapeHtml(row.category)} · ${escapeHtml(code)}</span></div><small class="muted">Banned since ${escapeHtml(row.date)}</small></div>${details}
   </article>`;
 }).join('');
}
function renderBanned(){
 const total=ui.banFormat==='standard'?12:13;
 return `<div class="banned-view"><div class="rules-hero ban-hero"><div class="eyebrow">RULES / FORMAT LEGALITY</div><h2>Banned Cards</h2><p>Search the current banned cards and battlefields. These restrictions apply to sanctioned Constructed play, not to keeping the cards in your collection.</p><div class="rules-release">Official ban update: ${BAN_LIST_EFFECTIVE} · Last checked ${BAN_LIST_VERIFIED}</div></div>
 <div class="row wrap banned-link-row"><a class="btn btn-small btn-ghost" href="${OFFICIAL_RULES_HUB}" target="_blank" rel="noopener noreferrer">↗ Official ban list</a><button class="btn btn-small btn-ghost" data-nav="rules">← Rules Library</button></div>
 <div class="panel ban-list-panel"><div class="row-between wrap mb18"><div><h3>Constructed ban list</h3><p class="muted small">${total} banned entries in ${ui.banFormat==='standard'?'Standard':'2v2'} Constructed</p></div><div class="ban-format-switch" role="group" aria-label="Tournament format"><button data-action="ban-format" data-format="standard" class="${ui.banFormat==='standard'?'selected':''}" aria-pressed="${ui.banFormat==='standard'}">Standard</button><button data-action="ban-format" data-format="2v2" class="${ui.banFormat==='2v2'?'selected':''}" aria-pressed="${ui.banFormat==='2v2'}">2v2</button></div></div>
 <div class="search-wrap mb18"><span class="search-icon">⌕</span><input type="search" id="ban-search" class="input input-search" placeholder="Search banned card, battlefield or number…" value="${escapeHtml(ui.banQuery)}"/></div>
 <div id="ban-results-count" class="muted small mb12">${total} entries</div><div id="ban-result-list" class="ban-result-list">${bannedListMarkup()}</div><p id="ban-no-results" class="muted small" hidden>No banned cards match this search.</p></div>
 <p class="muted small rules-disclaimer">Restrictions are format-specific and can change. Check Riot’s <a href="${OFFICIAL_RULES_HUB}" target="_blank" rel="noopener noreferrer">official Rules Hub</a> before a tournament. Bans do not remove your physical cards from inventory or decks.</p></div>`;
}
function filterBanned(){
 const q=banMatchKey(ui.banQuery);let num=0;
 document.querySelectorAll('#ban-result-list .ban-row').forEach(row=>{
  const matches=!q||banMatchKey(row.dataset.banKeywords).includes(q);
  row.hidden=!matches;if(matches)num++;
 });
 const count=document.getElementById('ban-results-count');if(count)count.textContent=`${num} matching entr${num===1?'y':'ies'}`;
 const empty=document.getElementById('ban-no-results');if(empty)empty.hidden=num!==0;
}
const originalRenderV118=render;
render=function(){
 if(ui.tab!=='banned')return originalRenderV118();
 rebuildIndexes();renderNav();document.getElementById('main').innerHTML=renderBanned();renderModal();filterBanned();
};
const originalRenderRulesV118=renderRules;
renderRules=function(){
 return originalRenderRulesV118().replace('<div class="rules-quicklinks">','<div class="rules-quicklinks"><button class="btn btn-ghost" data-nav="banned">⊘ Banned Cards · Standard & 2v2</button>');
};
const originalRenderModalV118=renderModal;
renderModal=function(){
 originalRenderModalV118();
 if(ui.modal?.type==='menu'){
  const list=document.querySelector('#modal-root .mobile-menu-list');
  if(list&&!list.querySelector('[data-nav="banned"]'))list.insertAdjacentHTML('beforeend','<button class="btn btn-ghost" data-nav="banned">⊘ &nbsp; Banned cards</button>');
 }
};
document.addEventListener('input',event=>{
 if(event.target.id==='ban-search'){ui.banQuery=event.target.value;filterBanned();}
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action="ban-format"]');
 if(!button)return;
 ui.banFormat=button.dataset.format==='2v2'?'2v2':'standard';render();
});


// v1.20 — newly scanned cards that a deck needs can be assigned immediately.
function availableDeckEntries(deck){
 return deck.entries.filter(entry=>entryAssigned(deck,entry)<entry.required&&entryBulk(entry)>0);
}
function scannedCardDeckMatches(card){
 return state.decks.flatMap(deck=>deck.entries.filter(entry=>
  entryAssigned(deck,entry)<entry.required && eligiblePrintings(entry).some(p=>p.id===card.id)
 ).map(entry=>({deck,entry,remaining:entry.required-entryAssigned(deck,entry)})));
}
function notifyDecksAfterScan(card,finish){
 if(!card?.id)return;
 const matches=scannedCardDeckMatches(card);
 if(!matches.length)return;
 scanner.deckNotice=true;
 showModal('deck-available',{cardId:card.id,finish});
}
function deckAvailabilityModal(){
 const notice=ui.modal||{},card=notice.cardId?getMeta(notice.cardId):null;
 const matches=card?scannedCardDeckMatches(card):[];
 const deck=notice.deckId?findDeck(notice.deckId):null;
 const rows=deck?availableDeckEntries(deck).map(entry=>({deck,entry,remaining:entry.required-entryAssigned(deck,entry)})):matches;
 const cardMarkup=card?`<div class="deck-alert-scanned"><span class="deck-alert-thumb">${cardArt(card)}</span><div><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.code)} · ${escapeHtml(notice.finish||'')} · Added to Bulk</small></div></div>`:'';
 return modalShell(deck?'Cards ready for '+deck.name:'Card needed for a deck',
  deck?`${rows.length} card type${rows.length===1?'':'s'} ready to assign`:`${matches.length} deck requirement${matches.length===1?'':'s'} can use this card`,
  `${cardMarkup}${rows.length?`<div class="deck-alert-list">${rows.map(({deck:d,entry,remaining})=>{
   const print=card||eligiblePrintings(entry).find(p=>p.imageUrl)||eligiblePrintings(entry)[0];
   return `<div class="deck-alert-row"><span class="deck-alert-thumb">${cardArt(print)}</span><div class="deck-alert-description"><strong>${escapeHtml(d.name)}</strong><span>${escapeHtml(requirementName(entry))}</span><small>Need ${entry.required} · Assigned ${entryAssigned(d,entry)} · ${entryBulk(entry)} in Bulk</small></div><button class="btn btn-primary btn-small" data-action="deck-alert-assign" data-deck-id="${escapeHtml(d.id)}" data-entry-id="${escapeHtml(entry.id)}" data-printing-id="${escapeHtml(card?.id||'')}">Assign 1</button></div>`;
  }).join('')}</div>`:'<p class="muted small">No unassigned copies are available now.</p>'}`,
 '<button class="btn btn-ghost" data-action="deck-alert-dismiss">Not now</button>',true);
}
const renderModalV120=renderModal;
renderModal=function(){
 if(ui.modal?.type==='deck-available'||ui.modal?.type==='deck-ready'){
  document.getElementById('modal-root').innerHTML=deckAvailabilityModal();return;
 }
 renderModalV120();
};
const renderDeckDetailV120=renderDeckDetail;
renderDeckDetail=function(deck){
 const ready=availableDeckEntries(deck).length;
 const html=renderDeckDetailV120(deck);
 if(!ready)return html;
 const anchor='<div class="row wrap mb18"><button class="btn btn-primary" data-action="auto-assign"';
 const notice=`<div class="deck-ready-banner"><div><strong>✦ ${ready} card type${ready===1?'':'s'} ready to assign</strong><span>Copies already in Bulk can complete missing deck slots.</span></div><button class="btn btn-primary btn-small" data-action="deck-ready-open" data-deck-id="${escapeHtml(deck.id)}">Review available cards</button></div>`;
 return html.replace(anchor,notice+anchor);
};
const renderDecksV120=renderDecks;
renderDecks=function(){
 let html=renderDecksV120();if(ui.deckId)return html;
 for(const deck of state.decks){
  const n=availableDeckEntries(deck).length;if(!n)continue;
  const head=`<button class="deck-card" data-action="open-deck" data-id="${escapeHtml(deck.id)}">`;
  html=html.replace(head,head+`<span class="deck-notice-badge">✦ ${n} ready to assign</span>`);
 }
 return html;
};
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 const action=button.dataset.action;
 if(action==='deck-alert-dismiss'){scanner.deckNotice=false;closeModal();return;}
 if(action==='deck-ready-open'){
  const deck=findDeck(button.dataset.deckId);
  if(deck)showModal('deck-ready',{deckId:deck.id});return;
 }
 if(action!=='deck-alert-assign')return;
 const deck=findDeck(button.dataset.deckId),entry=deck?.entries.find(e=>e.id===button.dataset.entryId);
 if(!deck||!entry)return;
 // Use the exact scanning result if it is still in Bulk. Never move another
 // card, alter stock ownership or assign an unavailable copy unexpectedly.
 const preferred=ownedKeysByName(entry.name,entry.code,entry.section).find(key=>
  unpackKey(key).id===button.dataset.printingId && bulkQty(key)>0);
 if(button.dataset.printingId&&!preferred){toast('This scanned printing is no longer in Bulk.',true);renderModal();return;}
 if(!assignOne(deck,entry,preferred||null)){toast('No available copy or deck requirement is complete.',true);renderModal();return;}
 logActivity('Assigned 1 × '+entry.name+' to '+deck.name+' after a scan',preferred||null,'assign');save();
 const wasScanModal=ui.modal?.type==='deck-available';
 if(wasScanModal){
  const card= getMeta(ui.modal.cardId);
  if(!scannedCardDeckMatches(card).length){scanner.deckNotice=false;closeModal();}
  else renderModal();
 }else{render();}
 toast('Assigned 1 copy to '+deck.name+'.');
});

render();
