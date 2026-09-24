import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { MorningBanner } from './components/MorningBanner';
import { CalendarView } from './components/CalendarView';
import { CoachChat } from './components/CoachChat';
import { AthleteHistoryView } from './components/AthleteHistoryView';
import { CoachMemoryView } from './components/CoachMemoryView';
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
  ToastType
} from './types';
import { StorageService } from './services/storage';
import { ApiService } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('calendar');
  const [isTestDataActive, setIsTestDataActive] = useState<boolean>(StorageService.isTestDataActive());
  
  // Persistent State
  const [profile, setProfile] = useState<AthleteProfile>(StorageService.getProfile());
  const [targetRace, setTargetRace] = useState<TargetRace>(StorageService.getTargetRace());
  const [secondaryRaces, setSecondaryRaces] = useState<TargetRace[]>(StorageService.getSecondaryRaces());
  const [workouts, setWorkouts] = useState<Workout[]>(StorageService.getWorkouts());
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
  const handleSaveProfile = (updated: AthleteProfile) => {
    setProfile(updated);
    StorageService.saveProfile(updated);
    showToast({
      type: 'success',
      title: 'Perfil Actualizado',
      message: `AeT: ${updated.aetHr} bpm • AnT: ${updated.antHr} bpm • Peso: ${updated.weightKg} kg`,
    });
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

  const handleAddNewInsight = (insight: Omit<CoachLearnedInsight, 'id'>) => {
    const updated = StorageService.addLearnedInsight(insight);
    setCoachMemory(updated);
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

  // Trae workouts y sueño/HRV reales de Suunto y los integra en el calendario y los check-ins.
  const handleSyncSuunto = async (): Promise<string> => {
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

      const summary = StorageService.mergeSuuntoSync(res.workouts || [], res.checkIns || []);
      setWorkouts(StorageService.getWorkouts());
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

  // Vuelta del login de Suunto (/api/suunto/callback redirige a /?suunto=connected):
  // recarga la config con los tokens nuevos y sincroniza automáticamente.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('suunto') !== 'connected') return;
    window.history.replaceState(null, '', window.location.pathname);
    setSuuntoConfig(StorageService.getSuuntoConfig());
    handleSyncSuunto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSingleWorkout = (workout: Workout) => {
    StorageService.addOrUpdateWorkout(workout);
    setWorkouts(StorageService.getWorkouts());
    if (selectedWorkout && selectedWorkout.id === workout.id) {
      setSelectedWorkout(workout);
    }
    const tssInfo = workout.completed 
      ? (workout.actualTss || workout.plannedTss ? ` • ${workout.actualTss || workout.plannedTss} TSS` : '')
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
    // Generate 4 regenerative sessions for the deload microcycle (-45% volume, 100% Z1 sub-130 bpm)
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 2); // Start in 2 days or next cycle
    
    const deloadWorkouts: Workout[] = [
      {
        id: `deload-w1-${Date.now()}`,
        date: new Date(baseDate.getTime() + 0 * 86400000).toISOString().split('T')[0],
        title: 'Microciclo Descarga: Rodaje Regenerativo Z1 Suave',
        type: 'easy_run',
        plannedDurationMin: 35,
        plannedDistanceKm: 5.2,
        plannedElevationGainM: 80,
        plannedTss: 20,
        intensityFactor: 0.74,
        targetHrMin: 115,
        targetHrMax: 130,
        zoneSenseTarget: 'Regenerativo',
        description: 'Microciclo de Descarga prescrito por Miguel. Rodaje 100% regenerativo sin impacto articular ni pendientes pronunciadas.',
        personalizedReasoning: 'Reducción del 45% del volumen para permitir rebote del sistema nervioso parasimpático tras la sobrecarga acumulada del Mesociclo 2.',
        learnedAdjustment: 'Prohibidas las subidas pronunciadas y el trabajo excéntrico de bajada. Mantener respiración nasal constante.',
        warmup: '5 min caminando + rotaciones articulares.',
        mainSet: '25 min de trote muy cómodo sobre hierba o tierra batida. FC < 130 bpm.',
        cooldown: '5 min caminando descalzo.',
        completed: false,
      },
      {
        id: `deload-w2-${Date.now() + 1}`,
        date: new Date(baseDate.getTime() + 2 * 86400000).toISOString().split('T')[0],
        title: 'Microciclo Descarga: Fartlek Dinámico de Movilidad & Soltura',
        type: 'easy_run',
        plannedDurationMin: 40,
        plannedDistanceKm: 6.0,
        plannedElevationGainM: 100,
        plannedTss: 24,
        intensityFactor: 0.75,
        targetHrMin: 118,
        targetHrMax: 132,
        zoneSenseTarget: 'Regenerativo',
        description: 'Cambios sutiles de cadencia (175-180 ppm) para soltar piernas sin activar la glucólisis ni elevar el cortisol.',
        personalizedReasoning: 'Activa la propiocepción y la elasticidad fascial sin estrés metabólico.',
        learnedAdjustment: '3 series de sóleo excéntrico en escalón 3-1-1 al terminar para mantener sano el tendón de Aquiles.',
        warmup: '10 min trote suave.',
        mainSet: '4 bloques de [1 min zancada alegre y relajada < 132 bpm / 4 min trote muy suave < 120 bpm].',
        cooldown: '10 min caminando + estiramientos de cadera y sóleos.',
        completed: false,
      },
      {
        id: `deload-w3-${Date.now() + 2}`,
        date: new Date(baseDate.getTime() + 4 * 86400000).toISOString().split('T')[0],
        title: 'Microciclo Descarga: Rodaje Asimilación & Respiración Nasal',
        type: 'easy_run',
        plannedDurationMin: 45,
        plannedDistanceKm: 6.8,
        plannedElevationGainM: 120,
        plannedTss: 28,
        intensityFactor: 0.75,
        targetHrMin: 118,
        targetHrMax: 130,
        zoneSenseTarget: 'Regenerativo',
        description: 'Sesión aeróbica de baja tensión para consolidar las adaptaciones mitocondriales del bloque anterior.',
        personalizedReasoning: 'Consolidación de la base aeróbica y depósitos de glucógeno.',
        warmup: '8 min caminando.',
        mainSet: '32 min continuos manteniendo DFA a1 en verde oscuro en reloj Suunto. Hidratación con 400 mg de sales.',
        cooldown: '5 min marcha relajada.',
        completed: false,
      },
      {
        id: `deload-w4-${Date.now() + 3}`,
        date: new Date(baseDate.getTime() + 6 * 86400000).toISOString().split('T')[0],
        title: 'Microciclo Descarga: Rodaje Corto & Test de Sensaciones',
        type: 'easy_run',
        plannedDurationMin: 50,
        plannedDistanceKm: 7.5,
        plannedElevationGainM: 150,
        plannedTss: 32,
        intensityFactor: 0.76,
        targetHrMin: 120,
        targetHrMax: 132,
        zoneSenseTarget: 'DFA a1 > 0.75 (Aeróbico puro)',
        description: 'Cierre del microciclo de descarga. Evaluación de recuperación muscular y pulso basal matutino.',
        personalizedReasoning: 'Confirmación de recuperación parasimpática antes de iniciar el siguiente mesociclo de resistencia muscular.',
        warmup: '10 min trote suave.',
        mainSet: '35 min rodaje cómodo por senderos cómodos.',
        cooldown: '5 min caminando descalzo.',
        completed: false,
      }
    ];

    deloadWorkouts.forEach(w => StorageService.addOrUpdateWorkout(w));
    setWorkouts(StorageService.getWorkouts());

    const msg: ChatMessage = {
      id: `deload-msg-${Date.now()}`,
      role: 'assistant',
      content: `🛡️ **Microciclo de Descarga Programado en tu Calendario**\n\nHe insertado 4 sesiones regenerativas reduciendo el volumen semanal en un -45% (3.2 horas totales) y limitando tu frecuencia cardíaca a un máximo de 130 bpm (100% Zona 1, DFA a1 > 0.85).\n\nCon esto permitiremos que tu HRV rMSSD vuelva a elevarse por encima de los 51 ms basales y que tus sóleos y cuádriceps asimilen los más de 5.200m D- acumulados en las últimas semanas. ¡Descanso inteligente es parte del entrenamiento hacia Transvulcania 2027!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      contextType: 'plan_adaptation'
    };
    const updatedMsgs = [...chatMessages, msg];
    setChatMessages(updatedMsgs);
    StorageService.saveChatMessages(updatedMsgs);

    showToast({
      type: 'info',
      title: 'Microciclo de Descarga Programado',
      message: '4 sesiones regenerativas (Z1 sub-130 bpm, -45% volumen) añadidas al calendario.',
      duration: 5000,
    });

    setActiveTab('calendar');
  };

  const handleSaveCheckIn = (checkIn: DailyCheckIn) => {
    StorageService.saveCheckIn(checkIn);
    setTodayCheckIn(checkIn);
    setIsCheckInModalOpen(false);

    showToast({
      type: checkIn.status === 'optimal' ? 'success' : checkIn.status === 'moderate' ? 'info' : 'warning',
      title: 'Check-in Matutino Guardado',
      message: `Estado: ${checkIn.status === 'optimal' ? 'Recuperación Óptima' : checkIn.status === 'moderate' ? 'Fatiga Moderada' : 'Fatiga Alta'} • HRV rMSSD: ${checkIn.hrvRmssd} ms`,
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
  const todayStr = new Date().toISOString().split('T')[0];
  const todayWorkout = workouts.find((w) => w.date === todayStr);

  // Adapt today's session based on HRV fatigue
  const handleAdaptTodaySession = async () => {
    if (!todayWorkout || !todayCheckIn) return;

    setIsAdaptingSession(true);
    try {
      const adaptation = await ApiService.adaptSession(todayWorkout, todayCheckIn, profile, historyDoc);

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
        content: adaptation.miguelMessage,
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

  // Generate 7-day week with Miguel (4 days training: 3 midweek + 1 weekend long run)
  const handleGenerateWeekWithMiguel = async (weekStartDateStr: string) => {
    setIsGeneratingPlan(true);
    try {
      const plan = await ApiService.generatePlan(
        profile,
        targetRace,
        weekStartDateStr,
        'Base Aeróbica Estricta & Preparación para Transvulcania 2027',
        historyDoc,
        coachMemory
      );

      // Merge generated workouts into calendar
      const existing = [...workouts];
      const newWorkouts = plan.workouts.map((w, index) => {
        // Compute date based on Monday start
        const startDate = new Date(weekStartDateStr);
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + index);
        const dateStr = targetDate.toISOString().split('T')[0];
        return {
          ...w,
          id: `gen-${dateStr}-${Date.now()}-${index}`,
          date: w.date || dateStr,
          completed: false,
        };
      });

      // Filter out duplicates for those exact dates if empty
      const nonOverlapping = existing.filter(
        (ex) => !newWorkouts.some((nw) => nw.date === ex.date)
      );

      const combined = [...nonOverlapping, ...newWorkouts];
      handleSaveWorkouts(combined);

      // Add Miguel's summary message to the chat
      const chatMsg: ChatMessage = {
        id: `plan-gen-${Date.now()}`,
        role: 'assistant',
        content: `He preparado el microciclo semanal comenzando el lunes ${weekStartDateStr} para tu camino a Transvulcania 2027.

${plan.weekSummary}

Son exactamente 4 días de carga (3 entre semana y la tirada larga del fin de semana con desnivel), más trabajo de fuerza en casa sin máquinas y 3 días de asimilación/descanso. Ya puedes ver los entrenamientos directamente en tu calendario.`,
        timestamp: new Date().toISOString(),
        contextType: 'general',
      };

      const updatedChat = [...chatMessages, chatMsg];
      setChatMessages(updatedChat);
      StorageService.saveChatMessages(updatedChat);

      alert('¡Semana planificada por Miguel con éxito! Revisa tu calendario.');
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

      const reply = await ApiService.sendMessage(
        historyPayload,
        profile,
        todayCheckIn,
        targetRace,
        contextWorkoutId
          ? `Sesión consultada: ${JSON.stringify(workouts.find((w) => w.id === contextWorkoutId))}`
          : undefined,
        historyDoc,
        coachMemory
      );

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
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

  // Jump to chat with a workout context
  const handleAskMiguelAboutWorkout = (workout: Workout) => {
    setActiveWorkoutContext(workout);
    setSelectedWorkout(null);
    setActiveTab('chat');
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

    if (result && typeof result === 'object' && result.newLearnedInsight) {
      const updatedMem = StorageService.addLearnedInsight({
        category: result.newLearnedInsight.category,
        observation: result.newLearnedInsight.observation,
        ruleForFuturePlans: result.newLearnedInsight.ruleForFuturePlans,
        confidenceScore: result.newLearnedInsight.confidenceScore || 85,
      });
      setCoachMemory(updatedMem);
    }

    return result;
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
        learnedRulesCount={coachMemory.insights.length}
        isTestDataActive={isTestDataActive}
        onToggleTestData={handleToggleTestData}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
      />

      {/* Main Container */}
      <ApiErrorBanner />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-6 space-y-6">
        
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
            pmcData={StorageService.getPMCData()}
            suuntoConfig={suuntoConfig}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onScheduleDeload={handleScheduleDeload}
          />
        )}

        {activeTab === 'performance' && (
          <PerformanceSummaryView
            profile={profile}
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

        {activeTab === 'history' && (
          <AthleteHistoryView
            profile={profile}
            onUpdateProfile={handleSaveProfile}
            historyDoc={historyDoc}
            onSaveHistoryDoc={handleSaveHistoryDoc}
            suuntoConfig={suuntoConfig}
            onSyncSuunto={handleSyncSuunto}
            isSyncingSuunto={isSyncingSuunto}
          />
        )}

        {activeTab === 'chat' && (
          <CoachChat
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            profile={profile}
            todayCheckIn={todayCheckIn}
            targetRace={targetRace}
            recentWorkouts={workouts.slice(-5)}
            onClearHistory={() => {
              if (confirm('¿Reiniciar la conversación con Miguel?')) {
                StorageService.saveChatMessages([]);
                setChatMessages(StorageService.getChatMessages());
              }
            }}
            activeWorkoutContext={activeWorkoutContext}
          />
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
            onUpdateSuuntoConfig={handleUpdateSuuntoConfig}
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
        onAddNewInsight={handleAddNewInsight}
      />

      <AthleteProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        targetRace={targetRace}
        onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
      />

      <SetupGuideModal
        isOpen={isSetupGuideOpen}
        onClose={() => setIsSetupGuideOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        targetRace={targetRace}
        suuntoConfig={suuntoConfig}
        onOpenSuuntoTab={() => setActiveTab('zonesense')}
        onOpenBackup={() => setIsBackupModalOpen(true)}
      />

      <AddWorkoutModal
        isOpen={isAddWorkoutModalOpen}
        onClose={() => setIsAddWorkoutModalOpen(false)}
        onSave={(w) => {
          handleSaveSingleWorkout(w);
          setIsAddWorkoutModalOpen(false);
        }}
        initialDateStr={selectedAddDate}
        defaultAetHr={profile.aetHr}
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
        <p>Uphill Coach AI • Basado en <em>Training for the Uphill Athlete</em> & Suunto ZoneSense (DFA a1)</p>
      </footer>

      {/* Offline Mountain Indicator */}
      <OfflineIndicator />

    </div>
  );
}
