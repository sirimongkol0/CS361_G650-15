import { redirect } from 'next/navigation';

/*
 * Home — the V1 API pages (partners / activities / documents) were removed;
 * the app now opens straight on the design-team UI (public dashboard).
 */
export default function Home() {
  redirect('/dashboard/public');
}
