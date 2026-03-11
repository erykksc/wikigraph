import CircularButton from "../CircularButton";
import styles from "./GraphActions.module.css";

type GraphActionsProps = {
  onOpenSpotlight: () => void;
  onFitGraph: () => void;
  onResetGraph: () => void;
  disabled?: boolean;
};

const GraphActions = ({
  onOpenSpotlight,
  onFitGraph,
  onResetGraph,
  disabled = false,
}: GraphActionsProps) => {
  return (
    <div className={styles.root}>
      <CircularButton
        text="Search"
        className={styles.iconButton}
        onClick={onOpenSpotlight}
        ariaLabel="Open search"
        title={"Open the article search panel\n\nshortcut: / or cmd/ctrl+k"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15.7 15.7L20 20M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </CircularButton>
      <CircularButton
        text="Fit View"
        onClick={onFitGraph}
        ariaLabel="Fit graph to view"
        title={"Center and zoom the graph to fit the viewport\n\nshortcut: f"}
        disabled={disabled}
      />
      <CircularButton
        text="Reset"
        onClick={onResetGraph}
        ariaLabel="Reset graph"
        title="Clear the current graph and return to the search view"
        disabled={disabled}
      />
    </div>
  );
};

export default GraphActions;
