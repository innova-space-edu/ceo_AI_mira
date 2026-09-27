(() => {
  "use strict";
  let overlay = null;
  function close() {
    overlay?.remove();
    overlay = null;
    document.body.style.removeProperty("overflow");
  }
  function open(token, options = {}) {
    close();
    const base = options.baseUrl || "https://webpay.innova-space-edu.cl/";
    const url = new URL(base);
    url.searchParams.set("p", token);
    url.searchParams.set("embed", "1");

    overlay = document.createElement("div");
    overlay.dataset.innovaPayOverlay = "1";
    Object.assign(overlay.style, {
      position:"fixed",inset:"0",zIndex:"2147483000",background:"rgba(8,14,30,.62)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:"18px"
    });
    const frameWrap = document.createElement("div");
    Object.assign(frameWrap.style, {
      position:"relative",width:"min(650px,96vw)",height:"min(720px,92vh)",
      background:"#fff",borderRadius:"20px",overflow:"hidden",boxShadow:"0 30px 90px rgba(0,0,0,.3)"
    });
    const frame = document.createElement("iframe");
    frame.src = url.toString();
    frame.title = "Innova Pay";
    frame.allow = "payment";
    Object.assign(frame.style,{border:"0",width:"100%",height:"100%"});
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "×";
    button.setAttribute("aria-label","Cerrar pago");
    Object.assign(button.style,{
      position:"absolute",top:"10px",right:"10px",zIndex:"2",width:"34px",height:"34px",
      border:"1px solid #dfe4ee",borderRadius:"10px",background:"#fff",fontSize:"22px",cursor:"pointer"
    });
    button.onclick = close;
    frameWrap.append(frame,button);
    overlay.appendChild(frameWrap);
    overlay.addEventListener("click",(event)=>{if(event.target===overlay)close();});
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    return { close, iframe: frame };
  }
  window.InnovaPay = Object.freeze({ open, close });
})();