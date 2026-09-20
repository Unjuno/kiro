// Import-only fetch helper. Node.js 22; never imported by the player runtime.
const params = JSON.parse(process.argv[2]);
const url = new URL('https://en.wikisource.org/w/api.php');
for (const [key,value] of Object.entries({format:'json',formatversion:2,maxlag:5,...params})) url.searchParams.set(key,String(value));
let failure;
for (let attempt=0; attempt<4; attempt++) {
  try {
    const response = await fetch(url, {headers:{'User-Agent':'KIRO/0.1 (https://github.com/Unjuno/kiro)'},signal:AbortSignal.timeout(45000)});
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0,500)}`);
    const data = JSON.parse(text);
    if (data.error) throw new Error(JSON.stringify(data.error));
    process.stdout.write(JSON.stringify(data));
    process.exit(0);
  } catch (error) {
    failure=error;
    if (attempt<3) await new Promise(resolve=>setTimeout(resolve,2000*2**attempt));
  }
}
console.error(String(failure));
process.exit(1);
