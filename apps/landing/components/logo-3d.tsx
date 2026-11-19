"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Edges,
  Environment,
  Lightformer,
  Line,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import type { Group } from "three";
import { prefersStaticMotion } from "./motion-env";
import { LogoMark } from "./logo-mark";

const CREAM = "#fff8ee";
const RED = "#c8102e";

type Shared = { dragging: { current: boolean } };

function NodeCube({ reduced, dragging }: Shared & { reduced: boolean }) {
  const group = useRef<Group | null>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    // Slow idle spin, paused while the user is dragging.
    if (!reduced && !dragging.current) g.rotation.y += delta * 0.35;
    // Hover micro-interaction: gentle scale-up.
    const target = hovered ? 1.06 : 1;
    const next = g.scale.x + (target - g.scale.x) * Math.min(1, delta * 8);
    g.scale.setScalar(next);
  });

  const corners: [number, number, number][] = [
    [-0.95, 0.95, -0.95],
    [0.95, 0.95, 0.95],
    [0.95, -0.95, -0.95],
  ];

  return (
    <group
      ref={group}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[1.9, 1.9, 1.9]} radius={0.16} smoothness={4}>
        <meshPhysicalMaterial
          color="#2a1216"
          metalness={0.25}
          roughness={0.16}
          clearcoat={1}
          clearcoatRoughness={0.25}
          transmission={0.7}
          thickness={1.4}
          ior={1.45}
          attenuationColor={RED}
          attenuationDistance={2.6}
          envMapIntensity={1.2}
        />
        <Edges threshold={15} color={CREAM} />
      </RoundedBox>

      {corners.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.09, 24, 24]} />
          <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.45} />
        </mesh>
      ))}

      {/* Node-graph hint: edges meeting at the cube's center. */}
      <Line
        points={[corners[0]!, [0, 0, 0], corners[1]!]}
        color={CREAM}
        lineWidth={1.4}
        transparent
        opacity={0.7}
      />
      <Line
        points={[corners[2]!, [0, 0, 0]]}
        color={RED}
        lineWidth={1.6}
        transparent
        opacity={0.9}
      />
    </group>
  );
}

/**
 * Interactive 3D brand mark: a smoked-glass rounded cube with cream edge
 * nodes, slowly rotating (pauses while dragged), reacting to hover.
 * Falls back to the static SVG mark when WebGL is unavailable or the user
 * prefers reduced motion.
 */
export function Logo3D({ className }: { className?: string }) {
  const [state, setState] = useState<"pending" | "svg" | "3d">("pending");
  const reduced = useRef(false);
  const dragging = useRef(false);

  useEffect(() => {
    reduced.current =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || prefersStaticMotion();
    let ok = false;
    try {
      const probe = document.createElement("canvas");
      ok = !!(probe.getContext("webgl") || probe.getContext("experimental-webgl"));
    } catch {
      ok = false;
    }
    setState(ok && !reduced.current ? "3d" : "svg");
  }, []);

  if (state !== "3d") {
    return <LogoMark className={`logo-fallback-glow ${className ?? ""}`} />;
  }

  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [2.6, 1.4, 4.4], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        // Keep vertical page swipes working on touch; horizontal drag rotates.
        style={{ touchAction: "pan-y" }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[4, 6, 4]} intensity={1.1} color={CREAM} />
        <directionalLight position={[-5, -2, -4]} intensity={0.7} color={RED} />
        <Suspense fallback={null}>
          <NodeCube reduced={reduced.current} dragging={dragging} />
          <Environment resolution={128}>
            <Lightformer
              intensity={2.2}
              position={[0, 5, 0]}
              rotation-x={Math.PI / 2}
              scale={[10, 10, 1]}
              color={RED}
            />
            <Lightformer
              intensity={1.6}
              position={[-5, 1, -1]}
              rotation-y={Math.PI / 2}
              scale={[12, 2, 1]}
              color={CREAM}
            />
            <Lightformer
              intensity={1.2}
              position={[5, -1, 1]}
              rotation-y={-Math.PI / 2}
              scale={[12, 2, 1]}
              color="#e4314b"
            />
          </Environment>
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          onStart={() => (dragging.current = true)}
          onEnd={() => (dragging.current = false)}
        />
      </Canvas>
    </div>
  );
}
