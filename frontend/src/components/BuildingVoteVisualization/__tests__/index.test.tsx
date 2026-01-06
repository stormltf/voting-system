import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BuildingVoteVisualization from '../index';
import { voteApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  voteApi: {
    getRounds: jest.fn(),
    getBuildingOverview: jest.fn(),
    getUnitRooms: jest.fn(),
    batchUpdate: jest.fn(),
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
      voted_count: 50,
      buildings: [
        {
          building: '01',
          voted_count: 30,
          refused_count: 5,
          pending_count: 15,
          units: [
            { unit: '01', total_rooms: 25, voted_count: 15, refused_count: 2, pending_count: 8 },
            { unit: '02', total_rooms: 25, voted_count: 15, refused_count: 3, pending_count: 7 },
          ],
        },
      ],
    },
  ],
};

const mockRoomData = {
  floors: {
    1: [
      { owner_id: 1, room_number: '01-01-0101', room_in_floor: '01', vote_status: 'pending' },
    ],
  },
  meta: {
    phase_id: 1,
    phase_name: '一期',
    building: '01',
    unit: '01',
    total_rooms: 1,
    voted_count: 0,
    refused_count: 0,
    pending_count: 1,
  },
};

describe('BuildingVoteVisualization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (voteApi.getRounds as jest.Mock).mockResolvedValue({ data: mockRounds });
    (voteApi.getBuildingOverview as jest.Mock).mockResolvedValue({ data: mockOverviewData });
    (voteApi.getUnitRooms as jest.Mock).mockResolvedValue({ data: mockRoomData });
  });

  it('无小区 ID 时应该显示提示', () => {
    render(<BuildingVoteVisualization communityId={null} />);
    
    expect(screen.getByText('请先选择小区')).toBeInTheDocument();
  });

  it('应该显示标题', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('楼栋投票状态')).toBeInTheDocument();
    });
  });

  it('应该加载投票轮次', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(voteApi.getRounds).toHaveBeenCalledWith({ community_id: 1 });
    });
  });

  it('应该加载楼栋概览', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(voteApi.getBuildingOverview).toHaveBeenCalled();
    });
  });

  it('应该显示期数信息', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('一期')).toBeInTheDocument();
    });
  });

  it('应该显示楼栋信息', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01号楼')).toBeInTheDocument();
    });
  });

  it('应该显示投票统计', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('30 已投')).toBeInTheDocument();
      expect(screen.getByText('5 拒绝')).toBeInTheDocument();
      expect(screen.getByText('15 待投')).toBeInTheDocument();
    });
  });

  it('点击单元应该打开详情弹窗', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01单元')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('01单元'));

    await waitFor(() => {
      expect(voteApi.getUnitRooms).toHaveBeenCalled();
    });
  });

  it('点击关闭按钮应该关闭弹窗', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01单元')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('01单元'));

    await waitFor(() => {
      expect(screen.getByText('批量操作')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.querySelector('svg'));
    if (closeButton) {
      fireEvent.click(closeButton);
    }
  });

  it('切换期数展开/折叠', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('一期')).toBeInTheDocument();
    });

    const phaseButton = screen.getByRole('button', { name: /一期/ });
    fireEvent.click(phaseButton);
  });

  it('加载失败应该处理错误', async () => {
    (voteApi.getBuildingOverview as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(voteApi.getBuildingOverview).toHaveBeenCalled();
    });
  });

  it('空数据应该显示提示', async () => {
    (voteApi.getBuildingOverview as jest.Mock).mockResolvedValue({ data: { phases: [] } });
    
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('暂无楼栋数据')).toBeInTheDocument();
    });
  });

  it('选择轮次应该重新加载数据', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const initialCalls = (voteApi.getBuildingOverview as jest.Mock).mock.calls.length;

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2' } });

    await waitFor(() => {
      expect((voteApi.getBuildingOverview as jest.Mock).mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it('批量操作模式应该工作', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
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

  it('折叠期数应该隐藏内容', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('一期')).toBeInTheDocument();
    });

    const phaseHeader = screen.getByRole('button', { name: /一期/ });
    fireEvent.click(phaseHeader);
    fireEvent.click(phaseHeader);
  });

  it('批量更新投票状态应该调用 API', async () => {
    (voteApi.batchUpdate as jest.Mock).mockResolvedValue({ data: {} });
    
    render(<BuildingVoteVisualization communityId={1} />);
    
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

    const votedButton = screen.getAllByText('已投票')[0];
    fireEvent.click(votedButton);

    await waitFor(() => {
      expect(voteApi.batchUpdate).toHaveBeenCalled();
    });
  });

  it('取消批量模式应该清除选择', async () => {
    render(<BuildingVoteVisualization communityId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('01单元')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('01单元'));

    await waitFor(() => {
      expect(screen.getByText('批量操作')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('批量操作'));

    await waitFor(() => {
      expect(screen.getByText('退出批量')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('退出批量'));

    await waitFor(() => {
      expect(screen.getByText('批量操作')).toBeInTheDocument();
    });
  });
});
