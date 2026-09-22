import { useState } from 'react';
import { getUserPermissions } from '../utils/permissions';

export function useAuth() {
  const [profile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('sunshine_app_user');
      if (saved) {
        const user = JSON.parse(saved);
        const perms = getUserPermissions(user);
        return {
          ...user,
          name: user.name,
          role: (perms.payments?.edit || user.department === 'admin') ? 'admin' : 'viewer',
        };
      }
    } catch {}
    return { name: 'Guest', role: 'viewer' };
  });

  return { profile, logout: () => {} };
}
