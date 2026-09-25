import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Badge, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { BOARD_STATUSES, TICKET_STATUS_LABELS, type Ticket, type TicketStatus } from '@helm/shared';
import { ToneIcon } from '@/components/Tag';
import { StatusIcons } from '@/icons';
import { STATUS_TONE } from '@/theme/tokens';
import classes from './KanbanBoard.module.css';
import { TicketCard } from './TicketCard';

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

function sortCards(a: Ticket, b: Ticket) {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function DraggableCard({
  ticket,
  canMove,
  onMove,
}: {
  ticket: Ticket;
  canMove: boolean;
  onMove: (status: TicketStatus) => void;
}) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.key,
    data: { ticket },
    disabled: !canMove,
  });
  // Pointer dragging only. dnd-kit's keyboard attributes would turn the card into a button that
  // contains other controls; keyboard and screen-reader users get the title link and the
  // card's "Move to" menu instead.
  return (
    <div ref={setNodeRef} {...listeners} style={{ opacity: isDragging ? 0.35 : 1 }}>
      <TicketCard ticket={ticket} canMove={canMove} onMove={onMove} />
    </div>
  );
}

function Column({
  status,
  tickets,
  canMove,
  onMove,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  canMove: (ticket: Ticket) => boolean;
  onMove: (ticket: Ticket, status: TicketStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={classes.column}
      data-over={isOver || undefined}
      aria-label={TICKET_STATUS_LABELS[status]}
    >
      <Group justify="space-between" px="xs" pb="xs" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          <ToneIcon
            tone={STATUS_TONE[status]}
            icon={StatusIcons[status]}
            label={TICKET_STATUS_LABELS[status]}
          />
          <Text fw={600} size="sm">
            {TICKET_STATUS_LABELS[status]}
          </Text>
        </Group>
        <Badge variant="light" color="gray" size="sm">
          {tickets.length}
        </Badge>
      </Group>
      <Stack gap="xs" className={classes.cards}>
        {tickets.map((ticket) => (
          <DraggableCard
            key={ticket.id}
            ticket={ticket}
            canMove={canMove(ticket)}
            onMove={(next) => onMove(ticket, next)}
          />
        ))}
        {tickets.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="md">
            Drop tickets here
          </Text>
        ) : null}
      </Stack>
    </section>
  );
}

/**
 * The cycle board. Cards move by drag and drop or with the per-card "Move to" menu; each move
 * is a status change that the API checks (developers may only move their own tickets).
 */
export function KanbanBoard({
  tickets,
  canMove,
  onMove,
}: {
  tickets: Ticket[];
  canMove: (ticket: Ticket) => boolean;
  onMove: (ticket: Ticket, status: TicketStatus) => void;
}) {
  const [active, setActive] = useState<Ticket | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const byStatus = new Map<TicketStatus, Ticket[]>(BOARD_STATUSES.map((status) => [status, []]));
  for (const ticket of tickets) byStatus.get(ticket.status)?.push(ticket);

  const onDragStart = (event: DragStartEvent) =>
    setActive((event.active.data.current?.ticket as Ticket) ?? null);
  const onDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const ticket = event.active.data.current?.ticket as Ticket | undefined;
    const target = event.over?.id as TicketStatus | undefined;
    if (ticket && target && target !== ticket.status) onMove(ticket, target);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <ScrollArea type="auto" offsetScrollbars>
        <div className={classes.board}>
          {BOARD_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tickets={(byStatus.get(status) ?? []).sort(sortCards)}
              canMove={canMove}
              onMove={onMove}
            />
          ))}
        </div>
      </ScrollArea>
      <DragOverlay>{active ? <TicketCard ticket={active} canMove dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
