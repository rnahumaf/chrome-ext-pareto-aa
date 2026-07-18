# Pareto Frontier for Artificial Analysis

Extensão Chrome MV3 que adiciona um botão `Pareto` aos scatter plots de comparação de modelos do Artificial Analysis. O botão abre uma lista com a fronteira de Pareto, permite trocar a direção desejada e copia a lista para o clipboard.

## Instalar localmente

1. Abra `chrome://extensions` no Chrome.
2. Ative **Developer mode**.
3. Clique em **Load unpacked** e selecione esta pasta.
4. Abra ou recarregue uma página do Artificial Analysis que tenha um gráfico de comparação.

Não há etapa de build: o diretório do repositório já é o diretório da extensão.

## Direções

O padrão é **Topo esquerdo**, adequado ao gráfico “Coding Index vs. Cost per Task”: menor custo no eixo X e maior score no eixo Y. O popup também oferece topo direito, base esquerda e base direita para gráficos com objetivos diferentes.

## Testes

```text
npm test
```

O arquivo `pareto-core.js` é carregado antes do content script e também pode ser importado pelo Node para testes. A associação dos nomes aos pontos é feita pela geometria das labels SVG e das linhas-guia do Recharts, seguindo a lógica do arquivo Python original.

## Idiomas e ícone

O nome, a descrição e o título da ação usam as localidades en e pt_BR. O popup seleciona PT-BR quando o navegador está em português e English nos demais casos, incluindo as direções, mensagens de erro, status e ações de cópia.

O SVG editável do ícone está em assets/pareto-icon.svg. A versão PNG de 128×128 usada pelo manifest está em assets/pareto-icon-128.png.

## Publicar na Chrome Web Store

Antes de enviar o ZIP, confira o nome, a descrição, a versão e as imagens exigidas pela ficha da loja. Para um teste inicial, o diretório pode ser compactado sem incluir artefatos de desenvolvimento.
