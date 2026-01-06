import { render, screen, fireEvent } from '@testing-library/react';
import MobileNav, { MobileOverlay } from '../MobileNav';

describe('MobileNav', () => {
  it('应该渲染标题', () => {
    render(<MobileNav isOpen={false} onToggle={jest.fn()} />);
    
    expect(screen.getByText('投票管理系统')).toBeInTheDocument();
  });

  it('应该渲染自定义标题', () => {
    render(<MobileNav isOpen={false} onToggle={jest.fn()} title="自定义标题" />);
    
    expect(screen.getByText('自定义标题')).toBeInTheDocument();
  });

  it('关闭状态应该显示打开菜单图标', () => {
    render(<MobileNav isOpen={false} onToggle={jest.fn()} />);
    
    expect(screen.getByLabelText('打开菜单')).toBeInTheDocument();
  });

  it('打开状态应该显示关闭菜单图标', () => {
    render(<MobileNav isOpen={true} onToggle={jest.fn()} />);
    
    expect(screen.getByLabelText('关闭菜单')).toBeInTheDocument();
  });

  it('点击按钮应该调用 onToggle', () => {
    const onToggle = jest.fn();
    render(<MobileNav isOpen={false} onToggle={onToggle} />);
    
    fireEvent.click(screen.getByLabelText('打开菜单'));
    
    expect(onToggle).toHaveBeenCalled();
  });
});

describe('MobileOverlay', () => {
  it('打开状态应该显示遮罩层', () => {
    const { container } = render(<MobileOverlay isOpen={true} onClose={jest.fn()} />);
    
    expect(container.firstChild).toHaveClass('opacity-100');
    expect(container.firstChild).not.toHaveClass('pointer-events-none');
  });

  it('关闭状态应该隐藏遮罩层', () => {
    const { container } = render(<MobileOverlay isOpen={false} onClose={jest.fn()} />);
    
    expect(container.firstChild).toHaveClass('opacity-0');
    expect(container.firstChild).toHaveClass('pointer-events-none');
  });

  it('点击遮罩层应该调用 onClose', () => {
    const onClose = jest.fn();
    const { container } = render(<MobileOverlay isOpen={true} onClose={onClose} />);
    
    fireEvent.click(container.firstChild as Element);
    
    expect(onClose).toHaveBeenCalled();
  });
});
