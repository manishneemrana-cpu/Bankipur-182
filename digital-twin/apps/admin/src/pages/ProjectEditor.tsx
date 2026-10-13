import type { ProjectBundle } from '@dt/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorMsg, useAction } from '../ui';
import { Analytics } from './Analytics';
import { FloorPlan } from './FloorPlan';
import { Hotspots } from './Hotspots';
import { Overview } from './Overview';
import { Towers } from './Towers';
import { UnitTypes } from './UnitTypes';
import { Units } from './Units';

export interface TabProps { bundle: ProjectBundle; reload: () => Promise<void> }

const TABS: [string, string][] = [['overview', 'Overview'], ['towers', 'Towers & floors'], ['types', 'Unit types'], ['units', 'Units'], ['hotspots', 'Amenity hotspots'], ['analytics', 'Analytics'], ['floorplan', 'Floor-plan assist']];

export function ProjectEditor({ id, tab }: { id: string; tab: string }) {
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const { error, run } = useAction();
  const reload = useCallback(async () => { await run(async () => setBundle(await api.bundle(id))); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setBundle(null); void reload(); }, [reload]);

  if (!bundle) return <><a href="#/">← Projects</a><ErrorMsg error={error} />{!error && <p>Loading…</p>}</>;
  const props: TabProps = { bundle, reload };
  return (
    <>
      <a href="#/">← Projects</a>
      <h1>{bundle.project.name} <small className={bundle.project.is_published ? 'pub' : 'draft'}>{bundle.project.is_published ? 'Published' : 'Draft'}</small></h1>
      <nav className="tabs">{TABS.map(([k, l]) => <a key={k} href={`#/p/${id}/${k}`} className={tab === k ? 'on' : ''}>{l}</a>)}</nav>
      <ErrorMsg error={error} />
      {tab === 'overview' && <Overview {...props} />}
      {tab === 'towers' && <Towers {...props} />}
      {tab === 'types' && <UnitTypes {...props} />}
      {tab === 'units' && <Units {...props} />}
      {tab === 'hotspots' && <Hotspots {...props} />}
      {tab === 'analytics' && <Analytics {...props} />}
      {tab === 'floorplan' && <FloorPlan {...props} />}
    </>
  );
}
