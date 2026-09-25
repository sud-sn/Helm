import type { UserType } from '@helm/shared';

/** The signed-in user, resolved from the session cookie on every request. */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  userType: UserType;
  clientId: string | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
  sessionId: string;
}
