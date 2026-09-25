import { PageHeader } from '@/components/PageHeader';
import { MeetingsPanel } from '@/features/meetings/components/MeetingsPanel';

export function MeetingsRoute() {
  return (
    <>
      <PageHeader
        title="Meetings"
        description="Transcripts, minutes and action items from client and team discussions."
      />
      <MeetingsPanel />
    </>
  );
}
