import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar, { MobileMenuButton } from '../Sidebar';
import { communityApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  communityApi: {
    getAll: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'admin', name: '管理员', role: 'super_admin' },
    logout: jest.fn(),
  }),
}));

const mockCommunities = [
  { id: 1, name: '小区A' },
  { id: 2, name: '小区B' },
];

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (communityApi.getAll as jest.Mock).mockResolvedValue({ data: mockCommunities });
    localStorage.getItem = jest.fn().mockReturnValue(null);
    localStorage.setItem = jest.fn();
  });

  it('应该渲染侧边栏标题', async () => {
    render(<Sidebar />);
    
    expect(screen.getByText('投票管理系统')).toBeInTheDocument();
    expect(screen.getByText('业主大会投票')).toBeInTheDocument();
  });

  it('应该渲染导航菜单项', async () => {
    render(<Sidebar />);
    
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('投票管理')).toBeInTheDocument();
    expect(screen.getByText('业主管理')).toBeInTheDocument();
    expect(screen.getByText('小区管理')).toBeInTheDocument();
    expect(screen.getByText('系统设置')).toBeInTheDocument();
  });

  it('应该显示用户信息', async () => {
    render(<Sidebar />);
    
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(screen.getByText('超级管理员')).toBeInTheDocument();
  });

  it('应该加载并显示小区列表', async () => {
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(communityApi.getAll).toHaveBeenCalled();
    });
  });

  it('应该从 localStorage 恢复选中的小区', async () => {
    localStorage.getItem = jest.fn().mockReturnValue('1');
    
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(screen.getByText('小区A')).toBeInTheDocument();
    });
  });

  it('点击小区选择器应该打开下拉菜单', async () => {
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(communityApi.getAll).toHaveBeenCalled();
    });

    const selector = screen.getByRole('button', { name: /小区|请选择/ });
    fireEvent.click(selector);

    await waitFor(() => {
      const options = screen.getAllByText(/小区/);
      expect(options.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('选择小区应该更新 localStorage', async () => {
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(communityApi.getAll).toHaveBeenCalled();
    });

    const selector = screen.getByRole('button', { name: /小区|请选择/ });
    fireEvent.click(selector);

    await waitFor(() => {
      const option = screen.getByText('小区B');
      fireEvent.click(option);
    });

    expect(localStorage.setItem).toHaveBeenCalledWith('selectedCommunityId', '2');
  });

  it('应该有退出登录按钮', () => {
    render(<Sidebar />);
    
    expect(screen.getByTitle('退出登录')).toBeInTheDocument();
  });

  it('isOpen=false 时应该隐藏侧边栏', () => {
    const { container } = render(<Sidebar isOpen={false} />);
    
    expect(container.firstChild).toHaveClass('-translate-x-full');
  });

  it('isOpen=true 时应该显示侧边栏', () => {
    const { container } = render(<Sidebar isOpen={true} />);
    
    expect(container.firstChild).toHaveClass('translate-x-0');
  });

  it('点击关闭按钮应该调用 onClose', () => {
    const onClose = jest.fn();
    render(<Sidebar isOpen={true} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('关闭菜单');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('点击导航链接应该关闭移动端侧边栏', () => {
    const onClose = jest.fn();
    render(<Sidebar isOpen={true} onClose={onClose} />);
    
    const homeLink = screen.getByText('首页');
    fireEvent.click(homeLink);

    expect(onClose).toHaveBeenCalled();
  });

  it('应该处理加载小区失败的情况', async () => {
    (communityApi.getAll as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(communityApi.getAll).toHaveBeenCalled();
    });
  });

  it('点击外部应该关闭下拉菜单', async () => {
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(communityApi.getAll).toHaveBeenCalled();
    });

    const selector = screen.getByRole('button', { name: /小区|请选择/ });
    fireEvent.click(selector);

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      const dropdown = screen.queryByRole('listbox');
      expect(dropdown).not.toBeInTheDocument();
    });
  });
});

describe('MobileMenuButton', () => {
  it('应该渲染菜单按钮', () => {
    render(<MobileMenuButton onClick={jest.fn()} />);
    
    expect(screen.getByLabelText('打开菜单')).toBeInTheDocument();
  });

  it('点击按钮应该调用 onClick', () => {
    const onClick = jest.fn();
    render(<MobileMenuButton onClick={onClick} />);
    
    fireEvent.click(screen.getByLabelText('打开菜单'));

    expect(onClick).toHaveBeenCalled();
  });
});
