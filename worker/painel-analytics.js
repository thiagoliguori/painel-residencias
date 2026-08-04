/**
 * Worker painel-analytics (conta Cloudflare "Turi Saúde")
 * URL: https://painel-analytics.turi-sa-de.workers.dev
 * Binding de KV: TRACK  ->  namespace "painel_residencias_analytics"
 *
 * Endpoints
 *   POST /t      { e:"pv", nv:true } | { e:"click", id:"rotulo" }   analytics anônimo
 *   GET  /stats?days=N                                              agregado para o dashboard
 *   POST /lead   { nome, sobrenome, email, whatsapp, especialidade, uf, consentimento, origem }
 *   GET  /leads?key=SEGREDO[&format=csv]                            leitura protegida dos leads
 *
 * Variáveis de ambiente (Configurações > Variáveis, marcar "Criptografar"):
 *   LEADS_KEY      segredo que protege GET /leads. Sem ela a rota fica fechada.
 *   SLACK_WEBHOOK  URL do Incoming Webhook do Slack. Se ausente, o aviso é ignorado.
 *
 * ATENÇÃO: este repositório é público. Nenhum segredo pode ser escrito neste arquivo.
 * Os leads são dado pessoal: nunca deixe /leads sem chave.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });

const hoje = () => new Date().toISOString().slice(0, 10);

/* Avisa o time no Slack. Nunca derruba a resposta ao site se o Slack falhar. */
async function avisarSlack(env, lead, novo) {
  if (!env.SLACK_WEBHOOK) return;
  const tel = lead.whatsapp;
  const bonito = tel.length >= 10
    ? `(${tel.slice(0, 2)}) ${tel.slice(2, tel.length - 4)}-${tel.slice(-4)}`
    : tel;
  const linkWa = `https://wa.me/55${tel}`;
  const origem = lead.origem === "meta" ? "anúncio do Meta" : lead.origem;

  const texto =
    `*${lead.nome} ${lead.sobrenome}* ${novo ? "" : "_(voltou a baixar)_"}\n` +
    `• Especialidade: ${lead.especialidade} · ${lead.uf}\n` +
    `• E-mail: ${lead.email}\n` +
    `• WhatsApp: <${linkWa}|${bonito}>\n` +
    `• Origem: ${origem}\n` +
    `_Aceitou receber contato sobre IA para clínicas._`;

  await fetch(env.SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `Novo lead do Meu Lucro no Consultório: ${lead.nome} ${lead.sobrenome}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "🩺 Novo lead: Meu Lucro no Consultório", emoji: true },
        },
        { type: "section", text: { type: "mrkdwn", text: texto } },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Chamar no WhatsApp", emoji: true },
              url: linkWa,
              style: "primary",
            },
          ],
        },
      ],
    }),
  }).catch(() => {});
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    /* ---------- analytics ---------- */
    if (req.method === "POST" && url.pathname === "/t") {
      const b = await req.json().catch(() => ({}));
      const d = hoje();
      const keys = [];
      if (b.e === "pv") {
        keys.push("pv:" + d);
        if (b.nv) keys.push("uv:" + d);
      } else if (b.e === "click" && b.id) {
        keys.push("ck:" + d + ":" + String(b.id).slice(0, 60));
      }
      for (const k of keys) {
        const atual = parseInt((await env.TRACK.get(k)) || "0", 10);
        await env.TRACK.put(k, String(atual + 1));
      }
      return json({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/stats") {
      const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 90);
      const dias = [];
      const base = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const dt = new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10);
        dias.push({
          dia: dt,
          visitas: parseInt((await env.TRACK.get("pv:" + dt)) || "0", 10),
          visitantes: parseInt((await env.TRACK.get("uv:" + dt)) || "0", 10),
        });
      }
      const cliques = {};
      const lista = await env.TRACK.list({ prefix: "ck:" });
      for (const k of lista.keys) {
        const id = k.name.split(":").slice(2).join(":");
        cliques[id] = (cliques[id] || 0) + parseInt((await env.TRACK.get(k.name)) || "0", 10);
      }
      const leads = await env.TRACK.list({ prefix: "lead:" });
      return json({ dias, cliques, totalLeads: leads.keys.length });
    }

    /* ---------- captura de lead ---------- */
    if (req.method === "POST" && url.pathname === "/lead") {
      const b = await req.json().catch(() => ({}));
      const txt = (v, max) => String(v || "").trim().slice(0, max);

      const lead = {
        nome: txt(b.nome, 40),
        sobrenome: txt(b.sobrenome, 60),
        email: txt(b.email, 80).toLowerCase(),
        whatsapp: txt(b.whatsapp, 15).replace(/\D/g, ""),
        especialidade: txt(b.especialidade, 60),
        uf: txt(b.uf, 2).toUpperCase(),
        consentimento: b.consentimento === true,
        origem: txt(b.origem, 20),
        criado_em: new Date().toISOString(),
      };

      const valido =
        lead.nome.length >= 2 &&
        lead.sobrenome.length >= 2 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email) &&
        lead.whatsapp.length >= 10 &&
        lead.especialidade &&
        lead.uf.length === 2 &&
        lead.consentimento;

      if (!valido) return json({ ok: false, erro: "dados incompletos" }, 400);

      // e-mail como chave evita duplicar quem baixa o PDF mais de uma vez
      const chave = "lead:" + lead.email;
      const anterior = await env.TRACK.get(chave, "json");
      if (anterior) lead.criado_em = anterior.criado_em;
      await env.TRACK.put(chave, JSON.stringify(lead));

      const d = hoje();
      const n = parseInt((await env.TRACK.get("ld:" + d)) || "0", 10);
      await env.TRACK.put("ld:" + d, String(n + 1));

      // o aviso no Slack roda depois da resposta, para não atrasar o download do PDF
      ctx.waitUntil(avisarSlack(env, lead, !anterior));

      return json({ ok: true, novo: !anterior });
    }

    /* ---------- leitura protegida ---------- */
    if (req.method === "GET" && url.pathname === "/leads") {
      if (!env.LEADS_KEY || url.searchParams.get("key") !== env.LEADS_KEY)
        return json({ erro: "não autorizado" }, 401);

      const lista = await env.TRACK.list({ prefix: "lead:" });
      const leads = [];
      for (const k of lista.keys) {
        const l = await env.TRACK.get(k.name, "json");
        if (l) leads.push(l);
      }
      leads.sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));

      if (url.searchParams.get("format") === "csv") {
        const cols = ["criado_em", "nome", "sobrenome", "email", "whatsapp", "especialidade", "uf", "origem", "consentimento"];
        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csv = [cols.join(","), ...leads.map((l) => cols.map((c) => esc(l[c])).join(","))].join("\n");
        return new Response("﻿" + csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="leads-turi.csv"',
            ...CORS,
          },
        });
      }
      return json({ total: leads.length, leads });
    }

    return json({ erro: "rota desconhecida" }, 404);
  },
};
