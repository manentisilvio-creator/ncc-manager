const NCC_SUPABASE_URL="https://nisqtwwypeyqqjluqhxb.supabase.co";
const NCC_SUPABASE_KEY="sb_publishable_vmFRQpm8hF-0E3CSKiPd9A_XWHfjuvF";
const nccDb=window.supabase.createClient(NCC_SUPABASE_URL,NCC_SUPABASE_KEY);

function nccEsc(v){return String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function renderSelects(){
  const autista=document.getElementById("autista");
  const veicolo=document.getElementById("veicolo");
  const targa=document.getElementById("targa");
  if(!autista||!veicolo||!targa)return;

  const currentDriver=autista.value;
  const currentVehicle=veicolo.value;
  const currentPlate=targa.value;

  const [dr,cars]=await Promise.all([
    nccDb.from("Autisti").select("id,nome,telefono").order("nome"),
    nccDb.from("Veicoli").select("id,nome,targa").order("nome")
  ]);
  if(dr.error||cars.error){
    console.error("Errore caricamento tendine",dr.error,cars.error);
    return;
  }

  const drivers=dr.data||[], vehicles=cars.data||[];
  autista.innerHTML='<option value="">Seleziona autista…</option>'+
    drivers.map(x=>`<option value="${nccEsc(x.nome)}">${nccEsc(x.nome)}</option>`).join("");
  veicolo.innerHTML='<option value="">Seleziona veicolo…</option>'+
    vehicles.map(x=>`<option value="${nccEsc(x.nome)}">${nccEsc(x.nome)} — ${nccEsc(x.targa)}</option>`).join("");
  targa.innerHTML='<option value="">Seleziona targa…</option>'+
    vehicles.map(x=>`<option value="${nccEsc(x.targa)}">${nccEsc(x.targa)} — ${nccEsc(x.nome)}</option>`).join("");

  if([...autista.options].some(o=>o.value===currentDriver))autista.value=currentDriver;
  if([...veicolo.options].some(o=>o.value===currentVehicle))veicolo.value=currentVehicle;
  if([...targa.options].some(o=>o.value===currentPlate))targa.value=currentPlate;

  const syncPlate=()=>{
    const v=vehicles.find(x=>x.nome===veicolo.value);
    if(v){
      targa.value=v.targa||"";
    }
  };
  veicolo.onchange=syncPlate;
  targa.onchange=()=>{
    const v=vehicles.find(x=>x.targa===targa.value);
    if(v)veicolo.value=v.nome||"";
  };
}

window.addEventListener("DOMContentLoaded",()=>{
  setTimeout(()=>renderSelects(),300);
});
