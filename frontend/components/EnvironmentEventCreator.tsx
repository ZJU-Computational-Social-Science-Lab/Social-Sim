import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationStore } from '../store';
import { createCustomEnvironmentEvent, uploadMediaForEvent, type CustomEnvironmentEvent } from '../services/environmentSuggestions';
import { Cloud, Image as ImageIcon, Volume2, Plus, X, AlertCircle, Loader2, Users, User } from 'lucide-react';

type ConfigMode = 'global' | 'agent';

interface EnvironmentConfigurationProps {
  agents?: Array<{ id: string; name: string; role: string }>;
  onEventCreated?: (event: CustomEnvironmentEvent, mode: ConfigMode, agentId?: string) => void;
}

export const EnvironmentConfiguration: React.FC<EnvironmentConfigurationProps> = ({ agents = [], onEventCreated }) => {
  const { t } = useTranslation();
  const currentSimulation = useSimulationStore((s) => s.currentSimulation);
  const addNotification = useSimulationStore((s) => s.addNotification);

  // Mode state
  const [configMode, setConfigMode] = useState<ConfigMode>('global');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Event state
  const [eventType, setEventType] = useState<string>('weather');
  const [severity, setSeverity] = useState<string>('mild');
  const [description, setDescription] = useState<string>('');
  const [noticeOnly, setNoticeOnly] = useState<boolean>(false);
  const [selectedReceivers, setSelectedReceivers] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadingMedia, setUploadingMedia] = useState<'image' | 'audio' | null>(null);

  const eventTypes = ['weather', 'emergency', 'notification', 'opinion', 'accident', 'social', 'other'];
  const severities = ['mild', 'moderate', 'severe'];

  const handleMediaUpload = async (file: File, mediaType: 'image' | 'audio') => {
    if (!currentSimulation) {
      addNotification('error', t('components.environmentConfiguration.noSimulation'));
      return;
    }

    setUploadingMedia(mediaType);
    try {
      const result = await uploadMediaForEvent(currentSimulation.id, file, mediaType);
      if (mediaType === 'image') {
        setImageUrl(result.url);
        addNotification('success', t('components.environmentConfiguration.imageUploaded'));
      } else {
        setAudioUrl(result.url);
        addNotification('success', t('components.environmentConfiguration.audioUploaded'));
      }
    } catch (error) {
      addNotification('error', t('components.environmentConfiguration.uploadError'));
      console.error('Media upload error:', error);
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'audio') => {
    const file = e.target.files?.[0];
    if (file) {
      handleMediaUpload(file, mediaType);
    }
  };

  const handleCreateConfiguration = async () => {
    if (!description.trim() && !imageUrl && !audioUrl) {
      addNotification('error', t('components.environmentConfiguration.emptyEvent'));
      return;
    }

    if (!currentSimulation) {
      addNotification('error', t('components.environmentConfiguration.noSimulation'));
      return;
    }

    if (configMode === 'agent' && !selectedAgentId) {
      addNotification('error', t('components.environmentConfiguration.selectAgent'));
      return;
    }

    setIsLoading(true);
    try {
      const event: CustomEnvironmentEvent = {
        event_type: eventType,
        severity,
        description,
        notice_only: noticeOnly,
        receivers: selectedReceivers.length > 0 ? selectedReceivers : undefined,
        multimodal: {
          text: description || undefined,
          image_url: imageUrl || undefined,
          audio_url: audioUrl || undefined,
        },
        is_custom: true,
        config_mode: configMode,
        target_agent_id: configMode === 'agent' ? selectedAgentId : undefined,
      };

      const result = await createCustomEnvironmentEvent(currentSimulation.id, event);

      if (result.success) {
        addNotification('success', t('components.environmentConfiguration.configCreated'));
        // Reset form
        setEventType('weather');
        setSeverity('mild');
        setDescription('');
        setNoticeOnly(false);
        setSelectedReceivers([]);
        setImageUrl('');
        setAudioUrl('');
        onEventCreated?.(result.event, configMode, selectedAgentId);
      }
    } catch (error) {
      addNotification('error', t('components.environmentConfiguration.creationError'));
      console.error('Configuration creation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReceiver = (agentId: string) => {
    setSelectedReceivers((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  return (
    <div className="space-y-4">
      {/* Configuration Mode Selection */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">
          {t('components.environmentConfiguration.configMode')}
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setConfigMode('global');
              setSelectedAgentId('');
            }}
            className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
              configMode === 'global'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Users className="w-3 h-3" />
            {t('components.environmentConfiguration.globalMode')}
          </button>
          <button
            onClick={() => setConfigMode('agent')}
            className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
              configMode === 'agent'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <User className="w-3 h-3" />
            {t('components.environmentConfiguration.agentMode')}
          </button>
        </div>
      </div>

      {/* Agent Selection (only in agent mode) */}
      {configMode === 'agent' && agents.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {t('components.environmentConfiguration.selectAgent')}
          </label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{t('components.environmentConfiguration.chooseAgent')}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Event Type Selection */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">
          {t('components.environmentConfiguration.eventType')}
        </label>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {t(`components.environmentSuggestion.eventType.${type}`) || type}
            </option>
          ))}
        </select>
      </div>

      {/* Severity Selection */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">
          {t('components.environmentConfiguration.severity')}
        </label>
        <div className="flex gap-2">
          {severities.map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverity(sev)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                severity === sev
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t(`components.environmentSuggestion.severity.${sev}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">
          {t('components.environmentConfiguration.description')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('components.environmentConfiguration.descriptionPlaceholder')}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Multimodal Content */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-700">
          {t('components.environmentConfiguration.multimodal')}
        </label>

        {/* Image Upload */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            onChange={(e) => handleFileSelect(e, 'image')}
            disabled={uploadingMedia === 'image'}
            className="hidden"
          />
          <label
            htmlFor="image-upload"
            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs text-gray-700 cursor-pointer hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
          >
            {uploadingMedia === 'image' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('components.environmentConfiguration.uploading')}
              </>
            ) : (
              <>
                <ImageIcon className="w-3 h-3" />
                {t('components.environmentConfiguration.addImage')}
              </>
            )}
          </label>
          {imageUrl && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-green-600 flex items-center gap-1">
                ✓ {t('components.environmentConfiguration.imageAdded')}
              </div>
              <button
                onClick={() => setImageUrl('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Audio Upload */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="audio-upload"
            accept="audio/*"
            onChange={(e) => handleFileSelect(e, 'audio')}
            disabled={uploadingMedia === 'audio'}
            className="hidden"
          />
          <label
            htmlFor="audio-upload"
            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs text-gray-700 cursor-pointer hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
          >
            {uploadingMedia === 'audio' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('components.environmentConfiguration.uploading')}
              </>
            ) : (
              <>
                <Volume2 className="w-3 h-3" />
                {t('components.environmentConfiguration.addAudio')}
              </>
            )}
          </label>
          {audioUrl && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-green-600 flex items-center gap-1">
                ✓ {t('components.environmentConfiguration.audioAdded')}
              </div>
              <button
                onClick={() => setAudioUrl('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Receivers Selection (only in global mode) */}
      {configMode === 'global' && agents.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {t('components.environmentConfiguration.receivers')}
          </label>
          <p className="text-xs text-gray-600 mb-2">
            {t('components.environmentConfiguration.receiversHint')}
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-300 rounded-lg bg-gray-50">
            {agents.map((agent) => (
              <label key={agent.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedReceivers.includes(agent.id)}
                  onChange={() => toggleReceiver(agent.id)}
                  className="rounded"
                />
                <span className="text-xs text-gray-700">
                  {agent.name} ({agent.role})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Notice Only Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={noticeOnly}
          onChange={(e) => setNoticeOnly(e.target.checked)}
          className="rounded"
        />
        <span className="text-xs text-gray-700">
          {t('components.environmentConfiguration.noticeOnly')}
        </span>
      </label>
      <p className="text-xs text-gray-500 italic">
        {t('components.environmentConfiguration.noticeOnlyHint')}
      </p>

      {/* Error Alert */}
      {!description.trim() && !imageUrl && !audioUrl && (
        <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-700">
            {t('components.environmentConfiguration.contentRequired')}
          </p>
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreateConfiguration}
        disabled={isLoading || (!description.trim() && !imageUrl && !audioUrl)}
        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('components.environmentConfiguration.creating')}
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4" />
            {t('components.environmentConfiguration.createConfig')}
          </>
        )}
      </button>
    </div>
  );
};

// 保持向后兼容
export const EnvironmentEventCreator = EnvironmentConfiguration;
