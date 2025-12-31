export interface SweepUnitRoomsResponse {
  meta: {
    phase_name: string;
    building: string;
    unit: string;
    total_rooms: number;
    completed_count: number;
    in_progress_count: number;
    pending_count: number;
  };
  floors: {
    [floor: number]: SweepRoomData[];
  };
  stats: {
    max_floor: number;
    max_rooms_per_floor: number;
  };
}

export interface SweepRoomData {
  owner_id: number;
  room_number: string;
  floor: number;
  room_in_floor: string;
  owner_name: string;
  phone1: string;
  area: number;
  parking_no: string;
  sweep_status: string;
  sweep_remark: string | null;
  sweep_date: string | null;
}

export interface SweepUnitStats {
  unit: string;
  total_rooms: number;
  completed_count: number;
  in_progress_count: number;
  pending_count: number;
}

export interface SweepBuildingStats {
  building: string;
  units: SweepUnitStats[];
  total_rooms: number;
  completed_count: number;
  in_progress_count: number;
  pending_count: number;
}

export interface SweepPhaseStats {
  phase_id: number;
  phase_name: string;
  buildings: SweepBuildingStats[];
  total_rooms: number;
  completed_count: number;
  in_progress_count: number;
  pending_count: number;
}

export interface SweepOverviewResponse {
  phases: SweepPhaseStats[];
}

export const sweepStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  completed: { label: '已完成', color: 'text-white', bgColor: 'bg-emerald-500' },
  in_progress: { label: '进行中', color: 'text-white', bgColor: 'bg-amber-500' },
  pending: { label: '待扫楼', color: 'text-slate-600', bgColor: 'bg-slate-300' },
};
