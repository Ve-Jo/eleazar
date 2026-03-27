type ActivityStatusScreenProps = {
  className?: string;
  message: string;
  meta?: string | null;
};

export default function ActivityStatusScreen({
  className = "",
  message,
  meta = null,
}: ActivityStatusScreenProps) {
  return (
    <div className={`screen center ${className}`.trim()}>
      <p>{message}</p>
      {meta ? <p className="muted">{meta}</p> : null}
    </div>
  );
}
