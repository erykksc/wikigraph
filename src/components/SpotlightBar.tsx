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

type SpotlightBarProps = {
  isLoading: boolean;
  onSearch: () => void;
  onClose?: () => void;
};

const SpotlightBar = ({ isLoading, onSearch, onClose }: SpotlightBarProps) => {
  const seed = useAppStore((state) => state.seed);
  const querySource = useAppStore((state) => state.querySource);
  const setSeed = useAppStore((state) => state.setSeed);
  const setQuerySource = useAppStore((state) => state.setQuerySource);
  const seedInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const skipNextSuggestionFetchRef = useRef<string | null>(null);
  const latestRequestRef = useRef(0);
  const suggestionListId = useId();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] =
    useState(-1);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
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
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isSuggestionsOpen) {
          closeSuggestions();
          return;
        }

        onClose?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSuggestions, isSuggestionsOpen, onClose]);

  useEffect(() => {
    seedInputRef.current?.focus();
  }, []);

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    if (trimmedSeed.length < MIN_SUGGESTION_QUERY_LENGTH) {
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
  }, [closeSuggestions, querySource, trimmedSeed]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return (
    <div className={styles.card}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
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
  );
};

export default SpotlightBar;
