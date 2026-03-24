export type Board = number[][];
export type Direction = "left" | "right" | "up" | "down";

export type MoveResult = {
  board: Board;
  moved: boolean;
  scoreGained: number;
};

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

function transpose(board: Board): Board {
  const result = cloneBoard(board);
  for (let row = 0; row < result.length; row++) {
    for (let col = 0; col < row; col++) {
      const rowData = result[row];
      const colData = result[col];
      if (!rowData || !colData) {
        continue;
      }
      const rowValue = rowData[col];
      const colValue = colData[row];
      if (rowValue === undefined || colValue === undefined) {
        continue;
      }
      rowData[col] = colValue;
      colData[row] = rowValue;
    }
  }
  return result;
}

function moveLeft(board: Board): MoveResult {
  const next = cloneBoard(board);
  let moved = false;
  let scoreGained = 0;

  for (let row = 0; row < 4; row++) {
    const gridRow = next[row] || [];
    let nums = gridRow.filter((x) => x !== 0);

    for (let i = 0; i < nums.length - 1; i++) {
      const currentValue = nums[i];
      const nextValue = nums[i + 1];
      if (currentValue !== undefined && currentValue === nextValue) {
        const mergedValue = currentValue * 2;
        nums[i] = mergedValue;
        scoreGained += mergedValue;
        nums[i + 1] = 0;
        moved = true;
      }
    }

    nums = nums.filter((x) => x !== 0);
    while (nums.length < 4) {
      nums.push(0);
    }

    if (nums.some((value, index) => value !== gridRow[index])) {
      moved = true;
    }

    next[row] = nums;
  }

  return { board: next, moved, scoreGained };
}

export function applyMove(board: Board, direction: Direction): MoveResult {
  if (direction === "left") {
    return moveLeft(board);
  }

  if (direction === "right") {
    const reversed = cloneBoard(board).map((row) => row.reverse());
    const moved = moveLeft(reversed);
    return {
      moved: moved.moved,
      scoreGained: moved.scoreGained,
      board: moved.board.map((row) => row.reverse()),
    };
  }

  if (direction === "up") {
    const moved = moveLeft(transpose(board));
    return {
      moved: moved.moved,
      scoreGained: moved.scoreGained,
      board: transpose(moved.board),
    };
  }

  const moved = moveLeft(transpose(board));
  const reversed = moved.board.map((row) => row.reverse());
  const restored = transpose(reversed).map((row) => row.reverse());
  return {
    moved: moved.moved,
    scoreGained: moved.scoreGained,
    board: restored,
  };
}

export function hasMovesAvailable(board: Board): boolean {
  for (let row = 0; row < 4; row++) {
    const gridRow = board[row] || [];
    for (let col = 0; col < 4; col++) {
      const value = gridRow[col] || 0;
      if (value === 0) {
        return true;
      }

      if (col < 3 && value === gridRow[col + 1]) {
        return true;
      }

      const nextRow = board[row + 1];
      if (row < 3 && value === (nextRow?.[col] || 0)) {
        return true;
      }
    }
  }

  return false;
}

export function addRandomTile(board: Board, rng: () => number = Math.random): Board {
  const next = cloneBoard(board);
  const emptyCells: Array<{ row: number; col: number }> = [];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((next[row]?.[col] || 0) === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length === 0) {
    return next;
  }

  const cell = emptyCells[Math.floor(rng() * emptyCells.length)];
  if (!cell) {
    return next;
  }

  const value = rng() < 0.9 ? 2 : 4;
  const rowData = next[cell.row];
  if (rowData) {
    rowData[cell.col] = value;
  }

  return next;
}

export function createInitialBoard(rng: () => number = Math.random): Board {
  const board: Board = Array(4)
    .fill(0)
    .map(() => Array(4).fill(0));
  return addRandomTile(addRandomTile(board, rng), rng);
}
