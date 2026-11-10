// Presentation transforms only; the GLB geometry remains unchanged.
export function createFloorMotion({THREE,camera,controls,groups,parts,root,onStep=()=>{},onComplete=()=>{},onReturn=()=>{}}) {
  const originalGroups=groups.map(g=>({...g,position:g.object.position.clone()}));
  const originalMeshes=parts.map(p=>({mesh:p.mesh,visible:p.mesh.visible,castShadow:p.mesh.castShadow}));
  const originals=parts.flatMap(p=>p.materials.map(({m})=>({m,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite})));
  const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t)};
  const ramp=t=>{t=Math.min(1,Math.max(0,t));return t<.5?16*t*t*t*t*t:1-Math.pow(-2*t+2,5)/2};
  let animation=null,held=false,home=null,selectedFloor=0;
  function restore(){
    for(const g of originalGroups){g.object.position.copy(g.position);g.object.visible=true}
    for(const p of originalMeshes){p.mesh.visible=p.visible;p.mesh.castShadow=p.castShadow}
    for(const s of originals){s.m.opacity=s.opacity;s.m.transparent=s.transparent;s.m.depthWrite=s.depthWrite}
  }
  function cancel(){animation=null;held=false;selectedFloor=0;restore();camera.up.set(0,1,0);controls.enabled=true}
  function reset(){const destination=home;cancel();if(destination){camera.position.copy(destination.position);controls.target.copy(destination.target);camera.up.copy(destination.up);controls.update()}home=null}
  function open(floor){
    const selected=groups.find(g=>g.floor===floor);if(!selected)return false;
    const previousHome=(held||animation)?home:null,startPosition=camera.position.clone(),startTarget=controls.target.clone();
    cancel();root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(selected.object),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    if(box.isEmpty())return false;
    home=previousHome||{position:startPosition.clone(),target:startTarget.clone(),up:camera.up.clone()};
    const topUp=new THREE.Vector3(0,0,-1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const explodedTarget=new THREE.Vector3(center.x,Math.max(12,center.y+8),center.z);
    const direction=home.position.clone().sub(home.target).normalize();
    const explodedCamera=explodedTarget.clone().addScaledVector(direction,Math.max(95,home.position.distanceTo(home.target)*1.08));
    const targetTop=center.clone();targetTop.y+=(floor-1)*3.2;
    const v=THREE.MathUtils.degToRad(camera.fov/2);
    const topDistance=Math.max(size.z/2/Math.tan(v),size.x/2/(Math.tan(v)*camera.aspect))*1.22;
    const top=targetTop.clone().add(new THREE.Vector3(0,Math.max(44,topDistance),0));
    const approach=targetTop.clone().add(new THREE.Vector3(0,Math.max(18,topDistance*.58),0));
    animation={kind:'open',floor,start:performance.now(),camera:startPosition,target:startTarget,explodedCamera,explodedTarget,top,approach,targetTop,topUp,phase:-1};
    selectedFloor=floor;controls.enabled=false;onStep('opening',floor);return true;
  }
  function close(){
    if(!home||(!held&&!animation))return false;
    const from={position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone()};
    animation={kind:'close',floor:selectedFloor,start:performance.now(),from,home};held=false;controls.enabled=false;
    onStep('returning',selectedFloor);return true;
  }
  function update(now){
    if(!animation)return held;
    const a=animation,t=now-a.start;
    if(a.kind==='close'){
      const k=smooth(t/1850),spread=1-k,fade=1-k;
      applyParts(a.floor,spread,fade);
      camera.position.copy(a.from.position).lerp(a.home.position,k);
      controls.target.copy(a.from.target).lerp(a.home.target,k);
      camera.up.copy(a.from.up).lerp(a.home.up,k).normalize();camera.lookAt(controls.target);
      if(t>=1850){animation=null;restore();camera.up.copy(home.up);controls.enabled=true;controls.update();home=null;selectedFloor=0;onReturn()}
      return true;
    }
    const spread=smooth((t-300)/700),turn=smooth((t-1000)/1150),fade=smooth((t-1250)/950),dive=ramp((t-2150)/1100);
    applyParts(a.floor,spread,fade);
    camera.position.copy(a.camera).lerp(a.explodedCamera,spread).lerp(a.top,turn).lerp(a.approach,dive);
    controls.target.copy(a.target).lerp(a.explodedTarget,spread).lerp(a.targetTop,turn);
    camera.up.set(0,1,0).lerp(a.topUp,turn).normalize();camera.lookAt(controls.target);
    const phase=t<1000?0:t<2350?1:t<3550?2:3;
    if(phase!==a.phase){a.phase=phase;onStep(['opening','overhead','reveal','plan'][phase],a.floor)}
    if(t>=3550){const floor=a.floor;animation=null;held=true;onComplete(floor)}
    return true;
  }
  function applyParts(floor,spread,fade){
    for(const g of originalGroups){g.object.position.copy(g.position);if(g.floor>0)g.object.position.y+=(g.floor-1)*3.2*spread}
    for(const p of parts){
      const lid=p.floor===floor&&(p.group==='vicko'||/plocha_strecha|strecha_antracit|strecha_strecha/.test(p.mesh.name));
      const opacity=p.floor!==floor||lid?1-fade:1;
      p.mesh.visible=opacity>.015;p.mesh.castShadow=opacity>.95;
      for(const {m,opacity:original=1} of p.materials){m.opacity=original*opacity;m.transparent=opacity<.999||original<1;m.depthWrite=opacity>.65}
    }
  }
  return {open,close,cancel,reset,update,get active(){return !!animation},get held(){return held}};
}
