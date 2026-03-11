import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  suggestTitles,
  WIKIPEDIA_LANGUAGES,
  type WikipediaLanguage,
} from "../api";
import { cn } from "../cn";
import { useAppStore } from "../store/useAppStore";
import styles from "./SpotlightBar.module.css";

const SUGGESTIONS_DEBOUNCE_MS = 350;
const MIN_SUGGESTION_QUERY_LENGTH = 2;

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const skipNextSuggestionFetchRef = useRef<string | null>(null);
  const latestRequestRef = useRef(0);
  const suggestionListId = useId();
  const isEmptyState = !hasGraph;
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructionsMaxHeight, setInstructionsMaxHeight] = useState<
    number | null
  >(null);
  const [instructionsNeedScroll, setInstructionsNeedScroll] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] =
    useState(-1);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const effectiveInstructionsMaxHeight =
    isEmptyState && instructionsOpen ? instructionsMaxHeight : null;
  const effectiveInstructionsNeedScroll =
    isEmptyState && instructionsOpen ? instructionsNeedScroll : false;
  const trimmedSeed = seed.trim();
  const shouldShowSuggestions =
    isSuggestionsOpen &&
    trimmedSeed.length >= MIN_SUGGESTION_QUERY_LENGTH &&
    (isSuggestionsLoading || suggestions.length > 0);

  const closeSuggestions = useCallback(() => {
    setIsSuggestionsOpen(false);
    setHighlightedSuggestionIndex(-1);
  }, []);

  const submitSuggestion = useCallback(
    (title: string) => {
      skipNextSuggestionFetchRef.current = title.trim();
      setSeed(title);
      setSuggestions([]);
      closeSuggestions();
      seedInputRef.current?.focus();
    },
    [closeSuggestions, setSeed],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isSuggestionsOpen) {
          closeSuggestions();
          return;
        }

        onRequestClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSuggestions, isSuggestionsOpen, onRequestClose, open]);

  useEffect(() => {
    if (open) {
      seedInputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    if (!open || trimmedSeed.length < MIN_SUGGESTION_QUERY_LENGTH) {
      setSuggestions([]);
      setIsSuggestionsLoading(false);
      closeSuggestions();
      return;
    }

    if (skipNextSuggestionFetchRef.current === trimmedSeed) {
      skipNextSuggestionFetchRef.current = null;
      setSuggestions([]);
      setIsSuggestionsLoading(false);
      closeSuggestions();
      return;
    }

    skipNextSuggestionFetchRef.current = null;

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setIsSuggestionsLoading(true);

    const timeoutId = window.setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const nextSuggestions = await suggestTitles(
          trimmedSeed,
          querySource,
          controller.signal,
        );

        if (latestRequestRef.current !== requestId) {
          return;
        }

        setSuggestions(nextSuggestions);
        setHighlightedSuggestionIndex(nextSuggestions.length > 0 ? 0 : -1);
        setIsSuggestionsOpen(document.activeElement === seedInputRef.current);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (latestRequestRef.current !== requestId) {
          return;
        }

        setSuggestions([]);
        setHighlightedSuggestionIndex(-1);
        setIsSuggestionsOpen(false);
      } finally {
        if (latestRequestRef.current === requestId) {
          setIsSuggestionsLoading(false);
        }
      }
    }, SUGGESTIONS_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [closeSuggestions, open, querySource, trimmedSeed]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
      className={cn(
        styles.root,
        effectiveInstructionsNeedScroll && styles.isOverflowing,
      )}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && hasGraph) {
          onRequestClose();
        }
      }}
    >
      {isEmptyState ? (
        <div className={styles.hero}>
          <h1 className={styles.title}>WikiGraph</h1>
          <a
            className={styles.subtitle}
            href="https://github.com/erykksc/wikigraph"
            target="_blank"
            rel="noreferrer"
          >
            By Eryk Kściuczyk
            <img
              className={styles.subtitleIcon}
              src={`${assetBaseUrl}GitHub_Invertocat_White.svg`}
              alt=""
              aria-hidden="true"
            />
          </a>
        </div>
      ) : null}
      <div className={styles.card}>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={cn(styles.row, styles.rowWrap)}>
            <div className={styles.inputGroup}>
              <input
                className={styles.input}
                ref={seedInputRef}
                type="text"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0 || isSuggestionsLoading) {
                    setIsSuggestionsOpen(true);
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    if (document.activeElement !== seedInputRef.current) {
                      closeSuggestions();
                    }
                  }, 0);
                }}
                onKeyDown={(event) => {
                  if (!shouldShowSuggestions || suggestions.length === 0) {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      closeSuggestions();
                    }
                    return;
                  }

                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightedSuggestionIndex((current) =>
                      current >= suggestions.length - 1 ? 0 : current + 1,
                    );
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightedSuggestionIndex((current) =>
                      current <= 0 ? suggestions.length - 1 : current - 1,
                    );
                    return;
                  }

                  if (event.key === "Enter") {
                    const highlightedSuggestion =
                      suggestions[highlightedSuggestionIndex];

                    if (highlightedSuggestion) {
                      event.preventDefault();
                      submitSuggestion(highlightedSuggestion);
                    }
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeSuggestions();
                  }
                }}
                placeholder="Wikipedia article title e.g. Bytom or Graph theory"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={shouldShowSuggestions}
                aria-controls={suggestionListId}
                aria-activedescendant={
                  highlightedSuggestionIndex >= 0
                    ? `${suggestionListId}-${highlightedSuggestionIndex}`
                    : undefined
                }
              />
              {shouldShowSuggestions ? (
                <div className={styles.suggestionsPanel}>
                  <ul
                    className={styles.suggestionsList}
                    id={suggestionListId}
                    role="listbox"
                  >
                    {isSuggestionsLoading ? (
                      <li className={styles.suggestionsStatus}>
                        Searching articles...
                      </li>
                    ) : null}
                    {suggestions.map((suggestion, index) => (
                      <li key={suggestion} role="presentation">
                        <button
                          type="button"
                          id={`${suggestionListId}-${index}`}
                          className={cn(
                            styles.suggestionButton,
                            index === highlightedSuggestionIndex &&
                              styles.isSuggestionActive,
                          )}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() =>
                            setHighlightedSuggestionIndex(index)
                          }
                          onClick={() => submitSuggestion(suggestion)}
                          role="option"
                          aria-selected={index === highlightedSuggestionIndex}
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <select
              className={styles.select}
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
          <div className={cn(styles.row, styles.rowCenter)}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Grow Graph"}
            </button>
          </div>
        </form>
      </div>
      {isEmptyState ? (
        <details className={styles.instructions} open={instructionsOpen}>
          <summary
            className={styles.instructionsSummary}
            onClick={(event) => {
              event.preventDefault();
              setInstructionsOpen((current) => !current);
            }}
          >
            How WikiGraph works?
          </summary>
          <div
            ref={instructionsContentRef}
            className={styles.instructionsContent}
            style={
              effectiveInstructionsMaxHeight === null
                ? undefined
                : { maxHeight: `${effectiveInstructionsMaxHeight}px` }
            }
          >
            <section className={styles.instructionsSection}>
              <h2>Getting Started</h2>
              <p>
                Enter a Wikipedia article title and click Grow Graph or press
                'enter'.
              </p>
            </section>

            <section className={styles.instructionsSection}>
              <h2>Exploring the Graph</h2>
              <p>
                Left click a blue node{" "}
                <span
                  className={cn(styles.nodeDot, styles.nodeDotUnexpanded)}
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

            <section className={styles.instructionsSection}>
              <h2>Node Colors</h2>
              <p>
                <span
                  className={cn(styles.nodeDot, styles.nodeDotUnexpanded)}
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                Blue nodes are unexpanded.
              </p>
              <p>
                <span
                  className={cn(styles.nodeDot, styles.nodeDotExpanded)}
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                Green nodes are already expanded.
              </p>
            </section>

            <section className={styles.instructionsSection}>
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
