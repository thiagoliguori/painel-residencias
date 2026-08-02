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

**Status: no ar, versão 2.** Calculadora de lucro, margem e ponto de equilíbrio para médicos.

Versão 2 (02/08/2026) corrigiu a falha central da v1: **o pró-labore do médico não entrava na conta**, então o consultório aparecia lucrativo mesmo quando o médico estava trabalhando de graça. No cenário de exemplo, a margem foi de +36% (v1) para −19% (v2).

Cascata de resultado:
```
Receita realizada
 − custos por consulta e impostos
 = sobra para pagar a estrutura   (margem de contribuição)
 − estrutura, equipe e fixos
 = caixa antes do médico
 − pró-labore + encargos
 − equipamentos e juros
 = lucro do consultório
```

Regras de cálculo relevantes:
- 4,33 semanas por mês (52 ÷ 12)
- No-show separado para particular e convênio; glosas aplicadas só ao convênio
- Taxa de cartão incide apenas sobre a fatia da receita particular paga no cartão
- Insumos entram por consulta (custo variável), não como valor fixo mensal
- Equipe em 2 modos: salário × multiplicador de encargos (padrão 2,0) ou custo total da contabilidade
- Ponto de equilíbrio = custos fixos totais (já com pró-labore) ÷ % de margem de contribuição
- Alíquota de imposto sempre editável, com faixas de referência apenas como ponto de partida

Saída: painel BI ao vivo + one-pager em PDF de 1 página, salvo como "diagnóstico do meu consultório pela Turi Saúde".

**Marca:** somente Turi Saúde (sem Caveo), verde institucional.

---

## Infraestrutura

- **Hospedagem:** GitHub Pages, branch `main`, pasta raiz
- **DNS:** CNAME `painel` → `thiagoliguori.github.io` na Cloudflare, conta **Turi Saúde** (`9b9acc7b802bbf224bcb4a9ceddd5990`), proxy desativado (nuvem cinza, necessário para o certificado)
- **HTTPS:** certificado Let's Encrypt emitido, "Enforce HTTPS" ativo
- **Analytics:** Cloudflare Worker `painel-analytics` + KV `painel_residencias_analytics`
  - `POST /t` com `{"e":"pv","nv":true}` ou `{"e":"click","id":"rotulo"}`
  - `GET /stats?days=N` devolve o agregado
  - Eventos da calculadora usam o prefixo `lucro/`
  - Limite do plano gratuito: 1.000 escritas por dia

Passo a passo completo para novos projetos: `~/Desktop/Claude/playbook-site-github-pages-cloudflare.md`

### Publicar uma alteração

```bash
git add -A && git commit -m "descrição" && git push
```

O GitHub Pages publica em 1 a 3 minutos. Se o push for rejeitado, rode `git pull --rebase` antes: o GitHub cria commits automáticos no `CNAME` quando o domínio é reconfigurado.

---

## Próximos passos sugeridos

**Painel das Residências**
- Revisar os editais marcados como "previsto" conforme forem publicados (agosto a outubro/2026)
- Monitorar Grupo VIV e Rede Américas, citados nos calendários mas ainda sem edital
- Avaliar persistência opcional em localStorage, hoje desativada por decisão de produto

**Meu Lucro no Consultório**
- Considerar deixar o campo de pró-labore vazio em vez de pré-preenchido com R$ 12.000, para não ancorar o médico num número que não é dele
- Possíveis evoluções: simulador de cenários (mudar preço e volume e ver a margem em tempo real), comparação com benchmark de outros usuários, captura opcional de e-mail antes do PDF

**Analytics**
- O dashboard é público por URL não listada; avaliar proteção por senha no Worker se o dado ficar sensível
- Se o volume crescer, migrar o armazenamento do KV (limite de 1.000 escritas/dia no plano gratuito)
