import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  authApi: {
    login: jest.fn(),
  },
}));

function TestComponent() {
  const { user, token, login, logout, isLoading } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user ? user.username : 'no user'}</div>
      <div data-testid="token">{token || 'no token'}</div>
      <button onClick={() => login('testuser', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
  });

  it('初始状态应该是未登录', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no user');
    expect(screen.getByTestId('token')).toHaveTextContent('no token');
  });

  it('应该从 localStorage 恢复用户状态', async () => {
    const storedUser = { id: 1, username: 'stored', name: 'Stored User', role: 'admin' };
    (localStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'token') return 'stored-token';
      if (key === 'user') return JSON.stringify(storedUser);
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('stored');
    expect(screen.getByTestId('token')).toHaveTextContent('stored-token');
  });

  it('应该处理无效的 localStorage 数据', async () => {
    (localStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'token') return 'some-token';
      if (key === 'user') return 'invalid-json';
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no user');
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
  });

  it('login 应该设置用户和 token', async () => {
    const mockUser = { id: 1, username: 'testuser', name: 'Test User', role: 'admin' };
    (authApi.login as jest.Mock).mockResolvedValue({
      data: { token: 'new-token', user: mockUser },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });

    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-token');
    expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
  });

  it('logout 应该清除用户和 token', async () => {
    const storedUser = { id: 1, username: 'user', name: 'User', role: 'admin' };
    (localStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'token') return 'token';
      if (key === 'user') return JSON.stringify(storedUser);
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('user');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Logout'));
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no user');
    expect(screen.getByTestId('token')).toHaveTextContent('no token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
  });

  it('useAuth 在 AuthProvider 外使用应该抛出错误', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    console.error = consoleError;
  });
});
