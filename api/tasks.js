// Vercel Serverless Function for VP S08 tasks.
// Required environment variables:
// SUPABASE_URL = https://YOUR_PROJECT.supabase.co
// SUPABASE_PUBLISHABLE_KEY = sb_publishable_...

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const TABLE = "vp_s08_tasks";

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function validatePayload(body) {
  const incoming = Array.isArray(body) ? body : body?.tasks;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw new Error('JSON faile nerastas netuščias "tasks" masyvas.');
  }

  const tasks = incoming.map((t, i) => {
    if (!t || typeof t !== "object" || typeof t.title !== "string" || !t.title.trim()) {
      throw new Error(`Neteisinga užduotis #${i + 1}.`);
    }
    return {
      title: t.title.trim(),
      owner: String(t.owner ?? "—"),
      deadline: String(t.deadline ?? "—"),
      plannedStatus: ["todo", "doing", "done"].includes(t.plannedStatus)
        ? t.plannedStatus
        : "todo",
      completed: t.completed === true,
    };
  });

  return { version: 1, project: "VP S08", tasks };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: "Vercel environment variables not configured." });
  }

  try {
    if (req.method === "GET") {
      const url = `${SUPABASE_URL}/rest/v1/${TABLE}?select=id,data,updated_at&order=id.asc&limit=1`;
      const r = await fetch(url, { headers: headers() });
      const rows = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: rows?.message || "Supabase error" });

      const row = rows?.[0];
      if (!row?.data?.tasks) return res.status(404).json({ error: "No tasks saved yet." });

      return res.status(200).json({
        ...row.data,
        updatedAt: row.updated_at,
      });
    }

    if (req.method === "POST") {
      const payload = validatePayload(req.body);

      const lookup = `${SUPABASE_URL}/rest/v1/${TABLE}?select=id&order=id.asc&limit=1`;
      const get = await fetch(lookup, { headers: headers() });
      const rows = await get.json();
      if (!get.ok) return res.status(get.status).json({ error: rows?.message || "Supabase error" });

      let r;
      if (rows?.[0]?.id) {
        r = await fetch(
          `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${rows[0].id}`,
          {
            method: "PATCH",
            headers: headers({ Prefer: "return=representation" }),
            body: JSON.stringify({ data: payload, updated_at: new Date().toISOString() }),
          }
        );
      } else {
        r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
          method: "POST",
          headers: headers({ Prefer: "return=representation" }),
          body: JSON.stringify({ data: payload }),
        });
      }

      const result = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: result?.message || "Supabase error" });

      return res.status(200).json(payload);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Bad request" });
  }
}
