import Link from 'next/link';

export default function Home() {
  const sections = [
    {
      href: '/partners',
      label: 'PARTNERS',
      title: 'Partners',
      desc: 'Universities, agencies and industry partners — with type, country, and coordinator contacts.',
      count: '12 partners',
    },
    {
      href: '/activities',
      label: 'ACTIVITIES',
      title: 'Activities',
      desc: 'Exchanges, signings, forums and workshops mapped to the partners behind them.',
      count: '6 activities',
    },
    {
      href: '/documents',
      label: 'DOCUMENTS',
      title: 'Documents',
      desc: 'MoUs, MoAs and templates as PDFs — bytes in S3 object storage, metadata in Postgres.',
      count: '5 documents',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="pt-24 pb-20 text-center border-b border-line">
        <p className="mono-label text-faint mb-6">
          THAMMASAT UNIVERSITY · PARTNERSHIP REGISTRY
        </p>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-none mb-6">
          Every partnership,
          <br />
          tracked in one place.
        </h1>
        <p className="max-w-xl mx-auto text-lg text-mute leading-relaxed mb-10">
          Agreements scattered across websites, PDFs and inboxes — brought into a
          single registry with lifecycle dates and downloadable originals.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/partners"
            className="btn btn-primary"
          >
            Browse partners
          </Link>
          <Link
            href="/documents"
            className="btn btn-outline bg-white"
          >
            View documents
          </Link>
        </div>
      </section>

      {/* Section cards */}
      <section className="grid md:grid-cols-3 gap-8 py-16">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="group block">
            <p className="mono-label text-faint mb-3">{s.label}</p>
            <h2 className="text-2xl font-semibold tracking-tight mb-2 group-hover:underline underline-offset-4 decoration-line">
              {s.title}
            </h2>
            <p className="text-mute text-sm leading-relaxed mb-3">{s.desc}</p>
            <span className="mono-label text-faint">{s.count}</span>
          </Link>
        ))}
      </section>

      {/* Architecture strip */}
      <section className="border-t border-line py-16 grid md:grid-cols-3 gap-8">
        {[
          ['01 / STORAGE', 'Files live in S3', 'PDF bytes never touch the database — only metadata plus an S3 object key.'],
          ['02 / DATABASE', 'Metadata in Postgres', 'Partners, activities and agreement lifecycle fields on Amazon RDS.'],
          ['03 / STACK', 'Next.js × FastAPI', 'Server-rendered frontend consuming a versioned JSON API under /api/v1.'],
        ].map(([tag, title, body]) => (
          <div key={tag}>
            <p className="mono-label text-faint mb-3">{tag}</p>
            <h3 className="font-semibold tracking-tight mb-1">{title}</h3>
            <p className="text-mute text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
