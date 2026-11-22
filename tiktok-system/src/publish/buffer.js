// Buffer-Adapter (GraphQL). Status: nicht gegen das Live-API getestet – erst `cli.js check` mit Token ausführen.
import fs from 'node:fs';
import { p } from '../lib/util.js';

const url = () => process.env.BUFFER_API_URL || 'https://api.buffer.com';
export async function gql(query, variables = {}, { fetchImpl = fetch } = {}) {
  const token = process.env.BUFFER_ACCESS_TOKEN; if (!token) throw new Error('BUFFER_ACCESS_TOKEN fehlt');
  const r = await fetchImpl(url(), { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { throw new Error(`Buffer ${r.status}: ${text.slice(0, 200)}`); }
  if (!r.ok || j.errors) throw new Error(`Buffer ${r.status}: ${JSON.stringify(j.errors || j).slice(0, 300)}`);
  return j.data;
}
export function operation(name) {
  const src = fs.readFileSync(p('config', 'buffer.graphql'), 'utf8').replace(/^#.*$/gm, '');
  const m = src.match(new RegExp(`((?:mutation|query)\\s+${name}\\b[\\s\\S]*?)(?=\\n(?:mutation|query)\\s|$)`));
  if (!m) throw new Error(`Operation ${name} fehlt in config/buffer.graphql`); return m[1].trim();
}
/* Integrationstest: Introspection – zeigt, welche Mutationen das Live-Schema wirklich anbietet */
export async function check(opts) {
  const d = await gql('{ __schema { queryType { fields { name } } mutationType { fields { name } } } }', {}, opts);
  const muts = (d.__schema.mutationType?.fields || []).map(f => f.name), qs = (d.__schema.queryType?.fields || []).map(f => f.name);
  return { ok: true, mutations: muts, queries: qs, createPostAvailable: muts.includes('createPost') };
}
export async function schedule({ channelId, text, videoUrl, dueAt, comment }, opts) {
  const input = { channelId, text, schedulingType: dueAt ? 'customScheduled' : 'automatic', ...(dueAt ? { dueAt } : {}), assets: { videos: [{ url: videoUrl }] }, ...(comment ? { metadata: { tiktok: { firstComment: comment } } } : {}) };
  const d = await gql(operation('CreatePost'), { input }, opts);
  const res = d.createPost || {}; if (res.message) throw new Error('Buffer: ' + res.message);
  if (!res.post?.id) throw new Error('Buffer: keine Post-ID erhalten'); return res.post;
}
export async function status(postId, opts) { const d = await gql(operation('PostStatus'), { id: postId }, opts); return d.post; }
