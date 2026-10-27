import { useRef } from 'react';
import { useInView } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { DocumentLens, LawBook, CoinStack, LetterGavel, Studio, reduced } from './models';

const OBJECTS = [DocumentLens, LawBook, CoinStack, LetterGavel];

// One object per step. The current one rises and turns into place; the others sink away.
function Slot({ index, active, Obj }) {
  const group = useRef();
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const on = index === active;
    const k = reduced ? 50 : 5;
    const ts = on ? 1 : 0.001;
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, ts, k, delta));
    g.position.y = THREE.MathUtils.damp(g.position.y, on ? 0 : index < active ? 1.6 : -1.6, k, delta);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, on ? 0 : index < active ? -1.2 : 1.2, k, delta);
    g.visible = g.scale.x > 0.02;
  });
  return <group ref={group} scale={index === active ? 1 : 0.001}><Obj animate={index === active} /></group>;
}

// A ring of four arcs under the object; arcs light up as you move through the steps.
function Progress({ active }) {
  const arcs = useRef([]);
  useFrame((_, delta) => {
    arcs.current.forEach((m, i) => {
      if (!m) return;
      const target = i <= active ? 0.9 : 0.15;
      m.material.opacity = THREE.MathUtils.damp(m.material.opacity, target, 6, delta);
    });
  });
  const gap = 0.08;
  const seg = (Math.PI * 2) / 4;
  return (
    <group position={[0, -1.25, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => { arcs.current[i] = el; }}>
          <ringGeometry args={[1.2, 1.235, 64, 1, i * seg + gap / 2, seg - gap]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
      <mesh><circleGeometry args={[1.12, 64]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.035} /></mesh>
    </group>
  );
}

function Rig({ children }) {
  const group = useRef();
  useFrame((state, delta) => {
    if (!group.current || reduced) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, state.pointer.x * 0.35, 3, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -state.pointer.y * 0.12, 3, delta);
  });
  return <group ref={group}>{children}</group>;
}

export default function StepStage({ active = 0, className = '' }) {
  const wrap = useRef(null);
  const visible = useInView(wrap, { margin: '100px' });
  return (
    <div ref={wrap} className={className} aria-hidden="true">
      <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 1.5]} camera={{ position: [0, 1.1, 6], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, -0.2, 0)} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
        <Studio />
        <Rig>
          {OBJECTS.map((Obj, i) => <Slot key={i} index={i} active={active} Obj={Obj} />)}
        </Rig>
        <Progress active={active} />
        <Sparkles count={reduced ? 0 : 30} scale={[6, 4, 3]} size={1.6} speed={0.2} opacity={0.3} color="#FFFFFF" />
      </Canvas>
    </div>
  );
}
