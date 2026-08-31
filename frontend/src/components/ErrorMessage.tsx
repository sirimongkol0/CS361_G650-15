interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="bg-white shadow-card rounded-base border-l-2 border-crimson p-8 text-left max-w-xl mx-auto">
      <p className="mono-label text-crimson mb-2">ERROR</p>
      <p className="text-mute">{message}</p>
    </div>
  );
}
