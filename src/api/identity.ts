import { mock, useApi } from './client';
import { USERS, userByName } from '@/mocks/core';
import { GRANTS, GRANT_MATRIX, GRANT_RESOURCES, GROUPS, ROLES, TOKENS, NEW_TOKEN, userDetail } from '@/mocks/identity';

// Identity & access hooks. Real endpoints noted for the swap (KAP API).
export const useGroups = () => useApi(['groups'], () => mock(GROUPS)); // GET /api/groups
export const useRoles = () => useApi(['roles'], () => mock(ROLES)); // GET /api/roles
export const useGrants = () => useApi(['grants'], () => mock({ grants: GRANTS, matrix: GRANT_MATRIX, resources: GRANT_RESOURCES })); // GET /api/groups/{id}/grants
export const useTokens = () => useApi(['tokens'], () => mock({ tokens: TOKENS, created: NEW_TOKEN })); // GET /api/tokens
export const useUserDetail = (name?: string) =>
  useApi(['user-detail', name], () =>
    mock(() => {
      const u = userByName(name);
      return u ? userDetail(u) : null;
    }),
  ); // GET /api/users/{id} + /groups + /tokens + sign-in log
export const useAllUserDetails = () => useApi(['user-details'], () => mock(() => USERS.map(userDetail)));
