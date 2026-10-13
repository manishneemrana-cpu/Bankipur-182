import type { Vec3 } from '@dt/shared-types';

/** DOM elements pinned to 3D points. Registered by <Anchored>, positioned every frame by <AnchorProjector> (inside the Canvas). */
export interface Anchor { pos: Vec3; el: HTMLElement }
export const anchors = new Map<string, Anchor>();
