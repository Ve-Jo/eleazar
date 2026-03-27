import SharedInfoRectangle from "../../../../shared/src/ui/InfoRectangle.jsx";

type MetricPillProps = {
  label: string;
  value: string;
};

export default function MetricPill({ label, value }: MetricPillProps) {
  return (
    <SharedInfoRectangle
      className="metric-pill"
      background="linear-gradient(180deg, color-mix(in srgb, var(--activity-overlay) 84%, transparent), rgba(255, 255, 255, 0.015)), rgba(255, 255, 255, 0.035)"
      borderRadius="18px"
      padding="14px 18px"
      minWidth="0px"
      maxWidth="100%"
      style={{
        width: "100%",
        minHeight: "88px",
        alignSelf: "stretch",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow:
          "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 30px rgba(0, 0, 0, 0.12)",
        backdropFilter: "blur(12px)",
      }}
      title={<span className="metric-pill-label">{label}</span>}
      titleStyle={{
        width: "100%",
      }}
      value={<strong className="metric-pill-value">{value}</strong>}
    />
  );
}
