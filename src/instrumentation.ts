/**
 * Hook de démarrage serveur Next.js (instrumentationHook).
 *
 * Le code Node (lecture .env.local) est isolé dans `instrumentation-node.ts`,
 * importé UNIQUEMENT sous le garde `NEXT_RUNTIME === 'nodejs'` — sinon le
 * bundler edge essaie de résoudre fs/os/path et le build casse.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
