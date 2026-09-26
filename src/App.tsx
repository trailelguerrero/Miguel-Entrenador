import React, { useState, useEffect, useRef, useMemo } from 'react';
import { computePmcSeries, getWorkoutLoad } from './utils/trainingLoad';
import { analyzeWeekStructure, mondayOfKey, addDaysKey } from './utils/weekStructure';
import { localDateKey } from './utils/trainingLoad';
import { buildBrainContext, summarizeWeekWorkouts } from './brain/context';
import { addPending, isAppliedRule } from './brain/memory';
import { Navbar } from './components/Navbar';
import { buildDeload } from './brain/deload';
import { resolveIntensityPrescription } from './brain/intensity';
import { SuuntoSyncBar } from './components/SuuntoSyncBar';
import { ZoneAdviceBanner, ZONE_CHANGE_HOW_TO, describeZoneRecommendation } from './components/ZoneAdviceBanner';
import { driftZoneRecommendation, pendingZoneAdvice, updateZoneAdviceState, zoneAdviceKey } from './brain/suuntoMerge';
import { MorningBanner } from './components/MorningBanner';
import { CalendarView } from './components/CalendarView';
import { CoachChat } from './components/CoachChat';
import { AthleteHistoryView } from './components/AthleteHistoryView';
import { CoachMemoryView } from './components/CoachMemoryView';
import { KnowledgeLibraryView } from './components/KnowledgeLibraryView';
import { ChatCloudPanel } from './components/ChatCloudPanel';
import { PeriodizationView } from './components/PeriodizationView';
import { ZoneSenseSuuntoView } from './components/ZoneSenseSuuntoView';
import { DriftTestView } from './components/DriftTestView';
import { DailyReadinessModal } from './components/DailyReadinessModal';
import { WorkoutDetailModal } from './components/WorkoutDetailModal';
import { AthleteProfileModal } from './components/AthleteProfileModal';
import { AddWorkoutModal } from './components/AddWorkoutModal';
import { TransvulcaniaSimulationView } from './components/TransvulcaniaSimulationView';
import { PMCChartView } from './components/PMCChartView';
import { GutTrainingView } from './components/GutTrainingView';
import { EccentricStrengthView } from './components/EccentricStrengthView';
import { PerformanceSummaryView } from './components/PerformanceSummaryView';
import { ClearTestDataModal } from './components/ClearTestDataModal';
import { WeightQuickWidget } from './components/WeightQuickWidget';
import { HydrationView } from './components/HydrationView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { FartlekGeneratorModal } from './components/FartlekGeneratorModal';
import { MetricsDashboardView } from './components/MetricsDashboardView';
import { CommandPalette } from './components/CommandPalette';
import { BottomNavBar } from './components/BottomNavBar';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { SetupGuideModal } from './components/SetupGuideModal';
import { ToastContainer } from './components/ToastContainer';
import { ApiErrorBanner } from './components/ApiErrorBanner';
import { apiStatus, useApiStatus } from './services/apiStatus';
import { applySuuntoProfile, markManualChanges, ProfileChange, SUUNTO_FIELD_LABELS } from './utils/suuntoProfile';

const formatProfileValue = (v: unknown): string =>
  v === undefined || v === null ? '—' : v === true ? 'sí' : v === false ? 'no' : v === 'saturday' ? 'sábado' : v === 'sunday' ? 'domingo' : String(v);

import { 
  AthleteProfile, 
  TargetRace, 
  Workout, 
  DailyCheckIn, 
  ChatMessage, 
  SuuntoIntegrationConfig,
  AthleteHistoryDocument,
  CoachLearnedMemory,
  CoachLearnedInsight,
  ToastMessage,
  ToastType,
  WatchZoneRecommendation
} from './types';
import { StorageService } from './services/storage';
import { RemoteData, type RemoteState } from './services/remoteData';
import { ServerDataBanner } from './components/ServerDataBanner';
import { ApiService, isSavableMessage } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('calendar');
  const [isTestDataActive, setIsTestDataActive] = useState<boolean>(StorageService.isTestDataActive());
  
  // Persistent State
  const [profile, setProfile] = useState<AthleteProfile>(StorageService.getProfile());
  const [targetRace, setTargetRace] = useState<TargetRace>(StorageService.getTargetRace());
  const [secondaryRaces, setSecondaryRaces] = useState<TargetRace[]>(StorageService.getSecondaryRaces());
  const [workouts, setWorkouts] = useState<Workout[]>(StorageService.getWorkouts());
  // PMC real (CTL/ATL/TSB) calculado desde los entrenos completados, TSS de Suunto
  const pmcData = useMemo(() => computePmcSeries(workouts, profile.antHr), [workouts, profile.antHr]);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckIn | undefined>(StorageService.getTodayCheckIn());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(StorageService.getChatMessages());
  const [suuntoConfig, setSuuntoConfig] = useState<SuuntoIntegrationConfig>(StorageService.getSuuntoConfig());
  const [historyDoc, setHistoryDoc] = useState<AthleteHistoryDocument | null>(StorageService.getAthleteHistory());
  const [coachMemory, setCoachMemory] = useState<CoachLearnedMemory>(StorageService.getCoachMemory());

  // UI Modals
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAddWorkoutModalOpen, setIsAddWorkoutModalOpen] = useState(false);
  const [isFartlekModalOpen, setIsFartlekModalOpen] = useState(false);
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [selectedAddDate, setSelectedAddDate] = useState<string>('');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [activeWorkoutContext, setActiveWorkoutContext] = useState<Workout | null>(null);

  // New Global State: Toasts, Command Palette, and Backup Modal (Mejoras 1, 2, 4)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);

  const showToast = (toast: { type: ToastType; title: string; message?: string; duration?: number }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastMessage = { id, ...toast };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Loading States
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isAdaptingSession, setIsAdaptingSession] = useState(false);

  // Sync state changes with StorageService
  const handleSaveProfile = (edited: AthleteProfile) => {
    // Los campos que vienen de Suunto y el atleta cambia a mano pasan a 'manual'
    const updated = markManualChanges(StorageService.getProfile(), edited);
    setProfile(updated);
    StorageService.saveProfile(updated);
    showToast({
      type: 'success',
      title: 'Perfil Actualizado',
      message: `AeT: ${updated.aetHr} bpm • AnT: ${updated.antHr} bpm • Peso: ${updated.weightKg} kg`,
    });
  };

  /** Vuelve a leer todo de la caché (tras cargar del servidor). */
  const reloadFromStorage = () => {
    setProfile(StorageService.getProfile());
    setWorkouts(StorageService.getWorkouts());
    setTargetRace(StorageService.getTargetRace());
    setTodayCheckIn(StorageService.getTodayCheckIn());
    setCoachMemory(StorageService.getCoachMemory());
    setHistoryDoc(StorageService.getAthleteHistory());
    setSuuntoConfig(StorageService.getSuuntoConfig());
    setIsTestDataActive(StorageService.isTestDataActive());
  };

  const handleRestoreSuccess = (summary: Record<string, number>) => {
    // Re-sync all state from StorageService
    setProfile(StorageService.getProfile());
    setWorkouts(StorageService.getWorkouts());
    setTargetRace(StorageService.getTargetRace());
    setSecondaryRaces(StorageService.getSecondaryRaces());
    setTodayCheckIn(StorageService.getTodayCheckIn());
    setCoachMemory(StorageService.getCoachMemory());
    setHistoryDoc(StorageService.getAthleteHistory());
    setChatMessages(StorageService.getChatMessages());
    setSuuntoConfig(StorageService.getSuuntoConfig());
    setIsTestDataActive(StorageService.isTestDataActive());

    showToast({
      type: 'success',
      title: 'Copia Restaurada con Éxito',
      message: `Se han restaurado ${summary.workouts || 0} entrenamientos, ${summary.checkIns || 0} check-ins y ${summary.coachRules || 0} reglas del coach.`,
      duration: 5000,
    });
  };

  const handleNutritionLinked = (title: string, date: string) => {
    setWorkouts(StorageService.getWorkouts());
    showToast({
      type: 'success',
      title: 'Estrategia Vinculada al Calendario',
      message: `Pauta asignada a: ${title} (${date})`,
    });
  };

  const handleSaveHistoryDoc = (doc: AthleteHistoryDocument) => {
    setHistoryDoc(doc);
    StorageService.saveAthleteHistory(doc);
  };

  const handleSaveCoachMemory = (memory: CoachLearnedMemory) => {
    setCoachMemory(memory);
    StorageService.saveCoachMemory(memory);
  };

  const handleSaveSecondaryRaces = (races: TargetRace[]) => {
    setSecondaryRaces(races);
    StorageService.saveSecondaryRaces(races);
  };

  const handleSaveWorkouts = (updatedWorkouts: Workout[]) => {
    setWorkouts(updatedWorkouts);
    StorageService.saveWorkouts(updatedWorkouts);
  };

  // Suunto: tokens + estado de sync (persistidos en localStorage)
  const handleUpdateSuuntoConfig = (cfg: SuuntoIntegrationConfig) => {
    setSuuntoConfig(cfg);
    StorageService.saveSuuntoConfig(cfg);
  };

  const [isSyncingSuunto, setIsSyncingSuunto] = useState(false);

  // Tras rellenar el perfil desde Suunto, Miguel explica en el chat qué ha tomado y qué revisar.
  const askMiguelAboutSuuntoProfile = async (newProfile: AthleteProfile, changed: ProfileChange[]) => {
    const lines = changed.map((c) => {
      const why = newProfile.suuntoEvidence?.[c.field];
      return `- ${SUUNTO_FIELD_LABELS[c.field]}: ${formatProfileValue(c.from)} → ${formatProfileValue(c.to)}${why ? ` (${why})` : ''}`;
    });
    const manual = Object.entries(newProfile.fieldSources || {})
      .filter(([, src]) => src === 'manual')
      .map(([f]) => SUUNTO_FIELD_LABELS[f as keyof typeof SUUNTO_FIELD_LABELS]);
    const prompt =
      `[SINCRONIZACIÓN SUUNTO – PERFIL AUTOMÁTICO] He actualizado estos datos de mi perfil con lo que registra mi Suunto:\n${lines.join('\n')}` +
      (manual.length ? `\nEstos los mantengo a mano y no se han tocado: ${manual.join(', ')}.` : '') +
      `\nResume en pocas líneas qué has tomado de Suunto, qué significa para mi entrenamiento y qué debería revisar o confirmar yo (por ejemplo, si mis zonas de FC de Suunto no están bien configuradas o conviene hacer el test de deriva para afinar el AeT). Recuerda que peso, altura, edad y lesiones los pongo yo.`;
    try {
      const { reply, knowledgeSources } = await ApiService.sendMessage(
        [{ role: 'user', content: prompt }],
        newProfile,
        StorageService.getTodayCheckIn(),
        targetRace,
        'Perfil actualizado automáticamente desde Suunto',
        historyDoc,
        coachMemory,
        getBrainContext(),
      );
      const msg: ChatMessage = {
        id: `assistant-suunto-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
        contextType: 'general',
        knowledgeSources,
      };
      const msgs = [...StorageService.getChatMessages(), msg];
      StorageService.saveChatMessages(msgs);
      setChatMessages(msgs);
    } catch (err) {
      // El aviso "Error de API de IA" ya lo muestra apiStatus; el perfil queda guardado igual
      console.error('Miguel no pudo resumir el perfil de Suunto:', err);
    }
  };

  // Zonas de FC del reloj: Miguel te cuenta en el chat las recomendaciones nuevas (una sola vez cada una)
  const announcingZones = useRef(false);
  const announceZoneAdvice = async () => {
    const p = StorageService.getProfile();
    const recs = pendingZoneAdvice(p, true);
    if (!recs.length || announcingZones.current) return;
    announcingZones.current = true;
    try {
      const lines = recs.map((r) => `- ${describeZoneRecommendation(r)}. Señal: ${r.evidence}`);
      const prompt =
        `[AVISO AUTOMÁTICO – ZONAS DE FC DEL RELOJ] La app ha detectado que conviene cambiar las zonas de FC de carrera de mi reloj Suunto:\n${lines.join('\n')}\n` +
        `Explícame en pocas líneas qué debo cambiar (de cuánto a cuánto), por qué y cómo hacerlo en la app de Suunto (${ZONE_CHANGE_HOW_TO}). ` +
        'Recuerda que las zonas de FC del reloj son mis umbrales en la app. Si la señal viene de ZoneSense o de un test, es una sugerencia y decido yo.';
      const { reply, knowledgeSources } = await ApiService.sendMessage(
        [{ role: 'user', content: prompt }],
        p,
        StorageService.getTodayCheckIn(),
        targetRace,
        'Aviso de zonas de FC del reloj',
        historyDoc,
        coachMemory,
        getBrainContext(),
      );
      const msg: ChatMessage = { id: `assistant-zones-${Date.now()}`, role: 'assistant', content: reply, timestamp: new Date().toISOString(), contextType: 'general', knowledgeSources };
      const msgs = [...StorageService.getChatMessages(), msg];
      StorageService.saveChatMessages(msgs);
      setChatMessages(msgs);
      // Anunciadas: no se repiten
      const cur = StorageService.getProfile();
      const state = { ...(cur.zoneAdviceState || {}) };
      const now = new Date().toISOString();
      for (const r of recs) {
        const k = zoneAdviceKey(r);
        if (state[k]) state[k] = { ...state[k], announcedAt: now };
      }
      const updated = { ...cur, zoneAdviceState: state };
      setProfile(updated);
      StorageService.saveProfile(updated);
      showToast({ type: 'warning', title: 'Miguel tiene un aviso sobre tus zonas de FC', message: 'Míralo en el chat con Miguel.', duration: 7000 });
    } catch (err) {
      console.error('Miguel no pudo avisar de las zonas:', err);
    } finally {
      announcingZones.current = false;
    }
  };

  const handleResolveZoneAdvice = (rec: WatchZoneRecommendation, status: 'done' | 'ignored') => {
    const cur = StorageService.getProfile();
    const k = zoneAdviceKey(rec);
    const prev = cur.zoneAdviceState?.[k] ?? { status: 'pending' as const, firstSeen: new Date().toISOString() };
    const updated = { ...cur, zoneAdviceState: { ...(cur.zoneAdviceState || {}), [k]: { ...prev, status } } };
    setProfile(updated);
    StorageService.saveProfile(updated);
    showToast({
      type: 'info',
      title: status === 'done' ? 'Anotado: zonas cambiadas' : 'Aviso ignorado',
      message: status === 'done' ? 'En la próxima sincronización la app tomará tus zonas nuevas.' : 'No volverá a aparecer esta recomendación.',
    });
  };

  const handleDisconnectSuunto = async () => {
    if (!confirm('¿Desconectar tu cuenta Suunto de esta app?\n\nSe borran los tokens de conexión. Tus entrenos importados y tu perfil se conservan.')) return;
    if (RemoteData.state.mode === 'server') {
      try {
        await RemoteData.disconnectSuunto();
        reloadFromStorage();
      } catch (err: any) {
        showToast({ type: 'error', title: 'No se pudo desconectar Suunto', message: err.message });
        return;
      }
      apiStatus.reportSuuntoDisconnected('Cuenta Suunto desconectada.');
      showToast({ type: 'info', title: 'Suunto desconectado', message: 'Puedes volver a conectarlo cuando quieras con "Conectar Suunto".' });
      return;
    }
    handleUpdateSuuntoConfig({
      ...StorageService.getSuuntoConfig(),
      auth: undefined,
      connected: false,
      syncStatus: undefined,
      lastSyncMessage: 'Cuenta Suunto desconectada.',
    });
    apiStatus.reportSuuntoDisconnected('Cuenta Suunto desconectada.');
    showToast({ type: 'info', title: 'Suunto desconectado', message: 'Puedes volver a conectarlo cuando quieras con "Conectar Suunto".' });
  };

  // Trae workouts y sueño/HRV reales de Suunto y los integra en el calendario y los check-ins.
  // Fase B: el servidor sincroniza con Suunto (tokens cifrados en Supabase) y devuelve el estado fusionado
  const handleSyncSuuntoOnServer = async (): Promise<string> => {
    setIsSyncingSuunto(true);
    setSuuntoConfig({ ...StorageService.getSuuntoConfig(), syncStatus: 'syncing' });
    try {
      const res = await RemoteData.syncSuunto(localDateKey());
      reloadFromStorage();
      if (!res.ok) {
        apiStatus.reportSuuntoDisconnected(res.message);
        showToast({ type: 'warning', title: 'Reconecta Suunto', message: res.message });
        return res.message;
      }
      const newProfile = StorageService.getProfile();
      if (res.profileChanges.length) {
        showToast({
          type: 'info',
          title: 'Perfil actualizado desde Suunto',
          message: res.profileChanges.map((c: ProfileChange) => `${SUUNTO_FIELD_LABELS[c.field]}: ${formatProfileValue(c.to)}`).join(' • '),
          duration: 7000,
        });
        askMiguelAboutSuuntoProfile(newProfile, res.profileChanges);
      }
      if (res.freshZoneAdvice.length) void announceZoneAdvice();
      apiStatus.reportSuuntoOk();
      showToast({ type: 'success', title: 'Suunto sincronizado', message: res.message });
      return res.message;
    } catch (err: any) {
      reloadFromStorage();
      const message = `Fallo de sincronización: ${err.message}`;
      showToast({ type: 'error', title: 'Error de API de Suunto', message: err.message });
      return message;
    } finally {
      setIsSyncingSuunto(false);
    }
  };

  const handleSyncSuunto = async (): Promise<string> => {
    if (RemoteData.state.mode === 'server') return handleSyncSuuntoOnServer();
    const current = StorageService.getSuuntoConfig();
    if (!current.auth) {
      return 'Suunto no está conectado. Pulsa "Conectar Suunto".';
    }
    setIsSyncingSuunto(true);
    handleUpdateSuuntoConfig({ ...current, syncStatus: 'syncing' });
    try {
      const res = await ApiService.syncSuuntoHistory(current.auth);
      if (res.needsReconnect) {
        handleUpdateSuuntoConfig({
          ...current,
          auth: undefined,
          connected: false,
          syncStatus: 'error',
          lastSyncMessage: res.message,
        });
        apiStatus.reportSuuntoDisconnected(res.message);
        showToast({ type: 'warning', title: 'Reconecta Suunto', message: res.message });
        return res.message;
      }

      // Perfil automático: Suunto rellena sus campos (sin pisar los manuales)
      if (res.profileFromSuunto) {
        const { profile: newProfile, changed } = applySuuntoProfile(StorageService.getProfile(), res.profileFromSuunto);
        setProfile(newProfile);
        StorageService.saveProfile(newProfile);
        if (changed.length) {
          showToast({
            type: 'info',
            title: 'Perfil actualizado desde Suunto',
            message: changed.map((c) => `${SUUNTO_FIELD_LABELS[c.field]}: ${formatProfileValue(c.to)}`).join(' • '),
            duration: 7000,
          });
          askMiguelAboutSuuntoProfile(newProfile, changed);
        }
      }

      // Zonas del reloj: señales del servidor + tu AeT fijado frente a Z3; Miguel te lo cuenta
      if (res.watchZoneAdvice) {
        const cur = StorageService.getProfile();
        const drift = driftZoneRecommendation(cur, res.watchZoneAdvice);
        const advice = { ...res.watchZoneAdvice, recommendations: [...res.watchZoneAdvice.recommendations, ...(drift ? [drift] : [])] };
        const withAdvice = { ...cur, watchZoneAdvice: advice, zoneAdviceState: updateZoneAdviceState(cur.zoneAdviceState, advice.recommendations, new Date().toISOString()) };
        setProfile(withAdvice);
        StorageService.saveProfile(withAdvice);
        void announceZoneAdvice();
      }

      // Después del perfil, para que los check-ins usen su HRV de referencia
      const summary = StorageService.mergeSuuntoSync(res.workouts || [], res.checkIns || []);
      setWorkouts(StorageService.getWorkouts());

      // Banda de pecho: si Suunto registró ZoneSense en los últimos 30 días, la llevas
      // (lo que hayas indicado a mano no se toca). Sin ZoneSense no se deduce "no".
      const since30 = addDaysKey(localDateKey(), -30);
      const zsRecent = (res.workouts || []).some((w: Workout) => w.date >= since30 && !!w.zoneSenseBreakdown);
      const cur = StorageService.getProfile();
      if (zsRecent && cur.hasChestStrapSource !== 'manual' && cur.hasChestStrap !== true) {
        const withStrap = { ...cur, hasChestStrap: true, hasChestStrapSource: 'suunto' as const };
        setProfile(withStrap);
        StorageService.saveProfile(withStrap);
      }
      setTodayCheckIn(StorageService.getTodayCheckIn());

      const message = `${res.message} Nuevos: ${summary.addedWorkouts} entrenos añadidos, ${summary.completedPlanned} sesiones planificadas completadas, ${summary.checkInsAdded} check-ins.`;
      handleUpdateSuuntoConfig({
        ...current,
        auth: res.newAuth || current.auth,
        connected: true,
        lastSync: res.lastSync || new Date().toISOString(),
        syncStatus: 'synced',
        totalActivitiesSynced: (res.workouts || []).length,
        lastSyncMessage: message,
      });
      apiStatus.reportSuuntoOk();
      showToast({ type: 'success', title: 'Suunto sincronizado', message });
      return message;
    } catch (err: any) {
      const message = `Fallo de sincronización: ${err.message}`;
      handleUpdateSuuntoConfig({ ...current, syncStatus: 'error', lastSyncMessage: message });
      showToast({ type: 'error', title: 'Error de API de Suunto', message: err.message });
      return message;
    } finally {
      setIsSyncingSuunto(false);
    }
  };

  // Aviso emergente en cada error de API (visible incluso con un modal abierto;
  // el banner de arriba mantiene el detalle y qué hacer).
  const apiState = useApiStatus();
  const lastApiToast = useRef<{ key: string; at: number } | null>(null);
  const toastApiError = (title: string, message?: string) => {
    // Evita repetir el mismo aviso (p. ej. la comprobación inicial doble de React StrictMode)
    const key = `${title}|${message}`;
    if (lastApiToast.current && lastApiToast.current.key === key && Date.now() - lastApiToast.current.at < 15000) return;
    lastApiToast.current = { key, at: Date.now() };
    showToast({ type: 'error', title, message, duration: 7000 });
  };
  useEffect(() => {
    if (apiState.ai.state === 'error' && apiState.ai.at) toastApiError('Error de API de IA', apiState.ai.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiState.ai.at, apiState.ai.state]);
  useEffect(() => {
    if (apiState.backend.state === 'down') toastApiError('La API de la app no responde', apiState.backend.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiState.backend.state, apiState.backend.message]);

  // Al abrir la app: comprobar que la API y la configuración de IA están bien
  // (no gasta tokens). Si algo falla, aparece el banner "Error de API".
  useEffect(() => {
    ApiService.getHealth().catch(() => {
      // el fallo ya actualiza el indicador y el banner
    });
  }, []);

  // Estado de Suunto para el indicador de la barra superior
  useEffect(() => {
    if (!suuntoConfig.connected) apiStatus.reportSuuntoDisconnected(suuntoConfig.lastSyncMessage);
    else if (suuntoConfig.syncStatus !== 'error') apiStatus.reportSuuntoOk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suuntoConfig.connected]);

  // Datos en el servidor (Fase B): al abrir, carga del servidor (o pide la subida única),
  // y sincroniza con Suunto si vuelves del login o si hace más de 3 h de la última vez.
  const [remote, setRemote] = useState<RemoteState>(RemoteData.state);
  useEffect(() => RemoteData.subscribe(setRemote), []);
  useEffect(() => {
    const onReload = () => reloadFromStorage();
    window.addEventListener(RemoteData.RELOAD_EVENT, onReload);
    return () => window.removeEventListener(RemoteData.RELOAD_EVENT, onReload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initStarted = useRef(false);
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    const params = new URLSearchParams(window.location.search);
    const backFromSuunto = params.get('suunto') === 'connected';
    if (backFromSuunto) window.history.replaceState(null, '', window.location.pathname);
    RemoteData.init({ onError: (message) => showToast({ type: 'error', title: 'No se ha guardado', message, duration: 9000 }) })
      .then((st) => {
        reloadFromStorage();
        if (st.mode === 'server' && st.needsImport) return;
        // Recomendaciones de zonas que Miguel aún no te ha contado (p. ej. tras el cron de la mañana)
        void announceZoneAdvice();
        const cfg = StorageService.getSuuntoConfig();
        const stale = !cfg.lastSync || Date.now() - Date.parse(cfg.lastSync) > 3 * 3600_000;
        if (backFromSuunto || (cfg.connected && stale && navigator.onLine !== false)) handleSyncSuunto();
      })
      .catch((err) => showToast({ type: 'error', title: 'No se pudieron cargar tus datos del servidor', message: err.message }));
    // Si se conectó desde la guía de setup (sin terminar), se vuelve a ella
    if (backFromSuunto && !StorageService.getProfile().setupCompleted) setIsSetupGuideOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleServerImport = async (uploadLocal: boolean) => {
    try {
      const message = await RemoteData.runImport(uploadLocal);
      reloadFromStorage();
      showToast({ type: 'success', title: uploadLocal ? 'Datos subidos al servidor' : 'Datos del servidor cargados', message, duration: 7000 });
      const cfg = StorageService.getSuuntoConfig();
      if (cfg.connected) handleSyncSuunto();
    } catch (err: any) {
      showToast({ type: 'error', title: 'No se pudo completar la subida', message: err.message, duration: 9000 });
    }
  };

  const handleSaveSingleWorkout = (workout: Workout) => {
    StorageService.addOrUpdateWorkout(workout);
    setWorkouts(StorageService.getWorkouts());
    if (selectedWorkout && selectedWorkout.id === workout.id) {
      setSelectedWorkout(workout);
    }
    const completedTss = workout.completed ? getWorkoutLoad(workout, profile.antHr)?.tss : undefined;
    const tssInfo = workout.completed 
      ? (completedTss != null ? ` • ${completedTss} TSS` : '')
      : (workout.plannedTss ? ` • ${workout.plannedTss} TSS` : '');
    showToast({
      type: 'success',
      title: workout.completed ? 'Sesión Completada' : 'Entrenamiento Guardado',
      message: `${workout.title}${tssInfo}`,
    });
  };

  const handleDeleteWorkout = (id: string) => {
    StorageService.deleteWorkout(id);
    setWorkouts(StorageService.getWorkouts());
    showToast({
      type: 'info',
      title: 'Sesión Eliminada',
      message: 'El entrenamiento ha sido retirado del calendario.',
    });
  };

  const handleScheduleDeload = (startDateStr?: string) => {
    // Descarga generada por el código con la política del motor (src/brain/deload.ts):
    // tus sesiones planificadas al 75 % y sin intensidad, sin pulsaciones ni cifras inventadas.
    const startKey = startDateStr || addDaysKey(localDateKey(), 1);
    const deload = buildDeload(StorageService.getWorkouts(), startKey, resolveIntensityPrescription(profile).aetHr);
    if (!deload.workouts.length) {
      showToast({ type: 'warning', title: 'Descarga no generada', message: deload.message, duration: 8000 });
      return;
    }
    deload.workouts.forEach((w) => StorageService.addOrUpdateWorkout(w));
    setWorkouts(StorageService.getWorkouts());

    const msg: ChatMessage = {
      id: `deload-msg-${Date.now()}`,
      role: 'assistant',
      content: `🛡️ **Semana de descarga en tu calendario**\n\n${deload.message}\n\nLo que toque cada día lo sigue decidiendo el semáforo de la mañana.`,
      timestamp: new Date().toISOString(),
      contextType: 'plan_adaptation',
    };
    const updatedMsgs = [...chatMessages, msg];
    setChatMessages(updatedMsgs);
    StorageService.saveChatMessages(updatedMsgs);

    showToast({ type: 'info', title: 'Descarga programada', message: deload.message, duration: 6000 });
    setActiveTab('calendar');
  };

  const handleSaveCheckIn = (checkIn: DailyCheckIn) => {
    StorageService.saveCheckIn(checkIn);
    setTodayCheckIn(checkIn);
    setIsCheckInModalOpen(false);

    showToast({
      type: checkIn.status === 'optimal' ? 'success' : checkIn.status === 'moderate' || checkIn.status === 'unknown' ? 'info' : 'warning',
      title: 'Check-in Matutino Guardado',
      message: `Estado: ${checkIn.status === 'optimal' ? 'Recuperación Óptima' : checkIn.status === 'unknown' ? 'Sin datos para valorar la recuperación' : checkIn.status === 'moderate' ? 'Fatiga Moderada' : 'Fatiga Alta'} • HRV rMSSD: ${checkIn.hrvRmssd} ms`,
    });

    // If checkIn has fatigue, notify athlete
    if (checkIn.status === 'fatigued') {
      const msg: ChatMessage = {
        id: `checkin-alert-${Date.now()}`,
        role: 'assistant',
        content: `Acabo de registrar tu check-in matutino de Suunto. Tu HRV nocturna ha caído a ${checkIn.hrvRmssd} ms y solo descansaste ${checkIn.sleepHours}h. 

Tus células y tu sistema nervioso autónomo están pidiendo tregua. No fuerces la máquina hoy con entrenos intensos. Si tienes programada una sesión fuerte, pulsa el botón de adaptar para que la ajustemos a rodaje regenerativo o descanso.`,
        timestamp: new Date().toISOString(),
        contextType: 'hrv_alert',
      };
      const updatedMsgs = [...chatMessages, msg];
      setChatMessages(updatedMsgs);
      StorageService.saveChatMessages(updatedMsgs);
    }
  };

  const handleToggleTestData = () => {
    if (isTestDataActive) {
      setIsClearDataModalOpen(true);
    } else {
      if (!confirm('¿Cargar datos de ejemplo?\n\nSe AÑADEN entrenos, check-ins y registros ficticios para probar la app; tus datos se conservan. Mientras estén cargados, CTL/ATL/TSB y las gráficas mezclan datos de ejemplo. Al sincronizar Suunto o quitar la prueba se eliminan.')) return;
      StorageService.loadFullTestData();
      setWorkouts(StorageService.getWorkouts());
      setTodayCheckIn(StorageService.getTodayCheckIn());
      setIsTestDataActive(true);
    }
  };

  const handleConfirmClearSampleOnly = () => {
    StorageService.clearOnlySampleData();
    setWorkouts(StorageService.getWorkouts());
    setTodayCheckIn(StorageService.getTodayCheckIn());
    setIsTestDataActive(false);
  };

  const handleConfirmClearAll = () => {
    StorageService.clearAllWorkoutsAndData();
    setWorkouts([]);
    setTodayCheckIn(undefined);
    setIsTestDataActive(false);
  };

  // Find today's workout
  const todayStr = localDateKey();
  const todayWorkout = workouts.find((w) => w.date === todayStr);

  // Hechos calculados para Miguel (carga, historial, readiness de hoy, check-ins)
  const getBrainContext = (plannedToday?: Workout | null) =>
    buildBrainContext(StorageService.getWorkouts(), StorageService.getProfile(), StorageService.getCheckIns(), plannedToday);

  // Adapt today's session based on HRV fatigue
  const handleAdaptTodaySession = async () => {
    if (!todayWorkout || !todayCheckIn) return;

    setIsAdaptingSession(true);
    try {
      // El motor de readiness fija los límites; Miguel elige dentro de ellos
      const brain = getBrainContext(todayWorkout);
      const adaptation = await ApiService.adaptSession(todayWorkout, todayCheckIn, profile, historyDoc, brain.todayReadiness, {
        tsb: brain.tsb,
        weeklyTss: brain.weeklyTss,
        ctl: brain.ctl,
      });

      const adaptedWorkout: Workout = {
        ...todayWorkout,
        ...adaptation.adaptedWorkout,
        title: adaptation.adaptedWorkout.title || `${todayWorkout.title} (Adaptada)`,
        wasAdapted: true,
        adaptationReason: adaptation.adaptedWorkout.adaptationReason || 'Adaptada por fatiga matutina de HRV',
      };

      handleSaveSingleWorkout(adaptedWorkout);

      // Record adaptation into Coach Memory
      const updatedMem = StorageService.recordAdaptation({
        originalWorkoutTitle: todayWorkout.title,
        adaptedWorkoutTitle: adaptedWorkout.title || `${todayWorkout.title} (Adaptada)`,
        triggerReason: adaptation.miguelMessage,
      });
      setCoachMemory(updatedMem);

      // Add Miguel's explanation to chat
      const coachMsg: ChatMessage = {
        id: `adapt-msg-${Date.now()}`,
        role: 'assistant',
        content: adaptation.corrections?.length
          ? `${adaptation.miguelMessage}\n\nAjustes del motor de readiness: ${adaptation.corrections.join(' ')}`
          : adaptation.miguelMessage,
        timestamp: new Date().toISOString(),
        contextType: 'plan_adaptation',
        relatedWorkoutId: adaptedWorkout.id,
      };

      const newMsgs = [...chatMessages, coachMsg];
      setChatMessages(newMsgs);
      StorageService.saveChatMessages(newMsgs);

      alert(`Sesión adaptada por Miguel: ${adaptedWorkout.title}`);
    } catch (err: any) {
      // El aviso "Error de API de IA" (toast + banner) lo muestra apiStatus
      console.error('Error al adaptar sesión:', err);
    } finally {
      setIsAdaptingSession(false);
    }
  };

  // Generar semana con Miguel: 3 sesiones entre semana (o 2 si Miguel lo
  // decide por fatiga o disponibilidad) + tirada larga en sábado o domingo.
  const handleGenerateWeekWithMiguel = async (weekStartDateStr: string) => {
    setIsGeneratingPlan(true);
    try {
      const monday = mondayOfKey(weekStartDateStr);
      // Evidencia nutricional REAL (si no existe, la IA no puede dar cifras)
      const gut = StorageService.getGutProfile();
      const heat = profile.advancedPhysiologicalProfile?.heatTolerance;
      const plan = await ApiService.generatePlan(
        profile,
        targetRace,
        monday,
        `Base aeróbica estricta y preparación para ${targetRace.name}`,
        historyDoc,
        coachMemory,
        getBrainContext(),
        summarizeWeekWorkouts(workouts, monday, profile.antHr),
        {
          maxCarbsPerHourG: gut?.currentMaxCarbsPerHour ?? null,
          sweatRateLph: heat?.sweatRateDocumentedLitersPerHour ?? null,
          sodiumProfile: heat?.sodiumLossProfile ?? null,
        }
      );

      // Plan rechazado por el contrato (estructura imposible de reparar sin inventar): no se guarda nada
      if (plan.status === 'rejected') {
        showToast({
          type: 'error',
          title: 'Plan no guardado',
          message: `${plan.error || 'El plan no cumple la estructura obligatoria.'} Motivos: ${(plan.issues || []).join('; ')}. Vuelve a generarlo.`,
          duration: 9000,
        });
        return;
      }

      // Fechas de la semana (lunes..domingo) en hora local
      const sunday = addDaysKey(monday, 6);
      // Fechas fuera de la semana: se usa el día de su posición solo si está libre;
      // si no, se descarta (antes se amontonaban varias sesiones en el domingo).
      const usedDates = new Set(plan.workouts.map((w) => w.date).filter((d) => d && d >= monday && d <= sunday));
      const droppedDates: string[] = [];
      const newWorkouts: Workout[] = plan.workouts.flatMap((w, index) => {
        let date = w.date;
        if (!(date && date >= monday && date <= sunday)) {
          const byPosition = index <= 6 ? addDaysKey(monday, index) : null;
          if (!byPosition || usedDates.has(byPosition)) {
            droppedDates.push(w.title || w.date || `sesión ${index + 1}`);
            return [];
          }
          date = byPosition;
          usedDates.add(date);
        }
        return [{ ...w, id: `gen-${date}-${Date.now()}-${index}`, date, completed: false }];
      });

      // Solo se sustituyen sesiones PLANIFICADAS sin completar de esos días.
      // Nunca se borran entrenos hechos ni actividades importadas de Suunto.
      const newDates = new Set(newWorkouts.map((nw) => nw.date));
      const kept = workouts.filter(
        (ex) => ex.completed || !!ex.suuntoWorkoutKey || !newDates.has(ex.date)
      );

      const combined = [...kept, ...newWorkouts];
      handleSaveWorkouts(combined);

      // Resumen con la estructura REAL que ha devuelto Miguel
      const structure = analyzeWeekStructure(newWorkouts, monday);
      const structureLine = `Estructura: ${structure.midweekPlanned} sesiones entre semana + tirada larga ${structure.longRunDay ? `el ${structure.longRunDay}` : '(no planificada)'}.`;
      const allNotes = [
        ...(plan.validationNotes || []),
        ...(droppedDates.length ? [`Sesiones sin fecha válida descartadas: ${droppedDates.join(', ')}.`] : []),
      ];
      const notesLine = allNotes.length ? `\n\nCorrecciones automáticas del sistema: ${allNotes.join(' ')}` : '';
      // El servidor ya ha comprobado la estructura: si no se cumpliera, el plan no llegaría aquí
      const warningLine = structure.issues.length ? `\n\n⚠️ Revisa la semana: ${structure.issues.join('; ')}.` : '';

      // Add Miguel's summary message to the chat
      const chatMsg: ChatMessage = {
        id: `plan-gen-${Date.now()}`,
        role: 'assistant',
        content: `He preparado el microciclo semanal comenzando el lunes ${monday}.

${plan.weekSummary}

${structureLine} Ya puedes ver los entrenamientos en tu calendario.${warningLine}${notesLine}`,
        timestamp: new Date().toISOString(),
        contextType: 'general',
      };

      const updatedChat = [...chatMessages, chatMsg];
      setChatMessages(updatedChat);
      StorageService.saveChatMessages(updatedChat);

      showToast({
        type: 'success',
        title: plan.status === 'repaired' ? 'Semana planificada (con ajustes)' : 'Semana planificada',
        message: plan.status === 'repaired' ? 'El sistema ha corregido detalles del plan; los tienes en el chat.' : 'Revisa tu calendario.',
      });
    } catch (err: any) {
      // El aviso "Error de API de IA" (toast + banner) lo muestra apiStatus
      console.error('Error al generar la semana:', err);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Chat send message
  const handleSendMessage = async (content: string, contextWorkoutId?: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      relatedWorkoutId: contextWorkoutId,
    };

    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    StorageService.saveChatMessages(updated);
    setIsChatLoading(true);

    try {
      const historyPayload = updated.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const { reply, knowledgeSources, memorySources, knowledgeWarning } = await ApiService.sendMessage(
        historyPayload,
        profile,
        todayCheckIn,
        targetRace,
        contextWorkoutId
          ? `Sesión consultada: ${JSON.stringify(workouts.find((w) => w.id === contextWorkoutId))}`
          : undefined,
        historyDoc,
        coachMemory,
        getBrainContext(todayWorkout)
      );

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
        knowledgeSources,
        memorySources,
        knowledgeWarning,
      };

      const finalMsgs = [...updated, assistantMsg];
      setChatMessages(finalMsgs);
      StorageService.saveChatMessages(finalMsgs);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error de API de IA: ${err.message}${err.hint ? `\n\nQué hacer: ${err.hint}` : ''}`,
        timestamp: new Date().toISOString(),
      };
      setChatMessages([...updated, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Mensajes ya guardados en Supabase (botón "Guardar en Supabase" del chat)
  const handleMarkChatSaved = (clientIds: string[], savedAt: string) => {
    const ids = new Set(clientIds);
    const msgs = StorageService.getChatMessages().map((m) => (ids.has(m.id) && !m.savedAt ? { ...m, savedAt } : m));
    StorageService.saveChatMessages(msgs);
    setChatMessages(msgs);
  };

  // Conversación cargada desde Supabase: sustituye a la del dispositivo
  const handleLoadConversation = (msgs: ChatMessage[]) => {
    StorageService.saveChatMessages(msgs);
    setChatMessages(msgs);
  };

  // Jump to chat with a workout context
  const handleAskMiguelAboutWorkout = (workout: Workout) => {
    setActiveWorkoutContext(workout);
    setSelectedWorkout(null);
    setActiveTab('chat');
  };

  // Evidencias contadas en el chat: quedan PENDIENTES hasta que el atleta las confirme
  const handleExtractChatEvidence = async (): Promise<number> => {
    const msgs = chatMessages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
    const { evidence } = await ApiService.extractChatEvidence(msgs, coachMemory);
    if (!evidence?.length) return 0;
    // refId = la conversación: volver a extraer de ella no suma dos veces al mismo aprendizaje
    const convId = chatMessages.find((m) => m.role === 'user')?.id ?? String(Date.now());
    const updated = addPending(StorageService.getCoachMemory(), evidence, localDateKey(), `chat-${convId}`);
    handleSaveCoachMemory(updated);
    return evidence.length;
  };

  // Analyze completed workout with Miguel
  const handleAnalyzeWorkout = async (
    workout: Workout,
    fitData?: any,
    athleteFeedback?: any
  ): Promise<any> => {
    const result = await ApiService.analyzeWorkout(
      workout,
      fitData,
      profile,
      athleteFeedback,
      historyDoc,
      coachMemory
    );

    // Una sesión aporta EVIDENCIAS; el estado (observación → regla) lo decide src/brain/memory.ts.
    // refId = la sesión: re-analizarla no cuenta dos veces.
    let memoryChanges: string[] = [];
    if (result && Array.isArray(result.evidence) && result.evidence.length > 0) {
      const applied = StorageService.applyMemoryEvidence(result.evidence, {
        date: workout.date,
        source: 'workout_analysis',
        refId: workout.id,
        sourceEvent: `Análisis de "${workout.title}"`,
      });
      setCoachMemory(applied.memory);
      memoryChanges = applied.changes;
    }

    return { ...result, memoryChanges };
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={profile}
        targetRace={targetRace}
        todayCheckIn={todayCheckIn}
        onOpenCheckIn={() => setIsCheckInModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        hasHistoryDoc={!!historyDoc}
        learnedRulesCount={coachMemory.insights.filter((i) => isAppliedRule(i.status)).length}
        isTestDataActive={isTestDataActive}
        onToggleTestData={handleToggleTestData}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
        onDisconnectSuunto={suuntoConfig.connected ? handleDisconnectSuunto : undefined}
      />

      {/* Main Container */}
      <ApiErrorBanner />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-6 space-y-6">
        
        {/* Sincronizar con Suunto desde la pantalla principal (o conectarlo) */}
        {remote.needsImport && <ServerDataBanner onImport={handleServerImport} />}
        <SuuntoSyncBar config={suuntoConfig} isSyncing={isSyncingSuunto} onSync={() => void handleSyncSuunto()} />
        <ZoneAdviceBanner recommendations={pendingZoneAdvice(profile)} onResolve={handleResolveZoneAdvice} />

        {/* Morning Readiness & Fatigue Warning Banner */}
        <MorningBanner
          checkIn={todayCheckIn}
          todayWorkout={todayWorkout}
          onOpenCheckIn={() => setIsCheckInModalOpen(true)}
          onAdaptSession={handleAdaptTodaySession}
          isAdapting={isAdaptingSession}
          isSetupIncomplete={!profile.setupCompleted}
          onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
        />

        {/* Quick Weight & Biomechanics Widget */}
        {(activeTab === 'calendar' || activeTab === 'performance') && (
          <WeightQuickWidget
            profile={profile}
            onUpdateProfile={(updated) => {
              setProfile(updated);
              StorageService.saveProfile(updated);
            }}
            onOpenFullPerformance={() => setActiveTab('performance')}
          />
        )}

        {/* Dynamic Views */}
        {activeTab === 'calendar' && (
          <CalendarView
            workouts={workouts}
            profile={profile}
            targetRace={targetRace}
            onSelectWorkout={(w) => setSelectedWorkout(w)}
            onAddNewWorkout={(dateStr) => {
              setSelectedAddDate(dateStr);
              setIsAddWorkoutModalOpen(true);
            }}
            onGenerateWeekWithMiguel={handleGenerateWeekWithMiguel}
            isGeneratingPlan={isGeneratingPlan}
            onOpenFartlekGenerator={() => setIsFartlekModalOpen(true)}
          />
        )}

        {activeTab === 'metrics' && (
          <MetricsDashboardView
            profile={profile}
            targetRace={targetRace}
            workouts={workouts}
            checkIns={StorageService.getCheckIns()}
            pmcData={pmcData}
            suuntoConfig={suuntoConfig}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onScheduleDeload={handleScheduleDeload}
          />
        )}

        {activeTab === 'performance' && (
          <PerformanceSummaryView
            profile={profile}
            workouts={workouts}
            checkIns={StorageService.getCheckIns()}
            onScheduleDeload={handleScheduleDeload}
            onOpenFartlekGenerator={() => setIsFartlekModalOpen(true)}
            onUpdateProfile={(updated) => {
              setProfile(updated);
              StorageService.saveProfile(updated);
            }}
          />
        )}

        {activeTab === 'simulation' && (
          <TransvulcaniaSimulationView
            profile={profile}
            onAskMiguel={(prompt) => {
              setActiveTab('chat');
              handleSendMessage(prompt);
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'pmc' && (
          <PMCChartView 
            profile={profile}
            workouts={workouts}
          />
        )}

        {activeTab === 'gut' && (
          <GutTrainingView 
            profile={profile}
            onNutritionLinked={handleNutritionLinked}
          />
        )}

        {activeTab === 'hydration' && (
          <HydrationView 
            profile={profile}
          />
        )}

        {activeTab === 'eccentric' && (
          <EccentricStrengthView />
        )}

        {activeTab === 'memory' && (
          <CoachMemoryView
            memory={coachMemory}
            onUpdateMemory={handleSaveCoachMemory}
            profile={profile}
            onRegeneratePlanWithMemory={() => {
              setActiveTab('calendar');
              handleGenerateWeekWithMiguel(new Date().toISOString().split('T')[0]);
            }}
          />
        )}

        {activeTab === 'knowledge' && <KnowledgeLibraryView />}

        {activeTab === 'history' && (
          <AthleteHistoryView
            profile={profile}
            onUpdateProfile={handleSaveProfile}
            historyDoc={historyDoc}
            onSaveHistoryDoc={handleSaveHistoryDoc}
            suuntoConfig={suuntoConfig}
            onSyncSuunto={handleSyncSuunto}
            isSyncingSuunto={isSyncingSuunto}
            onDisconnectSuunto={handleDisconnectSuunto}
          />
        )}

        {activeTab === 'chat' && (
          <div className="space-y-3">
          <ChatCloudPanel
            messages={chatMessages}
            onMarkSaved={handleMarkChatSaved}
            onLoadConversation={handleLoadConversation}
          />
          <CoachChat
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            profile={profile}
            todayCheckIn={todayCheckIn}
            targetRace={targetRace}
            recentWorkouts={workouts.slice(-5)}
            onClearHistory={() => {
              const unsaved = chatMessages.filter((m) => isSavableMessage(m) && !m.savedAt).length;
              const warning = unsaved ? `\n\n⚠️ Hay ${unsaved} mensaje(s) sin guardar en Supabase: se perderán.` : '';
              if (confirm(`¿Borrar la conversación de este dispositivo?\n\nLo que ya esté guardado en Supabase NO se borra y puedes volver a cargarlo.${warning}`)) {
                StorageService.saveChatMessages([]);
                StorageService.setChatSessionId(null);
                setChatMessages(StorageService.getChatMessages());
              }
            }}
            activeWorkoutContext={activeWorkoutContext}
            onExtractEvidence={handleExtractChatEvidence}
          />
          </div>
        )}

        {activeTab === 'periodization' && (
          <PeriodizationView
            targetRace={targetRace}
            secondaryRaces={secondaryRaces}
            onSaveSecondaryRaces={handleSaveSecondaryRaces}
            profile={profile}
          />
        )}

        {activeTab === 'zonesense' && (
          <ZoneSenseSuuntoView
            profile={profile}
            suuntoConfig={suuntoConfig}
            onDisconnectSuunto={handleDisconnectSuunto}
            onSyncSuunto={handleSyncSuunto}
            isSyncingSuunto={isSyncingSuunto}
          />
        )}

        {activeTab === 'physiology' && (
          <DriftTestView
            profile={profile}
            onUpdateProfile={handleSaveProfile}
          />
        )}

      </main>

      {/* Modals */}
      <DailyReadinessModal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        onSave={handleSaveCheckIn}
        currentCheckIn={todayCheckIn}
      />

      <WorkoutDetailModal
        workout={selectedWorkout}
        isOpen={!!selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        onSave={handleSaveSingleWorkout}
        onDelete={handleDeleteWorkout}
        onAskMiguel={handleAskMiguelAboutWorkout}
        onAnalyzeWorkout={handleAnalyzeWorkout}
        profile={profile}
      />

      {/* Se montan al abrir: así siempre parten del perfil actual (p. ej. recién actualizado desde Suunto) */}
      {isProfileModalOpen && (
        <AthleteProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          profile={profile}
          onSaveProfile={handleSaveProfile}
          targetRace={targetRace}
          suuntoConnected={suuntoConfig.connected}
          onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
          onOpenBackup={() => setIsBackupModalOpen(true)}
        />
      )}

      {isSetupGuideOpen && (
        <SetupGuideModal
          isOpen={isSetupGuideOpen}
          onClose={() => setIsSetupGuideOpen(false)}
          profile={profile}
          onSaveProfile={handleSaveProfile}
          targetRace={targetRace}
          suuntoConfig={suuntoConfig}
          onOpenSuuntoTab={() => setActiveTab('zonesense')}
          onOpenBackup={() => setIsBackupModalOpen(true)}
          onSyncSuunto={handleSyncSuunto}
          isSyncingSuunto={isSyncingSuunto}
        />
      )}

      <AddWorkoutModal
        isOpen={isAddWorkoutModalOpen}
        onClose={() => setIsAddWorkoutModalOpen(false)}
        onSave={(w) => {
          handleSaveSingleWorkout(w);
          setIsAddWorkoutModalOpen(false);
        }}
        initialDateStr={selectedAddDate}
        defaultAetHr={profile.aetHr}
        defaultAntHr={profile.antHr}
      />

      <FartlekGeneratorModal
        isOpen={isFartlekModalOpen}
        onClose={() => setIsFartlekModalOpen(false)}
        profile={profile}
        todayCheckIn={todayCheckIn}
        onWorkoutAdded={handleSaveSingleWorkout}
      />

      <ClearTestDataModal
        isOpen={isClearDataModalOpen}
        onClose={() => setIsClearDataModalOpen(false)}
        onConfirmClearSampleOnly={handleConfirmClearSampleOnly}
        onConfirmClearAll={handleConfirmClearAll}
      />

      {/* Global Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsCommandPaletteOpen(false);
        }}
        onOpenCheckIn={() => {
          setIsCheckInModalOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onOpenAddWorkout={() => {
          setSelectedAddDate(new Date().toISOString().split('T')[0]);
          setIsAddWorkoutModalOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onOpenFartlek={() => {
          setIsFartlekModalOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onOpenProfile={() => {
          setIsProfileModalOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onOpenBackup={() => {
          setIsBackupModalOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onOpenSetupGuide={() => {
          setIsSetupGuideOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onToggleTestData={handleToggleTestData}
      />

      {/* Backup and Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onRestoreSuccess={handleRestoreSuccess}
      />

      {/* Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
      />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onNavigateTab={setActiveTab}
        onOpenCheckIn={() => setIsCheckInModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        todayCheckIn={todayCheckIn}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-4 text-center text-xs text-zinc-600">
        <p>Uphill Coach AI • Basado en <em>Training for the Uphill Athlete</em> y tus pulsaciones</p>
      </footer>

      {/* Offline Mountain Indicator */}
      <OfflineIndicator />

    </div>
  );
}
