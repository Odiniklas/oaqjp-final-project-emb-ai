// Gemeinsam von Remotion-Komposition und Tests genutzt.
/* Untertitel-Gruppen: höchstens 3 Wörter, nie über ein Satzende hinweg */
export function captionGroups(words) {
  const groups = []; let cur = [];
  words.forEach((w, i) => { cur.push(i); if (cur.length === 3 || (/[.!?:]$/.test(w.w) && !/^\d+\.$/.test(w.w))) { groups.push(cur); cur = []; } });
  if (cur.length) groups.push(cur);
  return groups;
}
