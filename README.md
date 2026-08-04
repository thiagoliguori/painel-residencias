# painel.turisaude.com.br

Repositório das ferramentas web da Turi Saúde publicadas em `painel.turisaude.com.br` via GitHub Pages.

Última atualização: 02/08/2026

---

## Estrutura

| Caminho | URL pública | O que é |
|---|---|---|
| `index.html` | `painel.turisaude.com.br` | Redirect para `/residencias/` |
| `CNAME` | — | Domínio customizado do GitHub Pages |
| `residencias/` | `/residencias/` | Painel das Residências Caveo |
| `residencias/analytics.html` | `/residencias/analytics.html` | Painel de controle de visitas e cliques (uso interno, não listado) |
| `residencias/assets/` | — | Logo oficial da Caveo (PNG) |
| `meu-lucro-no-consultorio/` | `/meu-lucro-no-consultorio/` | Calculadora de lucro para consultórios |
| `worker/painel-analytics.js` | — | Código do Cloudflare Worker de analytics e captura de leads |

Cada ferramenta é um único `index.html` autocontido (HTML + CSS + JS puro, sem build, sem dependências além das fontes do Google).

---

## 1. Painel das Residências Caveo

**Status: no ar e completo.** Briefing de Letícia Nicolau (Comunidade Caveo), prazo 31/07/2026.

- 49 processos seletivos do ciclo 2026/2027, cobertura nacional
- 3 abas: Concursos (filtros de busca, UF, região, etapas e status), Calendário (por mês, com filtro de estado e cidade) e Meu plano (checklist de 9 etapas por concurso)
- Detecção automática de conflitos de data: 27/09 Sírio × FELUMA, 01/11 AMP × UFCSPA, 08/11 UEL × HNMD, 22/11 PSU-MG × AMRIGS
- Programas que usam a nota do ENAMED (ENARE, UFRJ, UNIMAR, CESUPA) têm `enamed:true` e não geram falso conflito entre si
- Sem persistência por decisão do produto: o plano zera ao recarregar
- Marca: Caveo em destaque com "powered by Turi Saúde", logos oficiais linkados

**Manutenção:** os dados vivem no array `PROGRAMAS` dentro de `residencias/index.html`. Editais ainda previstos precisam de revisão conforme forem publicados (a maioria sai entre agosto e outubro de 2026).

## 2. Meu Lucro no Consultório

**Status: no ar, versão 3.** Calculadora de lucro, margem e ponto de equilíbrio para médicos.

### Versão 3 (02/08/2026): formulário em 4 passos

O preenchimento virou um wizard de 4 etapas e a análise só aparece no fim, depois do botão "Ver meu diagnóstico". Os componentes seguem o guia de padrões de UI (`form_ui_patterns.pdf`), escolhidos pelo tipo de dado:

| Componente | Onde é usado |
|---|---|
| Slider (arrastar) | Percentuais: faltas, glosas, taxa de cartão, fatia no cartão, alíquota, multiplicador da CLT |
| Slider + valor digitável | Todo campo em reais: preço da consulta, aluguel, salário, pró-labore, custos fixos |
| Stepper (+ e −) | Quantidades pequenas: consultas por semana, vagas na agenda, horas |
| Controle segmentado | Sala por mês ou por hora; equipe por salário ou custo total |
| Toggle | Atendo por convênio, tenho equipe fixa |
| Chips de seleção múltipla | Quais custos fixos existem: só os marcados viram campo |
| Chips de seleção única | Regime tributário, que preenche a alíquota |
| Autocomplete | Especialidade, com busca incremental em 56 opções |
| Campo de texto | Nome do médico, título Dr./Dra. e nome da clínica, que abrem o relatório |
| Avaliação por estrelas | Confiança nos números, que muda o tom da leitura final |

Não usamos arrastar e soltar para upload (nada é enviado, o cálculo é local) nem slider de intervalo duplo (nenhum campo é uma faixa). A regra do próprio guia é escolher o componente pelo tipo de dado, não pela estética.

Os quatro passos são: Receita e agenda, Impostos, Estrutura e equipe, Sua remuneração. Cada passo mostra um resumo ao vivo no rodapé (receita estimada, custos, estrutura, caixa antes do médico) e o passo 1 bloqueia o avanço enquanto não houver consultas e preço. Campos desligados por toggle ou chip entram como zero no cálculo através do conjunto `OFF`, sem perder o valor digitado.

### Versão 2 (02/08/2026): o pró-labore

A v2 corrigiu a falha central da v1: **o pró-labore do médico não entrava na conta**, então o consultório aparecia lucrativo mesmo quando o médico estava trabalhando de graça. No cenário de exemplo, a margem foi de +36% (v1) para −19% (v2).

Cascata de resultado:
```
Receita realizada
 − impostos e taxa de cartão
 = sobra para pagar a estrutura   (margem de contribuição)
 − estrutura, equipe e fixos
 = caixa antes do médico
 − pró-labore + encargos
 = lucro do consultório
```

Regras de cálculo relevantes:
- 4,33 semanas por mês (52 ÷ 12)
- No-show separado para particular e convênio; glosas aplicadas só ao convênio
- Taxa de cartão incide apenas sobre a fatia da receita particular paga no cartão
- Custos variáveis são só impostos e taxa de cartão: insumos por consulta e repasses saíram na v3
- Equipe em 2 modos: salário × multiplicador de encargos (padrão 2,0) ou custo total da contabilidade
- Ponto de equilíbrio = custos fixos totais (já com pró-labore) ÷ % de margem de contribuição, explicado em texto na tela e no PDF
- Depreciação, juros e reserva de reinvestimento saíram em 02/08: o passo 4 é só pró-labore e encargos
- Alíquota de imposto sempre editável, com faixas de referência apenas como ponto de partida

Cada bloco do formulário tem um "Saiba mais" com a fórmula usada e as premissas assumidas (8 no total).

**Cadastro antes do PDF (02/08/2026):** clicar em qualquer um dos dois botões de salvar em PDF abre um modal pedindo nome, sobrenome, e-mail, WhatsApp, especialidade e UF, mais um aceite obrigatório de contato do time da Turi sobre IA para clínicas. Depois do envio o download é liberado e a liberação fica gravada em `localStorage` (`turi-lucro-lead`), então quem já se cadastrou não preenche de novo. Nome e especialidade vêm pré-preenchidos do passo 1. Se a rede falhar, o PDF é liberado assim mesmo: perder um lead é melhor que travar o usuário. Os dados vão para `POST /lead` no Worker.

O painel de análise abre com um bloco de conversão para o agente de IA no WhatsApp da Turi, que leva para `wa.me/551152380850` com mensagem pré-preenchida (evento `lucro/cta-whatsapp`).

Saída: painel de análise na tela + relatório em PDF de 2 páginas, salvo como "diagnóstico do meu consultório pela Turi Saúde". A página 1 traz os indicadores, a distribuição de cada R$ 100, a cascata, o ponto de equilíbrio explicado e o gráfico de custos; a página 2 traz o que vai bem, os pontos de atenção e a leitura escrita do consultor com o plano de ação. O cabeçalho usa o nome do médico em destaque.

**Marca:** somente Turi Saúde (sem Caveo), verde institucional.

---

## Infraestrutura

- **Hospedagem:** GitHub Pages, branch `main`, pasta raiz
- **DNS:** CNAME `painel` → `thiagoliguori.github.io` na Cloudflare, conta **Turi Saúde** (`9b9acc7b802bbf224bcb4a9ceddd5990`), proxy desativado (nuvem cinza, necessário para o certificado)
- **HTTPS:** certificado Let's Encrypt emitido, "Enforce HTTPS" ativo
- **Analytics:** Cloudflare Worker `painel-analytics` + KV `painel_residencias_analytics`
  - `POST /t` com `{"e":"pv","s":"residencias","nv":true}` ou `{"e":"click","s":"lucro","id":"rotulo"}`. **O campo `s` separa as plataformas já na gravação**, em chaves `pv:<site>:<data>`, `uv:<site>:<data>` e `ck:<site>:<data>:<id>`
  - `GET /stats?days=N&site=residencias|lucro|all` devolve o agregado de uma plataforma só. Chaves antigas, gravadas antes de 02/08 sem o campo `s`, são atribuídas na leitura: pageviews viram residências e cliques vão pelo prefixo do id, então o histórico não se perde
  - `POST /lead` grava o cadastro em KV usando o e-mail como chave, o que evita duplicar quem baixa o PDF mais de uma vez
  - `GET /leads?key=SEGREDO` lê os leads, e com `&format=csv` baixa a planilha. **Nunca deixe essa rota sem chave: são dados pessoais**
  - Os ids dos eventos vão limpos, sem prefixo de plataforma: quem separa é o campo `s`
  - Limite do plano gratuito: 1.000 escritas por dia
  - Cada lead novo dispara um aviso no Slack, com botão de chamar a pessoa no WhatsApp em um clique
  - O código-fonte do Worker vive em `worker/painel-analytics.js`, com a configuração em `worker/wrangler.toml`
  - **O repositório é público: nenhum segredo pode entrar no código.** As duas variáveis ficam em Configurações > Variáveis do Worker, marcadas como criptografadas: `LEADS_KEY` (protege `GET /leads`) e `SLACK_WEBHOOK` (URL do Incoming Webhook). Sem `LEADS_KEY` definida, a rota de leitura fica fechada por padrão; sem `SLACK_WEBHOOK`, o aviso é ignorado sem erro

Passo a passo completo para novos projetos: `~/Desktop/Claude/playbook-site-github-pages-cloudflare.md`

### Publicar uma alteração

```bash
git add -A && git commit -m "descrição" && git push
```

O GitHub Pages publica em 1 a 3 minutos. Se o push for rejeitado, rode `git pull --rebase` antes: o GitHub cria commits automáticos no `CNAME` quando o domínio é reconfigurado.

### Publicar o Worker

O Worker não vai junto com o Pages: ele sobe pela linha de comando, de dentro de `worker/`.

```bash
cd worker && npx wrangler deploy
```

Na primeira vez é preciso `npx wrangler login` (OAuth no navegador, na conta **Turi Saúde**). Para gravar um segredo sem passar pelo dashboard:

```bash
cd worker && npx wrangler secret put LEADS_KEY
```

O dashboard guarda o histórico de versões, então dá para voltar atrás por lá se um deploy quebrar algo.

---

## Próximos passos sugeridos

**Painel das Residências**
- Revisar os editais marcados como "previsto" conforme forem publicados (agosto a outubro/2026)
- Monitorar Grupo VIV e Rede Américas, citados nos calendários mas ainda sem edital
- Avaliar persistência opcional em localStorage, hoje desativada por decisão de produto

**Meu Lucro no Consultório**
- Acompanhar no analytics onde o preenchimento é abandonado: os eventos `lucro/passo-1` a `lucro/passo-3` e `lucro/ver-diagnostico` formam o funil
- Possíveis evoluções: simulador de cenários (mudar preço e volume e ver a margem em tempo real), comparação com benchmark de outros usuários, captura opcional de e-mail antes do PDF

**Analytics**
- O dashboard é público por URL não listada; avaliar proteção por senha no Worker se o dado ficar sensível
- Se o volume crescer, migrar o armazenamento do KV (limite de 1.000 escritas/dia no plano gratuito)
