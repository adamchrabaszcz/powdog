// Folding long lists of similar messages into a few readable lines: data problems that repeat for
// every spot, and the reasons spots were excluded when a mode has nothing to offer.

/** The same message with numbers and the leading "spot-id: " taken out, to group look-alikes. */
const shape = (text: string) => text.replace(/^[a-z0-9-]+: /, '').replace(/\d+(\.\d+)?/g, '#');

export interface Group {
  /** One real example of the message. */
  example: string;
  count: number;
}

/** Groups look-alike messages, most frequent first. */
export function group(messages: string[]): Group[] {
  const groups = new Map<string, Group>();
  for (const m of messages) {
    const key = shape(m);
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { example: m, count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/** Data problems, one line per kind: "snowfall from icon_d2 has 813 of 1512 hours missing (18 spots, e.g. szrenica)". */
export function summariseProblems(problems: string[]): string[] {
  return group(problems).map(({ example, count }) => {
    if (count === 1) return example;
    const [spot, ...rest] = example.split(': ');
    return rest.length ? `${rest.join(': ')} (${count} spots, e.g. ${spot})` : `${example} (${count}×)`;
  });
}

/** The most common reasons spots were excluded, e.g. "not sunny enough (12 spots)". */
export function whyNothing(excludedReasons: string[], top = 2): string[] {
  return group(excludedReasons)
    .slice(0, top)
    .map(({ example, count }) => `${example.replace(/^[^:]*\d[^:]*: /, '')} (${count} ${count === 1 ? 'spot' : 'spots'})`);
}
