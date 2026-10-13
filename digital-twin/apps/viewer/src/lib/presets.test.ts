import { describe, expect, it } from 'vitest';
import type { Floor, Tower } from '@dt/shared-types';
import { exteriorGoal, floorGoal, planGoal, rotateY, towerCenter, towerGoal, towerToWorld } from './presets';
import { formatDistance, measureDistance } from './measure';

const tower: Tower = { id: 't', project_id: 'p', name: 'A', glb_url: null, lod_glb_url: null, floor_count: 12, floor_height: 3, floor_node_prefix: 'Floor_', footprint_w: 24, footprint_d: 14, position: [-34, 0, 4], rotation_y: 0, sort_order: 0 };
const floor = (n: number): Floor => ({ id: 'f' + n, tower_id: 't', floor_number: n, label: null, elevation: (n - 1) * 3, glb_url: null });

describe('camera presets', () => {
  it('plan view is straight above the floor centre and locks rotation', () => {
    const g = planGoal(tower, floor(5), 16 / 9);
    expect(g.target[1]).toBeCloseTo(12.3);
    expect(g.pos[0]).toBeCloseTo(g.target[0]); // camera directly above the (shifted) framing centre
    expect(g.target[0]).toBeGreaterThan(-34);  // framing slides right so the plate clears the side panel
    expect(g.pos[1]).toBeGreaterThan(g.target[1] + 10);
    expect(g.lockRotate).toBe(true);
  });
  it('plan keeps the plate centred on narrow screens (bottom-sheet layout)', () => {
    expect(planGoal(tower, floor(1), 0.6).target[0]).toBeCloseTo(-34);
  });
  it('plan height grows on narrow (portrait) screens so the plate still fits', () => {
    expect(planGoal(tower, floor(1), 0.5).pos[1]).toBeGreaterThan(planGoal(tower, floor(1), 2).pos[1]);
  });
  it('floor view looks at the selected floor elevation', () => {
    expect(floorGoal(tower, floor(7)).target[1]).toBeCloseTo(19);
  });
  it('tower view targets the tower body from outside it', () => {
    const g = towerGoal(tower);
    expect(Math.hypot(g.pos[0] - towerCenter(tower)[0], g.pos[2] - towerCenter(tower)[2])).toBeGreaterThan(20);
  });
  it('exterior view centres on the towers', () => {
    expect(exteriorGoal([tower, { ...tower, id: 'u', position: [34, 0, 4] }]).target[0]).toBeCloseTo(0);
  });
  it('rotateY matches three.js and towerToWorld applies position', () => {
    const v = rotateY([1, 0, 0], Math.PI / 2);
    expect(v[0]).toBeCloseTo(0); expect(v[2]).toBeCloseTo(-1);
    expect(towerToWorld(tower, [0, 1, 0])).toEqual([-34, 1, 4]);
  });
});

describe('measurement', () => {
  it('applies model scale', () => { expect(measureDistance([0, 0, 0], [3, 4, 0], 2)).toBe(10); });
  it('formats metres and feet', () => { expect(formatDistance(10)).toBe('10.0 m  (32.8 ft)'); });
});
