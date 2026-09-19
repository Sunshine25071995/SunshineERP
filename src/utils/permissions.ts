import { User, UserPermissions } from '../types';

export const DEFAULT_PERMISSIONS: UserPermissions = {
  admin: { view: false, edit: false },
  chemical: { view: false, edit: false },
  production: { view: false, edit: false },
  slitting: { view: false, edit: false },
  payments: { view: false, edit: false },
};

export function getUserPermissions(user: User): UserPermissions {
  if (user.permissions) {
    return user.permissions;
  }

  // Fallback for legacy departments
  const p: UserPermissions = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
  
  if (user.department === 'admin') {
    p.admin = { view: true, edit: true };
    p.chemical = { view: true, edit: true };
    p.production = { view: true, edit: true };
    p.slitting = { view: true, edit: true };
    p.payments = { view: true, edit: true };
  } else if (user.department === 'chemical') {
    p.chemical = { view: true, edit: true };
  } else if (user.department === 'production') {
    p.production = { view: true, edit: true };
  } else if (user.department === 'slitting') {
    p.slitting = { view: true, edit: true };
  }

  return p;
}

export function hasAnyViewPermission(permissions: UserPermissions): boolean {
  return (
    permissions.admin.view ||
    permissions.chemical.view ||
    permissions.production.view ||
    permissions.slitting.view ||
    permissions.payments.view
  );
}
