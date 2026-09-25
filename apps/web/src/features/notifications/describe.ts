import { ROLE_LABELS, type Notification } from '@helm/shared';
import { paths } from '@/lib/paths';

const RESPONSE_TEXT: Record<string, string> = {
  accepted: 'accepted',
  rejected: 'declined',
  changes_requested: 'asked for changes to',
};

/** Human-readable text and destination for a notification. */
export function describeNotification(
  notification: Notification,
  clientView: boolean,
): { text: string; detail?: string; to?: string } {
  const actor = notification.actor?.displayName ?? 'Someone';
  const d = notification.data;
  const ticket = d.ticketKey
    ? `${d.ticketKey} ${d.ticketTitle ? `· ${d.ticketTitle}` : ''}`.trim()
    : '';
  const ticketLink = d.ticketKey ? paths.ticket(d.ticketKey) : undefined;
  const pitchLink = d.pitchId
    ? clientView
      ? paths.portal.pitch(d.pitchId)
      : paths.pitch(d.pitchId)
    : undefined;

  switch (notification.type) {
    case 'ticket_assigned':
      return { text: `${actor} assigned you ${ticket}`, to: ticketLink };
    case 'mentioned':
      return { text: `${actor} mentioned you on ${ticket}`, detail: d.excerpt, to: ticketLink };
    case 'ticket_status_changed':
      return {
        text: `${actor} moved ${d.ticketKey} from ${d.from} to ${d.to}`,
        detail: d.ticketTitle,
        to: ticketLink,
      };
    case 'comment_added':
      return { text: `${actor} commented on ${ticket}`, detail: d.excerpt, to: ticketLink };
    case 'role_granted':
      return {
        text: `${actor} gave you the ${d.role ? ROLE_LABELS[d.role] : ''} role`,
        detail: d.scopeLabel,
        to: clientView ? paths.portal.home : paths.home,
      };
    case 'pitch_submitted':
      return { text: `${actor} submitted a pitch for review`, detail: d.pitchTitle, to: pitchLink };
    case 'pitch_sent':
      return { text: `${actor} sent you a proposal`, detail: d.pitchTitle, to: pitchLink };
    case 'pitch_responded':
      return {
        text: `${actor} ${RESPONSE_TEXT[d.response ?? ''] ?? 'responded to'} the pitch`,
        detail: d.pitchTitle,
        to: pitchLink,
      };
    case 'pitch_commented':
      return {
        text: `${actor} commented on the pitch “${d.pitchTitle}”`,
        detail: d.excerpt,
        to: pitchLink,
      };
    case 'content_shared':
      if (d.pageId) {
        return {
          text: `${actor} shared a document with you`,
          detail: d.pageTitle,
          to: clientView ? paths.portal.page(d.pageId) : paths.page(d.pageId),
        };
      }
      return {
        text: `${actor} shared meeting minutes with you`,
        detail: d.meetingTitle,
        to: d.meetingId
          ? clientView
            ? paths.portal.meeting(d.meetingId)
            : paths.meeting(d.meetingId)
          : undefined,
      };
  }
}
