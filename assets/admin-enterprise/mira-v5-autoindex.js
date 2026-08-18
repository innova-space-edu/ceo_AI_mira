(() => {
  "use strict";
  if (new URLSearchParams(location.search).get("safe") === "1") return;

  const seen = new WeakSet();
  let timer = null;

  function run() {
    const title = document.getElementById("view-title")?.textContent?.trim();
    if (title !== "MIRA Business") return;
    const button = document.getElementById("mv5-index-docs");
    if (!button || seen.has(button)) return;
    seen.add(button);
    setTimeout(() => {
      if (document.body.contains(button) && !button.disabled) button.click();
    }, 650);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 180);
  }

  const main = document.getElementById("main-content");
  if (main) new MutationObserver(schedule).observe(main, { childList:true, subtree:true });
  window.addEventListener("innova-business-sync", schedule);
  window.addEventListener("innova-agent-command-center-ready", schedule);
  schedule();
})();
