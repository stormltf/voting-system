import { render, screen, fireEvent } from '@testing-library/react';
import FloorGrid from '../FloorGrid';
import { UnitRoomsResponse } from '../types';

const mockData: UnitRoomsResponse = {
  floors: {
    1: [
      { owner_id: 1, room_number: '01-01-0101', room_in_floor: '01', vote_status: 'pending' },
      { owner_id: 2, room_number: '01-01-0102', room_in_floor: '02', vote_status: 'voted' },
    ],
    2: [
      { owner_id: 3, room_number: '01-01-0201', room_in_floor: '01', vote_status: 'refused' },
      { owner_id: 4, room_number: '01-01-0202', room_in_floor: '02', vote_status: 'pending' },
    ],
  },
  meta: {
    phase_id: 1,
    phase_name: '一期',
    building: '01',
    unit: '01',
    total_rooms: 4,
    voted_count: 1,
    refused_count: 1,
    pending_count: 2,
  },
};

describe('FloorGrid', () => {
  it('应该渲染统计信息', () => {
    render(<FloorGrid data={mockData} onRoomClick={jest.fn()} />);
    
    expect(screen.getByText('一期')).toBeInTheDocument();
    expect(screen.getByText('01号楼 01单元')).toBeInTheDocument();
    expect(screen.getByText('共 4 户')).toBeInTheDocument();
  });

  it('应该渲染投票状态统计', () => {
    render(<FloorGrid data={mockData} onRoomClick={jest.fn()} />);
    
    expect(screen.getByText('已投票 1')).toBeInTheDocument();
    expect(screen.getByText('拒绝 1')).toBeInTheDocument();
    expect(screen.getByText('待投票 2')).toBeInTheDocument();
  });

  it('应该渲染楼层标签', () => {
    render(<FloorGrid data={mockData} onRoomClick={jest.fn()} />);
    
    expect(screen.getByText('1F')).toBeInTheDocument();
    expect(screen.getByText('2F')).toBeInTheDocument();
  });

  it('楼层应该从高到低排列', () => {
    const { container } = render(<FloorGrid data={mockData} onRoomClick={jest.fn()} />);
    
    const floors = container.querySelectorAll('.text-xs.font-medium.text-slate-500');
    expect(floors[0]).toHaveTextContent('2F');
    expect(floors[1]).toHaveTextContent('1F');
  });

  it('点击房间应该调用 onRoomClick', () => {
    const onRoomClick = jest.fn();
    render(<FloorGrid data={mockData} onRoomClick={onRoomClick} />);
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    
    expect(onRoomClick).toHaveBeenCalled();
  });

  it('可选择模式应该显示提示', () => {
    render(
      <FloorGrid
        data={mockData}
        onRoomClick={jest.fn()}
        selectable={true}
        selectedRooms={new Set()}
        onSelectRoom={jest.fn()}
      />
    );
    
    expect(screen.getByText('滑动可多选')).toBeInTheDocument();
  });

  it('空数据应该显示提示', () => {
    const emptyData: UnitRoomsResponse = {
      floors: {},
      meta: {
        phase_id: 1,
        phase_name: '一期',
        building: '01',
        unit: '01',
        total_rooms: 0,
        voted_count: 0,
        refused_count: 0,
        pending_count: 0,
      },
    };
    
    render(<FloorGrid data={emptyData} onRoomClick={jest.fn()} />);
    
    expect(screen.getByText('该单元没有房间数据')).toBeInTheDocument();
  });

  it('应该正确传递选中状态', () => {
    const selectedRooms = new Set([3, 4]);
    
    render(
      <FloorGrid
        data={mockData}
        onRoomClick={jest.fn()}
        selectable={true}
        selectedRooms={selectedRooms}
        onSelectRoom={jest.fn()}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('data-selected', 'true');
  });

  it('onSelectRoom 应该被调用', () => {
    const onSelectRoom = jest.fn();
    
    render(
      <FloorGrid
        data={mockData}
        onRoomClick={jest.fn()}
        selectable={true}
        selectedRooms={new Set()}
        onSelectRoom={onSelectRoom}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    
    expect(onSelectRoom).toHaveBeenCalled();
  });

  it('应该过滤负楼层', () => {
    const dataWithNegativeFloor: UnitRoomsResponse = {
      floors: {
        '-1': [{ owner_id: 5, room_number: 'B1-01', room_in_floor: '01', vote_status: 'pending' }],
        1: [{ owner_id: 1, room_number: '01-01-0101', room_in_floor: '01', vote_status: 'pending' }],
      },
      meta: mockData.meta,
    };
    
    render(<FloorGrid data={dataWithNegativeFloor} onRoomClick={jest.fn()} />);
    
    expect(screen.getByText('1F')).toBeInTheDocument();
    expect(screen.queryByText('-1F')).not.toBeInTheDocument();
  });
});
