import { useEffect, useRef, useState } from "react";
import { WIKIPEDIA_LANGUAGES, type WikipediaLanguage } from "../api";
import { useAppStore } from "../store/useAppStore";

const resetInstructionsLayout = (
  setInstructionsMaxHeight: React.Dispatch<React.SetStateAction<number | null>>,
  setInstructionsNeedScroll: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  setInstructionsMaxHeight(null);
  setInstructionsNeedScroll(false);
};

type SpotlightBarProps = {
  open: boolean;
  hasGraph: boolean;
  isLoading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRequestClose: () => void;
};

const SpotlightBar = ({
  open,
  hasGraph,
  isLoading,
  onSubmit,
  onRequestClose,
}: SpotlightBarProps) => {
  const assetBaseUrl = import.meta.env.BASE_URL;
  const seed = useAppStore((state) => state.seed);
  const querySource = useAppStore((state) => state.querySource);
  const setSeed = useAppStore((state) => state.setSeed);
  const setQuerySource = useAppStore((state) => state.setQuerySource);
  const seedInputRef = useRef<HTMLInputElement | null>(null);
  const instructionsContentRef = useRef<HTMLDivElement | null>(null);
  const isEmptyState = !hasGraph;
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructionsMaxHeight, setInstructionsMaxHeight] = useState<
    number | null
  >(null);
  const [instructionsNeedScroll, setInstructionsNeedScroll] = useState(false);
  const effectiveInstructionsMaxHeight =
    isEmptyState && instructionsOpen ? instructionsMaxHeight : null;
  const effectiveInstructionsNeedScroll =
    isEmptyState && instructionsOpen ? instructionsNeedScroll : false;

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

  useEffect(() => {
    if (!isEmptyState || !instructionsOpen) {
      queueMicrotask(() => {
        resetInstructionsLayout(
          setInstructionsMaxHeight,
          setInstructionsNeedScroll,
        );
      });
      return;
    }

    const updateInstructionsHeight = () => {
      const content = instructionsContentRef.current;
      if (!content) return;

      if (!window.matchMedia("(max-width: 800px)").matches) {
        setInstructionsMaxHeight(null);
        setInstructionsNeedScroll(false);
        return;
      }

      content.style.maxHeight = "none";

      const rect = content.getBoundingClientRect();
      const availableHeight = Math.floor(window.innerHeight - rect.top - 12);
      const naturalHeight = content.scrollHeight;
      const needsScroll = naturalHeight > availableHeight;

      setInstructionsNeedScroll(needsScroll);
      setInstructionsMaxHeight(
        needsScroll ? Math.max(140, availableHeight) : null,
      );
    };

    const rafId = window.requestAnimationFrame(updateInstructionsHeight);
    window.addEventListener("resize", updateInstructionsHeight);
    window.visualViewport?.addEventListener("resize", updateInstructionsHeight);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateInstructionsHeight);
      window.visualViewport?.removeEventListener(
        "resize",
        updateInstructionsHeight,
      );
    };
  }, [instructionsOpen, isEmptyState]);

  if (!open) return null;

  return (
    <div
      className={`spotlight${isEmptyState ? " spotlight--empty" : ""}${
        effectiveInstructionsNeedScroll
          ? " spotlight--instructions-overflow"
          : ""
      }`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && hasGraph) {
          onRequestClose();
        }
      }}
    >
      {isEmptyState ? (
        <div className="spotlight__hero">
          <h1 className="spotlight__title">WikiGraph</h1>
          <a
            className="spotlight__subtitle"
            href="https://github.com/erykksc/wikigraph"
            target="_blank"
            rel="noreferrer"
          >
            By Eryk Kściuczyk
            <img
              className="spotlight__subtitle-icon"
              src={`${assetBaseUrl}GitHub_Invertocat_White.svg`}
              alt=""
              aria-hidden="true"
            />
          </a>
        </div>
      ) : null}
      <div className="spotlight__card">
        <form className="spotlight__form" onSubmit={onSubmit}>
          <div className="spotlight__row spotlight__row--wrap">
            <input
              ref={seedInputRef}
              type="text"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="Wikipedia article title e.g. Bytom or Graph theory"
            />
            <select
              value={querySource}
              onChange={(event) =>
                setQuerySource(event.target.value as WikipediaLanguage)
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
      {isEmptyState ? (
        <details className="spotlight__instructions" open={instructionsOpen}>
          <summary
            onClick={(event) => {
              event.preventDefault();
              setInstructionsOpen((current) => !current);
            }}
          >
            How WikiGraph works?
          </summary>
          <div
            ref={instructionsContentRef}
            className="spotlight__instructions-content"
            style={
              effectiveInstructionsMaxHeight === null
                ? undefined
                : { maxHeight: `${effectiveInstructionsMaxHeight}px` }
            }
          >
            <section className="spotlight__instructions-section">
              <h2>Getting Started</h2>
              <p>
                Enter a Wikipedia article title and click Grow Graph or press
                'enter'.
              </p>
            </section>

            <section className="spotlight__instructions-section">
              <h2>Exploring the Graph</h2>
              <p>
                Left click a blue node{" "}
                <span
                  className="spotlight__node-dot spotlight__node-dot--unexpanded"
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                to expand it and reveal related articles.
              </p>
              <p>
                Right click any node to open its Wikipedia article in a new tab.
              </p>
            </section>

            <section className="spotlight__instructions-section">
              <h2>Node Colors</h2>
              <p>
                <span
                  className="spotlight__node-dot spotlight__node-dot--unexpanded"
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                Blue nodes are unexpanded.
              </p>
              <p>
                <span
                  className="spotlight__node-dot spotlight__node-dot--expanded"
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                Green nodes are already expanded.
              </p>
            </section>

            <section className="spotlight__instructions-section">
              <h2>Shortcuts</h2>
              <p>
                <kbd>/</kbd> or <kbd>cmd</kbd>/<kbd>ctrl</kbd>+<kbd>k</kbd>{" "}
                opens search.
              </p>
              <p>
                <kbd>,</kbd> opens graph layout settings.
              </p>
              <p>
                <kbd>f</kbd> fits the graph, and <kbd>space</kbd> pauses or
                resumes the layout.
              </p>
            </section>
          </div>
        </details>
      ) : null}
    </div>
  );
};

export default SpotlightBar;
