export interface UnitRoomsResponse {
  meta: {
    phase_name: string;
    building: string;
    unit: string;
    round_name: string;
    total_rooms: number;
    voted_count: number;
    refused_count: number;
    pending_count: number;
  };
  floors: {
    [floor: number]: RoomData[];
  };
  stats: {
    max_floor: number;
    max_rooms_per_floor: number;
  };
}

export interface RoomData {
  owner_id: number;
  room_number: string;
  floor: number;
  room_in_floor: string;
  owner_name: string;
  phone1: string;
  area: number;
  parking_no: string;
  vote_status: string;
  vote_date: string | null;
  remark: string | null;
  sweep_status: string | null;
}

export interface Round {
  id: number;
  name: string;
  year: number;
  round_code: string;
  status: string;
  community_id: number;
}

export interface Phase {
  id: number;
  name: string;
  code: string;
}

export const voteStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  voted: { label: '已投票', color: 'text-white', bgColor: 'bg-emerald-500' },
  onsite: { label: '现场投票', color: 'text-white', bgColor: 'bg-emerald-500' },
  video: { label: '视频投票', color: 'text-white', bgColor: 'bg-emerald-500' },
  refused: { label: '拒绝', color: 'text-white', bgColor: 'bg-red-500' },
  pending: { label: '待投票', color: 'text-slate-600', bgColor: 'bg-slate-300' },
};

export const sweepStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待扫楼', color: 'text-slate-600', bgColor: 'bg-slate-300' },
  in_progress: { label: '进行中', color: 'text-white', bgColor: 'bg-amber-500' },
  completed: { label: '已完成', color: 'text-white', bgColor: 'bg-emerald-500' },
};

// 楼栋概览相关类型
export interface UnitStats {
  unit: string;
  total_rooms: number;
  voted_count: number;
  refused_count: number;
  pending_count: number;
}

export interface BuildingStats {
  building: string;
  units: UnitStats[];
  total_rooms: number;
  voted_count: number;
  refused_count: number;
  pending_count: number;
}

export interface PhaseStats {
  phase_id: number;
  phase_name: string;
  buildings: BuildingStats[];
  total_rooms: number;
  voted_count: number;
  refused_count: number;
  pending_count: number;
}

export interface BuildingOverviewResponse {
  round: {
    id: number;
    name: string;
    status: string;
    year: number;
    round_code: string;
  } | null;
  phases: PhaseStats[];
}
