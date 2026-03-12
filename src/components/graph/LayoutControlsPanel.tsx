import { cn } from "../../cn";
import { layoutControls } from "../../layout-config";
import { useAppStore } from "../../store/useAppStore";
import AudioToggleButton from "./AudioToggleButton";
import LayoutNumberControl from "./LayoutNumberControl";
import LayoutResetButton from "./LayoutResetButton";
import PauseToggleButton from "./PauseToggleButton";
import SettingsToggleButton from "./SettingsToggleButton";
import styles from "./LayoutControlsPanel.module.css";

type LayoutControlsPanelProps = {
  panelRef: React.RefObject<HTMLElement | null>;
  assetBaseUrl: string;
  isAudioMuted: boolean;
  onToggleOpen: () => void;
  onToggleAudioMuted: () => void;
  onTogglePause: () => void;
  onReset: () => void;
};

const LayoutControlsPanel = ({
  panelRef,
  assetBaseUrl,
  isAudioMuted,
  onToggleOpen,
  onToggleAudioMuted,
  onTogglePause,
  onReset,
}: LayoutControlsPanelProps) => {
  const open = useAppStore((state) => state.controlsOpen);
  const isPaused = useAppStore((state) => state.isPaused);
  const layoutSettings = useAppStore((state) => state.layoutSettings);
  const setLayoutBoolean = useAppStore((state) => state.setLayoutBoolean);
  const setLayoutNumber = useAppStore((state) => state.setLayoutNumber);

  return (
    <aside
      ref={panelRef}
      className={cn(styles.root, !open && styles.isCollapsed)}
    >
      <div className={styles.header}>
        {open ? (
          <div className={styles.title}>Graph Layout Settings</div>
        ) : null}
        <div className={styles.headerActions}>
          <AudioToggleButton
            assetBaseUrl={assetBaseUrl}
            isAudioMuted={isAudioMuted}
            onToggleAudioMuted={onToggleAudioMuted}
          />
          <PauseToggleButton
            assetBaseUrl={assetBaseUrl}
            isPaused={isPaused}
            onTogglePause={onTogglePause}
          />
          <SettingsToggleButton
            assetBaseUrl={assetBaseUrl}
            open={open}
            onToggleOpen={onToggleOpen}
          />
        </div>
      </div>
      {open ? (
        <div className={cn(styles.content, isPaused && styles.isPaused)}>
          {isPaused ? (
            <div className={styles.hint} role="status">
              Resume layout to edit settings.
            </div>
          ) : null}
          {layoutControls.map((control) => {
            if (control.type === "boolean") {
              const checked = Boolean(layoutSettings[control.key]);
              return (
                <label
                  className={styles.booleanControl}
                  key={control.key}
                  title={control.description}
                >
                  <input
                    className={styles.booleanInput}
                    type="checkbox"
                    checked={checked}
                    disabled={isPaused}
                    onChange={(event) =>
                      setLayoutBoolean(control.key, event.target.checked)
                    }
                  />
                  <span>{control.label}</span>
                </label>
              );
            }

            const value = Number(layoutSettings[control.key] ?? 0);
            return (
              <LayoutNumberControl
                key={control.key}
                label={control.label}
                description={control.description}
                min={control.min ?? 0}
                max={control.max ?? 0}
                step={control.step ?? 1}
                value={value}
                disabled={isPaused}
                onChange={(nextValue) =>
                  setLayoutNumber(control.key, nextValue)
                }
              />
            );
          })}
          <LayoutResetButton
            assetBaseUrl={assetBaseUrl}
            disabled={isPaused}
            onReset={onReset}
          />
        </div>
      ) : null}
    </aside>
  );
};

export default LayoutControlsPanel;
