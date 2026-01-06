import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SweepStatusVisualization from '../index';
import { voteApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  voteApi: {
    getRounds: jest.fn(),
    getSweepOverview: jest.fn(),
    getSweepUnitRooms: jest.fn(),
    batchUpdateSweep: jest.fn(),
  },
}));

const mockRounds = [
  { id: 1, name: '2024年投票', status: 'active' },
  { id: 2, name: '2023年投票', status: 'closed' },
];

const mockOverviewData = {
  round: { id: 1, name: '2024年投票', status: 'active' },
  phases: [
    {
      phase_id: 1,
      phase_name: '一期',
      total_rooms: 100,
      completed_count: 60,
      buildings: [
        {
          building: '01',
          completed_count: 40,
          in_progress_count: 10,
          pending_count: 10,
          units: [
            { unit: '01', total_rooms: 30, completed_count: 20, in_progress_count: 5, pending_count: 5 },
            { unit: '02', total_rooms: 30, completed_count: 20, in_progress_count: 5, pending_count: 5 },
          ],
        },
      ],
    },
  ],
};

const mockRoomData = {
  floors: {
    1: [
      { owner_id: 1, room_number: '01-01-0101', room_in_floor: '01', sweep_status: 'pending' },
    ],
  },
  meta: {
    phase_id: 1,
    phase_name: '一期',
    building: '01',
    unit: '01',
    total_rooms: 1,
    completed_count: 0,
    in_progress_count: 0,
    pending_count: 1,
  },
};

describe('SweepStatusVisualization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (voteApi.getRounds as jest.Mock).mockResolvedValue({ data: mockRounds });
    (voteApi.getSweepOverview as jest.Mock).mockResolvedValue({ data: mockOverviewData });
    (voteApi.getSweepUnitRooms as jest.Mock).mockResolvedValue({ data: mockRoomData });
  });

  it('无小区 ID 时应该显示提示', () => {
    render(<SweepStatusVisualization communityId={null} />);
    
    expect(screen.getByText('请先选择小区')).toBeInTheDocument();
  });

  it('应该显示标题', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('扫楼进度管理')).toBeInTheDocument();
    });
  });

  it('应该加载投票轮次', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(voteApi.getRounds).toHaveBeenCalledWith({ community_id: 1 });
    });
  });

  it('应该加载扫楼概览', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(voteApi.getSweepOverview).toHaveBeenCalled();
    });
  });

  it('应该显示期数信息', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('一期')).toBeInTheDocument();
    });
  });

  it('应该显示楼栋信息', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01号楼')).toBeInTheDocument();
    });
  });

  it('应该显示扫楼统计', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('40 已完成')).toBeInTheDocument();
      expect(screen.getByText('10 进行中')).toBeInTheDocument();
      expect(screen.getByText('10 待扫楼')).toBeInTheDocument();
    });
  });

  it('点击单元应该打开详情弹窗', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01单元')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('01单元'));

    await waitFor(() => {
      expect(voteApi.getSweepUnitRooms).toHaveBeenCalled();
    });
  });

  it('切换期数展开/折叠', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('一期')).toBeInTheDocument();
    });

    const phaseButton = screen.getByRole('button', { name: /一期/ });
    fireEvent.click(phaseButton);
  });

  it('加载失败应该处理错误', async () => {
    (voteApi.getSweepOverview as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(voteApi.getSweepOverview).toHaveBeenCalled();
    });
  });

  it('空数据应该显示提示', async () => {
    (voteApi.getSweepOverview as jest.Mock).mockResolvedValue({ data: { phases: [] } });
    
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('暂无楼栋数据')).toBeInTheDocument();
    });
  });

  it('选择轮次应该重新加载数据', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const initialCalls = (voteApi.getSweepOverview as jest.Mock).mock.calls.length;

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2' } });

    await waitFor(() => {
      expect((voteApi.getSweepOverview as jest.Mock).mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it('批量操作模式应该工作', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01单元')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('01单元'));

    await waitFor(() => {
      expect(screen.getByText('批量操作')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('批量操作'));

    await waitFor(() => {
      expect(screen.getByText('全选')).toBeInTheDocument();
    });
  });

  it('批量更新扫楼状态应该调用 API', async () => {
    (voteApi.batchUpdateSweep as jest.Mock).mockResolvedValue({ data: {} });
    
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01单元')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('01单元'));

    await waitFor(() => {
      expect(screen.getByText('批量操作')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('批量操作'));

    await waitFor(() => {
      expect(screen.getByText('全选')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('全选'));

    const completedButton = screen.getAllByText('已完成')[0];
    fireEvent.click(completedButton);

    await waitFor(() => {
      expect(voteApi.batchUpdateSweep).toHaveBeenCalled();
    });
  });

  it('取消批量模式应该清除选择', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01单元')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('01单元'));

    await waitFor(() => {
      expect(screen.getByText('批量操作')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('批量操作'));

    await waitFor(() => {
      expect(screen.getByText('全选')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('批量操作'));

    await waitFor(() => {
      expect(screen.queryByText('全选')).not.toBeInTheDocument();
    });
  });

  it('折叠期数应该工作', async () => {
    render(<SweepStatusVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('一期')).toBeInTheDocument();
    });

    const phaseHeader = screen.getByRole('button', { name: /一期/ });
    fireEvent.click(phaseHeader);
    fireEvent.click(phaseHeader);
  });
});
