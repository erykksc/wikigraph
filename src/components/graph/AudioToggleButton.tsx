import { cn } from "../../cn";
import styles from "./IconToggleButton.module.css";

type AudioToggleButtonProps = {
  assetBaseUrl: string;
  isAudioMuted: boolean;
  onToggleAudioMuted: () => void;
  className?: string;
};

const AudioToggleButton = ({
  assetBaseUrl,
  isAudioMuted,
  onToggleAudioMuted,
  className,
}: AudioToggleButtonProps) => {
  return (
    <button
      type="button"
      className={cn(styles.root, className)}
      onClick={onToggleAudioMuted}
      title={
        isAudioMuted
          ? "Unmute app audio\nMusic: Space Ambient by playstarz_music\n\nshortcut: m"
          : "Mute app audio\n\nMusic: Space Ambient by playstarz_music\n\nshortcut: m"
      }
      aria-label={isAudioMuted ? "Unmute app audio" : "Mute app audio"}
      aria-pressed={isAudioMuted}
    >
      <img
        className={styles.icon}
        src={`${assetBaseUrl}${isAudioMuted ? "speaker-off.svg" : "speaker-on.svg"}`}
        alt=""
        aria-hidden="true"
      />
    </button>
  );
};

export default AudioToggleButton;
