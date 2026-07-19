/* bli-scene — scroll-scrubbed continuous 3D world for "How Robust Is the BLI Benefit?" */
(function(){
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const TAU=Math.PI*2, CYAN=0x4be1ff, AMBER=0xffb45e;
function fuselageRadius(u){const R=0.9;if(u<0.16){const s=u/0.16;return R*Math.sqrt(Math.max(0,1-(1-s)*(1-s)));}if(u<0.68)return R;const s=(u-0.68)/0.32;return R*(1-0.78*Math.pow(s,1.55));}
const GLSL_R=`float fuselageRadius(float u){float R=0.9;if(u<0.16){float s=u/0.16;return R*sqrt(max(0.0,1.0-(1.0-s)*(1.0-s)));}if(u<0.68)return R;float s=(u-0.68)/0.32;return R*(1.0-0.78*pow(s,1.55));}`;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const win=(a,b,f,p)=>Math.min(sstep(a,a+f,p),1-sstep(b-f,b,p));

class BLIScene extends HTMLElement{
static get observedAttributes(){return ['density'];}
connectedCallback(){if(this._booted)return;this._booted=true;this.style.cssText+=';display:block;';this._boot();}
disconnectedCallback(){cancelAnimationFrame(this._raf);if(this.renderer)this.renderer.dispose();}
attributeChangedCallback(n,o,v){if(this._ready&&o!==null&&o!==v)this._rebuildParticles();}
get density(){const d=parseFloat(this.getAttribute('density'));return clamp(isNaN(d)?1:d,0.2,2.5);}
async _boot(){
  let T;try{T=await import(THREE_URL);}catch(e){this.innerHTML='<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5c6d79;font:12px monospace">3D unavailable — WebGL / network required</div>';return;}
  this.T=T;this._setup();
}
_setup(){
  const T=this.T, mobile=innerWidth<720;
  this.mobile=mobile;
  const renderer=this.renderer=new T.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:2));
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.2s ease';
  this.appendChild(renderer.domElement);
  const scene=this.scene=new T.Scene();
  scene.background=new T.Color(0x05070a);
  scene.fog=new T.FogExp2(0x05070a,0.034);
  this.camera=new T.PerspectiveCamera(42,1,0.1,140);
  this._camP=new T.Vector3(8.5,2,9.5);this._camL=new T.Vector3(0,0.2,0);
  // lights
  scene.add(new T.AmbientLight(0x1a232c,1.1));
  const key=new T.DirectionalLight(0xcfe4ee,1.7);key.position.set(6,9,7);scene.add(key);
  const warm=new T.DirectionalLight(0x8a5a2a,0.35);warm.position.set(-6,-4,-5);scene.add(warm);
  const tailGlow=this.tailGlow=new T.PointLight(CYAN,0,7);tailGlow.position.set(4.4,0.4,0.8);scene.add(tailGlow);
  this._glowTex=this._makeGlowTex();
  this._buildAircraft();this._buildLedger();this._buildFrames();this._buildFleetAndSurface();this._buildBars();this._buildCurve();
  this._buildParticles();
  this._resize();addEventListener('resize',()=>this._resize());
  this._mx=0;this._my=0;
  addEventListener('pointermove',e=>{this._mx=(e.clientX/innerWidth-0.5)*2;this._my=(e.clientY/innerHeight-0.5)*2;},{passive:true});
  this._t0=performance.now();this._ready=true;
  const loop=()=>{this._raf=requestAnimationFrame(loop);this._frame();};loop();
  requestAnimationFrame(()=>renderer.domElement.style.opacity='1');
  // crisper label sprites once fonts load
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>this._refreshSprites());
}
_resize(){const w=this.clientWidth||innerWidth,h=this.clientHeight||innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
_makeGlowTex(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.25,'rgba(255,255,255,.45)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);const t=new this.T.CanvasTexture(c);return t;}
_textSprite(txt,color,scale){const T=this.T;const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.font='500 40px "IBM Plex Mono",monospace';g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;g.fillText(txt,256,50);const tex=new T.CanvasTexture(c);const m=new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,opacity:0});const s=new T.Sprite(m);s.scale.set(2.6*(scale||1),0.49*(scale||1),1);s.userData.txt=txt;s.userData.color=color;return s;}
_refreshSprites(){(this._sprites||[]).forEach(s=>{const c=s.material.map.image,g=c.getContext('2d');g.clearRect(0,0,512,96);g.font='500 40px "IBM Plex Mono",monospace';g.textAlign='center';g.textBaseline='middle';g.fillStyle=s.userData.color;g.fillText(s.userData.txt,256,50);s.material.map.needsUpdate=true;});}

_buildAircraft(){
  const T=this.T,pts=[];
  for(let i=0;i<=56;i++){const u=i/56;pts.push(new T.Vector2(fuselageRadius(u)+0.002,(u-0.5)*10));}
  const geo=new T.LatheGeometry(pts,64);geo.rotateZ(-Math.PI/2);
  const mat=new T.MeshStandardMaterial({color:0x151b22,metalness:0.78,roughness:0.34});
  const air=this.aircraft=new T.Group();
  air.add(new T.Mesh(geo,mat));
  // faint tech wireframe
  const wgeo=new T.LatheGeometry(pts.filter((_,i)=>i%4===0),28);wgeo.rotateZ(-Math.PI/2);
  const wire=new T.Mesh(wgeo,new T.MeshBasicMaterial({color:CYAN,wireframe:true,transparent:true,opacity:0.045,depthWrite:false}));
  air.add(wire);
  // BLI fan ring on tail cone
  const ring=this.fanRing=new T.Group();
  const torus=new T.Mesh(new T.TorusGeometry(0.52,0.028,10,72),new T.MeshBasicMaterial({color:CYAN,transparent:true,opacity:0.25,blending:T.AdditiveBlending,depthWrite:false}));
  torus.rotation.y=Math.PI/2;ring.add(torus);
  const spokes=this.spokes=new T.Group();
  const smat=new T.MeshBasicMaterial({color:CYAN,transparent:true,opacity:0.15,blending:T.AdditiveBlending,depthWrite:false});
  for(let i=0;i<18;i++){const b=new T.Mesh(new T.BoxGeometry(0.015,0.42,0.02),smat);const a=i/18*TAU;b.position.set(0,Math.cos(a)*0.27,Math.sin(a)*0.27);b.rotation.x=-a;ring.add(b);spokes.add(b);}
  ring.add(spokes);
  const glow=this.ringGlow=new T.Sprite(new T.SpriteMaterial({map:this._glowTex,color:CYAN,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));
  glow.scale.set(2.6,2.6,1);ring.add(glow);
  ring.position.set(4.3,0,0);air.add(ring);
  this.scene.add(air);
  // ghost comparison pair (ch2b)
  const ghost=this.ghosts=new T.Group();
  const gmat=this.ghostMat=new T.MeshBasicMaterial({color:0x9fb0bd,wireframe:true,transparent:true,opacity:0,depthWrite:false});
  const small=new T.LatheGeometry(pts.filter((_,i)=>i%4===0),20);small.rotateZ(-Math.PI/2);
  const mk=(z)=>{const m=new T.Mesh(small,gmat);m.scale.setScalar(0.38);m.position.set(7,-0.6,z);ghost.add(m);return m;};
  mk(2.1);const b=mk(-2.1);
  // pod on conventional one
  const pod=new T.Mesh(new T.CylinderGeometry(0.09,0.09,0.5,12),gmat);pod.rotation.z=Math.PI/2;pod.position.set(6.7,-1.03,2.1);ghost.add(pod);
  this.scene.add(ghost);void b;
}

_particleMat(color,extra){
  const T=this.T;
  return new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:Object.assign({uTime:{value:0},uFade:{value:0},uSize:{value:1},uColor:{value:new T.Color(color)}},extra||{}),
    vertexShader:this._vsh,fragmentShader:`varying float vA;varying float vHot;uniform vec3 uColor;
      void main(){vec2 q=gl_PointCoord-0.5;float d=length(q);float a=smoothstep(0.5,0.05,d)*vA;if(a<0.003)discard;
      vec3 c=mix(uColor,vec3(1.0),0.35*smoothstep(0.25,0.0,d)+0.3*vHot);gl_FragColor=vec4(c*a,a);}`});
}
_buildParticles(){
  const T=this.T,d=this.density,mob=this.mobile?0.45:1;
  if(this.blPts){[this.blPts,this.dust,this.jetA,this.jetB].forEach(o=>{if(o){this.scene.remove(o.parent===this.scene?o:o);o.geometry.dispose();}});if(this.jetGroup)this.scene.remove(this.jetGroup);}
  // boundary-layer skin
  const N=Math.round(7000*d*mob);
  const aU=new Float32Array(N),aAng=new Float32Array(N),aR=new Float32Array(N),aSeed=new Float32Array(N);
  for(let i=0;i<N;i++){aU[i]=Math.random();aAng[i]=Math.random()*TAU;aR[i]=Math.pow(Math.random(),1.4);aSeed[i]=Math.random();}
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(N*3),3));
  g.setAttribute('aU',new T.BufferAttribute(aU,1));g.setAttribute('aAngle',new T.BufferAttribute(aAng,1));
  g.setAttribute('aR',new T.BufferAttribute(aR,1));g.setAttribute('aSeed',new T.BufferAttribute(aSeed,1));
  g.boundingSphere=new T.Sphere(new T.Vector3(1,0,0),9);
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{uTime:{value:0},uGrow:{value:0},uSuck:{value:0},uFade:{value:1},uSize:{value:this.mobile?0.8:1},uColor:{value:new T.Color(CYAN)}},
    vertexShader:`attribute float aU;attribute float aAngle;attribute float aR;attribute float aSeed;
      uniform float uTime,uGrow,uSuck,uFade,uSize;varying float vA;varying float vHot;${GLSL_R}
      void main(){
        float u=fract(aU+uTime*(0.012+0.05*aR));
        float delta=0.035+0.6*pow(u,1.6);
        float rr=fuselageRadius(u)+0.02+delta*aR;
        float ang=aAngle+uTime*(0.03+0.05*aR)+0.35*sin(u*7.0+aSeed*6.2831);
        vec3 p=vec3(-5.0+10.0*u,rr*cos(ang),rr*sin(ang));
        float sk=uSuck*smoothstep(0.5,0.92,u);
        float ex=smoothstep(0.9,1.0,u);
        float rrad=mix(0.5,0.42,ex);
        vec3 rp=vec3(4.3+ex*2.8,rrad*cos(aAngle),rrad*sin(aAngle));
        p=mix(p,rp,sk);
        float vis=clamp((uGrow*1.06-u)/0.06,0.0,1.0);
        vA=uFade*vis*(0.25+0.75*aR)*(1.0+1.1*sk);
        vHot=sk;
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        gl_PointSize=uSize*(0.7+1.6*aR)*(180.0/-mv.z)*(1.0+1.2*sk);
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vA;varying float vHot;uniform vec3 uColor;
      void main(){vec2 q=gl_PointCoord-0.5;float d=length(q);float a=smoothstep(0.5,0.05,d)*vA;if(a<0.003)discard;
      vec3 c=mix(uColor,vec3(1.0),0.35*smoothstep(0.25,0.0,d)+0.3*vHot);gl_FragColor=vec4(c*a,a);}`});
  this.blPts=new T.Points(g,mat);this.blPts.frustumCulled=false;this.scene.add(this.blPts);
  // ambient dust for depth
  const ND=Math.round(1600*mob);
  const dp=new Float32Array(ND*3);
  for(let i=0;i<ND;i++){dp[i*3]=-12+Math.random()*62;dp[i*3+1]=-9+Math.random()*18;dp[i*3+2]=-14+Math.random()*28;}
  const dg=new T.BufferGeometry();dg.setAttribute('position',new T.BufferAttribute(dp,3));
  this.dust=new T.Points(dg,new T.PointsMaterial({color:0x233440,size:0.045,transparent:true,opacity:0.55,blending:T.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  this.dust.frustumCulled=false;this.scene.add(this.dust);
  // comparison jets
  const jetMake=(color,r0,spread,speed,len,n)=>{
    const A=new Float32Array(n),G=new Float32Array(n),R=new Float32Array(n);
    for(let i=0;i<n;i++){A[i]=Math.random();G[i]=Math.random()*TAU;R[i]=Math.random();}
    const jg=new T.BufferGeometry();
    jg.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));
    jg.setAttribute('aT',new T.BufferAttribute(A,1));jg.setAttribute('aAng',new T.BufferAttribute(G,1));jg.setAttribute('aR',new T.BufferAttribute(R,1));
    jg.boundingSphere=new T.Sphere(new T.Vector3(len/2,0,0),len);
    const jm=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      uniforms:{uTime:{value:0},uFade:{value:0},uColor:{value:new T.Color(color)},uSpeed:{value:speed},uLen:{value:len},uR0:{value:r0},uSpread:{value:spread},uSize:{value:1}},
      vertexShader:`attribute float aT;attribute float aAng;attribute float aR;
        uniform float uTime,uFade,uSpeed,uLen,uR0,uSpread,uSize;varying float vA;varying float vHot;
        void main(){float t=fract(aT+uTime*uSpeed);
          float rad=(uR0+uSpread*t)*(0.35+0.65*aR);
          vec3 p=vec3(t*uLen,rad*cos(aAng+t*2.0),rad*sin(aAng+t*2.0));
          vA=uFade*(1.0-t)*(0.4+0.6*aR);vHot=1.0-t;
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          gl_PointSize=uSize*(0.6+1.2*aR)*(140.0/-mv.z);
          gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying float vA;varying float vHot;uniform vec3 uColor;
        void main(){vec2 q=gl_PointCoord-0.5;float d=length(q);float a=smoothstep(0.5,0.05,d)*vA;if(a<0.003)discard;
        vec3 c=mix(uColor,vec3(1.0),0.4*vHot*smoothstep(0.3,0.0,d));gl_FragColor=vec4(c*a,a);}`});
    return new T.Points(jg,jm);};
  const jets=this.jetGroup=new T.Group();
  const nJ=Math.round(900*mob);
  this.jetA=jetMake(AMBER,0.05,0.16,0.55,3.4,nJ);   // podded: fast, narrow, hot
  this.jetA.position.set(6.95,-1.03,2.1);
  this.jetB=jetMake(CYAN,0.22,0.10,0.22,3.0,nJ);    // BLI: slow, broad, fills wake
  this.jetB.position.set(8.9,-0.6,-2.1);
  jets.add(this.jetA,this.jetB);this.scene.add(jets);
}
_rebuildParticles(){if(this._ready)this._buildParticles();}

_buildLedger(){
  const T=this.T,g=this.ledger=new T.Group();
  const ribbon=(pts,rad,color,freq)=>{
    const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));
    const geo=new T.TubeGeometry(curve,72,rad,10,false);
    const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
      uniforms:{uTime:{value:0},uFade:{value:0},uColor:{value:new T.Color(color)},uFreq:{value:freq}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec2 vUv;uniform vec3 uColor;uniform float uTime,uFade,uFreq;
        void main(){float pulse=pow(0.5+0.5*sin((vUv.x*uFreq-uTime*0.55)*6.2831),8.0);
        float ends=smoothstep(0.0,0.07,vUv.x)*smoothstep(1.0,0.93,vUv.x);
        float a=uFade*ends*(0.20+1.9*pulse);gl_FragColor=vec4(uColor*a,a);}`});
    const m=new T.Mesh(geo,mat);g.add(m);return mat;};
  this.ledgerMats=[
    ribbon([[-3.0,0,0],[-1.8,0.05,0.1],[-0.6,0,0]],0.085,AMBER,2),
    ribbon([[-0.6,0,0],[0.6,0.95,0.3],[1.9,0.75,0.1],[2.6,0.05,0]],0.052,CYAN,3),
    ribbon([[-0.6,0,0],[0.6,-0.95,-0.3],[1.9,-0.75,-0.1],[2.6,-0.05,0]],0.052,CYAN,3),
    ribbon([[2.6,0,0],[3.4,0.04,0.08],[4.4,0,0]],0.085,AMBER,2)];
  const node=(x,c)=>{const s=new T.Sprite(new T.SpriteMaterial({map:this._glowTex,color:c,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));s.position.set(x,0,0);s.scale.set(1.5,1.5,1);g.add(s);return s.material;};
  this.ledgerNodes=[node(-0.6,CYAN),node(2.6,AMBER)];
  g.position.set(9.8,0.35,0);this.scene.add(g);
}

_buildFrames(){
  const T=this.T,g=this.framesG=new T.Group();this.frames=[];
  const defs=[[10.8,0.6,-0.6,0.14,CYAN],[13.2,0.7,0.6,-0.1,CYAN],[15.6,0.7,-1.1,0.2,AMBER]];
  defs.forEach(d=>{
    const fg=new T.Group();
    const plane=new T.Mesh(new T.PlaneGeometry(2.7,1.6),new T.MeshBasicMaterial({color:0x0a1218,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));
    const edge=new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(2.7,1.6)),new T.LineBasicMaterial({color:d[4],transparent:true,opacity:0,blending:T.AdditiveBlending}));
    const tick=new T.Mesh(new T.PlaneGeometry(0.5,0.045),new T.MeshBasicMaterial({color:d[4],transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));
    tick.position.set(-0.95,0.55,0.01);
    fg.add(plane,edge,tick);fg.position.set(d[0],d[1],d[2]);fg.rotation.y=d[3];
    g.add(fg);this.frames.push({plane:plane.material,edge:edge.material,tick:tick.material,grp:fg});});
  this.scene.add(g);
}

_buildFleetAndSurface(){
  const T=this.T,mob=this.mobile;
  const pts=[];for(let i=0;i<=12;i++){const u=i/12;pts.push(new T.Vector2(fuselageRadius(u)+0.002,(u-0.5)*10));}
  const geo=new T.LatheGeometry(pts,12);geo.rotateZ(-Math.PI/2);
  const N=this.fleetN=mob?150:340;
  const mat=new T.MeshBasicMaterial({transparent:true,opacity:0.9,blending:T.AdditiveBlending,depthWrite:false});
  const fleet=this.fleet=new T.InstancedMesh(geo,mat,N);
  fleet.instanceColor=new T.InstancedBufferAttribute(new Float32Array(N*3),3);
  const dummy=new T.Object3D();this.fleetSeed=new Float32Array(N);
  for(let i=0;i<N;i++){
    dummy.position.set(26+(Math.random()-0.5)*15,(Math.random()-0.5)*7,(Math.random()-0.5)*11);
    dummy.rotation.y=(Math.random()-0.5)*0.3;dummy.scale.setScalar(0.16+Math.random()*0.1);
    dummy.updateMatrix();fleet.setMatrixAt(i,dummy.matrix);
    fleet.setColorAt(i,new T.Color(0x000000));this.fleetSeed[i]=Math.random();}
  fleet.frustumCulled=false;this.scene.add(fleet);
  // response surface: ingestion (x) × electrical efficiency (z) → fuel saving (y)
  const NX=mob?44:64,NZ=mob?30:44,W=12,D=8;
  const f=(u,v)=>{const gN=Math.pow(u,1.1)*Math.pow(1-u,0.9)/0.2465;return 2.0*gN*(0.5+0.5*v)-1.1*sstep(0.85,1,u);};
  const pos=new Float32Array(NX*NZ*3),col=new Float32Array(NX*NZ*3);
  const c1=new T.Color(0x1691b3),c2=new T.Color(0xbdf1ff);
  for(let iz=0;iz<NZ;iz++)for(let ix=0;ix<NX;ix++){
    const i=(iz*NX+ix),u=ix/(NX-1),v=iz/(NZ-1);
    const y=f(u,v);
    pos[i*3]=26-W/2+u*W;pos[i*3+1]=y;pos[i*3+2]=-D/2+v*D;
    const c=c1.clone().lerp(c2,clamp(y/2,0,1));col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(pos,3));sg.setAttribute('color',new T.BufferAttribute(col,3));
  const surf=this.surfPts=new T.Points(sg,new T.PointsMaterial({vertexColors:true,size:0.075,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  // grid lines along x
  const lp=[];for(let iz=0;iz<NZ;iz+=3)for(let ix=0;ix<NX-1;ix++){const a=(iz*NX+ix)*3,b=(iz*NX+ix+1)*3;lp.push(pos[a],pos[a+1],pos[a+2],pos[b],pos[b+1],pos[b+2]);}
  const lg=new T.BufferGeometry();lg.setAttribute('position',new T.BufferAttribute(new Float32Array(lp),3));
  const lines=this.surfLines=new T.LineSegments(lg,new T.LineBasicMaterial({color:0x2a7d96,transparent:true,opacity:0,blending:T.AdditiveBlending}));
  const sG=this.surfG=new T.Group();sG.add(surf,lines);
  // sweet-spot marker at u=0.55, best v
  const mk=new T.Sprite(new T.SpriteMaterial({map:this._glowTex,color:0xffffff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));
  mk.position.set(26-W/2+0.55*W,f(0.55,1)+0.15,D/2);mk.scale.set(1.1,1.1,1);sG.add(mk);this.surfMark=mk.material;
  const lbl=this._textSprite('55% INGESTION','#bdf1ff',0.9);lbl.position.set(26-W/2+0.55*W,f(0.55,1)+0.85,D/2);sG.add(lbl);
  this._sprites=[lbl];this.surfLbl=lbl.material;
  sG.position.y=0.2;sG.scale.y=0.001;this.scene.add(sG);
  fleet.visible=false;sG.visible=false;
}

_buildBars(){
  const T=this.T,g=this.barsG=new T.Group();this.bars=[];this._sprites=this._sprites||[];
  const defs=[['η ELEC',0.53,AMBER],['INLET REC',0.31,AMBER],['F INGEST',0.20,CYAN],['DUCT LOSS',0.13,AMBER],['FAN η',0.09,CYAN],['RESID',0.05,CYAN]];
  const H=5.2,wd=0.72,gap=1.18;
  defs.forEach((d,i)=>{
    const bg=new T.Group();
    const box=new T.Mesh(new T.BoxGeometry(wd,1,wd),new T.MeshBasicMaterial({color:d[2],transparent:true,opacity:0.06,blending:T.AdditiveBlending,depthWrite:false}));
    box.position.y=0.5;
    const edge=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(wd,1,wd)),new T.LineBasicMaterial({color:d[2],transparent:true,opacity:0,blending:T.AdditiveBlending}));
    edge.position.y=0.5;
    bg.add(box,edge);bg.position.set(34,-1.6,(i-(defs.length-1)/2)*gap);bg.scale.y=0.001;
    const lbl=this._textSprite(d[1].toFixed(2),'#'+new T.Color(d[2]).getHexString(),0.72);
    const name=this._textSprite(d[0],'#7d8f9c',0.62);
    lbl.position.set(34,-1.6+d[1]*H+0.42,bg.position.z);
    name.position.set(34,-2.05,bg.position.z);
    g.add(bg,lbl,name);this._sprites.push(lbl,name);
    this.bars.push({grp:bg,box:box.material,edge:edge.material,lbl:lbl.material,name:name.material,h:d[1]*H});});
  // baseline
  const base=new T.Mesh(new T.PlaneGeometry(2.2,7.6),new T.MeshBasicMaterial({color:0x0d1620,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));
  base.rotation.x=-Math.PI/2;base.position.set(34,-1.62,0);g.add(base);this.barsBase=base.material;
  g.visible=false;this.scene.add(g);
}

_buildCurve(){
  const T=this.T,g=this.curveG=new T.Group();
  const mu=Math.log(1.35),sg=0.72,X0=42,XW=9,XMAX=5.5,YS=2.6,YB=-0.4;
  const pdf=x=>Math.exp(-Math.pow(Math.log(Math.max(x,1e-4))-mu,2)/(2*sg*sg))/Math.max(x,0.15);
  let mx=0;for(let x=0.05;x<XMAX;x+=0.02)mx=Math.max(mx,pdf(x));
  const NP=180,pos=new Float32Array(NP*3),aT=new Float32Array(NP);
  const px=x=>X0-XW/2+(x/XMAX)*XW, py=x=>YB+pdf(x)/mx*YS;
  for(let i=0;i<NP;i++){const x=0.05+(i/(NP-1))*(XMAX-0.05);pos[i*3]=px(x);pos[i*3+1]=py(x);pos[i*3+2]=0;aT[i]=i/(NP-1);}
  const cg=new T.BufferGeometry();cg.setAttribute('position',new T.BufferAttribute(pos,3));cg.setAttribute('aT',new T.BufferAttribute(aT,1));
  const cmat=this.curveMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{uReveal:{value:0},uFade:{value:0},uColor:{value:new T.Color(0xbdf1ff)}},
    vertexShader:'attribute float aT;varying float vT;void main(){vT=aT;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying float vT;uniform float uReveal,uFade;uniform vec3 uColor;
      void main(){float s=smoothstep(vT+0.006,vT-0.006,uReveal);float head=1.6*exp(-pow((vT-uReveal)*36.0,2.0));
      float a=uFade*(0.95*s+head);gl_FragColor=vec4(uColor*a,a);}`});
  g.add(new T.Line(cg,cmat));
  // confidence band 0.3–3.7%
  const NB=90,bp=[],bc=[];
  const cB=new T.Color(0x2fbede);
  for(let i=0;i<NB;i++){const x=0.3+(i/(NB-1))*3.4;bp.push(px(x),YB,0,px(x),py(x),0);const k=0.16+0.5*(py(x)-YB)/YS;bc.push(cB.r*0.25,cB.g*0.25,cB.b*0.25,cB.r*k,cB.g*k,cB.b*k);}
  const idx=[];for(let i=0;i<NB-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  const bg=new T.BufferGeometry();bg.setAttribute('position',new T.BufferAttribute(new Float32Array(bp),3));bg.setAttribute('color',new T.BufferAttribute(new Float32Array(bc),3));bg.setIndex(idx);
  const band=this.bandMat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false});
  g.add(new T.Mesh(bg,band));
  // band edge markers + labels
  this.curveExtras=[];
  [[0.3,'0.3%'],[3.7,'3.7%']].forEach(d=>{
    const lm=new T.Mesh(new T.PlaneGeometry(0.02,YS+0.5),new T.MeshBasicMaterial({color:0x8adcf2,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
    lm.position.set(px(d[0]),YB+(YS+0.5)/2-0.15,0);g.add(lm);this.curveExtras.push(lm.material);
    const s=this._textSprite(d[1],'#bdf1ff',0.8);s.position.set(px(d[0]),YB-0.45,0);g.add(s);this._sprites.push(s);this.curveExtras.push(s.material);});
  const axis=new T.Mesh(new T.PlaneGeometry(XW+0.6,0.016),new T.MeshBasicMaterial({color:0x3a4c58,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  axis.position.set(X0,YB,0);g.add(axis);this.curveExtras.push(axis.material);
  const cap=this._textSprite('FUEL BURN SAVED — 90% CONFIDENCE','#7d8f9c',1.05);cap.position.set(X0,YB-1.0,0);g.add(cap);this._sprites.push(cap);this.curveExtras.push(cap.material);
  g.visible=false;this.scene.add(g);
}

_camKeys(){return [
  [0.00, 8.5,2.0,9.5,   0,0.2,0],
  [0.10, 7.4,1.2,6.4,   1.3,0,1.0],
  [0.165,6.8,0.7,3.4,   3.6,0,0.9],
  [0.225,10.5,0.4,5.4,  7.0,-0.6,0],
  [0.30, 12.3,0.9,4.8,  8.6,0.2,0],
  [0.36, 13.4,0.8,4.4,  9.8,0.3,0],
  [0.43, 13.0,1.2,5.8,  10.6,0.5,-0.5],
  [0.50, 15.6,1.3,5.4,  13.1,0.6,0.3],
  [0.565,18.6,1.7,5.6,  15.6,0.6,-1.0],
  [0.615,26,7.5,17.5,   23.5,0,0],
  [0.665,28.5,5,11.5,   24.5,0.4,0],
  [0.725,34.8,2.9,9.2,  34,0.3,0],
  [0.80, 33.6,1.7,7.4,  34,0.7,0],
  [0.86, 42,0.9,8.2,    42,0.8,0],
  [0.925,42,0.85,6.6,   42,0.8,0],
  [0.955,16,11,20,      5,0,0],
  [1.001,8.7,2.2,9.7,   0,0.2,0]];}

_frame(){
  const T=this.T,t=(performance.now()-this._t0)/1000;
  const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  const p=clamp((window.scrollY||0)/max,0,1);
  // camera path
  const K=this._camKeys();let i=0;while(i<K.length-2&&K[i+1][0]<p)i++;
  const a=K[i],b=K[i+1],lt=sstep(0,1,clamp((p-a[0])/(b[0]-a[0]),0,1));
  const tp=new T.Vector3(a[1]+(b[1]-a[1])*lt,a[2]+(b[2]-a[2])*lt,a[3]+(b[3]-a[3])*lt);
  const tl=new T.Vector3(a[4]+(b[4]-a[4])*lt,a[5]+(b[5]-a[5])*lt,a[6]+(b[6]-a[6])*lt);
  tp.x+=this._mx*0.35;tp.y+=-this._my*0.25+Math.sin(t*0.4)*0.05;
  this._camP.lerp(tp,0.09);this._camL.lerp(tl,0.09);
  this.camera.position.copy(this._camP);this.camera.lookAt(this._camL);
  // aircraft idle
  this.aircraft.rotation.y=0.10*Math.sin(t*0.07)*(1-sstep(0.1,0.2,p))+0;
  this.aircraft.rotation.z=0.02*Math.sin(t*0.11);
  // boundary layer
  const bl=this.blPts.material.uniforms;
  bl.uTime.value=t;
  bl.uGrow.value=Math.max(Math.min(t*0.07,0.3),sstep(0.005,0.095,p));
  bl.uSuck.value=sstep(0.115,0.19,p)*(1-sstep(0.30,0.35,p));
  bl.uFade.value=Math.max(1-sstep(0.33,0.385,p),sstep(0.925,0.965,p));
  // fan ring
  const ringA=Math.max(win(0.10,0.32,0.035,p),0.18*win(-0.1,0.34,0.05,p),0.5*sstep(0.93,0.97,p));
  this.fanRing.children.forEach(c=>{if(c.material&&c.material.opacity!==undefined&&!c.isSprite)c.material.opacity=Math.min(1,0.25+ringA*0.75);});
  this.ringGlow.material.opacity=ringA*0.5;
  this.spokes.rotation.x=t*(0.4+2.2*ringA);
  this.tailGlow.intensity=ringA*2.4;
  // ghosts + jets
  const gh=win(0.22,0.31,0.035,p);
  this.ghostMat.opacity=gh*0.16;this.ghosts.visible=gh>0.001;
  this.jetA.material.uniforms.uFade.value=gh;this.jetA.material.uniforms.uTime.value=t;
  this.jetB.material.uniforms.uFade.value=gh*0.9;this.jetB.material.uniforms.uTime.value=t;
  this.jetGroup.visible=gh>0.001;
  // ledger
  const lg=win(0.305,0.44,0.035,p);
  this.ledger.visible=lg>0.001;
  this.ledgerMats.forEach(m=>{m.uniforms.uFade.value=lg;m.uniforms.uTime.value=t;});
  this.ledgerNodes.forEach(m=>m.opacity=lg*0.55);
  this.ledger.rotation.y=0.12*Math.sin(t*0.2);
  // validation frames
  const fr=win(0.425,0.585,0.03,p);
  this.framesG.visible=fr>0.001;
  const th=[0.46,0.495,0.53];
  this.frames.forEach((f,j)=>{
    const lit=sstep(th[j],th[j]+0.022,p);
    f.plane.opacity=fr*0.55;f.edge.opacity=fr*(0.10+0.9*lit);f.tick.opacity=fr*lit;
    f.grp.position.y+=Math.sin(t*0.8+j*2)*0.0006;});
  // fleet
  const fl=win(0.565,0.68,0.03,p);
  this.fleet.visible=fl>0.001;
  if(this.fleet.visible){
    const wave=(p-0.565)/0.115;
    const c=new T.Color();
    for(let k=0;k<this.fleetN;k++){
      const s=this.fleetSeed[k];
      const br=fl*(0.05+0.85*Math.pow(Math.max(0,Math.sin(s*6.28+wave*10-2)),3));
      c.setRGB(0.29*br,0.88*br,1.0*br);this.fleet.setColorAt(k,c);}
    this.fleet.instanceColor.needsUpdate=true;}
  // response surface
  const sv=win(0.615,0.75,0.03,p),rev=sstep(0.625,0.70,p);
  this.surfG.visible=sv>0.001;
  this.surfG.scale.y=0.001+rev;
  this.surfPts.material.opacity=sv*0.85;this.surfLines.material.opacity=sv*0.32;
  this.surfMark.opacity=sv*sstep(0.67,0.70,p)*0.9;this.surfLbl.opacity=sv*sstep(0.68,0.71,p)*0.95;
  // sobol bars
  const bv=win(0.715,0.865,0.03,p);
  this.barsG.visible=bv>0.001;
  this.barsBase.opacity=bv*0.5;
  this.bars.forEach((bar,j)=>{
    const rise=sstep(0.725+j*0.013,0.775+j*0.013,p);
    bar.grp.scale.y=0.001+bar.h*rise;
    bar.edge.opacity=bv*(0.25+0.75*rise);bar.box.opacity=bv*0.07;
    bar.lbl.opacity=bv*sstep(0.78+j*0.01,0.80+j*0.01,p);bar.name.opacity=bv*rise*0.9;});
  // distribution curve
  const cv=win(0.84,0.945,0.025,p);
  this.curveG.visible=cv>0.001;
  this.curveMat.uniforms.uFade.value=cv;this.curveMat.uniforms.uReveal.value=sstep(0.85,0.905,p);
  this.bandMat.opacity=cv*sstep(0.895,0.925,p);
  this.curveExtras.forEach(m=>m.opacity=cv*sstep(0.885,0.915,p)*(m.map?1:0.8));
  this.renderer.render(this.scene,this.camera);
}
}
customElements.define('bli-scene',BLIScene);
})();
