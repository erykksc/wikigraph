import { useAppStore } from "../../store/useAppStore";

const GraphInfo = () => {
  const nodeCount = useAppStore((state) => state.nodeCount);
  const edgeCount = useAppStore((state) => state.edgeCount);

  return (
    <div className="info-stack">
      <div className="node-count">
        <div>Nodes: {nodeCount}</div>
        <div>Edges: {edgeCount}</div>
      </div>
    </div>
  );
};

export default GraphInfo;
