import styles from "./LayoutResetButton.module.css";

type LayoutResetButtonProps = {
  assetBaseUrl: string;
  disabled: boolean;
  onReset: () => void;
};

const LayoutResetButton = ({
  assetBaseUrl,
  disabled,
  onReset,
}: LayoutResetButtonProps) => {
  return (
    <button
      type="button"
      className={styles.root}
      onClick={onReset}
      aria-label="Reset layout settings to default"
      title="Restore the layout controls to their default values"
      disabled={disabled}
    >
      <span>Reset to default</span>
      <img
        className={styles.icon}
        src={`${assetBaseUrl}reset.svg`}
        alt=""
        aria-hidden="true"
      />
    </button>
  );
};

export default LayoutResetButton;
