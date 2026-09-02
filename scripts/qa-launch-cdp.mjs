import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = await mkdtemp(path.join(tmpdir(), "wovo-launch-cdp-"));
const port = 9733 + Math.floor(Math.random() * 200);
const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, "about:blank"], { stdio: "ignore" });

async function retry(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return response.json(); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome DevTools was unavailable");
}

const targets = await retry(`http://127.0.0.1:${port}/json`);
const target = targets.find((item) => item.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("Chrome page target missing");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let id = 0;
const pending = new Map();
const events = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result ?? {});
  }
  if (message.method === "Runtime.exceptionThrown" || message.method === "Log.entryAdded" || message.method === "Network.loadingFailed") events.push({ method: message.method, params: message.params });
});
function command(method, params = {}) { id += 1; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function evaluate(expression) { const response = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.text); return response.result.value; }
async function navigate(url) { await command("Page.navigate", { url }); await new Promise((resolve) => setTimeout(resolve, 1400)); }

try {
  await command("Page.enable"); await command("Runtime.enable"); await command("Log.enable"); await command("Network.enable");
  await navigate("http://localhost:3000/");
  const root = await evaluate(`(async()=>{
    const button=(text)=>[...document.querySelectorAll('button')].find((node)=>node.textContent.trim()===text);
    button('Video')?.click(); await new Promise(r=>setTimeout(r,50));
    const area=document.querySelector('textarea'); const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(area,'A coral and charcoal creator studio with content cards moving across a desk.'); area.dispatchEvent(new Event('input',{bubbles:true}));
    [...document.querySelectorAll('button')].find((node)=>node.textContent.includes('Adam Auto'))?.click(); await new Promise(r=>setTimeout(r,50));
    [...document.querySelectorAll('button')].find((node)=>node.textContent.includes('Wan 2.2 Turbo'))?.click(); await new Promise(r=>setTimeout(r,50));
    button('Generate')?.click(); await new Promise(r=>setTimeout(r,350));
    return {title:document.title,has720:document.body.innerText.includes('720p'),has1080Unavailable:document.body.innerText.includes('1080p unavailable'),has12:document.body.innerText.includes('12 credits'),authDialog:Boolean(document.querySelector('[aria-labelledby="auth-title"]')),overflow:document.documentElement.scrollWidth>innerWidth+1};
  })()`);
  await navigate("http://localhost:3000/pricing");
  const pricing = await evaluate(`(()=>{ const body=document.body.innerText; const input=[...document.querySelectorAll('input')].find((node)=>node.placeholder==='Minimum $10'); if(input){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'75'); input.dispatchEvent(new Event('input',{bubbles:true}));} const buy=[...document.querySelectorAll('a')].find((node)=>node.textContent.includes('Sign in to buy')); return {hasPlans:['140','225','420'].every(value=>body.includes(value)),hasPacks:['$10','$20','$50','$100','$500','$1,000'].every(value=>body.includes(value)),customCredits:document.body.innerText.includes('825 credits'),buyHref:buy?.getAttribute('href')??null,overflow:document.documentElement.scrollWidth>innerWidth+1};})()`);
  await navigate("http://localhost:3000/login");
  const login = await evaluate(`({email:Boolean(document.querySelector('input[type="email"]')),password:Boolean(document.querySelector('input[type="password"]')),reset:[...document.querySelectorAll('a')].some((node)=>/forgot|reset/i.test(node.textContent)),overflow:document.documentElement.scrollWidth>innerWidth+1})`);
  process.stdout.write(`${JSON.stringify({ root, pricing, login, browserEvents: events.map((item)=>item.method) }, null, 2)}\n`);
  if (!root.has720 || !root.has1080Unavailable || !root.has12 || !root.authDialog || root.overflow || !pricing.hasPlans || !pricing.hasPacks || !pricing.customCredits || pricing.overflow || !login.email || !login.password || !login.reset || login.overflow || events.some((item)=>item.method === "Runtime.exceptionThrown")) process.exitCode = 1;
} finally {
  socket.close(); chrome.kill();
}
