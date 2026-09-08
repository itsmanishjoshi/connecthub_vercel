export function passwordError(
  newPassword: string,
  confirmPassword?: string,
  currentPassword?: string,
): string | null {
  if (!newPassword) {
    return 'Password is required.';
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return 'New password and confirmation do not match.';
  }
  if (currentPassword !== undefined && currentPassword && newPassword === currentPassword) {
    return 'Choose a password that is different from the current one.';
  }
  return null;
}
