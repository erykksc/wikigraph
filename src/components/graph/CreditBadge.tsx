import styles from "./CreditBadge.module.css";

const CreditBadge = () => {
  return (
    <div className={styles.root}>
      <a
        href="https://github.com/erykksc/wikigraph"
        target="_blank"
        rel="noreferrer"
      >
        <strong>WikiGraph</strong>
        <br />
        by Eryk Kściuczyk
      </a>
    </div>
  );
};

export default CreditBadge;
