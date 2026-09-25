import { Badge, NavLink } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ICON_SIZE, ICON_STROKE, type AppIcon } from '@/icons';

/** A sidebar link that highlights itself for its route (and, unless `end`, its sub-routes). */
export function NavItem({
  to,
  label,
  icon: Icon,
  end = false,
  activePrefix,
  count,
  description,
  onNavigate,
  leftSection,
}: {
  to: string;
  label: string;
  icon?: AppIcon;
  end?: boolean;
  /** Treat any path under this prefix as active (e.g. every tab of a project). */
  activePrefix?: string;
  count?: number;
  description?: string;
  onNavigate?: () => void;
  leftSection?: ReactNode;
}) {
  const { pathname } = useLocation();
  const prefix = activePrefix ?? to;
  const active = end ? pathname === to : pathname === prefix || pathname.startsWith(`${prefix}/`);
  return (
    <NavLink
      component={Link}
      to={to}
      label={label}
      description={description}
      active={active}
      onClick={onNavigate}
      variant="light"
      leftSection={
        leftSection ?? (Icon ? <Icon size={ICON_SIZE.md} stroke={ICON_STROKE} /> : undefined)
      }
      rightSection={
        count ? (
          <Badge size="sm" variant="filled" color="red" circle={count < 10}>
            {count > 99 ? '99+' : count}
          </Badge>
        ) : undefined
      }
      styles={{ label: { fontWeight: 500 } }}
      aria-current={active ? 'page' : undefined}
    />
  );
}
