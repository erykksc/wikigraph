import { useEffect, useRef } from "react";
import { WIKIPEDIA_LANGUAGES, type WikipediaLanguage } from "../api";

type SpotlightBarProps = {
  open: boolean;
  hasGraph: boolean;
  seed: string;
  querySource: WikipediaLanguage;
  isLoading: boolean;
  onSeedChange: (value: string) => void;
  onQuerySourceChange: (value: WikipediaLanguage) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRequestClose: () => void;
};

const SpotlightBar = ({
  open,
  hasGraph,
  seed,
  querySource,
  isLoading,
  onSeedChange,
  onQuerySourceChange,
  onSubmit,
  onRequestClose,
}: SpotlightBarProps) => {
  const seedInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onRequestClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onRequestClose, open]);

  useEffect(() => {
    if (open) {
      seedInputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="spotlight"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && hasGraph) {
          onRequestClose();
        }
      }}
    >
      <div className="spotlight__card">
        <form className="spotlight__form" onSubmit={onSubmit}>
          <div className="spotlight__row spotlight__row--wrap">
            <input
              ref={seedInputRef}
              type="text"
              value={seed}
              onChange={(event) => onSeedChange(event.target.value)}
              placeholder="Wikipedia article title e.g. Bytom or Graph theory"
            />
            <select
              value={querySource}
              onChange={(event) =>
                onQuerySourceChange(event.target.value as WikipediaLanguage)
              }
              aria-label="Query source"
            >
              {WIKIPEDIA_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.flag} {language.label} ({language.code}
                  .wikipedia.org)
                </option>
              ))}
            </select>
          </div>
          <div className="spotlight__row spotlight__row--center">
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Loading..." : "Grow Graph"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpotlightBar;
