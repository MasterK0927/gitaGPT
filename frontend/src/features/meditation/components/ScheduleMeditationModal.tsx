import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  Clock,
  Calendar,
  Bell,
  Volume2,
  Repeat,
  Plus,
  Timer,
  Heart,
  Sparkles
} from 'lucide-react';
import {
  Modal,
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '../../../shared/components/ui';
import { useMeditationStore } from '../stores/meditationStore';
import { CreateScheduleData } from '../../../services/meditationAPI';

interface ScheduleMeditationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon', name: 'Monday' },
  { value: 2, label: 'Tue', name: 'Tuesday' },
  { value: 3, label: 'Wed', name: 'Wednesday' },
  { value: 4, label: 'Thu', name: 'Thursday' },
  { value: 5, label: 'Fri', name: 'Friday' },
  { value: 6, label: 'Sat', name: 'Saturday' },
  { value: 7, label: 'Sun', name: 'Sunday' },
];

const MEDITATION_TYPES = [
  { value: 'mindfulness', label: 'Mindfulness', description: 'Present moment awareness' },
  { value: 'breathing', label: 'Breathing', description: 'Focus on breath patterns' },
  { value: 'body-scan', label: 'Body Scan', description: 'Progressive relaxation' },
  { value: 'loving-kindness', label: 'Loving Kindness', description: 'Cultivate compassion' },
  { value: 'walking', label: 'Walking', description: 'Mindful movement' },
  { value: 'mantra', label: 'Mantra', description: 'Sacred sound repetition' },
];

const BACKGROUND_SOUNDS = [
  { value: 'silence', label: 'Silence', description: 'Complete quiet' },
  { value: 'nature', label: 'Nature Sounds', description: 'Birds, water, wind' },
  { value: 'bells', label: 'Tibetan Bells', description: 'Traditional meditation bells' },
  { value: 'ocean', label: 'Ocean Waves', description: 'Calming wave sounds' },
  { value: 'rain', label: 'Rain', description: 'Gentle rainfall' },
  { value: 'forest', label: 'Forest', description: 'Peaceful forest ambiance' },
];

export const ScheduleMeditationModal: React.FC<ScheduleMeditationModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { createSchedule, isLoading } = useMeditationStore();
  const { getToken } = useAuth();

  // Form state
  const [formData, setFormData] = useState<CreateScheduleData>({
    title: '',
    description: '',
    duration_minutes: 15,
    frequency: 'daily',
    days_of_week: [1, 2, 3, 4, 5, 6, 7], // All days by default
    time_of_day: '07:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_active: true,
    reminder_enabled: true,
    reminder_minutes_before: 10,
    meditation_type: 'mindfulness',
    background_sound: 'silence',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        title: '',
        description: '',
        duration_minutes: 15,
        frequency: 'daily',
        days_of_week: [1, 2, 3, 4, 5, 6, 7],
        time_of_day: '07:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        is_active: true,
        reminder_enabled: true,
        reminder_minutes_before: 10,
        meditation_type: 'mindfulness',
        background_sound: 'silence',
      });
      setErrors({});
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.duration_minutes || formData.duration_minutes < 1 || formData.duration_minutes > 180) {
      newErrors.duration_minutes = 'Duration must be between 1 and 180 minutes';
    }

    if (!formData.time_of_day) {
      newErrors.time_of_day = 'Time is required';
    }

    if (!formData.days_of_week || formData.days_of_week.length === 0) {
      newErrors.days_of_week = 'Select at least one day';
    }

    // Validate reminder time vs duration
    if (formData.reminder_enabled && formData.reminder_minutes_before && formData.duration_minutes) {
      if (formData.reminder_minutes_before > formData.duration_minutes) {
        newErrors.reminder_minutes_before = 'Reminder time cannot be greater than meditation duration';
      }
    }

    // Validate title length
    if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    // Ensure data is properly formatted
    const cleanFormData: CreateScheduleData = {
      title: formData.title,
      description: formData.description || undefined,
      duration_minutes: Number(formData.duration_minutes) || 15,
      frequency: formData.frequency,
      days_of_week: Array.isArray(formData.days_of_week) ? formData.days_of_week : [],
      time_of_day: formData.time_of_day,
      timezone: formData.timezone,
      is_active: formData.is_active,
      reminder_enabled: formData.reminder_enabled,
      reminder_minutes_before: Number(formData.reminder_minutes_before) || 10,
      meditation_type: formData.meditation_type,
      background_sound: formData.background_sound
    };

    const schedule = await createSchedule(cleanFormData, getToken);
    if (schedule) {
      onOpenChange(false);
    }
  };

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week?.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...(prev.days_of_week || []), day].sort()
    }));
  };

  const handleFrequencyChange = (frequency: 'daily' | 'weekly' | 'custom') => {
    let days_of_week = formData.days_of_week;

    if (frequency === 'daily') {
      days_of_week = [1, 2, 3, 4, 5, 6, 7];
    } else if (frequency === 'weekly') {
      days_of_week = [1]; // Default to Monday
    }

    setFormData(prev => ({
      ...prev,
      frequency,
      days_of_week
    }));
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule Meditation"
      description="Create a regular meditation practice that fits your lifestyle"
      size="xl"
      className="max-h-[90vh]"
    >
      <div
        className="overflow-y-auto space-y-6 max-h-[70vh] pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 hover:scrollbar-thumb-muted-foreground/50"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent'
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Card */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4 bg-muted/20 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="w-5 h-5 text-primary" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <Input
                label="Meditation Title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Morning Mindfulness, Evening Calm"
                error={errors.title}
                required
              />

              <div>
                <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add any notes about this meditation practice..."
                  className="w-full px-4 py-3 border border-border rounded-xl resize-none h-24 text-sm bg-card text-card-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule Settings Card */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4 bg-muted/20 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Timer className="w-5 h-5 text-primary" />
                Schedule Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* Duration */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Duration
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      duration_minutes: parseInt(e.target.value)
                    }))}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(((formData.duration_minutes || 15) - 5) / 55) * 100}%, hsl(var(--muted)) ${(((formData.duration_minutes || 15) - 5) / 55) * 100}%, hsl(var(--muted)) 100%)`
                    }}
                  />
                  <span className="text-sm font-semibold w-20 text-center bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20">
                    {formData.duration_minutes} min
                  </span>
                </div>
                {errors.duration_minutes && (
                  <p className="text-sm text-red-500">{errors.duration_minutes}</p>
                )}
              </div>

              {/* Time */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Time of Day
                </label>
                <Input
                  type="time"
                  value={formData.time_of_day}
                  onChange={(e) => setFormData(prev => ({ ...prev, time_of_day: e.target.value }))}
                  error={errors.time_of_day}
                  required
                />
              </div>

              {/* Frequency */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  <Repeat className="w-4 h-4 inline mr-2" />
                  Frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'custom'] as const).map((freq) => (
                    <Button
                      key={freq}
                      type="button"
                      variant={formData.frequency === freq ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleFrequencyChange(freq)}
                      className="capitalize h-10"
                    >
                      {freq}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Days Selection Card */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4 bg-muted/20 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Calendar className="w-5 h-5 text-primary" />
                Days of Week
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={formData.days_of_week?.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleDayToggle(day.value)}
                    className="w-12 h-12 p-0 text-xs font-medium"
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
              {errors.days_of_week && (
                <p className="text-sm text-red-500 mt-2">{errors.days_of_week}</p>
              )}
            </CardContent>
          </Card>

          {/* Meditation Preferences Card */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4 bg-muted/20 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Heart className="w-5 h-5 text-primary" />
                Meditation Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* Meditation Type */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Meditation Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {MEDITATION_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={formData.meditation_type === type.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, meditation_type: type.value }))}
                      className="h-auto p-3 flex flex-col items-center text-center"
                    >
                      <span className="text-sm font-medium">{type.label}</span>
                      <span className="text-xs opacity-70 mt-1">{type.description}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Background Sound */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  <Volume2 className="w-4 h-4 inline mr-2" />
                  Background Sound
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {BACKGROUND_SOUNDS.map((sound) => (
                    <Button
                      key={sound.value}
                      type="button"
                      variant={formData.background_sound === sound.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, background_sound: sound.value }))}
                      className="h-auto p-3 flex flex-col items-center text-center"
                    >
                      <span className="text-sm font-medium">{sound.label}</span>
                      <span className="text-xs opacity-70 mt-1">{sound.description}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings Card */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4 bg-muted/20 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Bell className="w-5 h-5 text-primary" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Reminder Notifications</p>
                  <p className="text-xs text-muted-foreground">Get notified before your meditation</p>
                </div>
                <Button
                  type="button"
                  variant={formData.reminder_enabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, reminder_enabled: !prev.reminder_enabled }))}
                >
                  {formData.reminder_enabled ? 'On' : 'Off'}
                </Button>
              </div>

              {formData.reminder_enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <label className="text-sm font-medium">
                    Remind me before meditation
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 30].map((minutes) => (
                      <Button
                        key={minutes}
                        type="button"
                        variant={formData.reminder_minutes_before === minutes ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, reminder_minutes_before: minutes }))}
                        className="h-10"
                      >
                        {minutes}m
                      </Button>
                    ))}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Validation Summary */}
          {Object.keys(errors).length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">!</span>
                  Please fix the following errors:
                </h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {Object.entries(errors).map(([field, error]) => (
                    <li key={field} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t border-border/50 bg-muted/20 -mx-6 px-6 py-4 rounded-b-lg">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || Object.keys(errors).length > 0}
              className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 disabled:opacity-50"
              loading={isLoading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Schedule
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
