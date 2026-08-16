/**
 * Maximum-weight bipartite assignment (Hungarian / Kuhn-Munkres, O(n^3)).
 *
 * Used to pick a starting lineup. Greedy filling gets this wrong whenever flex
 * slots exist: taking the best player for the flex spot first can strand a
 * dedicated slot that only he was eligible for. The exact solution is cheap at
 * fantasy-roster sizes, so there is no reason to approximate.
 */

/** Weight used for a forbidden pairing. Large but finite — Infinity breaks the arithmetic. */
const FORBIDDEN = -1e9;

export interface AssignmentResult {
  /** assignment[row] = column assigned to that row, or -1 if unassigned. */
  rowToColumn: number[];
  /** Total weight of the chosen assignment, ignoring forbidden pairings. */
  totalWeight: number;
}

/**
 * Maximise total weight assigning each row to at most one distinct column.
 *
 * `weights[row][col]` may be `-Infinity` or any very negative number to mark a
 * pairing as illegal; such pairings are never selected unless nothing else is
 * available, and are reported as unassigned.
 *
 * Rows are the scarce side (lineup slots); there must be at least as many
 * columns as rows for every row to be filled.
 */
export function maxWeightAssignment(weights: number[][]): AssignmentResult {
  const n = weights.length;
  if (n === 0) return { rowToColumn: [], totalWeight: 0 };
  const m = weights[0]!.length;
  if (m === 0) return { rowToColumn: new Array(n).fill(-1), totalWeight: 0 };

  // The classic formulation minimises cost over a rectangular matrix with
  // rows <= cols, so convert weights to costs and pad columns if needed.
  const cols = Math.max(n, m);
  const cost: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      const w = j < m ? weights[i]![j]! : 0;
      const usable = Number.isFinite(w) ? w : FORBIDDEN;
      row.push(-Math.max(usable, FORBIDDEN));
    }
    cost.push(row);
  }

  const INF = Number.POSITIVE_INFINITY;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(cols + 1).fill(0);
  // p[j] = the row currently matched to column j (1-indexed; 0 = none).
  const p = new Array<number>(cols + 1).fill(0);
  const way = new Array<number>(cols + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(cols + 1).fill(INF);
    const used = new Array<boolean>(cols + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = INF;
      let j1 = 0;

      for (let j = 1; j <= cols; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }

      // A disconnected graph would leave delta infinite; padding prevents it.
      if (!Number.isFinite(delta)) break;

      for (let j = 0; j <= cols; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    // Walk the augmenting path back, flipping matches as we go.
    while (j0) {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    }
  }

  const rowToColumn = new Array<number>(n).fill(-1);
  for (let j = 1; j <= cols; j++) {
    const row = p[j]!;
    if (row > 0 && j - 1 < m) rowToColumn[row - 1] = j - 1;
  }

  // Drop any pairing the caller marked illegal rather than reporting it as a
  // real assignment.
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    const j = rowToColumn[i]!;
    if (j < 0) continue;
    const w = weights[i]![j]!;
    if (!Number.isFinite(w) || w <= FORBIDDEN) {
      rowToColumn[i] = -1;
      continue;
    }
    totalWeight += w;
  }

  return { rowToColumn, totalWeight };
}
