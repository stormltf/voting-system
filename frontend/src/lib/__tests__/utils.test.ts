import {
  cn,
  formatDate,
  formatNumber,
  formatArea,
  formatPercent,
  voteStatusMap,
  roundStatusMap,
} from '../utils';

describe('cn (className merger)', () => {
  it('应该合并多个类名', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('应该处理条件类名', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('应该合并 Tailwind 类名并处理冲突', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('应该处理空输入', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
  });
});

describe('formatDate', () => {
  it('应该格式化日期字符串', () => {
    const result = formatDate('2024-01-15');
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/1/);
    expect(result).toMatch(/15/);
  });

  it('应该格式化 Date 对象', () => {
    const date = new Date('2024-06-20');
    const result = formatDate(date);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/6/);
    expect(result).toMatch(/20/);
  });

  it('应该对 null 返回 "-"', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('应该对 undefined 返回 "-"', () => {
    expect(formatDate(undefined)).toBe('-');
  });
});

describe('formatNumber', () => {
  it('应该格式化数字', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('应该处理小数字', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(0)).toBe('0');
  });

  it('应该对 null 返回 "-"', () => {
    expect(formatNumber(null)).toBe('-');
  });

  it('应该对 undefined 返回 "-"', () => {
    expect(formatNumber(undefined)).toBe('-');
  });
});

describe('formatArea', () => {
  it('应该格式化面积数字', () => {
    expect(formatArea(123.456)).toBe('123.46 m²');
    expect(formatArea(100)).toBe('100.00 m²');
  });

  it('应该处理字符串数字', () => {
    expect(formatArea('88.88')).toBe('88.88 m²');
    expect(formatArea('100')).toBe('100.00 m²');
  });

  it('应该对 null 返回 "-"', () => {
    expect(formatArea(null)).toBe('-');
  });

  it('应该对 undefined 返回 "-"', () => {
    expect(formatArea(undefined)).toBe('-');
  });

  it('应该对无效字符串返回 "-"', () => {
    expect(formatArea('abc')).toBe('-');
  });
});

describe('formatPercent', () => {
  it('应该计算并格式化百分比', () => {
    expect(formatPercent(50, 100)).toBe('50.0%');
    expect(formatPercent(1, 3)).toBe('33.3%');
    expect(formatPercent(2, 3)).toBe('66.7%');
  });

  it('应该处理 total 为 0 的情况', () => {
    expect(formatPercent(10, 0)).toBe('0%');
  });

  it('应该处理 value 为 0 的情况', () => {
    expect(formatPercent(0, 100)).toBe('0.0%');
  });

  it('应该处理 100% 的情况', () => {
    expect(formatPercent(100, 100)).toBe('100.0%');
  });
});

describe('voteStatusMap', () => {
  it('应该包含所有投票状态', () => {
    expect(voteStatusMap).toHaveProperty('pending');
    expect(voteStatusMap).toHaveProperty('voted');
    expect(voteStatusMap).toHaveProperty('refused');
    expect(voteStatusMap).toHaveProperty('onsite');
    expect(voteStatusMap).toHaveProperty('video');
  });

  it('每个状态应该有 label 和 color', () => {
    Object.values(voteStatusMap).forEach((status) => {
      expect(status).toHaveProperty('label');
      expect(status).toHaveProperty('color');
      expect(typeof status.label).toBe('string');
      expect(typeof status.color).toBe('string');
    });
  });

  it('pending 状态应该是未投票', () => {
    expect(voteStatusMap.pending.label).toBe('未投票');
  });

  it('voted 状态应该是已投票', () => {
    expect(voteStatusMap.voted.label).toBe('已投票');
  });
});

describe('roundStatusMap', () => {
  it('应该包含所有轮次状态', () => {
    expect(roundStatusMap).toHaveProperty('draft');
    expect(roundStatusMap).toHaveProperty('active');
    expect(roundStatusMap).toHaveProperty('closed');
  });

  it('draft 状态应该是草稿', () => {
    expect(roundStatusMap.draft.label).toBe('草稿');
  });

  it('active 状态应该是进行中', () => {
    expect(roundStatusMap.active.label).toBe('进行中');
  });

  it('closed 状态应该是已结束', () => {
    expect(roundStatusMap.closed.label).toBe('已结束');
  });
});
