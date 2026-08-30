interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="bg-white shadow-ring rounded-lg border-l-2 border-red-500 p-8 text-left max-w-xl mx-auto">
      <p className="mono-label text-red-600 mb-2">ERROR</p>
      <p className="text-mute">{message}</p>
    </div>
  );
}
