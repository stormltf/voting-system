import { render, screen } from '@testing-library/react';
import StatsCard from '../StatsCard';
import { Users } from 'lucide-react';

describe('StatsCard', () => {
  it('应该渲染标题和数值', () => {
    render(<StatsCard title="总业主数" value={1234} />);

    expect(screen.getByText('总业主数')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('应该渲染字符串类型的数值', () => {
    render(<StatsCard title="投票率" value="85.5%" />);

    expect(screen.getByText('投票率')).toBeInTheDocument();
    expect(screen.getByText('85.5%')).toBeInTheDocument();
  });

  it('应该渲染副标题', () => {
    render(
      <StatsCard title="总业主数" value={100} subtitle="来自3个小区" />
    );

    expect(screen.getByText('来自3个小区')).toBeInTheDocument();
  });

  it('应该渲染图标', () => {
    render(<StatsCard title="业主" value={50} icon={Users} />);

    // 检查 SVG 元素是否存在
    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  it('应该渲染正向趋势', () => {
    render(
      <StatsCard
        title="投票数"
        value={500}
        trend={{ value: 10, label: '较上周' }}
      />
    );

    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/10%/)).toBeInTheDocument();
    expect(screen.getByText(/较上周/)).toBeInTheDocument();
  });

  it('应该渲染负向趋势', () => {
    render(
      <StatsCard
        title="拒投数"
        value={20}
        trend={{ value: -5, label: '较上周' }}
      />
    );

    expect(screen.getByText(/↓/)).toBeInTheDocument();
    expect(screen.getByText(/5%/)).toBeInTheDocument();
  });

  it('应该应用自定义类名', () => {
    const { container } = render(
      <StatsCard title="测试" value={1} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('应该应用不同的颜色主题', () => {
    const { container, rerender } = render(
      <StatsCard title="测试" value={1} color="blue" />
    );

    // 颜色现在使用渐变背景
    expect(container.firstChild).toHaveClass('from-blue-50');

    rerender(<StatsCard title="测试" value={1} color="green" />);
    expect(container.firstChild).toHaveClass('from-emerald-50');

    rerender(<StatsCard title="测试" value={1} color="red" />);
    expect(container.firstChild).toHaveClass('from-red-50');
  });

  it('默认颜色应该是白色背景', () => {
    const { container } = render(<StatsCard title="测试" value={1} />);

    expect(container.firstChild).toHaveClass('bg-white');
  });
});
