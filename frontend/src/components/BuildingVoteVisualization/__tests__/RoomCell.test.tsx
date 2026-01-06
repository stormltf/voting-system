import { render, screen, fireEvent } from '@testing-library/react';
import RoomCell from '../RoomCell';
import { RoomData } from '../types';

const mockRoom: RoomData = {
  owner_id: 1,
  room_number: '01-01-0101',
  room_in_floor: '01',
  owner_name: '张三',
  phone1: '13800138000',
  area: 89.5,
  vote_status: 'pending',
  remark: '测试备注',
};

describe('RoomCell', () => {
  it('应该渲染房间号', () => {
    render(<RoomCell room={mockRoom} onClick={jest.fn()} />);
    
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('点击应该调用 onClick', () => {
    const onClick = jest.fn();
    render(<RoomCell room={mockRoom} onClick={onClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(onClick).toHaveBeenCalled();
  });

  it('鼠标悬停应该显示提示框', () => {
    render(<RoomCell room={mockRoom} onClick={jest.fn()} />);
    
    fireEvent.mouseEnter(screen.getByRole('button'));
    
    expect(screen.getByText('01-01-0101')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('13800138000')).toBeInTheDocument();
    expect(screen.getByText('89.5 m²')).toBeInTheDocument();
    expect(screen.getByText('测试备注')).toBeInTheDocument();
  });

  it('鼠标离开应该隐藏提示框', () => {
    render(<RoomCell room={mockRoom} onClick={jest.fn()} />);
    
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(screen.getByText('01-01-0101')).toBeInTheDocument();
    
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(screen.queryByText('01-01-0101')).not.toBeInTheDocument();
  });

  it('已投票状态应该显示正确样式', () => {
    const votedRoom = { ...mockRoom, vote_status: 'voted' as const };
    const { container } = render(<RoomCell room={votedRoom} onClick={jest.fn()} />);
    
    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument();
  });

  it('拒绝状态应该显示正确样式', () => {
    const refusedRoom = { ...mockRoom, vote_status: 'refused' as const };
    const { container } = render(<RoomCell room={refusedRoom} onClick={jest.fn()} />);
    
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
  });

  it('可选择模式下点击应该调用 onSelect', () => {
    const onSelect = jest.fn();
    render(
      <RoomCell
        room={mockRoom}
        onClick={jest.fn()}
        selectable={true}
        selected={false}
        onSelect={onSelect}
      />
    );
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(onSelect).toHaveBeenCalledWith(true);
  });

  it('选中状态应该显示对勾', () => {
    render(
      <RoomCell
        room={mockRoom}
        onClick={jest.fn()}
        selectable={true}
        selected={true}
        onSelect={jest.fn()}
      />
    );
    
    expect(screen.queryByText('01')).not.toBeInTheDocument();
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('选中状态应该显示蓝色边框', () => {
    const { container } = render(
      <RoomCell
        room={mockRoom}
        onClick={jest.fn()}
        selectable={true}
        selected={true}
        onSelect={jest.fn()}
      />
    );
    
    expect(container.querySelector('.ring-blue-500')).toBeInTheDocument();
  });

  it('应该添加 data-selectable-id 属性', () => {
    render(
      <RoomCell
        room={mockRoom}
        onClick={jest.fn()}
        selectable={true}
        selected={false}
        onSelect={jest.fn()}
      />
    );
    
    expect(screen.getByRole('button')).toHaveAttribute('data-selectable-id', '1');
  });

  it('缺少业主信息应该显示横杠', () => {
    const roomWithoutOwner = { ...mockRoom, owner_name: undefined, phone1: undefined, area: undefined };
    render(<RoomCell room={roomWithoutOwner} onClick={jest.fn()} />);
    
    fireEvent.mouseEnter(screen.getByRole('button'));
    
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('无备注时不应该显示备注区域', () => {
    const roomWithoutRemark = { ...mockRoom, remark: undefined };
    render(<RoomCell room={roomWithoutRemark} onClick={jest.fn()} />);
    
    fireEvent.mouseEnter(screen.getByRole('button'));
    
    expect(screen.queryByText('备注:')).not.toBeInTheDocument();
  });
});
