import axios from 'axios';
import api, { authApi, communityApi, ownerApi, voteApi, logsApi } from '../api';

jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => mockAxios),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return mockAxios;
});

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authApi', () => {
    it('login 应该发送 POST 请求', async () => {
      mockedAxios.post.mockResolvedValue({ data: { token: 'test' } });
      
      await authApi.login('user', 'pass');
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/login', { username: 'user', password: 'pass' });
    });

    it('getMe 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: { user: {} } });
      
      await authApi.getMe();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/auth/me');
    });

    it('changePassword 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await authApi.changePassword('old', 'new');
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/auth/password', { oldPassword: 'old', newPassword: 'new' });
    });

    it('getUsers 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await authApi.getUsers();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/auth/users');
    });

    it('createUser 应该发送 POST 请求', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      const userData = { username: 'new', password: 'pass', name: 'New User' };
      
      await authApi.createUser(userData);
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/users', userData);
    });

    it('updateUser 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await authApi.updateUser(1, { name: 'Updated' });
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/auth/users/1', { name: 'Updated' });
    });

    it('deleteUser 应该发送 DELETE 请求', async () => {
      mockedAxios.delete.mockResolvedValue({ data: {} });
      
      await authApi.deleteUser(1);
      
      expect(mockedAxios.delete).toHaveBeenCalledWith('/auth/users/1');
    });
  });

  describe('communityApi', () => {
    it('getAll 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await communityApi.getAll();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/communities');
    });

    it('getOne 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await communityApi.getOne(1);
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/communities/1');
    });

    it('create 应该发送 POST 请求', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      
      await communityApi.create({ name: 'Test' });
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/communities', { name: 'Test' });
    });

    it('update 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await communityApi.update(1, { name: 'Updated' });
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/communities/1', { name: 'Updated' });
    });

    it('delete 应该发送 DELETE 请求', async () => {
      mockedAxios.delete.mockResolvedValue({ data: {} });
      
      await communityApi.delete(1);
      
      expect(mockedAxios.delete).toHaveBeenCalledWith('/communities/1');
    });

    it('getPhases 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await communityApi.getPhases(1);
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/communities/1/phases');
    });

    it('createPhase 应该发送 POST 请求', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      
      await communityApi.createPhase(1, { name: 'Phase 1', code: 'P1' });
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/communities/1/phases', { name: 'Phase 1', code: 'P1' });
    });

    it('updatePhase 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await communityApi.updatePhase(1, { name: 'Updated' });
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/communities/phases/1', { name: 'Updated' });
    });

    it('deletePhase 应该发送 DELETE 请求', async () => {
      mockedAxios.delete.mockResolvedValue({ data: {} });
      
      await communityApi.deletePhase(1);
      
      expect(mockedAxios.delete).toHaveBeenCalledWith('/communities/phases/1');
    });
  });

  describe('ownerApi', () => {
    it('getAll 应该发送带参数的 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await ownerApi.getAll({ phase_id: 1, search: 'test' });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/owners', { params: { phase_id: 1, search: 'test' } });
    });

    it('getOne 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await ownerApi.getOne(1);
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/owners/1');
    });

    it('create 应该发送 POST 请求', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      const ownerData = { phase_id: 1, room_number: '101' };
      
      await ownerApi.create(ownerData);
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/owners', ownerData);
    });

    it('update 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await ownerApi.update(1, { owner_name: 'Updated' });
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/owners/1', { owner_name: 'Updated' });
    });

    it('delete 应该发送 DELETE 请求', async () => {
      mockedAxios.delete.mockResolvedValue({ data: {} });
      
      await ownerApi.delete(1);
      
      expect(mockedAxios.delete).toHaveBeenCalledWith('/owners/1');
    });

    it('getBuildings 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await ownerApi.getBuildings(1);
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/owners/buildings/1');
    });

    it('getUnits 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await ownerApi.getUnits(1, '01');
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/owners/units/1/01');
    });

    it('getExportUrl 应该生成正确的 URL', () => {
      const url = ownerApi.getExportUrl({ phase_id: 1, search: 'test' });
      
      expect(url).toContain('/owners/export');
      expect(url).toContain('phase_id=1');
      expect(url).toContain('search=test');
    });

    it('getExportUrl 应该忽略空值', () => {
      const url = ownerApi.getExportUrl({ phase_id: 1, search: '' });
      
      expect(url).toContain('phase_id=1');
      expect(url).not.toContain('search=');
    });
  });

  describe('voteApi', () => {
    it('getRounds 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await voteApi.getRounds({ community_id: 1 });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes/rounds', { params: { community_id: 1 } });
    });

    it('getRound 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await voteApi.getRound(1);
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes/rounds/1');
    });

    it('createRound 应该发送 POST 请求', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      const roundData = { community_id: 1, name: 'Round 1', year: 2024 };
      
      await voteApi.createRound(roundData);
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/votes/rounds', roundData);
    });

    it('updateRound 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await voteApi.updateRound(1, { name: 'Updated' });
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/votes/rounds/1', { name: 'Updated' });
    });

    it('deleteRound 应该发送 DELETE 请求', async () => {
      mockedAxios.delete.mockResolvedValue({ data: {} });
      
      await voteApi.deleteRound(1);
      
      expect(mockedAxios.delete).toHaveBeenCalledWith('/votes/rounds/1');
    });

    it('getVotes 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await voteApi.getVotes({ round_id: 1 });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes', { params: { round_id: 1 } });
    });

    it('saveVote 应该发送 POST 请求', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      
      await voteApi.saveVote({ owner_id: 1, round_id: 1 });
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/votes', { owner_id: 1, round_id: 1 });
    });

    it('batchUpdate 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await voteApi.batchUpdate({ owner_ids: [1, 2], vote_status: 'voted', round_id: 1, community_id: 1 });
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/votes/batch', { owner_ids: [1, 2], vote_status: 'voted', round_id: 1, community_id: 1 });
    });

    it('initVotes 应该发送 POST 请求', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      
      await voteApi.initVotes(1, 1);
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/votes/init', { round_id: 1, community_id: 1 });
    });

    it('getStats 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await voteApi.getStats({ community_id: 1 });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes/stats', { params: { community_id: 1 } });
    });

    it('getProgress 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await voteApi.getProgress({ community_id: 1 });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes/progress', { params: { community_id: 1 } });
    });

    it('getUnitRooms 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await voteApi.getUnitRooms({ round_id: 1, phase_id: 1, building: '01', unit: '01' });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes/unit-rooms', { params: { round_id: 1, phase_id: 1, building: '01', unit: '01' } });
    });

    it('getBuildingOverview 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await voteApi.getBuildingOverview({ community_id: 1, round_id: 1 });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes/building-overview', { params: { community_id: 1, round_id: 1 } });
    });

    it('getExportUrl 应该生成正确的 URL', () => {
      const url = voteApi.getExportUrl({ round_id: 1, community_id: 1 });
      
      expect(url).toContain('/votes/export');
      expect(url).toContain('round_id=1');
      expect(url).toContain('community_id=1');
    });

    it('getSweepOverview 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await voteApi.getSweepOverview({ community_id: 1 });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes/sweep-overview', { params: { community_id: 1 } });
    });

    it('getSweepUnitRooms 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await voteApi.getSweepUnitRooms({ round_id: 1, phase_id: 1, building: '01', unit: '01' });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/votes/sweep-unit-rooms', { params: { round_id: 1, phase_id: 1, building: '01', unit: '01' } });
    });

    it('updateSweepStatus 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await voteApi.updateSweepStatus(1, { round_id: 1, sweep_status: 'completed' });
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/votes/sweep/1', { round_id: 1, sweep_status: 'completed' });
    });

    it('batchUpdateSweep 应该发送 PUT 请求', async () => {
      mockedAxios.put.mockResolvedValue({ data: {} });
      
      await voteApi.batchUpdateSweep({ owner_ids: [1, 2], round_id: 1, sweep_status: 'completed', community_id: 1 });
      
      expect(mockedAxios.put).toHaveBeenCalledWith('/votes/sweep-batch', { owner_ids: [1, 2], round_id: 1, sweep_status: 'completed', community_id: 1 });
    });
  });

  describe('logsApi', () => {
    it('getLogs 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      
      await logsApi.getLogs({ page: 1, limit: 10 });
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/logs', { params: { page: 1, limit: 10 } });
    });

    it('getStats 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await logsApi.getStats(7);
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/logs/stats', { params: { days: 7 } });
    });

    it('getFilters 应该发送 GET 请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });
      
      await logsApi.getFilters();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/logs/filters');
    });
  });
});
