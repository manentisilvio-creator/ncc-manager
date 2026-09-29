
const KEY="ncc_manager_v2";
let db=JSON.parse(localStorage.getItem(KEY)||'{"services":[],"drivers":[],"cars":[]}');
let currentMonth=new Date(), selectedDay="", editing=null;

const $=id=>document.getElementById(id);
function saveDB(){localStorage.setItem(KEY,JSON.stringify(db));}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

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
  editing=null; clearForm(); show("editor");
}
function clearForm(){
  ["cliente","telefono","partenza","destinazione","volo","note","autista","auto"].forEach(x=>{if($(x))$(x).value="";});
  $("numero").value="NCC-"+Date.now().toString().slice(-6);
  let d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  $("data").value=d.toISOString().slice(0,10);
  $("ora").value=d.toTimeString().slice(0,5);
  $("passeggeri").value=1;
  $("stato").value="Da confermare";
  renderSelects();
}
function renderSelects(){
  $("autistiList").innerHTML=db.drivers.map(x=>`<option value="${esc(x.name)}"></option>`).join("");
  $("autoList").innerHTML=db.cars.map(x=>`<option value="${esc(x.name+" – "+x.plate)}"></option>`).join("");
}
function saveService(){
  const s={id:editing||Date.now(),numero:$("numero").value,stato:$("stato").value,data:$("data").value,ora:$("ora").value,cliente:$("cliente").value,telefono:$("telefono").value,partenza:$("partenza").value,destinazione:$("destinazione").value,passeggeri:$("passeggeri").value,volo:$("volo").value,autista:$("autista").value,auto:$("auto").value,note:$("note").value};
  if(!s.data||!s.ora){alert("Inserisci data e ora.");return;}
  const i=db.services.findIndex(x=>x.id===s.id);
  if(i>=0)db.services[i]=s; else db.services.push(s);
  saveDB();
  alert("Servizio salvato correttamente.");
  selectedDay=s.data;
  renderToday(); renderCalendar(); renderServices(); renderDayDetail();
  show("daydetail");
}
function renderToday(){
  const today=new Date().toISOString().slice(0,10);
  const a=db.services.filter(s=>s.data===today).sort((a,b)=>a.ora.localeCompare(b.ora));
  $("todayList").innerHTML=a.length?a.map(card).join(""):'<div class="card"><span class="empty">Nessun servizio programmato per oggi.</span></div>';
}
function renderServices(){
  const q=($("search")?.value||"").toLowerCase();
  const a=db.services.filter(s=>Object.values(s).join(" ").toLowerCase().includes(q)).sort((a,b)=>(a.data+a.ora).localeCompare(b.data+b.ora));
  $("serviceList").innerHTML=a.length?a.map(card).join(""):'<div class="card empty">Nessun servizio.</div>';
}
function card(s){
 return `<div class="card service"><h3>${esc(s.ora)} · ${esc(s.cliente||"Cliente")}</h3>
 <span class="badge">${esc(s.stato)}</span>
 <p>📍 ${esc(s.partenza)} → ${esc(s.destinazione)}</p>
 <p>👤 ${esc(s.autista||"Autista da assegnare")} · 🚘 ${esc(s.auto||"Auto da assegnare")}</p>
 <p>📅 ${esc(s.data)} · ${esc(s.passeggeri)} pax${s.telefono?" · 📞 "+esc(s.telefono):""}</p>
 <div class="row"><button class="action light" onclick="editService(${s.id})">Modifica</button>
 <button class="action light" onclick="addGoogleCalendar(${s.id})">Google Calendar</button>
 <button class="action light" onclick="deleteService(${s.id})">Elimina</button></div></div>`;
}
function editService(id){
 const s=db.services.find(x=>x.id===id); if(!s)return;
 editing=id;
 ["numero","stato","data","ora","cliente","telefono","partenza","destinazione","passeggeri","volo","autista","auto","note"].forEach(k=>{if($(k))$(k).value=s[k]||"";});
 renderSelects(); $("autista").value=s.autista||""; $("auto").value=s.auto||"";
 show("editor");
}
function deleteService(id){
 if(!confirm("Eliminare questo servizio?"))return;
 db.services=db.services.filter(x=>x.id!==id); saveDB();
 renderServices(); renderToday(); renderCalendar(); renderDayDetail();
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
 selectedDay=date;
 $("dayTitle").textContent=new Date(date+"T12:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
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
 const details=`Servizio ${s.numero}\nPartenza: ${s.partenza}\nDestinazione: ${s.destinazione}\nPasseggeri: ${s.passeggeri}\nAutista: ${s.autista}\nAuto: ${s.auto}\nNote: ${s.note||""}`;
 window.open("https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(title)+"&dates="+fmt(start)+"/"+fmt(end)+"&details="+encodeURIComponent(details)+"&location="+encodeURIComponent(s.partenza||""),"_blank");
}
function addDriver(){
 const n=$("newDriver").value.trim();if(!n){alert("Inserisci il nome dell'autista.");return;}
 db.drivers.push({id:Date.now(),name:n,phone:$("newDriverPhone").value});saveDB();
 $("newDriver").value="";$("newDriverPhone").value="";renderPeople();
}
function addCar(){
 const n=$("newCar").value.trim(),p=$("newPlate").value.trim();if(!n||!p){alert("Inserisci modello e targa.");return;}
 db.cars.push({id:Date.now(),name:n,plate:p});saveDB();
 $("newCar").value="";$("newPlate").value="";renderPeople();
}
function renderPeople(){
 $("drivers").innerHTML=db.drivers.map(x=>`<div class="card">${esc(x.name)} · ${esc(x.phone||"")}</div>`).join("")||'<span class="empty">Nessun autista inserito.</span>';
 $("cars").innerHTML=db.cars.map(x=>`<div class="card">${esc(x.name)} · <b>${esc(x.plate)}</b></div>`).join("")||'<span class="empty">Nessun veicolo inserito.</span>';
}
function goBack(){show("services",document.querySelectorAll("nav button")[2]);}
renderToday();renderCalendar();
