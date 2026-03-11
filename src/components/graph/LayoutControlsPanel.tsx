import { layoutControls } from "../../layout-config";
import { useAppStore } from "../../store/useAppStore";

type LayoutControlsPanelProps = {
  panelRef: React.RefObject<HTMLElement | null>;
  assetBaseUrl: string;
  onToggleOpen: () => void;
  onTogglePause: () => void;
  onReset: () => void;
};

const LayoutControlsPanel = ({
  panelRef,
  assetBaseUrl,
  onToggleOpen,
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
      className={`controls-panel${open ? "" : " controls-panel--collapsed"}`}
    >
      <div className="controls-panel__header">
        {open ? (
          <div className="controls-panel__title">Graph Layout Settings</div>
        ) : null}
        <button
          type="button"
          className="controls-panel__toggle controls-panel__toggle--pause"
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
            src={`${assetBaseUrl}${isPaused ? "play.svg" : "pause.svg"}`}
            alt=""
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          className="controls-panel__toggle controls-panel__toggle--settings"
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
          <img src={`${assetBaseUrl}cog.svg`} alt="" aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div
          className={`controls-panel__content${isPaused ? " controls-panel__content--disabled" : ""}`}
        >
          {isPaused ? (
            <div className="controls-panel__hint" role="status">
              Resume layout to edit settings.
            </div>
          ) : null}
          {layoutControls.map((control) => {
            if (control.type === "boolean") {
              const checked = Boolean(layoutSettings[control.key]);
              return (
                <label
                  className="toggle"
                  key={control.key}
                  title={control.description}
                >
                  <input
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
              <label
                className="slider"
                key={control.key}
                title={control.description}
              >
                <div>
                  <span>{control.label}</span>
                  <span className="slider__value">{value.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  disabled={isPaused}
                  onChange={(event) =>
                    setLayoutNumber(control.key, Number(event.target.value))
                  }
                />
              </label>
            );
          })}
          <button
            type="button"
            className="controls-panel__reset"
            onClick={onReset}
            aria-label="Reset layout settings to default"
            title="Restore the layout controls to their default values"
            disabled={isPaused}
          >
            <span>Reset to default</span>
            <img src={`${assetBaseUrl}reset.svg`} alt="" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </aside>
  );
};

export default LayoutControlsPanel;
