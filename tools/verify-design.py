"""Visual checks on real HTTP, or explicitly labelled offline HTML snapshots.
Run with Playwright + Chromium. --offline never claims a live deployment check.
"""
import argparse,base64,json,os,re,subprocess
from pathlib import Path
from importlib.metadata import version
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');parser.add_argument('--out',default='validation-artifacts/design');args=parser.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
base=os.environ.get('BASE_URL','http://127.0.0.1:3001').rstrip('/')
paths={'language':'/','catalog':'/?lang=ja','introduction':'/?lang=ja&story=consider-the-consequences','reader':'/?lang=ja&story=consider-the-consequences&node=Helen','ending':'/?lang=ja&story=consider-the-consequences&node=H-13'}
rendered={}
if args.offline:
 script="import {loadLibrary} from './lib/library.mjs';import {renderRequest} from './lib/player.mjs'; const lib=loadLibrary();console.log(JSON.stringify(Object.fromEntries(Object.entries("+json.dumps(paths)+").map(([k,u])=>[k,renderRequest(u,lib).html]))));"
 rendered=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=ROOT,text=True))
 css=(ROOT/'public/kiro.css').read_text()
 for key,html in rendered.items():
  html=html.replace('<link rel="stylesheet" href="/kiro.css">','<style>'+css+'</style>')
  for asset in ['living-book.webp','branch-mark.svg','favicon.svg']:
   p=ROOT/'public/art'/asset;mime='image/webp' if asset.endswith('.webp') else 'image/svg+xml'
   html=html.replace('/art/'+asset,'data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode())
  rendered[key]=html
checks=[]
with sync_playwright() as p:
 executable=os.environ.get('CHROMIUM_PATH') or None
 if not executable and Path('/usr/bin/chromium').exists():executable='/usr/bin/chromium'
 browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
 for width in [320,390,768,1440]:
  context=browser.new_context(viewport={'width':width,'height':1000},device_scale_factor=1,java_script_enabled=False,reduced_motion='reduce')
  page=context.new_page();errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  for name,path in paths.items():
   if args.offline:page.set_content(rendered[name],wait_until='load')
   else:
    response=page.goto(base+path,wait_until='networkidle');assert response.status==200,(name,response.status)
   assert page.locator('h1').count()==1,(width,name,'h1')
   assert page.locator('main').count()==1
   assert page.locator('script').count()==0
   for box in page.locator('.character-card > .portrait').all():
    r=box.bounding_box();assert r['height']<=r['width']*176/144+1,(name,'atlas crop')
   metrics=page.evaluate('''() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,images:[...document.images].map(i=>({ok:i.complete&&i.naturalWidth>0,alt:i.hasAttribute('alt')})),targets:[...document.querySelectorAll('a.language,a.choice,a.character-card,a.button-primary')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))})''')
   assert metrics['scroll']<=width,(name,width,metrics['scroll'])
   assert all(i['ok'] and i['alt'] for i in metrics['images']),(name,'images')
   assert all(t['width']>=48 and t['height']>=48 for t in metrics['targets']),(name,'target size')
   if name=='language':
    assert page.locator('a.language').count()==8
    assert page.locator('[data-kiro-visible-story-text]').count()==0
   if name=='reader':
    assert page.locator('.prose img').count()==0
    assert page.locator('[data-kiro-choice-id]').count()==2
   if name=='ending':assert page.locator('[data-kiro-choice-id]').count()==0
   page.keyboard.press('Tab')
   # The first keyboard target is a visible skip link; focus must not be covered.
   active=page.evaluate('''() => ({tag:document.activeElement.tagName,cls:document.activeElement.className,top:document.activeElement.getBoundingClientRect().top})''')
   assert active['tag']=='A' and active['top']>=0,(name,active)
   page.evaluate('document.activeElement.blur()')
   if width in [390,1440]:page.screenshot(path=str(out/f'{name}-{width}.png'),full_page=True)
   checks.append({'page':name,'width_css_px':width,'status':'PASS','images':len(metrics['images']),'main_targets':len(metrics['targets'])})
  assert not errors,errors
  context.close()
 # On the actual server, walk the user flow with JS disabled, then change language without reset.
 if not args.offline:
  context=browser.new_context(viewport={'width':390,'height':844},java_script_enabled=False)
  page=context.new_page();page.goto(base+'/');page.locator('a.language[lang="ja"]').click();page.locator('.button-primary').click();page.locator('.character-card').first.click();page.locator('[data-kiro-choice-id]').first.click()
  old=page.locator('[data-kiro-state]').get_attribute('data-kiro-state')
  page.locator('[data-kiro-change-language]').click();page.locator('a.language[lang="en"]').click()
  assert page.locator('[data-kiro-state]').get_attribute('data-kiro-state')==old
  assert page.locator('body').get_attribute('data-kiro-language')=='en'
  context.close()
 browser.close()
report={'status':'PASS','mode':'offline-rendered-html' if args.offline else 'live-http-browser','base_url':None if args.offline else base,'playwright':version('playwright'),'viewport_checks':checks,'javascript_disabled':True,'tested_target_minimum_css_px':48,'flow_clicks_verified':not args.offline,'scope':'Selected visual, navigation and accessibility checks; not complete WCAG or voice-translation certification.'}
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
