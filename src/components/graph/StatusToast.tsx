import { useAppStore } from "../../store/useAppStore";

const StatusToast = () => {
  const { status, error, visible, fading } = useAppStore(
    (state) => state.toast,
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`status${error ? " status--error" : ""}${visible ? " status--visible" : ""}${fading ? " status--fading" : ""}`}
      aria-hidden={!visible}
    >
      <strong>{error ? "Error" : "Status"}</strong> · {error ?? status}
    </div>
  );
};

export default StatusToast;
