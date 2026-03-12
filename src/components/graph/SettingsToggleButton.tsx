import { cn } from "../../cn";
import styles from "./IconToggleButton.module.css";

type SettingsToggleButtonProps = {
  assetBaseUrl: string;
  open: boolean;
  onToggleOpen: () => void;
};

const SettingsToggleButton = ({
  assetBaseUrl,
  open,
  onToggleOpen,
}: SettingsToggleButtonProps) => {
  return (
    <button
      type="button"
      className={styles.root}
      onClick={onToggleOpen}
      title={
        open
          ? "Hide the graph layout controls\n\nshortcut: ,"
          : "Show the graph layout controls\n\nshortcut: ,"
      }
      aria-label={
        open ? "Close graph layout settings" : "Open graph layout settings"
      }
      aria-expanded={open}
    >
      <img
        className={cn(styles.icon, styles.isWhite)}
        src={`${assetBaseUrl}cog.svg`}
        alt=""
        aria-hidden="true"
      />
    </button>
  );
};

export default SettingsToggleButton;
