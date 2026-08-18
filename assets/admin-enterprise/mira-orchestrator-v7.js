(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG;
  const db = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!cfg || !db || new URLSearchParams(location.search).get("safe") === "1") return;

  const SCHEMA = {
    company_projects: ["code","title","client_name","client_rut","description","status","start_date","due_date","budget","client_party_id","commercial_status","execution_status","financial_status","delivery_status","contracted_amount","expected_invoice_count","operational_notes"],
    company_parties: ["name","rut","roles","email","phone","address","city","contact_name","notes","active","metadata"],
    company_quotations: ["project_id","quote_number","client_name","client_rut","issue_date","valid_until","status","items","subtotal","discount","net_amount","vat_rate","vat_amount","total_amount","notes","document_id","client_party_id","direction","party_id","source_file_id","metadata"],
    company_purchase_orders: ["direction","order_number","party_id","project_id","quotation_id","issue_date","expected_date","status","items","net_amount","vat_amount","total_amount","source_file_id","notes"],
    company_documents: ["project_id","document_type","title","content_html","content_json","status","version"],
    company_document_versions: ["document_id","version","title","content_html","content_json","saved_by","saved_at"],
    company_contracts: ["contract_number","title","contract_type","party_id","project_id","status","start_date","end_date","renewal_date","amount","owner_id","source_file_id","document_id","notes","metadata"],
    company_files: ["project_id","category","title","original_name","storage_path","mime_type","file_size","occurred_at","metadata","party_id","document_number","expires_at","sha256","archived"],
    company_invoices: ["project_id","invoice_type","dte_type","folio","issuer_rut","issuer_name","recipient_rut","issue_date","due_date","net_amount","exempt_amount","vat_amount","total_amount","payment_status","source_file_id","xml_data","extracted_text","notes","issuer_party_id","recipient_party_id","quotation_id","purchase_order_id","contract_id"],
    company_transactions: ["direction","party_id","project_id","invoice_id","purchase_order_id","contract_id","transaction_date","due_date","paid_at","amount","status","payment_method","bank_reference","description","source_file_id","reconciled","metadata"],
    company_bank_movements: ["account_label","movement_date","description","amount","reference","balance","transaction_id","reconciled","fingerprint","source_file_id","metadata"],
    company_tax_records: ["period","record_type","status","due_date","net_amount","debit_vat","credit_vat","ppm_amount","tax_amount","total_amount","source_file_id","notes","metadata"],
    company_employees: ["party_id","user_id","full_name","rut","position","contract_type","start_date","end_date","status","email","phone","leave_balance","source_file_id","notes","metadata"],
    company_assets: ["asset_code","name","category","serial_number","project_id","employee_id","supplier_party_id","purchase_invoice_id","purchase_date","cost","warranty_until","location","status","source_file_id","notes","metadata"],
    company_service_cases: ["case_number","case_type","title","party_id","project_id","asset_id","invoice_id","status","priority","opened_at","due_at","resolved_at","assigned_to","description","resolution","source_file_id","metadata"],
    company_approvals: ["entity_type","entity_id","step","status","requested_by","approver_id","requested_at","decided_at","note","metadata"],
    company_deadlines: ["entity_type","entity_id","title","due_date","priority","status","owner_id","remind_days","fingerprint","notes","metadata"],
    company_entity_links: ["source_type","source_id","target_type","target_id","relation","metadata"],
    company_templates: ["template_type","title","content_html","content_json","active"],
    company_meetings: ["project_id","title","meeting_date","attendees","notes_html"],
    company_alerts: ["severity","alert_type","title","message","entity_type","entity_id","due_at","status","source","metadata","emailed_at"],
    company_users: ["email","full_name","rut","role","status","must_change_password","password_changed_at"],
    company_settings: ["key","value"],
    company_activity: ["actor_id","action","entity_type","entity_id","details","created_at"],
    company_project_events: ["project_id","event_type","title","description","event_date","amount","direction","status","source_file_id","ai_generated","metadata"],
    company_project_financial_summary: ["project_id","title","status","commercial_status","execution_status","financial_status","delivery_status","budget","contracted_amount","expected_invoice_count","sale_invoice_count","remaining_invoice_count","sale_billed","collected","receivable","supplier_quoted","committed_expense","purchase_billed","expense_paid","payable","vat_debit","vat_credit","vat_balance","projected_margin","cash_margin"],
  };

  const PRIMARY_KEY = { company_settings: "key", company_users: "user_id", company_project_financial_summary: "project_id" };
  const READ_ONLY = new Set(["company_document_versions","company_activity","company_project_financial_summary"]);
  const USERS_FUNCTION_ONLY = new Set(["company_users"]);
  const UPDATE_ONLY = new Set(["company_settings","company_alerts"]);

  const MODULES = [
    "Proyectos","Clientes y proveedores","Cotizaciones","Órdenes de compra","Facturas/DTE","Documentos",
    "Contratos","Archivo empresarial","Activos e inventario","Garantías y postventa","Operación y gastos",
    "Tesorería y conciliación","Tributario/F29/IVA","RR.HH.","Aprobaciones y vencimientos","Usuarios",
    "Actividad","Configuración","Alertas","Plantillas","Reuniones"
  ];

  const S = {
    session:null, profile:null, data:{}, history:[], selectedProjectId:"", selectedInvoiceId:"",
    syncedAt:null, syncing:false, lightSyncing:false, rendering:false, indexingDocs:false,
    docsText:new Map(), docFingerprints:new Map(), lastActivityMarker:"", provider:null,
  };

  const esc = (v="") => String(v ?? "").replace(/[&<>'\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]));
  const money = v => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(v||0));
  const main = () => document.getElementById("main-content");
  const inMira = () => document.getElementById("view-title")?.textContent?.trim() === "MIRA Business";
  const pkFor = table => PRIMARY_KEY[table] || "id";

  function toast(message,type="success") {
    const root=document.getElementById("toast-root"); if(!root)return;
    const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=message; root.appendChild(el);
    setTimeout(()=>el.remove(),4200);
  }

  async function auth() {
    if(!S.session) S.session=(await db.auth.getSession()).data?.session||null;
    if(!S.session?.user)return false;
    if(!S.profile){
      const {data}=await db.from("company_users").select("user_id,email,full_name,role,status,rut").eq("user_id",S.session.user.id).maybeSingle();
      S.profile=data||null;
    }
    return !!S.profile && S.profile.status==="active";
  }

  async function aal2(){ return (await db.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel==="aal2"; }

  async function rows(table,limit=350){
    try{ const {data,error}=await db.from(table).select("*").limit(limit); if(error)throw error; return data||[]; }
    catch(error){ console.warn(`MIRA v7: no se pudo leer ${table}:`,error.message||error); return []; }
  }

  function updateSyncUi(busy=false,label=""){
    document.querySelector("[data-mv7-dot]")?.classList.toggle("busy",!!busy);
    const node=document.querySelector("[data-mv7-sync]");
    if(node) node.textContent=label||(busy?"Sincronizando…":(S.syncedAt?`Actualizado ${S.syncedAt.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}`:"Bajo demanda"));
  }

  async function syncAll({silent=true}={}){
    if(S.syncing||!(await auth()))return S.data;
    S.syncing=true; updateSyncUi(true);
    try{
      const names=Object.keys(SCHEMA); const result=await Promise.all(names.map(t=>rows(t)));
      names.forEach((t,i)=>{S.data[t]=result[i];}); S.syncedAt=new Date(); refreshUi();
      if(!silent)toast("Contexto empresarial actualizado.");
      return S.data;
    } finally { S.syncing=false; updateSyncUi(false); }
  }

  async function refreshSelected(table,id){
    if(!id)return; const key=pkFor(table);
    const {data,error}=await db.from(table).select("*").eq(key,id).maybeSingle(); if(error||!data)return;
    const list=S.data[table]||[]; const idx=list.findIndex(x=>String(x[key])===String(id));
    if(idx>=0)list[idx]=data; else list.unshift(data); S.data[table]=list;
  }

  async function lightSync(){
    if(!inMira()||document.visibilityState!=="visible"||S.lightSyncing||S.syncing||!(await auth()))return;
    S.lightSyncing=true;
    try{
      const jobs=[db.from("company_activity").select("id,action,entity_type,entity_id,details,created_at").order("created_at",{ascending:false}).limit(8)];
      if(S.selectedProjectId)jobs.push(refreshSelected("company_projects",S.selectedProjectId));
      if(S.selectedInvoiceId)jobs.push(refreshSelected("company_invoices",S.selectedInvoiceId));
      const result=await Promise.all(jobs); const activities=result[0]?.data||[];
      const marker=activities[0]?`${activities[0].id}|${activities[0].created_at}`:"none";
      if(!S.lastActivityMarker)S.lastActivityMarker=marker;
      else if(marker!==S.lastActivityMarker){ S.lastActivityMarker=marker; await syncAll({silent:true}); await indexDocuments({manual:false}); }
      else { S.syncedAt=new Date(); refreshUi(); updateSyncUi(false,`Sin cambios · ${S.syncedAt.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`); }
    } catch(error){ console.warn("MIRA v7 sync ligera:",error.message||error); }
    finally{S.lightSyncing=false;}
  }

  function summarize(){
    const d=S.data, invoices=d.company_invoices||[], service=d.company_service_cases||[];
    return {
      projects:(d.company_projects||[]).length, invoices:invoices.length, files:(d.company_files||[]).length,
      receivable:invoices.filter(x=>x.invoice_type==="sale"&&["pending","partial"].includes(x.payment_status)).reduce((a,b)=>a+Number(b.total_amount||0),0),
      payable:invoices.filter(x=>x.invoice_type==="purchase"&&["pending","partial"].includes(x.payment_status)).reduce((a,b)=>a+Number(b.total_amount||0),0),
      postSale:service.filter(x=>!["resolved","closed","cancelled"].includes(x.status)).length,
    };
  }

  function compactRow(table,row){
    if(!row)return null; const key=pkFor(table); const out={id:row[key]};
    for(const field of SCHEMA[table]||[]) if(row[field]!==undefined&&row[field]!==null&&row[field]!=="")out[field]=row[field];
    return out;
  }

  function contextPayload(){
    const out={}; const projectTables=new Set(["company_files","company_documents","company_quotations","company_purchase_orders","company_contracts","company_invoices","company_transactions","company_assets","company_service_cases","company_meetings","company_project_events"]);
    for(const table of Object.keys(SCHEMA)){
      const values=S.data[table]||[]; let selected=values;
      if(S.selectedProjectId&&projectTables.has(table)){
        const related=values.filter(x=>x.project_id===S.selectedProjectId); const other=values.filter(x=>x.project_id!==S.selectedProjectId).slice(0,12);
        selected=[...related.slice(0,70),...other];
      } else selected=values.slice(0,70);
      out[table]=selected.map(x=>compactRow(table,x));
    }
    if(S.docsText.size)out.document_text_index=[...S.docsText.entries()].slice(0,12).map(([id,text])=>({id,text:text.slice(0,10000)}));
    return JSON.stringify(out).slice(0,50000);
  }

  function protocol(userText){
    const schema=Object.entries(SCHEMA).map(([t,f])=>`${t}: ${f.join(", ")}`).join("\n");
    return `PROTOCOLO INTERNO MIRA ORQUESTADOR v7. Devuelve EXCLUSIVAMENTE JSON válido, sin markdown.\nFORMATO: {"mode":"chat|answer|plan","reply":"respuesta","actions":[{"op":"insert|update|delete|rpc|function|notify","table":"","id":"","values":{},"rpc":"company_run_audit","function":"company-user-admin","body":{},"subject":"","message":"","summary":""}]}\nREGLAS:\n- chat=conversación; answer=leer/analizar; plan=gestión que modifica o ejecuta.\n- No inventes ids ni datos.\n- Puedes coordinar varios módulos en un plan.\n- company_users se administra solo con function company-user-admin.\n- company_document_versions, company_activity y company_project_financial_summary son solo lectura.\n- company_settings y company_alerts solo se actualizan directamente.\n- Auditoría: rpc company_run_audit. Correo: notify.\n- Ejecución terminada + facturación incompleta = rectificación administrativa; no reactivar ejecución física.\n- Cierre total puede crear garantía base 3 meses; si se solicita extensión, 6 meses.\n- company_assets es inventario maestro; project_id lo relaciona al inventario del proyecto.\n- Nunca expongas credenciales/service_role.\nCAMPOS REALES DE SUPABASE:\n${schema}\nMÓDULOS: ${MODULES.join(", ")}\nSOLICITUD: ${userText}`;
  }

  async function callMira(text){
    if(!(await auth()))throw new Error("Sesión administrativa no disponible");
    const r=await fetch(`${cfg.backendUrl}/api/admin/mira`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${S.session.access_token}`},body:JSON.stringify({message:protocol(text),context:contextPayload(),history:S.history.slice(-8)})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error([data.error,data.providerMessage].filter(Boolean).join(" · ")||"No fue posible consultar MIRA Business");
    const raw=String(data.reply||"").trim();
    try{const p=JSON.parse(raw.replace(/^```json\s*/i,"").replace(/```$/i,"").trim());return{mode:["chat","answer","plan"].includes(p.mode)?p.mode:"answer",reply:String(p.reply||""),actions:Array.isArray(p.actions)?p.actions:[]};}
    catch(_){return{mode:"chat",reply:raw||"No pude generar respuesta.",actions:[]};}
  }

  function validAction(action){
    if(!action||!["insert","update","delete","rpc","function","notify"].includes(action.op))return null;
    if(["insert","update","delete"].includes(action.op)){
      if(!SCHEMA[action.table]||READ_ONLY.has(action.table)||USERS_FUNCTION_ONLY.has(action.table))return null;
      if(UPDATE_ONLY.has(action.table)&&action.op!=="update")return null;
      const values={}; for(const [k,v] of Object.entries(action.values||{}))if(SCHEMA[action.table].includes(k))values[k]=v;
      if(action.op==="insert"&&!Object.keys(values).length)return null;
      if(action.op==="update"&&(!action.id||!Object.keys(values).length))return null;
      if(action.op==="delete"&&!action.id)return null;
      return{...action,values,summary:String(action.summary||`${action.op} ${action.table}`)};
    }
    if(action.op==="rpc")return action.rpc==="company_run_audit"?{...action,summary:String(action.summary||"Ejecutar auditoría")}:null;
    if(action.op==="function")return action.function==="company-user-admin"?{...action,summary:String(action.summary||"Administrar usuario")}:null;
    if(action.op==="notify")return action.message?{...action,subject:String(action.subject||"Notificación Innova Admin"),message:String(action.message),summary:String(action.summary||"Enviar notificación")}:null;
    return null;
  }

  const sensitive=a=>!!a&&(a.op==="delete"||a.op==="function"||["company_settings","company_tax_records"].includes(a.table));

  function addMsg(text,kind="mira"){
    const box=document.getElementById("mv7-msgs"); if(!box)return; const el=document.createElement("div");
    el.className=`mv7-msg ${kind}`; el.textContent=text; box.appendChild(el); box.scrollTop=box.scrollHeight;
  }

  function showPlan(reply,raw){
    const actions=raw.map(validAction).filter(Boolean); if(!actions.length)return addMsg(reply||"No hay acciones válidas para ejecutar.","warn");
    const root=document.createElement("div"); root.id="mv7-permission"; root.className="mv7-modal"; const needsMfa=actions.some(sensitive);
    root.innerHTML=`<div><h3>Autorizar a MIRA</h3><p>${esc(reply)}</p>${actions.map((a,i)=>`<div class="mv7-action"><strong>${i+1}. ${esc(a.summary)}</strong><br><small>${esc(a.table||a.rpc||a.function||"notificación")}</small></div>`).join("")}${needsMfa?'<div class="mv7-sensitive"><strong>Acción sensible:</strong> requiere MFA.</div>':""}<div class="mv7-row"><button id="mv7-cancel" class="btn ghost">Cancelar</button><button id="mv7-authorize" class="btn primary">Autorizar y ejecutar</button></div></div>`;
    document.body.appendChild(root); root.querySelector("#mv7-cancel").onclick=()=>root.remove(); root.querySelector("#mv7-authorize").onclick=()=>executePlan(actions,needsMfa);
  }

  async function executePlan(actions,needsMfa){
    if(needsMfa&&!(await aal2()))return toast("Esta gestión requiere MFA. Verifica MFA y vuelve a autorizar.","warning");
    const button=document.getElementById("mv7-authorize"); if(button){button.disabled=true;button.textContent="Ejecutando…";}
    let done=0;
    try{
      for(const a of actions){
        const key=pkFor(a.table);
        if(a.op==="insert"){const {error}=await db.from(a.table).insert(a.values);if(error)throw error;}
        else if(a.op==="update"){const {data,error}=await db.from(a.table).update(a.values).eq(key,a.id).select(key);if(error)throw error;if(!data?.length)throw new Error(`No se confirmó actualización en ${a.table}`);}
        else if(a.op==="delete"){const {error}=await db.from(a.table).delete().eq(key,a.id);if(error)throw error;}
        else if(a.op==="rpc"){const {error}=await db.rpc(a.rpc);if(error)throw error;}
        else if(a.op==="function"){const {data,error}=await db.functions.invoke(a.function,{body:a.body||{}});if(error)throw error;if(data?.error)throw new Error(data.error);}
        else if(a.op==="notify"){const r=await fetch(`${cfg.backendUrl}/api/admin/notify`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${S.session.access_token}`},body:JSON.stringify({subject:a.subject,message:a.message})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"No se pudo enviar notificación");}
        done++;
      }
      document.getElementById("mv7-permission")?.remove(); await syncAll({silent:true}); await indexDocuments({manual:false});
      addMsg(`Gestión completada: ${done} acción(es) ejecutada(s), verificadas y sincronizadas.`,"ok"); toast("Gestión ejecutada y sincronizada.");
    }catch(error){document.getElementById("mv7-permission")?.remove();addMsg(`La ejecución se detuvo: ${error.message||error}.`,"warn");await syncAll({silent:true});}
  }

  async function send(){
    const input=document.getElementById("mv7-input"), text=input?.value.trim(); if(!text)return; input.value=""; addMsg(text,"user");
    const button=document.getElementById("mv7-send");if(button)button.disabled=true;
    try{if(!S.syncedAt)await syncAll({silent:true});addMsg("Analizando contexto y seleccionando herramientas…","plan");const wait=document.querySelector("#mv7-msgs .mv7-msg.plan:last-child");const result=await callMira(text);wait?.remove();if(result.mode==="plan"&&result.actions.length)showPlan(result.reply,result.actions);else addMsg(result.reply||"Listo.");S.history.push({role:"user",content:text},{role:"assistant",content:result.reply||""});S.history=S.history.slice(-12);}
    catch(error){document.querySelector("#mv7-msgs .mv7-msg.plan:last-child")?.remove();addMsg(`No pude completar la consulta: ${error.message||error}`,"warn");}
    finally{if(button)button.disabled=false;input?.focus();}
  }

  async function extractPdf(file){if(!window.pdfjsLib)return"";const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;let text="";for(let n=1;n<=Math.min(pdf.numPages,50);n++){const page=await pdf.getPage(n),c=await page.getTextContent();text+=c.items.map(x=>x.str).join(" ")+"\n";if(text.length>100000)break;}return text.slice(0,100000);}
  async function extractDocx(file){if(!window.JSZip)return"";const zip=await window.JSZip.loadAsync(await file.arrayBuffer()),xml=await zip.file("word/document.xml")?.async("text");if(!xml)return"";const doc=new DOMParser().parseFromString(xml,"application/xml");return[...doc.getElementsByTagName("w:t")].map(n=>n.textContent).join(" ").slice(0,100000);}
  const fingerprint=row=>`${row.id}|${row.sha256||""}|${row.file_size||""}|${row.created_at||row.occurred_at||""}|${row.storage_path||""}`;
  const cacheKey=fp=>`innova-mira-doc-v7:${fp}`;

  async function indexDocuments({manual=false}={}){
    if(S.indexingDocs||!(await auth()))return;if(!S.syncedAt)await syncAll({silent:true});S.indexingDocs=true;let newReads=0,cached=0;
    try{
      const files=(S.data.company_files||[]).filter(x=>!x.archived);const selected=S.selectedProjectId?files.filter(x=>x.project_id===S.selectedProjectId):files.slice(0,12);
      for(const row of selected.slice(0,12)){
        const fp=fingerprint(row);if(S.docFingerprints.get(row.id)===fp&&S.docsText.has(row.id))continue;
        try{const saved=sessionStorage.getItem(cacheKey(fp));if(saved){S.docsText.set(row.id,saved);S.docFingerprints.set(row.id,fp);cached++;continue;}}catch(_){}
        if(!row.storage_path)continue;
        try{const {data,error}=await db.storage.from(cfg.storageBucket||"company-files").download(row.storage_path);if(error||!data)continue;const name=String(row.original_name||row.title||row.storage_path).toLowerCase();let text="";if(name.endsWith(".pdf")||data.type==="application/pdf")text=await extractPdf(data);else if(name.endsWith(".docx"))text=await extractDocx(data);else if(/\.(txt|csv|json|xml|html?|md)$/i.test(name)||/^text\//.test(data.type))text=(await data.text()).slice(0,100000);if(!text.trim())continue;const compact=text.trim().slice(0,80000);S.docsText.set(row.id,compact);S.docFingerprints.set(row.id,fp);try{sessionStorage.setItem(cacheKey(fp),compact);}catch(_){}newReads++;}catch(_){}
      }
      refreshUi();if(manual)toast(newReads?`Documentos actualizados: ${newReads} archivo(s) nuevo(s) o modificado(s).`:`Sin cambios documentales. ${S.docsText.size} documento(s) siguen en caché.`);
    } finally {S.indexingDocs=false;const node=document.getElementById("mv7-doc-status");if(node)node.textContent=`${S.docsText.size} documento(s) en caché · ${newReads} leído(s) ahora · ${cached} recuperado(s) sin descarga.`;}
  }

  async function providerHealth(){
    if(!(await auth()))return;try{const r=await fetch(`${cfg.backendUrl}/api/admin/mira-health`,{headers:{Authorization:`Bearer ${S.session.access_token}`}});const data=await r.json().catch(()=>({}));S.provider={ok:r.ok&&data.ok,message:r.ok&&data.ok?`IA lista · ${data.primaryModel||"OpenRouter"}`:(data.providerMessage||data.error||"IA no disponible")};}catch(_){S.provider={ok:false,message:"Diagnóstico de IA no disponible"};}refreshUi();
  }

  function refreshUi(){
    if(!inMira())return;const k=summarize();const values={projects:k.projects,invoices:k.invoices,files:k.files,receivable:money(k.receivable),payable:money(k.payable),postSale:k.postSale};
    for(const [key,value] of Object.entries(values)){const el=document.querySelector(`[data-mv7-kpi="${key}"]`);if(el)el.textContent=value;}
    const docs=document.getElementById("mv7-doc-status");if(docs)docs.textContent=`${S.docsText.size} documento(s) en caché. Solo se releen archivos nuevos o modificados.`;
    const provider=document.getElementById("mv7-provider");if(provider&&S.provider){provider.textContent=S.provider.message;provider.classList.toggle("bad",!S.provider.ok);}
  }

  function styles(){if(document.getElementById("mira-v7-style"))return;const s=document.createElement("style");s.id="mira-v7-style";s.textContent=`.mv7-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:14px}.mv7-head h2{margin:0 0 5px}.mv7-head p{margin:0;color:var(--muted);max-width:900px}.mv7-state{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.mv7-live,.mv7-provider{display:inline-flex;gap:6px;align-items:center;padding:6px 9px;border-radius:999px;background:#eef8f3;color:#167447;font-size:.68rem;font-weight:800}.mv7-provider.bad{background:#fff2df;color:#8b5c00}.mv7-dot{width:7px;height:7px;border-radius:50%;background:#18a765}.mv7-dot.busy{background:#e5a31a}.mv7-grid{display:grid;grid-template-columns:330px 1fr;gap:16px}.mv7-side,.mv7-chat{background:#fff;border:1px solid var(--line);border-radius:20px}.mv7-side{padding:17px}.mv7-side label{display:flex;flex-direction:column;gap:5px;font-size:.78rem;font-weight:800;margin-bottom:10px}.mv7-side select{padding:10px;border:1px solid var(--line);border-radius:11px}.mv7-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.mv7-kpi{padding:9px;border:1px solid #e7ebf4;border-radius:11px;background:#f7f9fd}.mv7-kpi small{display:block;color:var(--muted);font-size:.62rem}.mv7-tools{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:10px}.mv7-tool{border:1px solid #e0e7f4;background:#f8fbff;border-radius:11px;padding:8px;text-align:left;font-size:.68rem;font-weight:800;color:#315b9d;cursor:pointer}.mv7-docs{margin-top:12px;padding:10px;border:1px dashed #ccd6e8;border-radius:12px;font-size:.7rem;color:var(--muted)}.mv7-cap{display:flex;gap:4px;flex-wrap:wrap;margin-top:9px}.mv7-badge{padding:4px 7px;border-radius:999px;background:#eef4ff;color:#3858b8;font-size:.63rem;font-weight:800}.mv7-chat{overflow:hidden}.mv7-msgs{height:500px;overflow:auto;padding:18px;background:#fbfcff}.mv7-msg{max-width:86%;padding:11px 13px;border-radius:14px;margin-bottom:9px;white-space:pre-wrap;line-height:1.5}.mv7-msg.user{margin-left:auto;background:#315efb;color:white}.mv7-msg.mira{background:#eef2f8}.mv7-msg.ok{background:#e9f8ef;color:#17633d}.mv7-msg.warn{background:#fff4dc;color:#765500}.mv7-msg.plan{background:#f2efff;color:#46339a}.mv7-input{display:grid;grid-template-columns:1fr auto;gap:8px;padding:13px;border-top:1px solid var(--line)}.mv7-input textarea{min-height:64px;border:1px solid #bac7ef;border-radius:12px;padding:11px;font:inherit}.mv7-modal{position:fixed;inset:0;background:#08101f99;z-index:10020;display:grid;place-items:center;padding:18px}.mv7-modal>div{width:min(820px,96vw);max-height:88vh;overflow:auto;background:white;border-radius:20px;padding:20px}.mv7-action{padding:11px;border:1px solid var(--line);border-radius:12px;margin:8px 0}.mv7-sensitive{padding:11px;border:1px solid #ffd895;background:#fff6e4;border-radius:12px}.mv7-row{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}@media(max-width:900px){.mv7-grid{grid-template-columns:1fr}.mv7-msgs{height:390px}}`;document.head.appendChild(s);}

  function render(){
    if(S.rendering||!inMira())return;const m=main();if(!m||m.querySelector("#mv7-msgs"))return;S.rendering=true;
    try{styles();const p=S.data.company_projects||[],inv=S.data.company_invoices||[],k=summarize();m.innerHTML=`<div class="mv7-head"><div><h2>MIRA Business · Orquestador total</h2><p>Esquema sincronizado con Supabase real. Consulta, organiza y ejecuta gestiones autorizadas en toda Innova Admin.</p></div><div class="mv7-state"><span class="mv7-live"><span class="mv7-dot" data-mv7-dot></span><span data-mv7-sync>Contexto listo</span></span><span id="mv7-provider" class="mv7-provider">Verificando IA…</span><span class="mv7-badge">sync 5 s</span><span class="mv7-badge">RLS</span><span class="mv7-badge">MFA</span></div></div><div class="mv7-grid"><aside class="mv7-side"><h3>Contexto y herramientas</h3><label>Proyecto<select id="mv7-project"><option value="">Toda la empresa</option>${p.map(x=>`<option value="${esc(x.id)}">${esc(x.title||x.code||x.id)}</option>`).join("")}</select></label><label>Factura<select id="mv7-invoice"><option value="">Detectar automáticamente</option>${inv.slice(0,200).map(x=>`<option value="${esc(x.id)}">${esc(x.folio||"sin folio")} · ${esc(x.issuer_name||x.recipient_rut||"")}</option>`).join("")}</select></label><div class="mv7-kpis"><div class="mv7-kpi"><small>Proyectos</small><strong data-mv7-kpi="projects">${k.projects}</strong></div><div class="mv7-kpi"><small>Facturas</small><strong data-mv7-kpi="invoices">${k.invoices}</strong></div><div class="mv7-kpi"><small>Archivos</small><strong data-mv7-kpi="files">${k.files}</strong></div><div class="mv7-kpi"><small>Por cobrar</small><strong data-mv7-kpi="receivable">${money(k.receivable)}</strong></div><div class="mv7-kpi"><small>Por pagar</small><strong data-mv7-kpi="payable">${money(k.payable)}</strong></div><div class="mv7-kpi"><small>Postventa</small><strong data-mv7-kpi="postSale">${k.postSale}</strong></div></div><div class="mv7-tools">${[["Proyectos 360°","Revisa todos los proyectos y dime qué requiere gestión."],["Finanzas","Revisa facturas, tesorería, banco e IVA/F29."],["Compras/contratos","Revisa cotizaciones, OC y contratos."],["Inventario","Revisa inventario corporativo y por proyecto."],["Postventa","Revisa garantías, casos y vencimientos."],["RR.HH./usuarios","Revisa RR.HH., usuarios y aprobaciones."],["Auditoría","Ejecuta auditoría completa y explica hallazgos."]].map(([l,q])=>`<button class="mv7-tool" data-prompt="${esc(q)}">${esc(l)}</button>`).join("")}<button class="mv7-tool" id="mv7-refresh">Actualizar contexto</button></div><div class="mv7-docs"><strong>Documentos</strong><br><span id="mv7-doc-status">Los documentos se cachean y no se duplican.</span><br><button id="mv7-index" class="btn ghost" style="margin-top:8px">Actualizar documentos</button></div><div class="mv7-cap">${MODULES.map(x=>`<span class="mv7-badge">${esc(x)}</span>`).join("")}</div></aside><section class="mv7-chat"><div id="mv7-msgs" class="mv7-msgs"><div class="mv7-msg mira">Soy MIRA Business. Leo el estado real de Innova Admin, preparo planes, pido autorización y ejecuto con tus permisos y RLS.</div></div><div class="mv7-input"><textarea id="mv7-input" placeholder="Ej.: Revisa el proyecto Tablets, confirma su estado real y gestiona lo que corresponda."></textarea><button id="mv7-send" class="btn primary"><i class="ri-send-plane-2-line"></i></button></div></section></div>`;
      const ps=document.getElementById("mv7-project"),is=document.getElementById("mv7-invoice");ps.value=S.selectedProjectId;is.value=S.selectedInvoiceId;ps.onchange=()=>{S.selectedProjectId=ps.value;indexDocuments({manual:false}).catch(()=>{});};is.onchange=()=>{S.selectedInvoiceId=is.value;};document.getElementById("mv7-send").onclick=send;document.getElementById("mv7-input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}};document.getElementById("mv7-refresh").onclick=async()=>{await syncAll({silent:false});await indexDocuments({manual:false});};document.getElementById("mv7-index").onclick=()=>indexDocuments({manual:true}).catch(e=>toast(e.message||"No se pudieron actualizar documentos","error"));m.querySelectorAll("[data-prompt]").forEach(b=>b.onclick=()=>{const i=document.getElementById("mv7-input");i.value=b.dataset.prompt;i.focus();});refreshUi();setTimeout(()=>indexDocuments({manual:false}).catch(()=>{}),400);setTimeout(()=>providerHealth(),500);
    }finally{S.rendering=false;}
  }

  async function enter(){if(!inMira()||!(await auth()))return;if(!S.syncedAt||Date.now()-S.syncedAt.getTime()>60000)await syncAll({silent:true});render();updateSyncUi(false);}
  const schedule=(ms=240)=>setTimeout(()=>enter().catch(e=>console.error("MIRA v7",e)),ms);
  document.addEventListener("click",e=>{if(e.target.closest?.('[data-view="mira"]')||e.target.closest?.("#dash-open-mira")||e.target.closest?.('[data-das-view="mira"]'))schedule();},true);
  window.addEventListener("innova-agent-command-center-ready",()=>schedule(180));window.addEventListener("innova-enterprise-ready",()=>schedule(220));
  db.auth.onAuthStateChange((_event,session)=>{S.session=session;S.profile=null;if(!session){S.data={};S.syncedAt=null;S.docsText.clear();S.docFingerprints.clear();}});
  setInterval(()=>lightSync().catch(()=>{}),5000);schedule(300);
})();
