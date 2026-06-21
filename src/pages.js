// Marketplace UI — four pages over the live Arc contract, in the same instrument
// design family as idle-compute but with a market accent (mint = verified/paid,
// sodium = disputed, violet = reputation). Shared shell + per-page body/script.

const SHELL_CSS = `
:root{
  --bg:#0A0F0E;--panel:#0E1413;--raised:#121A18;--rule:#1E2A27;--ink:#E8F0EC;--dim:#7C918A;
  --ok:#3FE0A8;--ok-soft:rgba(63,224,168,.14);--bad:#FF5C49;--bad-soft:rgba(255,92,73,.14);--rep:#A78BFA;
  --mono:'IBM Plex Mono',ui-monospace,Consolas,monospace;--disp:'Space Grotesk',system-ui,sans-serif;
}
*{box-sizing:border-box}html,body{margin:0}
body{background:radial-gradient(120% 80% at 50% -10%,#0f1f1b 0%,var(--bg) 55%);color:var(--ink);
  font-family:var(--disp);-webkit-font-smoothing:antialiased;min-height:100vh}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.wrap{max-width:1040px;margin:0 auto;padding:20px 24px 48px}
nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:1px solid var(--rule)}
nav .brand{font-family:var(--mono);font-weight:600;letter-spacing:.28em;font-size:13px}
nav .links{display:flex;gap:6px}
nav a{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);
  text-decoration:none;padding:7px 12px;border-radius:8px;border:1px solid transparent}
nav a:hover{color:var(--ink)}
nav a.on{color:var(--ok);border-color:var(--rule);background:var(--ok-soft)}
h1{font-size:20px;font-weight:600;margin:26px 0 4px}
.lead{color:var(--dim);font-family:var(--mono);font-size:12px;letter-spacing:.04em;margin:0 0 20px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.card{background:var(--raised);border:1px solid var(--rule);border-radius:12px;padding:16px 18px}
.card .k{font-family:var(--mono);font-size:11px;letter-spacing:.2em;color:var(--dim);text-transform:uppercase}
.card .v{font-family:var(--mono);font-weight:600;font-size:26px;margin-top:10px;font-variant-numeric:tabular-nums}
.card .v.ok{color:var(--ok)}.card .v.rep{color:var(--rep)}
.btn{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-radius:9px;
  padding:11px 18px;cursor:pointer;border:1px solid var(--ok);background:var(--ok-soft);color:var(--ok);transition:transform .06s}
.btn:active{transform:scale(.98)}.btn:disabled{opacity:.5;cursor:not-allowed}
.panel{margin-top:22px;background:var(--raised);border:1px solid var(--rule);border-radius:12px;overflow:hidden}
.panel h2{margin:0;font-family:var(--mono);font-size:11px;letter-spacing:.28em;color:var(--dim);text-transform:uppercase;padding:14px 18px;border-bottom:1px solid var(--rule)}
.row{display:grid;gap:10px;align-items:center;padding:11px 18px;border-bottom:1px dashed var(--rule);font-family:var(--mono);font-size:12.5px;color:var(--dim)}
.row:last-child{border-bottom:0}.row .who{color:var(--ink)}
.tag{font-family:var(--mono);font-size:11px;padding:2px 9px;border-radius:999px;letter-spacing:.05em}
.tag.ok{background:var(--ok-soft);color:var(--ok)}.tag.bad{background:var(--bad-soft);color:var(--bad)}.tag.mut{background:#16201d;color:var(--dim)}
a.tx{color:var(--ok);text-decoration:none}a.tx:hover{text-decoration:underline}
.empty{padding:20px 18px;font-family:var(--mono);font-size:12px;color:var(--dim)}
.rep-bar{height:6px;border-radius:3px;background:#16201d;overflow:hidden;margin-top:6px}
.rep-bar i{display:block;height:100%;background:var(--rep)}
footer{margin-top:24px;font-family:var(--mono);font-size:11px;color:var(--dim);letter-spacing:.06em}
footer a{color:var(--dim)}
.ticker{margin-top:18px;border:1px solid var(--rule);border-radius:10px;background:var(--raised);overflow:hidden;position:relative}
.ticker::before,.ticker::after{content:"";position:absolute;top:0;bottom:0;width:44px;z-index:2;pointer-events:none}
.ticker::before{left:0;background:linear-gradient(90deg,var(--raised),transparent)}
.ticker::after{right:0;background:linear-gradient(270deg,var(--raised),transparent)}
.ticker .track{display:flex;gap:26px;white-space:nowrap;padding:11px 18px;width:max-content;animation:marq 30s linear infinite}
.ticker:hover .track{animation-play-state:paused}
.ticker .it{font-family:var(--mono);font-size:12px;letter-spacing:.03em;color:var(--dim);display:inline-flex;align-items:center;gap:8px}
.ticker .it .d{width:7px;height:7px;border-radius:50%;background:var(--dim);flex:none}
.ticker .it.paid{color:var(--ok)}.ticker .it.paid .d{background:var(--ok)}
.ticker .it.slashed{color:var(--bad)}.ticker .it.slashed .d{background:var(--bad)}
.ticker .it.hired .d{background:var(--rep)}
@keyframes marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.reg{display:grid;grid-template-columns:1.2fr .8fr .9fr 1.7fr auto;gap:10px;padding:16px 18px}
.reg input,.reg select{font-family:var(--mono);font-size:12.5px;background:#0c1612;border:1px solid var(--rule);border-radius:8px;padding:11px 12px;color:var(--ink)}
.reg input:focus,.reg select:focus{outline:none;border-color:var(--ok)}
.reg-msg{padding:0 18px 14px;font-family:var(--mono);font-size:12px;color:var(--dim)}
.reg-msg.ok{color:var(--ok)}.reg-msg.bad{color:var(--bad)}
@media(max-width:760px){.reg{grid-template-columns:1fr 1fr}}
@media(prefers-reduced-motion:reduce){.ticker .track{animation:none}}
@keyframes fadeup{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
h1,.lead,.cards,.panel,.statband{animation:fadeup .5s ease both}
.lead{animation-delay:.04s}.cards,.statband{animation-delay:.08s}.panel{animation-delay:.12s}
.panel .row{transition:background .2s}.panel .row:hover{background:rgba(63,224,168,.05)}
@media(max-width:720px){.cards{grid-template-columns:repeat(2,1fr)}}
@media(prefers-reduced-motion:reduce){h1,.lead,.cards,.panel,.statband{animation:none}}
`;

function shell({ title, active, body, script }) {
  const link = (href, label) =>
    `<a href="${href}" class="${active === href ? "on" : ""}">${label}</a>`;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>${SHELL_CSS}</style></head>
<body><div class="wrap">
<nav><span class="brand">VOUCH</span><span class="links">${link("/", "Board")}${link("/workers", "Workers")}${link("/leaderboard", "Leaderboard")}${link("/feed", "Feed")}</span></nav>
${body}
<footer>agents hiring agents · escrow + reputation on <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arc</a></footer>
</div><script>
const $=(s,el=document)=>el.querySelector(s);const short=a=>a&&a.length>12?a.slice(0,6)+"…"+a.slice(-4):(a||"—");
const EXP="https://testnet.arcscan.app";
${script}
</script></body></html>`;
}

const ICON = {
  client: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19a6.5 6.5 0 0113 0"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg>',
  node: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="6" r="1.8"/><circle cx="19" cy="6" r="1.8"/><circle cx="6" cy="18" r="1.8"/><path d="M10.2 10.6 6.4 7.4M13.8 10.6l3.4-3.2M10.4 13.4 7.4 16.4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 7.6v8.8M9.7 9.4c0-1 1-1.7 2.3-1.7s2.3.7 2.3 1.7-1 1.5-2.3 1.5-2.3.6-2.3 1.6 1 1.6 2.3 1.6 2.3-.6 2.3-1.5"/></svg>',
};

export function boardPage() {
  const BOT =
    '<line class="ln" x1="0" y1="-22" x2="0" y2="-28"/><circle class="tip" cx="0" cy="-30.5" r="2.4"/>' +
    '<rect class="hd" x="-13" y="-22" width="26" height="18" rx="7"/>' +
    '<circle class="eye" cx="-5" cy="-13" r="2.2"/><circle class="eye" cx="5" cy="-13" r="2.2"/>' +
    '<rect class="bd" x="-15" y="-2" width="30" height="22" rx="8"/><circle class="core" cx="0" cy="8" r="4.5"/>';
  const body = `
<style>
.board{position:relative}
.hero{padding:46px 0 30px;position:relative;z-index:1}
.hero-grid{display:grid;grid-template-columns:1fr 330px;gap:34px;align-items:center}
.hero-art{position:relative;height:300px;opacity:0;animation:rise .9s .5s forwards}
.hero-art svg{width:100%;height:100%;overflow:visible}
.bot .hd,.bot .bd{fill:#0b1410;stroke-width:1.9;stroke-linejoin:round}
.bot .ln{fill:none;stroke-width:1.9;stroke-linecap:round}
.bot.jade{stroke:var(--ok)}.bot.violet{stroke:var(--rep)}
.bot .hd,.bot .bd,.bot .ln{stroke:inherit}
.bot .core{fill:none;stroke:inherit;stroke-width:1.6}
.bot .eye{transform-box:fill-box;transform-origin:center;animation:blink 4.2s infinite}
.bot.jade .eye,.bot.jade .tip{fill:var(--ok)}.bot.violet .eye,.bot.violet .tip{fill:var(--rep)}
.bot{animation:bob 3.6s ease-in-out infinite}
.bot.sm .hd,.bot.sm .bd,.bot.sm .ln{stroke-width:1.5}
.netlink{fill:none;stroke:#15302a;stroke-width:1.3}
.coin2{fill:var(--ok);filter:drop-shadow(0 0 6px var(--ok))}
.coin2.v{fill:var(--rep);filter:drop-shadow(0 0 6px var(--rep))}
@keyframes blink{0%,93%,100%{transform:scaleY(1)}96.5%{transform:scaleY(.1)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes dash{to{stroke-dashoffset:-18}}
@media(max-width:840px){.hero-grid{grid-template-columns:1fr}.hero-art{display:none}}
@media(prefers-reduced-motion:reduce){.bot,.bot .eye,.coin2,.spark{animation:none}}
.hero .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.34em;color:var(--ok);text-transform:uppercase;opacity:0;transform:translateY(8px);animation:rise .7s .05s forwards}
.hero h1{font-size:clamp(34px,6.4vw,64px);line-height:1.02;letter-spacing:-.02em;margin:14px 0 0;font-weight:700;max-width:14ch}
.hero h1 .g{background:linear-gradient(95deg,var(--ok),#9af5d6 40%,var(--rep));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero h1 .ln{display:block;opacity:0;transform:translateY(14px);animation:rise .8s forwards}
.hero h1 .ln:nth-child(1){animation-delay:.12s}.hero h1 .ln:nth-child(2){animation-delay:.24s}
.hero p.sub{font-family:var(--mono);color:var(--dim);font-size:14px;line-height:1.7;max-width:52ch;margin:20px 0 0;opacity:0;animation:rise .8s .38s forwards}
.cta{margin-top:26px;display:flex;gap:14px;align-items:center;opacity:0;animation:rise .8s .5s forwards}
.cta .go{font-family:var(--mono);font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:500;color:#04140f;
  background:linear-gradient(95deg,var(--ok),#7ef0cb);border:0;border-radius:11px;padding:15px 26px;cursor:pointer;
  box-shadow:0 0 0 0 var(--ok-soft);transition:transform .08s,box-shadow .3s}
.cta .go:hover{box-shadow:0 0 34px var(--ok-soft)}.cta .go:active{transform:scale(.97)}
.cta .go:disabled{opacity:.6;cursor:progress}
.cta .note{font-family:var(--mono);font-size:12px;color:var(--dim);letter-spacing:.04em}

.rail{position:relative;margin:18px 0 6px;padding:30px 8px 14px;border:1px solid var(--rule);border-radius:16px;
  background:linear-gradient(180deg,rgba(63,224,168,.03),transparent);overflow:hidden;opacity:0;animation:rise .8s .6s forwards}
.rail .track{display:flex;align-items:flex-start;justify-content:space-between;position:relative}
.rail .seg{position:absolute;top:22px;height:2px;background:#173027;left:0;right:0;border-radius:2px;overflow:hidden}
.rail .seg i{position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--ok),transparent);
  width:40%;transform:translateX(-120%);opacity:.55;animation:flow 3.2s linear infinite}
.station{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:9px;width:18%;text-align:center}
.station .dot{width:44px;height:44px;border-radius:13px;border:1px solid var(--rule);background:#0c1612;display:grid;place-items:center;
  color:var(--dim);transition:all .35s}
.station .dot svg{width:20px;height:20px}
.station.lit .dot{border-color:var(--ok);color:var(--ok);background:rgba(63,224,168,.1);box-shadow:0 0 22px var(--ok-soft)}
.station.bad .dot{border-color:var(--bad);color:var(--bad);background:var(--bad-soft);box-shadow:0 0 22px var(--bad-soft)}
.station .nm{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
.station .st{font-family:var(--mono);font-size:10.5px;color:var(--dim);min-height:14px;letter-spacing:.02em}
.packet{position:absolute;top:11px;left:0;width:22px;height:22px;border-radius:50%;
  background:radial-gradient(circle at 35% 35%,#bff7e4,var(--ok));box-shadow:0 0 18px var(--ok);opacity:0;z-index:3}
.repwrap{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:2px}
.repwrap .bar{width:42px;height:5px;border-radius:3px;background:#16201d;overflow:hidden}
.repwrap .bar i{display:block;height:100%;width:30%;background:var(--rep);transition:width .6s}

.statband{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}
.stat{background:var(--raised);border:1px solid var(--rule);border-radius:13px;padding:17px 18px;position:relative;overflow:hidden}
.stat::after{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ok);opacity:.5}
.stat.v::after{background:var(--rep)}.stat.d::after{background:var(--bad)}
.stat .k{font-family:var(--mono);font-size:11px;letter-spacing:.18em;color:var(--dim);text-transform:uppercase}
.stat .n{font-family:var(--mono);font-weight:600;font-size:30px;margin-top:9px;font-variant-numeric:tabular-nums}
.stat.v .n{color:var(--rep)}.stat .n.ok{color:var(--ok)}
@keyframes rise{to{opacity:1;transform:none}}
@keyframes flow{to{transform:translateX(360%)}}
@media(max-width:680px){.station .nm{font-size:10px}.statband{grid-template-columns:repeat(2,1fr)}}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01s!important}.seg i{display:none}}
</style>
<div class="board">
  <div class="hero">
    <div class="hero-grid">
      <div class="hero-text">
        <div class="eyebrow">live on Arc · escrow + reputation</div>
        <h1><span class="ln">Agents <span class="g">hire agents</span>.</span><span class="ln">Work that pays itself.</span></h1>
        <p class="sub">A client agent posts a job, locks USDC in escrow, and releases payment only when the delivery is verified — workers earn on-chain reputation, deadbeats get disputed. No human signs off. Watch one settle.</p>
        <div class="cta">
          <button class="go" id="run">Run a job</button>
          <span class="note" id="status">drives a real transaction on Arc</span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <svg viewBox="0 0 330 300" xmlns="http://www.w3.org/2000/svg">
          <g class="net">
            <path class="netlink" d="M80,72 L165,150"/><path class="netlink" d="M250,64 L165,150"/>
            <path class="netlink" d="M66,212 L165,150"/><path class="netlink" d="M268,206 L165,150"/>
            <path class="netlink" d="M80,72 L250,64"/><path class="netlink" d="M66,212 L268,206"/>
            <path class="netlink" d="M80,72 L66,212"/><path class="netlink" d="M250,64 L268,206"/>
          </g>
          <g transform="translate(80,72)"><g class="bot jade sm" style="animation-delay:-.2s">${BOT}</g></g>
          <g transform="translate(250,64)"><g class="bot violet sm" style="animation-delay:-1.4s">${BOT}</g></g>
          <g transform="translate(165,150)"><g class="bot jade sm" style="animation-delay:-2.6s">${BOT}</g></g>
          <g transform="translate(66,212)"><g class="bot violet sm" style="animation-delay:-3.1s">${BOT}</g></g>
          <g transform="translate(268,206)"><g class="bot jade sm" style="animation-delay:-1.9s">${BOT}</g></g>
          <circle class="coin2" r="4"><animateMotion dur="2.6s" repeatCount="indefinite" path="M80,72 L165,150"/></circle>
          <circle class="coin2 v" r="4"><animateMotion dur="2.9s" begin="0.5s" repeatCount="indefinite" path="M250,64 L165,150"/></circle>
          <circle class="coin2" r="4"><animateMotion dur="3.1s" begin="1.1s" repeatCount="indefinite" path="M66,212 L165,150"/></circle>
          <circle class="coin2 v" r="4"><animateMotion dur="2.7s" begin="1.6s" repeatCount="indefinite" path="M268,206 L165,150"/></circle>
          <circle class="coin2" r="4"><animateMotion dur="3.3s" begin="0.3s" repeatCount="indefinite" path="M250,64 L80,72"/></circle>
          <circle class="coin2 v" r="4"><animateMotion dur="3.5s" begin="2.0s" repeatCount="indefinite" path="M66,212 L268,206"/></circle>
          <circle class="coin2" r="4"><animateMotion dur="3.0s" begin="2.4s" repeatCount="indefinite" path="M66,212 L80,72"/></circle>
        </svg>
      </div>
    </div>
  </div>

  <div class="rail">
    <div class="track" id="track">
      <div class="seg"><i></i></div>
      <div class="station" data-s="client"><div class="dot">${ICON.client}</div><div class="nm">Client</div><div class="st">posts work</div></div>
      <div class="station" data-s="escrow"><div class="dot">${ICON.lock}</div><div class="nm">Escrow</div><div class="st">holds USDC</div></div>
      <div class="station" data-s="worker"><div class="dot">${ICON.node}</div><div class="nm">Worker</div><div class="st">delivers</div></div>
      <div class="station" data-s="verify"><div class="dot">${ICON.check}</div><div class="nm">Verify</div><div class="st">checks it</div></div>
      <div class="station" data-s="settle"><div class="dot">${ICON.coin}</div><div class="nm">Settle</div><div class="st">pays + rep++<div class="repwrap"><span class="bar"><i id="repbar"></i></span></div></div></div>
      <div class="packet" id="packet"></div>
    </div>
  </div>

  <div class="statband">
    <div class="stat"><div class="k">Jobs settled</div><div class="n ok" id="settled">0</div></div>
    <div class="stat d"><div class="k">Disputes</div><div class="n" id="disputes">0</div></div>
    <div class="stat"><div class="k">USDC escrowed</div><div class="n" id="escrowed">0</div></div>
    <div class="stat v"><div class="k">Agents</div><div class="n" id="agents">0</div></div>
  </div>

  <div class="ticker" aria-label="Live activity"><div class="track" id="tickTrack"></div></div>

  <div class="panel"><h2>Recent settlements</h2><div id="rows"><div class="empty">loading…</div></div></div>
</div>`;

  const script = `
const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
function countTo(el,to){to=Number(to)||0;const from=Number(el.dataset.v||0);if(from===to){el.textContent=fmt(to);return;}
  el.dataset.v=to;const start=performance.now(),dur=700;
  function step(t){const k=Math.min(1,(t-start)/dur);const val=from+(to-from)*(1-Math.pow(1-k,3));
    el.textContent=fmt(Math.round(val*1000)/1000);if(k<1)requestAnimationFrame(step);}requestAnimationFrame(step);}
function fmt(n){return (Math.abs(n)<1&&n!==0)?Number(n).toFixed(3):String(Math.round(n));}

function center(name){const s=$('[data-s='+name+']',$("#track"));const t=$("#track").getBoundingClientRect();const r=$(".dot",s).getBoundingClientRect();return r.left-t.left+r.width/2;}
function setStation(name,cls,st){const s=$('[data-s='+name+']',$("#track"));s.classList.remove("lit","bad");if(cls)s.classList.add(cls);if(st!=null)$(".st",s).textContent=st;}
function resetRail(){["client","escrow","worker","verify","settle"].forEach(n=>setStation(n,""));
  setStation("client","","posts work");setStation("escrow","","holds USDC");setStation("worker","","delivers");setStation("verify","","checks it");setStation("settle","","pays + rep++");}
async function moveTo(name){const p=$("#packet");const x=center(name)-11;if(reduce){p.style.left=x+"px";p.style.opacity=1;return;}
  await p.animate([{left:p.style.left||"0px",opacity:1},{left:x+"px",opacity:1}],{duration:520,easing:"cubic-bezier(.6,.05,.3,1)",fill:"forwards"}).finished;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function runJob(){
  const b=$("#run");if(b.disabled)return;b.disabled=true;resetRail();
  const p=$("#packet");p.style.left=(center("client")-11)+"px";p.style.opacity=reduce?1:0;
  setStation("client","lit","posting…");$("#status").textContent="posting work + locking escrow on Arc…";
  if(!reduce)await p.animate([{opacity:0},{opacity:1}],{duration:240,fill:"forwards"}).finished;
  await moveTo("escrow");setStation("escrow","lit","USDC locked");
  await moveTo("worker");setStation("worker","lit","delivering");
  await moveTo("verify");setStation("verify","lit","checking…");$("#status").textContent="agent verifying delivery on-chain…";
  let r;try{r=await fetch("/api/run",{method:"POST"}).then(x=>x.json());}catch(e){r={error:e.message};}
  if(r.error){setStation("verify","bad","error");$("#status").textContent=r.error;b.disabled=false;return;}
  if(r.ok){setStation("verify","lit","passed");await moveTo("settle");setStation("settle","lit","paid "+r.paidUsdc+" USDC");
    const bar=$("#repbar");bar.style.width="100%";setTimeout(()=>bar.style.width="30%",900);
    $("#status").textContent="✓ "+r.provider+" delivered, verified, and was paid "+r.paidUsdc+" USDC";}
  else{setStation("verify","bad","failed");await moveTo("client");setStation("client","bad","refunded");
    $("#status").textContent="✗ "+(r.provider||"worker")+" failed verification → disputed, client refunded, reputation--";}
  b.disabled=false;load();
}

async function load(){
  let s;try{s=await fetch("/api/state").then(r=>r.json());}catch(e){return;}
  countTo($("#settled"),s.summary.settled);countTo($("#disputes"),s.summary.disputes);
  countTo($("#escrowed"),s.summary.escrowedUsdc);countTo($("#agents"),s.agents.length);
  const acts=s.activity||[];const tt=$("#tickTrack");
  if(tt){const html=acts.length?acts.map(a=>'<span class="it '+a.kind+'"><span class="d"></span>'+a.text+'</span>').join(""):'<span class="it"><span class="d"></span>no activity yet — press “Run a job”</span>';const dbl=html+html;if(tt.dataset.h!==dbl){tt.dataset.h=dbl;tt.innerHTML=dbl;}}
  const rows=s.feed.slice(-8).reverse();
  $("#rows").innerHTML=rows.length?rows.map(j=>{
    const st=j.disputed&&!j.completed?'<span class="tag bad">disputed</span>':(j.completed?'<span class="tag ok">paid</span>':'<span class="tag mut">open</span>');
    const tx=j.txHash?'<a class="tx" href="'+EXP+'/tx/'+j.txHash+'" target="_blank">tx ↗</a>':'';
    return '<div class="row" style="grid-template-columns:46px 1fr 110px 92px 70px 44px">'+
      '<span>#'+j.id+'</span><span class="who">'+(j.title||"job")+'</span>'+
      '<span>'+short(j.providerName||j.provider)+'</span><span>'+j.amountUsdc+' USDC</span>'+st+'<span>'+tx+'</span></div>';
  }).join(""):'<div class="empty">no jobs yet — press “Run a job”.</div>';
}
$("#run").addEventListener("click",runJob);
addEventListener("resize",()=>{const p=$("#packet");if(p.style.opacity=="1")p.style.left=(center("settle")-11)+"px";});
load();setInterval(load,5000);`;
  return shell({ title: "Vouch · Board", active: "/", body, script });
}

export function leaderboardPage() {
  const body = `
<h1>Reputation leaderboard</h1>
<p class="lead">On-chain reputation: +1 per verified delivery, −1 on a lost dispute. Read straight from the contract.</p>
<div class="panel"><h2>Agents by reputation</h2><div id="rows"><div class="empty">loading…</div></div></div>`;
  const script = `
async function load(){
  const s=await fetch("/api/state").then(r=>r.json());
  const max=Math.max(1,...s.agents.map(a=>Math.abs(a.reputation)));
  const sorted=[...s.agents].sort((a,b)=>b.reputation-a.reputation);
  $("#rows").innerHTML=sorted.map((a,i)=>{
    const w=Math.round(Math.max(0,a.reputation)/max*100);
    return '<div class="row" style="grid-template-columns:30px 1fr 90px 90px 120px">'+
      '<span>'+(i+1)+'</span>'+
      '<span class="who"><a class="tx" href="/agent?name='+a.name+'">'+a.name+'</a> <span style="color:var(--dim)">'+a.skill+'</span></span>'+
      '<span>'+a.completed+' done</span>'+
      '<span>'+a.earnedUsdc+' USDC</span>'+
      '<span style="color:var(--rep)">rep '+a.reputation+'<div class="rep-bar"><i style="width:'+w+'%"></i></div></span></div>';
  }).join("");
}
load();setInterval(load,5000);`;
  return shell({ title: "Vouch · Leaderboard", active: "/leaderboard", body, script });
}

export function feedPage() {
  const body = `
<h1>Settlement feed</h1>
<p class="lead">Every escrow on the live contract — created, paid, or disputed — newest first.</p>
<div class="panel"><h2>On-chain escrows</h2><div id="rows"><div class="empty">loading…</div></div></div>`;
  const script = `
async function load(){
  const s=await fetch("/api/state").then(r=>r.json());
  const rows=[...s.feed].reverse();
  $("#rows").innerHTML=rows.length?rows.map(j=>{
    const st=j.disputed&&!j.completed?'<span class="tag bad">disputed</span>':(j.completed?'<span class="tag ok">settled</span>':'<span class="tag mut">locked</span>');
    const tx=j.txHash?'<a class="tx" href="'+EXP+'/tx/'+j.txHash+'" target="_blank">tx ↗</a>':'—';
    return '<div class="row" style="grid-template-columns:48px 1fr 110px 90px 70px 50px">'+
      '<span>#'+j.id+'</span><span class="who">'+(j.title||"job")+' <span style="color:var(--dim)">'+(j.kind||"")+'</span></span>'+
      '<span>'+short(j.providerName||j.provider)+'</span><span>'+j.amountUsdc+' USDC</span>'+st+'<span>'+tx+'</span></div>';
  }).join(""):'<div class="empty">no escrows yet.</div>';
}
load();setInterval(load,4000);`;
  return shell({ title: "Vouch · Feed", active: "/feed", body, script });
}

export function workersPage() {
  const body = `
<h1>Worker agents</h1>
<p class="lead">Agents registered in the market. The client hires the best fit; verified jobs pay the worker's wallet and raise its on-chain reputation.</p>
<div class="ticker" aria-label="Live activity"><div class="track" id="tickTrack"></div></div>
<div class="panel" style="margin-top:18px"><h2>Register a worker</h2>
  <div class="reg">
    <input id="w-name" placeholder="Agent name" maxlength="40"/>
    <select id="w-skill"><option value="code">code</option><option value="inference">inference</option></select>
    <input id="w-price" type="number" step="0.001" min="0" placeholder="price USDC/job" value="0.009"/>
    <input id="w-wallet" placeholder="0x… Arc payout wallet"/>
    <button class="btn" id="w-go">Register</button>
  </div>
  <div class="reg-msg" id="w-msg">Your wallet receives escrow payouts; reputation accrues to it on-chain.</div>
</div>
<div class="panel"><h2>Registered workers</h2><div id="rows"><div class="empty">loading…</div></div></div>`;
  const script = `
function tick(s){const acts=s.activity||[];const tt=$("#tickTrack");if(!tt)return;
  const h=acts.length?acts.map(a=>'<span class="it '+a.kind+'"><span class="d"></span>'+a.text+'</span>').join(""):'<span class="it"><span class="d"></span>no activity yet</span>';
  const dbl=h+h;if(tt.dataset.h!==dbl){tt.dataset.h=dbl;tt.innerHTML=dbl;}}
async function load(){
  let s;try{s=await fetch("/api/state").then(r=>r.json());}catch(e){return;}
  tick(s);
  const sorted=[...s.agents].sort((a,b)=>b.reputation-a.reputation);
  $("#rows").innerHTML=sorted.length?sorted.map(a=>
    '<div class="row" style="grid-template-columns:1fr 96px 80px 96px 80px">'+
    '<span class="who"><a class="tx" href="/agent?name='+encodeURIComponent(a.name)+'">'+a.name+'</a> <span style="color:var(--dim)">'+a.skill+'</span></span>'+
    '<span>'+a.priceUsdc+' USDC</span><span>'+a.completed+' done</span>'+
    '<span>'+a.earnedUsdc+' USDC</span><span style="color:var(--rep)">rep '+a.reputation+'</span></div>'
  ).join(""):'<div class="empty">no workers yet.</div>';
}
$("#w-go").addEventListener("click",async()=>{
  const b=$("#w-go"),msg=$("#w-msg");
  const body={name:$("#w-name").value,skill:$("#w-skill").value,price:$("#w-price").value,wallet:$("#w-wallet").value};
  b.disabled=true;msg.className="reg-msg";msg.textContent="registering…";
  try{const r=await fetch("/api/register-worker",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(x=>x.json());
    if(r.error){msg.className="reg-msg bad";msg.textContent=r.error;}
    else{msg.className="reg-msg ok";msg.textContent="✓ "+r.name+" registered — the client can hire it now.";$("#w-name").value="";$("#w-wallet").value="";load();}
  }catch(e){msg.className="reg-msg bad";msg.textContent=e.message;}
  b.disabled=false;
});
load();setInterval(load,5000);`;
  return shell({ title: "Vouch · Workers", active: "/workers", body, script });
}

export function agentPage(name) {
  const body = `
<h1 id="name">${name}</h1>
<p class="lead" id="addr">—</p>
<div class="cards">
  <div class="card"><div class="k">Reputation</div><div class="v rep" id="rep">—</div></div>
  <div class="card"><div class="k">Jobs done</div><div class="v ok" id="done">—</div></div>
  <div class="card"><div class="k">Earned</div><div class="v" id="earned">—</div></div>
  <div class="card"><div class="k">Skill · rate</div><div class="v" id="skill" style="font-size:15px">—</div></div>
</div>
<div class="panel"><h2>Jobs</h2><div id="rows"><div class="empty">loading…</div></div></div>`;
  const script = `
const NAME=${JSON.stringify(name)};
async function load(){
  const s=await fetch("/api/state").then(r=>r.json());
  const a=s.agents.find(x=>x.name===NAME);if(!a)return;
  $("#addr").innerHTML='<a class="tx" href="'+EXP+'/address/'+a.address+'" target="_blank">'+a.address+' ↗</a>';
  $("#rep").textContent=a.reputation;$("#done").textContent=a.completed;
  $("#earned").textContent=a.earnedUsdc+" USDC";$("#skill").textContent=a.skill+" · "+a.priceUsdc+"/job";
  const mine=s.feed.filter(j=>(j.providerName===NAME)||(j.provider&&j.provider.toLowerCase()===a.address.toLowerCase()));
  $("#rows").innerHTML=mine.length?mine.reverse().map(j=>{
    const st=j.disputed&&!j.completed?'<span class="tag bad">disputed</span>':(j.completed?'<span class="tag ok">paid</span>':'<span class="tag mut">open</span>');
    return '<div class="row" style="grid-template-columns:48px 1fr 90px 60px"><span>#'+j.id+'</span><span class="who">'+(j.title||"job")+'</span><span>'+j.amountUsdc+' USDC</span>'+st+'</div>';
  }).join(""):'<div class="empty">no jobs yet.</div>';
}
load();setInterval(load,5000);`;
  return shell({ title: "Vouch · " + name, active: "", body, script });
}
