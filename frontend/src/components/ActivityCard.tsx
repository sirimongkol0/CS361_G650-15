import Link from 'next/link';
import { Activity } from '@/types/api';

/* Badge palette from the mock's badge system (index.css) */
const TYPE_STYLES: Record<string, string> = {
  academic_event: 'badge badge-blue',
  workshop: 'badge badge-gold',
  exchange: 'badge badge-green',
  meeting: 'badge badge-purple',
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
  const badgeStyle = TYPE_STYLES[typeKey] ?? 'badge badge-gray';
  const badgeLabel = TYPE_LABELS[typeKey] ?? typeKey.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all">
      <Link href={`/activities/${activity.id}`} className="group flex flex-col h-full p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="mono-label text-faint">{formattedDate}</span>
          {badgeLabel && (
            <span className={badgeStyle}>
              {badgeLabel}
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold tracking-tight leading-snug mb-2 group-hover:underline underline-offset-4 decoration-crimson/40">
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
