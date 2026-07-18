(function () {
  "use strict";

  if (document.documentElement.dataset.paParetoLoaded === "true") {
    return;
  }
  document.documentElement.dataset.paParetoLoaded = "true";

  const core = globalThis.ParetoCore;
  if (!core) {
    console.error("Pareto Frontier: pareto-core.js não foi carregado.");
    return;
  }

  const uiLanguage =
    typeof navigator !== "undefined" && /^pt(?:[-_]|$)/i.test(navigator.language || "")
      ? "pt"
      : "en";
  const messages = {
    pt: {
      triggerLabel: "Calcular fronteira de Pareto",
      eyebrow: "Fronteira de Pareto",
      chartFallback: "Gráfico de modelos",
      close: "Fechar",
      desiredDirection: "Direção desejada",
      captured: (total, count) => `${total} pontos capturados · ${count} modelos na fronteira`,
      associationGood: "Associação geométrica consistente.",
      associationWarning: "Atenção: verifique as labels capturadas.",
      empty: "Nenhum modelo atende simultaneamente a essa direção.",
      errorSubtitle: "Não foi possível capturar todos os dados deste gráfico.",
      retry: "Tente novamente após o gráfico terminar de carregar.",
      copy: "Copiar lista",
      copied: (count) => `${count} modelos copiados para a área de transferência.`,
      copyFailed: "Não foi possível copiar automaticamente.",
      errors: {
        noLabels: "Não encontrei as labels dos modelos neste gráfico.",
        noPoints: "Nenhum ponto de modelo foi encontrado neste gráfico.",
        mismatch: (labelCount, pointCount) =>
          `O gráfico tem ${labelCount} labels e ${pointCount} pontos. ` +
          "Tente novamente quando a página terminar de carregar.",
      },
    },
    en: {
      triggerLabel: "Calculate Pareto frontier",
      eyebrow: "Pareto Frontier",
      chartFallback: "Model chart",
      close: "Close",
      desiredDirection: "Preferred direction",
      captured: (total, count) => `${total} points captured · ${count} models on the frontier`,
      associationGood: "Geometric label association looks consistent.",
      associationWarning: "Warning: please verify the captured labels.",
      empty: "No model meets both objectives in this direction.",
      errorSubtitle: "Not all chart data could be captured.",
      retry: "Try again after the chart finishes loading.",
      copy: "Copy list",
      copied: (count) => `${count} models copied to the clipboard.`,
      copyFailed: "The list could not be copied automatically.",
      errors: {
        noLabels: "Model labels were not found in this chart.",
        noPoints: "No model points were found in this chart.",
        mismatch: (labelCount, pointCount) =>
          `The chart has ${labelCount} labels and ${pointCount} points. ` +
          "Try again after the page finishes loading.",
      },
    },
  };
  const ui = messages[uiLanguage];

  const directions = [
    {
      key: "top_left",
      label: "Topo esquerdo",
      description: "menor X e maior Y",
      enLabel: "Top-left",
      enDescription: "lower X and higher Y",
    },
    {
      key: "top_right",
      label: "Topo direito",
      description: "maior X e maior Y",
      enLabel: "Top-right",
      enDescription: "higher X and higher Y",
    },
    {
      key: "bottom_left",
      label: "Base esquerda",
      description: "menor X e menor Y",
      enLabel: "Bottom-left",
      enDescription: "lower X and lower Y",
    },
    {
      key: "bottom_right",
      label: "Base direita",
      description: "maior X e menor Y",
      enLabel: "Bottom-right",
      enDescription: "higher X and lower Y",
    },
  ];

  function localizedDirection(direction) {
    return uiLanguage === "en"
      ? `${direction.enLabel} — ${direction.enDescription}`
      : `${direction.label} — ${direction.description}`;
  }

  if (uiLanguage === "en") {
    directions.forEach((direction) => {
      direction.label = direction.enLabel;
      direction.description = direction.enDescription;
    });
  }

  function escapeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function numberAttribute(element, attributeName) {
    const value = Number.parseFloat(element.getAttribute(attributeName));
    return Number.isFinite(value) ? value : null;
  }

  function parseTranslate(transform) {
    const match = String(transform || "").match(
      /^translate\(\s*([-+]?\d*\.?\d+)\s*,?\s*([-+]?\d*\.?\d+)\s*\)/,
    );
    if (!match) {
      return null;
    }

    return { x: Number(match[1]), y: Number(match[2]) };
  }

  function parseLabelGroup(group) {
    const textElement =
      Array.from(group.children).find(
        (child) => child.tagName && child.tagName.toLowerCase() === "text",
      ) || group.querySelector("text");
    if (!textElement) {
      return null;
    }

    const name = escapeText(textElement.textContent);
    const textX = numberAttribute(textElement, "x");
    const textY = numberAttribute(textElement, "y");
    if (!name || textX === null || textY === null) {
      return null;
    }

    const lineElement =
      Array.from(group.children).find(
        (child) => child.tagName && child.tagName.toLowerCase() === "line",
      ) || group.querySelector("line");
    const line = lineElement
      ? ["x1", "y1", "x2", "y2"].map((attributeName) =>
          numberAttribute(lineElement, attributeName),
        )
      : null;
    const validLine = line && line.every((value) => value !== null)
      ? line
      : null;

    const iconElement = Array.from(group.children).find((child) => {
      if (!child.tagName || child.tagName.toLowerCase() !== "g") {
        return false;
      }
      return Boolean(parseTranslate(child.getAttribute("transform")));
    });
    const iconTransform = iconElement
      ? parseTranslate(iconElement.getAttribute("transform"))
      : null;

    return {
      name,
      textX,
      textY,
      line: validLine,
      iconX: iconTransform ? iconTransform.x : null,
    };
  }

  function extractLabels(surface) {
    const containers = Array.from(surface.querySelectorAll("g"))
      .filter(
        (group) =>
          group.getAttribute("pointer-events") === "none" &&
          group.getAttribute("aria-hidden") === "true" &&
          parseTranslate(group.getAttribute("transform")),
      )
      .map((group) => {
        const labels = Array.from(group.children)
          .filter(
            (child) =>
              child.tagName &&
              child.tagName.toLowerCase() === "g" &&
              child.getAttribute("opacity") === "1",
          )
          .map(parseLabelGroup)
          .filter(Boolean);
        return {
          group,
          labels,
          offset: parseTranslate(group.getAttribute("transform")),
        };
      })
      .filter((candidate) => candidate.labels.length > 0);

    if (!containers.length) {
      throw new Error(ui.errors.noLabels);
    }

    return containers.reduce((best, candidate) =>
      candidate.labels.length > best.labels.length ? candidate : best,
    );
  }

  function extractPoints(surface) {
    return Array.from(
      surface.querySelectorAll(
        "g.recharts-scatter g.recharts-scatter-symbol circle",
      ),
    )
      .map((circle) => ({
        x: numberAttribute(circle, "cx"),
        y: numberAttribute(circle, "cy"),
        radius: numberAttribute(circle, "r") || 6,
      }))
      .filter((point) => point.x !== null && point.y !== null);
  }

  function findChartScope(surface) {
    let node = surface.parentElement;
    while (node && node !== document.body) {
      const surfaces = node.querySelectorAll("svg.recharts-surface");
      const heading = node.querySelector("h3");
      if (heading && surfaces.length === 1 && surfaces[0] === surface) {
        return { heading, node };
      }
      node = node.parentElement;
    }

    return { heading: null, node: surface.parentElement };
  }

  function chartTitle(surface, scope) {
    if (scope.heading) {
      return escapeText(scope.heading.textContent) || ui.chartFallback;
    }

    const title = surface.querySelector("title");
    return escapeText(title ? title.textContent : "") || ui.chartFallback;
  }

  function extractChartData(surface) {
    const labels = extractLabels(surface);
    const points = extractPoints(surface);
    if (!points.length) {
      throw new Error(ui.errors.noPoints);
    }
    if (labels.labels.length !== points.length) {
      throw new Error(
        ui.errors.mismatch(labels.labels.length, points.length),
      );
    }

    const association = core.associateLabelsToPoints(
      labels.labels,
      points,
      labels.offset.x,
      labels.offset.y,
    );

    return {
      points,
      nameByPoint: association.nameByPoint,
      maxAssociationCost: association.maxCost,
    };
  }

  function makeTrigger(surface, scope) {
    const trigger = document.createElement("span");
    const root = typeof trigger.attachShadow === "function"
      ? trigger.attachShadow({ mode: "open" })
      : trigger;

    trigger.className = "pa-pareto-trigger-host";
    trigger.setAttribute("aria-label", ui.triggerLabel);
    trigger.setAttribute("title", ui.triggerLabel);
    root.innerHTML = `
      <style>
        :host { display: inline-flex; vertical-align: middle; }
        :host([data-pa-overlay="true"]) {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 20;
        }
        button {
          all: initial;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 32px;
          padding: 0 10px;
          border: 1px solid #d8d3e8;
          border-radius: 8px;
          background: #ffffff;
          color: #3b2472;
          cursor: pointer;
          font: 600 12px/1.1 system-ui, -apple-system, sans-serif;
          box-shadow: 0 1px 2px rgba(31, 20, 61, .08);
        }
        button:hover { border-color: #7f4bf3; background: #faf8ff; }
        button:focus-visible { outline: 2px solid #7f4bf3; outline-offset: 2px; }
        .icon { font-size: 15px; line-height: 1; }
      </style>
      <button type="button">
        <span class="icon" aria-hidden="true">⌁</span>
        <span>Pareto</span>
      </button>
    `;

    if (root === trigger) {
      trigger.style.display = "inline-flex";
      trigger.style.verticalAlign = "middle";
    }

    const button = root.querySelector("button");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openDialog(surface, scope);
    });
    return trigger;
  }

  function installTrigger(surface) {
    if (surface.dataset.paParetoTrigger === "true") {
      if (surface._paParetoTrigger?.isConnected) {
        return;
      }
      delete surface.dataset.paParetoTrigger;
    }

    const scope = findChartScope(surface);
    const trigger = makeTrigger(surface, scope);
    trigger._paSurface = surface;

    const downloadButton = scope.node?.querySelector(
      'button[aria-label="Download data"]',
    );
    if (downloadButton?.parentElement) {
      downloadButton.parentElement.appendChild(trigger);
    } else {
      const chartContainer = surface.closest(".recharts-responsive-container")
        || surface.parentElement;
      if (chartContainer) {
        if (getComputedStyle(chartContainer).position === "static") {
          chartContainer.style.position = "relative";
        }
        trigger.dataset.paOverlay = "true";
        chartContainer.appendChild(trigger);
      }
    }

    surface._paParetoTrigger = trigger;
    surface.dataset.paParetoTrigger = "true";
  }

  class ParetoTrigger extends HTMLElement {
    constructor() {
      super();
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          :host { display: inline-flex; vertical-align: middle; }
          :host([data-pa-overlay="true"]) {
            position: absolute;
            top: 8px;
            right: 8px;
            z-index: 20;
          }
          button {
            all: initial;
            box-sizing: border-box;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-height: 32px;
            padding: 0 10px;
            border: 1px solid #d8d3e8;
            border-radius: 8px;
            background: #ffffff;
            color: #3b2472;
            cursor: pointer;
            font: 600 12px/1.1 system-ui, -apple-system, sans-serif;
            box-shadow: 0 1px 2px rgba(31, 20, 61, .08);
          }
          button:hover { border-color: #7f4bf3; background: #faf8ff; }
          button:focus-visible { outline: 2px solid #7f4bf3; outline-offset: 2px; }
          .icon { font-size: 15px; line-height: 1; }
        </style>
        <button type="button">
          <span class="icon" aria-hidden="true">⌁</span>
          <span>Pareto</span>
        </button>
      `;
      const button = shadow.querySelector("button");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.dispatchEvent(
          new CustomEvent("pa-pareto-open", { bubbles: true, composed: true }),
        );
      });
    }
  }

  class ParetoOverlay extends HTMLElement {
    constructor() {
      super();
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          :host {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            display: block;
            color: #17131f;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          :host([hidden]) { display: none !important; }
          .backdrop {
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100%;
            padding: 18px;
            background: rgba(17, 12, 28, .42);
          }
          .dialog {
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            width: min(100%, 520px);
            max-height: min(760px, calc(100vh - 36px));
            overflow: hidden;
            border: 1px solid #e7e0f5;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 24px 70px rgba(36, 21, 66, .28);
          }
          header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 20px 20px 14px;
            border-bottom: 1px solid #f0ecf7;
          }
          .eyebrow {
            margin-bottom: 5px;
            color: #7f4bf3;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          h2 {
            max-width: 420px;
            margin: 0;
            color: #21152e;
            font: 650 20px/1.2 Georgia, "Times New Roman", serif;
          }
          .subtitle {
            margin: 7px 0 0;
            color: #6b6374;
            font-size: 12px;
            line-height: 1.4;
          }
          .close {
            all: initial;
            flex: 0 0 auto;
            width: 30px;
            height: 30px;
            border-radius: 8px;
            color: #625a6d;
            cursor: pointer;
            font: 24px/28px system-ui, sans-serif;
            text-align: center;
          }
          .close:hover { background: #f5f1fb; color: #21152e; }
          .close:focus-visible { outline: 2px solid #7f4bf3; outline-offset: 2px; }
          .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 13px 20px;
            background: #fcfbfe;
            border-bottom: 1px solid #f0ecf7;
          }
          .toolbar label { color: #5e5668; font-size: 12px; font-weight: 600; }
          select {
            max-width: 230px;
            padding: 7px 28px 7px 9px;
            border: 1px solid #dcd4eb;
            border-radius: 8px;
            background: #fff;
            color: #2e2140;
            font: 12px system-ui, sans-serif;
          }
          select:focus-visible { outline: 2px solid #7f4bf3; outline-offset: 2px; }
          .content { overflow: auto; padding: 14px 20px 18px; }
          ol { margin: 0; padding-left: 27px; }
          li {
            padding: 8px 0 8px 4px;
            border-bottom: 1px solid #f1eef5;
            color: #2a2033;
            font-size: 14px;
            line-height: 1.3;
          }
          li:last-child { border-bottom: 0; }
          .empty, .error {
            margin: 0;
            color: #6b6374;
            font-size: 13px;
            line-height: 1.5;
          }
          .error { color: #9b2c40; }
          footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 20px 18px;
            border-top: 1px solid #f0ecf7;
          }
          .status { min-height: 18px; color: #6b6374; font-size: 11px; }
          .actions { display: flex; gap: 8px; }
          .action {
            all: initial;
            box-sizing: border-box;
            min-height: 34px;
            padding: 0 12px;
            border: 1px solid #dcd4eb;
            border-radius: 8px;
            background: #fff;
            color: #3b2472;
            cursor: pointer;
            font: 600 12px/1.1 system-ui, -apple-system, sans-serif;
          }
          .action.primary { border-color: #7f4bf3; background: #7f4bf3; color: #fff; }
          .action:hover { filter: brightness(.97); }
          .action:focus-visible { outline: 2px solid #7f4bf3; outline-offset: 2px; }
        </style>
        <div class="backdrop">
          <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="pa-title">
            <header>
              <div>
                <div class="eyebrow">Fronteira de Pareto</div>
                <h2 id="pa-title">Gráfico de modelos</h2>
                <p class="subtitle" id="pa-subtitle"></p>
              </div>
              <button class="close" id="pa-close" type="button" aria-label="Fechar">×</button>
            </header>
            <div class="toolbar" id="pa-toolbar">
              <label for="pa-direction">Direção desejada</label>
              <select id="pa-direction"></select>
            </div>
            <div class="content" id="pa-content"></div>
            <footer>
              <div class="status" id="pa-status" aria-live="polite"></div>
              <div class="actions">
                <button class="action" id="pa-close-bottom" type="button">Fechar</button>
                <button class="action primary" id="pa-copy" type="button">Copiar lista</button>
              </div>
            </footer>
          </section>
        </div>
      `;

      this._shadow = shadow;
      this._title = shadow.querySelector("#pa-title");
      this._subtitle = shadow.querySelector("#pa-subtitle");
      this._toolbar = shadow.querySelector("#pa-toolbar");
      this._direction = shadow.querySelector("#pa-direction");
      this._content = shadow.querySelector("#pa-content");
      this._status = shadow.querySelector("#pa-status");
      this._copy = shadow.querySelector("#pa-copy");
      this._close = shadow.querySelector("#pa-close");
      this._closeBottom = shadow.querySelector("#pa-close-bottom");

      directions.forEach((direction) => {
        const option = document.createElement("option");
        option.value = direction.key;
        option.textContent = `${direction.label} — ${direction.description}`;
        this._direction.appendChild(option);
      });

      this._close.addEventListener("click", () => this.dispatchEvent(new CustomEvent("pa-close")));
      this._closeBottom.addEventListener("click", () => this.dispatchEvent(new CustomEvent("pa-close")));
      this._copy.addEventListener("click", () => this.dispatchEvent(new CustomEvent("pa-copy")));
      this._direction.addEventListener("change", () =>
        this.dispatchEvent(
          new CustomEvent("pa-direction", {
            detail: this._direction.value,
          }),
        ),
      );
      shadow.querySelector(".backdrop").addEventListener("click", (event) => {
        if (event.target === event.currentTarget) {
          this.dispatchEvent(new CustomEvent("pa-close"));
        }
      });
    }

    setResult({ title, total, frontier, direction, maxAssociationCost }) {
      this._title.textContent = title;
      this._subtitle.textContent = `${total} pontos capturados · ${frontier.length} modelos na fronteira`;
      this._toolbar.hidden = false;
      this._direction.value = direction;
      this._content.replaceChildren();
      this._status.textContent = maxAssociationCost < 3
        ? "Associação geométrica consistente."
        : "Atenção: verifique as labels capturadas.";

      if (!frontier.length) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "Nenhum modelo atende simultaneamente a essa direção.";
        this._content.appendChild(empty);
      } else {
        const list = document.createElement("ol");
        frontier.forEach((item) => {
          const entry = document.createElement("li");
          entry.textContent = item.name;
          list.appendChild(entry);
        });
        this._content.appendChild(list);
      }

      this._copy.hidden = false;
    }

    setError(title, message) {
      this._title.textContent = title;
      this._subtitle.textContent = "Não foi possível capturar todos os dados deste gráfico.";
      this._toolbar.hidden = true;
      this._content.replaceChildren();
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = message;
      this._content.appendChild(error);
      this._status.textContent = "Tente novamente após o gráfico terminar de carregar.";
      this._copy.hidden = true;
    }

    setStatus(message) {
      this._status.textContent = message;
    }

    focusClose() {
      this._close.focus();
    }
  }

  function createPlainOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "pa-pareto-overlay";
    overlay.hidden = true;

    const root = typeof overlay.attachShadow === "function"
      ? overlay.attachShadow({ mode: "open" })
      : overlay;
    root.innerHTML = `
      <style>
        :host, .pa-pareto-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: block;
          color: #17131f;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        :host([hidden]), .pa-pareto-overlay[hidden] { display: none !important; }
        .pa-pareto-backdrop {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100%;
          padding: 18px;
          background: rgba(17, 12, 28, .42);
        }
        .pa-pareto-dialog {
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          width: min(100%, 520px);
          max-height: min(760px, calc(100vh - 36px));
          overflow: hidden;
          border: 1px solid #e7e0f5;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 24px 70px rgba(36, 21, 66, .28);
        }
        .pa-pareto-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 20px 14px;
          border-bottom: 1px solid #f0ecf7;
        }
        .pa-pareto-eyebrow {
          margin-bottom: 5px;
          color: #7f4bf3;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .pa-pareto-title {
          max-width: 420px;
          margin: 0;
          color: #21152e;
          font: 650 20px/1.2 Georgia, "Times New Roman", serif;
        }
        .pa-pareto-subtitle {
          margin: 7px 0 0;
          color: #6b6374;
          font-size: 12px;
          line-height: 1.4;
        }
        .pa-pareto-close {
          all: initial;
          flex: 0 0 auto;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          color: #625a6d;
          cursor: pointer;
          font: 24px/28px system-ui, sans-serif !important;
          text-align: center;
        }
        .pa-pareto-close:hover { background: #f5f1fb; color: #21152e; }
        .pa-pareto-close:focus-visible { outline: 2px solid #7f4bf3; outline-offset: 2px; }
        .pa-pareto-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px 20px;
          background: #fcfbfe;
          border-bottom: 1px solid #f0ecf7;
        }
        .pa-pareto-toolbar label { color: #5e5668; font-size: 12px; font-weight: 600; }
        .pa-pareto-direction {
          max-width: 230px;
          padding: 7px 28px 7px 9px;
          border: 1px solid #dcd4eb;
          border-radius: 8px;
          background: #fff;
          color: #2e2140;
          font: 12px system-ui, sans-serif !important;
        }
        .pa-pareto-direction:focus-visible { outline: 2px solid #7f4bf3; outline-offset: 2px; }
        .pa-pareto-content { overflow: auto; padding: 14px 20px 18px; }
        .pa-pareto-content ol { margin: 0; padding-left: 27px; }
        .pa-pareto-content li {
          padding: 8px 0 8px 4px;
          border-bottom: 1px solid #f1eef5;
          color: #2a2033;
          font-size: 14px;
          line-height: 1.3;
        }
        .pa-pareto-content li:last-child { border-bottom: 0; }
        .pa-pareto-empty, .pa-pareto-error {
          margin: 0;
          color: #6b6374;
          font-size: 13px;
          line-height: 1.5;
        }
        .pa-pareto-error { color: #9b2c40; }
        .pa-pareto-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 20px 18px;
          border-top: 1px solid #f0ecf7;
        }
        .pa-pareto-status { min-height: 18px; color: #6b6374; font-size: 11px; }
        .pa-pareto-actions { display: flex; gap: 8px; }
        .pa-pareto-action {
          all: initial;
          box-sizing: border-box;
          min-height: 34px;
          padding: 0 12px;
          border: 1px solid #dcd4eb;
          border-radius: 8px;
          background: #fff;
          color: #3b2472;
          cursor: pointer;
          font: 600 12px/1.1 system-ui, -apple-system, sans-serif !important;
        }
        .pa-pareto-action-primary { border-color: #7f4bf3; background: #7f4bf3; color: #fff; }
        .pa-pareto-action:hover { filter: brightness(.97); }
        .pa-pareto-action:focus-visible { outline: 2px solid #7f4bf3; outline-offset: 2px; }
      </style>
      <div class="pa-pareto-backdrop">
        <section class="pa-pareto-dialog" role="dialog" aria-modal="true" aria-labelledby="pa-pareto-title">
          <header class="pa-pareto-header">
            <div>
              <div class="pa-pareto-eyebrow">Fronteira de Pareto</div>
              <h2 class="pa-pareto-title" id="pa-pareto-title">Gráfico de modelos</h2>
              <p class="pa-pareto-subtitle" id="pa-pareto-subtitle"></p>
            </div>
            <button class="pa-pareto-close" id="pa-pareto-close" type="button" aria-label="Fechar">×</button>
          </header>
          <div class="pa-pareto-toolbar" id="pa-pareto-toolbar">
            <label for="pa-pareto-direction">Direção desejada</label>
            <select class="pa-pareto-direction" id="pa-pareto-direction"></select>
          </div>
          <div class="pa-pareto-content" id="pa-pareto-content"></div>
          <footer class="pa-pareto-footer">
            <div class="pa-pareto-status" id="pa-pareto-status" aria-live="polite"></div>
            <div class="pa-pareto-actions">
              <button class="pa-pareto-action" id="pa-pareto-close-bottom" type="button">Fechar</button>
              <button class="pa-pareto-action pa-pareto-action-primary" id="pa-pareto-copy" type="button">Copiar lista</button>
            </div>
          </footer>
        </section>
      </div>
    `;

    if (root === overlay) {
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.zIndex = "2147483647";
    }

    overlay._title = root.querySelector("#pa-pareto-title");
    overlay._subtitle = root.querySelector("#pa-pareto-subtitle");
    overlay._toolbar = root.querySelector("#pa-pareto-toolbar");
    overlay._direction = root.querySelector("#pa-pareto-direction");
    overlay._content = root.querySelector("#pa-pareto-content");
    overlay._status = root.querySelector("#pa-pareto-status");
    overlay._copy = root.querySelector("#pa-pareto-copy");
    overlay._close = root.querySelector("#pa-pareto-close");
    overlay._closeBottom = root.querySelector("#pa-pareto-close-bottom");
    root.querySelector(".pa-pareto-eyebrow").textContent = ui.eyebrow;
    overlay._title.textContent = ui.chartFallback;
    overlay._close.setAttribute("aria-label", ui.close);
    root.querySelector('label[for="pa-pareto-direction"]').textContent = ui.desiredDirection;
    overlay._closeBottom.textContent = ui.close;
    overlay._copy.textContent = ui.copy;

    directions.forEach((direction) => {
      const option = document.createElement("option");
      option.value = direction.key;
      option.textContent = `${direction.label} — ${direction.description}`;
      overlay._direction.appendChild(option);
    });

    overlay._close.addEventListener("click", () => overlay.dispatchEvent(new CustomEvent("pa-close")));
    overlay._closeBottom.addEventListener("click", () => overlay.dispatchEvent(new CustomEvent("pa-close")));
    overlay._copy.addEventListener("click", () => overlay.dispatchEvent(new CustomEvent("pa-copy")));
    overlay._direction.addEventListener("change", () =>
      overlay.dispatchEvent(
        new CustomEvent("pa-direction", { detail: overlay._direction.value }),
      ),
    );
    root.querySelector(".pa-pareto-backdrop").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        overlay.dispatchEvent(new CustomEvent("pa-close"));
      }
    });

    overlay.setResult = ({ title, total, frontier, direction, maxAssociationCost }) => {
      overlay._title.textContent = title;
      overlay._subtitle.textContent = `${total} pontos capturados · ${frontier.length} modelos na fronteira`;
      overlay._toolbar.hidden = false;
      overlay._subtitle.textContent = ui.captured(total, frontier.length);
      overlay._direction.value = direction;
      overlay._content.replaceChildren();
      overlay._status.textContent = maxAssociationCost < 3
        ? ui.associationGood
        : ui.associationWarning;

      if (!frontier.length) {
        const empty = document.createElement("p");
        empty.className = "pa-pareto-empty";
        empty.textContent = ui.empty;
        overlay._content.appendChild(empty);
      } else {
        const list = document.createElement("ol");
        frontier.forEach((item) => {
          const entry = document.createElement("li");
          entry.textContent = item.name;
          list.appendChild(entry);
        });
        overlay._content.appendChild(list);
      }

      overlay._copy.hidden = false;
    };

    overlay.setError = (title, message) => {
      overlay._title.textContent = title;
      overlay._subtitle.textContent = ui.errorSubtitle;
      overlay._toolbar.hidden = true;
      overlay._content.replaceChildren();
      const error = document.createElement("p");
      error.className = "pa-pareto-error";
      error.textContent = message;
      overlay._content.appendChild(error);
      overlay._status.textContent = ui.retry;
      overlay._copy.hidden = true;
    };

    overlay.setStatus = (message) => {
      overlay._status.textContent = message;
    };

    overlay.focusClose = () => {
      overlay._close.focus();
    };

    return overlay;
  }

  const overlay = createPlainOverlay();
  overlay.hidden = true;
  document.documentElement.appendChild(overlay);

  let activeChart = null;
  let activeDirection = "top_left";
  let activeFrontier = [];

  function renderActiveChart() {
    if (!activeChart) {
      return;
    }

    activeFrontier = core.buildFrontier(
      activeChart.data.points,
      activeChart.data.nameByPoint,
      activeDirection,
    );
    overlay.setResult({
      title: activeChart.title,
      total: activeChart.data.points.length,
      frontier: activeFrontier,
      direction: activeDirection,
      maxAssociationCost: activeChart.data.maxAssociationCost,
    });
  }

  function openDialog(surface, scope) {
    const title = chartTitle(surface, scope);
    try {
      activeChart = { data: extractChartData(surface), title };
      activeDirection = "top_left";
      renderActiveChart();
    } catch (error) {
      activeChart = null;
      activeFrontier = [];
      overlay.setError(title, error instanceof Error ? error.message : String(error));
    }

    overlay.hidden = false;
    overlay.focusClose();
  }

  function closeDialog() {
    overlay.hidden = true;
    activeChart = null;
    activeFrontier = [];
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } finally {
        textarea.remove();
      }
      return copied;
    }
  }

  overlay.addEventListener("pa-close", closeDialog);
  overlay.addEventListener("pa-direction", (event) => {
    if (!activeChart || !core.getParetoIndices) {
      return;
    }
    activeDirection = event.detail;
    renderActiveChart();
  });
  overlay.addEventListener("pa-copy", async () => {
    if (!activeFrontier.length) {
      return;
    }
    const text = activeFrontier
      .map((item, index) => `${index + 1}. ${item.name}`)
      .join("\n");
    const copied = await copyText(text);
    overlay.setStatus(
      copied
        ? ui.copied(activeFrontier.length)
        : ui.copyFailed,
    );
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (!overlay.hidden && event.key === "Escape") {
        closeDialog();
      }
    },
    true,
  );

  function scan() {
    document
      .querySelectorAll("svg.recharts-surface")
      .forEach((surface) => {
        const pointCount = surface.querySelectorAll(
          "g.recharts-scatter g.recharts-scatter-symbol circle",
        ).length;
        if (pointCount > 0) {
          installTrigger(surface);
        }
      });
  }

  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) {
      return;
    }
    scanScheduled = true;
    window.setTimeout(() => {
      scanScheduled = false;
      scan();
    }, 80);
  }

  const observer = new MutationObserver(scheduleScan);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener("resize", scheduleScan, { passive: true });
  scan();
})();
