'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  smsApi,
  voteApi,
  SmsConfig,
  SmsTemplate,
  SmsTask,
  SmsLog,
  SmsPreviewResult,
  AvailableField,
  VoteRound,
} from '@/lib/api';
import {
  Settings,
  FileText,
  Send,
  History,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 任务类型映射
const TASK_TYPE_LABELS: Record<string, string> = {
  vote_notice: '投票通知',
  community_notice: '社区公告',
};

// 任务状态映射
const TASK_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'bg-slate-100 text-slate-700' },
  processing: { label: '处理中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
};

// 日志状态映射
const LOG_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '待发送', color: 'bg-slate-100 text-slate-700' },
  success: { label: '成功', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
};

export default function SmsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'config' | 'templates' | 'send' | 'history'>('send');
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);

  // 检查权限
  const isAdmin = user?.role === 'super_admin' || user?.role === 'community_admin';

  // 监听小区切换
  useEffect(() => {
    const savedId = localStorage.getItem('selectedCommunityId');
    if (savedId) {
      setSelectedCommunityId(parseInt(savedId));
    }

    const handleCommunityChange = (event: CustomEvent<{ id: number }>) => {
      setSelectedCommunityId(event.detail.id);
    };

    window.addEventListener('communityChanged', handleCommunityChange as EventListener);
    return () => {
      window.removeEventListener('communityChanged', handleCommunityChange as EventListener);
    };
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-amber-700">您没有权限访问短信管理功能</p>
        </div>
      </div>
    );
  }

  if (!selectedCommunityId) {
    return (
      <div className="p-6">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-slate-600" />
          <p className="text-slate-700">请先在左侧选择一个小区</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">短信管理</h1>
      </div>

      {/* Tab 导航 */}
      <div className="border-b border-zinc-200">
        <nav className="flex gap-6">
          {[
            { key: 'send', label: '发送短信', icon: Send },
            { key: 'templates', label: '模板管理', icon: FileText },
            { key: 'history', label: '发送记录', icon: History },
            { key: 'config', label: '短信配置', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 内容 */}
      {activeTab === 'config' && <ConfigTab communityId={selectedCommunityId} />}
      {activeTab === 'templates' && <TemplatesTab communityId={selectedCommunityId} />}
      {activeTab === 'send' && <SendTab communityId={selectedCommunityId} />}
      {activeTab === 'history' && <HistoryTab communityId={selectedCommunityId} />}
    </div>
  );
}

// 短信配置 Tab
function ConfigTab({ communityId }: { communityId: number }) {
  const [config, setConfig] = useState<SmsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    access_key_id: '',
    access_key_secret: '',
    enabled: true,
  });
  const [showSecret, setShowSecret] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await smsApi.getConfig(communityId);
      setConfig(response.data);
      if (response.data) {
        setForm({
          access_key_id: response.data.access_key_id,
          access_key_secret: '',
          enabled: response.data.enabled,
        });
      }
    } catch (err) {
      console.error('加载配置失败:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!form.access_key_id || !form.access_key_secret) {
      setError('请填写完整的 AccessKey 信息');
      return;
    }

    try {
      setSaving(true);
      await smsApi.saveConfig({
        community_id: communityId,
        access_key_id: form.access_key_id,
        access_key_secret: form.access_key_secret,
        enabled: form.enabled,
      });
      setSuccess(true);
      setForm(prev => ({ ...prev, access_key_secret: '' }));
      loadConfig();
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-lg font-medium text-zinc-900 mb-4">阿里云短信配置</h2>
        <p className="text-sm text-zinc-500 mb-6">
          配置阿里云短信服务的 AccessKey，用于发送短信通知。
        </p>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">配置保存成功</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              AccessKey ID
            </label>
            <input
              type="text"
              value={form.access_key_id}
              onChange={(e) => setForm({ ...form, access_key_id: e.target.value })}
              placeholder="LTAI..."
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              AccessKey Secret {config && <span className="text-zinc-400">(留空则不修改)</span>}
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={form.access_key_secret}
                onChange={(e) => setForm({ ...form, access_key_secret: e.target.value })}
                placeholder={config ? '••••••••' : '输入 AccessKey Secret'}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="enabled" className="text-sm text-zinc-700">
              启用短信服务
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            保存配置
          </button>
        </form>
      </div>
    </div>
  );
}

// 模板管理 Tab
function TemplatesTab({ communityId }: { communityId: number }) {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await smsApi.getTemplates(communityId);
      setTemplates(response.data);
    } catch (err) {
      console.error('加载模板失败:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  const loadFields = useCallback(async () => {
    try {
      const response = await smsApi.getAvailableFields();
      setAvailableFields(response.data);
    } catch (err) {
      console.error('加载字段失败:', err);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadFields();
  }, [loadTemplates, loadFields]);

  const handleDelete = async (template: SmsTemplate) => {
    if (!confirm(`确定要删除模板"${template.name}"吗？`)) return;
    try {
      await smsApi.deleteTemplate(template.id);
      loadTemplates();
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleEdit = (template: SmsTemplate) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTemplate(null);
  };

  const handleFormSave = () => {
    loadTemplates();
    handleFormClose();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">管理阿里云短信模板，配置变量映射</p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 text-sm"
        >
          <Plus className="w-4 h-4" />
          添加模板
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500">暂无模板，请添加</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white border border-zinc-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-zinc-900">{template.name}</h3>
                  <div className="mt-1 space-y-1 text-sm text-zinc-500">
                    <p>模板CODE: {template.template_code}</p>
                    <p>签名: {template.sign_name}</p>
                    {template.content_preview && (
                      <p className="text-zinc-400 mt-2">{template.content_preview}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 模板表单弹窗 */}
      {showForm && (
        <TemplateFormModal
          communityId={communityId}
          template={editingTemplate}
          availableFields={availableFields}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}

// 模板表单弹窗
function TemplateFormModal({
  communityId,
  template,
  availableFields,
  onClose,
  onSave,
}: {
  communityId: number;
  template: SmsTemplate | null;
  availableFields: AvailableField[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: template?.name || '',
    template_code: template?.template_code || '',
    sign_name: template?.sign_name || '',
    content_preview: template?.content_preview || '',
  });
  const [variableMapping, setVariableMapping] = useState<Array<{ templateVar: string; fieldKey: string }>>(
    template?.variable_mapping
      ? Object.entries(template.variable_mapping).map(([k, v]) => ({ templateVar: k, fieldKey: v }))
      : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addMapping = () => {
    setVariableMapping([...variableMapping, { templateVar: '', fieldKey: '' }]);
  };

  const removeMapping = (index: number) => {
    setVariableMapping(variableMapping.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: 'templateVar' | 'fieldKey', value: string) => {
    const updated = [...variableMapping];
    updated[index][field] = value;
    setVariableMapping(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.template_code || !form.sign_name) {
      setError('请填写必填字段');
      return;
    }

    try {
      setSaving(true);
      const mappingObj: Record<string, string> = {};
      variableMapping.forEach(({ templateVar, fieldKey }) => {
        if (templateVar && fieldKey) {
          mappingObj[templateVar] = fieldKey;
        }
      });

      if (template) {
        await smsApi.updateTemplate(template.id, {
          ...form,
          variable_mapping: mappingObj,
        });
      } else {
        await smsApi.createTemplate({
          community_id: communityId,
          ...form,
          variable_mapping: mappingObj,
        });
      }
      onSave();
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h2 className="text-lg font-medium">{template ? '编辑模板' : '添加模板'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              模板名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：投票开始通知"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              阿里云模板CODE <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.template_code}
              onChange={(e) => setForm({ ...form, template_code: e.target.value })}
              placeholder="如：SMS_123456789"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              签名名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.sign_name}
              onChange={(e) => setForm({ ...form, sign_name: e.target.value })}
              placeholder="如：某某小区业委会"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              模板内容预览
            </label>
            <textarea
              value={form.content_preview}
              onChange={(e) => setForm({ ...form, content_preview: e.target.value })}
              placeholder="如：尊敬的${name}，业主大会投票已开始..."
              rows={3}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-700">
                变量映射
              </label>
              <button
                type="button"
                onClick={addMapping}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + 添加映射
              </button>
            </div>
            <div className="space-y-2">
              {variableMapping.map((mapping, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mapping.templateVar}
                    onChange={(e) => updateMapping(index, 'templateVar', e.target.value)}
                    placeholder="模板变量名"
                    className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm"
                  />
                  <span className="text-zinc-400">=</span>
                  <select
                    value={mapping.fieldKey}
                    onChange={(e) => updateMapping(index, 'fieldKey', e.target.value)}
                    className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm"
                  >
                    <option value="">选择系统字段</option>
                    {availableFields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeMapping(index)}
                    className="p-2 text-zinc-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {variableMapping.length === 0 && (
                <p className="text-sm text-zinc-400 py-2">暂无变量映射</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 期数楼栋类型
interface PhaseBuildings {
  phase_id: number;
  phase_name: string;
  buildings: Array<{
    building: string;
    owner_count: number;
  }>;
}

interface TargetSelection {
  phase_id: number;
  buildings: string[];
}

// 发送短信 Tab
function SendTab({ communityId }: { communityId: number }) {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [rounds, setRounds] = useState<VoteRound[]>([]);
  const [phaseBuildings, setPhaseBuildings] = useState<PhaseBuildings[]>([]);
  const [loading, setLoading] = useState(true);

  const [taskType, setTaskType] = useState<'vote_notice' | 'community_notice'>('vote_notice');
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [targetSelections, setTargetSelections] = useState<TargetSelection[]>([]);
  const [targetFilter, setTargetFilter] = useState<'all' | 'not_voted'>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const [previewResult, setPreviewResult] = useState<SmsPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [templatesRes, roundsRes, buildingsRes] = await Promise.all([
        smsApi.getTemplates(communityId),
        voteApi.getRounds({ community_id: communityId }),
        smsApi.getBuildings(communityId),
      ]);
      setTemplates(templatesRes.data);
      setRounds(roundsRes.data);
      setPhaseBuildings(buildingsRes.data);

      // 默认选择第一个活跃的投票轮次
      const activeRound = roundsRes.data.find((r: VoteRound) => r.status === 'active');
      if (activeRound) {
        setSelectedRoundId(activeRound.id);
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 获取有效的 target_selections（过滤空的）
  const getValidSelections = () => {
    return targetSelections.filter(s => s.buildings.length > 0);
  };

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      setPreviewResult(null);
      const validSelections = getValidSelections();
      const response = await smsApi.preview({
        community_id: communityId,
        task_type: taskType,
        round_id: taskType === 'vote_notice' ? selectedRoundId || undefined : undefined,
        target_selections: validSelections.length > 0 ? validSelections : undefined,
        target_filter: taskType === 'vote_notice' ? targetFilter : 'all',
      });
      setPreviewResult(response.data);
    } catch (err) {
      alert('预览失败');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplateId) {
      alert('请选择短信模板');
      return;
    }

    try {
      setSending(true);
      const validSelections = getValidSelections();
      const response = await smsApi.send({
        community_id: communityId,
        template_id: selectedTemplateId,
        task_type: taskType,
        round_id: taskType === 'vote_notice' ? selectedRoundId || undefined : undefined,
        target_selections: validSelections.length > 0 ? validSelections : undefined,
        target_filter: taskType === 'vote_notice' ? targetFilter : 'all',
      });
      setSendResult({ success: true, message: response.data.message });
      setShowConfirm(false);
      setPreviewResult(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setSendResult({ success: false, message: error.response?.data?.error || '发送失败' });
    } finally {
      setSending(false);
    }
  };

  // 切换某个期数某栋楼的选中状态
  const toggleBuilding = (phaseId: number, building: string) => {
    setTargetSelections(prev => {
      const existing = prev.find(s => s.phase_id === phaseId);
      if (existing) {
        const newBuildings = existing.buildings.includes(building)
          ? existing.buildings.filter(b => b !== building)
          : [...existing.buildings, building];
        if (newBuildings.length === 0) {
          return prev.filter(s => s.phase_id !== phaseId);
        }
        return prev.map(s => s.phase_id === phaseId ? { ...s, buildings: newBuildings } : s);
      } else {
        return [...prev, { phase_id: phaseId, buildings: [building] }];
      }
    });
  };

  // 检查某栋楼是否被选中
  const isBuildingSelected = (phaseId: number, building: string) => {
    const selection = targetSelections.find(s => s.phase_id === phaseId);
    return selection?.buildings.includes(building) || false;
  };

  // 全选某个期数的所有楼栋
  const selectAllBuildingsInPhase = (phase: PhaseBuildings) => {
    setTargetSelections(prev => {
      const filtered = prev.filter(s => s.phase_id !== phase.phase_id);
      return [...filtered, { phase_id: phase.phase_id, buildings: phase.buildings.map(b => b.building) }];
    });
  };

  // 清空某个期数的选择
  const clearPhaseSelection = (phaseId: number) => {
    setTargetSelections(prev => prev.filter(s => s.phase_id !== phaseId));
  };

  // 全选所有
  const selectAllBuildings = () => {
    setTargetSelections(phaseBuildings.map(phase => ({
      phase_id: phase.phase_id,
      buildings: phase.buildings.map(b => b.building)
    })));
  };

  // 清空所有选择
  const clearAllSelections = () => {
    setTargetSelections([]);
  };

  // 获取已选中的总数
  const getSelectedCount = () => {
    return targetSelections.reduce((sum, s) => sum + s.buildings.length, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600" />
        <p className="text-amber-700">请先在"模板管理"中添加短信模板</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sendResult && (
        <div
          className={cn(
            'p-4 rounded-lg flex items-center gap-3',
            sendResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          )}
        >
          {sendResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={sendResult.success ? 'text-green-700' : 'text-red-700'}>
            {sendResult.message}
          </p>
          <button
            onClick={() => setSendResult(null)}
            className="ml-auto text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：发送设置 */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-zinc-900">发送设置</h2>

          {/* 短信类型 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">短信类型</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={taskType === 'vote_notice'}
                  onChange={() => setTaskType('vote_notice')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">投票通知</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={taskType === 'community_notice'}
                  onChange={() => setTaskType('community_notice')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">社区公告</span>
              </label>
            </div>
          </div>

          {/* 投票轮次（仅投票通知） */}
          {taskType === 'vote_notice' && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">投票轮次</label>
              <select
                value={selectedRoundId || ''}
                onChange={(e) => setSelectedRoundId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
              >
                <option value="">选择投票轮次</option>
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.name} {round.status === 'active' && '(进行中)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 接收人筛选（仅投票通知） */}
          {taskType === 'vote_notice' && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">接收人</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={targetFilter === 'all'}
                    onChange={() => setTargetFilter('all')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">全部业主</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={targetFilter === 'not_voted'}
                    onChange={() => setTargetFilter('not_voted')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">未投票业主</span>
                </label>
              </div>
            </div>
          )}

          {/* 楼栋筛选（按期数分组） */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-700">
                目标楼栋 {getSelectedCount() > 0 && `(已选${getSelectedCount()}栋)`}
              </label>
              <div className="flex gap-2 text-xs">
                <button onClick={selectAllBuildings} className="text-blue-600 hover:text-blue-700">
                  全选
                </button>
                <span className="text-zinc-300">|</span>
                <button onClick={clearAllSelections} className="text-zinc-500 hover:text-zinc-700">
                  清空
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100">
              {phaseBuildings.map((phase) => {
                const selectedInPhase = targetSelections.find(s => s.phase_id === phase.phase_id);
                const selectedCount = selectedInPhase?.buildings.length || 0;
                return (
                  <div key={phase.phase_id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-zinc-800">
                        {phase.phase_name}
                        {selectedCount > 0 && (
                          <span className="ml-1 text-blue-600">({selectedCount})</span>
                        )}
                      </span>
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => selectAllBuildingsInPhase(phase)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          全选
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                          onClick={() => clearPhaseSelection(phase.phase_id)}
                          className="text-zinc-500 hover:text-zinc-700"
                        >
                          清空
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {phase.buildings.map((b) => (
                        <button
                          key={`${phase.phase_id}-${b.building}`}
                          onClick={() => toggleBuilding(phase.phase_id, b.building)}
                          className={cn(
                            'px-2 py-0.5 rounded text-xs transition-colors',
                            isBuildingSelected(phase.phase_id, b.building)
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          )}
                        >
                          {b.building}栋
                          <span className="text-zinc-400 ml-0.5">({b.owner_count})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {phaseBuildings.length === 0 && (
                <p className="text-sm text-zinc-400 p-4 text-center">暂无楼栋数据</p>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">不选择则发送给全部楼栋</p>
          </div>

          {/* 选择模板 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">短信模板</label>
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => setSelectedTemplateId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
            >
              <option value="">选择短信模板</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* 预览按钮 */}
          <button
            onClick={handlePreview}
            disabled={previewing || (taskType === 'vote_notice' && !selectedRoundId)}
            className="w-full px-4 py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {previewing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            预览接收人
          </button>
        </div>

        {/* 右侧：预览结果 */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h2 className="text-lg font-medium text-zinc-900 mb-4">预览</h2>

          {!previewResult ? (
            <div className="text-center py-12 text-zinc-400">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>点击"预览接收人"查看发送详情</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-semibold text-zinc-900">{previewResult.total_count}</p>
                  <p className="text-xs text-zinc-500">总业主数</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-semibold text-green-700">{previewResult.valid_count}</p>
                  <p className="text-xs text-green-600">有效手机号</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-semibold text-amber-700">{previewResult.no_phone_count}</p>
                  <p className="text-xs text-amber-600">无手机号</p>
                </div>
              </div>

              {/* 接收人列表 */}
              <div>
                <p className="text-sm font-medium text-zinc-700 mb-2">接收人列表</p>
                <div className="max-h-64 overflow-y-auto border border-zinc-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-zinc-600">期数</th>
                        <th className="text-left px-3 py-2 font-medium text-zinc-600">业主</th>
                        <th className="text-left px-3 py-2 font-medium text-zinc-600">房号</th>
                        <th className="text-left px-3 py-2 font-medium text-zinc-600">手机号</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {previewResult.recipients.slice(0, 100).map((recipient) => (
                        <tr key={recipient.id}>
                          <td className="px-3 py-2 text-zinc-500 text-xs">{recipient.phase_name || '-'}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-zinc-400" />
                              {recipient.owner_name || '-'}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{recipient.room_number}</td>
                          <td className="px-3 py-2">
                            {recipient.has_valid_phone ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <Phone className="w-3 h-3" />
                                {recipient.phone}
                              </div>
                            ) : (
                              <span className="text-zinc-400">无</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewResult.recipients.length > 100 && (
                    <p className="text-center text-sm text-zinc-400 py-2">
                      仅显示前100条，共{previewResult.recipients.length}条
                    </p>
                  )}
                </div>
              </div>

              {/* 发送按钮 */}
              <button
                onClick={() => setShowConfirm(true)}
                disabled={previewResult.valid_count === 0 || !selectedTemplateId}
                className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                发送短信 ({previewResult.valid_count}条)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 确认发送弹窗 */}
      {showConfirm && previewResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-medium text-zinc-900 mb-4">确认发送</h3>
            <p className="text-zinc-600 mb-6">
              确定要发送 <span className="font-semibold text-zinc-900">{previewResult.valid_count}</span> 条短信吗？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50"
              >
                取消
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                确认发送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 发送记录 Tab
function HistoryTab({ communityId }: { communityId: number }) {
  const [tasks, setTasks] = useState<SmsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedTask, setSelectedTask] = useState<SmsTask | null>(null);

  const loadTasks = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const response = await smsApi.getTasks({ community_id: communityId, page, limit: pagination.limit });
      setTasks(response.data.tasks);
      setPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
        pages: response.data.pagination.pages,
      });
    } catch (err) {
      console.error('加载任务列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId, pagination.limit]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">查看短信发送历史记录</p>
        <button
          onClick={() => loadTasks(1)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-8 text-center">
          <History className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500">暂无发送记录</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600">时间</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600">类型</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600">模板</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600">发送统计</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600">状态</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600">操作人</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tasks.map((task) => {
                  const status = TASK_STATUS_LABELS[task.status] || { label: task.status, color: 'bg-zinc-100' };
                  return (
                    <tr key={task.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1 text-zinc-600">
                          <Clock className="w-3 h-3" />
                          {new Date(task.created_at!).toLocaleString('zh-CN')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {TASK_TYPE_LABELS[task.task_type]}
                        {task.round_name && (
                          <span className="text-zinc-400 ml-1">({task.round_name})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{task.template_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">{task.success_count}成功</span>
                          <span className="text-zinc-300">/</span>
                          <span className="text-red-600">{task.fail_count}失败</span>
                          <span className="text-zinc-300">/</span>
                          <span className="text-zinc-500">{task.total_count}总数</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs', status.color)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{task.operator_name}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                共 {pagination.total} 条记录
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadTasks(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-zinc-600">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  onClick={() => loadTasks(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="p-2 border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 任务详情弹窗 */}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

// 任务详情弹窗
function TaskDetailModal({ task, onClose }: { task: SmsTask; onClose: () => void }) {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const response = await smsApi.getTaskLogs(task.id, {
        page,
        limit: pagination.limit,
        status: statusFilter || undefined,
      });
      setLogs(response.data.logs);
      setPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
        pages: response.data.pagination.pages,
      });
    } catch (err) {
      console.error('加载日志失败:', err);
    } finally {
      setLoading(false);
    }
  }, [task.id, pagination.limit, statusFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const status = TASK_STATUS_LABELS[task.status] || { label: task.status, color: 'bg-zinc-100' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h2 className="text-lg font-medium">发送详情</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-zinc-100 bg-zinc-50">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">类型</p>
              <p className="font-medium">{TASK_TYPE_LABELS[task.task_type]}</p>
            </div>
            <div>
              <p className="text-zinc-500">状态</p>
              <span className={cn('px-2 py-0.5 rounded-full text-xs', status.color)}>
                {status.label}
              </span>
            </div>
            <div>
              <p className="text-zinc-500">发送统计</p>
              <p>
                <span className="text-green-600">{task.success_count}</span> /
                <span className="text-red-600 ml-1">{task.fail_count}</span> /
                <span className="text-zinc-500 ml-1">{task.total_count}</span>
              </p>
            </div>
            <div>
              <p className="text-zinc-500">操作人</p>
              <p className="font-medium">{task.operator_name}</p>
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">筛选:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 border border-zinc-300 rounded text-sm"
            >
              <option value="">全部</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
            </select>
          </div>
          <p className="text-sm text-zinc-500">共 {pagination.total} 条</p>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">业主</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">手机号</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">状态</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">错误信息</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">发送时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => {
                  const logStatus = LOG_STATUS_LABELS[log.status] || { label: log.status, color: 'bg-zinc-100' };
                  return (
                    <tr key={log.id}>
                      <td className="px-4 py-2">{log.owner_name || '-'}</td>
                      <td className="px-4 py-2 text-zinc-600">{log.phone}</td>
                      <td className="px-4 py-2">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs', logStatus.color)}>
                          {logStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-red-600 text-xs max-w-xs truncate">
                        {log.error_message || '-'}
                      </td>
                      <td className="px-4 py-2 text-zinc-500">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString('zh-CN') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {pagination.pages > 1 && (
          <div className="p-4 border-t border-zinc-200 flex items-center justify-center gap-2">
            <button
              onClick={() => loadLogs(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-zinc-600">
              {pagination.page} / {pagination.pages}
            </span>
            <button
              onClick={() => loadLogs(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="p-2 border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
