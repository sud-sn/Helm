import type { UserType } from '@helm/shared';
import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/QueryState';
import { useMe } from '@/features/auth/api';
import { paths } from '@/lib/paths';

export const homeFor = (userType: UserType) =>
  userType === 'client' ? paths.portal.home : paths.home;

/**
 * Sends people to the right place: sign-in when there is no session, the password screen when a
 * temporary password must be replaced, and staff/client users to their own part of the app.
 */
export function RequireAuth({ audience }: { audience: UserType }) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <FullPageLoader />;
  const user = me.data?.user;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`${paths.login}?next=${encodeURIComponent(next)}`} replace />;
  }
  if (user.mustChangePassword) return <Navigate to={paths.changePassword} replace />;
  if (user.userType !== audience) return <Navigate to={homeFor(user.userType)} replace />;
  return <Outlet />;
}
