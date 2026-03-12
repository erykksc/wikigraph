import { cn } from "../../cn";
import styles from "./IconToggleButton.module.css";

type PauseToggleButtonProps = {
  assetBaseUrl: string;
  isPaused: boolean;
  onTogglePause: () => void;
};

const PauseToggleButton = ({
  assetBaseUrl,
  isPaused,
  onTogglePause,
}: PauseToggleButtonProps) => {
  return (
    <button
      type="button"
      className={styles.root}
      onClick={onTogglePause}
      title={
        isPaused
          ? "Resume the graph layout simulation\n\nshortcut: space"
          : "Pause the graph layout simulation\n\nshortcut: space"
      }
      aria-label={isPaused ? "Resume graph layout" : "Pause graph layout"}
      aria-pressed={isPaused}
    >
      <img
        className={cn(styles.icon, styles.isWhite, styles.isCompact)}
        src={`${assetBaseUrl}${isPaused ? "play.svg" : "pause.svg"}`}
        alt=""
        aria-hidden="true"
      />
    </button>
  );
};

export default PauseToggleButton;
