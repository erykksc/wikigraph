import styles from "./GraphCanvas.module.css";

type GraphCanvasProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
};

const GraphCanvas = ({ containerRef }: GraphCanvasProps) => {
  return <div className={styles.root} ref={containerRef} />;
};

export default GraphCanvas;
