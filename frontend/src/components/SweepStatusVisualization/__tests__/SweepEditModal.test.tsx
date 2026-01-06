import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SweepEditModal from '../SweepEditModal';
import { voteApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  voteApi: {
    updateSweepStatus: jest.fn(),
  },
}));

const mockRoom = {
  owner_id: 1,
  room_number: '01-01-0101',
  room_in_floor: '01',
  sweep_status: 'pending',
  sweep_remark: '',
  owner_name: '张三',
  phone1: '13800138000',
  area: 89.5,
  parking_no: 'B-001',
};

describe('SweepEditModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSaved = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (voteApi.updateSweepStatus as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('应该渲染房间信息', () => {
    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('01-01-0101')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('13800138000')).toBeInTheDocument();
    expect(screen.getByText('89.5 m²')).toBeInTheDocument();
    expect(screen.getByText('B-001')).toBeInTheDocument();
  });

  it('应该显示扫楼状态选项', () => {
    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('待扫楼')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
  });

  it('点击关闭按钮应该调用 onClose', () => {
    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.querySelector('.lucide-x'));
    if (closeButton) {
      fireEvent.click(closeButton);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('点击取消按钮应该调用 onClose', () => {
    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('取消'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('点击保存按钮应该保存数据', async () => {
    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(voteApi.updateSweepStatus).toHaveBeenCalledWith(1, {
        round_id: 1,
        sweep_status: 'pending',
        sweep_remark: '',
      });
    });

    expect(mockOnSaved).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('选择扫楼状态应该更新状态', async () => {
    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('已完成'));
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(voteApi.updateSweepStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        sweep_status: 'completed',
      }));
    });
  });

  it('输入备注应该更新备注', async () => {
    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const remarkInput = screen.getByPlaceholderText('添加备注信息...');
    fireEvent.change(remarkInput, { target: { value: '测试备注' } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(voteApi.updateSweepStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        sweep_remark: '测试备注',
      }));
    });
  });

  it('保存失败应该显示错误信息', async () => {
    (voteApi.updateSweepStatus as jest.Mock).mockRejectedValue({
      response: { data: { error: '保存失败' } },
    });

    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(screen.getByText('保存失败')).toBeInTheDocument();
    });
  });

  it('保存失败无响应时应该显示默认错误', async () => {
    (voteApi.updateSweepStatus as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(
      <SweepEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(screen.getByText('保存失败')).toBeInTheDocument();
    });
  });

  it('应该处理空值字段', () => {
    const roomWithEmptyFields = {
      ...mockRoom,
      owner_name: undefined,
      phone1: undefined,
      area: undefined,
      parking_no: undefined,
    };

    render(
      <SweepEditModal
        room={roomWithEmptyFields}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(4);
  });

  it('应该显示现有备注', () => {
    const roomWithRemark = {
      ...mockRoom,
      sweep_remark: '已有备注',
    };

    render(
      <SweepEditModal
        room={roomWithRemark}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const remarkInput = screen.getByPlaceholderText('添加备注信息...');
    expect(remarkInput).toHaveValue('已有备注');
  });
});
