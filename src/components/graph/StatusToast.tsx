import { cn } from "../../cn";
import { useAppStore } from "../../store/useAppStore";
import styles from "./StatusToast.module.css";

const StatusToast = () => {
  const { status, error, visible, fading } = useAppStore(
    (state) => state.toast,
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        styles.root,
        error && styles.isError,
        visible && styles.isVisible,
        fading && styles.isFading,
      )}
      aria-hidden={!visible}
    >
      <strong>{error ? "Error" : "Status"}</strong> · {error ?? status}
    </div>
  );
};

export default StatusToast;
