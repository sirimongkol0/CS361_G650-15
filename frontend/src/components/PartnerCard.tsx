import Link from 'next/link';
import { Partner } from '@/types/api';

const TYPE_STYLES: Record<string, string> = {
  university: 'bg-blue-50 text-blue-700',
  government: 'bg-rose-50 text-rose-700',
  private_company: 'bg-amber-50 text-amber-700',
  nonprofit: 'bg-emerald-50 text-emerald-700',
  alumni_network: 'bg-violet-50 text-violet-700',
};

const TYPE_LABELS: Record<string, string> = {
  university: 'UNIVERSITY',
  government: 'GOVERNMENT',
  private_company: 'COMPANY',
  nonprofit: 'NON-PROFIT',
  alumni_network: 'ALUMNI',
};

interface PartnerCardProps {
  partner: Partner;
}

export default function PartnerCard({ partner }: PartnerCardProps) {
  const typeKey = partner.type ?? '';
  const typeLabel = TYPE_LABELS[typeKey];
  const badgeStyle = TYPE_STYLES[typeKey] ?? 'bg-paper text-faint';
  const displayLabel = typeLabel ?? (typeKey ? typeKey.replace(/_/g, ' ').toUpperCase() : 'PARTNER');

  return (
    <div className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-shadow">
      <Link href={`/partners/${partner.id}`} className="group flex flex-col h-full p-6">
        <div className="flex items-start justify-between mb-4 min-h-[24px]">
          <span
            className={`mono-label px-2 py-0.5 rounded-full ${badgeStyle}`}
            title={typeLabel ? undefined : typeKey}
          >
            {displayLabel}
          </span>
          {partner.country && (
            <span className="mono-label text-faint pt-0.5">{partner.country}</span>
          )}
        </div>
        <h3 className="text-xl font-semibold tracking-tight mb-2 leading-snug group-hover:underline underline-offset-4 decoration-line">
          {partner.name}
        </h3>
        {partner.description && (
          <p className="text-mute text-sm leading-relaxed line-clamp-3">
            {partner.description}
          </p>
        )}
        <p className="mt-auto pt-5 text-sm font-medium text-mute transition-colors group-hover:text-blue-600 group-hover:underline underline-offset-4">
          View details →
        </p>
      </Link>
    </div>
  );
}
