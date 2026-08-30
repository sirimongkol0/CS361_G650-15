import { getActivities } from '@/lib/api';
import ActivityCard from '@/components/ActivityCard';
import Loading from '@/components/Loading';
import ErrorMessage from '@/components/ErrorMessage';
import EmptyState from '@/components/EmptyState';
import { Suspense } from 'react';

async function ActivitiesContent() {
  let activities;
  let error: string | null = null;

  try {
    activities = await getActivities();
  } catch (e) {
    if (e instanceof Error && e.message.includes('Failed to fetch')) {
      error = 'Unable to connect to the API. Please ensure the backend is running.';
    } else {
      error = 'An unexpected error occurred.';
    }
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!activities || activities.length === 0) {
    return <EmptyState message="No activities found." />;
  }

  const sorted = [...activities].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {sorted.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

export default function ActivitiesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <p className="mono-label text-faint mb-3">TIMELINE · ACTIVITIES</p>
      <h1 className="text-4xl font-semibold tracking-tighter mb-10 pb-8 border-b border-line">
        Activities
      </h1>
      <Suspense fallback={<Loading />}>
        <ActivitiesContent />
      </Suspense>
    </div>
  );
}
