export function parseCommaSeparatedList(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  return [
    ...new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}
