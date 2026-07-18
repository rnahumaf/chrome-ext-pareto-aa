# Chrome Web Store — Pareto Frontier for Artificial Analysis

Este arquivo reúne os textos prontos para colar no Chrome Web Store Developer Dashboard, os textos de privacidade e o checklist final de publicação.

## Campos principais

Nome:

Pareto Frontier for Artificial Analysis

Resumo em português (até 132 caracteres):

Veja e copie a fronteira de Pareto dos gráficos de comparação de modelos no Artificial Analysis.

Resumo em inglês (até 132 caracteres):

Find and copy Pareto frontiers from model comparison scatter plots on Artificial Analysis.

Categoria sugerida:

Productivity

Idioma principal sugerido:

Português — Brasil

Visibilidade:

Public

Item pago:

No

Conteúdo adulto:

No

## Descrição detalhada — português

Compare modelos de IA com mais clareza no Artificial Analysis.

Pareto Frontier for Artificial Analysis adiciona um pequeno botão Pareto aos gráficos de comparação de modelos que possuem eixos X e Y. Ao clicar nele, a extensão identifica os pontos disponíveis no gráfico, calcula a fronteira de Pareto e mostra os modelos que não são simultaneamente piores nas duas métricas.

Recursos:

- Detecta automaticamente scatter plots de comparação no Artificial Analysis.
- Calcula a fronteira usando os pontos e rótulos disponíveis no gráfico atual.
- Permite escolher a direção desejada: topo esquerdo, topo direito, base esquerda ou base direita.
- Mostra a quantidade de pontos capturados e os modelos encontrados na fronteira.
- Copia a lista de modelos para o clipboard com um clique.
- Processa o conteúdo localmente no navegador, sem conta, servidor próprio, anúncios ou rastreamento.

Como usar:

1. Abra uma página de modelos do Artificial Analysis com um gráfico de comparação.
2. Clique no botão Pareto ao lado dos controles do gráfico.
3. Escolha a direção que representa o objetivo da sua análise.
4. Feche o popup ou clique em Copiar lista.

A extensão atua somente nas páginas do Artificial Analysis necessárias para essa função. Ela é um projeto independente e não é afiliada, patrocinada ou endossada pelo Artificial Analysis.

## Detailed description — English

Compare AI models more clearly on Artificial Analysis.

Pareto Frontier for Artificial Analysis adds a small Pareto button to model comparison charts with X and Y axes. Click it to read the points available in the current chart, calculate the Pareto frontier, and see the models that are not simultaneously worse on both metrics.

Features:

- Automatically detects comparison scatter plots on Artificial Analysis.
- Calculates the frontier from the points and labels available in the current chart.
- Supports four objective directions: top-left, top-right, bottom-left, and bottom-right.
- Shows how many points were captured and which models are on the frontier.
- Copies the model list to the clipboard with one click.
- Processes chart content locally in the browser; it does not use an account, a private server, ads, or tracking.

How to use:

1. Open an Artificial Analysis model page containing a comparison chart.
2. Click the Pareto button next to the chart controls.
3. Select the direction that matches your analysis objective.
4. Close the popup or click Copy list.

The extension only operates on the Artificial Analysis pages required for this feature. It is an independent project and is not affiliated with, sponsored by, or endorsed by Artificial Analysis.

## Localização PT-EN

O pacote inclui as localidades en e pt_BR para o nome, a descrição e o título da ação. O popup escolhe automaticamente o idioma do navegador: interfaces em português usam PT-BR; os demais idiomas usam English. Isso evita que o usuário veja uma mistura de idiomas durante o fluxo.

Use a descrição em português e as imagens 01 a 03 para a localidade pt_BR. Para a localidade en, use a descrição em inglês e a imagem abaixo:

4. [04-pareto-popup-en.png](output/playwright/store/04-pareto-popup-en.png) — English popup with directions, frontier list, status, and copy action.

## Privacy tab — texto para o painel

### Single purpose

Calcular e exibir localmente a fronteira de Pareto dos dados presentes nos gráficos de comparação de modelos do Artificial Analysis.

### Permission and host-access justifications

Host access to https://artificialanalysis.ai/* and https://www.artificialanalysis.ai/*:

Necessário para ler os pontos, eixos e rótulos dos scatter plots renderizados no Artificial Analysis e inserir o botão e o popup da fronteira de Pareto somente nessas páginas.

clipboardWrite:

Necessário para copiar a lista de modelos somente depois que o usuário clicar em Copiar lista. A extensão não lê o clipboard existente nem copia dados automaticamente.

### Remote code

No. A extensão não carrega nem executa código remoto.

### Data usage disclosure

A extensão processa localmente, em memória, o conteúdo do gráfico já renderizado nas páginas do Artificial Analysis para realizar a função principal solicitada pelo usuário. A lista gerada pode ser escrita no clipboard somente após uma ação explícita do usuário. Nenhum dado é enviado a servidor externo, armazenado em banco de dados, vendido, compartilhado com terceiros ou usado para anúncios e analytics. O conteúdo temporário é descartado quando o popup é fechado ou a página é recarregada.

Como o content script lê conteúdo de uma página para cumprir a função visível da extensão, a declaração do painel deve mencionar esse processamento local de conteúdo do site, caso o formulário apresente essa categoria. As escolhas do painel devem permanecer consistentes com a política de privacidade publicada.

## Test instructions — texto para o revisor

No login ou credenciais são necessários.

1. Abra https://artificialanalysis.ai/models/capabilities/coding?cost-per-task=index-vs-cost-per-task.
2. Aguarde o gráfico de comparação carregar.
3. Clique no botão Pareto que aparece junto aos controles do gráfico.
4. Verifique a lista de modelos, altere a direção e clique em Copiar lista.
5. Confirme que a mensagem de sucesso aparece no popup e que a lista pode ser colada em um editor de texto.

## Imagens capturadas

Use as imagens na ordem abaixo. Todas estão em 1280×800, sem bordas ou padding adicional:

1. [01-pareto-button.png](output/playwright/store/01-pareto-button.png) — botão Pareto ao lado dos controles do gráfico.
2. [02-pareto-popup.png](output/playwright/store/02-pareto-popup.png) — popup com direção, quantidade de pontos e fronteira.
3. [03-pareto-copy-confirmation.png](output/playwright/store/03-pareto-copy-confirmation.png) — confirmação após copiar a lista.
4. [04-pareto-popup-en.png](output/playwright/store/04-pareto-popup-en.png) — versão inglesa do popup para a localidade en.

A loja aceita até cinco screenshots; estas quatro cobrem o fluxo principal e a localização inglesa.

## Small promotional tile

O tile de promoção de 440×280 já está pronto, sem texto pequeno e com contraste alto:

[small-promo-tile.png](assets/small-promo-tile.png)

Fonte vetorial editável:

[small-promo-tile.svg](assets/small-promo-tile.svg)

## Política de privacidade hospedável

A página bilingue pronta para GitHub Pages está em:

[docs/privacy-policy.html](docs/privacy-policy.html)

Depois de publicar este repositório no GitHub e ativar Pages usando a pasta docs, a URL esperada será:

https://SEU_USUARIO.github.io/chrome-ext-pareto-aa/privacy-policy.html

Depois de publicar o repositório, cole a URL real no campo Privacy policy do Developer Dashboard.

## Checklist antes do upload

- [x] Criar o ícone vetorial em assets/pareto-icon.svg e o PNG de 128×128 em assets/pareto-icon-128.png; ambos já estão referenciados no manifest.json.
- [x] Criar o small promotional tile PNG de 440×280 em assets/small-promo-tile.png.
- [x] Preparar a política bilingue em docs/privacy-policy.html.
- [x] Definir a página de Issues do repositório como canal público de suporte.
- [ ] Publicar docs/privacy-policy.html em uma URL HTTPS pública.
- [ ] Colar a URL pública da política no campo Privacy policy do Developer Dashboard.
- [ ] Informar um e-mail de suporte verificável no perfil do publicador.
- [ ] Confirmar a verificação em duas etapas da conta de desenvolvedor.
- [ ] Compactar manifest.json, pareto-core.js, content-script.js, a pasta _locales e assets/pareto-icon-128.png, mantendo o manifest.json na raiz do ZIP.
- [ ] Não incluir output, .playwright-cli, testes, package.json, README ou o arquivo Python no ZIP de produção.
- [ ] Fazer um último teste com o ZIP e incrementar a versão do manifest.json em cada atualização futura.

## Versão inicial

Versão: 0.1.1

Nota da versão:

Primeira versão pública: identifica gráficos de comparação de modelos no Artificial Analysis, calcula a fronteira de Pareto em quatro direções e permite copiar a lista para o clipboard.

Pacote de produção já montado:

[pareto-frontier-aa-0.1.1-store.zip](output/publish/pareto-frontier-aa-0.1.1-store.zip)
