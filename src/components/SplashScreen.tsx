import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { cn } from "../cn";
import AudioToggleButton from "./graph/AudioToggleButton";
import SpotlightBar from "./SpotlightBar";
import styles from "./SplashScreen.module.css";

const resetInstructionsLayout = (
  setInstructionsMaxHeight: Dispatch<SetStateAction<number | null>>,
  setInstructionsNeedScroll: Dispatch<SetStateAction<boolean>>,
) => {
  setInstructionsMaxHeight(null);
  setInstructionsNeedScroll(false);
};

type SplashScreenProps = {
  assetBaseUrl: string;
  isLoading: boolean;
  isAudioMuted: boolean;
  onSearch: () => void;
  onToggleAudioMuted: () => void;
};

const SplashScreen = ({
  assetBaseUrl,
  isLoading,
  isAudioMuted,
  onSearch,
  onToggleAudioMuted,
}: SplashScreenProps) => {
  const instructionsContentRef = useRef<HTMLDivElement | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructionsMaxHeight, setInstructionsMaxHeight] = useState<
    number | null
  >(null);
  const [instructionsNeedScroll, setInstructionsNeedScroll] = useState(false);

  useEffect(() => {
    if (!instructionsOpen) {
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

      content.style.maxHeight = "none";

      const rect = content.getBoundingClientRect();
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight;
      const availableHeight = Math.max(
        0,
        Math.floor(viewportHeight - rect.top - 12),
      );
      const naturalHeight = content.scrollHeight;
      const needsScroll = naturalHeight > availableHeight;

      setInstructionsNeedScroll(needsScroll);
      setInstructionsMaxHeight(needsScroll ? availableHeight : null);
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
  }, [instructionsOpen]);

  return (
    <div
      className={cn(
        styles.root,
        instructionsNeedScroll && styles.isOverflowing,
      )}
    >
      <div className={styles.layout}>
        <div className={styles.topActions}>
          <AudioToggleButton
            assetBaseUrl={assetBaseUrl}
            isAudioMuted={isAudioMuted}
            onToggleAudioMuted={onToggleAudioMuted}
          />
        </div>
        <div className={styles.center}>
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
          <SpotlightBar isLoading={isLoading} onSearch={onSearch} />
        </div>
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
              instructionsMaxHeight === null
                ? undefined
                : { maxHeight: `${instructionsMaxHeight}px` }
            }
          >
            <section className={styles.instructionsSection}>
              <h2>Getting Started</h2>
              <p>
                Enter a Wikipedia article title and click Grow Graph or press
                <kbd>enter</kbd>.
              </p>
            </section>

            <section className={styles.instructionsSection}>
              <h2>Exploring the Graph</h2>
              <p>
                Left click
                <img
                  className={styles.instructionIcon}
                  src={`${assetBaseUrl}mouse-click-left.svg`}
                  alt=""
                  aria-hidden="true"
                />
                any node{" "}
                <span
                  className={cn(styles.nodeDot, styles.nodeDotCool)}
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                to select it. Then use the Wikipedia or Expand button.
              </p>
              <p>
                Double click
                <img
                  className={styles.instructionIcon}
                  src={`${assetBaseUrl}mouse-click-left.svg`}
                  alt=""
                  aria-hidden="true"
                />
                <img
                  className={styles.instructionIcon}
                  src={`${assetBaseUrl}mouse-click-left.svg`}
                  alt=""
                  aria-hidden="true"
                />
                any unexpanded node to expand it immediately and reveal related
                articles.
              </p>
              <p>
                Right click
                <img
                  className={styles.instructionIcon}
                  src={`${assetBaseUrl}mouse-click-right.svg`}
                  alt=""
                  aria-hidden="true"
                />
                any node to open its Wikipedia article in a new tab.
              </p>
            </section>

            <section className={styles.instructionsSection}>
              <h2>Node Colors</h2>
              <p>
                <span
                  className={cn(styles.nodeDot, styles.nodeDotCool)}
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                <strong>Few neighbors</strong>: nodes start light blue when they
                only have a small number of connections.
              </p>
              <p>
                <span
                  className={cn(styles.nodeDot, styles.nodeDotMid)}
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                <strong>More neighbors</strong>: the color shifts through green
                as the node becomes more connected.
              </p>
              <p>
                <span
                  className={cn(styles.nodeDot, styles.nodeDotWarm)}
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                <strong>Many neighbors</strong>: highly connected nodes become
                yellow or amber.
              </p>
              <p>
                <span
                  className={cn(styles.nodeDot, styles.nodeDotExpanded)}
                  aria-hidden="true"
                >
                  {"\u2b24"}
                </span>{" "}
                <strong>Expanded nodes</strong>: dark purple means the node has
                already been expanded.
              </p>
            </section>

            <section className={styles.instructionsSection}>
              <h2>Shortcuts</h2>
              <p>
                <kbd>/</kbd> or <kbd>cmd</kbd>/<kbd>ctrl</kbd>+<kbd>k</kbd>
                opens search.
              </p>
              <p>
                <kbd>w</kbd> opens the selected node on Wikipedia, and{" "}
                <kbd>e</kbd>
                expands the selected unexpanded node.
              </p>
              <p>
                <kbd>,</kbd> opens graph layout settings.
              </p>
              <p>
                <kbd>m</kbd> mutes or unmutes app audio.
              </p>
              <p>
                <kbd>f</kbd> fits the graph, and <kbd>space</kbd> pauses or
                resumes the layout.
              </p>
              <p>
                <kbd>r</kbd> resets the graph.
              </p>
            </section>
          </div>
        </details>
      </div>
    </div>
  );
};

export default SplashScreen;
