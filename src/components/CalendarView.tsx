import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Mountain, 
  Activity, 
  Dumbbell, 
  AlertCircle,
  TrendingUp,
  FileCheck,
  Brain,
  Zap
} from 'lucide-react';
import { Workout, AthleteProfile, TargetRace, WorkoutType } from '../types';

interface CalendarViewProps {
  workouts: Workout[];
  profile: AthleteProfile;
  targetRace: TargetRace;
  onSelectWorkout: (workout: Workout) => void;
  onAddNewWorkout: (dateStr: string) => void;
  onGenerateWeekWithMiguel: (weekStartDateStr: string) => void;
  isGeneratingPlan: boolean;
  onOpenFartlekGenerator?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  workouts,
  profile,
  targetRace,
  onSelectWorkout,
  onAddNewWorkout,
  onGenerateWeekWithMiguel,
  isGeneratingPlan,
  onOpenFartlekGenerator,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Navigation: prev / next month
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Calculate days for the calendar grid
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week index for Monday start (0 = Mon, 6 = Sun)
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const totalDays = lastDayOfMonth.getDate();

  // Days array
  const calendarCells = [];
  // Empty cells for preceding month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarCells.push(null);
  }
  // Days of current month
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to format date YYYY-MM-DD
  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Get Monday of current selected week for generating a plan
  const getSelectedMondayStr = () => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return formatDateKey(monday);
  };

  const getWorkoutColor = (type: WorkoutType) => {
    switch (type) {
      case 'easy_run':
        return 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300';
      case 'long_mountain_run':
        return 'bg-amber-950/60 border-amber-600/70 text-amber-300';
      case 'muscular_endurance':
        return 'bg-orange-950/60 border-orange-600/70 text-orange-300';
      case 'hill_intervals':
        return 'bg-red-950/60 border-red-600/70 text-red-300';
      case 'strength_core':
        return 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300';
      case 'drift_test':
        return 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300';
      case 'rest':
        return 'bg-zinc-900 border-zinc-800 text-zinc-400';
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-300';
    }
  };

  // Calculate monthly stats
  const currentMonthWorkouts = workouts.filter((w) => {
    const wDate = new Date(w.date);
    return wDate.getFullYear() === year && wDate.getMonth() === month;
  });

  const totalPlannedMinutes = currentMonthWorkouts.reduce((acc, w) => acc + (w.plannedDurationMin || 0), 0);
  const totalCompletedMinutes = currentMonthWorkouts
    .filter((w) => w.completed)
    .reduce((acc, w) => acc + (w.actualDurationMin || w.plannedDurationMin || 0), 0);
  const totalCompletedDPlus = currentMonthWorkouts
    .filter((w) => w.completed)
    .reduce((acc, w) => acc + (w.actualElevationGainM || w.plannedElevationGainM || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Top Controls & Month Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
        
        {/* Navigation & Month */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-100 flex items-center space-x-2">
              <span>{monthNames[month]}</span>
              <span className="text-zinc-500 font-normal">{year}</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Macrociclo hacia Transvulcania 2027 • 4 sesiones/semana
            </p>
          </div>
          <div className="flex items-center space-x-1 pl-3">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenFartlekGenerator && (
            <button
              onClick={onOpenFartlekGenerator}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 transition-all shadow-sm cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Generador de Fartlek</span>
            </button>
          )}

          <button
            onClick={() => onAddNewWorkout(todayStr)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Escribir Sesión</span>
          </button>

          <button
            onClick={() => onGenerateWeekWithMiguel(getSelectedMondayStr())}
            disabled={isGeneratingPlan}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 text-xs font-black transition-all shadow-md disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGeneratingPlan ? 'Generando con Miguel...' : 'Planificar Semana con Miguel'}</span>
          </button>
        </div>

      </div>

      {/* Month Metrics Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="flex items-center space-x-2 text-zinc-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Volumen Completado</span>
          </div>
          <div className="text-lg font-black text-zinc-100">
            {Math.round((totalCompletedMinutes / 60) * 10) / 10} h
            <span className="text-xs font-normal text-zinc-500 ml-1.5">
              / {Math.round(totalPlannedMinutes / 60)}h prev.
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="flex items-center space-x-2 text-zinc-400 text-xs mb-1">
            <Mountain className="w-3.5 h-3.5 text-amber-400" />
            <span>Desnivel Acumulado</span>
          </div>
          <div className="text-lg font-black text-amber-400">
            +{totalCompletedDPlus} m D+
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="flex items-center space-x-2 text-zinc-400 text-xs mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sesiones Completadas</span>
          </div>
          <div className="text-lg font-black text-zinc-100">
            {currentMonthWorkouts.filter((w) => w.completed).length}
            <span className="text-xs font-normal text-zinc-500 ml-1.5">
              / {currentMonthWorkouts.length}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="flex items-center space-x-2 text-zinc-400 text-xs mb-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Frecuencia Semanal</span>
          </div>
          <div className="text-lg font-black text-zinc-100">
            4 días / sem
            <span className="text-xs font-normal text-emerald-400 ml-1.5">
              3 + Tirada Larga
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/80 text-center py-2.5">
          {daysOfWeek.map((day, idx) => (
            <div
              key={day}
              className={`text-xs font-bold uppercase tracking-wider ${
                idx >= 5 ? 'text-amber-400' : 'text-zinc-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-zinc-800/80 bg-zinc-950/40 min-h-[500px]">
          {calendarCells.map((dateObj, idx) => {
            if (!dateObj) {
              return (
                <div key={`empty-${idx}`} className="bg-zinc-950/20 min-h-[110px] p-2 opacity-30" />
              );
            }

            const dateKey = formatDateKey(dateObj);
            const isToday = dateKey === todayStr;
            const dayWorkouts = workouts.filter((w) => w.date === dateKey);
            const dayNumber = dateObj.getDate();
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            return (
              <div
                key={dateKey}
                className={`min-h-[115px] p-2 transition-all flex flex-col justify-between group hover:bg-zinc-800/40 relative ${
                  isToday ? 'bg-amber-500/5 ring-1 ring-inset ring-amber-500/30' : ''
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-extrabold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-amber-500 text-zinc-950'
                        : isWeekend
                        ? 'text-amber-400 font-black'
                        : 'text-zinc-300'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  {/* Add button on hover */}
                  <button
                    onClick={() => onAddNewWorkout(dateKey)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-100 p-1 rounded hover:bg-zinc-700/60 transition-opacity"
                    title={`Escribir sesión para ${dateKey}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Workout Cards on this day */}
                <div className="space-y-1.5 flex-1">
                  {dayWorkouts.map((workout) => (
                    <div
                      key={workout.id}
                      onClick={() => onSelectWorkout(workout)}
                      className={`cursor-pointer rounded-lg p-2 border text-xs transition-all hover:scale-[1.02] shadow-sm relative ${getWorkoutColor(
                        workout.type
                      )}`}
                    >
                      <div className="flex items-center justify-between font-bold leading-tight line-clamp-1">
                        <span className="flex items-center gap-1">
                          {workout.title}
                          {workout.personalizedReasoning && (
                            <span title="Sesión 100% personalizada según la memoria de Miguel" className="flex items-center">
                              <Brain className="w-3 h-3 text-emerald-400 shrink-0" />
                            </span>
                          )}
                        </span>
                        {workout.completed && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] opacity-80 mt-1">
                        <span>{workout.completed && workout.actualDurationMin ? workout.actualDurationMin : workout.plannedDurationMin} min</span>
                        {workout.plannedElevationGainM && workout.plannedElevationGainM > 0 && (
                          <span className="font-semibold">+{workout.actualElevationGainM || workout.plannedElevationGainM}m</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-1">
                        {workout.tss ? (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono">
                            {workout.tss} TSS
                          </span>
                        ) : null}

                        {workout.wasAdapted && (
                          <div className="text-[9px] font-bold text-amber-300 bg-amber-950/80 px-1 py-0.5 rounded border border-amber-500/40">
                            Adaptado HRV
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* If no workouts, subtle hint */}
                  {dayWorkouts.length === 0 && (
                    <div
                      onClick={() => onAddNewWorkout(dateKey)}
                      className="h-full flex items-center justify-center opacity-0 group-hover:opacity-60 cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-300 italic"
                    >
                      + Escribir
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 px-2">
        <span className="font-bold text-zinc-300">Leyenda Uphill:</span>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-500"></span>
          <span>Aeróbico Z1/Z2 (DFA a1 &gt; 0.75)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500/40 border border-amber-500"></span>
          <span>Tirada Larga Montaña</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-500/40 border border-orange-500"></span>
          <span>Muscular Endurance (ME)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-500/40 border border-indigo-500"></span>
          <span>Fuerza en Casa / Outdoor</span>
        </div>
      </div>

    </div>
  );
};
