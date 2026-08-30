export default function Footer() {
  return (
    <footer className="shadow-ring mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-faint">
            &copy; {new Date().getFullYear()} Partner Activity App · CS361 G650-15
          </p>
          <p className="mono-label text-faint">
            NEXT.JS × FASTAPI × RDS × S3
          </p>
        </div>
      </div>
    </footer>
  );
}
