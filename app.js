const SUPABASE_URL="https://nisqtwwypeyqqjluqhxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_vmFRQpm8hF-0E3CSKiPd9A_XWHfjuvF";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const LOCAL_KEY="ncc_manager_v2";
let db={services:[],drivers:[],cars:[]};
let currentMonth=new Date(), selectedDay="", editing=null;
let realtimeTimer=null;
let lastSyncSignature="";

const $=id=>document.getElementById(id);
function calcKmTotali(){
  const p=Number($("km_partenza")?.value), a=Number($("km_arrivo")?.value);
  const out=$("km_totali");
  if(!out)return;
  if(Number.isFinite(p)&&Number.isFinite(a)&&$("km_partenza").value!==""&&$("km_arrivo").value!=="") out.value=(a-p>=0?a-p:"");
  else out.value="";
}

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function login(){
  const email=$("loginEmail").value.trim(), password=$("loginPassword").value;
  if(!email||!password){$("loginMsg").textContent="Inserisci email e password.";return;}
  $("loginMsg").textContent="Accesso in corso…";
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error){$("loginMsg").textContent="Accesso non riuscito: "+error.message;return;}
  $("loginMsg").textContent="";
  await initApp();
}

async function logout(){await sb.auth.signOut();}

async function initApp(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){
    $("loginView").classList.remove("hidden");
    $("appShell").classList.add("hidden");
    return;
  }
  $("loginView").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  $("userEmail").textContent=session.user.email||"Utente autorizzato";
  await loadServices();
  await loadPeopleCloud();
  renderPeople();
  renderToday(); renderCalendar();
  setupRealtime();
  startSyncFallback();
}

function setupRealtime(){
  if(window.__nccChannel) sb.removeChannel(window.__nccChannel);
  window.__nccChannel=sb.channel("ncc-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"Servizi"},async()=>{
      await syncServices(true);
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"Autisti"},async()=>{
      await loadPeopleCloud(); renderPeople(); renderSelects();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"Veicoli"},async()=>{
      await loadPeopleCloud(); renderPeople(); renderSelects();
    })
    .subscribe((status)=>{
      console.log("NCC realtime:",status);
    });
}

async function syncServices(forceRender=false){
  const before=lastSyncSignature;
  await loadServices();
  const signature=db.services.map(s=>[s.id,s.data,s.ora,s.numero,s.stato,s.cliente,s.autista,s.targa].join("|")).join(";;");
  const changed=signature!==before;
  lastSyncSignature=signature;
  if(changed||forceRender) renderAll();
}

function startSyncFallback(){
  if(realtimeTimer) clearInterval(realtimeTimer);
  realtimeTimer=setInterval(async()=>{
    if(document.visibilityState!=="hidden"){
      await syncServices(false);
      await loadPeopleCloud(); renderPeople(); renderSelects();
    }
  },5000);
  document.addEventListener("visibilitychange",async()=>{
    if(document.visibilityState!=="hidden") await syncServices(true);
  });
}

async function loadServices(){
  const {data,error}=await sb.from("Servizi").select("*").order("data_servizio",{ascending:true}).order("ora_servizio",{ascending:true});
  if(error){
    console.error(error);
    alert("Errore nel caricamento dei servizi. Se hai appena aggiunto i campi Km, esegui SQL_AGGIUNTA_KM.sql in Supabase e poi ricarica l'app.");
    return;
  }
  db.services=(data||[]).map(fromRow);
}

function fromRow(r){
  return {
    id:r.id, numero:r.numero_servizio||"", stato:r.stato||"", data:r.data_servizio||"",
    ora:r.ora_servizio||"", cliente:r.cliente||"", telefono:r.telefono||"",
    email:r.email||"", azienda:r.azienda||"", passeggeri:r.passeggeri||1,
    partenza:r.partenza||"", destinazione:r.destinazione||"", fermate:r.fermate||"",
    arrivo_richiesto:r.arrivo_richiesto||"", volo:r.volo_treno||"",
    autista:r.autista||"", telefono_autista:r.telefono_autista||"",
    targa:r.targa||"", veicolo:r.veicolo||"", km_partenza:r.km_partenza ?? "", km_arrivo:r.km_arrivo ?? "", note:r.note||""
  };
}

function toRow(s){
  const row={
    numero_servizio:s.numero, stato:s.stato, data_servizio:s.data||null, ora_servizio:s.ora||null,
    cliente:s.cliente||null, telefono:s.telefono||null, email:s.email||null, azienda:s.azienda||null,
    passeggeri:s.passeggeri?Number(s.passeggeri):null, partenza:s.partenza||null,
    destinazione:s.destinazione||null, fermate:s.fermate||null, arrivo_richiesto:s.arrivo_richiesto||null,
    volo_treno:s.volo||null, autista:s.autista||null, telefono_autista:s.telefono_autista||null,
    targa:s.targa||null, veicolo:s.veicolo||null, km_partenza:s.km_partenza!==""&&s.km_partenza!=null?Number(s.km_partenza):null, km_arrivo:s.km_arrivo!==""&&s.km_arrivo!=null?Number(s.km_arrivo):null, note:s.note||null
  };
  return row;
}

function renderAll(){renderToday();renderCalendar();renderServices();renderDayDetail();}

function show(id,btn){
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  const v=$(id); if(v)v.classList.add("active");
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
  if(btn)btn.classList.add("active");
  if(id==="dashboard")renderToday();
  if(id==="calendar")renderCalendar();
  if(id==="services")renderServices();
  if(id==="settings")renderPeople();
  if(id==="daydetail")renderDayDetail();
}

function newService(){
  editing=null; $("editorTitle").textContent="Nuovo servizio"; clearForm(); show("editor");
}
function clearForm(){
  ["cliente","telefono","partenza","destinazione","volo","note","autista","veicolo","targa","km_partenza","km_arrivo","km_totali"].forEach(x=>{if($(x))$(x).value="";});
  $("numero").value="NCC-"+Date.now().toString().slice(-6);
  const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  $("data").value=d.toISOString().slice(0,10);
  $("ora").value=d.toTimeString().slice(0,5);
  $("passeggeri").value=1; $("stato").value="Da confermare"; calcKmTotali(); renderSelects();
}
function renderSelects(){
  $("autistiList").innerHTML=db.drivers.map(x=>`<option value="${esc(x.name)}"></option>`).join("");
  $("veicoliList").innerHTML=db.cars.map(x=>`<option value="${esc(x.name)}"></option>`).join("");
  $("targheList").innerHTML=db.cars.map(x=>`<option value="${esc(x.plate)}"></option>`).join("");
}

async function saveService(){
  calcKmTotali();
  const s={
    numero:$("numero").value,stato:$("stato").value,data:$("data").value,ora:$("ora").value,
    cliente:$("cliente").value,telefono:$("telefono").value,passeggeri:$("passeggeri").value,
    partenza:$("partenza").value,destinazione:$("destinazione").value,volo:$("volo").value,
    autista:$("autista").value,veicolo:$("veicolo").value,targa:$("targa").value,km_partenza:$("km_partenza").value,km_arrivo:$("km_arrivo").value,note:$("note").value
  };
  if(!s.data||!s.ora){alert("Inserisci data e ora.");return;}
  let error;
  if(editing){
    ({error}=await sb.from("Servizi").update(toRow(s)).eq("id",editing));
  }else{
    ({error}=await sb.from("Servizi").insert(toRow(s)));
  }
  if(error){alert("Errore nel salvataggio: "+error.message);return;}
  alert("Servizio salvato correttamente.");
  await loadServices(); selectedDay=s.data; renderAll(); show("daydetail");
}

function renderToday(){
  const today=new Date(); today.setMinutes(today.getMinutes()-today.getTimezoneOffset());
  const iso=today.toISOString().slice(0,10);
  const a=db.services.filter(s=>s.data===iso).sort((a,b)=>a.ora.localeCompare(b.ora));
  $("todayList").innerHTML=a.length?a.map(card).join(""):'<div class="card"><span class="empty">Nessun servizio programmato per oggi.</span></div>';
}
function renderServices(){
  const q=($("search")?.value||"").toLowerCase();
  const a=db.services.filter(s=>Object.values(s).join(" ").toLowerCase().includes(q)).sort((a,b)=>(a.data+a.ora).localeCompare(b.data+b.ora));
  $("serviceList").innerHTML=a.length?a.map(card).join(""):'<div class="card empty">Nessun servizio.</div>';
}
function kmTotali(s){
 const p=Number(s.km_partenza), a=Number(s.km_arrivo);
 return s.km_partenza!=="" && s.km_arrivo!=="" && Number.isFinite(p) && Number.isFinite(a) && a>=p ? a-p : "";
}

function card(s){
 return `<div class="card service"><h3>${esc(s.ora)} · ${esc(s.cliente||"Cliente")}</h3>
 <span class="badge">${esc(s.stato)}</span>
 <p>📍 ${esc(s.partenza)} → ${esc(s.destinazione)}</p>
 <p>👤 ${esc(s.autista||"Autista da assegnare")} · 🚘 ${esc(s.veicolo||"Veicolo da assegnare")} · ${esc(s.targa||"Targa da assegnare")}</p><p>📍 Km: ${esc(s.km_partenza||"—")} → ${esc(s.km_arrivo||"—")}${kmTotali(s)!==""?" · Totali: "+esc(kmTotali(s))+" km":""}</p>
 <p>📅 ${esc(s.data)} · ${esc(s.passeggeri)} pax${s.telefono?" · 📞 "+esc(s.telefono):""}</p>
 <div class="row"><button class="action light" onclick="editService(${s.id})">Modifica</button>
 <button class="action light" onclick="addGoogleCalendar(${s.id})">Google Calendar</button>
 <button class="action light" onclick="deleteService(${s.id})">Elimina</button></div></div>`;
}
async function editService(id){
 const s=db.services.find(x=>x.id===id); if(!s)return;
 editing=id; $("editorTitle").textContent="Modifica servizio";
 ["numero","stato","data","ora","cliente","telefono","passeggeri","partenza","destinazione","volo","autista","veicolo","targa","km_partenza","km_arrivo","note"].forEach(k=>{if($(k))$(k).value=s[k]||"";});
 calcKmTotali(); renderSelects(); show("editor");
}
async function deleteService(id){
 if(!confirm("Eliminare questo servizio?"))return;
 const {error}=await sb.from("Servizi").delete().eq("id",id);
 if(error){alert("Errore nell'eliminazione: "+error.message);return;}
 await loadServices(); renderAll();
}
function changeMonth(n){currentMonth.setMonth(currentMonth.getMonth()+n);renderCalendar();}
function renderCalendar(){
 const y=currentMonth.getFullYear(),m=currentMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0);
 $("monthTitle").textContent=first.toLocaleDateString("it-IT",{month:"long",year:"numeric"});
 let h=["L","M","M","G","V","S","D"].map(x=>`<div class="dayname">${x}</div>`).join("");
 const offset=(first.getDay()+6)%7;
 for(let i=0;i<offset;i++)h+='<div class="day empty"></div>';
 for(let d=1;d<=last.getDate();d++){
   const date=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
   const items=db.services.filter(s=>s.data===date);
   const today=date===new Date().toISOString().slice(0,10);
   h+=`<div class="day ${today?"today":""}" onclick="dayNew('${date}')"><b>${d}</b>${items.slice(0,3).map(s=>`<span class="dot">${esc(s.ora)} ${esc(s.cliente||"Servizio")}</span>`).join("")}</div>`;
 }
 $("calendarGrid").innerHTML=h;
}
function dayNew(date){
 selectedDay=date; $("dayTitle").textContent=new Date(date+"T12:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 renderDayDetail(); show("daydetail");
}
function newServiceForSelectedDay(){newService();$("data").value=selectedDay;}
function renderDayDetail(){
 if(!$("dayList"))return;
 const a=db.services.filter(s=>s.data===selectedDay).sort((x,y)=>x.ora.localeCompare(y.ora));
 $("dayList").innerHTML=a.length?a.map(card).join(""):'<div class="card empty">Nessun servizio per questa giornata.</div>';
}
function addGoogleCalendar(id){
 const s=db.services.find(x=>x.id===id);if(!s)return;
 const start=new Date(s.data+"T"+s.ora),end=new Date(start.getTime()+3600000);
 const fmt=x=>x.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
 const title="NCC - "+(s.cliente||"Servizio");
 const details=`Servizio ${s.numero}\nPartenza: ${s.partenza}\nDestinazione: ${s.destinazione}\nPasseggeri: ${s.passeggeri}\nAutista: ${s.autista}\nVeicolo: ${s.veicolo}\nTarga: ${s.targa}\nKm partenza: ${s.km_partenza||""}\nKm arrivo: ${s.km_arrivo||""}\nNote: ${s.note||""}`;
 window.open("https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(title)+"&dates="+fmt(start)+"/"+fmt(end)+"&details="+encodeURIComponent(details)+"&location="+encodeURIComponent(s.partenza||""),"_blank");
}

function loadPeopleLocal(){
  try{const x=JSON.parse(localStorage.getItem(LOCAL_KEY)||"{}");db.drivers=x.drivers||[];db.cars=x.cars||[];}catch(e){db.drivers=[];db.cars=[];}
}

async function loadPeopleCloud(){
  const [dr,cars]=await Promise.all([
    sb.from("Autisti").select("id,nome,telefono").order("nome"),
    sb.from("Veicoli").select("id,nome,targa").order("nome")
  ]);
  if(dr.error || cars.error){
    console.error("Errore caricamento autisti/veicoli",dr.error,cars.error);
    // Fallback locale: l'app continua a funzionare anche prima della creazione delle tabelle.
    loadPeopleLocal();
    return;
  }
  db.drivers=(dr.data||[]).map(x=>({id:x.id,name:x.nome||"",phone:x.telefono||""}));
  db.cars=(cars.data||[]).map(x=>({id:x.id,name:x.nome||"",plate:x.targa||""}));
  // Migrazione automatica dei nomi già salvati sul Mac nel cloud, senza duplicati.
  const local=(()=>{try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||"{}")}catch(e){return {}}})();
  if((dr.data||[]).length===0 && Array.isArray(local.drivers) && local.drivers.length){
    const rows=local.drivers.map(x=>({nome:x.name,telefono:x.phone||null}));
    const {error}=await sb.from("Autisti").upsert(rows,{onConflict:"nome"});
    if(!error) db.drivers=rows.map(x=>({name:x.nome,phone:x.telefono||""}));
  }
  if((cars.data||[]).length===0 && Array.isArray(local.cars) && local.cars.length){
    const rows=local.cars.map(x=>({nome:x.name,targa:x.plate}));
    const {error}=await sb.from("Veicoli").upsert(rows,{onConflict:"targa"});
    if(!error) db.cars=rows.map(x=>({name:x.nome,plate:x.targa}));
  }
}

async function addDriver(){
 const n=$("newDriver").value.trim(), phone=$("newDriverPhone").value.trim();
 if(!n){alert("Inserisci il nome dell'autista.");return;}
 const {error}=await sb.from("Autisti").upsert({nome:n,telefono:phone||null},{onConflict:"nome"});
 if(error){alert("Errore nel salvataggio dell'autista: "+error.message);return;}
 $("newDriver").value=""; $("newDriverPhone").value="";
 await loadPeopleCloud(); renderPeople(); renderSelects();
}
async function addCar(){
 const n=$("newCar").value.trim(), p=$("newPlate").value.trim().toUpperCase();
 if(!n||!p){alert("Inserisci modello e targa.");return;}
 const {error}=await sb.from("Veicoli").upsert({nome:n,targa:p},{onConflict:"targa"});
 if(error){alert("Errore nel salvataggio del veicolo: "+error.message);return;}
 $("newCar").value=""; $("newPlate").value="";
 await loadPeopleCloud(); renderPeople(); renderSelects();
}
function savePeopleLocal(){
  const old=JSON.parse(localStorage.getItem(LOCAL_KEY)||"{}");
  localStorage.setItem(LOCAL_KEY,JSON.stringify({services:old.services||[],drivers:db.drivers,cars:db.cars}));
}
function renderPeople(){
 $("drivers").innerHTML=db.drivers.map(x=>`<div class="card">${esc(x.name)} · ${esc(x.phone||"")}</div>`).join("")||'<span class="empty">Nessun autista inserito.</span>';
 $("cars").innerHTML=db.cars.map(x=>`<div class="card">${esc(x.name)} · <b>${esc(x.plate)}</b></div>`).join("")||'<span class="empty">Nessun veicolo inserito.</span>';
}

function goBack(){show("services",document.querySelectorAll("nav button")[2]);}

async function importLocalData(){
  let local;
  try{local=JSON.parse(localStorage.getItem(LOCAL_KEY)||"{}");}catch(e){local={};}
  const services=Array.isArray(local.services)?local.services:[];
  if(!services.length){alert("Non ci sono servizi locali da importare.");return;}
  if(!confirm("Importare "+services.length+" servizi locali nel database condiviso?"))return;
  let ok=0;
  for(const s of services){
    const {error}=await sb.from("Servizi").insert(toRow(s));
    if(!error)ok++;
  }
  alert("Importazione completata: "+ok+" servizi.");
  await loadServices();renderAll();
}

sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT")initApp();});
loadPeopleLocal();
initApp();

document.addEventListener("DOMContentLoaded",()=>{
  ["km_partenza","km_arrivo"].forEach(id=>$(id)?.addEventListener("input",calcKmTotali));
});
