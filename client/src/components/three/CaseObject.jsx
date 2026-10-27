import { useRef } from 'react';
import { useInView } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { Briefcase, Airplane, Key, Studio, reduced } from './models';

// What each kind of case is about, as an object.
const MODELS = { employment: Briefcase, flight: Airplane, rent: Key };

function Turntable({ hovered, children }) {
  const group = useRef();
  useFrame((_, delta) => {
    if (!group.current || reduced) return;
    // Idle turn, faster while the card is hovered or focused.
    group.current.rotation.y += delta * (hovered ? 1.2 : 0.3);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, hovered ? 0.25 : 0.12, 4, delta);
  });
  return <group ref={group}>{children}</group>;
}

export default function CaseObject({ packKey, hovered = false, muted = false, className = '' }) {
  const wrap = useRef(null);
  const visible = useInView(wrap, { margin: '100px' });
  const Model = MODELS[packKey] || Briefcase;
  return (
    <div ref={wrap} className={`${className} ${muted ? 'opacity-50' : ''}`} aria-hidden="true">
      <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 1.5]} camera={{ position: [0, 0.3, 3.1], fov: 38 }} gl={{ antialias: true, alpha: true }}>
        <Studio intensity={muted ? 0.7 : 1} />
        <Float speed={reduced ? 0 : 1.4} rotationIntensity={0.15} floatIntensity={reduced ? 0 : 0.4}>
          <Turntable hovered={hovered && !muted}><group scale={1.15}><Model /></group></Turntable>
        </Float>
      </Canvas>
    </div>
  );
}
