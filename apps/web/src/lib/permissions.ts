import { hasPermission, permissionsAt, type Permission, type ResourceScope } from '@helm/shared';
import { useCurrentUser } from '@/features/auth/api';

/**
 * UI-side permission checks, using the same rules as the API. They only decide what to show;
 * the API enforces every action regardless.
 */
export function useCan(permission: Permission, scope: ResourceScope | null | undefined): boolean {
  const user = useCurrentUser();
  return scope ? hasPermission(user.grants, scope, permission) : false;
}

export function usePermissions(scope: ResourceScope | null | undefined): Set<Permission> {
  const user = useCurrentUser();
  return scope ? permissionsAt(user.grants, scope) : new Set();
}

/** True if the user holds the permission anywhere at all (e.g. to show a "New client" button). */
export function useCanAnywhere(permission: Permission): boolean {
  const user = useCurrentUser();
  return user.grants.some((grant) =>
    hasPermission(
      [grant],
      { clientId: grant.clientId, projectId: grant.projectId, cycleId: grant.cycleId },
      permission,
    ),
  );
}
