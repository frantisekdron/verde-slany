// Camera and presentation transforms only. The approved GLB is never modified.
export function createFloorMotion({THREE,camera,controls,groups,parts,root,onStep=()=>{},onProgress=()=>{},onComplete=()=>{},onReturn=()=>{}}) {
  root.updateMatrixWorld(true);
  const inverseRoot=root.matrixWorld.clone().invert();
  const originalGroups=groups.map(g=>{
    const localBox=new THREE.Box3();
    g.object.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])localBox.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseRoot));
    });
    return {...g,position:g.object.position.clone(),visible:g.object.visible,box:new THREE.Box3().setFromObject(g.object),localBox};
  });
  const originalMeshes=parts.map(p=>({mesh:p.mesh,visible:p.mesh.visible,castShadow:p.mesh.castShadow}));
  const originals=parts.flatMap(p=>p.materials.map(({m})=>({m,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite})));
  const clamp=t=>Math.min(1,Math.max(0,t));
  // Zero velocity and acceleration at both ends, with no pauses between camera waypoints.
  const ease=t=>{t=clamp(t);return clamp(t*t*t*(t*(t*6-15)+10))};
  const blendAt=t=>ease((t-.69)/.31);
  const OPEN_MS=3300,RETURN_MS=2250;
  let animation=null,held=false,home=null,trip=null,selectedFloor=0,progress=0,phase=-1;
  function restore(){
    for(const g of originalGroups){g.object.position.copy(g.position);g.object.visible=g.visible}
    for(const p of originalMeshes){p.mesh.visible=p.visible;p.mesh.castShadow=p.castShadow}
    for(const s of originals){s.m.opacity=s.opacity;s.m.transparent=s.transparent;s.m.depthWrite=s.depthWrite}
  }
  function cancel(){animation=null;held=false;selectedFloor=0;progress=0;trip=null;restore();camera.up.copy(home?.up||new THREE.Vector3(0,1,0));controls.enabled=true}
  function reset(){const destination=home;cancel();if(destination){camera.position.copy(destination.position);controls.target.copy(destination.target);camera.up.copy(destination.up);controls.update()}home=null}
  function makeTrip(floor,framing={}){
    const selected=originalGroups.find(g=>g.floor===floor);if(!selected||selected.box.isEmpty())return null;
    const center=selected.box.getCenter(new THREE.Vector3()),size=selected.localBox.getSize(new THREE.Vector3()).multiply(root.getWorldScale(new THREE.Vector3()));
    const target=center.clone();target.y+=(floor-1)*3.2;
    const topUp=new THREE.Vector3(0,0,-1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const direction=home.position.clone().sub(home.target).normalize();
    const v=THREE.MathUtils.degToRad(camera.fov/2);
    const fit={width:.82,height:.5,x:.5,y:.43,...framing};
    const approachDistance=Math.max(20,size.z/(2*Math.tan(v)*fit.height),size.x/(2*Math.tan(v)*camera.aspect*fit.width));
    const distance=Math.max(52,approachDistance*1.42);
    const right=new THREE.Vector3().crossVectors(topUp,new THREE.Vector3(0,1,0)).normalize();
    const framedTarget=target.clone().addScaledVector(right,(.5-fit.x)*2*Math.tan(v)*camera.aspect*approachDistance).addScaledVector(topUp,(fit.y-.5)*2*Math.tan(v)*approachDistance);
    const liftTarget=center.clone();liftTarget.y=Math.max(12,target.y+5);
    const lift=liftTarget.addScaledVector(direction,Math.max(91,home.position.distanceTo(home.target)*1.025));
    const overhead=target.clone().add(new THREE.Vector3(direction.x*distance*.17,distance*1.08,direction.z*distance*.17));
    const top=target.clone().add(new THREE.Vector3(0,distance,0));
    const approach=framedTarget.clone().add(new THREE.Vector3(0,approachDistance,0));
    const curve=new THREE.CatmullRomCurve3([home.position.clone(),lift,overhead,top,approach],false,'centripetal');
    curve.arcLengthDivisions=280;curve.updateArcLengths();
    return {floor,target:framedTarget,topUp,curve,framing:fit};
  }
  function pose(p,direction){
    progress=clamp(p);
    const travel=ease(progress),spread=ease((progress-.025)/.39),fade=ease((progress-.28)/.43);
    applyParts(trip.floor,spread,fade);
    trip.curve.getPointAt(travel,camera.position);
    controls.target.copy(home.target).lerp(trip.target,ease((progress-.04)/.7));
    camera.up.copy(home.up).lerp(trip.topUp,ease((progress-.12)/.62)).normalize();
    camera.lookAt(controls.target);
    onProgress({floor:trip.floor,direction,progress,blend:blendAt(progress)});
  }
  function prepare(floor,framing){
    if(!home){
      home={position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone()};
      // Drain an unfinished orbit gesture without moving the first or last flight frame.
      const damping=controls.enableDamping;
      if(damping){controls.enableDamping=false;controls.update();controls.enableDamping=damping;camera.position.copy(home.position);controls.target.copy(home.target);camera.up.copy(home.up);controls.update()}
    }
    const next=makeTrip(floor,framing);if(!next)return false;
    restore();trip=next;selectedFloor=floor;held=false;controls.enabled=false;phase=-1;
    return true;
  }
  function open(floor,framing){
    if(!prepare(floor,framing))return false;
    animation={kind:'open',start:performance.now(),duration:OPEN_MS};
    pose(0,'open');phase=0;onStep('opening',floor);return true;
  }
  function hold(floor,framing){
    if(!prepare(floor,framing))return false;
    animation=null;held=true;pose(1,'hold');return true;
  }
  function close(){
    if(!home||!trip||(!held&&!animation))return false;
    animation={kind:'close',start:performance.now(),duration:Math.max(300,RETURN_MS*progress),from:progress};
    held=false;controls.enabled=false;onStep('returning',selectedFloor);return true;
  }
  function resize(){
    if(!trip||!home)return false;
    const hfov=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect);
    const direction=home.position.clone().sub(home.target).normalize();
    home.position.copy(home.target).addScaledVector(direction,Math.max(83,36/Math.tan(hfov/2)));
    trip=makeTrip(selectedFloor,trip.framing);pose(progress,animation?.kind||'hold');return true;
  }
  function update(now){
    if(!animation)return held;
    const a=animation,t=clamp((now-a.start)/a.duration);
    if(a.kind==='close'){
      pose(a.from*(1-t),'close');
      if(t>=1){const destination=home;animation=null;held=false;restore();camera.position.copy(destination.position);controls.target.copy(destination.target);camera.up.copy(destination.up);controls.enabled=true;controls.update();home=null;trip=null;selectedFloor=0;onReturn()}
      return true;
    }
    pose(t,'open');
    const next=t<.34?0:t<.69?1:t<1?2:3;
    if(next!==phase){phase=next;onStep(['opening','overhead','reveal','plan'][phase],selectedFloor)}
    if(t>=1){animation=null;held=true;onComplete(selectedFloor)}
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
  return {open,hold,close,cancel,reset,resize,update,get active(){return !!animation},get held(){return held}};
}
