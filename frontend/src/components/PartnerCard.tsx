import Link from 'next/link';
import { Partner } from '@/types/api';

/* Badge palette from the mock's badge system (index.css) */
const TYPE_STYLES: Record<string, string> = {
  university: 'badge badge-blue',
  government: 'badge badge-crimson',
  private_company: 'badge badge-gold',
  nonprofit: 'badge badge-green',
  alumni_network: 'badge badge-purple',
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
  const badgeStyle = TYPE_STYLES[typeKey] ?? 'badge badge-gray';
  const displayLabel = typeLabel ?? (typeKey ? typeKey.replace(/_/g, ' ').toUpperCase() : 'PARTNER');

  return (
    <div className="bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all">
      <Link href={`/partners/${partner.id}`} className="group flex flex-col h-full p-6">
        <div className="flex items-start justify-between mb-4 min-h-[24px]">
          <span
            className={badgeStyle}
            title={typeLabel ? undefined : typeKey}
          >
            {displayLabel}
          </span>
          {partner.country && (
            <span className="mono-label text-faint pt-0.5">{partner.country}</span>
          )}
        </div>
        <h3 className="text-xl font-semibold tracking-tight mb-2 leading-snug group-hover:underline underline-offset-4 decoration-crimson/40">
          {partner.name}
        </h3>
        {partner.description && (
          <p className="text-mute text-sm leading-relaxed line-clamp-3">
            {partner.description}
          </p>
        )}
        <p className="mt-auto pt-5 text-sm font-medium text-crimson transition-colors group-hover:text-crimson-hover group-hover:underline underline-offset-4">
          View details →
        </p>
      </Link>
    </div>
  );
}
