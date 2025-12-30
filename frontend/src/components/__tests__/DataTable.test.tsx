import { render, screen, fireEvent } from '@testing-library/react';
import DataTable from '../DataTable';

interface TestData {
  id: number;
  name: string;
  email: string;
}

const mockColumns = [
  { key: 'name', header: '姓名' },
  { key: 'email', header: '邮箱' },
];

const mockData: TestData[] = [
  { id: 1, name: '张三', email: 'zhangsan@example.com' },
  { id: 2, name: '李四', email: 'lisi@example.com' },
  { id: 3, name: '王五', email: 'wangwu@example.com' },
];

describe('DataTable', () => {
  it('应该渲染表头', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('邮箱')).toBeInTheDocument();
  });

  it('应该渲染数据行', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(screen.getByText('王五')).toBeInTheDocument();
    expect(screen.getByText('zhangsan@example.com')).toBeInTheDocument();
  });

  it('应该显示加载状态', () => {
    render(<DataTable columns={mockColumns} data={[]} loading={true} />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('应该显示空数据状态', () => {
    render(<DataTable columns={mockColumns} data={[]} />);

    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('应该支持自定义渲染函数', () => {
    const columnsWithRender = [
      { key: 'name', header: '姓名' },
      {
        key: 'email',
        header: '邮箱',
        render: (item: TestData) => <strong>{item.email}</strong>,
      },
    ];

    render(<DataTable columns={columnsWithRender} data={mockData} />);

    const strongElements = screen.getAllByText(/example\.com/);
    expect(strongElements[0].tagName).toBe('STRONG');
  });

  it('应该处理行点击事件', () => {
    const handleRowClick = jest.fn();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onRowClick={handleRowClick}
      />
    );

    fireEvent.click(screen.getByText('张三'));

    expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  describe('分页功能', () => {
    const pagination = {
      page: 2,
      limit: 10,
      total: 35,
      totalPages: 4,
    };

    it('应该显示分页信息', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={pagination}
        />
      );

      expect(screen.getByText(/共 35 条/)).toBeInTheDocument();
      expect(screen.getByText(/第 2\/4 页/)).toBeInTheDocument();
    });

    it('应该处理页码变化', () => {
      const handlePageChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      );

      // 点击下一页
      const buttons = screen.getAllByRole('button');
      // 按钮顺序: 第一页, 上一页, 下一页, 最后一页
      fireEvent.click(buttons[2]); // 下一页按钮

      expect(handlePageChange).toHaveBeenCalledWith(3);
    });

    it('在第一页时应该禁用上一页和第一页按钮', () => {
      const paginationFirstPage = { ...pagination, page: 1 };

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={paginationFirstPage}
          onPageChange={jest.fn()}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toBeDisabled(); // 第一页按钮
      expect(buttons[1]).toBeDisabled(); // 上一页按钮
    });

    it('在最后一页时应该禁用下一页和最后一页按钮', () => {
      const paginationLastPage = { ...pagination, page: 4 };

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={paginationLastPage}
          onPageChange={jest.fn()}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons[2]).toBeDisabled(); // 下一页按钮
      expect(buttons[3]).toBeDisabled(); // 最后一页按钮
    });
  });

  describe('选择功能', () => {
    it('应该显示全选复选框', () => {
      const handleSelectChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onSelectChange={handleSelectChange}
          selectedIds={[]}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(4); // 1 全选 + 3 行
    });

    it('应该处理单行选择', () => {
      const handleSelectChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onSelectChange={handleSelectChange}
          selectedIds={[]}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // 第一行的复选框

      expect(handleSelectChange).toHaveBeenCalledWith([1]);
    });

    it('应该处理全选操作', () => {
      const handleSelectChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onSelectChange={handleSelectChange}
          selectedIds={[]}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // 全选复选框

      expect(handleSelectChange).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('全选已选中时应该取消全选', () => {
      const handleSelectChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onSelectChange={handleSelectChange}
          selectedIds={[1, 2, 3]}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      expect(handleSelectChange).toHaveBeenCalledWith([]);
    });
  });

  it('应该处理缺失的数据字段', () => {
    const dataWithMissing = [
      { id: 1, name: '张三' }, // 缺少 email
    ];

    render(
      <DataTable
        columns={mockColumns}
        data={dataWithMissing as TestData[]}
      />
    );

    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument(); // 缺失字段显示为 -
  });
});
