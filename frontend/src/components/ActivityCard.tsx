import Link from 'next/link';
import { Activity } from '@/types/api';

const TYPE_STYLES: Record<string, string> = {
  academic_event: 'bg-blue-50 text-blue-700',
  workshop: 'bg-amber-50 text-amber-700',
  exchange: 'bg-emerald-50 text-emerald-700',
  meeting: 'bg-violet-50 text-violet-700',
};

const TYPE_LABELS: Record<string, string> = {
  academic_event: 'ACADEMIC EVENT',
  workshop: 'WORKSHOP',
  exchange: 'EXCHANGE',
  meeting: 'MEETING',
};

interface ActivityCardProps {
  activity: Activity;
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const formattedDate = new Date(activity.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const typeKey = activity.activity_type ?? '';
  const badgeStyle = TYPE_STYLES[typeKey] ?? 'bg-paper text-faint';
  const badgeLabel = TYPE_LABELS[typeKey] ?? typeKey.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-shadow">
      <Link href={`/activities/${activity.id}`} className="group flex flex-col h-full p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="mono-label text-faint">{formattedDate}</span>
          {badgeLabel && (
            <span className={`mono-label px-2 py-0.5 rounded-full ${badgeStyle}`}>
              {badgeLabel}
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold tracking-tight leading-snug mb-2 group-hover:underline underline-offset-4 decoration-line">
          {activity.name}
        </h3>
        {activity.description && (
          <p className="text-mute text-sm leading-relaxed mb-3 whitespace-pre-line">
            {activity.description}
          </p>
        )}
        {activity.partner && (
          <p className="mt-auto pt-4 text-sm border-t border-line">
            <span className="mono-label text-faint mr-2">WITH</span>
            <span className="font-medium">{activity.partner.name}</span>
          </p>
        )}
      </Link>
    </div>
  );
}
