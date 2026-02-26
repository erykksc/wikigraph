export type ExpandNode = {
  id: number
  title: string
}

export type ExpandResponse = {
  node: ExpandNode
  outlinks: string[]
  inlinks: string[]
}
