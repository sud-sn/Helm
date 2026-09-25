import { useSearchParams } from 'react-router';
import { useCycles } from './api';

/**
 * The cycle the board shows: the one in the URL (`?cycle=`), else the active cycle, else the next
 * planned one. It lives in the URL so board links can be shared and "New ticket" can default to it.
 */
export function useBoardCycle(projectKey: string) {
  const cycles = useCycles(projectKey);
  const [params, setParams] = useSearchParams();
  const openCycles = (cycles.data ?? []).filter((cycle) => cycle.status !== 'completed');
  const chosen = params.get('cycle');
  const cycle =
    openCycles.find((c) => c.id === chosen) ??
    openCycles.find((c) => c.status === 'active') ??
    openCycles[0];

  const choose = (cycleId: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('cycle', cycleId);
        return next;
      },
      { replace: true },
    );

  return { cycles, openCycles, cycle, choose };
}
