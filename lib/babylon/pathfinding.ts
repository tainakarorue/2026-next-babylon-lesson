export interface GridNode {
  x: number
  z: number
  walkable: boolean
  g: number
  f: number
  h: number
  parent: GridNode | null
}

export class GridMap {
  private grid: GridNode[][] = []
  readonly size: number
  readonly offset: number

  constructor(size = 20) {
    this.size = size
    this.offset = Math.floor(size / 2)

    for (let z = 0; z < size; z++) {
      this.grid[z] = []
      for (let x = 0; x < size; x++) {
        this.grid[z][x] = {
          x,
          z,
          walkable: true,
          g: 0,
          h: 0,
          f: 0,
          parent: null,
        }
      }
    }
  }

  worldToGrid(
    wx: number,
    wz: number,
  ): {
    x: number
    z: number
  } {
    return {
      x: Math.round(wx) + this.offset,
      z: Math.round(wz) + this.offset,
    }
  }

  gridToWorld(
    x: number,
    z: number,
  ): {
    wx: number
    wz: number
  } {
    return {
      wx: x - this.offset,
      wz: z - this.offset,
    }
  }

  setWalkable(wx: number, wz: number, walkable: boolean): void {
    const { x, z } = this.worldToGrid(wx, wz)

    if (x >= 0 && x < this.size && z >= 0 && z < this.size) {
      this.grid[z][x].walkable = walkable
    }
  }

  findPath(
    swx: number,
    swz: number,
    ewx: number,
    ewz: number,
  ): Array<{ wx: number; wz: number }> {
    const sg = this.worldToGrid(swx, swz)

    const eg = this.worldToGrid(ewx, ewz)

    for (let z = 0; z < this.size; z++) {
      for (let x = 0; x < this.size; x++) {
        const n = this.grid[z][x]
        n.g = 0
        n.h = 0
        n.f = 0
        n.parent = null
      }
    }

    const startNode = this.grid[sg.z]?.[sg.x]
    const endNode = this.grid[eg.z]?.[eg.x]

    if (!startNode || !endNode || !endNode.walkable) return []

    const openSet: GridNode[] = [startNode]
    const closedSet = new Set<GridNode>()

    const DIRS = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 },
    ]

    while (openSet.length > 0) {
      let ci = 0
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[ci].f) ci = i
      }
      const cur = openSet[ci]

      if (cur === endNode) {
        const path: Array<{ wx: number; wz: number }> = []

        let n: GridNode | null = cur
        while (n) {
          path.unshift(this.gridToWorld(n.x, n.z))
          n = n.parent
        }
        return path
      }
      openSet.splice(ci, 1)
      closedSet.add(cur)

      for (const { dx, dz } of DIRS) {
        const nx = cur.x + dx
        const nz = cur.z + dz

        if (nx < 0 || nx >= this.size || nz < 0 || nz >= this.size) continue

        const nb = this.grid[nz][nx]
        if (!nb.walkable || closedSet.has(nb)) continue

        const tg = cur.g + 1
        if (!openSet.includes(nb)) openSet.push(nb)
        else if (tg >= nb.g) continue

        nb.parent = cur
        nb.g = tg
        nb.h = Math.abs(nb.x - endNode.x) + Math.abs(nb.z - endNode.z)
        nb.f = nb.g + nb.h
      }
    }
    return []
  }
}
