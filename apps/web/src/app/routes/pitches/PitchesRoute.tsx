import { PageHeader } from '@/components/PageHeader';
import { PitchesPanel } from '@/features/pitches/components/PitchesPanel';

export function PitchesRoute() {
  return (
    <>
      <PageHeader
        title="Pitches"
        description="Proposals the team makes to clients: drafted by the team, approved by a Project Manager, answered by the client."
      />
      <PitchesPanel />
    </>
  );
}
