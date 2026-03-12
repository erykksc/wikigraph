import CircularButton from "../CircularButton";
import styles from "./ExpandButton.module.css";

type ExpandButtonProps = {
  selectedTitle?: string;
  onExpand: () => void;
};

const ExpandButton = ({ selectedTitle, onExpand }: ExpandButtonProps) => {
  const title = `Expand ${selectedTitle ?? "the selected node"} and reveal related articles\n\nshortcut: e`;

  return (
    <div className={styles.root}>
      <CircularButton
        text="Expand"
        onClick={onExpand}
        ariaLabel="Expand selected node"
        title={title}
        className={styles.button}
        backgroundColor="linear-gradient(140deg, var(--accent), #f2a93b)"
        textColor="#241a00"
      />
    </div>
  );
};

export default ExpandButton;
