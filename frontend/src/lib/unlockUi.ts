export function unlockUi() {
  if (typeof document === 'undefined') return;
  document.body.style.removeProperty('pointer-events');
  document.body.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('pointer-events');
}
