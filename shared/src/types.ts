export type ExpandNode = {
  id: number
  title: string
}

export type ExpandEdge = {
  fromNode: string
  targetNode: string
}

export type ExpandResponse = {
  newNodes: string[]
  newEdges: ExpandEdge[]
}
