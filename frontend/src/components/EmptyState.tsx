interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="bg-white shadow-card rounded-base p-12 text-center">
      <p className="mono-label text-faint mb-2">EMPTY</p>
      <p className="text-mute">{message}</p>
    </div>
  );
}
