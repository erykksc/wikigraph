import { cn } from "../../cn";
import styles from "./IconToggleButton.module.css";

type FastForwardButtonProps = {
  assetBaseUrl: string;
  isActive: boolean;
  onFastForward: () => void;
};

const FastForwardButton = ({
  assetBaseUrl,
  isActive,
  onFastForward,
}: FastForwardButtonProps) => {
  return (
    <button
      type="button"
      className={cn(styles.root, isActive && styles.isActive)}
      onClick={onFastForward}
      title="Set layout slowdown to 0.01"
      aria-label="Enable fast forward"
      aria-pressed={isActive}
    >
      <img
        className={cn(styles.icon, !isActive && styles.isWhite)}
        src={`${assetBaseUrl}fast-forward.svg`}
        alt=""
        aria-hidden="true"
      />
    </button>
  );
};

export default FastForwardButton;
