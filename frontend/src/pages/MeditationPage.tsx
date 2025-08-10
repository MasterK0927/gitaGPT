import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  Plus,
  Calendar,
  Clock,
  Filter,
  Edit,
  Trash2,
  Play,
  Pause,
  MoreVertical,
  CheckCircle,
  XCircle,
  TrendingUp,
  Target,
  Sparkles,
  Heart,
  Settings,
  ChevronDown,
  Loader2,
  Mail,
  MailX,
  Clock3
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '../shared/components/ui';
import { useMeditationStore } from '../features/meditation/stores/meditationStore';
import { ScheduleMeditationModal } from '../features/meditation/components/ScheduleMeditationModal';
import { meditationUtils } from '../services/meditationAPI';
import { MeditationSchedule } from '../shared/types';
import { cacheWarmingService } from '../services/cacheWarmingService';

export const MeditationPage: React.FC = () => {
  const { getToken } = useAuth();
  const {
    schedules,
    sessions,
    stats,
    isLoading,
    showActiveSchedulesOnly,
    fetchSchedules,
    fetchSessions,
    fetchStats,
    deleteSchedule,
    toggleScheduleActive,
    resendScheduleEmail,
    setShowActiveSchedulesOnly
  } = useMeditationStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [toggleLoadingStates, setToggleLoadingStates] = useState<Record<string, boolean>>({});

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'mindfulness', label: 'Mindfulness' },
    { value: 'breathing', label: 'Breathing' },
    { value: 'body-scan', label: 'Body Scan' },
    { value: 'loving-kindness', label: 'Loving Kindness' },
    { value: 'walking', label: 'Walking' },
    { value: 'mantra', label: 'Mantra' }
  ];

  const frequencyOptions = [
    { value: 'all', label: 'All Frequencies' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'custom', label: 'Custom' }
  ];

  useEffect(() => {
    // Load data when component mounts with cache-first strategy
    const loadData = async () => {
      // Warm cache for this route if needed
      await cacheWarmingService.warmCacheForRoute('/meditation');

      // Load data (will use cache if available)
      fetchSchedules(false, false, getToken);
      fetchSessions(20, false, getToken);
      fetchStats(false, getToken);
    };

    loadData();
  }, [fetchSchedules, fetchSessions, fetchStats]);

  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowTypeDropdown(false);
        setShowFrequencyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSchedules = schedules.filter(schedule => {
    if (showActiveSchedulesOnly && !schedule.is_active) return false;
    if (filterType !== 'all' && schedule.meditation_type !== filterType) return false;
    if (filterFrequency !== 'all' && schedule.frequency !== filterFrequency) return false;
    return true;
  });

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (window.confirm('Are you sure you want to delete this meditation schedule?')) {
      await deleteSchedule(scheduleId, getToken);
    }
  };

  const handleToggleActive = async (scheduleId: string) => {
    // Prevent multiple clicks
    if (toggleLoadingStates[scheduleId]) return;

    setToggleLoadingStates(prev => ({ ...prev, [scheduleId]: true }));

    try {
      await toggleScheduleActive(scheduleId, getToken);
    } finally {
      setToggleLoadingStates(prev => ({ ...prev, [scheduleId]: false }));
    }
  };

  const handleResendEmail = async (scheduleId: string) => {
    await resendScheduleEmail(scheduleId, getToken);
  };

  const getNextSession = (schedule: MeditationSchedule) => {
    const nextTime = meditationUtils.getNextScheduledTime(schedule);
    if (!nextTime) return 'Not scheduled';

    const now = new Date();
    const diffMs = nextTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      return 'Soon';
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Heart className="w-8 h-8 text-primary" />
              Meditation Center
            </h1>
            <p className="text-muted-foreground mt-2">
              Create mindful moments, track your progress, and build a consistent meditation practice
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Schedule
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                  <p className="text-2xl font-bold">{stats.totalSessions}</p>
                  <p className="text-xs text-muted-foreground mt-1">Completed meditations</p>
                </div>
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Time</p>
                  <p className="text-2xl font-bold">{meditationUtils.formatDuration(stats.totalMinutes)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Time in meditation</p>
                </div>
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Streak</p>
                  <p className="text-2xl font-bold">{stats.currentStreak} days</p>
                  <p className="text-xs text-muted-foreground mt-1">Consecutive days</p>
                </div>
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Rating</p>
                  <p className="text-2xl font-bold">{stats.averageRating.toFixed(1)}/5</p>
                  <p className="text-xs text-muted-foreground mt-1">Session quality</p>
                </div>
                <Target className="w-6 h-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-primary" />
              Filter & Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* Toggle Section */}
              <div className="md:col-span-1">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm h-full">
                  <div className="flex flex-col">
                    <label htmlFor="active-only" className="text-sm font-medium cursor-pointer">
                      {showActiveSchedulesOnly ? 'Active Only' : 'Show All'}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {showActiveSchedulesOnly ? 'Paused schedules hidden' : 'Including paused schedules'}
                    </span>
                  </div>
                  <button
                    type="button"
                    id="active-only"
                    onClick={() => setShowActiveSchedulesOnly(!showActiveSchedulesOnly)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${showActiveSchedulesOnly
                      ? 'bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25'
                      : 'bg-gradient-to-r from-muted/60 to-muted/40 backdrop-blur-sm border border-border/30'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-300 ${showActiveSchedulesOnly ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* Type Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Type:</label>
                <div className="relative dropdown-container">
                  <button
                    type="button"
                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-card text-card-foreground hover:bg-accent/50 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between"
                  >
                    <span>{typeOptions.find(opt => opt.value === filterType)?.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showTypeDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showTypeDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                      >
                        {typeOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setFilterType(option.value);
                              setShowTypeDropdown(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-accent/50 transition-colors duration-150 ${filterType === option.value ? 'bg-primary/10 text-primary font-medium' : 'text-card-foreground'
                              }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Frequency Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Frequency:</label>
                <div className="relative dropdown-container">
                  <button
                    type="button"
                    onClick={() => setShowFrequencyDropdown(!showFrequencyDropdown)}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-card text-card-foreground hover:bg-accent/50 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between"
                  >
                    <span>{frequencyOptions.find(opt => opt.value === filterFrequency)?.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showFrequencyDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showFrequencyDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                      >
                        {frequencyOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setFilterFrequency(option.value);
                              setShowFrequencyDropdown(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-accent/50 transition-colors duration-150 ${filterFrequency === option.value ? 'bg-primary/10 text-primary font-medium' : 'text-card-foreground'
                              }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Schedules List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Your Meditation Schedules
            <span className="text-lg font-normal text-muted-foreground">({filteredSchedules.length})</span>
          </h2>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Schedule
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-5 bg-muted rounded w-32"></div>
                        <div className="w-2 h-2 bg-muted rounded-full"></div>
                      </div>
                      <div className="h-4 bg-muted rounded w-24"></div>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-8 h-8 bg-muted rounded"></div>
                      <div className="w-8 h-8 bg-muted rounded"></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="h-4 bg-muted rounded w-12 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-16"></div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="h-4 bg-muted rounded w-12 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-muted">
                    <div className="flex justify-between">
                      <div className="h-3 bg-muted rounded w-8"></div>
                      <div className="h-3 bg-muted rounded w-20"></div>
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 bg-muted rounded w-8"></div>
                      <div className="h-3 bg-muted rounded w-16"></div>
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 bg-muted rounded w-12"></div>
                      <div className="h-3 bg-muted rounded w-14"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredSchedules.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No meditation schedules</h3>
              <p className="text-muted-foreground mb-4">
                Create your first meditation schedule to start your practice
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.map((schedule) => (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card
                  className={`h-full transition-all duration-200 hover:shadow-lg ${!schedule.is_active
                    ? 'opacity-70 border-dashed'
                    : 'border-solid hover:border-primary/20'
                    }`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg truncate">{schedule.title}</CardTitle>
                            <div className="flex items-center gap-1">
                              <div
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${schedule.is_active ? 'bg-green-500' : 'bg-orange-500'
                                  }`}
                                title={schedule.is_active ? 'Active' : 'Paused'}
                              />
                              {/* Email Status Indicator */}
                              {schedule.email_status && (
                                <div
                                  className="flex-shrink-0"
                                  title={
                                    schedule.email_status === 'sent'
                                      ? 'Email notification sent'
                                      : schedule.email_status === 'failed'
                                        ? `Email failed: ${schedule.email_error || 'Unknown error'}`
                                        : schedule.email_status === 'queued'
                                          ? 'Email notification queued'
                                          : 'Email notification pending'
                                  }
                                >
                                  {schedule.email_status === 'sent' && (
                                    <Mail className="w-3 h-3 text-green-600" />
                                  )}
                                  {schedule.email_status === 'failed' && (
                                    <MailX className="w-3 h-3 text-red-500" />
                                  )}
                                  {(schedule.email_status === 'queued' || schedule.email_status === 'pending') && (
                                    <Clock3 className="w-3 h-3 text-orange-500" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {schedule.description || 'No description provided'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(schedule.id)}
                          disabled={toggleLoadingStates[schedule.id]}
                          className="p-2 hover:bg-muted/50 transition-colors disabled:opacity-50 min-w-[32px] h-8"
                          title={
                            toggleLoadingStates[schedule.id]
                              ? 'Updating...'
                              : schedule.is_active
                                ? 'Pause schedule'
                                : 'Resume schedule'
                          }
                        >
                          {toggleLoadingStates[schedule.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : schedule.is_active ? (
                            <Pause className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Play className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                        {/* Resend Email Button - only show for failed emails */}
                        {schedule.email_status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendEmail(schedule.id)}
                            className="p-2 hover:bg-blue-50 hover:text-blue-600 transition-colors min-w-[32px] h-8"
                            title="Resend email notification"
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors min-w-[32px] h-8"
                          title="Delete schedule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-4">
                    {/* Key Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 rounded-lg">
                        <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{meditationUtils.formatDuration(schedule.duration_minutes)}</p>
                          <p className="text-xs text-muted-foreground">Duration</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/10 rounded-lg">
                        <Calendar className="w-5 h-5 text-secondary-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{meditationUtils.formatTime(schedule.time_of_day)}</p>
                          <p className="text-xs text-muted-foreground">Time</p>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3 pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Days</span>
                        <span className="text-right font-medium text-foreground">
                          {meditationUtils.getDayNames(schedule.days_of_week).join(', ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Type</span>
                        <span className="capitalize font-medium bg-primary/10 text-primary px-2 py-1 rounded-md text-xs">
                          {schedule.meditation_type}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Next session</span>
                        <span className={`font-medium text-xs px-2 py-1 rounded-md ${schedule.is_active
                          ? 'text-green-700 bg-green-50'
                          : 'text-orange-700 bg-orange-50'
                          }`}>
                          {getNextSession(schedule)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Recent Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          Recent Sessions
        </h2>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No meditation sessions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sessions.slice(0, 5).map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{session.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {meditationUtils.formatDuration(session.duration_minutes)} • {session.meditation_type}
                        {session.rating && ` • ${meditationUtils.getRatingStars(session.rating)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.started_at).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-1 text-xs">
                        {session.mood_before && (
                          <span>{meditationUtils.getMoodEmoji(session.mood_before)}</span>
                        )}
                        {session.mood_after && (
                          <span>→ {meditationUtils.getMoodEmoji(session.mood_after)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* Create Schedule Modal */}
      <ScheduleMeditationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
};
