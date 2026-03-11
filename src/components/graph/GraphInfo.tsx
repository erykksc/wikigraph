import { useAppStore } from "../../store/useAppStore";
import styles from "./GraphInfo.module.css";

const GraphInfo = () => {
  const nodeCount = useAppStore((state) => state.nodeCount);
  const edgeCount = useAppStore((state) => state.edgeCount);

  return (
    <div className={styles.root}>
      <div className={styles.nodeCount}>
        <div>Nodes: {nodeCount}</div>
        <div>Edges: {edgeCount}</div>
      </div>
    </div>
  );
};

export default GraphInfo;
