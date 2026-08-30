import { getPartner } from '@/lib/api';
import { notFound } from 'next/navigation';
import Loading from '@/components/Loading';
import ErrorMessage from '@/components/ErrorMessage';
import { Suspense } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  university: 'UNIVERSITY',
  government: 'GOVERNMENT',
  private_company: 'COMPANY',
  nonprofit: 'NON-PROFIT',
  alumni_network: 'ALUMNI',
};

async function PartnerDetailContent({ params }: PageProps) {
  const { id } = await params;
  let partner;
  let error: string | null = null;

  try {
    partner = await getPartner(parseInt(id, 10));
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

  if (!partner) {
    notFound();
  }

  const typeLabel = TYPE_LABELS[partner.type ?? ''] ?? (partner.type ? partner.type.toUpperCase() : 'PARTNER');

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-card p-10">
        <div className="flex items-center justify-between mb-6">
          <span className="mono-label text-faint">{typeLabel}</span>
          {partner.country && (
            <span className="mono-label text-faint">{partner.country}</span>
          )}
        </div>

        <h1 className="text-4xl font-semibold tracking-tighter leading-none mb-4">
          {partner.name}
        </h1>

        {partner.description && (
          <p className="text-mute leading-relaxed mb-8">{partner.description}</p>
        )}

        <dl className="border-t border-line pt-6 space-y-3 text-sm">
          {partner.websiteUrl && (
            <div className="flex justify-between gap-6">
              <dt className="mono-label text-faint pt-0.5">WEBSITE</dt>
              <dd className="text-right">
                <a
                  href={partner.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {partner.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              </dd>
            </div>
          )}
          {partner.contactName && (
            <div className="flex justify-between gap-6">
              <dt className="mono-label text-faint pt-0.5">CONTACT</dt>
              <dd>{partner.contactName}</dd>
            </div>
          )}
          {partner.contactEmail && (
            <div className="flex justify-between gap-6">
              <dt className="mono-label text-faint pt-0.5">EMAIL</dt>
              <dd className="text-right">
                <a
                  href={`mailto:${partner.contactEmail}`}
                  className="text-blue-600 hover:underline break-all"
                >
                  {partner.contactEmail}
                </a>
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-6">
            <dt className="mono-label text-faint pt-0.5">RECORD ID</dt>
            <dd>#{partner.id}</dd>
          </div>
        </dl>
      </div>

      <a
        href="/partners"
        className="inline-block mt-6 text-sm font-medium text-mute hover:text-ink transition-colors"
      >
        ← Back to partners
      </a>
    </div>
  );
}

export default function PartnerDetailPage({ params }: PageProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <Suspense fallback={<Loading />}>
        <PartnerDetailContent params={params} />
      </Suspense>
    </div>
  );
}
