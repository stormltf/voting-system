import { render, screen, fireEvent } from '@testing-library/react';
import SweepRoomCell from '../SweepRoomCell';
import { SweepRoomData } from '../types';

const mockRoom: SweepRoomData = {
  owner_id: 1,
  room_number: '01-01-0101',
  room_in_floor: '01',
  owner_name: '张三',
  phone1: '13800138000',
  sweep_status: 'pending',
  sweep_remark: '测试备注',
};

describe('SweepRoomCell', () => {
  it('应该渲染房间号', () => {
    render(<SweepRoomCell room={mockRoom} onClick={jest.fn()} />);
    
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('点击应该调用 onClick', () => {
    const onClick = jest.fn();
    render(<SweepRoomCell room={mockRoom} onClick={onClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(onClick).toHaveBeenCalled();
  });

  it('鼠标悬停应该显示提示框', () => {
    render(<SweepRoomCell room={mockRoom} onClick={jest.fn()} />);
    
    fireEvent.mouseEnter(screen.getByRole('button'));
    
    expect(screen.getByText('01-01-0101')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('13800138000')).toBeInTheDocument();
  });

  it('已完成状态应该显示正确样式', () => {
    const completedRoom = { ...mockRoom, sweep_status: 'completed' as const };
    const { container } = render(<SweepRoomCell room={completedRoom} onClick={jest.fn()} />);
    
    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument();
  });

  it('进行中状态应该显示正确样式', () => {
    const inProgressRoom = { ...mockRoom, sweep_status: 'in_progress' as const };
    const { container } = render(<SweepRoomCell room={inProgressRoom} onClick={jest.fn()} />);
    
    expect(container.querySelector('.bg-amber-500')).toBeInTheDocument();
  });

  it('可选择模式下点击应该调用 onSelect', () => {
    const onSelect = jest.fn();
    render(
      <SweepRoomCell
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
      <SweepRoomCell
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
      <SweepRoomCell
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
      <SweepRoomCell
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
    const roomWithoutOwner = { ...mockRoom, owner_name: undefined, phone1: undefined };
    render(<SweepRoomCell room={roomWithoutOwner} onClick={jest.fn()} />);
    
    fireEvent.mouseEnter(screen.getByRole('button'));
    
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('无备注时不应该显示备注区域', () => {
    const roomWithoutRemark = { ...mockRoom, sweep_remark: undefined };
    render(<SweepRoomCell room={roomWithoutRemark} onClick={jest.fn()} />);
    
    fireEvent.mouseEnter(screen.getByRole('button'));
    
    expect(screen.queryByText('备注:')).not.toBeInTheDocument();
  });
});
