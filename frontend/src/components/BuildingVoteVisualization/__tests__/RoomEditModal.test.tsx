import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RoomEditModal from '../RoomEditModal';
import { voteApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  voteApi: {
    saveVote: jest.fn(),
  },
}));

const mockRoom = {
  owner_id: 1,
  room_number: '01-01-0101',
  room_in_floor: '01',
  vote_status: 'pending',
  remark: '',
  owner_name: '张三',
  phone1: '13800138000',
  area: 89.5,
  parking_no: 'B-001',
  sweep_status: 'pending',
};

describe('RoomEditModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSaved = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (voteApi.saveVote as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('应该渲染房间信息', () => {
    render(
      <RoomEditModal
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

  it('应该显示投票状态选项', () => {
    render(
      <RoomEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('待投票')).toBeInTheDocument();
    expect(screen.getByText('已投票')).toBeInTheDocument();
    expect(screen.getByText('拒绝')).toBeInTheDocument();
  });

  it('点击关闭按钮应该调用 onClose', () => {
    render(
      <RoomEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.querySelector('svg'));
    if (closeButton) {
      fireEvent.click(closeButton);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('点击取消按钮应该调用 onClose', () => {
    render(
      <RoomEditModal
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
      <RoomEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(voteApi.saveVote).toHaveBeenCalledWith(expect.objectContaining({
        owner_id: 1,
        round_id: 1,
        vote_status: 'pending',
      }));
    });

    expect(mockOnSaved).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('选择投票状态应该更新状态', async () => {
    render(
      <RoomEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('已投票'));
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(voteApi.saveVote).toHaveBeenCalledWith(expect.objectContaining({
        vote_status: 'voted',
      }));
    });
  });

  it('输入备注应该更新备注', async () => {
    render(
      <RoomEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const remarkInput = screen.getByPlaceholderText('添加备注...');
    fireEvent.change(remarkInput, { target: { value: '测试备注' } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(voteApi.saveVote).toHaveBeenCalledWith(expect.objectContaining({
        remark: '测试备注',
      }));
    });
  });

  it('保存失败应该显示错误', async () => {
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    (voteApi.saveVote as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(
      <RoomEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('保存失败');
    });

    alertMock.mockRestore();
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
      <RoomEditModal
        room={roomWithEmptyFields}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('未知业主')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(3);
  });

  it('选择扫楼状态应该更新状态', async () => {
    render(
      <RoomEditModal
        room={mockRoom}
        roundId={1}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    fireEvent.click(screen.getByText('已完成'));
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(voteApi.saveVote).toHaveBeenCalledWith(expect.objectContaining({
        sweep_status: 'completed',
      }));
    });
  });
});
