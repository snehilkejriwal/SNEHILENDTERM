import { useRef } from 'react';
import { useInView } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { Scales, Studio, reduced } from './models';

// Loose pages drifting behind the scales: the documents being weighed.
function Sheets() {
  const sheets = [
    { p: [-1.35, 1.35, -1.8], r: [0.2, 0.5, 0.2] },
    { p: [1.55, -0.9, -1.6], r: [-0.1, -0.6, -0.15] },
    { p: [1.3, 1.5, -2.4], r: [0.3, -0.3, 0.4] },
  ];
  return sheets.map((s, i) => (
    <Float key={i} speed={reduced ? 0 : 1 + i * 0.3} rotationIntensity={0.4} floatIntensity={reduced ? 0 : 0.6}>
      <group position={s.p} rotation={s.r}>
        <mesh><boxGeometry args={[0.8, 1.05, 0.01]} /><meshStandardMaterial color="#EDEDE8" roughness={0.7} /></mesh>
        {[0.32, 0.2, 0.08, -0.04, -0.16].map((y) => (
          <mesh key={y} position={[0, y, 0.008]}><boxGeometry args={[0.55, 0.025, 0.002]} /><meshBasicMaterial color="#A3A39E" /></mesh>
        ))}
      </group>
    </Float>
  ));
}

function Rig({ children }) {
  const group = useRef();
  useFrame((state, delta) => {
    if (!group.current || reduced) return;
    // Slow turn plus a gentle lean toward the pointer.
    group.current.rotation.y += delta * 0.15;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -state.pointer.y * 0.15, 3, delta);
  });
  return <group ref={group}>{children}</group>;
}

export default function HeroScene({ className = '' }) {
  const wrap = useRef(null);
  // Stop rendering when scrolled out of view, so it costs nothing elsewhere on the page.
  const visible = useInView(wrap, { margin: '100px' });
  return (
    <div ref={wrap} className={className} aria-hidden="true">
      <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 1.5]} camera={{ position: [0, 0, 7], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
        <Studio />
        <Float speed={reduced ? 0 : 1} rotationIntensity={0.1} floatIntensity={reduced ? 0 : 0.35}>
          <Rig><Scales /></Rig>
        </Float>
        <Sheets />
        <Sparkles count={reduced ? 0 : 40} scale={[7, 5, 3]} size={1.8} speed={0.25} opacity={0.4} color="#FFFFFF" />
      </Canvas>
    </div>
  );
}
