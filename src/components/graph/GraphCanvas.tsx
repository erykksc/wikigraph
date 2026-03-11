type GraphCanvasProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
};

const GraphCanvas = ({ containerRef }: GraphCanvasProps) => {
  return <div className="graph-container" ref={containerRef} />;
};

export default GraphCanvas;
