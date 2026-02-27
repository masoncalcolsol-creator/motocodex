export function buildDailyBrief(args: {
  dateLabel: string;
  topFacts: { headline: string; bullets: string[] }[];
  includeNocturnus?: boolean;
}) {
  const { dateLabel, topFacts, includeNocturnus } = args;

  const lines: string[] = [];
  lines.push("This is Dax.");
  lines.push("");
  lines.push("And this is MotoCodex — your quick catch-up.");
  lines.push("");
  lines.push(`Today is ${dateLabel}.`);
  lines.push("");
  lines.push("Here’s what matters, in plain English.");
  lines.push("");

  topFacts.forEach((f, i) => {
    lines.push(`${i + 1}) ${f.headline}`);
    f.bullets.slice(0, 4).forEach((b) => lines.push(`- ${b}`));
    lines.push("");
  });

  lines.push("That’s your update.");
  lines.push("If something breaks, you’ll see it here first.");
  lines.push("");

  if (includeNocturnus) {
    lines.push("[Professor Nocturnus]");
    lines.push("Good evening.");
    lines.push("If you just tuned in: watch how pressure changes decisions.");
    lines.push("Momentum feels exciting. Structure tells the truth.");
    lines.push("Observe.");
    lines.push("");
  }

  return lines.join("\n");
}
