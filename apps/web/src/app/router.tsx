import type { ComponentType } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { RequireAuth } from './guards/RequireAuth';
import { PortalLayout } from './layouts/PortalLayout';
import { StaffLayout } from './layouts/StaffLayout';
import { ChangePasswordRoute } from './routes/auth/ChangePasswordRoute';
import { LoginRoute } from './routes/auth/LoginRoute';
import { NotFoundRoute, RouteErrorBoundary } from './routes/NotFoundRoute';

/** Code-split screens: each route module is loaded on first visit. */
function screen<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) {
  return async () => ({ Component: (await load())[name] as ComponentType });
}

export const router = createBrowserRouter([
  { path: '/login', Component: LoginRoute, ErrorBoundary: RouteErrorBoundary },
  { path: '/change-password', Component: ChangePasswordRoute, ErrorBoundary: RouteErrorBoundary },
  {
    // Print views for staff and clients alike, without the app around them.
    path: '/print',
    element: <RequireAuth />,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        path: 'pages/:pageId',
        lazy: screen(() => import('./routes/pages/PagePrintRoute'), 'PagePrintRoute'),
      },
    ],
  },
  {
    element: <RequireAuth audience="staff" />,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        Component: StaffLayout,
        children: [
          {
            index: true,
            lazy: screen(() => import('./routes/dashboard/DashboardRoute'), 'DashboardRoute'),
          },
          {
            path: 'my-work',
            lazy: screen(() => import('./routes/my-work/MyWorkRoute'), 'MyWorkRoute'),
          },
          {
            path: 'notifications',
            lazy: screen(
              () => import('./routes/notifications/NotificationsRoute'),
              'NotificationsRoute',
            ),
          },
          {
            path: 'account',
            lazy: screen(() => import('./routes/account/AccountRoute'), 'AccountRoute'),
          },
          {
            path: 'clients',
            lazy: screen(() => import('./routes/clients/ClientsRoute'), 'ClientsRoute'),
          },
          {
            path: 'clients/:clientId',
            lazy: screen(() => import('./routes/clients/ClientRoute'), 'ClientRoute'),
          },
          {
            path: 'projects/:key',
            lazy: screen(
              () => import('./routes/projects/ProjectLayoutRoute'),
              'ProjectLayoutRoute',
            ),
            children: [
              { index: true, element: <Navigate to="board" replace /> },
              {
                path: 'board',
                lazy: screen(() => import('./routes/projects/BoardRoute'), 'BoardRoute'),
              },
              {
                path: 'backlog',
                lazy: screen(() => import('./routes/projects/BacklogRoute'), 'BacklogRoute'),
              },
              {
                path: 'tickets',
                lazy: screen(() => import('./routes/projects/TicketsRoute'), 'TicketsRoute'),
              },
              {
                path: 'cycles',
                lazy: screen(() => import('./routes/projects/CyclesRoute'), 'CyclesRoute'),
              },
              {
                path: 'pages',
                lazy: screen(
                  () => import('./routes/projects/ProjectTabsRoutes'),
                  'ProjectPagesRoute',
                ),
              },
              {
                path: 'meetings',
                lazy: screen(
                  () => import('./routes/projects/ProjectTabsRoutes'),
                  'ProjectMeetingsRoute',
                ),
              },
              {
                path: 'pitches',
                lazy: screen(
                  () => import('./routes/projects/ProjectTabsRoutes'),
                  'ProjectPitchesRoute',
                ),
              },
              {
                path: 'members',
                lazy: screen(
                  () => import('./routes/projects/ProjectTabsRoutes'),
                  'ProjectMembersRoute',
                ),
              },
            ],
          },
          {
            path: 'tickets/:key',
            lazy: screen(() => import('./routes/tickets/TicketRoute'), 'TicketRoute'),
          },
          {
            path: 'pages/:pageId',
            lazy: screen(() => import('./routes/pages/PageRoute'), 'PageRoute'),
          },
          {
            path: 'pages/:pageId/edit',
            lazy: screen(() => import('./routes/pages/PageEditRoute'), 'PageEditRoute'),
          },
          {
            path: 'pitches',
            lazy: screen(() => import('./routes/pitches/PitchesRoute'), 'PitchesRoute'),
          },
          {
            path: 'pitches/:pitchId',
            lazy: screen(() => import('./routes/pitches/PitchRoute'), 'PitchRoute'),
          },
          {
            path: 'meetings',
            lazy: screen(() => import('./routes/meetings/MeetingsRoute'), 'MeetingsRoute'),
          },
          {
            path: 'meetings/:meetingId',
            lazy: screen(() => import('./routes/meetings/MeetingRoute'), 'MeetingRoute'),
          },
          {
            path: 'admin/users',
            lazy: screen(() => import('./routes/admin/UsersRoute'), 'UsersRoute'),
          },
          {
            path: 'admin/users/:userId',
            lazy: screen(() => import('./routes/admin/UserRoute'), 'UserRoute'),
          },
          {
            path: 'admin/audit',
            lazy: screen(() => import('./routes/admin/AuditRoute'), 'AuditRoute'),
          },
          {
            path: 'admin/ai',
            lazy: screen(() => import('./routes/admin/AiRoute'), 'AiRoute'),
          },
          { path: '*', Component: NotFoundRoute },
        ],
      },
    ],
  },
  {
    path: '/portal',
    element: <RequireAuth audience="client" />,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        Component: PortalLayout,
        children: [
          {
            index: true,
            lazy: screen(() => import('./routes/portal/PortalHomeRoute'), 'PortalHomeRoute'),
          },
          {
            path: 'pitches/:pitchId',
            lazy: screen(() => import('./routes/pitches/PitchRoute'), 'PitchRoute'),
          },
          {
            path: 'pages/:pageId',
            lazy: screen(() => import('./routes/pages/PageRoute'), 'PageRoute'),
          },
          {
            path: 'meetings/:meetingId',
            lazy: screen(() => import('./routes/meetings/MeetingRoute'), 'MeetingRoute'),
          },
          {
            path: 'notifications',
            lazy: screen(
              () => import('./routes/notifications/NotificationsRoute'),
              'PortalNotificationsRoute',
            ),
          },
          {
            path: 'account',
            lazy: screen(() => import('./routes/account/AccountRoute'), 'AccountRoute'),
          },
          { path: '*', Component: NotFoundRoute },
        ],
      },
    ],
  },
]);
