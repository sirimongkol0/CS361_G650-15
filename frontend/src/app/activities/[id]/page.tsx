import { getActivities, getActivity } from '@/lib/api';
import { notFound } from 'next/navigation';
import Loading from '@/components/Loading';
import ErrorMessage from '@/components/ErrorMessage';
import { Suspense } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  academic_event: 'ACADEMIC EVENT',
  workshop: 'WORKSHOP',
  exchange: 'EXCHANGE',
  meeting: 'MEETING',
};

async function ActivityDetailContent({ params }: PageProps) {
  const { id } = await params;
  let activity;
  let error: string | null = null;

  try {
    activity = await getActivity(parseInt(id, 10));
  } catch (e) {
    if (e instanceof Error && e.message.includes('not found')) {
      notFound();
    } else if (e instanceof Error && e.message.includes('Failed to fetch')) {
      error = 'Unable to connect to the API. Please ensure the backend is running.';
    } else {
      error = 'An unexpected error occurred.';
    }
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!activity) {
    notFound();
  }

  const formattedDate = new Date(activity.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const typeLabel =
    TYPE_LABELS[activity.activity_type ?? ''] ??
    activity.activity_type?.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-card p-10">
        <div className="flex items-center justify-between mb-6">
          <span className="mono-label text-faint">{formattedDate}</span>
          {typeLabel && (
            <span className="mono-label bg-paper text-faint px-2 py-0.5 rounded-full">
              {typeLabel}
            </span>
          )}
        </div>

        <h1 className="text-4xl font-semibold tracking-tighter leading-tight mb-4">
          {activity.name}
        </h1>

        {activity.description && (
          <p className="text-mute leading-relaxed mb-8 whitespace-pre-line">
            {activity.description}
          </p>
        )}

        {activity.partner && (
          <dl className="border-t border-line pt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-6">
              <dt className="mono-label text-faint pt-0.5">PARTNER</dt>
              <dd className="text-right font-medium">{activity.partner.name}</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="mono-label text-faint pt-0.5">RECORD ID</dt>
              <dd>#{activity.id}</dd>
            </div>
          </dl>
        )}

        {!activity.partner && (
          <dl className="border-t border-line pt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-6">
              <dt className="mono-label text-faint pt-0.5">RECORD ID</dt>
              <dd>#{activity.id}</dd>
            </div>
          </dl>
        )}
      </div>

      <a
        href="/activities"
        className="inline-block mt-6 text-sm font-medium text-mute hover:text-ink transition-colors"
      >
        ← Back to activities
      </a>
    </div>
  );
}

export default function ActivityDetailPage({ params }: PageProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <Suspense fallback={<Loading />}>
        <ActivityDetailContent params={params} />
      </Suspense>
    </div>
  );
}
