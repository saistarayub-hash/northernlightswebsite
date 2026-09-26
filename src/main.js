const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const canvas = document.querySelector('#sky');
const ctx = canvas.getContext('2d');
let width, height, frame;
let motionPaused = false;
const stars = Array.from({length: 95}, () => ({x: Math.random(), y: Math.random(), radius: Math.random() * 1.1, alpha: Math.random() * .5 + .1}));
function resize(){ width = window.innerWidth; height = 960; const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = width*dpr; canvas.height = height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); draw(0); }
function draw(time){ ctx.clearRect(0,0,width,height); const glow = ctx.createRadialGradient(width*.7,280,0,width*.7,280,width*.8); glow.addColorStop(0,'#103322');glow.addColorStop(.45,'#111f18');glow.addColorStop(1,'#090e0d');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
ctx.save();ctx.globalCompositeOperation='screen';ctx.filter='blur(35px)';for(let j=0;j<3;j++){const y=130+j*65;ctx.beginPath();ctx.moveTo(-100,y);for(let x=-100;x<=width+100;x+=30){ctx.lineTo(x,y+Math.sin(x/width*5+time*.00012+j*.7)*100);}ctx.lineTo(width+100,y+140);for(let x=width+100;x>=-100;x-=30){ctx.lineTo(x,y+65+Math.sin(x/width*5+time*.00012+j*.7)*90);}ctx.closePath();ctx.fillStyle=['#16bd6221','#2389641a','#2bec7820'][j];ctx.fill();}ctx.restore();stars.forEach(s=>{ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.radius,0,Math.PI*2);ctx.fillStyle=`rgba(215,239,203,${s.alpha})`;ctx.fill();}); }
function animate(t){draw(t);frame=requestAnimationFrame(animate);}function startAnimation(){cancelAnimationFrame(frame);if(!motionPaused&&!reducedMotion.matches&&!document.hidden)frame=requestAnimationFrame(animate);else draw(0);}resize();startAnimation();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',startAnimation);reducedMotion.addEventListener('change',startAnimation);
const sculpture=document.querySelector('.sculpture');document.querySelector('.hero').addEventListener('pointermove',e=>{if(motionPaused||reducedMotion.matches||window.innerWidth<600)return;sculpture.style.setProperty('--ry',`${(e.clientX/window.innerWidth-.5)*12}deg`);sculpture.style.setProperty('--rx',`${(e.clientY/window.innerHeight-.5)*-8}deg`);});
const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}});},{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('nav');menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');menu.textContent=open?'×':'☰';});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');menu.textContent='☰';}));
const dialog=document.querySelector('#preview-dialog');document.querySelector('#about-preview').addEventListener('click',()=>dialog.showModal());document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());document.querySelector('#continue-preview').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});document.querySelector('#year').textContent=new Date().getFullYear();
let audio,master,on=false;const sound=document.querySelector('#sound');sound.addEventListener('click',async()=>{try{if(!audio){audio=new AudioContext();master=audio.createGain();master.gain.value=0;master.connect(audio.destination);[65.41,98,130.81,196].forEach((f,i)=>{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=f;oscillator.detune.value=i*2;gain.gain.value=.09/(i+1);oscillator.connect(gain);gain.connect(master);oscillator.start();});}await audio.resume();on=!on;master.gain.setTargetAtTime(on?.28:0,audio.currentTime,.7);sound.setAttribute('aria-pressed',String(on));sound.setAttribute('aria-label',on?'Turn ambient sound off':'Turn ambient sound on');document.querySelector('#sound-label').textContent=on?'SOUND ON':'SOUND OFF';}catch{document.querySelector('#sound-label').textContent='SOUND UNAVAILABLE';sound.disabled=true;}});

const motionToggle = document.querySelector('#motion-toggle');
motionToggle.addEventListener('click', () => {
  motionPaused = !motionPaused;
  document.body.classList.toggle('motion-paused', motionPaused);
  motionToggle.setAttribute('aria-pressed', String(motionPaused));
  motionToggle.innerHTML = motionPaused ? 'Resume visual effects <span>▶</span>' : 'Pause visual effects <span>Ⅱ</span>';
  startAnimation();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && nav.classList.contains('open')) {
    menu.click();
    menu.focus();
  }
});
