import { useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { glbUrl, prepareSimple, setNightLook } from './models';
import { useMeasureClick } from './useMeasureClick';
import { useNear } from './useNear';

function SiteMesh({ url, onReady }: { url: string; onReady?: () => void }) {
  const gltf = useGLTF(glbUrl(url));
  const { root, mats } = useMemo(() => prepareSimple(gltf.scene), [gltf]);
  const night = useStore((s) => s.night);
  const onClick = useMeasureClick();
  useEffect(() => setNightLook(mats, night, 7), [mats, night]);
  useEffect(() => { onReady?.(); }, [onReady]);
  return <primitive object={root} onClick={onClick} />;
}

/** Ground + amenities. Simplified mesh far away; full mesh (trees, details) streams in when the camera comes closer. */
export function Site({ glb, lod }: { glb: string | null; lod: string | null }) {
  const [fullReady, setFullReady] = useState(false);
  const near = useNear([0, 0, 0], 140);
  const wantFull = !!glb && (near || !lod);
  if (!glb && !lod) return null;
  return (
    <>
      {lod && !(wantFull && fullReady) && <Suspense fallback={null}><SiteMesh url={lod} /></Suspense>}
      {wantFull && <Suspense fallback={null}><SiteMesh url={glb!} onReady={() => setFullReady(true)} /></Suspense>}
    </>
  );
}
