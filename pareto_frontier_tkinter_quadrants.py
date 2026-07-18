from __future__ import annotations

import html
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk


@dataclass(frozen=True)
class Point:
    x: float
    y: float
    radius: float = 6.0


@dataclass
class Label:
    name: str
    text_x: float
    text_y: float
    line: tuple[float, float, float, float] | None = None
    icon_x: float | None = None


@dataclass(frozen=True)
class ParetoItem:
    name: str
    point: Point


class ChartParser:
    """Extrai labels e pontos de um scatter chart Recharts copiado como HTML/SVG."""

    LABEL_CONTAINER_RE = re.compile(
        r'<g transform="translate\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)"'
        r' pointer-events="none" aria-hidden="true"><g opacity="1">'
    )
    SCATTER_RE = re.compile(
        r'<g class="recharts-layer recharts-scatter"[^>]*>'
    )
    LABEL_SPLIT = '<g opacity="1">'

    def parse(
        self,
        raw: str,
        quadrant: str = "top_left",
    ) -> tuple[list[ParetoItem], list[Point], dict[int, str], float]:
        labels, points, offset_x, offset_y = self._extract(raw)

        if not labels:
            raise ValueError("Nenhuma label de modelo foi encontrada.")
        if not points:
            raise ValueError("Nenhum ponto do scatter plot foi encontrado.")
        if len(labels) != len(points):
            raise ValueError(
                f"Foram encontradas {len(labels)} labels e {len(points)} pontos. "
                "Este arquivo não parece seguir o mesmo formato do gráfico esperado."
            )

        assignment, max_cost = self._associate(labels, points, offset_x, offset_y)
        name_by_point = {
            point_index: labels[label_index].name
            for label_index, point_index in enumerate(assignment)
        }

        frontier = self.build_frontier(points, name_by_point, quadrant)
        return frontier, points, name_by_point, max_cost

    def build_frontier(
        self,
        points: list[Point],
        name_by_point: dict[int, str],
        quadrant: str,
    ) -> list[ParetoItem]:
        frontier_indices = self._pareto_frontier(points, quadrant)

        prefer_left = quadrant in {"top_left", "bottom_left"}
        prefer_top = quadrant in {"top_left", "top_right"}

        frontier_indices.sort(
            key=lambda index: (
                points[index].x if prefer_left else -points[index].x,
                points[index].y if prefer_top else -points[index].y,
            )
        )

        return [
            ParetoItem(name=name_by_point[index], point=points[index])
            for index in frontier_indices
        ]

    def _extract(
        self, raw: str
    ) -> tuple[list[Label], list[Point], float, float]:
        scatter_match = self.SCATTER_RE.search(raw)
        if not scatter_match:
            raise ValueError(
                'Não encontrei um elemento "recharts-layer recharts-scatter".'
            )

        before_scatter = raw[: scatter_match.start()]
        containers = list(self.LABEL_CONTAINER_RE.finditer(before_scatter))
        if not containers:
            raise ValueError("Não encontrei o bloco de labels do gráfico.")

        # Escolhe o container de labels que realmente contém o maior número de labels.
        candidates: list[tuple[int, re.Match[str], list[Label]]] = []
        for match in containers:
            block = raw[match.start() : scatter_match.start()]
            parsed = self._parse_labels(block)
            candidates.append((len(parsed), match, parsed))

        _, container_match, labels = max(candidates, key=lambda item: item[0])
        offset_x = float(container_match.group(1))
        offset_y = float(container_match.group(2))

        scatter_block = raw[scatter_match.start() :]
        points = self._parse_points(scatter_block)
        return labels, points, offset_x, offset_y

    def _parse_labels(self, block: str) -> list[Label]:
        labels: list[Label] = []

        for segment in block.split(self.LABEL_SPLIT)[1:]:
            text_match = re.search(
                r'<text\b[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*>(.*?)</text>',
                segment,
                flags=re.DOTALL,
            )
            if not text_match:
                continue

            name = html.unescape(re.sub(r"<[^>]+>", "", text_match.group(3))).strip()
            if not name:
                continue

            line_match = re.search(
                r'<line\b[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"'
                r'[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"',
                segment,
            )
            line = (
                tuple(float(value) for value in line_match.groups())
                if line_match
                else None
            )

            icon_match = re.search(
                r'<g transform="translate\(([-+]?\d*\.?\d+),\s*'
                r'([-+]?\d*\.?\d+)\)"',
                segment[text_match.end() :],
            )

            labels.append(
                Label(
                    name=name,
                    text_x=float(text_match.group(1)),
                    text_y=float(text_match.group(2)),
                    line=line,  # type: ignore[arg-type]
                    icon_x=float(icon_match.group(1)) if icon_match else None,
                )
            )

        return labels

    def _parse_points(self, scatter_block: str) -> list[Point]:
        points: list[Point] = []

        symbol_segments = re.findall(
            r'<g class="recharts-layer recharts-scatter-symbol">(.*?)</circle>',
            scatter_block,
            flags=re.DOTALL,
        )

        for segment in symbol_segments:
            circle_match = re.search(r"<circle\b([^>]*)>", segment)
            if not circle_match:
                continue

            attributes = dict(
                re.findall(r'([:\w-]+)="([^"]*)"', circle_match.group(1))
            )
            try:
                points.append(
                    Point(
                        x=float(attributes["cx"]),
                        y=float(attributes["cy"]),
                        radius=float(attributes.get("r", "6")),
                    )
                )
            except (KeyError, ValueError):
                continue

        return points

    def _associate(
        self,
        labels: list[Label],
        points: list[Point],
        offset_x: float,
        offset_y: float,
    ) -> tuple[list[int], float]:
        costs = [
            [
                self._association_cost(label, point, offset_x, offset_y)
                for point in points
            ]
            for label in labels
        ]

        assignment = hungarian(costs)
        if any(index < 0 for index in assignment):
            raise ValueError("Não foi possível associar todas as labels aos pontos.")

        max_cost = max(
            costs[label_index][point_index]
            for label_index, point_index in enumerate(assignment)
        )
        return assignment, max_cost

    def _association_cost(
        self,
        label: Label,
        point: Point,
        offset_x: float,
        offset_y: float,
    ) -> float:
        if label.line is not None:
            x1, y1, x2, y2 = label.line
            endpoint_1 = (x1 + offset_x, y1 + offset_y)
            endpoint_2 = (x2 + offset_x, y2 + offset_y)

            distance_1 = math.hypot(
                point.x - endpoint_1[0], point.y - endpoint_1[1]
            )
            distance_2 = math.hypot(
                point.x - endpoint_2[0], point.y - endpoint_2[1]
            )

            # A linha-guia encosta na borda do círculo.
            anchor_error = min(
                abs(distance_1 - point.radius),
                abs(distance_2 - point.radius),
            )
            return anchor_error * 1000.0

        text_width = self._estimate_label_width(label)
        left = label.text_x + offset_x
        top = label.text_y + offset_y
        right = left + text_width
        bottom = top + 11.0

        distance = distance_point_to_rect(
            point.x, point.y, left, top, right, bottom
        )

        # No layout original, labels sem linha-guia ficam a ~8 px do ponto.
        return abs(distance - 8.0)

    @staticmethod
    def _estimate_label_width(label: Label) -> float:
        if label.icon_x is not None:
            # Ícone de reasoning tem 11 px e aparece imediatamente após o texto.
            return max(1.0, label.icon_x - label.text_x + 11.0)

        # Aproximação suficiente para o font-size 11 usado pelo gráfico.
        return max(1.0, len(label.name) * 5.8)

    @staticmethod
    def _pareto_frontier(points: list[Point], quadrant: str) -> list[int]:
        """Calcula Pareto usando a direção visual escolhida no scatter plot."""
        valid_quadrants = {
            "top_left",
            "top_right",
            "bottom_left",
            "bottom_right",
        }
        if quadrant not in valid_quadrants:
            raise ValueError(f"Quadrante inválido: {quadrant}")

        prefer_left = quadrant in {"top_left", "bottom_left"}
        prefer_top = quadrant in {"top_left", "top_right"}

        def transformed(point: Point) -> tuple[float, float]:
            x = point.x if prefer_left else -point.x
            y = point.y if prefer_top else -point.y
            return x, y

        transformed_points = [transformed(point) for point in points]
        frontier: list[int] = []

        for index, (x, y) in enumerate(transformed_points):
            dominated = False

            for other_index, (other_x, other_y) in enumerate(transformed_points):
                if index == other_index:
                    continue

                no_worse = other_x <= x and other_y <= y
                strictly_better = other_x < x or other_y < y

                if no_worse and strictly_better:
                    dominated = True
                    break

            if not dominated:
                frontier.append(index)

        return frontier


def distance_point_to_rect(
    px: float,
    py: float,
    left: float,
    top: float,
    right: float,
    bottom: float,
) -> float:
    dx = max(left - px, 0.0, px - right)
    dy = max(top - py, 0.0, py - bottom)
    return math.hypot(dx, dy)


def hungarian(cost: list[list[float]]) -> list[int]:
    """Algoritmo Húngaro de custo mínimo. Retorna coluna atribuída a cada linha."""
    if not cost:
        return []

    rows = len(cost)
    cols = len(cost[0])

    if any(len(row) != cols for row in cost):
        raise ValueError("Matriz de custos irregular.")

    transposed = rows > cols
    matrix = [list(row) for row in cost]

    if transposed:
        matrix = [list(row) for row in zip(*matrix)]
        rows, cols = cols, rows

    u = [0.0] * (rows + 1)
    v = [0.0] * (cols + 1)
    p = [0] * (cols + 1)
    way = [0] * (cols + 1)

    for i in range(1, rows + 1):
        p[0] = i
        j0 = 0
        minv = [float("inf")] * (cols + 1)
        used = [False] * (cols + 1)

        while True:
            used[j0] = True
            i0 = p[j0]
            delta = float("inf")
            j1 = 0

            for j in range(1, cols + 1):
                if used[j]:
                    continue

                current = matrix[i0 - 1][j - 1] - u[i0] - v[j]

                if current < minv[j]:
                    minv[j] = current
                    way[j] = j0

                if minv[j] < delta:
                    delta = minv[j]
                    j1 = j

            for j in range(cols + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta

            j0 = j1
            if p[j0] == 0:
                break

        while True:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
            if j0 == 0:
                break

    assignment = [-1] * rows
    for j in range(1, cols + 1):
        if p[j] != 0:
            assignment[p[j] - 1] = j - 1

    if not transposed:
        return assignment

    inverse = [-1] * cols
    for transposed_row, transposed_col in enumerate(assignment):
        if transposed_col >= 0:
            inverse[transposed_col] = transposed_row
    return inverse


class ParetoApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()

        self.title("Pareto Frontier Extractor — AA Charts")
        self.geometry("1040x650")
        self.minsize(820, 520)

        self.parser = ChartParser()
        self.frontier: list[ParetoItem] = []
        self.points: list[Point] = []
        self.name_by_point: dict[int, str] = {}
        self.current_file: Path | None = None
        self.current_source_name = "Nenhuma fonte"

        self._build_ui()

        if len(sys.argv) > 1:
            initial_file = Path(sys.argv[1])
            if initial_file.is_file():
                self.after(100, lambda: self.load_file(initial_file))

    def _build_ui(self) -> None:
        toolbar = ttk.Frame(self, padding=(12, 10))
        toolbar.pack(fill=tk.X)

        ttk.Button(
            toolbar, text="Carregar arquivo", command=self.choose_file
        ).pack(side=tk.LEFT)

        ttk.Button(
            toolbar,
            text="Colar do clipboard",
            command=self.paste_from_clipboard,
        ).pack(side=tk.LEFT, padx=(8, 0))

        ttk.Button(
            toolbar,
            text="Processar texto",
            command=self.process_pasted_content,
        ).pack(side=tk.LEFT, padx=(8, 0))

        ttk.Label(toolbar, text="Fronteira:").pack(side=tk.LEFT, padx=(16, 4))

        self.quadrant_var = tk.StringVar(value="Topo esquerdo")
        self.quadrant_selector = ttk.Combobox(
            toolbar,
            textvariable=self.quadrant_var,
            values=(
                "Topo esquerdo",
                "Topo direito",
                "Bottom esquerdo",
                "Bottom direito",
            ),
            state="readonly",
            width=17,
        )
        self.quadrant_selector.pack(side=tk.LEFT)
        self.quadrant_selector.bind(
            "<<ComboboxSelected>>",
            self.on_quadrant_changed,
        )

        self.copy_button = ttk.Button(
            toolbar,
            text="Copiar lista",
            command=self.copy_frontier,
            state=tk.DISABLED,
        )
        self.copy_button.pack(side=tk.LEFT, padx=(8, 0))

        self.export_button = ttk.Button(
            toolbar,
            text="Exportar TXT",
            command=self.export_frontier,
            state=tk.DISABLED,
        )
        self.export_button.pack(side=tk.LEFT, padx=(8, 0))

        self.file_label = ttk.Label(toolbar, text="Nenhum arquivo carregado")
        self.file_label.pack(side=tk.LEFT, padx=(16, 0))

        main_pane = ttk.Panedwindow(self, orient=tk.VERTICAL)
        main_pane.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 8))

        paste_frame = ttk.Frame(main_pane)
        results_frame = ttk.Frame(main_pane)
        main_pane.add(paste_frame, weight=1)
        main_pane.add(results_frame, weight=3)

        ttk.Label(
            paste_frame,
            text="Conteúdo HTML/SVG",
            font=("", 12, "bold"),
        ).pack(anchor=tk.W, pady=(0, 8))

        paste_container = ttk.Frame(paste_frame)
        paste_container.pack(fill=tk.BOTH, expand=True)

        self.input_text = tk.Text(
            paste_container,
            wrap=tk.NONE,
            height=8,
            undo=True,
        )
        input_y_scroll = ttk.Scrollbar(
            paste_container,
            orient=tk.VERTICAL,
            command=self.input_text.yview,
        )
        input_x_scroll = ttk.Scrollbar(
            paste_container,
            orient=tk.HORIZONTAL,
            command=self.input_text.xview,
        )
        self.input_text.configure(
            yscrollcommand=input_y_scroll.set,
            xscrollcommand=input_x_scroll.set,
        )

        self.input_text.grid(row=0, column=0, sticky="nsew")
        input_y_scroll.grid(row=0, column=1, sticky="ns")
        input_x_scroll.grid(row=1, column=0, sticky="ew")
        paste_container.rowconfigure(0, weight=1)
        paste_container.columnconfigure(0, weight=1)

        pane = ttk.Panedwindow(results_frame, orient=tk.HORIZONTAL)
        pane.pack(fill=tk.BOTH, expand=True)

        list_frame = ttk.Frame(pane)
        chart_frame = ttk.Frame(pane)
        pane.add(list_frame, weight=1)
        pane.add(chart_frame, weight=2)

        ttk.Label(
            list_frame,
            text="Fronteira de Pareto",
            font=("", 12, "bold"),
        ).pack(anchor=tk.W, pady=(0, 8))

        tree_container = ttk.Frame(list_frame)
        tree_container.pack(fill=tk.BOTH, expand=True)

        self.tree = ttk.Treeview(
            tree_container,
            columns=("rank", "model"),
            show="headings",
            selectmode="browse",
        )
        self.tree.heading("rank", text="#")
        self.tree.heading("model", text="Modelo")
        self.tree.column("rank", width=42, minwidth=42, stretch=False, anchor=tk.CENTER)
        self.tree.column("model", width=300, minwidth=180, stretch=True)

        scrollbar = ttk.Scrollbar(
            tree_container, orient=tk.VERTICAL, command=self.tree.yview
        )
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        ttk.Label(
            chart_frame,
            text="Pontos extraídos do SVG",
            font=("", 12, "bold"),
        ).pack(anchor=tk.W, pady=(0, 8))

        self.canvas = tk.Canvas(
            chart_frame,
            background="white",
            highlightthickness=1,
            highlightbackground="#d0d0d0",
        )
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<Configure>", lambda _event: self.draw_chart())

        self.status_var = tk.StringVar(value="Cole o conteúdo HTML/SVG ou carregue um arquivo.")
        ttk.Label(
            self,
            textvariable=self.status_var,
            relief=tk.SUNKEN,
            anchor=tk.W,
            padding=(8, 5),
        ).pack(fill=tk.X, side=tk.BOTTOM)

    def choose_file(self) -> None:
        filename = filedialog.askopenfilename(
            title="Selecionar HTML/SVG copiado do gráfico",
            filetypes=[
                ("Texto ou HTML", "*.txt *.html *.htm"),
                ("Todos os arquivos", "*.*"),
            ],
        )
        if filename:
            self.load_file(Path(filename))

    def paste_from_clipboard(self) -> None:
        try:
            raw = self.clipboard_get()
        except tk.TclError:
            messagebox.showwarning(
                "Clipboard vazio",
                "Não foi possível obter texto da área de transferência.",
            )
            return

        self.input_text.delete("1.0", tk.END)
        self.input_text.insert("1.0", raw)
        self.status_var.set(
            f"{len(raw):,} caracteres colados da área de transferência."
        )

    def process_pasted_content(self) -> None:
        raw = self.input_text.get("1.0", tk.END).strip()
        if not raw:
            messagebox.showwarning(
                "Conteúdo vazio",
                "Cole o conteúdo HTML/SVG no campo antes de processar.",
            )
            return

        self.process_content(raw, source_name="Conteúdo colado", source_path=None)

    def load_file(self, path: Path) -> None:
        try:
            raw = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            messagebox.showerror("Falha ao ler arquivo", str(exc))
            self.status_var.set("Falha ao ler o arquivo.")
            return

        self.input_text.delete("1.0", tk.END)
        self.input_text.insert("1.0", raw)
        self.process_content(raw, source_name=path.name, source_path=path)

    def process_content(
        self,
        raw: str,
        source_name: str,
        source_path: Path | None,
    ) -> None:
        try:
            frontier, points, name_by_point, max_cost = self.parser.parse(
                raw,
                self.current_quadrant_key(),
            )
        except Exception as exc:
            messagebox.showerror("Falha ao processar conteúdo", str(exc))
            self.status_var.set("Falha ao processar o conteúdo.")
            return

        self.current_file = source_path
        self.current_source_name = source_name
        self.frontier = frontier
        self.points = points
        self.name_by_point = name_by_point

        self.file_label.configure(text=source_name)
        self._fill_tree()
        self.draw_chart()

        self.copy_button.configure(state=tk.NORMAL)
        self.export_button.configure(state=tk.NORMAL)

        confidence = (
            "associação geométrica consistente"
            if max_cost < 3.0
            else f"verifique o resultado; custo geométrico máx. = {max_cost:.2f}"
        )
        self.status_var.set(
            f"{len(points)} pontos lidos · {len(frontier)} modelos na fronteira · "
            f"{self.quadrant_var.get()} · {confidence}"
        )

    def current_quadrant_key(self) -> str:
        quadrants = {
            "Topo esquerdo": "top_left",
            "Topo direito": "top_right",
            "Bottom esquerdo": "bottom_left",
            "Bottom direito": "bottom_right",
        }
        return quadrants[self.quadrant_var.get()]

    def on_quadrant_changed(self, _event: tk.Event | None = None) -> None:
        if not self.points or not self.name_by_point:
            self.status_var.set(
                f"Quadrante selecionado: {self.quadrant_var.get()}. "
                "Cole ou carregue dados para calcular a fronteira."
            )
            return

        self.frontier = self.parser.build_frontier(
            self.points,
            self.name_by_point,
            self.current_quadrant_key(),
        )
        self._fill_tree()
        self.draw_chart()
        self.status_var.set(
            f"{len(self.points)} pontos lidos · {len(self.frontier)} modelos na fronteira · "
            f"{self.quadrant_var.get()}"
        )

    def _fill_tree(self) -> None:
        for item in self.tree.get_children():
            self.tree.delete(item)

        for rank, item in enumerate(self.frontier, start=1):
            self.tree.insert("", tk.END, values=(rank, item.name))

    def frontier_text(self) -> str:
        return "\n".join(
            f"{rank}. {item.name}"
            for rank, item in enumerate(self.frontier, start=1)
        )

    def copy_frontier(self) -> None:
        text = self.frontier_text()
        self.clipboard_clear()
        self.clipboard_append(text)
        self.update()
        self.status_var.set(
            f"{len(self.frontier)} modelos copiados para a área de transferência."
        )

    def export_frontier(self) -> None:
        default_name = (
            f"{self.current_file.stem}_pareto.txt"
            if self.current_file
            else "pareto_frontier.txt"
        )
        filename = filedialog.asksaveasfilename(
            title="Exportar fronteira de Pareto",
            defaultextension=".txt",
            initialfile=default_name,
            filetypes=[("Arquivo de texto", "*.txt")],
        )
        if not filename:
            return

        try:
            Path(filename).write_text(
                self.frontier_text() + "\n", encoding="utf-8"
            )
        except OSError as exc:
            messagebox.showerror("Falha ao exportar", str(exc))
            return

        self.status_var.set(f"Lista exportada para {filename}")

    def draw_chart(self) -> None:
        self.canvas.delete("all")

        if not self.points:
            width = max(self.canvas.winfo_width(), 300)
            height = max(self.canvas.winfo_height(), 200)
            self.canvas.create_text(
                width / 2,
                height / 2,
                text="Carregue um arquivo para visualizar os pontos.",
                fill="#666666",
            )
            return

        width = max(self.canvas.winfo_width(), 300)
        height = max(self.canvas.winfo_height(), 250)
        margin = 42

        xs = [point.x for point in self.points]
        ys = [point.y for point in self.points]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)

        x_span = max(max_x - min_x, 1.0)
        y_span = max(max_y - min_y, 1.0)

        def project(point: Point) -> tuple[float, float]:
            x = margin + (point.x - min_x) / x_span * (width - 2 * margin)
            y = margin + (point.y - min_y) / y_span * (height - 2 * margin)
            return x, y

        self.canvas.create_line(
            margin, height - margin, width - margin, height - margin, fill="#999999"
        )
        self.canvas.create_line(
            margin, margin, margin, height - margin, fill="#999999"
        )

        frontier_coords = [project(item.point) for item in self.frontier]
        if len(frontier_coords) >= 2:
            flat_coords = [
                coordinate
                for pair in frontier_coords
                for coordinate in pair
            ]
            self.canvas.create_line(
                *flat_coords,
                fill="#c23b3b",
                width=2,
            )

        frontier_points = {(item.point.x, item.point.y) for item in self.frontier}

        for point in self.points:
            x, y = project(point)
            is_frontier = (point.x, point.y) in frontier_points
            radius = 4 if is_frontier else 2
            fill = "#c23b3b" if is_frontier else "#7f8c8d"

            self.canvas.create_oval(
                x - radius,
                y - radius,
                x + radius,
                y + radius,
                fill=fill,
                outline="",
            )

        quadrant = self.current_quadrant_key()
        vertical_direction = "↑ topo" if quadrant.startswith("top_") else "↓ bottom"
        horizontal_direction = (
            "← esquerda" if quadrant.endswith("_left") else "direita →"
        )

        self.canvas.create_text(
            margin,
            15,
            text=f"Direção Pareto: {vertical_direction}",
            anchor=tk.W,
            fill="#555555",
        )
        self.canvas.create_text(
            width - margin,
            height - 15,
            text=horizontal_direction,
            anchor=tk.E,
            fill="#555555",
        )


def main() -> None:
    app = ParetoApp()
    app.mainloop()


if __name__ == "__main__":
    main()
