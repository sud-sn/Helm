import {
  ACTION_ITEM_STATUS_LABELS,
  CYCLE_STATUS_LABELS,
  PITCH_STATUS_LABELS,
  ROLE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  VISIBILITY_LABELS,
  type ActionItemStatus,
  type CycleStatus,
  type PitchStatus,
  type Role,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  type Visibility,
} from '@helm/shared';
import {
  ActionItemStatusIcons,
  CycleStatusIcons,
  PitchStatusIcons,
  PriorityIcons,
  StatusIcons,
  TypeIcons,
  VisibilityIcons,
} from '@/icons';
import {
  ACTION_ITEM_TONE,
  CYCLE_STATUS_TONE,
  PITCH_STATUS_TONE,
  PRIORITY_TONE,
  STATUS_TONE,
  TYPE_TONE,
  VISIBILITY_TONE,
  type Tone,
} from '@/theme/tokens';
import { Tag, ToneIcon } from './Tag';

export const StatusTag = ({ status }: { status: TicketStatus }) => (
  <Tag tone={STATUS_TONE[status]} icon={StatusIcons[status]}>
    {TICKET_STATUS_LABELS[status]}
  </Tag>
);

export const TypeTag = ({ type }: { type: TicketType }) => (
  <Tag tone={TYPE_TONE[type]} icon={TypeIcons[type]} bare>
    {TICKET_TYPE_LABELS[type]}
  </Tag>
);

export const TypeIcon = ({ type }: { type: TicketType }) => (
  <ToneIcon tone={TYPE_TONE[type]} icon={TypeIcons[type]} label={TICKET_TYPE_LABELS[type]} />
);

export const PriorityIcon = ({ priority }: { priority: TicketPriority }) => (
  <ToneIcon
    tone={PRIORITY_TONE[priority]}
    icon={PriorityIcons[priority]}
    label={`${TICKET_PRIORITY_LABELS[priority]} priority`}
  />
);

export const PriorityTag = ({ priority }: { priority: TicketPriority }) => (
  <Tag tone={PRIORITY_TONE[priority]} icon={PriorityIcons[priority]} bare>
    {TICKET_PRIORITY_LABELS[priority]}
  </Tag>
);

export const PitchStatusTag = ({
  status,
  clientView,
}: {
  status: PitchStatus;
  clientView?: boolean;
}) => (
  <Tag tone={PITCH_STATUS_TONE[status]} icon={PitchStatusIcons[status]}>
    {clientView && status === 'sent' ? 'Awaiting your response' : PITCH_STATUS_LABELS[status]}
  </Tag>
);

export const CycleStatusTag = ({ status }: { status: CycleStatus }) => (
  <Tag tone={CYCLE_STATUS_TONE[status]} icon={CycleStatusIcons[status]}>
    {CYCLE_STATUS_LABELS[status]}
  </Tag>
);

export const VisibilityTag = ({ visibility }: { visibility: Visibility }) => (
  <Tag tone={VISIBILITY_TONE[visibility]} icon={VisibilityIcons[visibility]}>
    {VISIBILITY_LABELS[visibility]}
  </Tag>
);

export const ActionItemStatusTag = ({ status }: { status: ActionItemStatus }) => (
  <Tag tone={ACTION_ITEM_TONE[status]} icon={ActionItemStatusIcons[status]}>
    {ACTION_ITEM_STATUS_LABELS[status]}
  </Tag>
);

const ROLE_TONE: Record<Role, Tone> = {
  DELIVERY_MANAGER: 'special',
  PROJECT_MANAGER: 'review',
  TEAM_LEAD: 'brand',
  BUSINESS_ANALYST: 'uat',
  DEVELOPER: 'info',
  VIEWER: 'neutral',
  CLIENT: 'client',
};

export const RoleTag = ({ role }: { role: Role }) => (
  <Tag tone={ROLE_TONE[role]} dot>
    {ROLE_LABELS[role]}
  </Tag>
);
