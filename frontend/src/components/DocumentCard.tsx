import { DocumentItem } from '@/types/api';

const DOC_TYPE_LABELS: Record<string, string> = {
  mou: 'MOU',
  moa: 'MOA',
  template: 'TEMPLATE',
  announcement: 'NOTICE',
};

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface DocumentCardProps {
  document: DocumentItem;
  downloadUrl: string;
}

export default function DocumentCard({ document, downloadUrl }: DocumentCardProps) {
  const effective = formatDate(document.effectiveDate);
  const expiry = formatDate(document.expiryDate);
  const sizeKb =
    document.sizeBytes != null ? `${(document.sizeBytes / 1024).toFixed(1)} KB` : null;
  const label = DOC_TYPE_LABELS[document.docType ?? ''] ?? 'PDF';

  return (
    <div className="bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all p-6 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="badge badge-crimson">{label}</span>
        {sizeKb && <span className="mono-label text-faint">{sizeKb}</span>}
      </div>
      <h3 className="text-base font-semibold tracking-tight leading-snug mb-1">
        {document.name}
      </h3>
      {(effective || expiry) && (
        <p className="text-mute text-xs mb-4 mt-1">
          {effective && <>Effective {effective}</>}
          {effective && expiry && ' · '}
          {expiry && <>Expires {expiry}</>}
          {!expiry && effective && (
            <span className="text-faint"> · no end date on record</span>
          )}
        </p>
      )}
      <div className="mt-auto pt-2 flex items-center justify-between">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Download PDF
        </a>
        <span className="mono-label text-faint">S3 · PDF</span>
      </div>
    </div>
  );
}
