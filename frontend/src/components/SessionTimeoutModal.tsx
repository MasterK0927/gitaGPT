import React from 'react';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { Modal } from '../shared/components/ui/Modal';
import { Button } from '../shared/components/ui/Button';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  timeRemaining: number;
  onExtendSession: () => void;
  onLogout: () => void;
  formatTimeRemaining: (ms: number) => string;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  timeRemaining,
  onExtendSession,
  onLogout,
  formatTimeRemaining,
}) => {
  const isUrgent = timeRemaining <= 60000; // Less than 1 minute

  return (
    <Modal
      open={isOpen}
      onOpenChange={() => { }} // Prevent closing by clicking outside
      title="Session Expiring Soon"
      size="sm"
      className="z-[9999]"
    >
      <div className="space-y-6">
        {/* Warning Header */}
        <div className={`flex items-center gap-3 p-4 rounded-lg ${isUrgent
            ? 'bg-red-50 border border-red-200'
            : 'bg-yellow-50 border border-yellow-200'
          }`}>
          <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${isUrgent ? 'text-red-500' : 'text-yellow-500'
            }`} />
          <div>
            <h3 className={`font-semibold ${isUrgent ? 'text-red-800' : 'text-yellow-800'
              }`}>
              Your session is about to expire
            </h3>
            <p className={`text-sm mt-1 ${isUrgent ? 'text-red-600' : 'text-yellow-600'
              }`}>
              You will be automatically logged out for security reasons.
            </p>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-yellow-500'
              }`} />
            <span className="text-sm font-medium text-gray-600">
              Time remaining:
            </span>
          </div>
          <div className={`text-3xl font-bold font-mono ${isUrgent ? 'text-red-600' : 'text-yellow-600'
            }`}>
            {formatTimeRemaining(timeRemaining)}
          </div>
        </div>

        {/* Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Why does this happen?</p>
              <p>
                For your security, we automatically log you out after periods of inactivity.
                This helps protect your account if you forget to log out on a shared device.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onExtendSession}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Stay Logged In
          </Button>
          <Button
            onClick={onLogout}
            variant="outline"
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
            size="lg"
          >
            Log Out Now
          </Button>
        </div>

        {/* Additional Info */}
        <div className="text-center space-y-2">
          <p className="text-xs text-gray-500">
            Your session will be extended by 30 minutes if you choose to stay logged in.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <span>Session timeout:</span>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">
              {Math.floor((parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MS || '1800000')) / 60000)} min
            </span>
            <span>•</span>
            <span>Warning:</span>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">
              {Math.floor((parseInt(import.meta.env.VITE_SESSION_WARNING_MS || '300000')) / 60000)} min
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
