export function isProduction(): boolean {
  return window.location.hostname === 'planner.thiagobraga.dev';
}

export function getAppTitle(): string {
  const baseTitle = 'BulletPlanner';
  return isProduction() ? baseTitle : `${baseTitle} Dev`;
}
