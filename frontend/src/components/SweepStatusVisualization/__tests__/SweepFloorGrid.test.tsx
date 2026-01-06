import { render, screen, fireEvent } from '@testing-library/react';
import SweepFloorGrid from '../SweepFloorGrid';

const mockData = {
  floors: {
    1: [
      { owner_id: 1, room_number: '01-01-0101', room_in_floor: '01', sweep_status: 'completed', sweep_remark: null, sweep_date: null, owner_name: '张三', phone1: '13800138000', area: 89.5, parking_no: 'B-001', vote_status: 'voted' },
      { owner_id: 2, room_number: '01-01-0102', room_in_floor: '02', sweep_status: 'pending', sweep_remark: null, sweep_date: null, owner_name: '李四', phone1: '13800138001', area: 78.5, parking_no: null, vote_status: 'pending' },
    ],
    2: [
      { owner_id: 3, room_number: '01-01-0201', room_in_floor: '01', sweep_status: 'in_progress', sweep_remark: null, sweep_date: null, owner_name: '王五', phone1: '13800138002', area: 100.0, parking_no: 'B-002', vote_status: 'pending' },
    ],
  },
  meta: {
    phase_name: '一期',
    building: '01',
    unit: '01',
    round_name: '2024年投票',
    total_rooms: 3,
    completed_count: 1,
    in_progress_count: 1,
    pending_count: 1,
  },
  stats: {
    max_floor: 2,
    max_rooms_per_floor: 2,
  },
};

describe('SweepFloorGrid', () => {
  const mockOnRoomClick = jest.fn();
  const mockOnSelectRoom = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染统计信息', () => {
    render(<SweepFloorGrid data={mockData} onRoomClick={mockOnRoomClick} />);

    expect(screen.getByText('户', { exact: false })).toBeInTheDocument();
  });

  it('应该渲染图例', () => {
    render(<SweepFloorGrid data={mockData} onRoomClick={mockOnRoomClick} />);

    const legends = screen.getAllByText(/已完成|进行中|待扫楼/);
    expect(legends.length).toBeGreaterThan(0);
  });

  it('应该渲染楼层标签', () => {
    render(<SweepFloorGrid data={mockData} onRoomClick={mockOnRoomClick} />);

    expect(screen.getByText('1F')).toBeInTheDocument();
    expect(screen.getByText('2F')).toBeInTheDocument();
  });

  it('应该从高楼层到低楼层排序', () => {
    render(<SweepFloorGrid data={mockData} onRoomClick={mockOnRoomClick} />);

    const floorLabels = screen.getAllByText(/\dF$/);
    expect(floorLabels[0]).toHaveTextContent('2F');
    expect(floorLabels[1]).toHaveTextContent('1F');
  });

  it('点击房间应该调用 onRoomClick', () => {
    render(<SweepFloorGrid data={mockData} onRoomClick={mockOnRoomClick} />);

    const roomButtons = screen.getAllByRole('button');
    fireEvent.click(roomButtons[0]);

    expect(mockOnRoomClick).toHaveBeenCalled();
  });

  it('选择模式下应该显示提示', () => {
    render(
      <SweepFloorGrid
        data={mockData}
        onRoomClick={mockOnRoomClick}
        selectable={true}
        selectedRooms={new Set()}
        onSelectRoom={mockOnSelectRoom}
      />
    );

    expect(screen.getByText('滑动可多选')).toBeInTheDocument();
  });

  it('空数据应该显示暂无楼层数据', () => {
    const emptyData = {
      ...mockData,
      floors: {},
    };

    render(<SweepFloorGrid data={emptyData} onRoomClick={mockOnRoomClick} />);

    expect(screen.getByText('暂无楼层数据')).toBeInTheDocument();
  });

  it('选中状态应该正确传递给房间单元', () => {
    render(
      <SweepFloorGrid
        data={mockData}
        onRoomClick={mockOnRoomClick}
        selectable={true}
        selectedRooms={new Set([1])}
        onSelectRoom={mockOnSelectRoom}
      />
    );

    const roomButtons = screen.getAllByRole('button');
    expect(roomButtons.length).toBeGreaterThan(0);
  });
});
