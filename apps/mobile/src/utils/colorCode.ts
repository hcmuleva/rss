interface ColorRule {
  threshold: number;
  color: 'green' | 'yellow' | 'red';
}

export const getColorCode = (percent: number, rules: ColorRule[]): 'green' | 'yellow' | 'red' => {
  const ordered = [...rules].sort((a, b) => a.threshold - b.threshold);
  let result: 'green' | 'yellow' | 'red' = 'green';

  for (const rule of ordered) {
    if (percent >= rule.threshold) {
      result = rule.color;
    }
  }

  return result;
};
