import styles from "./ExpandButton.module.css";

type ExpandButtonProps = {
  selectedTitle?: string;
  isExpanded?: boolean;
  onOpenArticle: () => void;
  onExpand: () => void;
};

const ExpandButton = ({
  selectedTitle,
  isExpanded = false,
  onOpenArticle,
  onExpand,
}: ExpandButtonProps) => {
  const articleTitle = selectedTitle ?? "the selected node";
  const wikipediaTitle = `Open ${articleTitle} on Wikipedia in a new tab\n\nshortcut: w`;
  const expandTitle = `Expand ${articleTitle} and reveal related articles\n\nshortcut: e`;

  return (
    <div className={styles.root}>
      {isExpanded ? (
        <button
          type="button"
          className={styles.articleButton}
          onClick={onOpenArticle}
          aria-label="Open selected node on Wikipedia"
          title={wikipediaTitle}
        >
          Wikipedia
        </button>
      ) : (
        <div
          className={styles.buttonGroup}
          role="group"
          aria-label="Selected article actions"
        >
          <button
            type="button"
            className={styles.wikipediaButton}
            onClick={onOpenArticle}
            aria-label="Open selected node on Wikipedia"
            title={wikipediaTitle}
          >
            Wikipedia
          </button>
          <button
            type="button"
            className={styles.expandButton}
            onClick={onExpand}
            aria-label="Expand selected node"
            title={expandTitle}
          >
            Expand
          </button>
        </div>
      )}
    </div>
  );
};

export default ExpandButton;
