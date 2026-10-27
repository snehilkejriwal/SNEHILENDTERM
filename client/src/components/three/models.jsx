import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';

// Small library of recognisable objects built from primitives (no model files to download).
// Everything is silver, black lacquer or paper, to match the black-and-white theme.

export const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const SILVER = { color: '#DADAD5', metalness: 0.85, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 };
const INK = { color: '#151515', metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 };
const PAPER = { color: '#F3F3EF', metalness: 0, roughness: 0.65 };

const Silver = (p) => <meshPhysicalMaterial {...SILVER} {...p} />;
const Ink = (p) => <meshPhysicalMaterial {...INK} {...p} />;
const Paper = (p) => <meshStandardMaterial {...PAPER} {...p} />;

const UP = new THREE.Vector3(0, 1, 0);

// A thin rod between two points (used for the chains on the scales).
function Rod({ from, to, radius = 0.012 }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
      length: dir.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <Silver />
    </mesh>
  );
}

function Pan() {
  // Three chains meet above a shallow bowl.
  const rim = 0.42;
  const chains = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2;
    return [Math.cos(a) * rim, -0.82, Math.sin(a) * rim];
  });
  return (
    <group>
      {chains.map((p, i) => <Rod key={i} from={[0, 0, 0]} to={p} />)}
      <mesh position={[0, -0.82, 0]} scale={[1, 0.38, 1]}>
        <sphereGeometry args={[0.44, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <Silver side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Scales of justice. The beam tips slowly; the pans always hang straight down.
export function Scales({ swing = 0.12, speed = 0.7 }) {
  const beam = useRef();
  const left = useRef();
  const right = useRef();
  const ARM = 1.25;
  const PIVOT = 0.95;
  useFrame((state) => {
    const tilt = reduced ? 0.06 : Math.sin(state.clock.elapsedTime * speed) * swing;
    beam.current.rotation.z = tilt;
    const dx = Math.cos(tilt) * ARM;
    const dy = Math.sin(tilt) * ARM;
    left.current.position.set(-dx, PIVOT - dy, 0);
    right.current.position.set(dx, PIVOT + dy, 0);
  });
  return (
    <group>
      {/* Stepped base */}
      <mesh position={[0, -1.42, 0]}><cylinderGeometry args={[0.7, 0.8, 0.12, 64]} /><Ink /></mesh>
      <mesh position={[0, -1.3, 0]}><cylinderGeometry args={[0.42, 0.5, 0.12, 64]} /><Silver /></mesh>
      {/* Pillar and finial */}
      <mesh position={[0, -0.18, 0]}><cylinderGeometry args={[0.055, 0.075, 2.3, 24]} /><Silver /></mesh>
      <mesh position={[0, 1.12, 0]}><sphereGeometry args={[0.11, 32, 32]} /><Silver /></mesh>
      <group ref={beam} position={[0, PIVOT, 0]}>
        <mesh><boxGeometry args={[ARM * 2, 0.055, 0.055]} /><Silver /></mesh>
        {[-ARM, ARM].map((x) => <mesh key={x} position={[x, 0, 0]}><sphereGeometry args={[0.055, 16, 16]} /><Silver /></mesh>)}
      </group>
      <group ref={left}><Pan /></group>
      <group ref={right}><Pan /></group>
    </group>
  );
}

// A page of text with a magnifying glass scanning across it.
export function DocumentLens({ animate = true }) {
  const lens = useRef();
  useFrame((state) => {
    if (!lens.current || reduced || !animate) return;
    const t = state.clock.elapsedTime;
    lens.current.position.x = 0.15 + Math.sin(t * 0.9) * 0.35;
    lens.current.position.y = 0.1 + Math.cos(t * 0.45) * 0.4;
  });
  const lines = [0.55, 0.42, 0.29, 0.16, 0.03, -0.1, -0.23, -0.36, -0.49];
  return (
    <group rotation={[-0.15, 0.3, 0.05]}>
      <mesh position={[0.06, -0.05, -0.04]} rotation={[0, 0, 0.05]}><boxGeometry args={[1.3, 1.7, 0.02]} /><Paper color="#DCDCD7" /></mesh>
      <mesh><boxGeometry args={[1.3, 1.7, 0.03]} /><Paper /></mesh>
      <mesh position={[-0.28, 0.7, 0.02]}><boxGeometry args={[0.5, 0.07, 0.01]} /><meshBasicMaterial color="#111" /></mesh>
      {lines.map((y, i) => (
        <mesh key={y} position={[(i % 3 === 2 ? -0.17 : -0.05), y, 0.02]}>
          <boxGeometry args={[i % 3 === 2 ? 0.75 : 1.0, 0.035, 0.005]} />
          <meshBasicMaterial color="#8A8A86" />
        </mesh>
      ))}
      <group ref={lens} position={[0.15, 0.1, 0.32]}>
        <mesh><torusGeometry args={[0.32, 0.045, 20, 64]} /><Silver /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.31, 0.31, 0.015, 48]} /><meshPhysicalMaterial color="#ffffff" transmission={1} roughness={0} thickness={0.2} transparent opacity={0.35} /></mesh>
        <mesh position={[0.36, -0.36, 0]} rotation={[0, 0, Math.PI / 4]}><cylinderGeometry args={[0.05, 0.06, 0.6, 20]} /><Ink /></mesh>
      </group>
    </group>
  );
}

// An open law book with one page turning over and over.
export function LawBook({ animate = true }) {
  const page = useRef();
  useFrame((state) => {
    if (!page.current || reduced || !animate) return;
    // Turn a page every few seconds: ease from right (0) to left (PI), then rest.
    const t = (state.clock.elapsedTime * 0.35) % 1;
    const p = Math.min(1, t / 0.6);
    page.current.rotation.y = -(1 - Math.cos(p * Math.PI)) / 2 * (Math.PI - 0.3) - 0.15;
  });
  const half = (side) => (
    <group rotation={[0, side * 0.15, 0]}>
      <mesh position={[side * 0.5, 0, -0.03]}><boxGeometry args={[1.0, 1.36, 0.05]} /><Ink /></mesh>
      <mesh position={[side * 0.47, 0, 0.05]}><boxGeometry args={[0.92, 1.28, 0.12]} /><Paper /></mesh>
      {[0.4, 0.28, 0.16, 0.04, -0.08, -0.2, -0.32].map((y) => (
        <mesh key={y} position={[side * 0.47, y, 0.115]}><boxGeometry args={[0.66, 0.03, 0.004]} /><meshBasicMaterial color="#9A9A96" /></mesh>
      ))}
    </group>
  );
  return (
    <group rotation={[-0.55, 0, 0]}>
      {half(-1)}
      {half(1)}
      <mesh position={[0, 0, -0.03]}><cylinderGeometry args={[0.06, 0.06, 1.36, 16]} /><Ink /></mesh>
      <group ref={page} position={[0, 0, 0.12]} rotation={[0, -0.15, 0]}>
        <mesh position={[0.45, 0, 0]}><boxGeometry args={[0.9, 1.26, 0.006]} /><Paper side={THREE.DoubleSide} /></mesh>
      </group>
    </group>
  );
}

function useRupeeTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#D8D8D3';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#9E9E99';
    g.lineWidth = 10;
    g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#5E5E5A';
    g.font = 'bold 150px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('₹', 128, 136);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function Coin({ face, ...props }) {
  return (
    <group {...props}>
      <mesh>
        <cylinderGeometry args={[0.42, 0.42, 0.09, 48]} />
        <meshPhysicalMaterial {...SILVER} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.0455, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.41, 48]} />
        <meshStandardMaterial map={face} metalness={0.4} roughness={0.35} />
      </mesh>
    </group>
  );
}

// Rupee coins dropping onto a stack, one at a time.
export function CoinStack({ animate = true }) {
  const face = useRupeeTexture();
  const drop = useRef();
  const COUNT = 5;
  useFrame((state) => {
    if (!drop.current) return;
    if (reduced || !animate) { drop.current.visible = false; return; }
    const t = (state.clock.elapsedTime * 0.6) % 1;
    const top = -0.55 + COUNT * 0.1;
    // Fall with gravity-like easing, then sit on the stack briefly.
    const fall = Math.min(1, t / 0.55);
    drop.current.visible = true;
    drop.current.position.y = 1.3 - (1.3 - top) * fall * fall;
    drop.current.rotation.x = (1 - fall) * 2.5;
  });
  return (
    <group rotation={[0.35, 0, 0]}>
      {Array.from({ length: COUNT }, (_, i) => (
        <Coin key={i} face={face} position={[(i % 2) * 0.03 - 0.015, -0.55 + i * 0.1, (i % 3) * 0.02]} />
      ))}
      <Coin face={face} position={[-0.85, -0.55, 0.15]} />
      <Coin face={face} position={[-0.85, -0.45, 0.15]} />
      <group ref={drop} position={[0, 1.3, 0]}><Coin face={face} /></group>
    </group>
  );
}

// A sealed letter beside a gavel that strikes now and then.
export function LetterGavel({ animate = true }) {
  const gavel = useRef();
  const letter = useRef();
  const flap = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.75, 0.5); s.lineTo(0.75, 0.5); s.lineTo(0, -0.05); s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  useFrame((state) => {
    if (reduced || !animate) return;
    const t = state.clock.elapsedTime;
    const c = (t * 0.5) % 1;
    // Lift slowly, strike fast.
    let lift = 0;
    if (c < 0.75) lift = 0.7 * Math.sin((c / 0.75) * (Math.PI / 2));
    else if (c < 0.85) lift = 0.7 * (1 - (c - 0.75) / 0.1);
    gavel.current.rotation.z = -lift;
    letter.current.position.y = 0.25 + Math.sin(t * 1.2) * 0.06;
  });
  return (
    <group>
      <group ref={letter} position={[-0.45, 0.25, 0]} rotation={[-0.1, 0.35, 0.08]}>
        <mesh><boxGeometry args={[1.5, 1.0, 0.04]} /><Paper /></mesh>
        <mesh geometry={flap} position={[0, 0, 0.025]}><Paper color="#E4E4DF" side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, -0.02, 0.05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.15, 0.16, 0.05, 32]} /><Ink /></mesh>
        <mesh position={[0, -0.02, 0.078]}><torusGeometry args={[0.09, 0.012, 8, 32]} /><Silver /></mesh>
      </group>
      <group position={[0.75, -0.75, 0.2]}>
        <mesh><cylinderGeometry args={[0.42, 0.46, 0.14, 48]} /><Ink /></mesh>
        <group ref={gavel} position={[0.55, 0.35, 0]}>
          {/* Handle pivots at its end so the head comes down onto the block. */}
          <mesh position={[-0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.05, 0.9, 16]} /><Ink /></mesh>
          <group position={[-0.9, 0, 0]}>
            <mesh><cylinderGeometry args={[0.15, 0.15, 0.6, 32]} /><Ink /></mesh>
            {[-0.2, 0.2].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.158, 0.158, 0.05, 32]} /><Silver /></mesh>)}
          </group>
        </group>
      </group>
    </group>
  );
}

// ---- Case types ----

export function Briefcase() {
  return (
    <group>
      <mesh><boxGeometry args={[1.5, 1.0, 0.45]} /><Ink /></mesh>
      <mesh position={[0, 0.18, 0]}><boxGeometry args={[1.52, 0.03, 0.47]} /><Silver /></mesh>
      <mesh position={[0, 0.5, 0]}><torusGeometry args={[0.24, 0.045, 16, 40, Math.PI]} /><Silver /></mesh>
      {[-0.45, 0.45].map((x) => <mesh key={x} position={[x, 0.18, 0.24]}><boxGeometry args={[0.16, 0.12, 0.04]} /><Silver /></mesh>)}
    </group>
  );
}

const PAINT = { color: '#EDEDEA', metalness: 0.25, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 };

// Flat outline (x along the body, y outward) extruded into a thin aerofoil-ish slab.
function useSlab(points, depth) {
  return useMemo(() => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.4, bevelSegments: 2 });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [points, depth]);
}

// Nose at +x. Profile is turned on a lathe, so the body tapers like a real fuselage.
const FUSELAGE = [[0, -1.15], [0.05, -1.1], [0.1, -0.9], [0.15, -0.6], [0.175, -0.3], [0.18, 0], [0.18, 0.6], [0.172, 0.78], [0.15, 0.92], [0.11, 1.03], [0.06, 1.1], [0, 1.13]];
const WING = [[0.28, 0.12], [-0.12, 0.12], [-0.5, 1.22], [-0.36, 1.22]];
const STAB = [[-0.78, 0.08], [-0.98, 0.08], [-1.1, 0.48], [-1.02, 0.48]];
const FIN = [[-0.72, 0.1], [-1.08, 0.1], [-1.16, 0.58], [-1.02, 0.58]];

export function Airplane() {
  const body = useMemo(() => {
    const g = new THREE.LatheGeometry(FUSELAGE.map(([r, y]) => new THREE.Vector2(r, y)), 48);
    g.rotateZ(-Math.PI / 2);
    return g;
  }, []);
  const wing = useSlab(WING, 0.025);
  const stab = useSlab(STAB, 0.016);
  const fin = useSlab(FIN, 0.018);
  return (
    <group rotation={[0.42, -0.62, 0.12]} position={[0.05, -0.08, 0]} scale={0.88}>
      <mesh geometry={body}><meshPhysicalMaterial {...PAINT} /></mesh>
      {/* Cockpit glass and cabin windows */}
      <mesh position={[0.98, 0.07, 0]} scale={[1, 0.55, 1.05]}><sphereGeometry args={[0.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.4]} /><Ink /></mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[0.68 - i * 0.12, 0.055, side * 0.176]}><boxGeometry args={[0.04, 0.03, 0.01]} /><meshBasicMaterial color="#1A1A1A" /></mesh>
          ))}
          {/* Swept wing with a little dihedral, mirrored for each side */}
          <group position={[0, -0.07, 0]} rotation={[side * (Math.PI / 2 - 0.06), 0, 0]} scale={[1, 1, side]}>
            <mesh geometry={wing}><Silver side={THREE.DoubleSide} /></mesh>
          </group>
          <group position={[0, 0.02, 0]} rotation={[side * (Math.PI / 2 - 0.08), 0, 0]} scale={[1, 1, side]}>
            <mesh geometry={stab}><Silver side={THREE.DoubleSide} /></mesh>
          </group>
          {/* Engine under each wing */}
          <group position={[0.12, -0.17, side * 0.48]}>
            <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.072, 0.06, 0.34, 32]} /><meshPhysicalMaterial {...PAINT} /></mesh>
            <mesh position={[0.171, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.058, 0.058, 0.01, 32]} /><Ink /></mesh>
            <mesh position={[-0.05, 0.075, 0]}><boxGeometry args={[0.16, 0.06, 0.02]} /><Silver /></mesh>
          </group>
        </group>
      ))}
      <mesh geometry={fin}><Ink /></mesh>
    </group>
  );
}

export function Key() {
  return (
    <group rotation={[0, 0, 0.5]}>
      <mesh position={[-0.6, 0, 0]}><torusGeometry args={[0.3, 0.08, 20, 48]} /><Silver /></mesh>
      <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 1.1, 20]} /><Silver /></mesh>
      <mesh position={[0.55, -0.14, 0]}><boxGeometry args={[0.1, 0.24, 0.08]} /><Silver /></mesh>
      <mesh position={[0.36, -0.1, 0]}><boxGeometry args={[0.08, 0.16, 0.08]} /><Silver /></mesh>
      <mesh position={[-0.6, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.05, 6]} /><Ink /></mesh>
    </group>
  );
}

// Shared studio lighting: subtle cyan and violet rim lightformers give silver and lacquer vibrant high-tech specular gleam.
export function Studio({ intensity = 1 }) {
  return (
    <>
      <ambientLight intensity={0.4 * intensity} />
      <directionalLight position={[3, 5, 4]} intensity={1.6 * intensity} />
      <directionalLight position={[-4, -2, -2]} intensity={0.8 * intensity} color="#38bdf8" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3.5 * intensity} position={[0, 4, 3]} scale={[8, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2.2 * intensity} position={[-5, 1, 2]} scale={[3, 6, 1]} color="#38bdf8" />
        <Lightformer form="rect" intensity={1.8 * intensity} position={[5, -1, 2]} scale={[3, 5, 1]} color="#818cf8" />
      </Environment>
    </>
  );
}
