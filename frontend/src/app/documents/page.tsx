import { getDocuments, documentDownloadUrl } from '@/lib/api';
import DocumentCard from '@/components/DocumentCard';
import Loading from '@/components/Loading';
import ErrorMessage from '@/components/ErrorMessage';
import EmptyState from '@/components/EmptyState';
import { Suspense } from 'react';

async function DocumentsContent() {
  let documents;
  let error: string | null = null;

  try {
    documents = await getDocuments();
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

  if (!documents || documents.length === 0) {
    return <EmptyState message="No documents found." />;
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          downloadUrl={documentDownloadUrl(document.id)}
        />
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <p className="mono-label text-faint mb-3">ARCHIVE · DOCUMENTS</p>
      <h1 className="text-4xl font-semibold tracking-tighter mb-10 pb-8 border-b border-line">
        Documents
      </h1>
      <Suspense fallback={<Loading />}>
        <DocumentsContent />
      </Suspense>
    </div>
  );
}
