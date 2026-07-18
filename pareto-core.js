(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ParetoCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VALID_DIRECTIONS = new Set([
    "top_left",
    "top_right",
    "bottom_left",
    "bottom_right",
  ]);

  function validateDirection(direction) {
    if (!VALID_DIRECTIONS.has(direction)) {
      throw new Error(`Direção de Pareto inválida: ${direction}`);
    }
  }

  function distancePointToRect(px, py, left, top, right, bottom) {
    const dx = Math.max(left - px, 0, px - right);
    const dy = Math.max(top - py, 0, py - bottom);
    return Math.hypot(dx, dy);
  }

  function estimateLabelWidth(label) {
    if (Number.isFinite(label.iconX)) {
      return Math.max(1, label.iconX - label.textX + 11);
    }

    return Math.max(1, String(label.name || "").length * 5.8);
  }

  function associationCost(label, point, offsetX, offsetY) {
    if (Array.isArray(label.line) && label.line.length === 4) {
      const [x1, y1, x2, y2] = label.line;
      const distance1 = Math.hypot(
        point.x - (x1 + offsetX),
        point.y - (y1 + offsetY),
      );
      const distance2 = Math.hypot(
        point.x - (x2 + offsetX),
        point.y - (y2 + offsetY),
      );

      // The guide line touches the edge of the corresponding point.
      const anchorError = Math.min(
        Math.abs(distance1 - point.radius),
        Math.abs(distance2 - point.radius),
      );
      return anchorError * 1000;
    }

    const textWidth = estimateLabelWidth(label);
    const left = label.textX + offsetX;
    const top = label.textY + offsetY;
    const right = left + textWidth;
    const bottom = top + 11;
    const distance = distancePointToRect(
      point.x,
      point.y,
      left,
      top,
      right,
      bottom,
    );

    // Labels without a guide line sit approximately 8 px from the point.
    return Math.abs(distance - 8);
  }

  function hungarian(cost) {
    if (!Array.isArray(cost) || cost.length === 0) {
      return [];
    }

    const originalRows = cost.length;
    const originalCols = cost[0].length;
    if (originalCols === 0) {
      return new Array(originalRows).fill(-1);
    }

    if (cost.some((row) => !Array.isArray(row) || row.length !== originalCols)) {
      throw new Error("Matriz de custos irregular.");
    }

    const transposed = originalRows > originalCols;
    let matrix = cost.map((row) => row.slice());
    let rows = originalRows;
    let cols = originalCols;

    if (transposed) {
      matrix = Array.from({ length: originalCols }, (_, rowIndex) =>
        Array.from({ length: originalRows }, (_, columnIndex) =>
          cost[columnIndex][rowIndex],
        ),
      );
      rows = originalCols;
      cols = originalRows;
    }

    const u = new Array(rows + 1).fill(0);
    const v = new Array(cols + 1).fill(0);
    const p = new Array(cols + 1).fill(0);
    const way = new Array(cols + 1).fill(0);

    for (let i = 1; i <= rows; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = new Array(cols + 1).fill(Number.POSITIVE_INFINITY);
      const used = new Array(cols + 1).fill(false);

      while (true) {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Number.POSITIVE_INFINITY;
        let j1 = 0;

        for (let j = 1; j <= cols; j += 1) {
          if (used[j]) {
            continue;
          }

          const current = matrix[i0 - 1][j - 1] - u[i0] - v[j];
          if (current < minv[j]) {
            minv[j] = current;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }

        for (let j = 0; j <= cols; j += 1) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }

        j0 = j1;
        if (p[j0] === 0) {
          break;
        }
      }

      while (true) {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
        if (j0 === 0) {
          break;
        }
      }
    }

    const assignment = new Array(rows).fill(-1);
    for (let j = 1; j <= cols; j += 1) {
      if (p[j] !== 0) {
        assignment[p[j] - 1] = j - 1;
      }
    }

    if (!transposed) {
      return assignment;
    }

    const inverse = new Array(originalRows).fill(-1);
    for (let transposedRow = 0; transposedRow < assignment.length; transposedRow += 1) {
      const transposedColumn = assignment[transposedRow];
      if (transposedColumn >= 0) {
        inverse[transposedColumn] = transposedRow;
      }
    }
    return inverse;
  }

  function associateLabelsToPoints(labels, points, offsetX = 0, offsetY = 0) {
    if (!labels.length) {
      throw new Error("Nenhuma label de modelo foi encontrada.");
    }
    if (!points.length) {
      throw new Error("Nenhum ponto do scatter plot foi encontrado.");
    }
    if (labels.length !== points.length) {
      throw new Error(
        `Foram encontradas ${labels.length} labels e ${points.length} pontos. ` +
          "O gráfico pode ainda estar carregando ou usar um formato diferente.",
      );
    }

    const costs = labels.map((label) =>
      points.map((point) => associationCost(label, point, offsetX, offsetY)),
    );
    const assignment = hungarian(costs);
    if (assignment.some((index) => index < 0)) {
      throw new Error("Não foi possível associar todas as labels aos pontos.");
    }

    const maxCost = Math.max(
      ...assignment.map((pointIndex, labelIndex) =>
        costs[labelIndex][pointIndex],
      ),
    );
    const nameByPoint = new Array(points.length);
    assignment.forEach((pointIndex, labelIndex) => {
      nameByPoint[pointIndex] = labels[labelIndex].name;
    });

    return { assignment, maxCost, nameByPoint };
  }

  function getParetoIndices(points, direction) {
    validateDirection(direction);

    const preferLeft = direction === "top_left" || direction === "bottom_left";
    const preferTop = direction === "top_left" || direction === "top_right";
    const transformed = points.map((point) => ({
      x: preferLeft ? point.x : -point.x,
      y: preferTop ? point.y : -point.y,
    }));
    const frontier = [];

    for (let index = 0; index < transformed.length; index += 1) {
      const point = transformed[index];
      let dominated = false;

      for (let otherIndex = 0; otherIndex < transformed.length; otherIndex += 1) {
        if (index === otherIndex) {
          continue;
        }

        const other = transformed[otherIndex];
        const noWorse = other.x <= point.x && other.y <= point.y;
        const strictlyBetter = other.x < point.x || other.y < point.y;
        if (noWorse && strictlyBetter) {
          dominated = true;
          break;
        }
      }

      if (!dominated) {
        frontier.push(index);
      }
    }

    return frontier;
  }

  function buildFrontier(points, nameByPoint, direction = "top_left") {
    validateDirection(direction);
    const frontierIndices = getParetoIndices(points, direction);
    const preferLeft = direction === "top_left" || direction === "bottom_left";
    const preferTop = direction === "top_left" || direction === "top_right";

    frontierIndices.sort((leftIndex, rightIndex) => {
      const leftPoint = points[leftIndex];
      const rightPoint = points[rightIndex];
      const primary = preferLeft
        ? leftPoint.x - rightPoint.x
        : rightPoint.x - leftPoint.x;
      if (primary !== 0) {
        return primary;
      }

      return preferTop
        ? leftPoint.y - rightPoint.y
        : rightPoint.y - leftPoint.y;
    });

    return frontierIndices.map((index) => ({
      index,
      name: nameByPoint[index] || `Ponto ${index + 1}`,
      point: points[index],
    }));
  }

  return {
    associateLabelsToPoints,
    buildFrontier,
    distancePointToRect,
    getParetoIndices,
    hungarian,
  };
});
