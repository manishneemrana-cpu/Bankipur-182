import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MOUSE, TOUCH, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Animates the camera + orbit target to each `goal`, then hands control back to the user. Touching the scene cancels a flight. */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const goal = useStore((s) => s.goal);
  const anim = useRef<{ fp: Vector3; ft: Vector3; tp: Vector3; tt: Vector3; t: number; dur: number; lift: number } | null>(null);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => { anim.current = null; };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useEffect(() => {
    if (!goal || !controls) return;
    const lock = !!goal.lockRotate;
    controls.enableRotate = !lock;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = lock ? MOUSE.PAN : MOUSE.ROTATE;
    controls.touches.ONE = lock ? TOUCH.PAN : TOUCH.ROTATE;
    const tp = new Vector3(...goal.pos), tt = new Vector3(...goal.target);
    if (goal.instant) {
      anim.current = null;
      camera.position.copy(tp); controls.target.copy(tt); controls.update();
      return;
    }
    const dist = camera.position.distanceTo(tp);
    anim.current = { fp: camera.position.clone(), ft: controls.target.clone(), tp, tt, t: 0, dur: goal.duration ?? 1.4, lift: Math.min(dist * 0.12, 18) };
  }, [goal, controls, camera]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / a.dur);
    const e = ease(a.t);
    camera.position.lerpVectors(a.fp, a.tp, e);
    camera.position.y += Math.sin(Math.PI * e) * a.lift; // gentle arc so flights read as "flying", not sliding
    controls.target.lerpVectors(a.ft, a.tt, e);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}
